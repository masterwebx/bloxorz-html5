import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
cpSync(path.join(root, "themes"), path.join(root, "dist", "themes"), { recursive: true });
cpSync(path.join(root, "translations"), path.join(root, "dist", "translations"), { recursive: true });
mkdirSync(path.join(root, "dist", "themes"), { recursive: true });
const themeIds = readdirSync(path.join(root, "themes"), { withFileTypes: true })
  .filter((row) => row.isDirectory() && !row.name.startsWith("_"))
  .map((row) => row.name);
const localeIds = readdirSync(path.join(root, "translations"))
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.replace(/\.json$/, ""));
writeFileSync(path.join(root, "dist", "themes", "index.json"), JSON.stringify(themeIds));
writeFileSync(path.join(root, "dist", "translations", "index.json"), JSON.stringify(localeIds));
