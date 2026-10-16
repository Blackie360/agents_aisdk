import { build } from "esbuild";
import { globSync } from "node:fs";
import { spawnSync } from "node:child_process";
// Bundle our TS only; native Node loads the ESM/CJS parser dependencies without tsx hooks.
await build({
  entryPoints: globSync("tests/*.test.ts"),
  outdir: ".test-build",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
});
const result = spawnSync(
  process.execPath,
  ["--test", ...globSync(".test-build/*.js")],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
