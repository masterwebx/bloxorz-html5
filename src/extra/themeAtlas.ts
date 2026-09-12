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

/** Retained sheet: prefer HTMLImageElement (decoded bitmap, no live canvas buffer). */
export type ThemeAtlasSheet = HTMLCanvasElement | HTMLImageElement;

const map = atlasMap as { width: number; height: number; frames: AtlasFrame[] };
const cache = new Map<string, ThemeAtlasSheet>();

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

function releaseSheet(sheet: ThemeAtlasSheet | undefined): void {
  if (!sheet) return;
  if (sheet instanceof HTMLCanvasElement) {
    sheet.width = 0;
    sheet.height = 0;
  }
}

export function forgetThemeAtlas(id?: string): void {
  if (id) {
    releaseSheet(cache.get(id));
    cache.delete(id);
    return;
  }
  for (const sheet of cache.values()) releaseSheet(sheet);
  cache.clear();
}

/** Drop every cached theme atlas except `keepId` (one sheet retained). */
export function evictThemeAtlasesExcept(keepId: string): void {
  for (const key of [...cache.keys()]) {
    if (key === keepId) continue;
    releaseSheet(cache.get(key));
    cache.delete(key);
  }
}

/**
 * Prefer a packed `atlas.png` (theme.json `atlas` or default file) when it loads.
 * Returns an HTMLImageElement — no live 4096² canvas retained for default play.
 * Rejects downscaled sheets (< ~90% of logical size) so we never sample blurry art.
 */
async function tryLoadStaticAtlas(id: string): Promise<HTMLImageElement | null> {
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
  const minW = Math.floor(map.width * 0.9);
  const minH = Math.floor(map.height * 0.9);
  for (const src of candidates) {
    if (!src) continue;
    const img = await loadImage(src);
    if (!img) continue;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w < minW || h < minH) continue;
    return img;
  }
  return null;
}

/** Turn a composed canvas into a PNG Image and drop the live canvas buffer. */
async function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), "image/png");
    } catch {
      resolve(null);
    }
  });
  if (!blob) {
    // Fallback: keep canvas if toBlob unsupported
    return canvas as unknown as HTMLImageElement;
  }
  const url = URL.createObjectURL(blob);
  const img = await loadImage(url);
  canvas.width = 0;
  canvas.height = 0;
  // Revoke after decode; Image keeps its own bitmap.
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
  if (!img) throw new Error("atlas-image");
  return img;
}

async function composeFromSlices(id: string): Promise<ThemeAtlasSheet> {
  // Full logical resolution only — never downscale game art for RAM.
  const canvas = document.createElement("canvas");
  canvas.width = map.width;
  canvas.height = map.height;
  // Default GPU-friendly context — never willReadFrequently on the full sheet.
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
  // Prefer Image retention so we do not keep a permanent canvas backing store.
  try {
    return await canvasToImage(canvas);
  } catch {
    return canvas;
  }
}

/**
 * Build or reuse the theme atlas. Returns the cached sheet (single image/canvas per theme).
 * Callers that mutate pixels (color bake) must recompose via `force` / `forgetThemeAtlas`
 * after Reset all — do not keep a second 4096² clone by default.
 */
export async function composeThemeAtlas(id: string, force = false): Promise<ThemeAtlasSheet> {
  if (!force && cache.has(id)) {
    evictThemeAtlasesExcept(id);
    return cache.get(id)!;
  }
  if (force) {
    releaseSheet(cache.get(id));
    cache.delete(id);
  }
  const sheet = (await tryLoadStaticAtlas(id)) ?? (await composeFromSlices(id));
  cache.set(id, sheet);
  evictThemeAtlasesExcept(id);
  return sheet;
}

/** Materialize a writable FULL-LOGICAL canvas from a cached sheet (color bake only). */
export function sheetToWritableCanvas(sheet: ThemeAtlasSheet): HTMLCanvasElement | null {
  if (sheet instanceof HTMLCanvasElement && sheet.width === map.width && sheet.height === map.height) {
    return sheet;
  }
  const canvas = document.createElement("canvas");
  canvas.width = map.width;
  canvas.height = map.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // Copy sheet into a writable logical canvas (bake rects match ssMetadata).
  // Full-res sheets blit 1:1; never intentionally ship downscaled atlases.
  const sw = (sheet as HTMLImageElement).naturalWidth || sheet.width;
  const sh = (sheet as HTMLImageElement).naturalHeight || sheet.height;
  ctx.imageSmoothingEnabled = sw === map.width && sh === map.height ? false : true;
  ctx.drawImage(sheet, 0, 0, map.width, map.height);
  return canvas;
}
