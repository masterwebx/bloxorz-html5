/**
 * Pack themes/<id>/atlas.png from slice PNGs + atlasMap.json (build-time).
 * Default packScale=1 → full logical sheet (4096²). Do not ship half-res atlases —
 * downscaled sheets blur sprites and force expensive CreateJS upscale draws.
 * Written into themes/ so dist copy includes them; runtime prefers these over compose.
 */
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const atlasMap = JSON.parse(readFileSync(path.join(root, "src/extra/atlasMap.json"), "utf8"));
const themeIds = ["original", "gray", "holiday"];
const packScale = Number(process.env.BLOX_ATLAS_SCALE || "1");

async function packTheme(page, themeId) {
  const themeDir = path.join(root, "themes", themeId);
  const outPath = path.join(themeDir, "atlas.png");
  const frames = atlasMap.frames.filter((f) => f.file);
  const files = [...new Set(frames.map((f) => f.file))];

  const fileData = {};
  for (const file of files) {
    const abs = path.join(themeDir, file);
    if (!existsSync(abs)) continue;
    const buf = readFileSync(abs);
    fileData[file] = `data:image/png;base64,${buf.toString("base64")}`;
  }

  const width = Math.round(atlasMap.width * packScale);
  const height = Math.round(atlasMap.height * packScale);

  const dataUrl = await page.evaluate(
    async ({ width, height, packScale, frames, fileData }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) throw new Error("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const images = {};
      await Promise.all(
        Object.entries(fileData).map(
          ([file, src]) =>
            new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                images[file] = img;
                resolve();
              };
              img.onerror = () => resolve();
              img.src = src;
            }),
        ),
      );
      for (const row of frames) {
        const img = images[row.file];
        if (!img) continue;
        const dx = Math.round(row.x * packScale);
        const dy = Math.round(row.y * packScale);
        const dw = Math.max(1, Math.round(row.w * packScale));
        const dh = Math.max(1, Math.round(row.h * packScale));
        if (row.folder === "block") {
          const sx = row.srcX ?? 0;
          const sy = row.srcY ?? 0;
          ctx.drawImage(img, sx, sy, row.w, row.h, dx, dy, dw, dh);
        } else {
          ctx.drawImage(img, 0, 0, img.naturalWidth || img.width, img.naturalHeight || img.height, dx, dy, dw, dh);
        }
      }
      return canvas.toDataURL("image/png");
    },
    { width, height, packScale, frames, fileData },
  );

  const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  writeFileSync(outPath, Buffer.from(b64, "base64"));
  const themeJsonPath = path.join(themeDir, "theme.json");
  if (existsSync(themeJsonPath)) {
    const json = JSON.parse(readFileSync(themeJsonPath, "utf8"));
    if (json.atlas !== "atlas.png") {
      json.atlas = "atlas.png";
      writeFileSync(themeJsonPath, JSON.stringify(json, null, 2) + "\n");
    }
  }
  return { outPath, width, height };
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setContent("<!doctype html><title>pack</title>");

for (const id of themeIds) {
  const { outPath, width, height } = await packTheme(page, id);
  const size = statSync(outPath).size;
  console.log(`packed ${id}: ${width}x${height} ${(size / 1024 / 1024).toFixed(2)} MB → ${outPath}`);
}

await browser.close();
