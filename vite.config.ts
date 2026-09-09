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
  plugins: [extraBundlePlugin()],
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
