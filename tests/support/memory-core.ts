import { createHash, randomUUID } from "node:crypto";
import { Project } from "../../src/application/project.ts";
import {
  canonical,
  clone,
  effects,
  PLUGIN_ID,
  WORK_KIND,
} from "../../src/domain/model.ts";
import {
  failure,
  success as ok,
  ProjectError,
} from "../../vendor/project-store.ts";
const fail = (code: string) => failure(new ProjectError(code, code));
export const hash = (v: any) =>
  createHash("sha256").update(canonical(v)).digest("hex");
export function memoryCore() {
  const records = new Map<string, any[]>(),
    operations = new Map<string, any>(),
    sources = new Map<string, any>(),
    episodes = new Map<string, any>();
  let writes = 0,
    currentInvocation: string | undefined,
    unknown = false,
    failAfterWrite = false;
  const request = async (action: string, input: any): Promise<any> => {
    if (action.endsWith("operations.get")) {
      if (unknown) return fail("unknown");
      const op = operations.get(input.operation_key);
      return op
        ? currentInvocation && currentInvocation !== op.invocation
          ? fail("idempotency_conflict")
          : clone(op.result)
        : fail("not_found");
    }
    if (action.endsWith("sources.inspect"))
      return sources.has(canonical(input.source_ref))
        ? ok(clone(sources.get(canonical(input.source_ref))))
        : fail("not_found");
    if (
      action === "hetu.drama.episodes.get" ||
      action === "hetu.video.episodes.get"
    )
      return episodes.has(input.episode_id ?? input.video_episode_id)
        ? ok(clone(episodes.get(input.episode_id ?? input.video_episode_id)))
        : fail("not_found");
    if (action.endsWith("objects.get")) {
      const history = records.get(input.object_id);
      const candidate = input.revision
        ? history?.[input.revision - 1]
        : history?.at(-1);
      const r =
        candidate?.object.owner_plugin_id ===
        (input.owner_plugin_id ?? PLUGIN_ID)
          ? candidate
          : undefined;
      return r ? ok(clone(r)) : fail("not_found");
    }
    if (action.endsWith("objects.save")) {
      const op = operations.get(input.operation_key);
      if (op)
        return op.invocation === currentInvocation
          ? clone(op.result)
          : fail("idempotency_conflict");
      const history = records.get(input.object_id);
      if (
        input.object_id &&
        (!history ||
          history.at(-1).object.revision !== input.expected_revision ||
          history.at(-1).sha256 !== input.expected_sha256)
      )
        return fail("revision_conflict");
      const id = input.object_id ?? "ext_" + randomUUID(),
        object = {
          ...input,
          object_id: id,
          work_ref: work,
          owner_plugin_id: PLUGIN_ID,
          revision: (history?.length ?? 0) + 1,
        };
      const r = { object, sha256: hash(object) },
        result = ok(r);
      records.set(id, [...(history ?? []), clone(r)]);
      operations.set(input.operation_key, {
        invocation: currentInvocation,
        result: clone(result),
      });
      writes++;
      if (failAfterWrite) {
        failAfterWrite = false;
        throw new Error("transport_lost_after_commit");
      }
      return result;
    }
    if (action.endsWith("objects.list") || action.endsWith("objects.search")) {
      const all = [...records.values()]
        .map((x) => x.at(-1))
        .filter(
          (r) =>
            r.object.kind === input.kind &&
            (!input.query || r.object.title.includes(input.query)),
        );
      return ok({
        objects: all.map((r) => ({ ...r.object, sha256: r.sha256 })),
        next_cursor: null,
      });
    }
    return fail("forbidden");
  };
  const work = {
    workspace_id: "workspace_test",
    kind: WORK_KIND as "novel",
    object_id: WORK_KIND + "_test",
  };
  const app = new Project({
    work_ref: work,
    request: request as any,
    effect: () => {},
  });
  const invoke = async (action: string, input: any) => {
    currentInvocation = effects.has(action)
      ? hash({ action, input })
      : undefined;
    try {
      return await app.invoke(action, input);
    } finally {
      currentInvocation = undefined;
    }
  };
  return {
    app,
    invoke,
    records,
    operations,
    sources,
    episodes,
    work,
    set unknown(v: boolean) {
      unknown = v;
    },
    set failAfterWrite(v: boolean) {
      failAfterWrite = v;
    },
    get writes() {
      return writes;
    },
  };
}
