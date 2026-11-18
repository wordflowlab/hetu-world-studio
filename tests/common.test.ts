import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryCore } from "./support/memory-core.ts";
import { scenario, original, sourceRef } from "./support/scenario.ts";
import {
  canonical,
  clone,
  newProject,
  validate,
  KIND,
} from "../src/domain/model.ts";
const expectOK = (r: any) => {
  assert.equal(r.status, "succeeded", JSON.stringify(r));
  return r.data;
};
const create = (p: any) => ({
  content: p,
  source_refs: [sourceRef],
  expected_revision: 0,
  expected_sha256: "",
  operation_key: "create",
});
function setup() {
  const c = memoryCore();
  c.sources.set(canonical(sourceRef), {
    source_ref: sourceRef,
    content: original,
  });
  return c;
}
const base = (r: any, key: string) => ({
  object_id: r.object.object_id,
  expected_revision: r.object.revision,
  expected_sha256: r.sha256,
  operation_key: key,
});
test("闭合Schema、重复ID、无效来源索引拒绝且原状态保留", async () => {
  const c = setup(),
    p = scenario();
  validate(p);
  const r = expectOK(await c.invoke("save_project", create(p)));
  const bad = clone(p);
  bad.unrecognized = true;
  assert.equal(
    (await c.invoke("save_project", { ...base(r, "bad"), content: bad }))
      .status,
    "failed",
  );
  assert.equal(c.writes, 1);
  const key = Object.keys(p).find(
    (k) => Array.isArray(p[k]) && p[k].length && p[k][0]?.id,
  )!;
  bad[key].push(clone(bad[key][0]));
  delete bad.unrecognized;
  assert.throws(() => validate(bad));
});
test("CAS冲突和同键异参不覆盖作者新修订", async () => {
  const c = setup(),
    p = scenario(),
    r = expectOK(await c.invoke("save_project", create(p)));
  const input = { ...base(r, "edit"), content: { ...p, title: "作者新修订" } };
  const next = expectOK(await c.invoke("save_project", input));
  assert.equal(
    expectOK(await c.invoke("save_project", input)).sha256,
    next.sha256,
  );
  assert.equal(
    (
      await c.invoke("save_project", {
        ...input,
        content: { ...p, title: "异参" },
      })
    ).error?.code,
    "idempotency_conflict",
  );
  assert.equal(
    (await c.invoke("save_project", { ...base(r, "stale"), content: p })).error
      ?.code,
    "revision_conflict",
  );
  assert.equal(
    expectOK(await c.invoke("get_project", { object_id: r.object.object_id }))
      .object.content.title,
    "作者新修订",
  );
});
test("写后响应丢失沿原键恢复，unknown不重写", async () => {
  const c = setup();
  c.failAfterWrite = true;
  const input = create(scenario());
  assert.equal((await c.invoke("save_project", input)).status, "failed");
  assert.equal(c.writes, 1);
  const restored = expectOK(await c.invoke("save_project", input));
  assert.equal(restored.object.revision, 1);
  assert.equal(c.writes, 1);
  c.unknown = true;
  assert.equal(
    (await c.invoke("save_project", { ...input, operation_key: "another" }))
      .status,
    "failed",
  );
  assert.equal(c.writes, 1);
});
test("旧修订可回读、来源只追加，历史比较不漂移", async () => {
  const c = setup(),
    p = scenario(),
    r = expectOK(await c.invoke("save_project", create(p)));
  const newer = expectOK(
    await c.invoke("save_project", {
      ...base(r, "next"),
      content: { ...p, title: "第二版" },
    }),
  );
  assert.equal(
    expectOK(
      await c.invoke("get_project", {
        object_id: r.object.object_id,
        revision: 1,
      }),
    ).sha256,
    r.sha256,
  );
  assert.deepEqual(
    expectOK(
      await c.invoke("compare_versions", {
        object_id: r.object.object_id,
        from_revision: 1,
        to_revision: 2,
      }),
    ).changes,
    ["title"],
  );
  assert.equal(
    (
      await c.invoke("save_project", {
        ...base(newer, "remove-source"),
        content: newer.object.content,
        source_refs: [],
      })
    ).status,
    "failed",
  );
});
test("完整中文报告分块UTF-8无损，偏移错误拒绝", async () => {
  const c = setup(),
    r = expectOK(await c.invoke("save_project", create(scenario())));
  let offset = 0,
    content = "",
    sha: string | undefined;
  do {
    const part = expectOK(
      await c.invoke("export_project", {
        object_id: r.object.object_id,
        revision: 1,
        format: "json",
        offset,
        max_bytes: 256,
      }),
    );
    content += part.content;
    sha ??= part.report_sha256;
    assert.equal(part.report_sha256, sha);
    if (part.next_offset === null) break;
    assert.ok(part.next_offset > offset);
    offset = part.next_offset;
  } while (offset < 1000000);
  assert.equal(JSON.parse(content).project.title, "雨港来信");
  const result = await c.invoke("export_project", {
    object_id: r.object.object_id,
    format: "json",
    offset: 1000000,
  });
  assert.equal(result.status, "failed");
});
test("上下文省略如实披露，固定交接不代表正文采纳", async () => {
  const c = setup(),
    r = expectOK(await c.invoke("save_project", create(scenario())));
  const context = expectOK(
    await c.invoke("build_context", {
      object_id: r.object.object_id,
      goal: "继续",
      max_chars: 256,
    }),
  );
  assert.equal(context.truncated, true);
  assert.ok(context.omitted_fields.length);
  const handoff = expectOK(
    await c.invoke("create_handoff", {
      object_id: r.object.object_id,
      goal: "接续",
    }),
  );
  assert.equal(handoff.basis_ref.sha256, r.sha256);
  assert.match(handoff.note, /另行决定/);
  assert.equal(c.writes, 1);
});

import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
test("最终后端包可在Node25权限与原型禁用下装载", () => {
  const module = pathToFileURL(path.resolve("dist/backend.mjs")).href;
  const r = spawnSync(
    process.execPath,
    [
      "--permission",
      "--max-old-space-size=128",
      "--allow-fs-read=" + path.resolve("dist"),
      "--no-addons",
      "--disable-proto=throw",
      "--input-type=module",
      "-e",
      "await import(" + JSON.stringify(module) + ")",
    ],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.equal(r.status, 0, r.stderr);
});


test("UTF-8预算不足明确拒绝，分块不会原地循环", async () => {
 const c=setup(),r=expectOK(await c.invoke("save_project",create(scenario())));
 const result=await c.invoke("get_source",{object_id:r.object.object_id,source_index:0,offset:0,max_bytes:1});
 assert.equal(result.status,"failed");
});
