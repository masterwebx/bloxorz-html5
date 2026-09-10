import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const RAW_JS = new Set([
  "/extra.bundle.js",
  "/bloxorz.js",
  "/levels.js",
  "/timer.js",
  "/feedback.js",
  "/version.js",
  "/sw.js",
]);

const MIME: Record<string, string> = {
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".md": "text/markdown",
  ".css": "text/css",
  ".zip": "application/zip",
};

async function bundleExtra(): Promise<void> {
  const esbuild = await import("esbuild");
  await esbuild.build({
    absWorkingDir: rootDir,
    entryPoints: ["src/extra/main.ts"],
    bundle: true,
    format: "iife",
    outfile: "src/extra.bundle.js",
    target: "es2020",
    minify: true,
    legalComments: "none",
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

function sendFile(res: ServerResponse, file: string, type: string): void {
  const st = statSync(file);
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Length", String(st.size));
  createReadStream(file).pipe(res);
}

function safeJoin(base: string, rel: string): string | null {
  if (!rel || rel.includes("\0") || rel.includes("..")) return null;
  const file = path.join(base, rel);
  if (!file.startsWith(base)) return null;
  return file;
}

function serveDisk(req: IncomingMessage, res: ServerResponse, next: () => void, urlPrefix: string, diskDir: string): void {
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
  const file = safeJoin(path.join(rootDir, diskDir), rel);
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    next();
    return;
  }
  sendFile(res, file, MIME[path.extname(file)] || "application/octet-stream");
}

function rawGameAssetsPlugin(): Plugin {
  return {
    name: "bloxorz-raw-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        const raw =
          RAW_JS.has(url) ||
          url.startsWith("/code.createjs.com/") ||
          url.startsWith("/code.jquery.com/") ||
          url.startsWith("/components/");
        if (!raw) {
          next();
          return;
        }
        const file = safeJoin(path.join(rootDir, "src"), decodeURIComponent(url.slice(1)));
        if (!file || !existsSync(file) || statSync(file).isDirectory()) {
          next();
          return;
        }
        sendFile(res, file, MIME[path.extname(file)] || "application/javascript");
      });
    },
  };
}

function serveFolder(urlPrefix: string, diskDir: string): Plugin {
  return {
    name: `serve-${urlPrefix.slice(1)}`,
    configureServer(server) {
      server.middlewares.use((req, res, next) => serveDisk(req, res, next, urlPrefix, diskDir));
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
      const rebuild = () =>
        bundleExtra().catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[extra.bundle]", msg);
        });
      void rebuild();
      server.watcher.add(path.join(rootDir, "src/extra"));
      server.watcher.on("change", (file) => {
        if (file.includes(`${path.sep}extra${path.sep}`) && file.endsWith(".ts")) {
          void rebuild();
        }
      });
    },
  };
}

function themeTemplateZipPlugin(): Plugin {
  let cached: Uint8Array | null = null;
  const load = async (): Promise<Uint8Array> => {
    if (cached) return cached;
    const mod = (await import("./scripts/themeTemplateZip.mjs")) as { buildThemeTemplateZip: () => Uint8Array };
    cached = mod.buildThemeTemplateZip();
    return cached;
  };
  return {
    name: "bloxorz-theme-template-zip",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url !== "/themes/_template.zip") {
          next();
          return;
        }
        void load()
          .then((zip) => {
            res.setHeader("Content-Type", "application/zip");
            res.setHeader("Content-Length", String(zip.length));
            res.setHeader("Cache-Control", "no-cache");
            res.end(Buffer.from(zip));
          })
          .catch(() => next());
      });
    },
  };
}

export default defineConfig({
  root: "src",
  publicDir: false,
  plugins: [rawGameAssetsPlugin(), extraBundlePlugin(), themeTemplateZipPlugin(), serveFolder("/themes", "themes"), serveFolder("/translations", "translations")],
  server: {
    host: true,
    port: 4398,
    strictPort: true,
    watch: {
      ignored: ["**/extra.bundle.js"],
    },
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
