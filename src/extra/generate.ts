import { H, LEVELS, occupied, Stage, W } from "./engine";
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
  minRequired: number;
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
  easy: { minMoves: 8, minUsed: 2, minRequired: 0, attempts: 24, bfs: 80_000 },
  medium: { minMoves: 14, minUsed: 4, minRequired: 1, attempts: 32, bfs: 80_000 },
  hard: { minMoves: 20, minUsed: 6, minRequired: 2, attempts: 40, bfs: 100_000 },
  insane: { minMoves: 26, minUsed: 8, minRequired: 3, attempts: 48, bfs: 120_000 },
};

/** Gauntlet floors: required switches first. Move count is a floor, not the puzzle. */
export const GAUNTLET_QUALITY: Record<Difficulty, QualityOpts> = {
  easy: { minMoves: 40, minUsed: 6, minRequired: 1, attempts: 8, bfs: 160_000 },
  medium: { minMoves: 55, minUsed: 8, minRequired: 2, attempts: 8, bfs: 180_000 },
  hard: { minMoves: 70, minUsed: 10, minRequired: 2, attempts: 8, bfs: 200_000 },
  insane: { minMoves: 90, minUsed: 12, minRequired: 3, attempts: 8, bfs: 220_000 },
};

export const DAILY_OPTS: QualityOpts = { minMoves: 70, minUsed: 10, minRequired: 2, attempts: 6, bfs: 220_000 };
export const SEEDED_OPTS: QualityOpts = { minMoves: 55, minUsed: 8, minRequired: 2, attempts: 8, bfs: 180_000 };

/** Campaign slices that actually play like Bloxorz, not island chains. */
const DONOR: Record<"mid" | "late" | "end", [number, number]> = {
  mid: [9, 16],
  late: [19, 27],
  end: [28, 32],
};
export const GAUNTLET_LEN = 5;
export const GAUNTLET_COUNTS = [5, 10, 15, 33] as const;
export type GauntletCount = (typeof GAUNTLET_COUNTS)[number];
export const HARD_BFS = 80_000;

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

export function unusedSwitches(def: LevelDef, cmds: WalkCmd[]): SwitchDef[] {
  const used = new Set(usedObstacleKeys(def, cmds));
  return (def.switches ?? []).filter((sw) => !used.has(`${sw.x},${sw.y}`));
}

function clonePuzzleDef(def: LevelDef): LevelDef {
  return {
    ...def,
    tiles: def.tiles.map((row) => row),
    spawn: [def.spawn[0], def.spawn[1]],
    switches: (def.switches ?? []).map((sw) => ({
      x: sw.x,
      y: sw.y,
      bridges: sw.bridges.map((b) => ({ ...b })),
    })),
    splits: (def.splits ?? []).map((s) => ({ x: s.x, y: s.y, a: [s.a[0], s.a[1]] as [number, number], b: [s.b[0], s.b[1]] as [number, number] })),
  };
}

export function withoutSwitch(def: LevelDef, sw: SwitchDef): LevelDef {
  const next = clonePuzzleDef(def);
  next.switches = (next.switches ?? []).filter((s) => s.x !== sw.x || s.y !== sw.y);
  const row = (next.tiles[sw.y] ?? "").split("");
  if (row[sw.x] === "s" || row[sw.x] === "h") row[sw.x] = "b";
  next.tiles[sw.y] = row.join("").padEnd(W, " ").slice(0, W);
  return next;
}

/** Turn switches the winning tape never stands on back into stone. */
export function pruneUnusedSwitches(def: LevelDef, cmds: WalkCmd[]): LevelDef {
  const unused = unusedSwitches(def, cmds);
  if (!unused.length) return def;
  let next = def;
  for (const sw of unused) next = withoutSwitch(next, sw);
  return next;
}

/** Drop switches the solver can ignore — standing on one is not the same as needing it. */
export function pruneOptionalSwitches(def: LevelDef, bfs: number): LevelDef {
  let cur = def;
  for (let guard = 0; guard < 12; guard++) {
    const switches = cur.switches ?? [];
    if (!switches.length) break;
    let dropped = false;
    for (const sw of switches) {
      const trial = withoutSwitch(cur, sw);
      if (solveLevel(trial, bfs).ok) {
        cur = trial;
        dropped = true;
        break;
      }
    }
    if (!dropped) break;
  }
  return cur;
}

export function tightenPuzzle(p: Puzzle, bfs: number): Puzzle {
  const first = solveLevel(p.def, bfs);
  if (!first.ok || !first.cmds.length) return p;
  let def = pruneUnusedSwitches(p.def, first.cmds);
  def = pruneOptionalSwitches(def, bfs);
  const again = solveLevel(def, bfs);
  if (!again.ok || !again.cmds.length) return { ...p, def: pruneUnusedSwitches(p.def, first.cmds) };
  return {
    ...p,
    def,
    solutionLen: again.cmds.length,
    usedObstacles: usedObstacleCount(def, again.cmds),
  };
}

/** Stone the switches and drop their defs. Off bridges stay off. */
export function stripAllSwitches(def: LevelDef): LevelDef {
  let next = clonePuzzleDef(def);
  for (const sw of [...(next.switches ?? [])]) next = withoutSwitch(next, sw);
  next.switches = [];
  return next;
}

/** True when the map is solvable, and the exit is unreachable if every switch is ignored. */
export function isSwitchGated(def: LevelDef, bfs: number): boolean {
  if (!(def.switches ?? []).length) return false;
  if (!solveLevel(def, bfs).ok) return false;
  return !solveLevel(stripAllSwitches(def), bfs).ok;
}

export function requiredSwitches(def: LevelDef, bfs: number, knownSolvable = false): SwitchDef[] {
  if (!knownSolvable && !solveLevel(def, bfs).ok) return [];
  return (def.switches ?? []).filter((sw) => !solveLevel(withoutSwitch(def, sw), bfs).ok);
}

export interface PuzzleAssess {
  solvable: boolean;
  solutionLen: number;
  switchCount: number;
  requiredCount: number;
  gated: boolean;
}

export function assessPuzzle(def: LevelDef, bfs: number): PuzzleAssess {
  const solved = solveLevel(def, bfs);
  const switchCount = (def.switches ?? []).length;
  if (!solved.ok || !solved.cmds.length) {
    return { solvable: false, solutionLen: 0, switchCount, requiredCount: 0, gated: false };
  }
  const gated = isSwitchGated(def, bfs);
  const requiredCount = gated ? requiredSwitches(def, bfs, true).length : 0;
  return {
    solvable: true,
    solutionLen: solved.cmds.length,
    switchCount,
    requiredCount,
    gated,
  };
}

export function meetsHardness(assess: PuzzleAssess, opts: Pick<QualityOpts, "minMoves" | "minRequired">): boolean {
  return assess.solvable && assess.gated && assess.requiredCount >= opts.minRequired && assess.solutionLen >= opts.minMoves;
}

/** Every switch on the board is a real gate — no decorative pads, no walk-around. */
export function meetsSwitchGate(assess: PuzzleAssess, minRequired: number): boolean {
  return (
    assess.solvable &&
    assess.gated &&
    assess.requiredCount >= minRequired &&
    assess.requiredCount === assess.switchCount
  );
}

export function isStrictHard(assess: PuzzleAssess, opts: Pick<QualityOpts, "minMoves" | "minRequired">): boolean {
  return meetsSwitchGate(assess, opts.minRequired) && assess.solutionLen >= opts.minMoves;
}

export function sharedBridgeCount(def: LevelDef): number {
  const hits = new Map<string, number>();
  for (const sw of def.switches ?? []) {
    for (const b of sw.bridges) {
      const k = `${b.x},${b.y}`;
      hits.set(k, (hits.get(k) ?? 0) + 1);
    }
  }
  return [...hits.values()].filter((n) => n >= 2).length;
}

export function hasStartingOnBridges(def: LevelDef): boolean {
  return def.tiles.some((row) => [...row].some((ch) => ch === "k" || ch === "q"));
}

export function hasOffOrToggle(def: LevelDef): boolean {
  return (def.switches ?? []).some((sw) => sw.bridges.some((b) => b.mode === "off" || b.mode === "onoff"));
}

/** Late campaign feel: shared gates, bridges that start ON, or off/toggle modes — not a line of ON pads. */
export function isLateCampaignShape(def: LevelDef): boolean {
  const fragile = countObstacles(def.tiles);
  return (
    sharedBridgeCount(def) >= 1 ||
    hasStartingOnBridges(def) ||
    hasOffOrToggle(def) ||
    (def.splits ?? []).length > 0 ||
    fragile >= 12
  );
}

export function flipLevel(def: LevelDef, fx: boolean, fy: boolean): LevelDef {
  const src = def.tiles.map((row) => row.padEnd(W, " ").slice(0, W));
  const out = Array.from({ length: H }, () => Array.from({ length: W }, () => " "));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = fx ? W - 1 - x : x;
      const ny = fy ? H - 1 - y : y;
      out[ny][nx] = src[y]?.[x] ?? " ";
    }
  }
  const mx = (x: number) => (fx ? W - 1 - x : x);
  const my = (y: number) => (fy ? H - 1 - y : y);
  return {
    ...def,
    tiles: out.map((row) => row.join("")),
    spawn: [mx(def.spawn[0]), my(def.spawn[1])],
    switches: (def.switches ?? []).map((sw) => ({
      x: mx(sw.x),
      y: my(sw.y),
      bridges: sw.bridges.map((b) => ({ ...b, x: mx(b.x), y: my(b.y) })),
    })),
    splits: (def.splits ?? []).map((s) => ({
      x: mx(s.x),
      y: my(s.y),
      a: [mx(s.a[0]), my(s.a[1])],
      b: [mx(s.b[0]), my(s.b[1])],
    })),
  };
}

export function remixCampaign(seed: string, band: "mid" | "late" | "end", difficulty: Difficulty): Puzzle {
  const [lo, hi] = DONOR[band];
  const rng = mulberry32(hashSeed(`remix:${seed}:${band}`));
  const src = LEVELS[lo + Math.floor(rng() * (hi - lo + 1))] ?? LEVELS[29]!;
  const def = flipLevel(src, rng() < 0.5, rng() < 0.5);
  const packed = packDef(def.tiles, def.spawn, seed, def.switches, def.splits);
  const solved = solveLevel(packed, 220_000);
  return {
    def: packed,
    seed,
    difficulty,
    solutionLen: solved.ok ? solved.cmds.length : 80,
    usedObstacles: solved.ok ? usedObstacleCount(packed, solved.cmds) : countObstacles(packed.tiles),
  };
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

function scorePuzzle(len: number, used: number, opts: QualityOpts, required = 0, gated = false): number {
  const meet = (len >= opts.minMoves ? 4000 : 0) + (used >= opts.minUsed ? 2000 : 0) + (required >= opts.minRequired ? 5000 : 0);
  return meet + (gated ? 8000 : 0) + required * 900 + len * 4 + used * 3;
}

function finishPuzzle(
  def: LevelDef,
  seed: string,
  difficulty: Difficulty,
  bfs: number,
): Puzzle | null {
  const solved = solveLevel(def, bfs);
  if (!solved.ok || !solved.cmds.length) return null;
  const pruned = pruneUnusedSwitches(def, solved.cmds);
  return {
    def: pruned,
    seed,
    difficulty,
    solutionLen: solved.cmds.length,
    usedObstacles: usedObstacleCount(pruned, solved.cmds),
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

type RoomEdge = {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
  cells: [number, number][];
};

function fullBoardEdges(): RoomEdge[] {
  const rw = 5;
  const rh = 5;
  const edges: RoomEdge[] = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const xGate = (c + 1) * rw;
      const y0 = r * rh;
      const cells: [number, number][] = [];
      for (let k = 0; k < rh; k++) cells.push([xGate, y0 + k]);
      edges.push({ r1: r, c1: c, r2: r, c2: c + 1, cells });
    }
  }
  for (let c = 0; c < 3; c++) {
    const yGate = rh;
    const x0 = c * rw;
    const cells: [number, number][] = [];
    for (let k = 0; k < rw; k++) cells.push([x0 + k, yGate]);
    edges.push({ r1: 0, c1: c, r2: 1, c2: c, cells });
  }
  return edges;
}

function edgeForRooms(edges: RoomEdge[], a: [number, number], b: [number, number]): RoomEdge | undefined {
  return edges.find(
    (e) =>
      (e.r1 === a[0] && e.c1 === a[1] && e.r2 === b[0] && e.c2 === b[1]) ||
      (e.r1 === b[0] && e.c1 === b[1] && e.r2 === a[0] && e.c2 === a[1]),
  );
}

/**
 * Six 5×5 rooms. Unused walls stay empty so you cannot walk around the gates.
 */
function tryFullBoard(rng: () => number, seed: string, difficulty: Difficulty): Puzzle | null {
  const rw = 5;
  const rh = 5;
  const grid = emptyGrid();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) grid[y][x] = "b";
  }

  const edges = fullBoardEdges();
  for (const edge of edges) {
    for (const [x, y] of edge.cells) grid[y][x] = " ";
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
      for (let x = 0; x < rw; x++) {
        const ch = grid[y0 + y][x0 + x];
        if (ch === "b" || ch === "f" || ch === "s") cells.push([x0 + x, y0 + y]);
      }
    }
    return cells;
  };

  const switches: SwitchDef[] = [];
  for (let i = 0; i < snake.length - 1; i++) {
    const a = snake[i];
    const b = snake[i + 1];
    const edge = edgeForRooms(edges, a, b);
    if (!edge) return null;
    const kind = rng() < 0.5 ? "l" : "r";
    const targets: SwitchDef["bridges"] = [];
    for (const [x, y] of edge.cells) {
      grid[y][x] = kind;
      targets.push({ x, y, mode: "on" });
    }
    if (!targets.length) return null;
    const swPool = room(a[0], a[1]).filter((c) => grid[c[1]][c[0]] === "b");
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
      if (grid[y][x] === "b" && rng() < 0.05 && !(x === spawn[0] && y === spawn[1])) grid[y][x] = "f";
    }
  }

  return finishPuzzle(packDef(toTiles(grid), spawn, seed, switches, []), seed, difficulty, 200_000);
}

/**
 * Rectangular islands in a line. Each gap is a single OFF bridge — the only crossing.
 * Used as the hardness safety net so daily / gauntlet never emit a walk-around map.
 */
export function forcedGatePuzzle(seed: string, gates: number, difficulty: Difficulty = "insane"): Puzzle {
  const nGates = clamp(gates, 1, 4);
  const n = nGates >= 4 ? 4 : nGates + 1;
  const iw = 3;
  const ih = 4;
  const gap = 1;
  const grid = emptyGrid();
  const switches: SwitchDef[] = [];
  const y0 = 3;
  for (let i = 0; i < n; i++) {
    const x0 = i * (iw + gap);
    for (let y = 0; y < ih; y++) {
      for (let x = 0; x < iw; x++) {
        if (x0 + x < W && y0 + y < H) grid[y0 + y][x0 + x] = "b";
      }
    }
    if (i < n - 1) {
      const bx = x0 + iw;
      const by = y0 + 1;
      if (bx < W) grid[by][bx] = "l";
      const sx = x0;
      const sy = y0;
      grid[sy][sx] = "s";
      switches.push({ x: sx, y: sy, bridges: [{ x: bx, y: by, mode: "on" }] });
    }
  }
  if (nGates >= 4 && n >= 3) {
    const cutX = iw + gap + 1;
    const line: SwitchDef["bridges"] = [];
    for (let y = 0; y < ih; y++) {
      const cy = y0 + y;
      const ch = grid[cy][cutX];
      if (ch === "e" || ch === "s") continue;
      grid[cy][cutX] = "r";
      line.push({ x: cutX, y: cy, mode: "on" });
    }
    if (line.length) {
      const sx = 2;
      const sy = y0 + ih - 1;
      if (grid[sy][sx] === "b") grid[sy][sx] = "s";
      switches.push({ x: sx, y: sy, bridges: line });
    }
  }
  const spawn: [number, number] = [1, y0 + 2];
  const endX = Math.min(W - 1, (n - 1) * (iw + gap) + iw - 1);
  const endY = y0 + ih - 1;
  grid[endY][endX] = "e";
  if (grid[spawn[1]][spawn[0]] !== "b" && grid[spawn[1]][spawn[0]] !== "s") {
    grid[spawn[1]][0] = "b";
  }
  const def = packDef(toTiles(grid), spawn, seed, switches);
  return finishPuzzle(def, seed, difficulty, 120_000) ?? {
    def,
    seed,
    difficulty,
    solutionLen: 0,
    usedObstacles: 0,
  };
}

function forceHardPuzzle(seed: string, opts: QualityOpts, difficulty: Difficulty): Puzzle {
  for (let gates = Math.max(opts.minRequired, 2); gates <= 4; gates++) {
    const raw = forcedGatePuzzle(`${seed}:force:${gates}`, gates, difficulty);
    const p = tightenPuzzle(raw, Math.min(opts.bfs, 120_000));
    const assess = assessPuzzle(p.def, HARD_BFS);
    if (meetsSwitchGate(assess, opts.minRequired)) return p;
    if (meetsSwitchGate(assess, Math.min(opts.minRequired, assess.requiredCount)) && assess.gated) {
      if (assess.requiredCount >= 2) return p;
    }
  }
  return tightenPuzzle(forcedGatePuzzle(`${seed}:force`, 4, difficulty), HARD_BFS);
}

export function generateFullBoard(seed: string): Puzzle {
  const rng = mulberry32(hashSeed(`full:${seed}`));
  for (let i = 0; i < 6; i++) {
    const p = tryFullBoard(rng, `${seed}:${i}`, "insane");
    if (p && isSwitchGated(p.def, 120_000)) return p;
  }
  return forceHardPuzzle(seed, DAILY_OPTS, "insane");
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
    const targets: SwitchDef["bridges"] = [{ x: bx, y: by, mode: "on" }];
    const prev = line[Math.max(0, t - 1)];
    const dx = bx - prev[0];
    const dy = by - prev[1];
    const px = dy !== 0 ? 1 : 0;
    const py = dx !== 0 ? 1 : 0;
    const nx = bx + px;
    const ny = by + py;
    if (nx >= 0 && ny >= 0 && nx < W && ny < H && grid[ny][nx] === "b") {
      grid[ny][nx] = kind;
      targets.push({ x: nx, y: ny, mode: "on" });
    }
    const swAt = line[Math.max(1, t - 3 - Math.floor(rng() * 2))];
    if (grid[swAt[1]][swAt[0]] !== "b") continue;
    grid[swAt[1]][swAt[0]] = "s";
    switches.push({ x: swAt[0], y: swAt[1], bridges: targets });
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
    const tight = opts.minRequired > 0 ? tightenPuzzle(p, opts.bfs) : p;
    const assess = opts.minRequired > 0 ? assessPuzzle(tight.def, Math.min(opts.bfs, HARD_BFS)) : null;
    const used = tight.usedObstacles;
    const sc = scorePuzzle(tight.solutionLen, used, opts, assess?.requiredCount ?? 0, assess?.gated ?? false);
    if (sc > bestScore) {
      best = tight;
      bestScore = sc;
    }
    if (opts.minRequired > 0) {
      if (assess && isStrictHard(assess, opts)) return tight;
    } else if (tight.solutionLen >= opts.minMoves && used >= opts.minUsed) {
      return tight;
    }
  }
  if (opts.minRequired > 0) {
    if (best) {
      const assess = assessPuzzle(best.def, HARD_BFS);
      if (meetsSwitchGate(assess, opts.minRequired)) return best;
    }
    return forceHardPuzzle(seed, opts, difficulty);
  }
  if (best) return tightenPuzzle(best, opts.bfs);
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
  const rng = mulberry32(hashSeed(`daily-late:${seed}`));
  const remix = remixCampaign(seed, rng() < 0.45 ? "end" : "late", "insane");
  return { ...remix, seed };
}

export function generateSeeded(seed: string): Puzzle {
  const clean = seed.trim() || "BLOX";
  return generateQualityPuzzle(clean, SEEDED_OPTS, "insane");
}

/** Attract showcase archetypes — rotate for visual variety (not fullBoard-biased quality). */
export type AttractArchetype =
  | "plain"
  | "bridges"
  | "split"
  | "slots"
  | "ribbon"
  | "packed"
  | "fullBoard"
  | "campaignRemix";

export const ATTRACT_ARCHETYPES: AttractArchetype[] = [
  "plain",
  "bridges",
  "split",
  "slots",
  "ribbon",
  "packed",
  "fullBoard",
  "campaignRemix",
];

/** Stable archetype pick from seed so consecutive attract runs cycle through looks. */
export function attractArchetypeForSeed(seed: string): AttractArchetype {
  const h = hashSeed(`attract-arch:${seed.trim() || "BLOX"}`);
  return ATTRACT_ARCHETYPES[h % ATTRACT_ARCHETYPES.length]!;
}

/** Gauntlet / seeded-run floor archetype from seed + floor index. */
export function runArchetypeForSeed(seed: string, index: number): AttractArchetype {
  const h = hashSeed(`run-arch:${seed.trim() || "BLOX"}#${index}`);
  return ATTRACT_ARCHETYPES[h % ATTRACT_ARCHETYPES.length]!;
}

/** Donor band for gauntlet remix / campaignRemix archetype (matches pre-N insane→end). */
export function gauntletRemixBand(difficulty: Difficulty): "mid" | "late" | "end" {
  if (difficulty === "easy") return "mid";
  if (difficulty === "medium") return "late";
  return "end";
}

function buildArchetypeCandidate(
  seed: string,
  arch: AttractArchetype,
  difficulty: Difficulty,
  attempt: number,
): Puzzle | null {
  const rng = mulberry32(hashSeed(`arch:${seed}:${arch}:${attempt}`));
  const trySeed = `${seed}:${arch}:${attempt}`;
  if (arch === "plain") return tryPlain(rng, trySeed, difficulty, rng() < 0.45);
  if (arch === "bridges") return tryBridges(rng, trySeed, difficulty);
  if (arch === "split") return trySplit(rng, trySeed, difficulty);
  if (arch === "slots") return trySlots(rng, trySeed, difficulty, 3 + Math.floor(rng() * 3), difficulty !== "easy");
  if (arch === "ribbon") return tryRibbon(rng, trySeed, difficulty);
  if (arch === "packed") return tryPacked(rng, trySeed, difficulty);
  if (arch === "fullBoard") return tryFullBoard(rng, trySeed, difficulty);
  // Hard/insane campaign remix stays on late/end donors — never mid.
  return remixCampaign(trySeed, gauntletRemixBand(difficulty), difficulty);
}

export type TryArchetypeOpts = {
  /** When true with quality set: only isStrictHard accepts; never soft / best-of-weak. */
  strictQuality?: boolean;
};

/**
 * Build one archetype puzzle. When `quality` is set, tighten and score against it.
 * Attract may soft-accept; gauntlet passes `strictQuality: true` so only GAUNTLET_QUALITY clears.
 */
export function tryArchetypePuzzle(
  seed: string,
  arch: AttractArchetype,
  difficulty: Difficulty,
  quality: QualityOpts | null = null,
  maxAttempts?: number,
  opts: TryArchetypeOpts = {},
): Puzzle | null {
  const strict = !!opts.strictQuality && !!quality;
  const attempts = maxAttempts ?? (quality ? Math.max(6, quality.attempts) : 12);
  const bfs = quality?.bfs ?? 180_000;
  let best: Puzzle | null = null;
  let bestScore = -1;
  for (let i = 0; i < attempts; i++) {
    const raw = buildArchetypeCandidate(seed, arch, difficulty, i);
    if (!raw) continue;
    const solved = solveLevel(raw.def, bfs);
    if (!solved.ok || !solved.cmds.length) continue;
    let p: Puzzle = {
      ...raw,
      seed,
      solutionLen: solved.cmds.length,
      usedObstacles: usedObstacleCount(raw.def, solved.cmds),
    };
    if (quality) {
      p = tightenPuzzle(p, bfs);
      const assess = assessPuzzle(p.def, Math.min(bfs, HARD_BFS));
      const sc = scorePuzzle(p.solutionLen, p.usedObstacles, quality, assess.requiredCount, assess.gated);
      if (sc > bestScore) {
        best = p;
        bestScore = sc;
      }
      if (isStrictHard(assess, quality) && p.usedObstacles >= quality.minUsed) {
        return p;
      }
      if (strict) continue;
      // Attract / soft path only: gated switch bar without move floor.
      if (meetsSwitchGate(assess, quality.minRequired)) {
        return p;
      }
      // Soft accept: long enough + enough used obstacles for showcase.
      if (p.solutionLen >= Math.min(quality.minMoves, BAND[difficulty].max) && p.usedObstacles >= Math.min(4, quality.minUsed)) {
        return p;
      }
      continue;
    }
    return p;
  }
  // Gauntlet must not ship best-of-weak; attract may.
  return strict ? null : best;
}

/**
 * Attract-mode puzzle: rotate generator archetypes at insane / GAUNTLET_QUALITY.
 * Soft roster fill remains attract-only — never reused by generateRun.
 */
export function generateAttract(seed: string): Puzzle {
  const clean = seed.trim() || "BLOX";
  const primary = attractArchetypeForSeed(clean);
  const order = [primary, ...ATTRACT_ARCHETYPES.filter((a) => a !== primary)];
  const q = GAUNTLET_QUALITY.insane;
  for (const arch of order) {
    const p = tryArchetypePuzzle(clean, arch, "insane", q, 6);
    if (p) return { ...p, difficulty: "insane" };
  }
  for (const arch of order) {
    const p = tryArchetypePuzzle(clean, arch, "insane", null, 8);
    if (p) return { ...p, difficulty: "insane" };
  }
  return generateQualityPuzzle(clean, q, "insane");
}

function meetsGauntletFloor(p: Puzzle, q: QualityOpts): boolean {
  if (p.solutionLen < q.minMoves || p.usedObstacles < q.minUsed) return false;
  const assess = assessPuzzle(p.def, Math.min(q.bfs, HARD_BFS));
  return isStrictHard(assess, q);
}

/** Archetypes that can realistically clear GAUNTLET_QUALITY (skip soft ribbon/plain burns). */
const GAUNTLET_ARCHETYPES: AttractArchetype[] = [
  "campaignRemix",
  "packed",
  "fullBoard",
  "slots",
  "bridges",
  "split",
];

/**
 * Gauntlet / seeded run: archetype variety only when GAUNTLET_QUALITY is met.
 * No soft accept, no quality=null fill — miss → band remixCampaign / quality builder.
 */
export function generateRun(seed: string, difficulty: Difficulty, count: number): Puzzle[] {
  const n = Math.max(1, Math.min(33, count));
  const q = GAUNTLET_QUALITY[difficulty];
  const band = gauntletRemixBand(difficulty);
  const used = new Set<string>();
  return Array.from({ length: n }, (_, i) => {
    const floorSeed = `${seed}#${i}`;
    const primary = runArchetypeForSeed(seed, i);
    const roster = [
      primary,
      ...GAUNTLET_ARCHETYPES.filter((a) => a !== primary),
    ];
    let picked: Puzzle | null = null;
    // Strict quality: primary + a couple strong alts (keep long gauntlets affordable).
    for (let ai = 0; ai < Math.min(3, roster.length) && !picked; ai++) {
      const arch = roster[ai]!;
      const attempts = ai === 0 ? Math.min(6, q.attempts) : 3;
      const cand = tryArchetypePuzzle(`${floorSeed}:${arch}`, arch, difficulty, q, attempts, {
        strictQuality: true,
      });
      if (!cand) continue;
      const key = cand.def.tiles.join("");
      if (used.has(key)) continue;
      picked = { ...cand, difficulty };
    }
    // Band remix fallback (insane/hard → end).
    for (let guard = 0; guard < 8 && !picked; guard++) {
      const p = remixCampaign(guard === 0 ? floorSeed : `${floorSeed}:r${guard}`, band, difficulty);
      const key = p.def.tiles.join("");
      if (used.has(key)) continue;
      if (!meetsGauntletFloor(p, q)) continue;
      picked = p;
    }
    // Quality builder, then forced gates — still must clear the bar when possible.
    if (!picked) {
      const built = generateQualityPuzzle(`${floorSeed}:gq`, q, difficulty);
      if (!used.has(built.def.tiles.join("")) && meetsGauntletFloor(built, q)) {
        picked = { ...built, difficulty };
      }
    }
    if (!picked) {
      for (let guard = 0; guard < 6; guard++) {
        const p = remixCampaign(`${floorSeed}:z${guard}`, band, difficulty);
        const key = p.def.tiles.join("");
        if (used.has(key)) continue;
        picked = p;
        break;
      }
      picked = picked ?? remixCampaign(floorSeed, band, difficulty);
    }
    used.add(picked.def.tiles.join(""));
    return { ...picked, difficulty };
  });
}

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "insane"];

export function difficultyLabel(d: Difficulty): string {
  return d[0].toUpperCase() + d.slice(1);
}

export function difficultyHint(d: Difficulty): string {
  const q = GAUNTLET_QUALITY[d];
  const shape = d === "easy" ? "mid-campaign routing" : d === "medium" ? "shared gates" : "late-campaign traps";
  return `${q.minMoves}+ moves · ${shape}`;
}

export function difficultyBand(d: Difficulty): (typeof BAND)[Difficulty] {
  return BAND[d];
}
