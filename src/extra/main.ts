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
import { createJsToDef, defToCreateJs } from "./convert";
import { dailySeed, generatePuzzle, generateRun, type Difficulty } from "./generate";
import { actionFromCode, pollGamepad, pollMenuPad, rumble } from "./gamepad";
import { applyVolumes, ensureMenuMusic, gateSoundPlay, playDevJingle, playUiLatch, setMenuMusicAllowed, stopMenuMusic, unlockAudio } from "./audio";
import { fetchOnlineStages } from "./community";
import {
  loadFinishedStages,
  loadSeeGhosts,
  pushGhost,
  saveFinishedStage,
  saveRun,
  saveSeeGhosts,
  winningTape,
  type RunRecord,
  type TapeCmd,
} from "./history";
import {
  ACTIONS,
  ACTION_LABEL,
  brandName,
  currentTheme,
  hueCss,
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
import { CAMPAIGN_WALKTHROUGH, expandWalkthrough, type WalkCmd } from "./walkthrough";
import type { ClipName } from "./coolmathBoard";

type Screen =
  | "splash"
  | "name"
  | "home"
  | "settings"
  | "remap"
  | "creator"
  | "creator-make"
  | "creator-play"
  | "creator-edit"
  | "creator-manage"
  | "creator-offline"
  | "puzzles"
  | "history"
  | "load"
  | "credits"
  | "finish"
  | "online"
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
  metal_v2?: new () => unknown;
  metal_v3?: new () => unknown;
  softswitch_v3?: new () => unknown;
  hardswitch_v3?: new () => unknown;
  splitswitch_v2?: new () => unknown;
  stoneexit_v2?: new () => unknown;
  stone2_v2?: new () => unknown;
  Block?: new () => { gotoAndStop?: (n: string | number) => void };
  Tile?: new () => { gotoAndStop?: (n: string | number) => void };
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

let extraView: Screen = "splash";
let splashDone = false;
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
/** When true, next home paint slides menu rows in with whoosh. */
let animateHome = false;
let undoStack: LevelDef[] = [];
let redoStack: LevelDef[] = [];
let lastPaintCell = "";
let lastFinished: RunRecord | null = null;
let showStats = false;
let solvePending: WalkCmd[] | null = null;
let solveArm = 0;
let beatBanner = "";
let autoSolve = false;
let onlineRows: { title: string; meta: string; play: () => void }[] = [];
let onlineStatus = "";
let modalKind: "code" | "seed" | null = null;
type TintShape = {
  graphics: { clear: () => void; beginFill: (c: string) => { drawRect: (x: number, y: number, w: number, h: number) => void } };
  alpha: number;
  mouseEnabled: boolean;
  visible: boolean;
};
let tintLayer: TintShape | null = null;
let lastBlockHue = -1;

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
  const wasDev = cachedDev;
  try {
    localStorage.setItem(NAME_KEY, next);
    const s = loadSettings();
    s.playerName = next;
    saveSettings(s);
    cachedName = next;
    cachedDev = isDevName(next);
    nameRead = true;
    if (cachedDev && !wasDev) playDevJingle();
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

function applyThemeBg(): void {
  const on = loadSettings().themeBg;
  document.body.classList.toggle("no-theme-bg", !on);
  if (sky) sky.visible = sky.visible && on;
  applyLooks();
}

function ensureTint(): void {
  const st = window.stage;
  const cjs = window.createjs as { Shape?: new () => TintShape } | undefined;
  if (tintLayer || !st?.addChildAt || !cjs?.Shape) return;
  const layer = new cjs.Shape();
  layer.mouseEnabled = false;
  st.addChildAt(layer, sky ? 1 : 0);
  tintLayer = layer;
}

function applyLooks(): void {
  const s = loadSettings();
  document.body.classList.toggle("no-theme-bg", !s.themeBg);
  document.body.style.setProperty("--bg-tint", hueCss(s.bgHue, s.bgTint * 0.55));
  ensureTint();
  if (tintLayer) {
    tintLayer.graphics.clear();
    if (s.bgTint > 0.01) {
      tintLayer.graphics.beginFill(hueCss(s.bgHue, 1)).drawRect(0, 0, 550, 300);
      tintLayer.alpha = s.bgTint * 0.42;
      tintLayer.visible = true;
    } else {
      tintLayer.visible = false;
    }
  }
}

function showGameSky(on: boolean): void {
  ensureSky();
  const bg = loadSettings().themeBg;
  if (sky) sky.visible = on && bg;
  parkExportRoot(on);
  const box = window.stage?.gameContainer;
  if (box) box.visible = !on;
  document.body.classList.toggle("no-theme-bg", !bg);
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
  if (!on) {
    if (document.activeElement === el) el.blur();
    return;
  }
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
    String(s.themeBg),
    String(s.bgTint),
    String(s.bgHue),
    String(s.blockHue),
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
    String(loadFinishedStages().length),
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
  if (extraView === "splash") {
    hud.drawSplash();
  } else if (extraView === "home") {
    hud.drawHome(brandName(getName()), homeItems(), homeCursor, animateHome);
    animateHome = false;
  } else if (extraView === "name") {
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
      themeBg: s.themeBg,
      music: s.music,
      sfx: s.sfx,
      theme: currentTheme(),
      bgTint: s.bgTint,
      bgHue: s.bgHue,
      blockHue: s.blockHue,
    });
    placeHudInput(true, "18.2%", "10.6%", "40%", "", getName(), NAME_MAX);
  } else if (extraView === "remap") {
    hud.drawRemap(
      ACTIONS.map((id) => ({ id, label: ACTION_LABEL[id], bind: prettyKey(s.keys[id]) })),
      rebindAction,
    );
  } else if (extraView === "finish") {
    const st = window.stage;
    hud.drawFinish({
      moves: lastFinished?.totalMoves ?? st?.totalMoves ?? 0,
      falls: st?.totalFalls ?? 0,
      fails: lastFinished?.fails ?? 0,
      showStats,
      rows: (lastFinished?.levels ?? []).map((lv) => ({
        title: `Stage ${String(lv.stage).padStart(2, "0")}`,
        meta: `${lv.moves} moves · ${lv.attempts} attempts`,
      })),
    });
  } else if (extraView === "puzzles") {
    hud.drawPuzzles(puzzleDiff, puzzleCount);
  } else if (extraView === "history") {
    hud.drawHistory({
      seeGhosts: loadSeeGhosts(),
      rows: loadFinishedStages()
        .slice(0, 6)
        .map((rec) => {
          const title = rec.title || `Stage ${String(rec.stage).padStart(2, "0")}`;
          return {
            title: `${title} · ${rec.player} · ${rec.moves} moves`,
            meta: new Date(rec.at).toLocaleString(),
            replay:
              rec.cmds.length && (!rec.title || rec.title.startsWith("Stage"))
                ? () => {
                    const defs = rawCampaignDefs();
                    const def = defs[(rec.stage || 1) - 1];
                    if (def) {
                      startCustom([def], "history");
                      autoSolve = true;
                      solvePending = rec.cmds;
                      solveArm = 8;
                    }
                  }
                : undefined,
          };
        }),
    });
  } else if (extraView === "online") {
    hud.drawOnline(onlineRows, onlineStatus);
  } else if (extraView === "creator") {
    hud.drawCreatorHub("Stage Creator", [
      { id: "creator-make", label: "Create" },
      { id: "creator-play", label: "Play" },
      { id: "back", label: "Back" },
    ]);
  } else if (extraView === "creator-make") {
    hud.drawCreatorHub("Create", [
      { id: "creator-new-stage", label: "New Stage" },
      { id: "creator-manage", label: "Manage" },
      { id: "creator", label: "Back" },
    ]);
  } else if (extraView === "creator-play") {
    hud.drawCreatorHub("Play", [
      { id: "creator-load", label: "Enter Code" },
      { id: "creator-offline", label: "Offline" },
      { id: "online", label: "Online" },
      { id: "creator", label: "Back" },
    ]);
  } else if (extraView === "creator-manage") {
    hud.drawCreatorList(
      "Manage",
      listSaved().map((row) => ({
        title: row.name,
        meta: row.author + " · " + row.seed,
        play: () => {
          draft = structuredClone(row.def);
          beaten = true;
          paint = newPaintState();
          scheduleBeatCheck();
          openPanel("creator-edit");
        },
      })),
      "No saved stages yet. Paint one and Save.",
      "creator-make",
    );
  } else if (extraView === "creator-offline") {
    hud.drawCreatorList(
      "Offline",
      listSaved().map((row) => ({
        title: row.name,
        meta: row.author + " · " + row.seed,
        play: () => startCustom([structuredClone(row.def)], "creator-play", row.name),
      })),
      "No offline stages saved.",
      "creator-play",
    );
  } else if (extraView === "creator-edit") {
    const issue = isPlayable(draft);
    hud.drawCreator({
      tiles: draft.tiles,
      spawn: draft.spawn,
      tool: paint.tool,
      badge: beatLabel,
      hint: paint.hint,
      seed: stageId(draft),
      canSave: beaten && !issue,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      marks: splitMarks(draft),
    });
  }
}

function openPanel(name: Screen): void {
  extraView = name;
  markHudDirty();
  lastHudPaint = "";
  if (name === "home") animateHome = true;
  if (name === "load") loadError = "";
  if (name === "creator-edit") scheduleBeatCheck();
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

function rawCampaignDefs(): LevelDef[] {
  const raw = origGetLevels?.() ?? [];
  return raw.map((level, i) => createJsToDef(level as ReturnType<typeof defToCreateJs>, i));
}

function dismissSplash(): void {
  if (splashDone) return;
  splashDone = true;
  unlockAudio(() => {
    setMenuMusicAllowed(true);
    ensureMenuMusic();
  });
  if (!getName()) openPanel("name");
  else openPanel("home");
}

function goBack(): void {
  if (extraView === "settings") {
    const typed = hudInput()?.value.trim();
    if (typed) setName(typed);
    openPanel("home");
    return;
  }
  if (extraView === "remap") {
    openPanel("settings");
    return;
  }
  if (extraView === "creator-edit") {
    openPanel("creator-make");
    return;
  }
  if (extraView === "creator-make" || extraView === "creator-play") {
    openPanel("creator");
    return;
  }
  if (extraView === "creator-manage") {
    openPanel("creator-make");
    return;
  }
  if (extraView === "creator-offline" || extraView === "online") {
    openPanel("creator-play");
    return;
  }
  openPanel("home");
}

function persistWonStage(stageNo: number): void {
  if (!run || !playSession?.record) return;
  const lv = run.levels.find((l) => l.stage === stageNo);
  const cmds = lv ? winningTape(lv) : tape.length ? tape : null;
  if (!cmds?.length) return;
  saveFinishedStage({
    id: `${run.id}-${stageNo}`,
    at: Date.now(),
    player: run.player,
    stage: stageNo,
    moves: cmds.length,
    cmds,
    title: playSession.title || `Stage ${String(stageNo).padStart(2, "0")}`,
  });
}

function handleHudAction(act: string): void {
  if (act === "splash-continue") {
    dismissSplash();
    return;
  }
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
  else if (act === "back") goBack();
  else if (act === "creator") openPanel("creator");
  else if (act === "creator-make") openPanel("creator-make");
  else if (act === "creator-play") openPanel("creator-play");
  else if (act === "creator-new-stage") {
    draft = emptyDraft();
    beaten = false;
    paint = newPaintState();
    undoStack = [];
    redoStack = [];
    scheduleBeatCheck();
    openPanel("creator-edit");
  } else if (act === "creator-manage") openPanel("creator-manage");
  else if (act === "creator-offline") openPanel("creator-offline");
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
  } else if (act === "toggle-theme-bg") {
    const s = loadSettings();
    s.themeBg = !s.themeBg;
    saveSettings(s);
    applyThemeBg();
    showGameSky(true);
    markHudDirty();
    paintHud();
  } else if (act === "toggle-stats") {
    showStats = !showStats;
    markHudDirty();
    paintHud();
  } else if (act === "toggle-ghosts") {
    saveSeeGhosts(!loadSeeGhosts());
    markHudDirty();
    paintHud();
  } else if (act === "online") {
    openOnline();
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
  } else if (act.startsWith("bgtint:")) {
    const s = loadSettings();
    s.bgTint = Number(act.slice(7));
    saveSettings(s);
    applyLooks();
    markHudDirty();
    paintHud();
  } else if (act.startsWith("bghue:")) {
    const s = loadSettings();
    s.bgHue = Number(act.slice(6));
    saveSettings(s);
    applyLooks();
    markHudDirty();
    paintHud();
  } else if (act.startsWith("blockhue:")) {
    const s = loadSettings();
    s.blockHue = Number(act.slice(9));
    saveSettings(s);
    lastBlockHue = -1;
    applyBlockHue();
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
    pushUndo();
    draft = emptyDraft();
    beaten = false;
    paint = newPaintState();
    scheduleBeatCheck();
    markHudDirty();
    paintHud();
  } else if (act === "creator-clear") {
    pushUndo();
    draft = emptyDraft();
    draft.tiles = draft.tiles.map(() => "               ");
    draft.switches = [];
    draft.splits = [];
    beaten = false;
    paint = newPaintState();
    paint.hint = "Cleared.";
    scheduleBeatCheck();
    markHudDirty();
    paintHud();
  } else if (act === "creator-undo") creatorUndo();
  else if (act === "creator-redo") creatorRedo();
  else if (act === "creator-copy") copySeed();
  else if (act === "creator-load") openCodeModal();
  else if (act.startsWith("tool:")) {
    paint.tool = act.slice(5) as EditorToolId;
    paint.splitStep = 0;
    paint.splitAt = null;
    paint.linkFrom = null;
    markHudDirty();
    paintHud();
  } else if (act.startsWith("paint:")) {
    const parts = act.split(":");
    const x = Number(parts[1]);
    const y = Number(parts[2]);
    const phase = parts[3] || "start";
    const key = x + ":" + y;
    if (phase === "start") {
      pushUndo();
      lastPaintCell = "";
    }
    if (key === lastPaintCell && phase === "drag") return;
    lastPaintCell = key;
    paintEditorCell(draft, x, y, paint);
    beaten = false;
    hud?.refreshCreatorBoard({ tiles: draft.tiles, spawn: draft.spawn, marks: splitMarks(draft) });
  } else if (act === "paint-end") {
    lastPaintCell = "";
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
  } else if (act === "puzzle-run") openSeedModal();
  else if (act === "dev-beat") beatCurrentStage();
  else if (act === "dev-menu") {
    returnToMenu();
    openPanel("load");
  }
}

function cloneDef(d: LevelDef): LevelDef {
  return structuredClone(d);
}

function pushUndo(): void {
  undoStack.push(cloneDef(draft));
  if (undoStack.length > 80) undoStack.shift();
  redoStack = [];
}

function creatorUndo(): void {
  const prev = undoStack.pop();
  if (!prev) return;
  redoStack.push(cloneDef(draft));
  draft = prev;
  beaten = false;
  scheduleBeatCheck();
  markHudDirty();
  paintHud();
}

function creatorRedo(): void {
  const next = redoStack.pop();
  if (!next) return;
  undoStack.push(cloneDef(draft));
  draft = next;
  beaten = false;
  scheduleBeatCheck();
  markHudDirty();
  paintHud();
}

function copySeed(): void {
  const seed = encodeSeed(draft);
  void navigator.clipboard?.writeText(seed).catch(() => undefined);
  paint.hint = "Copied " + seed;
  markHudDirty();
  paintHud();
}

function modalBox(): HTMLElement | null {
  return $("hud-modal");
}

function modalInput(): HTMLInputElement | null {
  return $("hud-modal-input") as HTMLInputElement | null;
}

function openModal(kind: "code" | "seed", title: string, placeholder: string): void {
  modalKind = kind;
  const box = modalBox();
  const titleEl = $("hud-modal-title");
  const input = modalInput();
  if (titleEl) titleEl.textContent = title;
  if (input) {
    input.placeholder = placeholder;
    input.value = "";
    input.maxLength = kind === "seed" ? 80 : 80;
  }
  box?.classList.add("is-open");
  window.setTimeout(() => input?.focus(), 0);
}

function closeModal(): void {
  modalKind = null;
  modalBox()?.classList.remove("is-open");
}

function submitModal(): void {
  const value = modalInput()?.value.trim() || "";
  const kind = modalKind;
  closeModal();
  if (kind === "code") {
    const def = parseShare(value, listSaved());
    if (!def) {
      paint.hint = "Could not read that code. Use BXS- / BXS. / BX1.";
      markHudDirty();
      paintHud();
      return;
    }
    pushUndo();
    draft = def;
    beaten = false;
    paint = newPaintState();
    paint.hint = "Loaded share code.";
    scheduleBeatCheck();
    openPanel("creator-edit");
    return;
  }
  if (kind === "seed") {
    const seed = value || `seed-${Date.now()}`;
    startCustom(
      generateRun(seed, puzzleDiff, puzzleCount).map((p) => p.def),
      "puzzles",
      seed,
    );
  }
}

function openCodeModal(): void {
  openModal("code", "Enter stage code", "BXS- / BXS. / BX1.");
}

function openSeedModal(): void {
  openModal("seed", "Seeded run", "Seed (optional)");
}

async function openOnline(): Promise<void> {
  onlineStatus = "Loading community stages…";
  onlineRows = [];
  openPanel("online");
  const rows = await fetchOnlineStages();
  onlineStatus = rows.length ? "" : "No community stages found.";
  onlineRows = rows.map((row) => ({
    title: row.name,
    meta: row.author + " · " + row.seed,
    play: () => startCustom([structuredClone(row.def)], "online", row.name),
  }));
  markHudDirty();
  paintHud();
}

function playDef(): LevelDef | null {
  const n = window.stage?.levelNumber ?? 1;
  if (playSession?.defs.length) return playSession.defs[n - 1] ?? null;
  const raw = origGetLevels?.();
  if (raw?.[n - 1]) return createJsToDef(raw[n - 1] as ReturnType<typeof defToCreateJs>, n - 1);
  return rawCampaignDefs()[n - 1] ?? null;
}

function startMenuAudio(): void {
  setMenuMusicAllowed(true);
  ensureMenuMusic();
}

function hushPlayAudio(): void {
  setMenuMusicAllowed(false);
  stopMenuMusic();
}

function showFinish(): void {
  overlayMode = "";
  menuParked = false;
  parkCreateJsMenu();
  setMouseOverRate(5);
  hud?.setVisible(true);
  raiseHud();
  openPanel("finish");
  startMenuAudio();
  overlayMode = "menu";
}

function returnToMenu(): void {
  const stage = window.stage;
  if (stage) stage.doneIntro = true;
  overlayMode = "";
  menuParked = false;
  parkCreateJsMenu();
  setMouseOverRate(5);
  startMenuAudio();
  overlayMode = "menu";
}

function beginPlay(levelNumber: number, session: PlaySession): void {
  playSession = session;
  extraView = "auto";
  tape = [];
  lastLevelNum = levelNumber;
  overlayMode = "";
  enterPlayVisuals();
  hushPlayAudio();
  unlockAudio();
  const stage = window.stage;
  if (stage?.menuMusic) {
    stage.menuMusic.stop?.();
    stage.menuMusic = null;
  }
  if (stage) stage.levelNumber = levelNumber;
  (window as unknown as { setCurrentLevel?: (n: number) => void }).setCurrentLevel?.(levelNumber);
  syncSidePanel(!!session.classicRun && loadSettings().showTimer);
  const intro =
    session.classicRun && session.kind === "campaign" && levelNumber === 1 ? "instructions" : "stagetitle";
  window.exportRoot?.gotoAndPlay?.(intro);
}

function startCustom(defs: LevelDef[], returnTo: Screen, title?: string): void {
  if (!defs.length) return;
  beginPlay(1, { kind: "custom", defs, returnTo, record: returnTo !== "creator-edit", classicRun: false, title });
}

function cmdToCode(cmd: WalkCmd): string {
  if (cmd === "swap") return "Space";
  if (cmd === "up") return "ArrowUp";
  if (cmd === "down") return "ArrowDown";
  if (cmd === "left") return "ArrowLeft";
  return "ArrowRight";
}

type PlayBlock = { roll?: { idle?: boolean }; currentFrame?: number };

function playBlocks(): PlayBlock[] {
  const gc = window.stage?.gameContainer as { children?: { children?: PlayBlock[] }[] } | undefined;
  const out: PlayBlock[] = [];
  for (const child of gc?.children ?? []) {
    for (const node of child.children ?? []) {
      if (node.roll) out.push(node);
    }
  }
  return out;
}

function blocksIdle(): boolean {
  const blocks = playBlocks();
  if (!blocks.length) return false;
  return blocks.every((b) => b.roll?.idle);
}

function solveCmdsForCurrent(): WalkCmd[] | null {
  const def = playDef();
  if (def) {
    const result = solveLevel(def, 250_000);
    if (result.ok && result.cmds.length) return result.cmds;
  }
  const n = window.stage?.levelNumber ?? 1;
  if (!playSession?.defs.length && CAMPAIGN_WALKTHROUGH[n - 1]) {
    return expandWalkthrough(CAMPAIGN_WALKTHROUGH[n - 1]);
  }
  return null;
}

function stopAutoSolve(banner = ""): void {
  autoSolve = false;
  solvePending = null;
  solveQueue = [];
  if (solveCode) window.stage?.triggerKeyUp?.({ code: solveCode });
  solveCode = "";
  solveHold = 0;
  solveArm = 0;
  beatBanner = banner;
  lastHudPaint = "";
}

function tickSolve(): void {
  const stage = window.stage;
  if (!autoSolve) return;
  if (currentLabel() !== "game") return;
  if (!stage?.triggerKeyDown) return;

  if (solvePending) {
    if (!blocksIdle()) return;
    if (solveArm > 0) {
      solveArm--;
      return;
    }
    solveQueue = solvePending.slice();
    solvePending = null;
    beatBanner = "Auto-solve";
    lastHudPaint = "";
    hud?.drawInGameDev(beatBanner, true);
  }

  if (solveCode) {
    if (playBlocks().length && !blocksIdle()) {
      stage.triggerKeyUp?.({ code: solveCode });
      solveCode = "";
      solveHold = 0;
      return;
    }
    solveHold++;
    const last = !solveQueue.length;
    if (!last && solveHold > 10) {
      stage.triggerKeyUp?.({ code: solveCode });
      stage.triggerKeyDown({ code: solveCode });
      solveHold = 0;
    }
    return;
  }

  if (!solveQueue.length) return;
  if (playBlocks().length && !blocksIdle()) return;

  const cmd = solveQueue.shift();
  if (!cmd) return;
  solveCode = cmdToCode(cmd);
  solveHold = 0;
  stage.triggerKeyDown({ code: solveCode });
  if (cmd === "swap") {
    stage.triggerKeyUp?.({ code: solveCode });
    solveCode = "";
  }
}

function beatCurrentStage(): void {
  if (autoSolve) {
    stopAutoSolve("");
    hud?.drawInGameDev("", false);
    return;
  }
  const cmds = solveCmdsForCurrent();
  if (!cmds?.length) {
    beatBanner = "No solution found";
    hud?.drawInGameDev(beatBanner, false);
    return;
  }
  autoSolve = true;
  beatBanner = "Auto-solve";
  hud?.drawInGameDev(beatBanner, true);
  solvePending = cmds;
  solveQueue = [];
  solveCode = "";
  solveArm = 6;
  window.exportRoot?.gotoAndPlay?.("restart");
}

function syncHelpText(): void {
  const n = window.stage?.levelNumber ?? 0;
  const gc = window.stage?.gameContainer as {
    children?: { buttons?: unknown; menuButton?: unknown; roll?: unknown; totalFrames?: number; visible?: boolean; alpha?: number }[];
  } | undefined;
  for (const child of gc?.children ?? []) {
    if (child.buttons || child.menuButton || child.roll) continue;
    if (typeof child.totalFrames === "number" && child.totalFrames >= 40 && child.totalFrames <= 52) {
      const show = n === 1;
      child.visible = show;
      child.alpha = show ? 1 : 0;
    }
  }
}

function applyPlayTint(): void {
  const gc = window.stage?.gameContainer as {
    addChildAt?: (c: unknown, i: number) => void;
    children?: unknown[];
    __bloxTint?: TintShape;
  } | undefined;
  const cjs = window.createjs as { Shape?: new () => TintShape } | undefined;
  if (!gc?.addChildAt || !cjs?.Shape) return;
  let overlay = gc.__bloxTint;
  if (!overlay || !gc.children?.includes(overlay)) {
    overlay = new cjs.Shape();
    overlay.mouseEnabled = false;
    gc.addChildAt(overlay, Math.min(1, gc.children?.length ?? 0));
    gc.__bloxTint = overlay;
  }
  const s = loadSettings();
  overlay.graphics.clear();
  if (s.bgTint > 0.01) {
    overlay.graphics.beginFill(hueCss(s.bgHue, 1)).drawRect(0, 0, 550, 300);
    overlay.alpha = s.bgTint * 0.42;
    overlay.visible = true;
  } else {
    overlay.visible = false;
  }
}

function applyBlockHue(): void {
  const hue = loadSettings().blockHue;
  const cjs = window.createjs as {
    ColorMatrix?: new () => { adjustHue: (n: number) => unknown };
    ColorMatrixFilter?: new (m: unknown) => unknown;
  };
  const blocks = playBlocks() as (PlayBlock & {
    filters?: unknown;
    cache?: (x: number, y: number, w: number, h: number) => void;
    uncache?: () => void;
  })[];
  if (!blocks.length || !cjs.ColorMatrix || !cjs.ColorMatrixFilter) return;
  const rolling = blocks.some((b) => !b.roll?.idle);
  const key = hue * 1000 + (rolling ? -1 : 1);
  if (key === lastBlockHue) return;
  lastBlockHue = key;
  for (const block of blocks) {
    if (!hue || rolling) {
      block.uncache?.();
      if (!hue) block.filters = null;
      continue;
    }
    const deg = hue <= 180 ? hue : hue - 360;
    const matrix = new cjs.ColorMatrix();
    matrix.adjustHue(deg);
    block.filters = [new cjs.ColorMatrixFilter(matrix)];
    block.cache?.(-70, -110, 140, 180);
  }
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
  startCustom([structuredClone(draft)], "creator-edit");
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
    } else if (ev === "confirm" && extraView === "splash") {
      dismissSplash();
    } else if (ev === "back" && extraView !== "name" && extraView !== "auto" && extraView !== "splash") {
      goBack();
    }
  }
}

function bind(): void {
  if (bound) return;
  bound = true;

  const unlock = (): void => {
    unlockAudio(() => {
      const label = currentLabel();
      const playing = label === "game" || label === "restart" || label === "stagetitle" || label === "instructions";
      if (!isLegacy() && !playing && !playSession) startMenuAudio();
    });
  };
  $("hud-modal-ok")?.addEventListener("click", () => submitModal());
  $("hud-modal-cancel")?.addEventListener("click", () => closeModal());
  modalInput()?.addEventListener("keydown", (ev) => {
    ev.stopPropagation();
    if (ev.key === "Enter") {
      ev.preventDefault();
      submitModal();
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      closeModal();
    }
  });
  modalInput()?.addEventListener("keyup", (ev) => ev.stopPropagation());
  modalInput()?.addEventListener("keypress", (ev) => ev.stopPropagation());
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
    else if (extraView === "settings") {
      const next = input.value.trim();
      if (next) setName(next);
    } else if (extraView === "puzzles") handleHudAction("puzzle-run");
  });
  input?.addEventListener("keyup", (ev) => ev.stopPropagation());
  input?.addEventListener("keypress", (ev) => ev.stopPropagation());
  input?.addEventListener("input", () => {
    if (extraView !== "name" && extraView !== "settings") return;
    const next = (input.value || "").trim();
    if (isDevName(next) && !cachedDev) setName(next);
  });

  window.addEventListener("keyup", (ev) => {
    if (isLegacy() || currentLabel() !== "game") return;
    const act = actionFromCode(ev.code);
    let code = ev.code;
    if (act === "up") code = "ArrowUp";
    else if (act === "down") code = "ArrowDown";
    else if (act === "left") code = "ArrowLeft";
    else if (act === "right") code = "ArrowRight";
    else if (act === "swap") code = "Space";
    if (KEY_CMD[code] || act === "swap") window.stage?.triggerKeyUp?.({ code });
  });

  window.addEventListener("keydown", (ev) => {
    if (isLegacy()) return;
    if (extraView === "splash") {
      ev.preventDefault();
      dismissSplash();
      return;
    }
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
      if (cmd || act === "pause" || act === "back") {
        ev.preventDefault();
        window.stage?.triggerKeyDown?.({ code });
      }
      return;
    }

    if (ev.key === "Escape" && extraView !== "home" && extraView !== "name" && extraView !== "auto") {
      goBack();
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
      if (item && !item.disabled) {
        playUiLatch();
        handleHudAction(item.id);
      }
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
    if (autoSolve && !solvePending) {
      stopAutoSolve("Auto-solve failed");
    }
    if (!solvePending) {
      rumble(180, 0.6, 0.4);
      commitTape(false, stage?.levelNumber ?? lastLevelNum);
    }
  }

  if ((playing || label === "stagetitle") && stage) {
    if (lastLevelNum > 0 && stage.levelNumber > lastLevelNum) {
      commitTape(true, lastLevelNum);
      persistWonStage(lastLevelNum);
      if (autoSolve) stopAutoSolve("");
    }
    lastLevelNum = stage.levelNumber;
  }

  if (label === "finish" && !isLegacy() && lastLabel !== "finish") {
    if (autoSolve) stopAutoSolve("");
    beaten = playSession?.returnTo === "creator-edit" ? true : beaten;
    if (tape.length) {
      commitTape(true, lastLevelNum || stage?.levelNumber || 1);
      persistWonStage(lastLevelNum || stage?.levelNumber || 1);
    }
    if (run && playSession?.record) {
      run.complete = true;
      run.totalTimeMs = Date.now() - run.at;
      run.totalMoves = stage?.totalMoves ?? run.totalMoves;
      lastFinished = run;
      showStats = false;
      saveRun(run);
      run = null;
    }
    const back = playSession?.returnTo;
    lastLabel = label;
    overlayMode = "";
    menuParked = false;
    if (
      back === "creator" ||
      back === "creator-edit" ||
      back === "creator-play" ||
      back === "creator-make" ||
      back === "puzzles" ||
      back === "history" ||
      back === "load" ||
      back === "online"
    ) {
      parkCreateJsMenu();
      setExportRootMouse(false);
      setMouseOverRate(5);
      playSession = null;
      hud?.setVisible(true);
      raiseHud();
      openPanel(back);
      startMenuAudio();
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

  if (!splashDone && extraView === "splash") {
    if (overlayMode !== "menu") {
      overlayMode = "menu";
      parkCreateJsMenu();
      setExportRootMouse(false);
      setMouseOverRate(5);
      hud?.setVisible(true);
      raiseHud();
    }
    paintHud();
    return;
  }

  if (inRun) {
    if (overlayMode !== "run") {
      overlayMode = "run";
      hushPlayAudio();
      enterPlayVisuals();
      raiseHud();
    }
    syncSidePanel(playing && !!playSession?.classicRun && loadSettings().showTimer);
    if (playing) {
      tickSolve();
      pollGamepad(stage);
      syncHelpText();
      applyPlayTint();
      applyBlockHue();
      if (cachedDev) {
        if (!hud?.root.visible) {
          hud?.setVisible(true);
          raiseHud();
        }
        if (lastHudPaint !== "ingame:" + beatBanner + String(autoSolve)) {
          lastHudPaint = "ingame:" + beatBanner + String(autoSolve);
          hud?.drawInGameDev(beatBanner, autoSolve);
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
    startMenuAudio();
    if (extraView === "home") {
      animateHome = true;
      markHudDirty();
      lastHudPaint = "";
    }
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
  if (!splashDone) {
    if (extraView !== "splash") openPanel("splash");
    else paintHud();
  } else if (!getName()) {
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
  if (version) version.textContent = "v" + (window.GAME_VERSION || "2.8.0");
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
    hud.makeClip = (name: ClipName) => {
      if (name === "Block") return null;
      try {
        const lib = adobeLib() as unknown as Record<string, new () => unknown>;
        const Ctor = lib?.[name];
        if (!Ctor) return null;
        return new Ctor() as never;
      } catch {
        return null;
      }
    };
  }
  if (!isLegacy()) {
    parkCreateJsMenu();
    setMouseOverRate(5);
    applyLooks();
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
