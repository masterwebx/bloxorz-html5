import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

async function bundleExtra(): Promise<void> {
  const esbuild = await import("esbuild");
  await esbuild.build({
    absWorkingDir: rootDir,
    entryPoints: ["src/extra/main.ts"],
    bundle: true,
    format: "iife",
    outfile: "src/extra.bundle.js",
    target: "es2020",
    logLevel: "silent",
  });
}

function listThemeIds(): string[] {
  const dir = path.join(rootDir, "themes");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((row) => row.isDirectory() && !row.name.startsWith("_") && existsSync(path.join(dir, row.name, "theme.json")))
    .map((row) => row.name);
}

function listLocaleIds(): string[] {
  const dir = path.join(rootDir, "translations");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""));
}

function serveFolder(urlPrefix: string, diskDir: string): Plugin {
  return {
    name: `serve-${urlPrefix.slice(1)}`,
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url === `${urlPrefix}/index.json`) {
          const ids = urlPrefix === "/themes" ? listThemeIds() : listLocaleIds();
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(ids));
          return;
        }
        if (!url.startsWith(`${urlPrefix}/`)) {
          next();
          return;
        }
        const rel = decodeURIComponent(url.slice(urlPrefix.length + 1));
        if (rel.includes("..")) {
          next();
          return;
        }
        const file = path.join(rootDir, diskDir, rel);
        if (!existsSync(file)) {
          next();
          return;
        }
        const ext = path.extname(file);
        const types: Record<string, string> = {
          ".json": "application/json",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".jpg": "image/jpeg",
          ".mp4": "video/mp4",
          ".webm": "video/webm",
          ".mp3": "audio/mpeg",
          ".md": "text/markdown",
        };
        res.setHeader("Content-Type", types[ext] || "application/octet-stream");
        res.end(readFileSync(file));
      });
    },
  };
}

function extraBundlePlugin(): Plugin {
  return {
    name: "bloxorz-extra-bundle",
    async buildStart() {
      await bundleExtra();
    },
    configureServer(server) {
      void bundleExtra();
      server.watcher.add(path.join(rootDir, "src/extra"));
      server.watcher.on("change", (file) => {
        if (file.includes(`${path.sep}extra${path.sep}`) && file.endsWith(".ts")) {
          void bundleExtra();
        }
      });
    },
  };
}

export default defineConfig({
  root: "src",
  publicDir: false,
  plugins: [extraBundlePlugin(), serveFolder("/themes", "themes"), serveFolder("/translations", "translations")],
  server: {
    host: true,
    port: 4398,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4398,
    strictPort: true,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
