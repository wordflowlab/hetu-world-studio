export const escapeHTML = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function htmlPage(title: string, body: string) {
  return (
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    escapeHTML(title) +
    "</title><style>body{max-width:860px;margin:40px auto;padding:0 24px;font:18px/1.9 system-ui;color:#202522;background:#faf9f6}h1{font-size:28px}h2{font-size:22px}section{break-before:page;margin:40px 0}img{max-width:100%;height:auto}pre{white-space:pre-wrap}table{width:100%;border-collapse:collapse}td,th{border-bottom:.5px solid #bbb;padding:12px;text-align:left;vertical-align:top}button{font:inherit;margin:8px;padding:8px 16px}a{color:#246b52}@media print{nav,button{display:none}}</style><body>" +
    body +
    "</body></html>"
  );
}
