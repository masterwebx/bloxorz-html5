import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  publicDir: false,
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
