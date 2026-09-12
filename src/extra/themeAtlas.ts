import atlasMap from "./atlasMap.json";
import { atlasUrlFor, getTheme, themeFileUrl, type ThemePack } from "./themePack";

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

/** Theme ids currently retained in the atlas canvas cache (tests / diagnostics). */
export function cachedThemeAtlasIds(): string[] {
  return [...cache.keys()];
}

function lookupPackFile(pack: ThemePack, file: string): string | null {
  if (pack.files?.[file]) return pack.files[file]!;
  if (pack.files) {
    const want = file.replace(/\\/g, "/").toLowerCase();
    const base = want.split("/").pop() || want;
    const hit = Object.entries(pack.files).find(([k]) => {
      const key = k.replace(/\\/g, "/").toLowerCase();
      return key === want || key.endsWith("/" + want) || key === base || key.endsWith("/" + base);
    });
    if (hit) return hit[1];
  }
  if (pack.builtin) return themeFileUrl(pack.id, file);
  return null;
}

export function resolveAtlasFile(id: string, file: string): string | null {
  const pack = getTheme(id);
  const fromPack = lookupPackFile(pack, file);
  if (fromPack) return fromPack;
  if (!pack.builtin) {
    const fallback = lookupPackFile(getTheme("original"), file);
    if (fallback) return fallback;
  }
  return themeFileUrl("original", file);
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
  const chunk = 48;
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
  if (id) {
    cache.delete(id);
    return;
  }
  cache.clear();
}

/** Drop every cached theme atlas except `keepId` (one 4096² sheet retained). */
export function evictThemeAtlasesExcept(keepId: string): void {
  for (const key of [...cache.keys()]) {
    if (key === keepId) continue;
    cache.delete(key);
  }
}

/**
 * Prefer a packed `atlas.png` (theme.json `atlas` or default file) when it loads.
 * Avoids decoding hundreds of slice PNGs into a fresh 4096² compose.
 */
async function tryLoadStaticAtlas(id: string): Promise<HTMLCanvasElement | null> {
  const pack = getTheme(id);
  const candidates: string[] = [];
  const declared = atlasUrlFor(id);
  if (declared) candidates.push(declared);
  const fallback = themeFileUrl(id, pack.atlas || "atlas.png");
  if (fallback && !candidates.includes(fallback)) candidates.push(fallback);
  if (pack.builtin && pack.atlas !== "atlas.png") {
    const plain = themeFileUrl(id, "atlas.png");
    if (!candidates.includes(plain)) candidates.push(plain);
  }
  for (const src of candidates) {
    if (!src) continue;
    const img = await loadImage(src);
    if (!img) continue;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w < 64 || h < 64) continue;
    const canvas = document.createElement("canvas");
    canvas.width = map.width;
    canvas.height = map.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas;
  }
  return null;
}

async function composeFromSlices(id: string): Promise<HTMLCanvasElement> {
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
  images.clear();
  return canvas;
}

/**
 * Build or reuse the theme atlas. Returns the cached canvas (single sheet per theme).
 * Callers that mutate pixels (color bake) must recompose via `force` / `forgetThemeAtlas`
 * after Reset all — do not keep a second 4096² clone by default.
 */
export async function composeThemeAtlas(id: string, force = false): Promise<HTMLCanvasElement> {
  if (!force && cache.has(id)) {
    evictThemeAtlasesExcept(id);
    return cache.get(id)!;
  }
  if (force) cache.delete(id);
  const canvas = (await tryLoadStaticAtlas(id)) ?? (await composeFromSlices(id));
  cache.set(id, canvas);
  evictThemeAtlasesExcept(id);
  return canvas;
}
