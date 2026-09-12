/** Tab-cast crop helpers — game-screen fill without stretching. */

export type TabCrop = { x: number; y: number; w: number; h: number };

/** Animate/CreateJS stage size — crop fills this view, not the browser page. */
export const GAME_SCREEN = { w: 550, h: 300 } as const;
export const GAME_ASPECT = GAME_SCREEN.w / GAME_SCREEN.h;

export const DEFAULT_TAB_CROP: TabCrop = { x: 0, y: 0, w: 1, h: 1 };

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function normalizeTabCrop(raw: Partial<TabCrop> | null | undefined): TabCrop {
  if (!raw) return { ...DEFAULT_TAB_CROP };
  const x = clamp01(typeof raw.x === "number" ? raw.x : 0);
  const y = clamp01(typeof raw.y === "number" ? raw.y : 0);
  const w = clamp01(typeof raw.w === "number" ? raw.w : 1);
  const h = clamp01(typeof raw.h === "number" ? raw.h : 1);
  return {
    x,
    y,
    w: Math.max(0.05, Math.min(1 - x, w)),
    h: Math.max(0.05, Math.min(1 - y, h)),
  };
}

/** object-fit: contain layout of a video inside the game screen. */
export function containLayout(vw: number, vh: number, cw: number, ch: number): {
  scale: number;
  displayW: number;
  displayH: number;
  offsetX: number;
  offsetY: number;
} {
  if (vw <= 0 || vh <= 0 || cw <= 0 || ch <= 0) {
    return { scale: 1, displayW: Math.max(0, cw), displayH: Math.max(0, ch), offsetX: 0, offsetY: 0 };
  }
  const scale = Math.min(cw / vw, ch / vh);
  const displayW = vw * scale;
  const displayH = vh * scale;
  return {
    scale,
    displayW,
    displayH,
    offsetX: (cw - displayW) / 2,
    offsetY: (ch - displayH) / 2,
  };
}

/**
 * Uniform cover layout so the crop region fills the game screen without warping.
 * Returns CSS pixel size/position for the video element inside the container.
 */
export function coverCropLayout(
  crop: TabCrop,
  vw: number,
  vh: number,
  cw: number,
  ch: number,
): { width: number; height: number; left: number; top: number } {
  const c = normalizeTabCrop(crop);
  if (vw <= 0 || vh <= 0 || cw <= 0 || ch <= 0) {
    return { width: Math.max(0, cw), height: Math.max(0, ch), left: 0, top: 0 };
  }
  const cropW = Math.max(1, c.w * vw);
  const cropH = Math.max(1, c.h * vh);
  const scale = Math.max(cw / cropW, ch / cropH);
  const width = vw * scale;
  const height = vh * scale;
  // Center the crop rectangle in the game screen (cover may trim overflow of the selection).
  const left = -c.x * vw * scale + (cw - cropW * scale) / 2;
  const top = -c.y * vh * scale + (ch - cropH * scale) / 2;
  return { width, height, left, top };
}

/** Source-normalized w/h that matches the game screen aspect for this video. */
export function gameNormAspect(vw: number, vh: number): number {
  if (vw <= 0 || vh <= 0) return GAME_ASPECT;
  return (GAME_ASPECT * vh) / vw;
}

/**
 * Build a free-form crop in source-normalized [0,1] space from a drag across the
 * contain-letterboxed video display. Selection maps 1:1 — no aspect lock / grow.
 */
export function cropFromDrag(opts: {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  vw: number;
  vh: number;
  cw: number;
  ch: number;
}): TabCrop {
  const { vw, vh, cw, ch } = opts;
  const layout = containLayout(vw, vh, cw, ch);
  if (layout.displayW <= 0 || layout.displayH <= 0) return { ...DEFAULT_TAB_CROP };

  const toSrc = (px: number, py: number) => ({
    x: (px - layout.offsetX) / layout.displayW,
    y: (py - layout.offsetY) / layout.displayH,
  });
  const a = toSrc(opts.x0, opts.y0);
  const b = toSrc(opts.x1, opts.y1);

  // Clamp to the video letterbox (outside → edge). No aspect forcing.
  const x0 = clamp01(a.x);
  const y0 = clamp01(a.y);
  const x1 = clamp01(b.x);
  const y1 = clamp01(b.y);

  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  const w = Math.max(x0, x1) - x;
  const h = Math.max(y0, y1) - y;

  if (w < 0.001 && h < 0.001) {
    return normalizeTabCrop({ x, y, w: 0.05, h: 0.05 });
  }

  return normalizeTabCrop({ x, y, w: Math.max(0.05, w), h: Math.max(0.05, h) });
}

/** Map a source-normalized crop to overlay pixels for the selection rect. */
export function cropToOverlayRect(
  crop: TabCrop,
  vw: number,
  vh: number,
  cw: number,
  ch: number,
): { left: number; top: number; width: number; height: number } {
  const c = normalizeTabCrop(crop);
  const layout = containLayout(vw, vh, cw, ch);
  return {
    left: layout.offsetX + c.x * layout.displayW,
    top: layout.offsetY + c.y * layout.displayH,
    width: c.w * layout.displayW,
    height: c.h * layout.displayH,
  };
}
