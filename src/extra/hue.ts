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
