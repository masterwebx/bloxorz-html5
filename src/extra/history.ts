import { Stage, type Dir } from "./engine";
import type { LevelDef } from "./types";

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
const GHOSTS_KEY = "bloxorz-ghosts-v1";
const GHOSTS_PREF = "bloxorz-see-ghosts";
const MAX_RUNS = 24;
const MAX_FINISHED = 48;
const MAX_GHOSTS_PER_STAGE = 32;
export const MAX_GHOST_DRAW = 16;

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
  if (Array.isArray(rows) && rows.length) return rows;
  return migrateFinishedFromRuns();
}

export function saveFinishedStage(row: FinishedStage): void {
  if (!row.cmds.length) return;
  const rows = loadFinishedStages().filter((r) => r.id !== row.id);
  rows.unshift(row);
  store().setItem(FINISHED_KEY, JSON.stringify(rows.slice(0, MAX_FINISHED)));
}

export function loadGhostBank(): Record<string, TapeCmd[][]> {
  const bank = readJson<Record<string, TapeCmd[][]>>(GHOSTS_KEY, {});
  return bank && typeof bank === "object" ? bank : {};
}

export function ghostKey(kind: HistoryKind | string, stage: number, seed = ""): string {
  if (kind === "campaign" || !kind) return `c:${stage}`;
  if (seed) return `s:${seed}`;
  return `${kind}:${stage}`;
}

export function pushGhost(stage: number | string, cmds: TapeCmd[]): void {
  if (!cmds.length) return;
  const bank = loadGhostBank();
  const key = String(stage);
  const list = bank[key] ?? [];
  if (list.some((t) => sameTape(t, cmds))) return;
  list.push(cmds);
  bank[key] = list.slice(-MAX_GHOSTS_PER_STAGE);
  store().setItem(GHOSTS_KEY, JSON.stringify(bank));
}

export function ghostsForStage(stage: number | string, exclude: TapeCmd[] = []): TapeCmd[][] {
  const bank = loadGhostBank();
  const keys = new Set<string>([String(stage)]);
  if (typeof stage === "number") keys.add(`c:${stage}`);
  const out: TapeCmd[][] = [];
  for (const key of keys) {
    for (const tape of bank[key] ?? []) {
      if (!tape.length || sameTape(tape, exclude)) continue;
      if (out.some((t) => sameTape(t, tape))) continue;
      out.push(tape);
    }
  }
  return out.slice(-MAX_GHOST_DRAW);
}

export function loadSeeGhosts(): boolean {
  return store().getItem(GHOSTS_PREF) !== "0";
}

export function saveSeeGhosts(on: boolean): void {
  store().setItem(GHOSTS_PREF, on ? "1" : "0");
}

export function winningTape(level: LevelStat): TapeCmd[] | null {
  const win = [...level.tapes].reverse().find((t) => t.won && t.cmds.length);
  return win?.cmds.length ? win.cmds : null;
}

export class GhostRunner {
  readonly stage: Stage;
  i = 0;
  finished = false;

  constructor(
    def: LevelDef,
    readonly cmds: TapeCmd[],
  ) {
    this.stage = new Stage(def);
    this.stage.assemble = 1;
    this.stage.dropIn();
  }

  tick(dt: number): void {
    if (this.finished) return;
    this.stage.tick(dt);
    if (this.stage.anim) {
      if (this.stage.anim.t < this.stage.anim.dur) return;
      const kind = this.stage.anim.kind;
      if (kind === "roll") {
        const result = this.stage.finishMove(() => undefined);
        if (this.stage.anim?.kind === "roll") this.stage.anim = null;
        if (result === "fail") this.stage.beginFall();
        else if (result === "win") this.stage.beginSink();
        else if (result === "split") this.stage.beginSplit();
      } else if (kind === "fall" || kind === "sink") {
        this.stage.anim = null;
        this.finished = true;
      } else {
        this.stage.anim = null;
      }
      return;
    }
    if (this.i >= this.cmds.length) {
      this.finished = true;
      return;
    }
    const cmd = this.cmds[this.i];
    if (cmd === "swap") {
      this.stage.swapSplit();
      this.i++;
      return;
    }
    if (this.stage.tryMove(cmd)) this.i++;
  }
}
