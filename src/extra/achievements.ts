import { LEVELS } from "./levels";
import type { LevelDef } from "./types";
import type { HistoryKind, TapeCmd } from "./history";
import { CAMPAIGN_WALKTHROUGH, expandWalkthrough } from "./walkthrough";

export const ACH_COUNT = 300;
export const ACH_PAGE = 6;

export type AchStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type AchievementDef = {
  n: number;
  name: string;
  hint: string;
  check: (s: AchStats) => boolean;
};

export type CampaignBit = {
  cleared: boolean;
  noFall: boolean;
  bestMoves: number;
  noSwap: boolean;
};

export type AchStats = {
  unique: string[];
  hinted: number[];
  hintsSpent: number;
  unlocked: Record<string, number>;
  campaign: CampaignBit[];
  classicComplete: boolean;
  classicFalls: number;
  classicMoves: number;
  daily: string[];
  dailyNoFall: number;
  dailyStreak: number;
  dailyBestStreak: number;
  lastDaily: string;
  seeded: string[];
  seededNoFall: number;
  gauntlet: Record<string, number>;
  gauntletRuns: number;
  gauntletNoFall: number;
  gauntletInsaneNoFall: number;
  custom: string[];
  customNoFall: number;
  customFast: number;
  saved: number;
  savedSplit: boolean;
  savedHeavy: boolean;
  savedFragile: boolean;
  savedSoft: boolean;
  beatOwn: boolean;
  loadedCode: boolean;
  copiedSeed: boolean;
  playedSaved: boolean;
  falls: number;
  moves: number;
  wins: number;
  swaps: number;
  splitWins: number;
  heavyWins: number;
  fragileWins: number;
  softWins: number;
  themes: Record<string, number>;
  timerWins: number;
  passcodeWins: number;
  resumeWins: number;
  screenshots: number;
  replayWatches: number;
  bestImproves: number;
  bestImproveStages: string[];
  playMs: number;
  byDay: Record<string, string[]>;
  noFallStreak: number;
  noFallStreakBest: number;
  comebacks: number;
  stubborn: number;
  dailyAndCampaignDay: boolean;
  dailyAndSeeded: boolean;
  timerStage33: boolean;
};

export type WinNote = {
  kind: HistoryKind;
  stageNo: number;
  uniqueKey: string;
  moves: number;
  noFall: boolean;
  cmds: TapeCmd[];
  theme: string;
  timerOn: boolean;
  classicRun: boolean;
  classicComplete?: boolean;
  classicFalls?: number;
  classicMoves?: number;
  def?: LevelDef | null;
  via?: "start" | "resume" | "passcode" | "code" | "saved" | "creator-test" | "puzzle";
  dailyDate?: string;
  gauntletDiff?: string;
  gauntletLen?: number;
  gauntletNoFallRun?: boolean;
  comeback?: boolean;
  stubborn?: boolean;
  day?: string;
};

const KEY = "bloxorz-achievements-v1";
const EMPTY_BIT: CampaignBit = { cleared: false, noFall: false, bestMoves: 0, noSwap: false };

let storageOverride: AchStorage | null = null;

function store(): AchStorage {
  if (storageOverride) return storageOverride;
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* ignore */
  }
  return { getItem: () => null, setItem: () => undefined };
}

export function setAchievementsStorage(next: AchStorage | null): void {
  storageOverride = next;
  cached = null;
}

function blankStats(): AchStats {
  return {
    unique: [],
    hinted: [],
    hintsSpent: 0,
    unlocked: {},
    campaign: Array.from({ length: 33 }, () => ({ ...EMPTY_BIT })),
    classicComplete: false,
    classicFalls: 999,
    classicMoves: 999999,
    daily: [],
    dailyNoFall: 0,
    dailyStreak: 0,
    dailyBestStreak: 0,
    lastDaily: "",
    seeded: [],
    seededNoFall: 0,
    gauntlet: {},
    gauntletRuns: 0,
    gauntletNoFall: 0,
    gauntletInsaneNoFall: 0,
    custom: [],
    customNoFall: 0,
    customFast: 0,
    saved: 0,
    savedSplit: false,
    savedHeavy: false,
    savedFragile: false,
    savedSoft: false,
    beatOwn: false,
    loadedCode: false,
    copiedSeed: false,
    playedSaved: false,
    falls: 0,
    moves: 0,
    wins: 0,
    swaps: 0,
    splitWins: 0,
    heavyWins: 0,
    fragileWins: 0,
    softWins: 0,
    themes: {},
    timerWins: 0,
    passcodeWins: 0,
    resumeWins: 0,
    screenshots: 0,
    replayWatches: 0,
    bestImproves: 0,
    bestImproveStages: [],
    playMs: 0,
    byDay: {},
    noFallStreak: 0,
    noFallStreakBest: 0,
    comebacks: 0,
    stubborn: 0,
    dailyAndCampaignDay: false,
    dailyAndSeeded: false,
    timerStage33: false,
  };
}

let cached: AchStats | null = null;
let unlockHook: ((rows: AchievementDef[]) => void) | null = null;

export function onAchievementsUnlocked(fn: ((rows: AchievementDef[]) => void) | null): void {
  unlockHook = fn;
}

export function loadAchievements(): AchStats {
  if (cached) return cached;
  try {
    const raw = store().getItem(KEY);
    if (!raw) {
      cached = blankStats();
      return cached;
    }
    const parsed = JSON.parse(raw) as Partial<AchStats>;
    cached = { ...blankStats(), ...parsed };
    cached.replayWatches = Number(cached.replayWatches || (parsed as { ghostWatches?: number }).ghostWatches || 0);
    cached.bestImproves = Number(cached.bestImproves || (parsed as { ghostImproves?: number }).ghostImproves || 0);
    const oldGhostStages = (parsed as { ghostImproveStages?: string[] }).ghostImproveStages;
    if (!Array.isArray(cached.bestImproveStages) || !cached.bestImproveStages.length) {
      cached.bestImproveStages = Array.isArray(oldGhostStages) ? oldGhostStages : [];
    }
    if (!Array.isArray(cached.campaign) || cached.campaign.length !== 33) {
      const next = Array.from({ length: 33 }, (_, i) => cached!.campaign[i] ?? { ...EMPTY_BIT });
      cached.campaign = next;
    }
    return cached;
  } catch {
    cached = blankStats();
    return cached;
  }
}

function saveAchievements(s: AchStats): void {
  cached = s;
  store().setItem(KEY, JSON.stringify(s));
}

export const REC_PAGE = 6;

export type RecRow = { id: string; label: string; meta: string };

function fmtPlayMs(ms: number): string {
  const sec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec % 60).padStart(2, "0")}s`;
  return `${sec}s`;
}

export function recordRows(scroll = 0, page = REC_PAGE, s = loadAchievements()): RecRow[] {
  const cleared = s.campaign.filter((b) => b.cleared).length;
  const noFall = s.campaign.filter((b) => b.noFall).length;
  const all: RecRow[] = [
    { id: "unique", label: "records.unique", meta: String(s.unique.length) },
    { id: "campaign", label: "records.campaign", meta: `${cleared} / 33` },
    { id: "campaignNoFall", label: "records.campaignNoFall", meta: String(noFall) },
    { id: "wins", label: "records.wins", meta: String(s.wins) },
    { id: "moves", label: "records.moves", meta: String(s.moves) },
    { id: "falls", label: "records.falls", meta: String(s.falls) },
    { id: "playTime", label: "records.playTime", meta: fmtPlayMs(s.playMs) },
    { id: "daily", label: "records.daily", meta: String(s.daily.length) },
    { id: "streak", label: "records.streak", meta: String(s.dailyStreak) },
    { id: "bestStreak", label: "records.bestStreak", meta: String(s.dailyBestStreak) },
    { id: "seeded", label: "records.seeded", meta: String(s.seeded.length) },
    { id: "gauntlet", label: "records.gauntlet", meta: String(s.gauntletRuns) },
    { id: "custom", label: "records.custom", meta: String(s.custom.length) },
    { id: "swaps", label: "records.swaps", meta: String(s.swaps) },
    { id: "screenshots", label: "records.screenshots", meta: String(s.screenshots) },
    { id: "replays", label: "records.replays", meta: String(s.replayWatches) },
    { id: "themes", label: "records.themes", meta: String(Object.keys(s.themes).length) },
  ];
  return all.slice(scroll, scroll + page);
}

export function recordCount(): number {
  return recordRows(0, 99).length;
}

export function padAch(n: number): string {
  return String(n).padStart(3, "0");
}

export function parMoves(stage: number): number {
  const script = CAMPAIGN_WALKTHROUGH[stage - 1];
  return script ? expandWalkthrough(script).length : 99;
}

export function totalParMoves(): number {
  let n = 0;
  for (let i = 1; i <= 33; i++) n += parMoves(i);
  return n;
}

export function noSwapStages(): number[] {
  return CAMPAIGN_WALKTHROUGH.map((script, i) => (expandWalkthrough(script).includes("swap") ? 0 : i + 1)).filter(
    (n) => n > 0,
  );
}

function tilesOf(def: LevelDef | null | undefined): string {
  return def?.tiles.join("") ?? "";
}

function isSplitDef(def: LevelDef | null | undefined): boolean {
  if (!def) return false;
  return def.splits.length > 0 || tilesOf(def).includes("v");
}

function isHeavyDef(def: LevelDef | null | undefined): boolean {
  return tilesOf(def).includes("h");
}

function isFragileDef(def: LevelDef | null | undefined): boolean {
  return tilesOf(def).includes("f");
}

function isSoftDef(def: LevelDef | null | undefined): boolean {
  return tilesOf(def).includes("s");
}

export function campaignSplitStages(): number[] {
  return LEVELS.map((def, i) => (isSplitDef(def) ? i + 1 : 0)).filter((n) => n > 0);
}

function bit(s: AchStats, stage: number): CampaignBit {
  return s.campaign[stage - 1] ?? EMPTY_BIT;
}

function countCampaign(s: AchStats, key: keyof CampaignBit): number {
  return s.campaign.filter((row) => row[key]).length;
}

function rangeCleared(s: AchStats, from: number, to: number, field: keyof CampaignBit = "cleared"): boolean {
  for (let i = from; i <= to; i++) if (!bit(s, i)[field]) return false;
  return true;
}

function addUnique(list: string[], id: string): string[] {
  if (list.includes(id)) return list;
  return [...list, id];
}

function bump(map: Record<string, number>, key: string, by = 1): Record<string, number> {
  return { ...map, [key]: (map[key] ?? 0) + by };
}

export function hintTokens(s = loadAchievements()): number {
  return Math.max(0, s.unique.length - s.hintsSpent);
}

export function hasAchievementMenu(s = loadAchievements()): boolean {
  return Object.keys(s.unlocked).length > 0;
}

export function unlockedCount(s = loadAchievements()): number {
  return Object.keys(s.unlocked).length;
}

function yesterday(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function uniqueStageKey(kind: HistoryKind, stageNo: number, seed = ""): string {
  if (kind === "campaign") return `c:${stageNo}`;
  if (kind === "daily") return `d:${seed || stageNo}`;
  if (kind === "seeded") return `s:${seed || stageNo}`;
  if (kind === "gauntlet") return `g:${seed}:${stageNo}`;
  return `x:${seed || stageNo}`;
}

function evaluate(s: AchStats): number[] {
  const fresh: number[] = [];
  for (const def of ACHIEVEMENTS) {
    const id = String(def.n);
    if (s.unlocked[id]) continue;
    if (!def.check(s)) continue;
    s.unlocked[id] = Date.now();
    fresh.push(def.n);
  }
  if (fresh.length) {
    saveAchievements(s);
    unlockHook?.(fresh.map((n) => ACHIEVEMENTS[n - 1]).filter((row): row is AchievementDef => !!row));
  }
  return fresh;
}

export function noteWin(note: WinNote): number[] {
  const s = loadAchievements();
  s.unique = addUnique(s.unique, note.uniqueKey);
  s.wins += 1;
  s.moves += note.moves;
  if (note.noFall) {
    s.noFallStreak += 1;
    s.noFallStreakBest = Math.max(s.noFallStreakBest, s.noFallStreak);
  } else {
    s.noFallStreak = 0;
  }
  if (note.comeback) s.comebacks += 1;
  if (note.stubborn) s.stubborn += 1;
  s.themes = bump(s.themes, note.theme || "original");
  if (note.timerOn) s.timerWins += 1;
  if (note.timerOn && note.kind === "campaign" && note.stageNo === 33) s.timerStage33 = true;
  if (note.via === "passcode") s.passcodeWins += 1;
  if (note.via === "resume") s.resumeWins += 1;
  if (note.via === "code") s.loadedCode = true;
  if (note.via === "saved") s.playedSaved = true;
  if (note.via === "creator-test") s.beatOwn = true;
  if (note.kind === "campaign") {
    const prevBest = bit(s, note.stageNo).bestMoves;
    if (prevBest > 0 && note.moves > 0 && note.moves < prevBest) {
      s.bestImproves += 1;
      s.bestImproveStages = addUnique(s.bestImproveStages, note.uniqueKey);
    }
  }
  const day = note.day || "";
  if (day) {
    const row = addUnique(s.byDay[day] || [], note.uniqueKey);
    s.byDay = { ...s.byDay, [day]: row };
  }

  if (note.kind === "campaign") {
    const i = note.stageNo - 1;
    if (i >= 0 && i < 33) {
      const cur = { ...bit(s, note.stageNo) };
      cur.cleared = true;
      if (note.noFall) cur.noFall = true;
      if (!note.cmds.includes("swap")) cur.noSwap = true;
      if (!cur.bestMoves || note.moves < cur.bestMoves) cur.bestMoves = note.moves;
      s.campaign[i] = cur;
    }
    if (note.classicComplete) {
      s.classicComplete = true;
      s.classicFalls = Math.min(s.classicFalls, note.classicFalls ?? 999);
      s.classicMoves = Math.min(s.classicMoves, note.classicMoves ?? 999999);
    }
    if (day && s.byDay[day]?.some((id) => id.startsWith("d:"))) s.dailyAndCampaignDay = true;
  }

  if (note.kind === "daily") {
    const stamp = note.dailyDate || note.uniqueKey.slice(2);
    if (!s.daily.includes(stamp)) {
      s.daily = [...s.daily, stamp];
      if (s.lastDaily && yesterday(stamp) === s.lastDaily) s.dailyStreak += 1;
      else if (s.lastDaily === stamp) {
        /* same day */
      } else s.dailyStreak = 1;
      s.lastDaily = stamp;
      s.dailyBestStreak = Math.max(s.dailyBestStreak, s.dailyStreak);
    }
    if (note.noFall) s.dailyNoFall += 1;
    if (s.seeded.length) s.dailyAndSeeded = true;
  }

  if (note.kind === "seeded") {
    s.seeded = addUnique(s.seeded, note.uniqueKey);
    if (note.noFall) s.seededNoFall += 1;
    if (s.daily.length) s.dailyAndSeeded = true;
  }

  if (note.kind === "gauntlet") {
    const last = note.gauntletLen ?? 5;
    if (note.stageNo >= last) {
      s.gauntletRuns += 1;
      if (note.gauntletDiff) s.gauntlet = bump(s.gauntlet, note.gauntletDiff);
      if (note.gauntletNoFallRun) {
        s.gauntletNoFall += 1;
        if (note.gauntletDiff === "insane") s.gauntletInsaneNoFall += 1;
      }
    }
  }

  if (note.kind === "custom" || note.via === "creator-test" || note.via === "code" || note.via === "saved") {
    s.custom = addUnique(s.custom, note.uniqueKey);
    if (note.noFall) s.customNoFall += 1;
    if (note.moves > 0 && note.moves <= 50) s.customFast += 1;
  }

  const def = note.def ?? (note.kind === "campaign" ? LEVELS[note.stageNo - 1] : null);
  if (isSplitDef(def) || note.cmds.includes("swap")) s.splitWins += 1;
  if (isHeavyDef(def)) s.heavyWins += 1;
  if (isFragileDef(def)) s.fragileWins += 1;
  if (isSoftDef(def)) s.softWins += 1;

  saveAchievements(s);
  return evaluate(s);
}

export function noteFall(): void {
  const s = loadAchievements();
  s.falls += 1;
  s.noFallStreak = 0;
  saveAchievements(s);
  evaluate(s);
}

export function noteSwap(): void {
  const s = loadAchievements();
  s.swaps += 1;
  saveAchievements(s);
  evaluate(s);
}

export function notePlayMs(ms: number): void {
  if (ms <= 0) return;
  const s = loadAchievements();
  s.playMs += ms;
  saveAchievements(s);
  evaluate(s);
}

export function noteCopiedSeed(): number[] {
  const s = loadAchievements();
  s.copiedSeed = true;
  saveAchievements(s);
  return evaluate(s);
}

export function noteScreenshot(): number[] {
  const s = loadAchievements();
  s.screenshots += 1;
  saveAchievements(s);
  return evaluate(s);
}

export function noteReplayWatch(): number[] {
  const s = loadAchievements();
  s.replayWatches += 1;
  saveAchievements(s);
  return evaluate(s);
}

export function noteSaved(def: LevelDef): number[] {
  const s = loadAchievements();
  s.saved += 1;
  if (isSplitDef(def)) s.savedSplit = true;
  if (isHeavyDef(def)) s.savedHeavy = true;
  if (isFragileDef(def)) s.savedFragile = true;
  if (isSoftDef(def)) s.savedSoft = true;
  saveAchievements(s);
  return evaluate(s);
}

export function spendHint(n: number): "ok" | "tokens" | "unlocked" | "hinted" | "missing" {
  const def = achievementByNumber(n);
  if (!def) return "missing";
  const s = loadAchievements();
  if (s.unlocked[String(n)]) return "unlocked";
  if (s.hinted.includes(n)) return "hinted";
  if (hintTokens(s) < 1) return "tokens";
  s.hintsSpent += 1;
  s.hinted = [...s.hinted, n];
  saveAchievements(s);
  return "ok";
}

export function achievementByNumber(n: number): AchievementDef | undefined {
  return ACHIEVEMENTS[n - 1];
}

function stageName(n: number): string {
  return `Stage ${String(n).padStart(2, "0")}`;
}

function buildCatalog(): AchievementDef[] {
  const out: AchievementDef[] = [];
  const add = (name: string, hint: string, check: AchievementDef["check"]): void => {
    out.push({ n: out.length + 1, name, hint, check });
  };

  for (let i = 1; i <= 33; i++) {
    const stage = i;
    add(`${stageName(stage)} Cleared`, `Finish campaign ${stageName(stage)}.`, (s) => bit(s, stage).cleared);
  }
  for (let i = 1; i <= 33; i++) {
    const stage = i;
    add(
      `${stageName(stage)} Untipped`,
      `Finish campaign ${stageName(stage)} without falling on that attempt.`,
      (s) => bit(s, stage).noFall,
    );
  }
  for (let i = 1; i <= 33; i++) {
    const stage = i;
    const cap = parMoves(stage) * 2;
    add(
      `${stageName(stage)} Efficient`,
      `Finish campaign ${stageName(stage)} in ${cap} moves or fewer.`,
      (s) => bit(s, stage).cleared && bit(s, stage).bestMoves > 0 && bit(s, stage).bestMoves <= cap,
    );
  }
  for (let i = 1; i <= 33; i++) {
    const stage = i;
    const cap = parMoves(stage);
    add(
      `${stageName(stage)} Par`,
      `Match or beat the published route on campaign ${stageName(stage)} (${cap} moves).`,
      (s) => bit(s, stage).cleared && bit(s, stage).bestMoves > 0 && bit(s, stage).bestMoves <= cap,
    );
  }
  for (const stage of noSwapStages()) {
    add(
      `${stageName(stage)} One Piece`,
      `Finish campaign ${stageName(stage)} without swapping split cubes.`,
      (s) => bit(s, stage).noSwap,
    );
  }

  add("Five Islands", "Clear any 5 different campaign stages.", (s) => countCampaign(s, "cleared") >= 5);
  add("Ten Islands", "Clear any 10 different campaign stages.", (s) => countCampaign(s, "cleared") >= 10);
  add("Halfway Orange", "Clear any 15 different campaign stages.", (s) => countCampaign(s, "cleared") >= 15);
  add("Twenty Deep", "Clear any 20 different campaign stages.", (s) => countCampaign(s, "cleared") >= 20);
  add("Late Campaign", "Clear any 25 different campaign stages.", (s) => countCampaign(s, "cleared") >= 25);
  add("Almost There", "Clear any 30 different campaign stages.", (s) => countCampaign(s, "cleared") >= 30);
  add("Thirty-Three", "Clear every campaign stage.", (s) => countCampaign(s, "cleared") >= 33);
  add("Full Circuit", "Start a new campaign and finish Stage 33 in that run.", (s) => s.classicComplete);
  add("Steady Hands", "Finish a full campaign run with 20 falls or fewer.", (s) => s.classicComplete && s.classicFalls <= 20);
  add("Tightrope", "Finish a full campaign run with 8 falls or fewer.", (s) => s.classicComplete && s.classicFalls <= 8);
  add("No Splash Run", "Finish a full campaign run without falling once.", (s) => s.classicComplete && s.classicFalls <= 0);
  add(
    "Published Pace",
    "Finish a full campaign run in at most twice the published move count.",
    (s) => s.classicComplete && s.classicMoves <= totalParMoves() * 2,
  );
  add("First Island", "Clear campaign stages 1 through 11.", (s) => rangeCleared(s, 1, 11));
  add("Second Island", "Clear campaign stages 12 through 22.", (s) => rangeCleared(s, 12, 22));
  add("Final Island", "Clear campaign stages 23 through 33.", (s) => rangeCleared(s, 23, 33));
  add("Flawless Campaign", "Finish every campaign stage without falling.", (s) => countCampaign(s, "noFall") >= 33);
  add(
    "Efficient Campaign",
    "Beat double-par on every campaign stage.",
    (s) => s.campaign.every((row, i) => row.cleared && row.bestMoves > 0 && row.bestMoves <= parMoves(i + 1) * 2),
  );
  add(
    "Par Campaign",
    "Match or beat the published route on every campaign stage.",
    (s) => s.campaign.every((row, i) => row.cleared && row.bestMoves > 0 && row.bestMoves <= parMoves(i + 1)),
  );
  add("Clean Landing", "No-fall every stage from 1 to 11.", (s) => rangeCleared(s, 1, 11, "noFall"));
  add("Midway Balance", "No-fall every stage from 12 to 22.", (s) => rangeCleared(s, 12, 22, "noFall"));
  add("Last Stretch Clean", "No-fall every stage from 23 to 33.", (s) => rangeCleared(s, 23, 33, "noFall"));

  add("Daily Driver", "Finish today's puzzle.", (s) => s.daily.length >= 1);
  add("Work Week", "Finish 5 different daily puzzles.", (s) => s.daily.length >= 5);
  add("Calendar Roll", "Finish 10 different daily puzzles.", (s) => s.daily.length >= 10);
  add("Month of Cubes", "Finish 20 different daily puzzles.", (s) => s.daily.length >= 20);
  add("Season Ticket", "Finish 40 different daily puzzles.", (s) => s.daily.length >= 40);
  add("Back Tomorrow", "Finish dailies on 2 days in a row.", (s) => s.dailyBestStreak >= 2);
  add("Habit Forming", "Finish dailies on 3 days in a row.", (s) => s.dailyBestStreak >= 3);
  add("Week of Orange", "Finish dailies on 7 days in a row.", (s) => s.dailyBestStreak >= 7);
  add("Fortnight", "Finish dailies on 14 days in a row.", (s) => s.dailyBestStreak >= 14);
  add("Daily Untipped", "Finish a daily puzzle without falling.", (s) => s.dailyNoFall >= 1);
  add("Daily Precision", "Finish 5 daily puzzles without falling.", (s) => s.dailyNoFall >= 5);
  add("Seeded Once", "Finish a seeded puzzle.", (s) => s.seeded.length >= 1);
  add("Seed Collector", "Finish 5 different seeded puzzles.", (s) => s.seeded.length >= 5);
  add("Seed Vault", "Finish 10 different seeded puzzles.", (s) => s.seeded.length >= 10);
  add("Seed Library", "Finish 20 different seeded puzzles.", (s) => s.seeded.length >= 20);
  add("Seed Archive", "Finish 35 different seeded puzzles.", (s) => s.seeded.length >= 35);
  add("Seeded Untipped", "Finish a seeded puzzle without falling.", (s) => s.seededNoFall >= 1);
  add("Gauntlet Easy", "Finish an easy gauntlet.", (s) => (s.gauntlet.easy ?? 0) >= 1);
  add("Gauntlet Medium", "Finish a medium gauntlet.", (s) => (s.gauntlet.medium ?? 0) >= 1);
  add("Gauntlet Hard", "Finish a hard gauntlet.", (s) => (s.gauntlet.hard ?? 0) >= 1);
  add("Gauntlet Insane", "Finish an insane gauntlet.", (s) => (s.gauntlet.insane ?? 0) >= 1);
  add("Gauntlet Repeat", "Finish 2 gauntlets.", (s) => s.gauntletRuns >= 2);
  add("Gauntlet Regular", "Finish 5 gauntlets.", (s) => s.gauntletRuns >= 5);
  add("Gauntlet Veteran", "Finish 10 gauntlets.", (s) => s.gauntletRuns >= 10);
  add("Gauntlet Untipped", "Finish a 5-stage gauntlet without falling.", (s) => s.gauntletNoFall >= 1);
  add("Insane Untipped", "Finish an insane gauntlet without falling.", (s) => s.gauntletInsaneNoFall >= 1);
  add("Puzzle Traveler", "Finish 10 unique daily, seeded, or gauntlet stages.", (s) => s.unique.filter((id) => id.startsWith("d:") || id.startsWith("s:") || id.startsWith("g:")).length >= 10);
  add("Puzzle Nomad", "Finish 25 unique daily, seeded, or gauntlet stages.", (s) => s.unique.filter((id) => id.startsWith("d:") || id.startsWith("s:") || id.startsWith("g:")).length >= 25);

  add("Playtester", "Beat a stage you are editing in the creator.", (s) => s.beatOwn);
  add("First Save", "Save a custom stage the solver says can be beaten.", (s) => s.saved >= 1);
  add("Workshop", "Save 5 custom stages.", (s) => s.saved >= 5);
  add("Studio", "Save 10 custom stages.", (s) => s.saved >= 10);
  add("Archive Builder", "Save 20 custom stages.", (s) => s.saved >= 20);
  add("Custom Clear", "Finish a custom or shared stage.", (s) => s.custom.length >= 1);
  add("Custom Five", "Finish 5 different custom or shared stages.", (s) => s.custom.length >= 5);
  add("Custom Ten", "Finish 10 different custom or shared stages.", (s) => s.custom.length >= 10);
  add("Custom Twenty", "Finish 20 different custom or shared stages.", (s) => s.custom.length >= 20);
  add("Code Runner", "Load a shared stage code and finish it.", (s) => s.loadedCode);
  add("Reverse Seed", "Copy a creator reverse seed.", (s) => s.copiedSeed);
  add("From the Shelf", "Finish a stage from your saved list.", (s) => s.playedSaved);
  add("Custom Untipped", "Finish a custom stage without falling.", (s) => s.customNoFall >= 1);
  add("Custom Balance", "Finish 5 custom stages without falling.", (s) => s.customNoFall >= 5);
  add("Short Custom", "Finish a custom stage in 50 moves or fewer.", (s) => s.customFast >= 1);
  add("Split Author", "Save a custom stage that uses a splitter.", (s) => s.savedSplit);
  add("Heavy Author", "Save a custom stage that uses a heavy switch.", (s) => s.savedHeavy);
  add("Glass Author", "Save a custom stage that uses fragile tiles.", (s) => s.savedFragile);
  add("Soft Author", "Save a custom stage that uses a soft switch.", (s) => s.savedSoft);

  add("First Tumble", "Fall off the stage once.", (s) => s.falls >= 1);
  add("Getting Used To It", "Fall 10 times.", (s) => s.falls >= 10);
  add("Gravity Student", "Fall 25 times.", (s) => s.falls >= 25);
  add("Gravity Regular", "Fall 50 times.", (s) => s.falls >= 50);
  add("Gravity Veteran", "Fall 100 times.", (s) => s.falls >= 100);
  add("Hundred Rolls", "Record 100 real moves.", (s) => s.moves >= 100);
  add("Quarter Thousand", "Record 250 real moves.", (s) => s.moves >= 250);
  add("Five Hundred Rolls", "Record 500 real moves.", (s) => s.moves >= 500);
  add("Thousand Rolls", "Record 1,000 real moves.", (s) => s.moves >= 1000);
  add("Long Haul", "Record 2,500 real moves.", (s) => s.moves >= 2500);
  add("Marathon Cube", "Record 5,000 real moves.", (s) => s.moves >= 5000);
  add("Ten Thousand Rolls", "Record 10,000 real moves.", (s) => s.moves >= 10000);
  add("Win Five", "Finish 5 stages.", (s) => s.wins >= 5);
  add("Win Fifteen", "Finish 15 stages.", (s) => s.wins >= 15);
  add("Win Thirty-Five", "Finish 35 stages.", (s) => s.wins >= 35);
  add("Win Seventy", "Finish 70 stages.", (s) => s.wins >= 70);
  add("Win One Twenty", "Finish 120 stages.", (s) => s.wins >= 120);
  add("Win Two Hundred", "Finish 200 stages.", (s) => s.wins >= 200);
  add("Split Once", "Swap between split cubes once.", (s) => s.swaps >= 1);
  add("Split Twenty", "Swap between split cubes 20 times.", (s) => s.swaps >= 20);
  add("Split Sixty", "Swap between split cubes 60 times.", (s) => s.swaps >= 60);
  add("Split One Twenty", "Swap between split cubes 120 times.", (s) => s.swaps >= 120);
  add("Split Two Fifty", "Swap between split cubes 250 times.", (s) => s.swaps >= 250);
  add("First Split Stage", "Finish a stage that uses a splitter.", (s) => s.splitWins >= 1);
  add("Split Regular", "Finish 4 splitter stages.", (s) => s.splitWins >= 4);
  add("Split Master", "Finish 8 splitter stages.", (s) => s.splitWins >= 8);
  add("Heavy Foot", "Finish a stage that uses a heavy switch.", (s) => s.heavyWins >= 1);
  add("Heavy Regular", "Finish 4 heavy-switch stages.", (s) => s.heavyWins >= 4);
  add("Glass Path", "Finish a stage that uses fragile tiles.", (s) => s.fragileWins >= 1);
  add("Glass Regular", "Finish 4 fragile-tile stages.", (s) => s.fragileWins >= 4);
  add("Soft Click", "Finish a stage that uses a soft switch.", (s) => s.softWins >= 1);
  add("Soft Regular", "Finish 4 soft-switch stages.", (s) => s.softWins >= 4);

  add("Original Clear", "Finish a stage while using the Original theme.", (s) => (s.themes.original ?? 0) >= 1);
  add("Gray Clear", "Finish a stage while using the Gray theme.", (s) => (s.themes.gray ?? 0) >= 1);
  add("Holiday Clear", "Finish a stage while using the Holiday theme.", (s) => (s.themes.holiday ?? 0) >= 1);
  add("Solid Clear", "Finish a stage while using the Solid 3D theme.", (s) => (s.themes.solid3d ?? 0) >= 1);
  add("Original Regular", "Finish 5 stages in the Original theme.", (s) => (s.themes.original ?? 0) >= 5);
  add("Gray Regular", "Finish 5 stages in the Gray theme.", (s) => (s.themes.gray ?? 0) >= 5);
  add("Holiday Regular", "Finish 5 stages in the Holiday theme.", (s) => (s.themes.holiday ?? 0) >= 5);
  add("Solid Regular", "Finish 5 stages in the Solid 3D theme.", (s) => (s.themes.solid3d ?? 0) >= 5);
  add("Clock In", "Finish a stage with the speedrun timer on.", (s) => s.timerWins >= 1);
  add("Clock Regular", "Finish 10 stages with the speedrun timer on.", (s) => s.timerWins >= 10);
  add("Passcode Clear", "Load a campaign passcode and finish that stage.", (s) => s.passcodeWins >= 1);
  add("Passcode Five", "Finish 5 stages after loading them by passcode.", (s) => s.passcodeWins >= 5);
  add("Picked Up Where", "Resume a campaign and finish the resumed stage.", (s) => s.resumeWins >= 1);
  add("Share Shot", "Take a screenshot from a finish screen.", (s) => s.screenshots >= 1);
  add("History Buff", "Replay a finished stage from History.", (s) => s.replayWatches >= 1);
  add("Personal Best", "Finish a campaign stage in fewer moves than your previous best.", (s) => s.bestImproves >= 1);
  add("Five Personal Bests", "Beat your previous move count on 5 different campaign stages.", (s) => s.bestImproveStages.length >= 5);
  add("Twenty Minutes", "Spend 20 minutes actually in a stage.", (s) => s.playMs >= 20 * 60 * 1000);
  add("Ninety Minutes", "Spend 90 minutes actually in a stage.", (s) => s.playMs >= 90 * 60 * 1000);
  add("Four Hours Rolling", "Spend 4 hours actually in a stage.", (s) => s.playMs >= 4 * 60 * 60 * 1000);

  add("Busy Day", "Finish 3 unique stages in one UTC day.", (s) => Object.values(s.byDay).some((row) => row.length >= 3));
  add("Long Day", "Finish 8 unique stages in one UTC day.", (s) => Object.values(s.byDay).some((row) => row.length >= 8));
  add("Hot Streak", "Finish 3 stages in a row without falling.", (s) => s.noFallStreakBest >= 3);
  add("Hotter Streak", "Finish 6 stages in a row without falling.", (s) => s.noFallStreakBest >= 6);
  add("On Fire", "Finish 12 stages in a row without falling.", (s) => s.noFallStreakBest >= 12);
  add("Comeback", "Fall on a stage, then finish it anyway.", (s) => s.comebacks >= 1);
  add("Comeback Regular", "Fall and still finish a stage 8 times.", (s) => s.comebacks >= 8);
  add("Stubborn", "Fall at least 5 times on a stage, then finish it.", (s) => s.stubborn >= 1);
  add("Stubborn Five", "Do a 5-fall comeback on 5 stages.", (s) => s.stubborn >= 5);
  add(
    "All Splitters",
    "Clear every campaign stage that uses a splitter.",
    (s) => campaignSplitStages().every((n) => bit(s, n).cleared),
  );
  add(
    "All Splitters Untipped",
    "No-fall every campaign stage that uses a splitter.",
    (s) => campaignSplitStages().every((n) => bit(s, n).noFall),
  );
  add("Same-Day Mix", "Finish a daily puzzle and a campaign stage on the same UTC day.", (s) => s.dailyAndCampaignDay);
  add("Both Puzzle Desks", "Finish at least one daily and one seeded puzzle.", (s) => s.dailyAndSeeded);
  add("Eight Uniques", "Finish 8 unique stages of any kind.", (s) => s.unique.length >= 8);
  add("Sixteen Uniques", "Finish 16 unique stages of any kind.", (s) => s.unique.length >= 16);
  add("Twenty-Four Uniques", "Finish 24 unique stages of any kind.", (s) => s.unique.length >= 24);
  add("Forty Uniques", "Finish 40 unique stages of any kind.", (s) => s.unique.length >= 40);
  add("Sixty Uniques", "Finish 60 unique stages of any kind.", (s) => s.unique.length >= 60);
  add("Eighty Uniques", "Finish 80 unique stages of any kind.", (s) => s.unique.length >= 80);
  add("Hundred Uniques", "Finish 100 unique stages of any kind.", (s) => s.unique.length >= 100);
  add("Timer on Thirty-Three", "Finish Stage 33 with the speedrun timer on.", (s) => s.timerStage33);
  add("Swapless Island", "Finish every no-swap campaign stage without swapping.", (s) => noSwapStages().every((n) => bit(s, n).noSwap));

  if (out.length > ACH_COUNT) out.length = ACH_COUNT;
  let pad = 1;
  while (out.length < ACH_COUNT) {
    const need = out.length + 1;
    const target = 100 + pad * 4;
    add(`${target} Uniques`, `Finish ${target} unique stages of any kind.`, (s) => s.unique.length >= target);
    pad += 1;
    if (pad > 40) break;
    void need;
  }
  if (out.length !== ACH_COUNT) {
    throw new Error(`achievement catalog is ${out.length}, expected ${ACH_COUNT}`);
  }
  return out;
}

export const ACHIEVEMENTS: AchievementDef[] = buildCatalog();

export type AchRow = {
  n: number;
  label: string;
  meta: string;
  unlocked: boolean;
  hinted: boolean;
  canHint: boolean;
};

export function achievementRows(scroll: number, page = ACH_PAGE): AchRow[] {
  const s = loadAchievements();
  const tokens = hintTokens(s);
  return ACHIEVEMENTS.slice(scroll, scroll + page).map((def) => {
    const unlocked = !!s.unlocked[String(def.n)];
    const hinted = s.hinted.includes(def.n);
    const label = `#${padAch(def.n)}  ${unlocked ? def.name : "???"}`;
    let meta = "";
    if (unlocked) meta = def.hint;
    else if (hinted) meta = def.hint;
    else if (tokens > 0) meta = "Confirm to spend 1 hint.";
    else meta = "Beat a new unique stage to earn a hint.";
    return {
      n: def.n,
      label,
      meta,
      unlocked,
      hinted,
      canHint: !unlocked && !hinted && tokens > 0,
    };
  });
}
