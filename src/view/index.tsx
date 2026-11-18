import {readArtifact} from "./artifact.ts";
import {ProfessionalView} from "./professional.tsx";
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import manifest from "../../contracts/plugin-manifest.json" with { type: "json" };
import { config } from "../domain/config.ts";
import { labels, names } from "./content.ts";
import type { PluginBridge } from "../../vendor/hetu-sdk.ts";
import "./style.css";
declare global {
  interface Window {
    hetu: PluginBridge;
  }
}
const api = window.hetu,
  slug = "world-studio",
  title = manifest.display["zh-CN"];
const skip = new Set([
  "id",
  "format_version",
  "basis_refs",
  "raw_json",
  "base64",
  "inline_wav",
  "sha256",
  "file_sha256",
  "audio_sha256",
  "target_sha256",
  "recheck_sha256",
  "story_sha256",
  "target_entity_ref",
  "local_entity_ref",
  "series_character_id",
  "host_link_id",
  "host_link_revision",
]);
function value(v: any): React.ReactNode {
  if (v === null || v === undefined)
    return <span className="muted">未指定</span>;
  if (typeof v === "boolean") return v ? "是" : "否";
  if (typeof v !== "object") return names[String(v)] ?? String(v);
  if (Array.isArray(v))
    return v.length ? (
      <ul>
        {v.map((x, k) => (
          <li key={k}>{value(x)}</li>
        ))}
      </ul>
    ) : (
      <span className="muted">暂无记录</span>
    );
  return (
    <dl>
      {Object.entries(v)
        .filter(
          ([k]) =>
            !skip.has(k) &&
            !k.endsWith("_id") &&
            !k.endsWith("_sha256") &&
            !k.endsWith("_source_index") &&
            k !== "source_index",
        )
        .map(([k, x]) => (
          <React.Fragment key={k}>
            <dt>
              {labels[k] ?? k}
            </dt>
            <dd>{value(x)}</dd>
          </React.Fragment>
        ))}
    </dl>
  );
}
function App() {
  const [list, setList] = useState<any[]>([]),
    [record, setRecord] = useState<any>(),
    [tab, setTab] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [goal, setGoal] = useState(""),
    [panel, setPanel] = useState<any>(),
    [editor, setEditor] = useState(""),
    [editing, setEditing] = useState(false),
    [pending, setPending] = useState<any>();
  const p = record?.object.content,
    selection = () => ({
      object_id: record.object.object_id,
      revision: record.object.revision,
    }),
    fixed = () => ({
      object_id: record.object.object_id,
      revision: record.object.revision,
      sha256: record.sha256,
    });
  async function invoke(action: string, input: any = {}) {
    const r: any = await api.invoke(action, input);
    if (r.status !== "succeeded")
      throw Object.assign(
        Error(r.error?.message ?? "结果未知，请沿原操作回读。"),
        { code: r.error?.code ?? "unknown" },
      );
    return r.data;
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string, revision?: number) {
    const r = await invoke("get_project", {
      object_id: id,
      ...(revision ? { revision } : {}),
    });
    setRecord(r);
    setPanel(undefined);
  }
  async function refresh() {
    let cursor: string | undefined;
    const rows: any[] = [];
    do {
      const r = await invoke("list_projects", {
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      rows.push(...r.objects);
      cursor = r.next_cursor ?? undefined;
    } while (cursor);
    setList(rows);
    return rows;
  }
  useEffect(() => {
    void run(async () => {
      const pref: any = await api.host?.("preferences", {});
      if (pref?.theme)
        document.documentElement.style.colorScheme =
          pref.theme === "system" ? "light dark" : pref.theme;
      api.onPreferences?.((v) => {
        document.documentElement.style.colorScheme =
          v.theme === "system" ? "light dark" : v.theme;
      });
      const buffer: any = await api.buffer();
      if (buffer?.editor) {
        setEditor(buffer.editor);
        setEditing(true);
      }
      if (buffer?.pending) setPending(buffer.pending);
      const rows = await refresh();
      if (buffer?.object_id || rows.length)
        await open(
          buffer?.object_id ?? rows[0].object_id,
          buffer?.baseline?.revision,
        );
    });
  }, []);
  useEffect(() => {
    if (editing || pending)
      void api.buffer({
        editor,
        editing,
        pending,
        object_id: record?.object.object_id,
        baseline: record
          ? { revision: record.object.revision, sha256: record.sha256 }
          : undefined,
      });
  }, [editor, editing, pending, record]);
  async function handoff() {
    await api.host?.("handoff", {
      goal:
        "使用" +
        title +
        "处理当前固定作品：" +
        (goal || "读取现有成果和依据，完善本页并接续下一轮创作。"),
      ...(record ? { object_ref: fixed() } : {}),
      ...{},
    });
    setStatus("已复制接续说明，可粘贴到当前Agent对话");
  }
  async function create() {
    const r = await invoke("save_project", {
      content: {
        format_version: 1,
        title: "未命名" + title,
        ...config.defaults,
        basis_refs: [],
      },
      source_refs: [],
      expected_revision: 0,
      expected_sha256: "",
      operation_key: crypto.randomUUID(),
    });
    setRecord(r);
    await refresh();
  }
  async function write(action: string, input: any) {
    const request = {
      ...input,
      object_id: record.object.object_id,
      expected_revision: record.object.revision,
      expected_sha256: record.sha256,
      operation_key: crypto.randomUUID(),
    };
    setPending({ action, input: request });
    await api.buffer({
      pending: { action, input: request },
      editor,
      editing,
      object_id: record.object.object_id,
      baseline: { revision: record.object.revision, sha256: record.sha256 },
    });
    let r: any;
    try {
      r = await invoke(action, request);
    } catch (e) {
      if ((e as any).code === "revision_conflict") {
        setPending(undefined);
        await api.buffer({
          editor,
          editing: true,
          object_id: record.object.object_id,
          baseline: { revision: record.object.revision, sha256: record.sha256 },
        });
      }
      throw e;
    }
    setRecord(r);
    setPending(undefined);
    setEditing(false);
    setEditor("");
    await api.buffer(null);
    await refresh();
    setStatus("已保存，固定修订可继续回读");
    return r;
  }
  async function recover() {
    const r = await invoke("get_operation", {
      operation_key: pending.input.operation_key,
    });
    setRecord(r);
    setPending(undefined);
    setEditing(false);
    setEditor("");
    await api.buffer(null);
    await refresh();
    setStatus("已回读原操作结果");
  }
  async function show(action: string, args: any = {}) {
    setPanel({
      title:
        manifest.contributions.actions.find((a) => a.id === action)?.title ??
        title,
      value: await invoke(action, { ...selection(), ...args }),
    });
  }
  async function download(action: string, args: any = {}) {
    const {bytes,record:last,sha}=await readArtifact(invoke,action,{...selection(),...args});
    let binary = "";
    for (let at = 0; at < bytes.length; at += 32768)
      binary += String.fromCharCode(...bytes.subarray(at, at + 32768));
    const saved: any = await api.host?.("save_artifact", {
      object_ref: fixed(),
      suggested_name: last.filename,
      media_type: last.media_type,
      base64: btoa(binary),
      sha256: sha,
    });
    if (!saved) throw Error("当前宿主未提供派生文件保存服务。");
    setStatus(
      saved.saved
        ? "文件已按固定修订导出" + ((last.losses?.length ?? 0) ? "。转换说明：" + last.losses.join("；") : "")
        : saved.cancelled
          ? "已取消导出"
          : "文件尚未保存",
    );
  }
  const count = Object.keys(config.fields).reduce(
    (n, k) =>
      n + (p?.[(config.fields as Record<string, string>)[k]]?.length ?? 0),
    0,
  );
  return (
    <div className="shell" aria-busy={busy}>
      <header>
        <button
          className="text"
          onClick={() => void api.host?.("close_view", {})}
        >
          返回作品
        </button>
        <h1>{title}</h1>
        <div className="actions">
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const rows = await refresh();
                if (!editing && !pending && (record || rows.length))
                  await open(record?.object.object_id ?? rows[0].object_id);
              })
            }
          >
            刷新
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void run(handoff)}
          >
            让AI处理
          </button>
        </div>
      </header>
      {error && (
        <div role="alert">
          {error}
          {pending && (
            <button onClick={() => void run(recover)}>回读原操作</button>
          )}
        </div>
      )}
      {(status||busy) && <p role="status">{status||"正在整理成果，请稍候"}</p>}
      <div className="goal">
        <input
          aria-label="本次目标"
          placeholder="说出本次希望推进的内容"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
      </div>
      {!record ? (
        <main className="empty">
          <h2>从作品出发</h2>
          <p>让AI读取固定作品，准备{nameOrTitle()}成果。</p>
          <button onClick={() => void run(create)}>创建专业方案</button>
        </main>
      ) : (
        <>
          <div className="projectbar">
            <select
              aria-label="专业方案"
              disabled={editing || !!pending}
              value={record.object.object_id}
              onChange={(e) => void run(() => open(e.target.value))}
            >
              {list.map((r) => (
                <option key={r.object_id} value={r.object_id}>
                  {r.title}
                </option>
              ))}
            </select>
            <span className="muted">修订 {record.object.revision}</span>
            <button
              className="text"
              disabled={editing || !!pending}
              onClick={() => void run(create)}
            >
              新方案
            </button>
            <button
              className="text"
              onClick={() =>
                void run(async () => {
                  const exported: any = await api.host?.("export_file", {
                    action: "export_project",
                    input: { ...selection(), format: "html" },
                    suggested_name: p.title + ".html",
                  });
                  if (!exported) throw Error("当前宿主未提供报告导出服务。");
                  setStatus(
                    exported.saved
                      ? "固定报告已导出"
                      : exported.cancelled
                        ? "已取消导出"
                        : "报告尚未保存",
                  );
                })
              }
            >
              导出报告
            </button>
            <details>
              <summary>高级</summary>
              <button
                disabled={!!pending}
                onClick={() => {
                  setEditor(JSON.stringify(p, null, 2));
                  setEditing(true);
                }}
              >
                编辑专业数据
              </button>
              <p className="muted">修订和摘要用于核对固定成果</p>
              <code>
                {record.object.object_id}
                <br />
                {record.sha256}
              </code>
            </details>
          </div>
          <nav aria-label="专业视图">
            {config.tabs.map((name, index) => (
              <button
                key={name}
                aria-current={tab === index ? "page" : undefined}
                onClick={() => {
                  setTab(index);
                  setPanel(undefined);
                }}
              >
                {name}
              </button>
            ))}
          </nav>
          <main>
            <h2>{p.title}</h2>
            {!count && (
              <p className="muted">尚无专业记录，可让AI根据本次目标准备。</p>
            )}
            <ProfessionalView p={p} tab={tab} invoke={invoke} run={run} show={show} download={download} write={write} selection={selection} />
            {tab===config.tabs.length-1&&<section><h3>围绕固定成果继续</h3><p>先读取本次成果与依据，再准备下一环节。正文采纳与定稿独立决定。</p><div className="actions"><button onClick={()=>void run(()=>show("build_context",{goal:goal||"按当前成果接续创作",max_chars:12000}))}>查看接续材料</button><button onClick={()=>void run(handoff)}>复制AI接续说明</button></div></section>}
          </main>
        </>
      )}
      {editing && (
        <section className="editor" aria-label="高级编辑">
          <h2>编辑专业数据</h2>
          <textarea
            aria-label="专业数据"
            spellCheck
            value={editor}
            onChange={(e) => setEditor(e.target.value)}
          />
          <div className="actions">
            <button
              className="primary"
              disabled={busy || !!pending}
              onClick={() =>
                void run(async () => {
                  await write("save_project", { content: JSON.parse(editor) });
                })
              }
            >
              保存修改
            </button>
            <button
              disabled={busy || !!pending}
              onClick={() =>
                void run(async () => {
                  const latest = await invoke("get_project", {
                    object_id: record.object.object_id,
                  });
                  const draft = JSON.parse(editor),
                    old = record.object.content;
                  const merged = { ...latest.object.content };
                  for (const k of Object.keys(draft))
                    if (JSON.stringify(draft[k]) !== JSON.stringify(old[k]))
                      merged[k] = draft[k];
                  setEditor(JSON.stringify(merged, null, 2));
                  setRecord(latest);
                  setPanel({
                    title: "新版与当前编辑",
                    value: {
                      note: "已合并新版中未被本次编辑的字段。双方修改同一字段时保留本次编辑，请核对后保存。",
                      content: latest.object.content,
                    },
                  });
                  setStatus("已读取最新基线，编辑内容保留；请核对差异后保存");
                })
              }
            >
              读取最新基线
            </button>
            <button
              disabled={!!pending}
              onClick={() =>
                void run(async () => {
                  setEditing(false);
                  setEditor("");
                  await api.buffer(null);
                })
              }
            >
              取消编辑
            </button>
            {pending && (
              <button onClick={() => void run(recover)}>回读原操作</button>
            )}
          </div>
          <p className="muted">
            冲突时保留当前编辑；回读或明确处理基线后再继续。
          </p>
        </section>
      )}
      {panel && (
        <aside aria-label="固定依据">
          <div className="actions">
            <h2>{panel.title}</h2>
            <button onClick={() => setPanel(undefined)}>关闭依据</button>
          </div>
          <div className="readable">{value(panel.value)}</div>
        </aside>
      )}
    </div>
  );
  function nameOrTitle() {
    return title;
  }
}
createRoot(document.getElementById("root")!).render(<App />);
