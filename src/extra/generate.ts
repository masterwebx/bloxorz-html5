import { H, occupied, Stage, W } from "./engine";
import type { LevelDef, SplitDef, SwitchDef } from "./types";
import { applyCmd, shortestLen, solveLevel } from "./solve";
import type { WalkCmd } from "./walkthrough";

export type Difficulty = "easy" | "medium" | "hard" | "insane";

export interface Puzzle {
  def: LevelDef;
  seed: string;
  difficulty: Difficulty;
  solutionLen: number;
  usedObstacles: number;
}

export interface QualityOpts {
  minMoves: number;
  minUsed: number;
  attempts: number;
  bfs: number;
}

const BAND: Record<Difficulty, { min: number; max: number; tiles: [number, number]; obstacles: [number, number] }> = {
  easy: { min: 5, max: 12, tiles: [18, 28], obstacles: [0, 2] },
  medium: { min: 12, max: 22, tiles: [26, 40], obstacles: [2, 8] },
  hard: { min: 18, max: 34, tiles: [32, 52], obstacles: [2, 12] },
  insane: { min: 26, max: 80, tiles: [36, 72], obstacles: [8, 28] },
};

export const QUALITY: Record<Difficulty, QualityOpts> = {
  easy: { minMoves: 8, minUsed: 2, attempts: 24, bfs: 80_000 },
  medium: { minMoves: 14, minUsed: 4, attempts: 32, bfs: 80_000 },
  hard: { minMoves: 20, minUsed: 6, attempts: 40, bfs: 100_000 },
  insane: { minMoves: 26, minUsed: 8, attempts: 48, bfs: 120_000 },
};

/** Gauntlet floors are ~10× the old casual QUALITY bands (8 / 14 / 20 / 26). */
export const GAUNTLET_QUALITY: Record<Difficulty, QualityOpts> = {
  easy: { minMoves: 40, minUsed: 12, attempts: 8, bfs: 120_000 },
  medium: { minMoves: 55, minUsed: 16, attempts: 8, bfs: 140_000 },
  hard: { minMoves: 70, minUsed: 20, attempts: 10, bfs: 160_000 },
  insane: { minMoves: 85, minUsed: 24, attempts: 10, bfs: 180_000 },
};

export const DAILY_OPTS: QualityOpts = { minMoves: 80, minUsed: 24, attempts: 12, bfs: 200_000 };
export const SEEDED_OPTS: QualityOpts = { minMoves: 28, minUsed: 10, attempts: 12, bfs: 140_000 };
export const GAUNTLET_LEN = 5;

const OBSTACLE_CH = "shfvlkrq";

export function filledCellCount(tiles: string[]): number {
  let n = 0;
  for (const row of tiles) {
    for (const ch of row) {
      if (ch !== " ") n++;
    }
  }
  return n;
}

export function countObstacles(tiles: string[]): number {
  let n = 0;
  for (const row of tiles) {
    for (const ch of row) {
      if (OBSTACLE_CH.includes(ch)) n++;
    }
  }
  return n;
}

function inObstacleBand(tiles: string[], difficulty: Difficulty): boolean {
  const n = countObstacles(tiles);
  const [lo, hi] = BAND[difficulty].obstacles;
  return n >= lo && n <= hi;
}

function markUsed(stage: Stage, tiles: string[], used: Set<string>): void {
  const cells = stage.split ? [stage.cubeA, stage.cubeB] : occupied(stage.block);
  for (const c of cells) {
    const ch = tiles[c.y]?.[c.x] ?? " ";
    if (OBSTACLE_CH.includes(ch)) used.add(`${c.x},${c.y}`);
  }
}

/** Unique obstacle cells the winning tape actually occupies. */
export function usedObstacleKeys(def: LevelDef, cmds: WalkCmd[]): string[] {
  const stage = new Stage(def);
  const used = new Set<string>();
  markUsed(stage, def.tiles, used);
  for (const cmd of cmds) {
    const result = applyCmd(stage, cmd);
    markUsed(stage, def.tiles, used);
    if (result === "fail" || result === "win") break;
  }
  return [...used];
}

export function usedObstacleCount(def: LevelDef, cmds: WalkCmd[]): number {
  return usedObstacleKeys(def, cmds).length;
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same UTC day → same seed for every player. */
export function dailySeed(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `daily:${y}-${m}-${d}`;
}

export function utcDateLabel(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function pick<T>(rng: () => number, list: T[]): T {
  return list[Math.floor(rng() * list.length)];
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function neighbors(x: number, y: number): [number, number][] {
  const out: [number, number][] = [];
  if (x > 0) out.push([x - 1, y]);
  if (x < W - 1) out.push([x + 1, y]);
  if (y > 0) out.push([x, y - 1]);
  if (y < H - 1) out.push([x, y + 1]);
  return out;
}

function blob(rng: () => number, count: number): Set<string> {
  const cells = new Set<string>();
  let x = 2 + Math.floor(rng() * (W - 4));
  let y = 2 + Math.floor(rng() * (H - 4));
  cells.add(key(x, y));
  let guard = 0;
  while (cells.size < count && guard++ < 8000) {
    const edge = [...cells].map((s) => s.split(",").map(Number) as [number, number]);
    const [cx, cy] = pick(rng, edge);
    const n = neighbors(cx, cy);
    const [nx, ny] = pick(rng, n);
    cells.add(key(nx, ny));
    x = nx;
    y = ny;
  }
  return cells;
}

function emptyGrid(): string[][] {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => " "));
}

function paint(grid: string[][], cells: Set<string>, ch = "b"): void {
  for (const s of cells) {
    const [x, y] = s.split(",").map(Number);
    if (grid[y][x] === " ") grid[y][x] = ch;
  }
}

function toTiles(grid: string[][]): string[] {
  return grid.map((row) => row.join(""));
}

function cellsList(cells: Set<string>): [number, number][] {
  return [...cells].map((s) => s.split(",").map(Number) as [number, number]);
}

function manhattan(a: [number, number], b: [number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function packDef(
  tiles: string[],
  spawn: [number, number],
  seed: string,
  switches: SwitchDef[] = [],
  splits: SplitDef[] = [],
): LevelDef {
  const n = hashSeed(seed) % 1000000;
  return {
    id: `pzl-${seed}`,
    code: String(n).padStart(6, "0"),
    tiles,
    spawn,
    switches,
    splits,
  };
}

function scorePuzzle(len: number, used: number, opts: QualityOpts): number {
  const meet = (len >= opts.minMoves ? 4000 : 0) + (used >= opts.minUsed ? 4000 : 0);
  return meet + len * 4 + used * 5;
}

function finishPuzzle(
  def: LevelDef,
  seed: string,
  difficulty: Difficulty,
  bfs: number,
): Puzzle | null {
  const solved = solveLevel(def, bfs);
  if (!solved.ok || !solved.cmds.length) return null;
  return {
    def,
    seed,
    difficulty,
    solutionLen: solved.cmds.length,
    usedObstacles: usedObstacleCount(def, solved.cmds),
  };
}

function tryPlain(rng: () => number, seed: string, difficulty: Difficulty, wantFragile: boolean): Puzzle | null {
  const band = BAND[difficulty];
  const count = band.tiles[0] + Math.floor(rng() * (band.tiles[1] - band.tiles[0] + 1));
  const cells = blob(rng, count);
  if (cells.size < 12) return null;
  const list = cellsList(cells);
  const spawn = pick(rng, list);
  let end = list[0];
  let best = -1;
  for (const c of list) {
    const d = manhattan(spawn, c);
    if (d > best) {
      best = d;
      end = c;
    }
  }
  if (best < 3) return null;
  const grid = emptyGrid();
  paint(grid, cells);
  if (wantFragile) {
    const extras = list.filter((c) => key(c[0], c[1]) !== key(spawn[0], spawn[1]) && key(c[0], c[1]) !== key(end[0], end[1]));
    const n = Math.min(3 + Math.floor(rng() * 4), Math.max(1, extras.length - 4));
    for (let i = 0; i < n; i++) {
      const c = pick(rng, extras);
      grid[c[1]][c[0]] = "f";
    }
  }
  grid[end[1]][end[0]] = "e";
  const tiles = toTiles(grid);
  if (!inObstacleBand(tiles, difficulty)) return null;
  const def = packDef(tiles, spawn, seed);
  const len = shortestLen(def, 80_000);
  if (len < band.min || len > band.max) return null;
  return { def, seed, difficulty, solutionLen: len, usedObstacles: 0 };
}

function tryBridges(rng: () => number, seed: string, difficulty: Difficulty): Puzzle | null {
  const a = blob(rng, 16 + Math.floor(rng() * 10));
  const b = blob(rng, 16 + Math.floor(rng() * 12));
  for (const s of a) b.delete(s);
  if (b.size < 10 || a.size < 10) return null;
  const listA = cellsList(a);
  const listB = cellsList(b);
  let pair: { a: [number, number]; b: [number, number] } | null = null;
  let best = 99;
  for (const ca of listA) {
    for (const cb of listB) {
      const d = manhattan(ca, cb);
      if (d >= 2 && d <= 3 && d < best) {
        best = d;
        pair = { a: ca, b: cb };
      }
    }
  }
  if (!pair) return null;
  const grid = emptyGrid();
  paint(grid, a);
  paint(grid, b);
  const bx = Math.round((pair.a[0] + pair.b[0]) / 2);
  const by = Math.round((pair.a[1] + pair.b[1]) / 2);
  grid[by][bx] = rng() < 0.5 ? "l" : "r";
  const sw = pick(rng, listA);
  grid[sw[1]][sw[0]] = "s";
  const spawn = pick(rng, listA);
  let end = listB[0];
  let bestD = -1;
  for (const c of listB) {
    const d = manhattan(spawn, c);
    if (d > bestD) {
      bestD = d;
      end = c;
    }
  }
  grid[end[1]][end[0]] = "e";
  const switches: SwitchDef[] = [{ x: sw[0], y: sw[1], bridges: [{ x: bx, y: by, mode: "onoff" }] }];
  const tiles = toTiles(grid);
  if (!inObstacleBand(tiles, difficulty)) return null;
  const def = packDef(tiles, spawn, seed, switches);
  const len = shortestLen(def, 120_000);
  const band = BAND[difficulty];
  if (len < Math.max(10, band.min - 4) || len > band.max + 8) return null;
  return { def, seed, difficulty, solutionLen: len, usedObstacles: usedObstacleCount(def, solveLevel(def, 120_000).cmds) };
}

function trySplit(rng: () => number, seed: string, difficulty: Difficulty): Puzzle | null {
  const a = blob(rng, 14 + Math.floor(rng() * 8));
  const b = blob(rng, 18 + Math.floor(rng() * 12));
  for (const s of a) b.delete(s);
  if (a.size < 8 || b.size < 12) return null;
  const listA = cellsList(a);
  const listB = cellsList(b);
  const spawn = pick(rng, listA);
  const pad = pick(
    rng,
    listA.filter((c) => manhattan(c, spawn) >= 1),
  );
  if (!pad) return null;
  const drop1 = pick(rng, listB);
  let drop2 = listB[0];
  let best = -1;
  for (const c of listB) {
    const d = manhattan(c, drop1);
    if (d > best) {
      best = d;
      drop2 = c;
    }
  }
  if (best < 2) return null;
  let end = listB[0];
  let far = -1;
  for (const c of listB) {
    const d = manhattan(c, drop1) + manhattan(c, drop2);
    if (d > far) {
      far = d;
      end = c;
    }
  }
  const grid = emptyGrid();
  paint(grid, a);
  paint(grid, b);
  grid[pad[1]][pad[0]] = "v";
  grid[end[1]][end[0]] = "e";
  const splits: SplitDef[] = [{ x: pad[0], y: pad[1], a: drop1, b: drop2 }];
  const tiles = toTiles(grid);
  if (!inObstacleBand(tiles, difficulty)) return null;
  const def = packDef(tiles, spawn, seed, [], splits);
  const len = shortestLen(def, 150_000);
  const band = BAND[difficulty];
  if (len < 8 || len > band.max + 10) return null;
  return { def, seed, difficulty, solutionLen: len, usedObstacles: usedObstacleCount(def, solveLevel(def, 150_000).cmds) };
}

function farthest(list: [number, number][], from: [number, number]): [number, number] {
  let best = list[0];
  let d = -1;
  for (const c of list) {
    const n = manhattan(from, c);
    if (n > d) {
      d = n;
      best = c;
    }
  }
  return best;
}

/**
 * Rectangular islands in a line, one off-bridge corridor between each pair.
 * Every switch and bridge sits on the only route to the exit.
 */
function trySlots(rng: () => number, seed: string, difficulty: Difficulty, nIslands: number, tall = false): Puzzle | null {
  const n = clamp(nIslands, 2, 5);
  const vertical = rng() < 0.22 && n <= 3;
  const iw = vertical ? 3 + Math.floor(rng() * 2) : n >= 5 ? 2 : 3;
  const ih = vertical ? 2 : tall ? 5 : 3 + Math.floor(rng() * 3);
  const gap = n >= 4 || iw >= 4 ? 1 : rng() < 0.4 ? 1 : 2;
  const total = vertical ? n * ih + (n - 1) * gap : n * iw + (n - 1) * gap;
  const limit = vertical ? H : W;
  if (total > limit) return null;
  const origin = Math.floor(rng() * (limit - total + 1));
  const shift = vertical
    ? 1 + Math.floor(rng() * Math.max(1, W - iw - 1))
    : 1 + Math.floor(rng() * Math.max(1, H - ih - 1));

  const grid = emptyGrid();
  const islands: [number, number][][] = [];
  for (let i = 0; i < n; i++) {
    const cells: [number, number][] = [];
    for (let a = 0; a < iw; a++) {
      for (let b = 0; b < ih; b++) {
        const x = vertical ? shift + a : origin + i * (iw + gap) + a;
        const y = vertical ? origin + i * (ih + gap) + b : shift + b;
        grid[y][x] = "b";
        cells.push([x, y]);
      }
    }
    islands.push(cells);
  }

  const switches: SwitchDef[] = [];
  const exits: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    const kind = rng() < 0.5 ? "l" : "r";
    const targets: SwitchDef["bridges"] = [];
    let mouth: [number, number];
    if (vertical) {
      const x = shift + Math.floor(rng() * iw);
      const y0 = origin + (i + 1) * ih + i * gap;
      for (let g = 0; g < gap; g++) {
        grid[y0 + g][x] = kind;
        targets.push({ x, y: y0 + g, mode: "on" });
      }
      mouth = [x, y0 - 1];
    } else {
      const y = shift + Math.floor(rng() * ih);
      const x0 = origin + (i + 1) * iw + i * gap;
      for (let g = 0; g < gap; g++) {
        grid[y][x0 + g] = kind;
        targets.push({ x: x0 + g, y, mode: "on" });
      }
      mouth = [x0 - 1, y];
    }
    exits.push(mouth);
    const sw = farthest(
      islands[i].filter((c) => grid[c[1]][c[0]] === "b"),
      mouth,
    );
    grid[sw[1]][sw[0]] = "s";
    switches.push({ x: sw[0], y: sw[1], bridges: targets });
  }

  const first = islands[0];
  const last = islands[n - 1];
  const spawnPool = first.filter((c) => grid[c[1]][c[0]] === "b");
  if (!spawnPool.length) return null;
  const spawn = farthest(spawnPool, exits[0] ?? last[0]);
  const endPool = last.filter((c) => grid[c[1]][c[0]] === "b");
  if (!endPool.length) return null;
  const end = farthest(endPool, exits[exits.length - 1] ?? spawn);
  if (spawn[0] === end[0] && spawn[1] === end[1]) return null;
  grid[end[1]][end[0]] = "e";

  const stone: [number, number][] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] === "b" && !(x === spawn[0] && y === spawn[1])) stone.push([x, y]);
    }
  }
  if (n >= 3 && iw >= 3 && ih >= 3 && rng() < 0.75) {
    const mid = islands[1];
    const cutPool = mid.filter((c) => grid[c[1]][c[0]] === "b");
    if (!cutPool.length) {
      /* skip the extra cut */
    } else {
    const cut = pick(rng, cutPool);
    const kind = rng() < 0.5 ? "l" : "r";
    const line: SwitchDef["bridges"] = [];
    if (vertical) {
      for (let x = 0; x < iw; x++) {
        const cx = shift + x;
        const ch = grid[cut[1]][cx];
        if (ch === "e" || ch === "s" || ch === "h" || ch === "v") continue;
        grid[cut[1]][cx] = kind;
        line.push({ x: cx, y: cut[1], mode: "on" });
      }
    } else {
      for (let y = 0; y < ih; y++) {
        const cy = shift + y;
        const ch = grid[cy][cut[0]];
        if (ch === "e" || ch === "s" || ch === "h" || ch === "v") continue;
        grid[cy][cut[0]] = kind;
        line.push({ x: cut[0], y: cy, mode: "on" });
      }
    }
    if (line.length) {
      const sw = pick(rng, first.filter((c) => grid[c[1]][c[0]] === "b" || grid[c[1]][c[0]] === "s"));
      if (grid[sw[1]][sw[0]] === "b") grid[sw[1]][sw[0]] = "s";
      switches.push({ x: sw[0], y: sw[1], bridges: line });
    }
    }
  }

  const wantFrag = Math.min(stone.length, n >= 4 ? 4 + Math.floor(rng() * 3) : 2 + Math.floor(rng() * 3));
  for (let i = 0; i < wantFrag; i++) {
    const c = pick(rng, stone);
    if (grid[c[1]][c[0]] === "b") grid[c[1]][c[0]] = "f";
  }

  const splits: SplitDef[] = [];
  if (n >= 3 && last.length >= 6 && (tall || rng() < 0.7)) {
    const padPool = last.filter((c) => grid[c[1]][c[0]] === "b" || grid[c[1]][c[0]] === "f");
    if (padPool.length >= 3) {
      const pad = pick(rng, padPool);
      const drops = last.filter((c) => manhattan(c, pad) >= 2 && !(c[0] === end[0] && c[1] === end[1]));
      if (drops.length >= 2) {
        const a = pick(rng, drops);
        const b = farthest(drops, a);
        grid[pad[1]][pad[0]] = "v";
        splits.push({ x: pad[0], y: pad[1], a, b });
      }
    }
  }

  const tiles = toTiles(grid);
  const def = packDef(tiles, spawn, seed, switches, splits);
  return finishPuzzle(def, seed, difficulty, 140_000);
}

function snakePath(rng: () => number, want: number): [number, number][] {
  let x = 1 + Math.floor(rng() * 3);
  let y = 1 + Math.floor(rng() * (H - 2));
  const path: [number, number][] = [[x, y]];
  const used = new Set([key(x, y)]);
  let guard = 0;
  while (path.length < want && guard++ < 8000) {
    const opts = neighbors(x, y).filter(([nx, ny]) => {
      if (nx < 1 || ny < 1 || nx > W - 2 || ny > H - 2) return false;
      return !used.has(key(nx, ny));
    });
    if (!opts.length) break;
    opts.sort((a, b) => {
      const openA = neighbors(a[0], a[1]).filter(([nx, ny]) => !used.has(key(nx, ny))).length;
      const openB = neighbors(b[0], b[1]).filter(([nx, ny]) => !used.has(key(nx, ny))).length;
      return openB - openA;
    });
    const pickI = rng() < 0.7 ? 0 : Math.floor(rng() * opts.length);
    const [nx, ny] = opts[pickI];
    path.push([nx, ny]);
    used.add(key(nx, ny));
    x = nx;
    y = ny;
  }
  return path;
}

/**
 * Eight rooms packed into the full 15×10 board, snake-linked by off bridges.
 * Empty cells only sit in the unused gaps so the stage uses almost every tile.
 */
function tryPacked(rng: () => number, seed: string, difficulty: Difficulty): Puzzle | null {
  const cols = 4;
  const iw = 3;
  const gap = 1;
  const ih0 = 4 + Math.floor(rng() * 2);
  const ih1 = H - gap - ih0;
  if (ih1 < 3) return null;
  const heights = [ih0, ih1];
  const grid = emptyGrid();
  const rooms: [number, number][][][] = [[], []];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      const cells: [number, number][] = [];
      const x0 = c * (iw + gap);
      const y0 = r === 0 ? 0 : heights[0] + gap;
      for (let a = 0; a < iw; a++) {
        for (let b = 0; b < heights[r]; b++) {
          grid[y0 + b][x0 + a] = "b";
          cells.push([x0 + a, y0 + b]);
        }
      }
      rooms[r][c] = cells;
    }
  }

  const path: [number, number][] =
    rng() < 0.5
      ? [
          [0, 0],
          [0, 1],
          [0, 2],
          [0, 3],
          [1, 3],
          [1, 2],
          [1, 1],
          [1, 0],
        ]
      : [
          [0, 0],
          [1, 0],
          [1, 1],
          [1, 2],
          [1, 3],
          [0, 3],
          [0, 2],
          [0, 1],
        ];

  const switches: SwitchDef[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [r1, c1] = path[i];
    const [r2, c2] = path[i + 1];
    const kind = rng() < 0.5 ? "l" : "r";
    const targets: SwitchDef["bridges"] = [];
    if (r1 === r2) {
      const left = Math.min(c1, c2);
      const x0 = left * (iw + gap) + iw;
      const yBase = r1 === 0 ? 0 : heights[0] + gap;
      const y = yBase + Math.floor(rng() * heights[r1]);
      for (let g = 0; g < gap; g++) {
        grid[y][x0 + g] = kind;
        targets.push({ x: x0 + g, y, mode: "on" });
      }
    } else {
      const x0 = c1 * (iw + gap) + Math.floor(rng() * iw);
      const y0 = heights[0];
      for (let g = 0; g < gap; g++) {
        grid[y0 + g][x0] = kind;
        targets.push({ x: x0, y: y0 + g, mode: "on" });
      }
    }
    if (!targets.length) return null;
    const swPool = rooms[r1][c1].filter((c) => grid[c[1]][c[0]] === "b");
    if (!swPool.length) return null;
    const sw = farthest(swPool, [targets[0].x, targets[0].y]);
    grid[sw[1]][sw[0]] = "s";
    switches.push({ x: sw[0], y: sw[1], bridges: targets });
  }

  const first = rooms[path[0][0]][path[0][1]];
  const last = rooms[path[path.length - 1][0]][path[path.length - 1][1]];
  const spawnPool = first.filter((c) => grid[c[1]][c[0]] === "b");
  const endPool = last.filter((c) => grid[c[1]][c[0]] === "b");
  if (!spawnPool.length || !endPool.length) return null;
  const spawn = farthest(spawnPool, [switches[0].x, switches[0].y]);
  const end = farthest(endPool, spawn);
  if (spawn[0] === end[0] && spawn[1] === end[1]) return null;
  grid[end[1]][end[0]] = "e";

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] === "b" && rng() < 0.22 && !(x === spawn[0] && y === spawn[1])) grid[y][x] = "f";
    }
  }

  const splits: SplitDef[] = [];
  const padPool = last.filter((c) => grid[c[1]][c[0]] === "b" || grid[c[1]][c[0]] === "f");
  if (padPool.length >= 4) {
    const pad = pick(rng, padPool);
    const drops = last.filter((c) => manhattan(c, pad) >= 2 && !(c[0] === end[0] && c[1] === end[1]));
    if (drops.length >= 2) {
      const a = pick(rng, drops);
      const b = farthest(drops, a);
      grid[pad[1]][pad[0]] = "v";
      splits.push({ x: pad[0], y: pad[1], a, b });
    }
  }

  const def = packDef(toTiles(grid), spawn, seed, switches, splits);
  return finishPuzzle(def, seed, difficulty, 200_000);
}

/**
 * Every cell of the 15×10 board is a tile. Six 5×5 rooms snake through
 * gated off-bridges so Daily / gauntlet can use the whole stage.
 */
function tryFullBoard(rng: () => number, seed: string, difficulty: Difficulty): Puzzle | null {
  const rw = 5;
  const rh = 5;
  const grid = emptyGrid();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) grid[y][x] = "b";
  }

  const snake: [number, number][] =
    rng() < 0.5
      ? [
          [0, 0],
          [0, 1],
          [0, 2],
          [1, 2],
          [1, 1],
          [1, 0],
        ]
      : [
          [0, 0],
          [1, 0],
          [1, 1],
          [1, 2],
          [0, 2],
          [0, 1],
        ];

  const room = (r: number, c: number): [number, number][] => {
    const cells: [number, number][] = [];
    const x0 = c * rw;
    const y0 = r * rh;
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) cells.push([x0 + x, y0 + y]);
    }
    return cells;
  };

  const switches: SwitchDef[] = [];
  for (let i = 0; i < snake.length - 1; i++) {
    const [r1, c1] = snake[i];
    const [r2, c2] = snake[i + 1];
    const kind = rng() < 0.5 ? "l" : "r";
    const targets: SwitchDef["bridges"] = [];
    if (r1 === r2) {
      const left = Math.min(c1, c2);
      const xGate = (left + 1) * rw;
      const y0 = r1 * rh;
      for (let k = 0; k < rh; k++) {
        grid[y0 + k][xGate] = kind;
        targets.push({ x: xGate, y: y0 + k, mode: "on" });
      }
    } else {
      const top = Math.min(r1, r2);
      const yGate = (top + 1) * rh;
      const x0 = c1 * rw;
      for (let k = 0; k < rw; k++) {
        grid[yGate][x0 + k] = kind;
        targets.push({ x: x0 + k, y: yGate, mode: "on" });
      }
    }
    if (!targets.length) return null;
    const swPool = room(r1, c1).filter((c) => grid[c[1]][c[0]] === "b");
    if (!swPool.length) return null;
    const sw = farthest(swPool, [targets[0].x, targets[0].y]);
    grid[sw[1]][sw[0]] = "s";
    switches.push({ x: sw[0], y: sw[1], bridges: targets });
  }

  const first = room(snake[0][0], snake[0][1]);
  const last = room(snake[snake.length - 1][0], snake[snake.length - 1][1]);
  const spawnPool = first.filter((c) => grid[c[1]][c[0]] === "b");
  const endPool = last.filter((c) => grid[c[1]][c[0]] === "b");
  if (!spawnPool.length || !endPool.length || !switches.length) return null;
  const spawn = farthest(spawnPool, [switches[0].x, switches[0].y]);
  const end = farthest(endPool, spawn);
  if (spawn[0] === end[0] && spawn[1] === end[1]) return null;
  grid[end[1]][end[0]] = "e";

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] === "b" && rng() < 0.12 && !(x === spawn[0] && y === spawn[1])) grid[y][x] = "f";
    }
  }

  const splits: SplitDef[] = [];
  const padPool = last.filter((c) => grid[c[1]][c[0]] === "b" || grid[c[1]][c[0]] === "f");
  if (padPool.length >= 4) {
    const pad = pick(rng, padPool);
    const drops = last.filter((c) => manhattan(c, pad) >= 2 && !(c[0] === end[0] && c[1] === end[1]));
    if (drops.length >= 2) {
      const a = pick(rng, drops);
      const b = farthest(drops, a);
      grid[pad[1]][pad[0]] = "v";
      splits.push({ x: pad[0], y: pad[1], a, b });
    }
  }

  return finishPuzzle(packDef(toTiles(grid), spawn, seed, switches, splits), seed, difficulty, 200_000);
}

export function generateFullBoard(seed: string): Puzzle {
  const rng = mulberry32(hashSeed(`full:${seed}`));
  return tryFullBoard(rng, seed, "insane") ?? generatePuzzle(seed, "easy");
}

/** Two-wide winding corridor with forced bridge cuts. */
function tryRibbon(rng: () => number, seed: string, difficulty: Difficulty): Puzzle | null {
  const line = snakePath(rng, 30 + Math.floor(rng() * 16));
  if (line.length < 24) return null;
  const cells = new Set<string>();
  for (let i = 0; i < line.length; i++) {
    const [x, y] = line[i];
    cells.add(key(x, y));
    const prev = line[Math.max(0, i - 1)];
    const dx = x - prev[0];
    const dy = y - prev[1];
    const px = dy !== 0 ? 1 : 0;
    const py = dx !== 0 ? 1 : 0;
    const nx = x + px;
    const ny = y + py;
    if (nx >= 1 && ny >= 1 && nx <= W - 2 && ny <= H - 2) cells.add(key(nx, ny));
  }
  const grid = emptyGrid();
  paint(grid, cells);
  const switches: SwitchDef[] = [];
  const cuts = 3 + Math.floor(rng() * 3);
  for (let c = 0; c < cuts; c++) {
    const t = Math.floor(((c + 1) / (cuts + 1)) * (line.length - 8)) + 4;
    const [bx, by] = line[t];
    if (grid[by][bx] !== "b") continue;
    const kind = rng() < 0.5 ? "l" : "r";
    grid[by][bx] = kind;
    const swAt = line[Math.max(1, t - 3 - Math.floor(rng() * 2))];
    if (grid[swAt[1]][swAt[0]] !== "b") continue;
    grid[swAt[1]][swAt[0]] = "s";
    switches.push({ x: swAt[0], y: swAt[1], bridges: [{ x: bx, y: by, mode: "on" }] });
  }
  if (switches.length < 2) return null;
  const spawn = line[0];
  const end = line[line.length - 1];
  if (grid[spawn[1]][spawn[0]] !== "b") return null;
  grid[end[1]][end[0]] = "e";
  for (const [x, y] of line) {
    if (grid[y][x] === "b" && rng() < 0.12 && !(x === spawn[0] && y === spawn[1])) grid[y][x] = "f";
  }
  const tiles = toTiles(grid);
  const def = packDef(tiles, spawn, seed, switches);
  return finishPuzzle(def, seed, difficulty, 140_000);
}

export function generateQualityPuzzle(seed: string, opts: QualityOpts, difficulty: Difficulty = "insane"): Puzzle {
  const rng = mulberry32(hashSeed(`q:${seed}:${opts.minMoves}:${opts.minUsed}`));
  let best: Puzzle | null = null;
  let bestScore = -1;
  for (let i = 0; i < opts.attempts; i++) {
    const roll = rng();
    let p: Puzzle | null = null;
    const tall = opts.minMoves >= 26;
    const islands = opts.minMoves >= 30 ? (roll < 0.55 ? 5 : 4) : roll < 0.22 ? 5 : roll < 0.5 ? 4 : 3;
    if (opts.minMoves >= 50 && roll < 0.8) p = tryFullBoard(rng, `${seed}:${i}`, difficulty);
    else if (opts.minMoves >= 40 && roll < 0.78) p = tryPacked(rng, `${seed}:${i}`, difficulty);
    else if (roll < 0.82) p = trySlots(rng, `${seed}:${i}`, difficulty, islands, tall);
    else if (roll < 0.92) p = tryRibbon(rng, `${seed}:${i}`, difficulty);
    else if (roll < 0.97) p = tryBridges(rng, `${seed}:${i}`, difficulty);
    else p = trySplit(rng, `${seed}:${i}`, difficulty);
    if (!p) continue;
    const used = p.usedObstacles;
    const sc = scorePuzzle(p.solutionLen, used, opts);
    if (sc > bestScore) {
      best = p;
      bestScore = sc;
    }
    if (p.solutionLen >= opts.minMoves && used >= opts.minUsed) return p;
  }
  if (best) return best;
  const fallback = tryPlain(mulberry32(hashSeed(seed + ":qfb")), `${seed}:qfb`, "easy", false);
  if (fallback) return { ...fallback, seed, difficulty };
  const grid = emptyGrid();
  for (let x = 2; x <= 8; x++) grid[4][x] = "b";
  grid[4][8] = "e";
  return {
    def: packDef(toTiles(grid), [2, 4], seed),
    seed,
    difficulty,
    solutionLen: 4,
    usedObstacles: 0,
  };
}

export function generatePuzzle(seed: string, difficulty: Difficulty): Puzzle {
  if (difficulty !== "easy") {
    return generateQualityPuzzle(`${seed}:${difficulty}`, QUALITY[difficulty], difficulty);
  }
  const rng = mulberry32(hashSeed(`${seed}:${difficulty}`));
  for (let i = 0; i < 80; i++) {
    const roll = rng();
    let p: Puzzle | null = null;
    if (roll < 0.25) p = tryBridges(rng, `${seed}:${i}`, difficulty);
    else p = tryPlain(rng, `${seed}:${i}`, difficulty, false);
    if (p) return p;
  }
  const fallback = tryPlain(mulberry32(hashSeed(seed + ":fb")), `${seed}:fb`, "easy", false);
  if (fallback) return { ...fallback, seed, difficulty };
  const grid = emptyGrid();
  for (let x = 2; x <= 8; x++) grid[4][x] = "b";
  grid[4][8] = "e";
  return {
    def: packDef(toTiles(grid), [2, 4], seed),
    seed,
    difficulty,
    solutionLen: 4,
    usedObstacles: 0,
  };
}

export function generateDaily(date: Date): Puzzle {
  const seed = dailySeed(date);
  const rng = mulberry32(hashSeed(`daily-full:${seed}`));
  let best: Puzzle | null = null;
  let bestScore = -1;
  for (let i = 0; i < 8; i++) {
    const p = tryFullBoard(rng, `${seed}:${i}`, "insane");
    if (!p) continue;
    const sc = scorePuzzle(p.solutionLen, p.usedObstacles, DAILY_OPTS);
    if (sc > bestScore) {
      best = p;
      bestScore = sc;
    }
    if (p.solutionLen >= 50 && p.usedObstacles >= 16) return { ...p, seed };
  }
  if (best) return { ...best, seed };
  return generateQualityPuzzle(seed, DAILY_OPTS, "insane");
}

export function generateSeeded(seed: string): Puzzle {
  const clean = seed.trim() || "BLOX";
  return generateQualityPuzzle(clean, SEEDED_OPTS, "insane");
}

export function generateRun(seed: string, difficulty: Difficulty, count: number): Puzzle[] {
  const n = Math.max(1, Math.min(15, count));
  const opts = GAUNTLET_QUALITY[difficulty];
  return Array.from({ length: n }, (_, i) => {
    const tag = `${seed}#${i}`;
    const rng = mulberry32(hashSeed(`gfull:${difficulty}:${tag}`));
    const full = tryFullBoard(rng, tag, difficulty);
    if (full && full.solutionLen >= Math.min(28, opts.minMoves)) return full;
    const packed = tryPacked(rng, `${tag}:p`, difficulty);
    if (packed) return packed;
    return generateQualityPuzzle(tag, opts, difficulty);
  });
}

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "insane"];

export function difficultyLabel(d: Difficulty): string {
  return d[0].toUpperCase() + d.slice(1);
}

export function difficultyHint(d: Difficulty): string {
  const q = GAUNTLET_QUALITY[d];
  return `${q.minMoves}+ moves · ${q.minUsed}+ used obstacles`;
}

export function difficultyBand(d: Difficulty): (typeof BAND)[Difficulty] {
  return BAND[d];
}
