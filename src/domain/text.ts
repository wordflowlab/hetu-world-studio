import { requireValue as need } from "../../vendor/project-store.ts";
export function span(text: string, start: number, end: number) {
  const b = new TextEncoder().encode(text);
  const boundary = (i: number) =>
    i === b.length || (i >= 0 && i < b.length && (b[i] & 0xc0) !== 0x80);
  need(
    Number.isSafeInteger(start) &&
      Number.isSafeInteger(end) &&
      start >= 0 &&
      start <= end &&
      boundary(start) &&
      boundary(end),
    "选区越界或不是UTF-8边界。",
  );
  return new TextDecoder().decode(b.subarray(start, end));
}
export function sourceText(source: any): string {
  const text =
    typeof source?.content === "string"
      ? source.content
      : source?.resource?.body;
  need(typeof text === "string", "该来源不是可读取的文稿或文字资料。");
  return text;
}
export function uniqueIds(values: string[], message: string) {
  need(new Set(values).size === values.length, message);
}
