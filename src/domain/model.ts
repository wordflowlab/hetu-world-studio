import manifest from "../../contracts/plugin-manifest.json" with { type: "json" };
import * as validators from "./validators.ts";
import {
  canonical,
  clone,
  requireValue as need,
} from "../../vendor/project-store.ts";
import { validateDomain } from "./professional.ts";
import { config } from "./config.ts";
const defaults = () => clone(config.defaults);
export { canonical, clone };
export const PLUGIN_ID = manifest.id,
  KIND = manifest.contributions.data[0].kind,
  WORK_KIND = "novel";
export const effects = new Set(
  manifest.contributions.actions
    .filter((a) => a.effect === "managed_write")
    .map((a) => a.id),
);
export function validateAction(action: string, input: unknown) {
  const f = (validators as any)[action];
  need(f, "未知专业动作。", "not_found");
  need(f(input), "动作参数不符合Schema：" + JSON.stringify(f.errors));
}
export function validate(p: any) {
  need(
    validators.project(p),
    "专业数据不符合Schema：" +
      JSON.stringify((validators.project as any).errors),
  );
  for (const [key, value] of Object.entries(p)) {
    if (
      Array.isArray(value) &&
      value.some((v) => v && typeof v === "object" && "id" in v)
    )
      need(
        new Set(value.map((v) => v.id)).size === value.length,
        "重复专业ID：" + key,
      );
  }
  need(
    new Set(p.basis_refs.map(canonical)).size === p.basis_refs.length,
    "专业依据重复。",
  );
  validateDomain(p);
}
export function newProject(title = "未命名方案"): any {
  return { format_version: 1, title, ...defaults(), basis_refs: [] };
}
export function sourceIndices(p: any): number[] {
  const out: number[] = [];
  function visit(v: any) {
    if (!v || typeof v !== "object") return;
    for (const [k, x] of Object.entries(v)) {
      if ((k === "source_index" || k.endsWith("_source_index")) && x !== null)
        out.push(x as number);

      else visit(x);
    }
  }
  visit(p);
  return out;
}
