import type { Dir } from "./engine";

export type TapeCmd = Dir | "swap";

export interface AttemptTape {
  cmds: TapeCmd[];
  won: boolean;
}

export interface LevelStat {
  stage: number;
  timeMs: number;
  moves: number;
  attempts: number;
  tapes: AttemptTape[];
}

export interface RunRecord {
  id: string;
  at: number;
  player: string;
  totalTimeMs: number;
  totalMoves: number;
  fails: number;
  complete: boolean;
  levels: LevelStat[];
}

export type HistoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const RUNS_KEY = "bloxorz-history-v1";
const FINISHED_KEY = "bloxorz-finished-v1";
const MAX_RUNS = 24;
const MAX_FINISHED = 48;
export const REPLAY_VERSION = 2;

export type HistoryKind = "campaign" | "custom" | "daily" | "gauntlet" | "seeded";

export interface FinishedStage {
  id: string;
  at: number;
  player: string;
  stage: number;
  moves: number;
  cmds: TapeCmd[];
  title?: string;
  kind?: HistoryKind;
  seed?: string;
  ver?: number;
}

let storageOverride: HistoryStorage | null = null;

export function setHistoryStorage(store: HistoryStorage | null): void {
  storageOverride = store;
}

function store(): HistoryStorage {
  if (storageOverride) return storageOverride;
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* ignore */
  }
  return { getItem: () => null, setItem: () => undefined };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = store().getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function sameTape(a: TapeCmd[], b: TapeCmd[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((c, i) => c === b[i]);
}

export function loadRuns(): RunRecord[] {
  const rows = readJson<RunRecord[]>(RUNS_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function saveRun(run: RunRecord): void {
  const levels = run.levels.filter((lv) => lv.tapes.some((t) => t.won && t.cmds.length));
  if (!levels.length) return;
  const next = { ...run, levels, complete: true };
  const runs = loadRuns().filter((r) => r.id !== next.id);
  runs.unshift(next);
  store().setItem(RUNS_KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
}

function migrateFinishedFromRuns(): FinishedStage[] {
  const out: FinishedStage[] = [];
  for (const run of loadRuns()) {
    for (const lv of run.levels) {
      const win = [...lv.tapes].reverse().find((t) => t.won && t.cmds.length);
      if (!win) continue;
      out.push({
        id: `${run.id}-${lv.stage}`,
        at: run.at,
        player: run.player,
        stage: lv.stage,
        moves: lv.moves || win.cmds.length,
        cmds: win.cmds,
        title: `Stage ${String(lv.stage).padStart(2, "0")}`,
      });
    }
  }
  return out;
}

export function loadFinishedStages(): FinishedStage[] {
  const rows = readJson<FinishedStage[]>(FINISHED_KEY, []);
  const src = Array.isArray(rows) && rows.length ? rows : migrateFinishedFromRuns();
  const live = src.filter(isCurrentFinish);
  if (src.length && live.length !== src.length) {
    store().setItem(FINISHED_KEY, JSON.stringify(live.slice(0, MAX_FINISHED)));
  }
  return live;
}

function isCompletedFinish(row: FinishedStage | null | undefined): row is FinishedStage {
  return !!row && Array.isArray(row.cmds) && row.cmds.length > 0;
}

function isCurrentFinish(row: FinishedStage | null | undefined): row is FinishedStage {
  return isCompletedFinish(row) && row.ver === REPLAY_VERSION;
}

export function saveFinishedStage(row: FinishedStage): void {
  const next = { ...row, ver: REPLAY_VERSION };
  if (!isCompletedFinish(next)) return;
  const rows = loadFinishedStages().filter((r) => r.id !== next.id);
  rows.unshift(next);
  store().setItem(FINISHED_KEY, JSON.stringify(rows.slice(0, MAX_FINISHED)));
}

export function winningTape(level: LevelStat): TapeCmd[] | null {
  const win = [...level.tapes].reverse().find((t) => t.won && t.cmds.length);
  return win?.cmds.length ? win.cmds : null;
}

/** Coolmath only consumes a move while idle, and Space only swaps while split. */
export function acceptTapeCmd(cmd: TapeCmd, view: { idle: boolean; split: boolean }): boolean {
  if (cmd === "swap") return view.split;
  return view.idle;
}

/** Coolmath onMove axis/change after a roll actually starts. */
export function tapeCmdFromRoll(axis: string, change: number): TapeCmd | null {
  if (axis === "x") return change > 0 ? "right" : change < 0 ? "left" : null;
  if (axis === "y") return change > 0 ? "down" : change < 0 ? "up" : null;
  return null;
}
