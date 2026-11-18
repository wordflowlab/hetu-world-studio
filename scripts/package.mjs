import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
const manifest = JSON.parse(await readFile("dist/plugin.json", "utf8"));
const output = path.resolve(
  "output",
  manifest.id + "-" + manifest.version + ".tgz",
);
await mkdir("output", { recursive: true });
const result = spawnSync(
  "tar",
  ["-czf", output, "-C", "dist", ...(await readdir("dist"))],
  { encoding: "utf8", env: { ...process.env, COPYFILE_DISABLE: "1" } },
);
if (result.status !== 0) throw new Error(result.stderr);
const sha256 = createHash("sha256")
  .update(await readFile(output))
  .digest("hex");
await writeFile(
  output + ".sha256",
  sha256 + "  " + path.basename(output) + "\n",
);
console.log(JSON.stringify({ archive: output, sha256 }));
