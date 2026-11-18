import { readFile, writeFile } from "node:fs/promises";
import { Ajv } from "ajv";
import standalone from "ajv/dist/standalone/index.js";
const manifest = JSON.parse(
  await readFile("contracts/plugin-manifest.json", "utf8"),
);
const ajv = new Ajv({
  allErrors: true,
  strict: false,
  code: { source: true, esm: true },
});
const names = { project: "project" };
ajv.addSchema(manifest.contributions.data[0].schema, "project");
for (const a of manifest.contributions.actions) {
  ajv.addSchema(a.input_schema, a.id);
  names[a.id] = a.id;
}
let code = standalone(ajv, names);
let runtime = 0;
code = code.replace(
  /const (\w+) = require\("([^"]+)"\)\.default;/g,
  (_all, name, module) => {
    const id = "__runtime" + runtime++;
    return (
      "import * as " +
      id +
      " from " +
      JSON.stringify(module + ".js") +
      ";const " +
      name +
      " = " +
      id +
      ".default.default ?? " +
      id +
      ".default;"
    );
  },
);
await writeFile(
  "src/domain/validators.ts",
  "// @ts-nocheck\n// 构建生成：Schema在构建期编译，运行界面不使用eval或Function。\n" +
    code +
    "\n",
);
