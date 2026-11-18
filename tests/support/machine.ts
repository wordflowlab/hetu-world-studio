import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {canonical} from "../../vendor/project-store.ts";
import toolRoutes from "./tool-routes.json" with {type:"json"};
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import manifest from "../../contracts/plugin-manifest.json" with { type: "json" };
export const host = path.resolve(
  process.env.HETU_SOURCE ?? "../../limecloud/hetu",
);
export async function start() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hetu-world-studio-"));
  await mkdir(path.join(directory, "requests"));
  const packageDirectory = path.join(directory, "package");
  await cp(
    path.resolve(process.env.HETU_TEST_PACKAGE ?? "dist"),
    packageDirectory,
    { recursive: true },
  );
  const packaged = !!process.env.HETU_PACKAGED_APP;
  assert.ok(
    !packaged || process.env.HETU_TEST_BIN,
    "安装验收必须明确随包机器入口目录",
  );
  const bin = process.env.HETU_TEST_BIN ?? path.join(host, "target/debug");
  const version = spawnSync(path.join(bin, "hetu"), ["--version"], {
    encoding: "utf8",
    timeout: 10000,
  });
  assert.equal(version.status, 0, version.stderr);
  const coreVersion = version.stdout.trim();
  const env = {
    ...process.env,
    HETU_DESKTOP_PROFILE: path.join(directory, "profile"),
    HETU_COLLABORATION_DIR: path.join(directory, "hub"),
    HETU_PLUGIN_STATE_DIR: path.join(directory, "plugins"),
    HETU_PLUGIN_ACCESS_DIR: path.join(directory, "access"),
    HETU_PLUGIN_NODE: process.execPath,
    HETU_PLUGIN_CLI: path.join(bin, "hetu-plugin"),
    HETU_APP_SERVER: path.join(bin, "hetu-app-server"),
    HETU_PLUGIN_MANAGER:
      process.env.HETU_PLUGIN_MANAGER ??
      path.join(host, "apps/desktop/dist/plugin-manager.mjs"),
  };
  if (packaged) {
    for (const key of [
      "HETU_PLUGIN_NODE",
      "HETU_PLUGIN_CLI",
      "HETU_APP_SERVER",
      "HETU_PLUGIN_MANAGER",
      "HETU_CLI",
      "ELECTRON_RUN_AS_NODE",
    ])
      delete (env as Record<string, string | undefined>)[key];
  }
  const resolve = createRequire(path.join(host, "apps/desktop/package.json"));
  const { Client } = await import(
    pathToFileURL(resolve.resolve("@modelcontextprotocol/client")).href
  );
  const { StdioClientTransport } = await import(
    pathToFileURL(resolve.resolve("@modelcontextprotocol/client/stdio")).href
  );
  const client = new Client(
    { name: manifest.id + "-test", version: "1" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  await client.connect(
    new StdioClientTransport({
      command: path.join(bin, "hetu-mcp"),
      args: [
        "--client",
        "codex",
        "--collaboration-dir",
        env.HETU_COLLABORATION_DIR,
      ],
      env,
      stderr: "pipe",
    }),
  );
  const catalog = (await client.listTools()).tools;
  const available = new Set(catalog.map((t:any)=>t.name));
  const actionByTool:Record<string,string>=toolRoutes;
  async function readView(action:string,input:any,expected:string,result_path="",offset=0):Promise<any>{
    const response:any=(await client.callTool({name:"hetu_call_action",arguments:{action,input,view:{result_path,expected_result_sha256:expected,offset,limit:20,max_bytes:8192}}})).structuredContent;
    assert.equal(response.status,"succeeded",JSON.stringify(response));
    const v=response.data.view;assert.equal(v.source_result_sha256,expected);
    if("value" in v)return v.value;
    if(v.fields){const fields:any={};for(const f of v.fields)fields[f.name]=await readView(action,input,expected,f.result_path);return fields;}
    if(v.page){let text=v.page.content;if(v.next_offset!==null)text+=await readView(action,input,expected,result_path,v.next_offset);return text;}
    if(v.items){const rows=[...v.items];if(v.next_offset!==null)rows.push(...await readView(action,input,expected,result_path,v.next_offset));return rows;}
    if(v.next_path){const one=await readView(action,input,expected,v.next_path);const tail=await readView(action,input,expected,result_path,offset+1);return [one,...tail];}
    throw Error("未识别的固定结果投影");
  }
  async function readOperation(input:any):Promise<any>{
    const fixedInput={...input};delete fixedInput.detail;let expected:string|undefined;
    async function page(result_path:string,offset=0):Promise<any>{
      const response:any=(await client.callTool({name:"hetu_call_action",arguments:{action:"hetu.operations.get",input:{...fixedInput,result_path,offset,limit:20,max_bytes:8192}}})).structuredContent;
      assert.equal(response.status,"succeeded",JSON.stringify(response));
      const v=response.data;expected??=v.result_sha256;assert.equal(v.result_sha256,expected);
      if("value" in v)return v.value;
      if(v.fields){const value:any={};for(const field of v.fields)value[field.name]=await page(field.result_path);return value;}
      if(v.page){let text=v.page.content;if(v.next_offset!==null)text+=await page(result_path,v.next_offset);return text;}
      if(v.items){const rows=[...v.items];if(v.next_offset!==null)rows.push(...await page(result_path,v.next_offset));return rows;}
      if(v.next_path)return [await page(v.next_path),...await page(result_path,offset+1)];
      throw Error("未识别的原操作结果分页");
    }
    const result=await page("");assert.equal(createHash("sha256").update(canonical(result)).digest("hex"),expected,"原操作完整结果摘要");return result;
  }
  const checkedActions=new Set<string>();
  let serial = 0;
  const call = async (name: string, args: any = {}) => {
    const record = path.join(
      directory,
      "requests",
      String(++serial).padStart(4, "0"),
    );
    await writeFile(
      record + ".request.json",
      JSON.stringify({ name, arguments: args }),
      { mode: 0o600 },
    );
    const chosen = available.has(name) ? {name,arguments:args} : {name:"hetu_call_action",arguments:{action:actionByTool[name],input:args}};
    assert.ok(available.has(name)||actionByTool[name],"缺少公开动作映射："+name);
    if(!available.has(name)&&!checkedActions.has(actionByTool[name])){
      const discovered:any=(await client.callTool({name:"hetu_inspect_collaboration",arguments:{action:actionByTool[name],include_schema:true,limit:1}})).structuredContent;
      await writeFile(record+".discovery.json",JSON.stringify(discovered),{mode:0o600});
      assert.equal(discovered.status,"succeeded",JSON.stringify(discovered));
      assert.equal(discovered.data.actions[0]?.name,actionByTool[name]);
      checkedActions.add(actionByTool[name]);
    }
    let result = (await client.callTool(chosen)).structuredContent as any;
    if(result.data?.recovery?.action==="hetu.operations.get"&&result.data.response?.retained===true){
      await writeFile(record+".wire-result.json",JSON.stringify(result),{mode:0o600});
      result=await readOperation(result.data.recovery.input);
    }
    if(result.data?.response?.read&&result.data.response.complete===false){
      const wire=result,expected=wire.data.response.source_result_sha256;
      await writeFile(record+".wire-result.json",JSON.stringify(wire),{mode:0o600});
      const read=wire.data.response.read.input;
      if(name==="hetu_plugins_capabilities"){
        // 宿主动作按调用前精确发现；此处只读取本专业包合同，避免回读全部Core Schema。
        const actions=await readView(read.action,read.input,expected,"/actions");
        const types=await readView(read.action,read.input,expected,"/types");
        result={...wire,data:{...wire.data,actions,types,core_actions_omitted:true}};
      }else{
        const data=await readView(read.action,read.input,expected);
        result={...wire,data};
        assert.equal(createHash("sha256").update(canonical(result)).digest("hex"),expected,"完整结果摘要保持");
      }
    }
    await writeFile(record + ".result.json", JSON.stringify(result), {
      mode: 0o600,
    });
    return result;
  };
  const ok = async (name: string, args: any = {}) => {
    const r = await call(name, args);
    assert.equal(r.status, "succeeded", JSON.stringify(r));
    return r.data;
  };
  try {
    const tools = (await client.listTools()).tools.map((x: any) => x.name);
    const begin = await ok("hetu_begin_creation", {
      brief: "旧站隔离插件验收",
      locale: "zh-CN",
      operation_key: "begin",
    });
    const created = await ok("hetu_create_novel_from_project", {
      management_ref: begin.management_ref,
      project_id: begin.project.project_id,
      expected: { revision: begin.revision, sha256: begin.sha256 },
      target_path: begin.target_path,
      metadata: {
        title: "雨港来信",
        author_name: "隔离验收作者",
        synopsis: "旧邮局来信",
        genre: "悬疑",
        language_tag: "zh-CN",
        status: "writing",
      },
      operation_key: "create",
    });
    const management = created.workspace_management_ref,
      work = {
        workspace_id: management.scope_ref.id,
        kind: "novel",
        object_id: created.novel.novel_id,
      };
    const pkg = await ok("hetu_plugins_inspect_package", {
      package_directory: packageDirectory,
    });
    const apply = async (action: string) =>
      ok("hetu_plugins_apply", {
        action,
        plugin_id: manifest.id,
        package_directory: packageDirectory,
        package_sha256: pkg.package_sha256,
        expected_sha256: (await ok("hetu_plugins_inspect")).state_sha256,
        authorization_note: "隔离验收固定包安装生命周期",
        operation_key: "installation-" + ++serial,
      });
    await apply("install");
    const binding = {
      management_ref: management,
      work_ref: work,
      plugin_id: manifest.id,
      package_sha256: pkg.package_sha256,
    };
    let cap = await ok("hetu_plugins_capabilities", binding);
    const actions = new Set<string>();
    const raw = async (action: string, args: any = {}) =>
      call("hetu_plugins_invoke", {
        ...binding,
        capabilities_sha256: cap.capabilities_sha256,
        action,
        arguments: args,
      });
    const invoke = async (action: string, args: any = {}) => {
      const outer = await raw(action, args);
      assert.equal(outer.status, "succeeded", JSON.stringify(outer));
      assert.equal(
        outer.data.result.status,
        "succeeded",
        JSON.stringify(outer.data.result),
      );
      actions.add(action);
      return outer.data.result.data;
    };
    const discover = async () => {
      cap = await ok("hetu_plugins_capabilities", binding);
      return cap;
    };
    const cli = (action: string, input: any) => {
      const r = spawnSync(
        path.join(bin, "hetu"),
        [
          "--client",
          "codex",
          "--collaboration-dir",
          env.HETU_COLLABORATION_DIR,
          "call",
          action,
          "--input",
          "-",
        ],
        {
          input: JSON.stringify(input),
          env,
          encoding: "utf8",
          timeout: 60000,
          maxBuffer: 4 * 1024 * 1024,
        },
      );
      assert.equal(r.status, 0, r.stderr || r.stdout);
      return JSON.parse(r.stdout);
    };
    await writeFile(
      path.join(directory, "machine-context.json"),
      JSON.stringify({
        binding,
        capabilities_sha256: cap.capabilities_sha256,
        workspace: begin.target_path,
      }),
      { mode: 0o600 },
    );
    return {
      coreVersion,
      directory,
      workspace: begin.target_path,
      created,
      management,
      work,
      pkg,
      binding,
      get cap() {
        return cap;
      },
      tools,
      client,
      env,
      call,
      ok,
      raw,
      invoke,
      apply,
      discover,
      actions,
      cli,
    };
  } catch (error) {
    await client.close();
    throw error;
  }
}
