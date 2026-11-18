import { createHash } from "node:crypto";
import { requireValue as need } from "../../vendor/project-store.ts";
export const hash = (data: string | Uint8Array) =>
  createHash("sha256").update(data).digest("hex");
export { escapeHTML, htmlPage } from "./presentation.ts";
export function decode64(value: string, limit = 1024 * 1024) {
  need(
    value.length % 4 === 0 &&
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        value,
      ),
    "Base64格式无效。",
  );
  const b = Buffer.from(value, "base64");
  need(b.length <= limit, "文件超过处理预算。", "hetu.budget_exceeded");
  need(b.toString("base64") === value, "Base64不是规范编码。");
  return b;
}
export function fileBytes(file: any, limit = 1024 * 1024) {
  const b = decode64(file.base64, limit);
  need(hash(b) === file.sha256, "原文件摘要不一致。", "hetu.stale_evidence");
  return b;
}
export function artifact(
  bytes: string | Uint8Array,
  filename: string,
  media_type: string,
  i: any = {},
) {
  const b = Buffer.from(bytes),
    offset = i.offset ?? 0,
    max = i.max_bytes ?? 8192;
  need(
    Number.isSafeInteger(offset) && offset >= 0 && offset <= b.length,
    "文件偏移越界。",
  );
  const end = Math.min(b.length, offset + max),
    chunk = b.subarray(offset, end);
  return {
    filename,
    media_type,
    encoding: "base64",
    base64: chunk.toString("base64"),
    offset,
    next_offset: end === b.length ? null : end,
    total_bytes: b.length,
    sha256: hash(b),
    chunk_sha256: hash(chunk),
  };
}
