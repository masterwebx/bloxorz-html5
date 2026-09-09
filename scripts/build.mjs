import { cpSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["src/extra/main.ts"],
  bundle: true,
  format: "iife",
  outfile: "src/extra.bundle.js",
  target: "es2020",
});

rmSync(path.join(root, "dist"), { recursive: true, force: true });
cpSync(path.join(root, "src"), path.join(root, "dist"), { recursive: true });
