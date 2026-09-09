import { checkBeatable, newPaintState, paintEditorCell, splitMarks, type EditorToolId } from "./editor";
import {
  emptyDraft,
  encodeLevel,
  encodeSeed,
  isPlayable,
  listSaved,
  parseShare,
  saveStage,
  stageId,
} from "./customLevels";
import { campaignDefs, defToCreateJs } from "./convert";
import { dailySeed, difficultyLabel, generatePuzzle, generateRun, type Difficulty } from "./generate";
import { actionFromCode, pollGamepad, pollMenuPad, rumble } from "./gamepad";
import { applyVolumes, ensureMenuMusic, gateSoundPlay, stopMenuMusic, unlockAudio } from "./audio";
import { loadRuns, pushGhost, saveRun, winningTape, type RunRecord, type TapeCmd } from "./history";
import {
  ACTIONS,
  ACTION_LABEL,
  brandName,
  currentTheme,
  isDevName,
  loadSettings,
  NAME_MAX,
  normalizeTheme,
  prettyKey,
  saveSettings,
  type Action,
  type ThemeId,
} from "./settings";
import { solveLevel } from "./solve";
import type { LevelDef } from "./types";
import { ExtraHud, type MenuItem } from "./hud";
import type { WalkCmd } from "./walkthrough";

type Screen =
  | "name"
  | "home"
  | "settings"
  | "remap"
  | "creator"
  | "puzzles"
  | "history"
  | "load"
  | "credits"
  | "finish"
  | "auto";

type PlaySession = {
  kind: "campaign" | "custom";
  defs: LevelDef[];
  returnTo: Screen;
  record: boolean;
  classicRun: boolean;
  title?: string;
};

type StageLike = {
  levelNumber: number;
  triggerKeyDown?: (evt: { code: string }) => void;
  triggerKeyUp?: (evt: { code: string }) => void;
  doneIntro?: boolean;
  addChild?: (c: unknown) => void;
  addChildAt?: (c: unknown, i: number) => void;
  removeChild?: (c: unknown) => void;
  contains?: (c: unknown) => boolean;
  setChildIndex?: (c: unknown, i: number) => void;
  numChildren?: number;
  toggleSound?: () => void;
  totalMoves?: number;
  totalFalls?: number;
  gameContainer?: { visible?: boolean };
  menuMusic?: { stop?: () => void } | null;
};

type SkyClip = { x: number; y: number; visible: boolean; mouseEnabled: boolean };
type LibCtor = {
  bettersky_22?: new () => SkyClip;
  spinna?: new () => { x: number; y: number; scaleX: number; scaleY: number; mouseEnabled: boolean; shadow?: unknown; parent?: unknown };
};

const MODE_KEY = "bloxorz-play-mode";
const NAME_KEY = "bloxorz-player-name";
const VANILLA_BUTTONS = ["startNewGame", "resumeGame", "loadStage", "toggleSound", "credits"];
const KEY_CMD: Record<string, TapeCmd> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
  Space: "swap",
};

let extraView: Screen = "auto";
let playSession: PlaySession | null = null;
let draft = emptyDraft();
let paint = newPaintState();
let beaten = false;
let beatTimer = 0;
let beatLabel = "Checking…";
let puzzleDiff: Difficulty = "easy";
let puzzleCount = 1;
let solveQueue: WalkCmd[] = [];
let solveHold = 0;
let solveCode = "";
let run: RunRecord | null = null;
let tape: TapeCmd[] = [];
let lastLabel = "";
let lastLevelNum = 0;
let origGetLevels: (() => unknown[]) | null = null;
let hud: ExtraHud | null = null;
let homeCursor = 0;
let loadError = "";
let hudDirty = true;
let lastHudPaint = "";
let bound = false;
let sky: SkyClip | null = null;
let rootParked = false;
let menuParked = false;
let rebindAction: Action | null = null;
let overlayMode: "legacy" | "run" | "menu" | "" = "";
let sidePanelOn: boolean | null = null;
let versionHidden: boolean | null = null;
let mouseOverHz = -1;
let cachedName = "";
let cachedDev = false;
let nameRead = false;
/** Authored CreateJS fps (RAF-synced). Keep tick-based delays in sync. */
const TICK_SCALE = 1;

function markHudDirty(): void {
  hudDirty = true;
}

function refreshNameCache(): void {
  try {
    cachedName = (localStorage.getItem(NAME_KEY) || "").trim().slice(0, NAME_MAX);
  } catch {
    cachedName = "";
  }
  cachedDev = isDevName(cachedName);
  nameRead = true;
}

function setMouseOverRate(hz: number): void {
  if (mouseOverHz === hz) return;
  mouseOverHz = hz;
  const fn = (window as unknown as { __bloxSetMouseOver?: (n: number) => void }).__bloxSetMouseOver;
  fn?.(hz);
}

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function isLegacy(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) === "legacy";
  } catch {
    return false;
  }
}

function setMode(mode: string): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function getName(): string {
  if (!nameRead) refreshNameCache();
  return cachedName;
}

function setName(name: string): void {
  const next = name.trim().slice(0, NAME_MAX);
  try {
    localStorage.setItem(NAME_KEY, next);
    const s = loadSettings();
    s.playerName = next;
    saveSettings(s);
    cachedName = next;
    cachedDev = isDevName(next);
    nameRead = true;
  } catch {
    /* ignore */
  }
}

function savedLevel(): number {
  try {
    const n = Number(window.localStorage.getItem("level"));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function adobeLib(): LibCtor | undefined {
  return window.AdobeAn?.getComposition("FE31B685947E79408F0C8768D6EC8517")?.getLibrary();
}

function ensureSky(): void {
  const st = window.stage;
  if (sky || !st?.addChildAt) return;
  const Sky = adobeLib()?.bettersky_22;
  if (!Sky) return;
  const clip = new Sky();
  clip.x = 0;
  clip.y = 0.5;
  clip.mouseEnabled = false;
  st.addChildAt(clip, 0);
  sky = clip;
}

function parkExportRoot(park: boolean): void {
  const st = window.stage;
  const root = window.exportRoot;
  if (!st || !root) return;
  if (park) {
    if (st.contains?.(root)) st.removeChild?.(root);
    rootParked = true;
  } else if (rootParked) {
    if (!st.contains?.(root)) st.addChild?.(root);
    rootParked = false;
  }
}

function showGameSky(on: boolean): void {
  ensureSky();
  if (sky) sky.visible = on;
  parkExportRoot(on);
  const box = window.stage?.gameContainer;
  if (box) box.visible = !on;
}

function syncSidePanel(show: boolean): void {
  if (sidePanelOn === show && !isLegacy()) return;
  sidePanelOn = show;
  const panel = $("side_panel");
  const split = $("screen-split");
  if (!panel) return;
  if (isLegacy()) {
    panel.classList.add("is-open");
    panel.style.display = "";
    split?.classList.add("has-timer");
    const sel = $("image_select");
    if (sel) sel.style.display = "";
    return;
  }
  const sel = $("image_select");
  if (sel) sel.style.display = "none";
  panel.classList.toggle("is-open", show);
  panel.style.display = show ? "" : "none";
  split?.classList.toggle("has-timer", show);
}

function parkCreateJsMenu(): void {
  if (menuParked) return;
  menuParked = true;
  const root = window.exportRoot;
  const st = window.stage;
  if (!root || !st) return;
  st.doneIntro = true;
  if (root.splash) {
    root.splash.visible = false;
    root.splash.stop?.();
  }
  if (st.menuMusic) {
    st.menuMusic.stop?.();
    st.menuMusic = null;
  }
  setVanillaButtonsVisible(false);
  showGameSky(true);
  syncSidePanel(false);
}

function enterPlayVisuals(): void {
  menuParked = false;
  showGameSky(false);
  setExportRootMouse(true);
  setMouseOverRate(0);
  hud?.parkForPlay();
  placeHudInput(false, "0", "0", "0", "", "");
  sidePanelOn = null;
}

function findMenu(): Record<string, { visible?: boolean; mouseEnabled?: boolean }> | null {
  return (window.exportRoot?.menu ?? null) as Record<string, { visible?: boolean; mouseEnabled?: boolean }> | null;
}

function onMainMenu(): boolean {
  const root = window.exportRoot;
  if (!root?.menu) return false;
  if (root.currentLabel !== "menu") return false;
  return root.menu.currentFrame === 133;
}

function currentLabel(): string {
  return window.exportRoot?.currentLabel || "";
}

function show(el: HTMLElement | null, on: boolean): void {
  if (!el) return;
  el.classList.toggle("is-open", on);
}

function setExportRootMouse(on: boolean): void {
  const root = window.exportRoot as { mouseEnabled?: boolean; mouseChildren?: boolean } | undefined;
  if (!root) return;
  root.mouseEnabled = on;
  root.mouseChildren = on;
}

function setVanillaButtonsVisible(visible: boolean): void {
  const menu = findMenu();
  if (!menu) return;
  for (const name of VANILLA_BUTTONS) {
    const btn = menu[name];
    if (!btn) continue;
    btn.visible = visible;
    btn.mouseEnabled = visible;
  }
}

function wrapGetLevels(): void {
  const w = window as unknown as { getLevels?: () => unknown[] };
  if (!origGetLevels && typeof w.getLevels === "function") origGetLevels = w.getLevels.bind(w);
  if (!origGetLevels) return;
  w.getLevels = function wrappedLevels() {
    if (playSession?.defs.length) return playSession.defs.map((d) => defToCreateJs(d));
    return origGetLevels!();
  };
}

function hudInput(): HTMLInputElement | null {
  return $("hud-input") as HTMLInputElement | null;
}

function placeHudInput(on: boolean, left: string, top: string, width: string, placeholder: string, value: string, maxLen = 80): void {
  const el = hudInput();
  if (!el) return;
  el.hidden = !on;
  if (!on) return;
  el.style.left = left;
  el.style.top = top;
  el.style.width = width;
  el.placeholder = placeholder;
  el.maxLength = maxLen;
  if (document.activeElement !== el) el.value = value.slice(0, maxLen);
}

function homeItems(): MenuItem[] {
  return [
    { id: "start", label: "Start New Game" },
    { id: "resume", label: "Resume Game", disabled: savedLevel() < 1 },
    { id: "load", label: "Load Stage" },
    { id: "creator", label: "Stage Creator" },
    { id: "puzzles", label: "Puzzles" },
    { id: "history", label: "History" },
    { id: "credits", label: "Credits" },
    { id: "settings", label: "Settings" },
    { id: "legacy", label: "Legacy mode" },
  ];
}

function moveHome(dir: 1 | -1): void {
  const items = homeItems();
  if (!items.length) return;
  let i = homeCursor;
  for (let n = 0; n < items.length; n++) {
    i = (i + dir + items.length) % items.length;
    if (!items[i].disabled) {
      homeCursor = i;
      return;
    }
  }
}

function hudKey(): string {
  const s = loadSettings();
  return [
    extraView,
    homeCursor,
    savedLevel(),
    getName(),
    String(s.rumble),
    String(s.showTimer),
    String(s.music),
    String(s.sfx),
    currentTheme(),
    String(rebindAction),
    loadError,
    puzzleDiff,
    String(puzzleCount),
    paint.tool,
    paint.hint,
    beatLabel,
    String(beaten),
    draft.tiles.join(""),
    draft.spawn.join(","),
    String(loadRuns().length),
    JSON.stringify(s.keys),
  ].join("|");
}

function raiseHud(): void {
  const st = window.stage;
  if (!hud || !st?.setChildIndex || st.numChildren == null) return;
  st.setChildIndex(hud.root, st.numChildren - 1);
}

function paintHud(): void {
  if (!hud) return;
  if (!hudDirty) return;
  const key = hudKey();
  if (key === lastHudPaint) {
    hudDirty = false;
    return;
  }
  lastHudPaint = key;
  hudDirty = false;
  placeHudInput(false, "0", "0", "0", "", "");
  const s = loadSettings();
  if (extraView === "home") hud.drawHome(brandName(getName()), homeItems(), homeCursor);
  else if (extraView === "name") {
    hud.drawName();
    placeHudInput(true, "7.3%", "42.5%", "43%", "NAME", getName(), NAME_MAX);
  } else if (extraView === "credits") hud.drawCredits();
  else if (extraView === "load") {
    if (cachedDev) {
      hud.drawLoadStages();
    } else {
      hud.drawLoadPasscode(loadError);
      placeHudInput(true, "7.3%", "38%", "29%", "000000", "", 6);
    }
  } else if (extraView === "settings") {
    hud.drawSettings({
      rumble: s.rumble,
      showTimer: s.showTimer,
      music: s.music,
      sfx: s.sfx,
      theme: currentTheme(),
    });
    placeHudInput(true, "7.3%", "19.5%", "40%", "NAME", getName(), NAME_MAX);
  } else if (extraView === "remap") {
    hud.drawRemap(
      ACTIONS.map((id) => ({ id, label: ACTION_LABEL[id], bind: prettyKey(s.keys[id]) })),
      rebindAction,
    );
  } else if (extraView === "finish") {
    const st = window.stage;
    hud.drawFinish(st?.totalMoves ?? 0, st?.totalFalls ?? 0);
  } else if (extraView === "puzzles") {
    hud.drawPuzzles(puzzleDiff, puzzleCount, dailySeed(new Date(), puzzleDiff) + " · " + difficultyLabel(puzzleDiff));
    placeHudInput(true, "7.3%", "66%", "43%", "Seed (optional)", "");
  } else if (extraView === "history") {
    hud.drawHistory(
      loadRuns()
        .slice(0, 6)
        .map((rec) => {
          const lv = rec.levels.find((l) => winningTape(l));
          return {
            title: `${rec.player} · ${rec.complete ? "Finished" : "Stopped"} · ${rec.levels.length} stages`,
            meta: new Date(rec.at).toLocaleString(),
            replay: lv
              ? () => {
                  const cmds = winningTape(lv);
                  const def = campaignDefs()[(lv.stage || 1) - 1];
                  if (def && cmds) {
                    startCustom([def], "history");
                    enqueueSolve(cmds);
                  }
                }
              : undefined,
          };
        }),
    );
  } else if (extraView === "creator") {
    const issue = isPlayable(draft);
    hud.drawCreator({
      tiles: draft.tiles,
      spawn: draft.spawn,
      tool: paint.tool,
      badge: beatLabel,
      hint: paint.hint || "Paint a 15x10 stage. Split is pad, then cube A, then cube B.",
      seed: stageId(draft),
      canSave: beaten && !issue,
      marks: splitMarks(draft),
    });
    placeHudInput(true, "3.3%", "85.5%", "45%", "BXS- / BXS. / BX1. / name", hudInput()?.value || "");
  }
}

function openPanel(name: Screen): void {
  extraView = name;
  markHudDirty();
  lastHudPaint = "";
  if (name === "load") loadError = "";
  if (name === "creator") scheduleBeatCheck();
  if (name !== "remap") rebindAction = null;
  paintHud();
}

function applyTheme(theme: ThemeId): void {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    /* ignore */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("img", theme);
  window.location.href = url.toString();
}

function handleHudAction(act: string): void {
  if (act === "start") {
    run = {
      id: `${Date.now()}`,
      at: Date.now(),
      player: getName() || "BLOX",
      totalTimeMs: 0,
      totalMoves: 0,
      fails: 0,
      complete: false,
      levels: [],
    };
    beginPlay(1, { kind: "campaign", defs: [], returnTo: "home", record: true, classicRun: true });
  } else if (act === "resume") {
    const n = savedLevel();
    if (n) beginPlay(n, { kind: "campaign", defs: [], returnTo: "home", record: true, classicRun: true });
  } else if (act === "load") openPanel("load");
  else if (act === "load-go") loadPasscode();
  else if (act === "credits") openPanel("credits");
  else if (act === "legacy") {
    setMode("legacy");
    window.location.reload();
  } else if (act === "settings") openPanel("settings");
  else if (act === "remap") openPanel("remap");
  else if (act === "back") openPanel("home");
  else if (act === "creator") openPanel("creator");
  else if (act === "puzzles") openPanel("puzzles");
  else if (act === "history") openPanel("history");
  else if (act === "skip-name") {
    if (!getName()) setName("BLOX");
    openPanel("home");
  } else if (act === "name-continue") {
    const next = hudInput()?.value.trim();
    if (!next) return;
    setName(next);
    openPanel("home");
  } else if (act === "save-name") {
    const next = (hudInput()?.value.trim() || getName()).slice(0, NAME_MAX);
    if (!next) return;
    setName(next);
    openPanel("home");
  } else if (act === "toggle-rumble") {
    const s = loadSettings();
    s.rumble = !s.rumble;
    saveSettings(s);
    markHudDirty();
    paintHud();
  } else if (act === "toggle-timer") {
    const s = loadSettings();
    s.showTimer = !s.showTimer;
    saveSettings(s);
    markHudDirty();
    paintHud();
  } else if (act.startsWith("music:")) {
    const s = loadSettings();
    s.music = Number(act.slice(6));
    saveSettings(s);
    applyVolumes();
    ensureMenuMusic();
    markHudDirty();
    paintHud();
  } else if (act.startsWith("sfx:")) {
    const s = loadSettings();
    s.sfx = Number(act.slice(4));
    saveSettings(s);
    applyVolumes();
    markHudDirty();
    paintHud();
  } else if (act.startsWith("theme:")) {
    applyTheme(normalizeTheme(act.slice(6)));
  } else if (act.startsWith("rebind:")) {
    rebindAction = act.slice(7) as Action;
    markHudDirty();
    paintHud();
  } else if (act === "creator-test") playDraft();
  else if (act === "creator-save") saveDraft();
  else if (act === "creator-new") {
    draft = emptyDraft();
    beaten = false;
    paint = newPaintState();
    scheduleBeatCheck();
    markHudDirty();
    paintHud();
  } else if (act === "creator-load") loadShare();
  else if (act.startsWith("tool:")) {
    paint.tool = act.slice(5) as EditorToolId;
    paint.splitStep = 0;
    paint.splitAt = null;
    paint.linkFrom = null;
    markHudDirty();
    paintHud();
  } else if (act.startsWith("paint:")) {
    const parts = act.split(":");
    paintEditorCell(draft, Number(parts[1]), Number(parts[2]), paint);
    beaten = false;
    scheduleBeatCheck();
    markHudDirty();
    paintHud();
  } else if (act.startsWith("diff:")) {
    puzzleDiff = act.slice(5) as Difficulty;
    markHudDirty();
    paintHud();
  } else if (act.startsWith("len:")) {
    puzzleCount = Number(act.slice(4));
    markHudDirty();
    paintHud();
  } else if (act.startsWith("dev:")) {
    beginPlay(Number(act.slice(4)), { kind: "campaign", defs: [], returnTo: "load", record: false, classicRun: false });
  } else if (act === "puzzle-daily") {
    const p = generatePuzzle(dailySeed(new Date(), puzzleDiff), puzzleDiff);
    startCustom([p.def], "puzzles", "Daily");
  } else if (act === "puzzle-run") {
    const seed = hudInput()?.value.trim() || `seed-${Date.now()}`;
    startCustom(
      generateRun(seed, puzzleDiff, puzzleCount).map((p) => p.def),
      "puzzles",
      seed,
    );
  } else if (act === "dev-beat") beatCurrentStage();
  else if (act === "dev-menu") {
    returnToMenu();
    openPanel("load");
  }
}

function showFinish(): void {
  overlayMode = "";
  menuParked = false;
  parkCreateJsMenu();
  setMouseOverRate(5);
  hud?.setVisible(true);
  raiseHud();
  openPanel("finish");
  ensureMenuMusic();
  overlayMode = "menu";
}

function returnToMenu(): void {
  const stage = window.stage;
  if (stage) stage.doneIntro = true;
  overlayMode = "";
  menuParked = false;
  parkCreateJsMenu();
  setMouseOverRate(5);
  ensureMenuMusic();
  overlayMode = "menu";
}

function beginPlay(levelNumber: number, session: PlaySession): void {
  playSession = session;
  extraView = "auto";
  tape = [];
  lastLevelNum = levelNumber;
  overlayMode = "";
  enterPlayVisuals();
  unlockAudio();
  stopMenuMusic();
  const stage = window.stage;
  if (stage?.menuMusic) {
    stage.menuMusic.stop?.();
    stage.menuMusic = null;
  }
  if (stage) stage.levelNumber = levelNumber;
  (window as unknown as { setCurrentLevel?: (n: number) => void }).setCurrentLevel?.(levelNumber);
  syncSidePanel(!!session.classicRun && loadSettings().showTimer);
  window.exportRoot?.gotoAndPlay?.("game");
}

function startCustom(defs: LevelDef[], returnTo: Screen, title?: string): void {
  if (!defs.length) return;
  beginPlay(1, { kind: "custom", defs, returnTo, record: returnTo !== "creator", classicRun: false, title });
}

function cmdToCode(cmd: WalkCmd): string {
  if (cmd === "swap") return "Space";
  if (cmd === "up") return "ArrowUp";
  if (cmd === "down") return "ArrowDown";
  if (cmd === "left") return "ArrowLeft";
  return "ArrowRight";
}

function enqueueSolve(cmds: WalkCmd[]): void {
  solveQueue = cmds.slice();
  solveHold = Math.round(12 * TICK_SCALE);
}

function tickSolve(): void {
  const stage = window.stage;
  if (!stage?.triggerKeyDown || currentLabel() !== "game") return;
  if (solveHold > 0) {
    solveHold--;
    if (solveHold === Math.round(8 * TICK_SCALE) && solveCode) stage.triggerKeyUp?.({ code: solveCode });
    return;
  }
  const cmd = solveQueue.shift();
  if (!cmd) return;
  solveCode = cmdToCode(cmd);
  stage.triggerKeyDown({ code: solveCode });
  solveHold = Math.round((cmd === "swap" ? 10 : 18) * TICK_SCALE);
}

function beatCurrentStage(): void {
  const stage = window.stage;
  const n = stage?.levelNumber ?? 1;
  const def = playSession?.defs.length ? playSession.defs[n - 1] : campaignDefs()[n - 1];
  if (!def) return;
  const result = solveLevel(def, 200_000);
  if (!result.ok) return;
  enqueueSolve(result.cmds);
}

function commitTape(won: boolean, stageNo: number): void {
  if (!run || !playSession?.record) {
    tape = [];
    return;
  }
  let lv = run.levels.find((l) => l.stage === stageNo);
  if (!lv) {
    lv = { stage: stageNo, timeMs: 0, moves: tape.length, attempts: 0, tapes: [] };
    run.levels.push(lv);
  }
  lv.attempts += 1;
  lv.tapes.push({ cmds: tape.slice(), won });
  if (won) {
    lv.moves = tape.length;
    pushGhost(stageNo, tape);
  } else {
    run.fails += 1;
  }
  tape = [];
}

function scheduleBeatCheck(): void {
  window.clearTimeout(beatTimer);
  beatLabel = "Checking…";
  beatTimer = window.setTimeout(() => {
    const issue = isPlayable(draft);
    if (issue) beatLabel = issue;
    else beatLabel = checkBeatable(draft) ? "CAN BE BEAT" : "IMPOSSIBLE";
    if (extraView === "creator") {
      markHudDirty();
      paintHud();
    }
  }, 200);
}

function saveDraft(): void {
  if (!beaten) return;
  const issue = isPlayable(draft);
  if (issue) return;
  const raw = hudInput()?.value.trim() || "";
  const name = /^(BXS[-.]|BX1\.)/i.test(raw) ? "Untitled" : raw || "Untitled";
  const saved = {
    name,
    author: getName() || "Unknown",
    code: encodeLevel(draft),
    seed: stageId(draft),
    def: structuredClone(draft),
    source: "local" as const,
  };
  saveStage(saved);
  paint.hint = `Saved ${saved.seed}. ${encodeSeed(draft)}`;
  markHudDirty();
  paintHud();
}

function playDraft(): void {
  const issue = isPlayable(draft);
  if (issue) {
    paint.hint = issue;
    markHudDirty();
    paintHud();
    return;
  }
  startCustom([structuredClone(draft)], "creator");
}

function loadPasscode(): void {
  const field = hudInput();
  const value = ((field?.value || "") + "").replace(/\D/g, "").slice(0, 6);
  if (field) field.value = value;
  if (value.length !== 6) {
    loadError = "Enter a 6-digit passcode.";
    markHudDirty();
    paintHud();
    return;
  }
  const codes = (window as unknown as { getLevelCodes?: () => string[] }).getLevelCodes?.() || [];
  const index = codes.indexOf(value);
  if (index === -1) {
    loadError = "That passcode is not a campaign stage.";
    markHudDirty();
    paintHud();
    return;
  }
  loadError = "";
  beginPlay(index + 1, { kind: "campaign", defs: [], returnTo: "home", record: true, classicRun: false });
}

function loadShare(): void {
  const field = hudInput();
  const def = parseShare(field?.value || "", listSaved());
  if (!def) {
    paint.hint = "Could not read that code. Use BXS- / BXS. / BX1.";
    markHudDirty();
    paintHud();
    return;
  }
  draft = def;
  beaten = false;
  paint = newPaintState();
  paint.hint = "Loaded share code.";
  scheduleBeatCheck();
  markHudDirty();
  paintHud();
}

function bindMenuPad(): void {
  for (const ev of pollMenuPad()) {
    if (extraView === "home") {
      if (ev === "up") {
        moveHome(-1);
        markHudDirty();
        paintHud();
      } else if (ev === "down") {
        moveHome(1);
        markHudDirty();
        paintHud();
      } else if (ev === "confirm") {
        const item = homeItems()[homeCursor];
        if (item && !item.disabled) handleHudAction(item.id);
      }
    } else if (ev === "back" && extraView !== "name" && extraView !== "auto") {
      openPanel(extraView === "remap" ? "settings" : "home");
    }
  }
}

function bind(): void {
  if (bound) return;
  bound = true;

  const unlock = (): void => {
    unlockAudio();
    if (!isLegacy() && currentLabel() !== "game") ensureMenuMusic();
  };
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });

  $("exit-legacy")?.addEventListener("click", () => {
    setMode("extra");
    window.location.reload();
  });

  const input = hudInput();
  input?.addEventListener("keydown", (ev) => {
    ev.stopPropagation();
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    if (extraView === "name") handleHudAction("name-continue");
    else if (extraView === "load") handleHudAction("load-go");
    else if (extraView === "settings") handleHudAction("save-name");
    else if (extraView === "creator") handleHudAction("creator-load");
    else if (extraView === "puzzles") handleHudAction("puzzle-run");
  });
  input?.addEventListener("keyup", (ev) => ev.stopPropagation());
  input?.addEventListener("keypress", (ev) => ev.stopPropagation());

  window.addEventListener("keydown", (ev) => {
    if (isLegacy()) return;
    if (document.activeElement === hudInput()) return;

    if (extraView === "remap" && rebindAction) {
      ev.preventDefault();
      const s = loadSettings();
      s.keys[rebindAction] = ev.code === "Space" ? "Space" : ev.code;
      saveSettings(s);
      rebindAction = null;
      markHudDirty();
      paintHud();
      return;
    }

    if (currentLabel() === "game") {
      const act = actionFromCode(ev.code);
      let code = ev.code;
      if (act === "up") code = "ArrowUp";
      else if (act === "down") code = "ArrowDown";
      else if (act === "left") code = "ArrowLeft";
      else if (act === "right") code = "ArrowRight";
      else if (act === "swap") code = "Space";
      else if (act === "pause" || act === "back") code = "Escape";
      const cmd = KEY_CMD[code];
      if (cmd) tape.push(cmd);
      if (act && code !== ev.code) {
        ev.preventDefault();
        window.stage?.triggerKeyDown?.({ code });
      }
      return;
    }

    if (ev.key === "Escape" && extraView !== "home" && extraView !== "name" && extraView !== "auto") {
      openPanel(extraView === "remap" ? "settings" : "home");
      return;
    }
    if (extraView !== "home") return;
    if (ev.key === "ArrowDown") {
      moveHome(1);
      markHudDirty();
      paintHud();
    } else if (ev.key === "ArrowUp") {
      moveHome(-1);
      markHudDirty();
      paintHud();
    } else if (ev.key === "Enter") {
      const item = homeItems()[homeCursor];
      if (item && !item.disabled) handleHudAction(item.id);
    }
  });
}

function syncOverlay(): void {
  const exitBtn = $("exit-legacy");
  const version = $("build-version");
  const label = currentLabel();
  const stage = window.stage;
  const inRun =
    !!playSession &&
    (label === "game" || label === "restart" || label === "stagetitle" || label === "instructions");
  const playing = label === "game" || label === "restart";

  if (version) {
    const hide = inRun;
    if (versionHidden !== hide) {
      versionHidden = hide;
      version.style.display = hide ? "none" : "block";
    }
  }

  if (label === "restart" && lastLabel === "game") {
    rumble(180, 0.6, 0.4);
    commitTape(false, stage?.levelNumber ?? lastLevelNum);
  }

  if ((playing || label === "stagetitle") && stage) {
    if (lastLevelNum > 0 && stage.levelNumber > lastLevelNum) commitTape(true, lastLevelNum);
    lastLevelNum = stage.levelNumber;
  }

  if (label === "finish" && !isLegacy() && lastLabel !== "finish") {
    beaten = playSession?.returnTo === "creator" ? true : beaten;
    if (tape.length) commitTape(true, lastLevelNum || stage?.levelNumber || 1);
    if (run && playSession?.record) {
      run.complete = true;
      run.totalTimeMs = Date.now() - run.at;
      run.totalMoves = stage?.totalMoves ?? run.totalMoves;
      saveRun(run);
      run = null;
    }
    const back = playSession?.returnTo;
    lastLabel = label;
    overlayMode = "";
    menuParked = false;
    if (back === "creator" || back === "puzzles" || back === "history" || back === "load") {
      parkCreateJsMenu();
      setExportRootMouse(false);
      setMouseOverRate(5);
      playSession = null;
      hud?.setVisible(true);
      raiseHud();
      openPanel(back);
      ensureMenuMusic();
      overlayMode = "menu";
      return;
    }
    playSession = null;
    showFinish();
    overlayMode = "menu";
    return;
  }
  lastLabel = label;

  if (isLegacy()) {
    if (overlayMode !== "legacy") {
      overlayMode = "legacy";
      extraView = "auto";
      hud?.parkForPlay();
      placeHudInput(false, "0", "0", "0", "", "");
      menuParked = false;
      showGameSky(false);
      setExportRootMouse(true);
      setVanillaButtonsVisible(true);
      setMouseOverRate(0);
      sidePanelOn = null;
      syncSidePanel(true);
    }
    show(exitBtn, onMainMenu());
    return;
  }

  show(exitBtn, false);

  if (inRun) {
    if (overlayMode !== "run") {
      overlayMode = "run";
      enterPlayVisuals();
      raiseHud();
    }
    syncSidePanel(playing && !!playSession?.classicRun && loadSettings().showTimer);
    if (playing) {
      tickSolve();
      pollGamepad(stage);
      if (cachedDev) {
        if (!hud?.root.visible) {
          hud?.setVisible(true);
          raiseHud();
        }
        if (lastHudPaint !== "ingame") {
          lastHudPaint = "ingame";
          hud?.drawInGameDev();
        }
      } else if (hud?.root.visible) {
        hud?.setVisible(false);
      }
    } else if (hud?.root.visible) {
      hud?.setVisible(false);
    }
    return;
  }

  if (overlayMode !== "menu") {
    overlayMode = "menu";
    parkCreateJsMenu();
    setExportRootMouse(false);
    setMouseOverRate(5);
    hud?.setVisible(true);
    raiseHud();
    ensureMenuMusic();
  }

  bindMenuPad();
  if (extraView === "finish") {
    paintHud();
    return;
  }
  if (playSession?.returnTo && extraView === "auto") {
    const back = playSession.returnTo;
    playSession = null;
    openPanel(back);
    return;
  }
  if (!getName()) {
    if (extraView !== "name") openPanel("name");
    else paintHud();
  } else if (extraView === "auto" || extraView === "name") {
    openPanel("home");
  } else {
    paintHud();
  }
}

declare global {
  interface Window {
    exportRoot?: {
      currentLabel?: string;
      framerate?: number | null;
      splash?: { visible: boolean; stop?: () => void };
      menu?: {
        currentFrame: number;
        gotoAndStop: (n: number) => void;
        [k: string]: unknown;
      };
      gotoAndPlay?: (l: string) => void;
      gotoAndStop?: (l: string) => void;
    };
    stage?: StageLike;
    startBloxorzShell?: () => void;
    GAME_VERSION?: string;
    __bloxSetMouseOver?: (hz: number) => void;
    AdobeAn?: { getComposition: (id: string) => { getLibrary: () => LibCtor } };
    createjs?: {
      Sound?: {
        volume: number;
        play?: (...args: unknown[]) => unknown;
        activePlugin?: { context?: { resume?: () => Promise<unknown> } };
      };
      WebAudioPlugin?: { context?: { resume?: () => Promise<unknown> } };
      Ticker?: {
        addEventListener: (n: string, fn: () => void) => void;
        setFPS?: (n: number) => void;
        timingMode?: string;
        RAF_SYNCHED?: string;
        framerate?: number;
      };
    };
  }
}

export function startBloxorzShell(): void {
  const version = $("build-version");
  if (version) version.textContent = "v" + (window.GAME_VERSION || "2.6.0");
  refreshNameCache();
  gateSoundPlay();
  wrapGetLevels();
  bind();
  if (window.stage && !hud) {
    hud = new ExtraHud(window.stage as { addChild: (c: unknown) => void });
    hud.onAction = handleHudAction;
    hud.makeMascot = () => {
      const Spin = adobeLib()?.spinna;
      if (!Spin) return null;
      return new Spin() as never;
    };
  }
  if (!isLegacy()) {
    parkCreateJsMenu();
    setMouseOverRate(5);
    const sel = $("image_select") as HTMLSelectElement | null;
    if (sel) sel.value = currentTheme();
  }
  window.createjs?.Ticker?.addEventListener("tick", syncOverlay);
  syncOverlay();
}

window.startBloxorzShell = startBloxorzShell;

(function patchHitCanvas(): void {
  if (typeof HTMLCanvasElement === "undefined") return;
  const proto = HTMLCanvasElement.prototype as typeof HTMLCanvasElement.prototype & { __bloxHit?: boolean };
  if (proto.__bloxHit) return;
  proto.__bloxHit = true;
  const orig = proto.getContext;
  proto.getContext = function (this: HTMLCanvasElement, type: string, attrs?: CanvasRenderingContext2DSettings) {
    if (type === "2d") {
      return orig.call(this, type, { willReadFrequently: true, ...(attrs || {}) });
    }
    return orig.call(this, type, attrs);
  } as typeof orig;
})();
