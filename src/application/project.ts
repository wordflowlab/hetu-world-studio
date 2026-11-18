import { createHash } from "node:crypto";
import type { BackendContext, ObjectResult } from "../../vendor/hetu-sdk.ts";
import {
  ProjectStore,
  failure,
  success,
  fixed,
  requireValue as need,
} from "../../vendor/project-store.ts";
import {
  canonical,
  clone,
  effects,
  KIND,
  PLUGIN_ID,
  sourceIndices,
  validate,
  validateAction,
} from "../domain/model.ts";
import { checkSources, readProfessional, validateTransition } from "../domain/professional.ts";
import { config } from "../domain/config.ts";
import { pureAction, writeProfessional } from "../domain/professional.ts";
import { span, sourceText } from "../domain/text.ts";
import { reportMarkdown, reportHTML } from "../domain/report.ts";
const hash = (v: string | Uint8Array) =>
  createHash("sha256").update(v).digest("hex");
function contextContent(p: any) {
  return JSON.parse(
    JSON.stringify(p, (key, value) =>
      ["base64", "inline_wav", "raw_json"].includes(key) ? undefined : value,
    ),
  );
}
export class Project {
  readonly store: ProjectStore;
  readonly context: BackendContext;
  constructor(context: BackendContext) {
    this.context = context;
    this.store = new ProjectStore(context, PLUGIN_ID, KIND, validate);
  }
  async sources(refs: any[]) {
    const sources = await this.store.sources(refs);
    need(
      Buffer.byteLength(canonical(sources)) <= 2 * 1024 * 1024,
      "读取来源超过2MiB，请按固定章节拆分方案。",
      "hetu.budget_exceeded",
    );
    return sources;
  }
  async check(p: any, refs: any[]) {
    validate(p);
    need(
      sourceIndices(p).every(
        (i) => Number.isInteger(i) && i >= 0 && i < refs.length,
      ),
      "固定来源索引越界。",
    );
    const sources = await this.sources(refs);
    function visit(v: any) {
      if (!v || typeof v !== "object") return;
      if ("quote" in v)
        need(
          span(
            sourceText(sources[v.source_index]),
            v.byte_start,
            v.byte_end,
          ) === v.quote,
          "证据引文与固定来源不一致。",
        );
      for (const x of Object.values(v)) visit(x);
    }
    visit(p);
    for (const basis of p.basis_refs) await this.store.basis(basis);
    await checkSources(p, sources, (name: string, input: any) =>
      this.store.call(name, input),
    );
  }
  async save(input: any, p: any, old?: ObjectResult) {
    if(old)validateTransition(p,old.object.content);
    await this.check(p, input.source_refs ?? old?.object.source_refs ?? []);
    return this.store.save(input, p, old);
  }
  async invoke(action: string, raw: unknown) {
    try {
      validateAction(action, raw);
      const i: any = clone(raw);
      if (effects.has(action)) {
        const r = await this.store.recover(i.operation_key);
        if (r) return r;
      }
      if (action === "get_operation")
        return this.store.call("hetu.extensions.operations.get", {operation_key:i.operation_key});
      if (action === "list_projects")
        return this.store.call(
          i.query
            ? "hetu.extensions.objects.search"
            : "hetu.extensions.objects.list",
          { ...i, kind: KIND },
        );
      if (action === "save_project") {
        need(
          i.object_id
            ? i.expected_revision > 0 &&
                /^[a-f0-9]{64}$/.test(i.expected_sha256)
            : i.expected_revision === 0 && i.expected_sha256 === "",
          "新建或更新基线无效。",
        );
        return await this.save(
          i,
          i.content,
          i.object_id ? await this.store.baseline(i) : undefined,
        );
      }
      if (action === "compare_versions") {
        const a = await this.store.get(i.object_id, i.from_revision),
          b = await this.store.get(i.object_id, i.to_revision);
        return success({
          from_ref: fixed(a),
          to_ref: fixed(b),
          changes: Object.keys(b.object.content as any).filter(
            (k) =>
              canonical((a.object.content as any)[k]) !==
              canonical((b.object.content as any)[k]),
          ),
        });
      }
      if (!(raw as any).object_id) {
        const value = await pureAction(action, i);
        need(value !== undefined, "未实现的专业动作。", "not_found");
        return success(value);
      }
      const r = effects.has(action)
          ? await this.store.baseline(i)
          : await this.store.get(i.object_id, i.revision),
        p: any = clone(r.object.content),
        refs = r.object.source_refs ?? [];
      if (effects.has(action)) {
        if (!action.startsWith("put_") && !action.startsWith("remove_")) {
          await writeProfessional(action, p, await this.sources(refs), i, (a: string, v: any) => this.store.call(a, v));
          return await this.save(i, p, r);
        }
        const verb = action.startsWith("put_") ? "put" : "remove",
          item = action.slice(verb.length + 1),
          field = (config.fields as Record<string, string>)[item];
        need(field, "未知专业写动作。");
        const id = verb === "put" ? i[item].id : i[item + "_id"],
          at = p[field].findIndex((v: any) => v.id === id);
        if (verb === "put") {
          if (at < 0) p[field].push(i[item]);
          else p[field][at] = i[item];
        } else {
          need(at >= 0, "记录不存在。");
          p[field].splice(at, 1);
        }
        return await this.save(i, p, r);
      }
      if (action === "get_project") return success(r);
      if (action === "get_source") {
        need(refs[i.source_index], "来源索引越界。");
        const source:any=clone((await this.sources([refs[i.source_index]]))[0]);
        let complete=true,next_offset:number|null=null,total_bytes:number|undefined;
        if(typeof source.content==="string"||typeof source.resource?.body==="string"){
          const full=sourceText(source),bytes=Buffer.from(full),offset=i.offset??0;
          need(offset<=bytes.length&&(offset===bytes.length||(bytes[offset]&0xc0)!==0x80),"来源偏移不是UTF-8边界。");
          let end=Math.min(bytes.length,offset+(i.max_bytes??8192));while(end<bytes.length&&(bytes[end]&0xc0)===0x80)end--;
          need(end>offset||offset===bytes.length,"分块预算不足以容纳下一个UTF-8字符。","hetu.budget_exceeded");
          const text=bytes.subarray(offset,end).toString("utf8");
          if(typeof source.content==="string")source.content=text;else source.resource.body=text;
          total_bytes=bytes.length;complete=end===bytes.length;next_offset=complete?null:end;
        }
        return success({project_ref:fixed(r),source_ref:refs[i.source_index],source,complete,next_offset,...(total_bytes===undefined?{}:{total_bytes,offset:i.offset??0})});
      }
      if (action === "get_basis") {
        need(p.basis_refs[i.basis_index], "专业依据索引越界。");
        return success({
          project_ref: fixed(r),
          basis_ref: p.basis_refs[i.basis_index],
          basis: await this.store.basis(p.basis_refs[i.basis_index]),
        });
      }
      if (action === "export_project") {
        const report = {
            format: "hetu." + KIND,
            version: 1,
            project_ref: fixed(r),
            work_ref: this.context.work_ref,
            source_refs: refs,
            project: p,
          },
          markdown = reportMarkdown(report);
        const content =
            i.format === "json"
              ? JSON.stringify(report, null, 2)
              : i.format === "html"
                ? reportHTML(report)
                : markdown,
          b = Buffer.from(content),
          offset = i.offset ?? 0;
        const boundary = (n: number) =>
          n === b.length || (n >= 0 && n < b.length && (b[n] & 0xc0) !== 0x80);
        need(boundary(offset), "导出偏移不是UTF-8边界。");
        let end = Math.min(b.length, offset + (i.max_bytes ?? 8192));
        while (!boundary(end)) end--;
        need(end > offset || offset === b.length, "分块预算不足以容纳下一个UTF-8字符。", "hetu.budget_exceeded");
        const chunk = b.subarray(offset, end).toString("utf8");
        return success({
          project_ref: fixed(r),
          format: i.format,
          content: chunk,
          offset,
          next_offset: end === b.length ? null : end,
          total_bytes: b.length,
          media_type: (
            {
              json: "application/json",
              markdown: "text/markdown",
              html: "text/html",
            } as Record<string, string>
          )[i.format],
          report_sha256: hash(content),
          content_sha256: hash(chunk),
          chunk_sha256: hash(chunk),
        });
      }
      if (action === "create_handoff")
        return success({
          plugin_id: PLUGIN_ID,
          work_ref: this.context.work_ref,
          object_ref: fixed(r),
          basis_ref: { owner_plugin_id: PLUGIN_ID, ...fixed(r) },
          source_refs: refs,
          basis_refs: p.basis_refs,
          goal: i.goal,
          content: contextContent(p),
          omitted_embedded_fields: ["base64", "inline_wav", "raw_json"],
          note: "读取固定专业成果后准备宿主规划或候选；正文采纳、正式设定和定稿另行决定。",
        });
      if (action === "build_context") {
        const units = Object.entries(contextContent(p)),
          included: any = {},
          omitted: string[] = [];
        let used = [...i.goal].length;
        need(
          used <= i.max_chars,
          "目标本身超过上下文预算。",
          "hetu.budget_exceeded",
        );
        for (const [k, v] of units) {
          const cost = [...canonical({ [k]: v })].length;
          if (used + cost <= i.max_chars) {
            included[k] = v;
            used += cost;
          } else omitted.push(k);
        }
        return success({
          project_ref: fixed(r),
          source_refs: refs,
          basis_refs: p.basis_refs,
          goal: i.goal,
          content: included,
          omitted_fields: omitted,
          omitted_embedded_fields: ["base64", "inline_wav", "raw_json"],
          used_chars: used,
          max_chars: i.max_chars,
          truncated: omitted.length > 0,
          note: "字符预算不等于模型token或费用；省略字段可沿固定对象单独回读。",
        });
      }
      const value = await readProfessional(
        action,
        p,
        await this.sources(refs),
        i,
        (name: string, input: any) => this.store.call(name, input),
      );
      need(value !== undefined, "未实现的专业动作。", "not_found");
      return success({ project_ref: fixed(r), ...value });
    } catch (e) {
      return failure(e);
    }
  }
}
