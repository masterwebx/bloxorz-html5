/** Coolmath-style iso: x right-down, y left-down. Scaled to the extra HUD. */
export type IsoMetrics = { ox: number; oy: number; s: number };

export const TILE_FACE: Record<string, { top: string; left: string; right: string; stroke: string }> = {
  " ": { top: "rgba(255,255,255,0.05)", left: "rgba(255,255,255,0.02)", right: "rgba(255,255,255,0.02)", stroke: "rgba(255,255,255,0.12)" },
  b: { top: "#d46820", left: "#7a3010", right: "#a04414", stroke: "#f0a060" },
  e: { top: "#0c0c0c", left: "#1a1408", right: "#1a1408", stroke: "#f4d36a" },
  s: { top: "#4a8ee8", left: "#2458a0", right: "#2f6fc4", stroke: "#9cc8ff" },
  h: { top: "#9b48e0", left: "#5a2088", right: "#7a30b0", stroke: "#d8a0ff" },
  f: { top: "#e8b44a", left: "#8a6818", right: "#b88828", stroke: "#ffe08a" },
  v: { top: "#2f9d7a", left: "#186048", right: "#208060", stroke: "#7eecc4" },
  l: { top: "#8a4820", left: "#4a2010", right: "#6a3018", stroke: "#d08040" },
  k: { top: "#c87838", left: "#6a3810", right: "#8a4820", stroke: "#f0b070" },
  r: { top: "#6a3018", left: "#3a180c", right: "#502010", stroke: "#c06030" },
  q: { top: "#b06030", left: "#5a2810", right: "#7a3818", stroke: "#e09050" },
};

export const TOOL_CH: Record<string, string> = {
  erase: " ",
  stone: "b",
  exit: "e",
  soft: "s",
  heavy: "h",
  fragile: "f",
  split: "v",
  bridgeL: "l",
  bridgeR: "r",
  spawn: "b",
  link: "s",
};

export function isoPt(x: number, y: number, m: IsoMetrics): { x: number; y: number } {
  return {
    x: m.ox + x * 16 * m.s + y * 6 * m.s,
    y: m.oy + y * 9 * m.s - x * 3 * m.s,
  };
}

export function isoCenter(x: number, y: number, m: IsoMetrics): { x: number; y: number } {
  const a = isoPt(x, y, m);
  const c = isoPt(x + 1, y + 1, m);
  return { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
}

export function pickIsoCell(lx: number, ly: number, m: IsoMetrics): { x: number; y: number } | null {
  let best: { x: number; y: number; d: number } | null = null;
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 15; x++) {
      const c = isoCenter(x, y, m);
      const d = (c.x - lx) ** 2 + (c.y - ly) ** 2;
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  const max = (12 * m.s) ** 2;
  if (!best || best.d > max) return null;
  return { x: best.x, y: best.y };
}

export const DEFAULT_ISO: IsoMetrics = { ox: 36, oy: 168, s: 0.78 };
