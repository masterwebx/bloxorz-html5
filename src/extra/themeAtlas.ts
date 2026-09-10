import atlasMap from "./atlasMap.json";
import { getTheme, themeFileUrl, type ThemePack } from "./themePack";

type AtlasFrame = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  folder: string | null;
  file: string | null;
  srcX?: number;
  srcY?: number;
};

const map = atlasMap as { width: number; height: number; frames: AtlasFrame[] };
const cache = new Map<string, HTMLCanvasElement>();

export function themeAtlasFiles(): string[] {
  const files = new Set<string>();
  for (const row of map.frames) {
    if (row.file) files.add(row.file);
  }
  return [...files];
}

function lookupPackFile(pack: ThemePack, file: string): string | null {
  if (pack.files?.[file]) return pack.files[file]!;
  if (pack.files) {
    const want = file.replace(/\\/g, "/").toLowerCase();
    const hit = Object.entries(pack.files).find(([k]) => {
      const key = k.replace(/\\/g, "/").toLowerCase();
      return key === want || key.endsWith("/" + want) || key.endsWith(want.split("/").pop() || want);
    });
    if (hit) return hit[1];
  }
  if (pack.builtin) return themeFileUrl(pack.id, file);
  return null;
}

export function resolveAtlasFile(id: string, file: string): string | null {
  const pack = getTheme(id);
  return lookupPackFile(pack, file) || themeFileUrl("original", file);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadAll(srcs: string[]): Promise<Map<string, HTMLImageElement>> {
  const out = new Map<string, HTMLImageElement>();
  const chunk = 24;
  for (let i = 0; i < srcs.length; i += chunk) {
    const slice = srcs.slice(i, i + chunk);
    const imgs = await Promise.all(slice.map(loadImage));
    slice.forEach((src, n) => {
      const img = imgs[n];
      if (img) out.set(src, img);
    });
  }
  return out;
}

export function forgetThemeAtlas(id?: string): void {
  if (id) cache.delete(id);
  else cache.clear();
}

export async function composeThemeAtlas(id: string, force = false): Promise<HTMLCanvasElement> {
  if (!force && cache.has(id)) return cache.get(id)!;
  const canvas = document.createElement("canvas");
  canvas.width = map.width;
  canvas.height = map.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("atlas");
  const needed = themeAtlasFiles();
  const urls = [...new Set(needed.map((file) => resolveAtlasFile(id, file)).filter((u): u is string => !!u))];
  const images = await loadAll(urls);
  for (const row of map.frames) {
    if (!row.file) continue;
    const src = resolveAtlasFile(id, row.file);
    const img = src ? images.get(src) : null;
    if (!img) continue;
    if (row.folder === "block") {
      const sx = row.srcX ?? 0;
      const sy = row.srcY ?? 0;
      ctx.drawImage(img, sx, sy, row.w, row.h, row.x, row.y, row.w, row.h);
    } else {
      ctx.drawImage(img, 0, 0, img.naturalWidth || img.width, img.naturalHeight || img.height, row.x, row.y, row.w, row.h);
    }
  }
  cache.set(id, canvas);
  return canvas;
}
