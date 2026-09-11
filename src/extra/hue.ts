/** Hue-rotate RGB and bake the shift into pixel buffers (same matrix CreateJS ColorMatrix.adjustHue uses). */

export function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function hueRotateRgb(r: number, g: number, b: number, degrees: number): [number, number, number] {
  if (!degrees) return [r, g, b];
  const rad = ((degrees % 360) * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const nr =
    r * (0.213 + c * 0.787 - s * 0.213) + g * (0.715 - c * 0.715 - s * 0.715) + b * (0.072 - c * 0.072 + s * 0.928);
  const ng =
    r * (0.213 - c * 0.213 + s * 0.143) + g * (0.715 + c * 0.285 + s * 0.14) + b * (0.072 - c * 0.072 - s * 0.283);
  const nb =
    r * (0.213 - c * 0.213 - s * 0.787) + g * (0.715 - c * 0.715 + s * 0.715) + b * (0.072 + c * 0.928 + s * 0.072);
  return [clampByte(nr), clampByte(ng), clampByte(nb)];
}

export function bakeHueIntoPixels(data: Uint8ClampedArray, degrees: number): void {
  if (!degrees) return;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [r, g, b] = hueRotateRgb(data[i], data[i + 1], data[i + 2], degrees);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

export const RUST_TOP: [number, number, number] = [196, 104, 32];
export const RUST_LEFT: [number, number, number] = [122, 48, 16];
export const RUST_RIGHT: [number, number, number] = [160, 68, 20];

export function wrapHue(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return ((n % 360) + 360) % 360;
}

export function hueDelta(a: number, b: number): number {
  const d = Math.abs(wrapHue(a) - wrapHue(b));
  return Math.min(d, 360 - d);
}

/** Cheap per-clip hue: clear, set a ColorMatrixFilter, or just recache an animating clip. */
export function clipHueAction(prev: number | undefined, hue: number, animating: boolean): "clear" | "apply" | "update" | "skip" {
  const next = wrapHue(hue);
  if (!next) return prev ? "clear" : "skip";
  if (prev !== next) return "apply";
  return animating ? "update" : "skip";
}

export function shiftingHue(base: number, enabled: boolean, elapsedMs: number, degPerSec = 24): number {
  const start = wrapHue(base);
  if (!enabled) return Math.round(start);
  return Math.round(wrapHue(start + (elapsedMs / 1000) * degPerSec));
}

export function rustFaces(hue: number): { top: string; left: string; right: string; edge: string } {
  const top = hueRotateRgb(RUST_TOP[0], RUST_TOP[1], RUST_TOP[2], hue);
  const left = hueRotateRgb(RUST_LEFT[0], RUST_LEFT[1], RUST_LEFT[2], hue);
  const right = hueRotateRgb(RUST_RIGHT[0], RUST_RIGHT[1], RUST_RIGHT[2], hue);
  const edge = hueRotateRgb(240, 180, 120, hue);
  return {
    top: `rgb(${top[0]},${top[1]},${top[2]})`,
    left: `rgb(${left[0]},${left[1]},${left[2]})`,
    right: `rgb(${right[0]},${right[1]},${right[2]})`,
    edge: `rgb(${edge[0]},${edge[1]},${edge[2]})`,
  };
}

export function cssRgb(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

export interface FrameBackup {
  x: number;
  y: number;
  width: number;
  height: number;
  original: ImageData;
}

export function makeImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  if (typeof ImageData === "function") {
    return new ImageData(data as unknown as ImageDataArray, width, height);
  }
  return { data, width, height, colorSpace: "srgb" } as ImageData;
}

export function bakeFrameBackup(frame: FrameBackup, hue: number): ImageData {
  const data = new Uint8ClampedArray(frame.original.data);
  bakeHueIntoPixels(data, hue);
  return makeImageData(data, frame.width, frame.height);
}

export function atlasHueFilter(hue: number): string {
  const n = wrapHue(hue);
  return n ? `hue-rotate(${n}deg)` : "none";
}

/** Skip atlas collect/blit when hue is still default and nothing has been baked. */
export function needsBlockHueBake(hue: number, bakedHue: number, hasAtlas: boolean): boolean {
  const n = wrapHue(hue);
  if (!n && bakedHue < 0 && !hasAtlas) return false;
  if (hasAtlas && bakedHue >= 0 && n === bakedHue) return false;
  return true;
}

export type AtlasRect = { x: number; y: number; width: number; height: number };

type HueBlitCtx = {
  filter: string;
  drawImage: (
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ) => void;
};

/** Copy block rects from an unmodified atlas using CSS hue-rotate. No per-pixel walks. */
export function blitHueRects(
  ctx: HueBlitCtx,
  source: CanvasImageSource,
  rects: AtlasRect[],
  hue: number,
): void {
  ctx.filter = atlasHueFilter(hue);
  for (const r of rects) {
    ctx.drawImage(source, r.x, r.y, r.width, r.height, r.x, r.y, r.width, r.height);
  }
  ctx.filter = "none";
}

export type PackedBlockSlot = {
  /** Rect inside the packed block-only sheet. */
  src: AtlasRect;
  /** Matching rect on the live CreateJS atlas. */
  dest: AtlasRect;
};

export type PackedBlockLayout = {
  width: number;
  height: number;
  slots: PackedBlockSlot[];
};

/** Pack live atlas block rects into a tight sheet (no full 4096² source). */
export function packBlockLayout(rects: AtlasRect[]): PackedBlockLayout {
  if (!rects.length) return { width: 0, height: 0, slots: [] };
  const cellW = Math.max(1, ...rects.map((r) => r.width));
  const cellH = Math.max(1, ...rects.map((r) => r.height));
  const cols = Math.max(1, Math.ceil(Math.sqrt(rects.length)));
  const rows = Math.max(1, Math.ceil(rects.length / cols));
  const slots: PackedBlockSlot[] = rects.map((dest, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      src: { x: col * cellW, y: row * cellH, width: dest.width, height: dest.height },
      dest: { x: dest.x, y: dest.y, width: dest.width, height: dest.height },
    };
  });
  return { width: cols * cellW, height: rows * cellH, slots };
}

type PackExtractCtx = {
  drawImage: (
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ) => void;
};

/** One-time extract: copy pristine block pixels from the live atlas into a packed sheet. */
export function extractPackedBlockSource(
  makeCanvas: (w: number, h: number) => { canvas: HTMLCanvasElement; ctx: PackExtractCtx } | null,
  live: CanvasImageSource,
  layout: PackedBlockLayout,
): HTMLCanvasElement | null {
  if (!layout.slots.length || layout.width <= 0 || layout.height <= 0) return null;
  const made = makeCanvas(layout.width, layout.height);
  if (!made) return null;
  for (const slot of layout.slots) {
    const { src, dest } = slot;
    made.ctx.drawImage(live, dest.x, dest.y, dest.width, dest.height, src.x, src.y, src.width, src.height);
  }
  return made.canvas;
}

type PackBlitScratch = {
  canvas: HTMLCanvasElement;
  ctx: HueBlitCtx & PackExtractCtx;
};

/**
 * Fast re-tint: one filtered draw of the packed pristine sheet, then unfiltered
 * copies into the live atlas at original frame rects. No ColorMatrix on clips.
 * @deprecated Prefer blitPackedRecolor for true RGB swatches (hue-rotate collapses sat/value).
 */
export function blitPackedHue(
  destCtx: HueBlitCtx & PackExtractCtx,
  packedSource: CanvasImageSource,
  scratch: PackBlitScratch,
  slots: PackedBlockSlot[],
  hue: number,
): void {
  const sw = scratch.canvas.width;
  const sh = scratch.canvas.height;
  scratch.ctx.filter = atlasHueFilter(hue);
  scratch.ctx.drawImage(packedSource, 0, 0, sw, sh, 0, 0, sw, sh);
  scratch.ctx.filter = "none";
  destCtx.filter = "none";
  for (const slot of slots) {
    const { src, dest } = slot;
    destCtx.drawImage(scratch.canvas, src.x, src.y, src.width, src.height, dest.x, dest.y, dest.width, dest.height);
  }
}

export function parseHexRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Scale a rust-base pixel toward an arbitrary target RGB, keeping shading ratios. */
export function recolorRgb(
  r: number,
  g: number,
  b: number,
  tr: number,
  tg: number,
  tb: number,
  base: [number, number, number] = RUST_TOP,
): [number, number, number] {
  const br = Math.max(1, base[0]);
  const bg = Math.max(1, base[1]);
  const bb = Math.max(1, base[2]);
  return [clampByte((r * tr) / br), clampByte((g * tg) / bg), clampByte((b * tb) / bb)];
}

export function bakeRecolorIntoPixels(data: Uint8ClampedArray, targetHex: string): void {
  const rgb = parseHexRgb(targetHex);
  if (!rgb) return;
  const [tr, tg, tb] = rgb;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [nr, ng, nb] = recolorRgb(data[i]!, data[i + 1]!, data[i + 2]!, tr, tg, tb);
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
}

export function rustFacesFromHex(hex: string): { top: string; left: string; right: string; edge: string } {
  const rgb = parseHexRgb(hex) ?? RUST_TOP;
  const face = (base: [number, number, number]) => {
    const [r, g, b] = recolorRgb(base[0], base[1], base[2], rgb[0], rgb[1], rgb[2]);
    return `rgb(${r},${g},${b})`;
  };
  return {
    top: face(RUST_TOP),
    left: face(RUST_LEFT),
    right: face(RUST_RIGHT),
    edge: face([240, 180, 120]),
  };
}

/** Skip atlas work when still on the pristine default and nothing has been baked. */
export function needsBlockColorBake(color: string | null, baked: string | null, hasAtlas: boolean): boolean {
  if (color === baked) {
    if (color === null && !hasAtlas) return false;
    if (hasAtlas) return false;
  }
  return true;
}

/**
 * True RGB re-tint of the packed block sheet (full swatch, not hue-rotate), then
 * unfiltered copies into the live atlas. `targetHex === null` restores pristine rust.
 */
export function blitPackedRecolor(
  destCtx: HueBlitCtx & PackExtractCtx,
  packedSource: CanvasImageSource,
  scratch: PackBlitScratch,
  slots: PackedBlockSlot[],
  targetHex: string | null,
): void {
  const sw = scratch.canvas.width;
  const sh = scratch.canvas.height;
  const scratchCtx = scratch.ctx as HueBlitCtx &
    PackExtractCtx & {
      clearRect?: (x: number, y: number, w: number, h: number) => void;
      getImageData?: (x: number, y: number, w: number, h: number) => ImageData;
      putImageData?: (img: ImageData, x: number, y: number) => void;
    };
  scratchCtx.filter = "none";
  scratchCtx.clearRect?.(0, 0, sw, sh);
  scratchCtx.drawImage(packedSource, 0, 0, sw, sh, 0, 0, sw, sh);
  if (targetHex && scratchCtx.getImageData && scratchCtx.putImageData) {
    const img = scratchCtx.getImageData(0, 0, sw, sh);
    bakeRecolorIntoPixels(img.data, targetHex);
    scratchCtx.putImageData(img, 0, 0);
  }
  destCtx.filter = "none";
  for (const slot of slots) {
    const { src, dest } = slot;
    destCtx.drawImage(scratch.canvas, src.x, src.y, src.width, src.height, dest.x, dest.y, dest.width, dest.height);
  }
}

/** Animate sprite names that are the rust block itself — not shadows or UI. */
export const BLOCK_SPRITE_RE = /^blocka(fall|land|shrink|small)?\d+$/;

export function isBlockSpriteName(name: string): boolean {
  return BLOCK_SPRITE_RE.test(name);
}

export function frameIndexFromCtorSource(source: string): number | null {
  const m = source.match(/gotoAndStop\((\d+)\)/);
  return m ? Number(m[1]) : null;
}

export function collectBlockFrameIndexes(lib: Record<string, unknown>): number[] {
  const indexes = new Set<number>();
  for (const [name, value] of Object.entries(lib)) {
    if (!isBlockSpriteName(name)) continue;
    const idx = frameIndexFromCtorSource(String(value));
    if (idx !== null) indexes.add(idx);
  }
  return [...indexes].sort((a, b) => a - b);
}
