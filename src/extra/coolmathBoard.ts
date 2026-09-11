/** Coolmath playfield projection and atlas clips used by the Stage Creator. */

export const GRID_W = 15;
export const GRID_H = 10;

export function gamePos(x: number, y: number): [number, number] {
  return [x * 30 + y * 10 + 30, y * 16 - x * 5 + 130];
}

export function unproject(px: number, py: number): { x: number; y: number } {
  const X = px - 30;
  const Y = py - 130;
  const x = (16 * X - 10 * Y) / 530;
  const y = (30 * Y + 5 * X) / 530;
  return { x, y };
}

export const BOARD_VIEW = { x: 6, y: 42, w: 288, h: 228 };
const SRC_MIN_X = 20;
const SRC_MAX_X = 555;
const SRC_MIN_Y = 50;
const SRC_MAX_Y = 290;

export const BOARD_SCALE = Math.min(
  BOARD_VIEW.w / (SRC_MAX_X - SRC_MIN_X),
  BOARD_VIEW.h / (SRC_MAX_Y - SRC_MIN_Y),
);

export const BOARD_OX = BOARD_VIEW.x - SRC_MIN_X * BOARD_SCALE;
export const BOARD_OY = BOARD_VIEW.y - SRC_MIN_Y * BOARD_SCALE;

export function boardScreen(x: number, y: number): { x: number; y: number } {
  const [gx, gy] = gamePos(x, y);
  return { x: BOARD_OX + gx * BOARD_SCALE, y: BOARD_OY + gy * BOARD_SCALE };
}

/**
 * Coolmath tile face diamond: tip at (x,y), extending toward y-1
 * (same corners as bloxorz.js shadow mask).
 */
export function boardCellCorners(
  x: number,
  y: number,
): [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] {
  return [boardScreen(x, y), boardScreen(x, y - 1), boardScreen(x + 1, y - 1), boardScreen(x + 1, y)];
}

export function boardCellCenter(x: number, y: number): { x: number; y: number } {
  const [a, b, c, d] = boardCellCorners(x, y);
  return { x: (a.x + b.x + c.x + d.x) / 4, y: (a.y + b.y + c.y + d.y) / 4 };
}

export const TILE_LABEL: Record<string, string> = {
  b: "normalblock",
  s: "softswitch",
  h: "hardswitch",
  l: "doorblockl",
  k: "doorblockl",
  r: "doorblockr",
  q: "doorblockr",
  e: "endblock",
  v: "splitswitch",
  f: "fallblock",
};

export type ClipName =
  | "metal_v2"
  | "metal_v3"
  | "softswitch_v3"
  | "hardswitch_v3"
  | "splitswitch_v2"
  | "stoneexit_v2"
  | "stone2_v2"
  | "Block";

/** Sprite registration copied from the Tile / Tween clips in bloxorz.js. */
/**
 * Registration offsets matching Tile timeline placement (not the Tween* fly-in wrappers).
 * Bridge/fragile metal_v3 sits at the same tip as stone so creator clips line up with the grid.
 */
export const CLIP_OFFSET: Record<ClipName, [number, number]> = {
  metal_v2: [-14.5, -24.5],
  metal_v3: [-14.5, -24.5],
  softswitch_v3: [-15, -25],
  hardswitch_v3: [-15, -25],
  splitswitch_v2: [-15, -27],
  stoneexit_v2: [-16, -28],
  stone2_v2: [-14.5, -24.5],
  Block: [0, 0],
};

export function clipForTile(ch: string): { name: ClipName; dim: number } | null {
  switch (ch) {
    case "b":
      return { name: "metal_v2", dim: 1 };
    case "e":
      return { name: "stoneexit_v2", dim: 1 };
    case "s":
      return { name: "softswitch_v3", dim: 1 };
    case "h":
      return { name: "hardswitch_v3", dim: 1 };
    case "v":
      return { name: "splitswitch_v2", dim: 1 };
    case "f":
      return { name: "metal_v3", dim: 1 };
    case "k":
    case "q":
      return { name: "metal_v3", dim: 1 };
    case "l":
    case "r":
      return { name: "metal_v3", dim: 1 };
    default:
      return null;
  }
}

export function pickBoardCell(localX: number, localY: number): { x: number; y: number } | null {
  const px = (localX - BOARD_OX) / BOARD_SCALE;
  const py = (localY - BOARD_OY) / BOARD_SCALE;
  const raw = unproject(px, py);
  let x = Math.round(raw.x);
  let y = Math.round(raw.y);
  if (x >= 0 && y >= 0 && x < GRID_W && y < GRID_H) return { x, y };
  // Soft edge grab: clicks just outside the board still land on the nearest rim cell.
  const cx = Math.max(0, Math.min(GRID_W - 1, x));
  const cy = Math.max(0, Math.min(GRID_H - 1, y));
  const dx = raw.x - cx;
  const dy = raw.y - cy;
  if (dx * dx + dy * dy > 0.9 * 0.9) return null;
  return { x: cx, y: cy };
}

export function occupiedCells(tiles: string[]): { x: number; y: number; ch: string }[] {
  const out: { x: number; y: number; ch: string }[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const ch = tiles[y]?.[x] ?? " ";
      if (ch !== " ") out.push({ x, y, ch });
    }
  }
  return out;
}

export function obstacleCount(tiles: string[]): number {
  let n = 0;
  for (const row of tiles) {
    for (const ch of row) {
      if ("shfvlkrq".includes(ch)) n++;
    }
  }
  return n;
}
