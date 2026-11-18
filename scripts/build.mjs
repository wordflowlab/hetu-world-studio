await import("./generate-validators.mjs");
import { build } from "esbuild";
import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  cp,
  readdir,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const manifest = JSON.parse(
  await readFile("contracts/plugin-manifest.json", "utf8"),
);
const {default:AjvManifest}=await import("ajv");
const manifestSchema=JSON.parse(await readFile("vendor/plugin-manifest.schema.json","utf8"));
const manifestCheck=new AjvManifest({strict:false}).compile(manifestSchema);
if(!manifestCheck(manifest))throw Error("宿主清单Schema不符："+JSON.stringify(manifestCheck.errors));
const sources = JSON.parse(await readFile("vendor/sources.json", "utf8"));
for (const f of sources.files)
  if (
    createHash("sha256")
      .update(await readFile("vendor/" + f.file))
      .digest("hex") !== f.sha256
  )
    throw Error("SDK快照不符：" + f.file);
const rows = [
  "# 操作地图",
  "",
  "由正式清单生成，执行前发现当前安装版Schema。",
  "",
  "| 动作 | 用途 | 必填参数 | 效果 |",
  "| --- | --- | --- | --- |",
];
for (const a of manifest.contributions.actions)
  rows.push(
    `| ${a.id} | ${a.title} | ${a.input_schema.required.join(", ")} | ${a.effect} |`,
  );
await writeFile(
  "skills/" +
    manifest.contributions.skills[0].name +
    "/references/operations.md",
  rows.join("\n") + "\n",
);
await writeFile(
  "CAPABILITIES.md",
  "# " +
    manifest.display["zh-CN"] +
    "功能清单\n\n本包拥有专业能力；宿主拥有正文、来源与作者决定。\n\n" +
    rows.slice(4).join("\n") +
    "\n\n默认流程、边界及验收见 [docs](docs/README.md)。\n",
);
await mkdir("dist/licenses", { recursive: true });
const common = { bundle: true, metafile: true, minify: true, preserveSymlinks: true };
const view = await build({
  ...common,
  entryPoints: ["src/view/index.tsx"],
  outfile: "dist/view.js",
  platform: "browser",
  format: "iife",
  target: "chrome140",
  jsx: "automatic",
});
const backend = await build({
  ...common,
  entryPoints: ["src/backend.ts"],
  outfile: "dist/backend.mjs",
  platform: "node",
  format: "esm",
  target: "node25",
  banner: {
    js: 'import {createRequire as __hetuCreateRequire} from "node:module";const require=__hetuCreateRequire(import.meta.url);',
  },
});
await writeFile("dist/plugin.json", JSON.stringify(manifest) + "\n");
await writeFile(
  "dist/index.html",
  '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    manifest.display["zh-CN"] +
    '</title><link rel="stylesheet" href="view.css"><div id="root"></div><script src="view.js"></script></html>',
);
for (const f of ["LICENSE", "CAPABILITIES.md"]) await copyFile(f, "dist/" + f);
await cp("skills", "dist/skills", { recursive: true });
for (const [f, to] of [
  ["hetu-LICENSE", "hetu.txt"],
  ["radix-colors-MIT.txt", "radix-colors-MIT.txt"],
  ["sources.json", "hetu-sources.json"],
])
  await copyFile("vendor/" + f, "dist/licenses/" + to);
const packages = new Map();
for (const input of Object.keys({
  ...view.metafile.inputs,
  ...backend.metafile.inputs,
})) {
  if (!input.startsWith("node_modules/")) continue;
  let dir = path.dirname(input);
  while (dir !== ".") {
    try {
      const pkg = JSON.parse(
        await readFile(path.join(dir, "package.json"), "utf8"),
      );
      if (pkg.name) {
        packages.set(pkg.name, { dir, pkg });
        break;
      }
    } catch {}
    dir = path.dirname(dir);
  }
}
let notices = "# 第三方许可\n\n";
for (const [name, { dir, pkg }] of [...packages].sort()) {
  const files = (await readdir(dir)).filter((f) =>
    /^(licen[cs]e|copying|notice)(\.|$)/i.test(f),
  );
  if (!files.length) throw Error("缺少许可：" + name);
  const dest = name.replaceAll("/", "_").replaceAll("@", "") + ".txt";
  await writeFile(
    "dist/licenses/" + dest,
    (
      await Promise.all(
        files.sort().map((f) => readFile(path.join(dir, f), "utf8")),
      )
    ).join("\n\n"),
  );
  notices += `- ${name}@${pkg.version} (${pkg.license}): licenses/${dest}\n`;
}
await writeFile("dist/THIRD_PARTY_NOTICES.md", notices);
