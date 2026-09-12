import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { writeThemeTemplateZip } from "./themeTemplateZip.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["src/extra/main.ts"],
  bundle: true,
  format: "iife",
  outfile: "src/extra.bundle.js",
  target: "es2020",
  minify: true,
  legalComments: "none",
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
writeThemeTemplateZip(path.join(root, "dist", "themes", "_template.zip"));

// Prefer committed themes/*/atlas.png. Only re-pack when missing and puppeteer is available.
const missingAtlas = themeIds.filter((id) => !existsSync(path.join(root, "themes", id, "atlas.png")));
if (missingAtlas.length && !process.env.BLOX_SKIP_ATLAS_PACK) {
  try {
    const { spawnSync } = await import("node:child_process");
    const pack = spawnSync(process.execPath, [path.join(root, "scripts/pack-theme-atlases.mjs")], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
    if (pack.status !== 0) {
      console.warn("atlas pack failed; runtime will compose from slices for missing sheets");
    }
  } catch (err) {
    console.warn("atlas pack unavailable", err);
  }
}
for (const id of themeIds) {
  const src = path.join(root, "themes", id, "atlas.png");
  const dest = path.join(root, "dist", "themes", id, "atlas.png");
  if (existsSync(src)) {
    try {
      cpSync(src, dest);
    } catch {
      /* optional */
    }
  }
}
