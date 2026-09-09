import { cmdToCode, createFeeder, tickFeeder, type SolveFeeder } from "./autoSolve";
import { beatBadge, EDITOR_TOOLS, newPaintState, paintEditorCell, splitMarks, type EditorToolId } from "./editor";
import {
  deleteStage,
  emptyDraft,
  encodeSeed,
  findBySeed,
  isPlayable,
  listSaved,
  parseShare,
  saveStage,
  stageId,
} from "./customLevels";
import { createJsToDef, defToCreateJs } from "./convert";
import {
  difficultyLabel,
  GAUNTLET_LEN,
  generateDaily,
  generateRun,
  generateSeeded,
  utcDateLabel,
  type Difficulty,
} from "./generate";
import { actionFromCode, heldPadButtons, pollGamepad, pollMenuPad, rumble } from "./gamepad";
import { applyVolumes, ensureMenuMusic, gateSoundPlay, playDevJingle, playUiLatch, setMenuMusicAllowed, stopMenuMusic, unlockAudio } from "./audio";
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
import { bakeFrameBackup, collectBlockFrameIndexes, type FrameBackup } from "./hue";
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
  | "creator-saved"
  | "puzzles"
  | "puzzles-seeded"
  | "puzzles-gauntlet"
  | "history"
  | "load"
  | "credits"
  | "finish"
  | "auto";

type PlayCard = "classic" | "custom" | "daily" | "seeded" | "gauntlet";

type PlaySession = {
  kind: "campaign" | "custom";
  defs: LevelDef[];
  returnTo: Screen;
  record: boolean;
  classicRun: boolean;
  title?: string;
  subtitle?: string;
  card?: PlayCard;
  seed?: string;
  author?: string;
};

type CustomPlayOpts = {
  title?: string;
  subtitle?: string;
  card?: PlayCard;
  seed?: string;
  author?: string;
};

type BloxWorld = {
  destroy?: () => void;
  blocks?: { roll?: { idle?: boolean } }[];
  keys?: { code?: string };
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
  bloxWorld?: BloxWorld | null;
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

const NAME_KEY = "bloxorz-player-name";
const LIST_PAGE = 6;
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
let beatLabel = "Checking…";
let puzzleDiff: Difficulty = "easy";
let solveCode = "";
let solveFeeder: SolveFeeder | null = null;
let run: RunRecord | null = null;
let tape: TapeCmd[] = [];
let lastLabel = "";
let lastLevelNum = 0;
let origGetLevels: (() => unknown[]) | null = null;
let hud: ExtraHud | null = null;
let menuCursor = 0;
let loadError = "";
let hudDirty = true;
let lastHudPaint = "";
let bound = false;
let sky: SkyClip | null = null;
let rootParked = false;
let menuParked = false;
let rebindAction: Action | null = null;
let overlayMode: "run" | "menu" | "" = "";
let draftName = "Untitled";
let listScroll = 0;
let puzzleSeed = "";
let gauntletSeed = "";
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
let beatBanner = "";
let autoSolve = false;
let modalKind: "code-play" | "code-edit" | null = null;
type TintShape = {
  graphics: { clear: () => void; beginFill: (c: string) => { drawRect: (x: number, y: number, w: number, h: number) => void } };
  alpha: number;
  mouseEnabled: boolean;
  visible: boolean;
};
let tintLayer: TintShape | null = null;
let letterbox: TintShape | null = null;
let blocksWereIdle = true;
let prevPadButtons = new Set<number>();
let bakedHue = -1;
let atlasFrames: FrameBackup[] | null = null;
let atlasCanvas: HTMLCanvasElement | null = null;

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

function adobeComp(): {
  getLibrary: () => LibCtor;
  getSpriteSheet?: () => Record<string, SpriteSheetLike>;
} | undefined {
  return window.AdobeAn?.getComposition("FE31B685947E79408F0C8768D6EC8517");
}

function adobeLib(): LibCtor | undefined {
  return adobeComp()?.getLibrary();
}

type SpriteSheetLike = {
  getFrame?: (i: number) => { image?: CanvasImageSource; rect?: { x: number; y: number; width: number; height: number } } | null;
  _images?: CanvasImageSource[];
  _frames?: { image?: CanvasImageSource }[];
};

function adoptAtlasCanvas(sheet: SpriteSheetLike, source: CanvasImageSource): HTMLCanvasElement | null {
  let canvas: HTMLCanvasElement;
  if (source instanceof HTMLCanvasElement) {
    canvas = source;
  } else if (source instanceof HTMLImageElement) {
    canvas = document.createElement("canvas");
    canvas.width = source.naturalWidth || source.width;
    canvas.height = source.naturalHeight || source.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0);
  } else {
    return null;
  }
  if (sheet._images) {
    for (let i = 0; i < sheet._images.length; i++) sheet._images[i] = canvas;
  }
  for (const frame of sheet._frames ?? []) frame.image = canvas;
  return canvas;
}

function atlasSheet(): SpriteSheetLike | undefined {
  const fromComp = adobeComp()?.getSpriteSheet?.()?.bloxorz_atlas_;
  if (fromComp) return fromComp;
  const lib = adobeLib() as unknown as Record<string, new () => { spriteSheet?: SpriteSheetLike }>;
  try {
    const Ctor = lib?.blocka0000;
    return Ctor ? new Ctor().spriteSheet : undefined;
  } catch {
    return undefined;
  }
}

function collectBlockAtlas(): { canvas: HTMLCanvasElement; frames: FrameBackup[] } | null {
  const sheet = atlasSheet();
  const lib = adobeLib() as unknown as Record<string, unknown>;
  if (!sheet?.getFrame || !lib) return null;
  const indexes = collectBlockFrameIndexes(lib);
  if (!indexes.length) return null;
  let source: CanvasImageSource | null = null;
  const rects: { x: number; y: number; width: number; height: number }[] = [];
  for (const i of indexes) {
    const frame = sheet.getFrame(i);
    if (!frame?.rect || !frame.image) continue;
    source = frame.image;
    rects.push(frame.rect);
  }
  if (!source || !rects.length) return null;
  const canvas = adoptAtlasCanvas(sheet, source);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const frames = rects.map((r) => ({
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    original: ctx.getImageData(r.x, r.y, r.width, r.height),
  }));
  return { canvas, frames };
}

function applyBlockHue(): void {
  const hue = loadSettings().blockHue;
  if (hue === bakedHue && atlasFrames) return;
  if (!atlasFrames || !atlasCanvas) {
    const atlas = collectBlockAtlas();
    if (!atlas) return;
    atlasFrames = atlas.frames;
    atlasCanvas = atlas.canvas;
  }
  const ctx = atlasCanvas.getContext("2d");
  if (!ctx) return;
  for (const frame of atlasFrames) {
    ctx.putImageData(bakeFrameBackup(frame, hue), frame.x, frame.y);
  }
  bakedHue = hue;
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
  if (sidePanelOn === show) return;
  sidePanelOn = show;
  const panel = $("side_panel");
  const split = $("screen-split");
  if (!panel) return;
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

function currentLabel(): string {
  return window.exportRoot?.currentLabel || "";
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
  ];
}

function freshSeed(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const rng = Math.random();
  let n = Math.floor(rng * 0xffffffff) >>> 0;
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += alphabet[n % 32];
    n = Math.imul(n ^ (n >>> 13), 0x5bd1e995) >>> 0;
  }
  return s;
}

type NavItem = { id: string; disabled?: boolean; adjust?: (dir: -1 | 1) => void };

function clampStep(n: number, step: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n + step));
}

function navItems(): NavItem[] {
  const s = loadSettings();
  if (extraView === "splash") return [{ id: "splash-continue" }];
  if (extraView === "name") return [{ id: "name-continue" }, { id: "skip-name" }];
  if (extraView === "home") return homeItems();
  if (extraView === "credits") return [{ id: "back" }];
  if (extraView === "load") {
    if (cachedDev) {
      return [{ id: "back" }, ...Array.from({ length: 33 }, (_, i) => ({ id: "dev:" + (i + 1) }))];
    }
    return [{ id: "back" }, { id: "load-go" }];
  }
  if (extraView === "settings") {
    return [
      { id: "back" },
      { id: "music", adjust: (d) => handleHudAction("music:" + clampStep(s.music, d * 0.1, 0, 1).toFixed(2)) },
      { id: "sfx", adjust: (d) => handleHudAction("sfx:" + clampStep(s.sfx, d * 0.1, 0, 1).toFixed(2)) },
      { id: "toggle-rumble" },
      { id: "toggle-timer" },
      { id: "theme:original" },
      { id: "theme:gray" },
      { id: "theme:holiday" },
      { id: "toggle-theme-bg" },
      { id: "bgtint", adjust: (d) => handleHudAction("bgtint:" + clampStep(s.bgTint, d * 0.1, 0, 1).toFixed(2)) },
      { id: "bghue", adjust: (d) => handleHudAction("bghue:" + String(clampStep(s.bgHue, d * 12, 0, 360))) },
      { id: "blockhue", adjust: (d) => handleHudAction("blockhue:" + String(clampStep(s.blockHue, d * 12, 0, 360))) },
      { id: "remap" },
    ];
  }
  if (extraView === "remap") {
    return [{ id: "settings" }, ...ACTIONS.map((id) => ({ id: "rebind:" + id }))];
  }
  if (extraView === "puzzles") {
    return [{ id: "back" }, { id: "puzzle-daily" }, { id: "puzzles-seeded" }, { id: "puzzles-gauntlet" }];
  }
  if (extraView === "puzzles-seeded") {
    return [{ id: "puzzles" }, { id: "puzzle-seed-go" }];
  }
  if (extraView === "puzzles-gauntlet") {
    return [
      { id: "puzzles" },
      { id: "diff:easy" },
      { id: "diff:medium" },
      { id: "diff:hard" },
      { id: "diff:insane" },
      { id: "gauntlet-go" },
    ];
  }
  if (extraView === "history") {
    const rows = loadFinishedStages().slice(0, 6);
    return [
      { id: "back" },
      { id: "toggle-ghosts" },
      ...rows.flatMap((rec, i) =>
        rec.cmds.length && (!rec.title || rec.title.startsWith("Stage")) ? [{ id: "replay:" + i }] : [],
      ),
    ];
  }
  if (extraView === "finish") return [{ id: "toggle-stats" }, { id: "back" }];
  if (extraView === "creator") {
    return [{ id: "creator-make" }, { id: "creator-play" }, { id: "back" }];
  }
  if (extraView === "creator-make") {
    return [{ id: "creator-new-stage" }, { id: "creator-manage" }, { id: "creator" }];
  }
  if (extraView === "creator-play") {
    return [{ id: "creator-load" }, { id: "creator-saved" }, { id: "creator" }];
  }
  if (extraView === "creator-manage" || extraView === "creator-saved") {
    const rows = listSaved().slice(listScroll, listScroll + LIST_PAGE);
    const prefix = extraView === "creator-manage" ? "manage:" : "saved:";
    const back = extraView === "creator-manage" ? "creator-make" : "creator-play";
    const items: NavItem[] = [{ id: back }];
    rows.forEach((_, i) => {
      const idx = listScroll + i;
      items.push({ id: prefix + idx });
      if (extraView === "creator-manage") items.push({ id: "delete:" + idx });
    });
    return items;
  }
  if (extraView === "creator-edit") {
    const issue = isPlayable(draft);
    return [
      { id: "creator-make" },
      { id: "creator-test" },
      ...EDITOR_TOOLS.map((tool) => ({ id: "tool:" + tool.id })),
      { id: "creator-new" },
      { id: "creator-clear" },
      { id: "creator-undo", disabled: undoStack.length === 0 },
      { id: "creator-redo", disabled: redoStack.length === 0 },
      { id: "creator-save", disabled: !beaten || !!issue },
      { id: "creator-copy" },
      { id: "creator-load" },
    ];
  }
  return [{ id: "back" }];
}

function handleMenuNav(ev: "up" | "down" | "left" | "right" | "confirm" | "back"): void {
  if (extraView === "remap" && rebindAction) return;
  if (extraView === "splash") {
    if (ev === "confirm" || ev === "back") dismissSplash();
    return;
  }
  const items = navItems();
  if (ev === "up") {
    moveNav(-1);
    markHudDirty();
    paintHud();
    return;
  }
  if (ev === "down") {
    moveNav(1);
    markHudDirty();
    paintHud();
    return;
  }
  const item = items[menuCursor];
  if (ev === "left") {
    item?.adjust?.(-1);
    return;
  }
  if (ev === "right") {
    item?.adjust?.(1);
    return;
  }
  if (ev === "confirm") {
    if (item && !item.disabled) {
      if (item.adjust) item.adjust(1);
      else handleHudAction(item.id);
    }
    return;
  }
  if (ev === "back" && extraView !== "name" && extraView !== "auto") goBack();
}

function moveNav(dir: 1 | -1): void {
  if (extraView === "creator-manage" || extraView === "creator-saved") {
    const total = listSaved().length;
    const maxScroll = Math.max(0, total - LIST_PAGE);
    if (dir === 1 && menuCursor >= navItems().length - 1 && listScroll < maxScroll) {
      listScroll += 1;
      menuCursor = Math.max(1, navItems().length - (extraView === "creator-manage" ? 2 : 1));
      return;
    }
    if (dir === -1 && menuCursor <= 1 && listScroll > 0) {
      listScroll -= 1;
      menuCursor = 1;
      return;
    }
  }
  const items = navItems();
  if (!items.length) return;
  let i = menuCursor;
  for (let n = 0; n < items.length; n++) {
    i = (i + dir + items.length) % items.length;
    if (!items[i].disabled) {
      menuCursor = i;
      return;
    }
  }
}

function hudKey(): string {
  const s = loadSettings();
  return [
    extraView,
    menuCursor,
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
    puzzleSeed,
    gauntletSeed,
    draftName,
    String(listScroll),
    paint.tool,
    paint.hint,
    beatLabel,
    String(beaten),
    draft.tiles.join(""),
    draft.spawn.join(","),
    String(loadFinishedStages().length),
    JSON.stringify(s.keys),
    JSON.stringify(s.pads),
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
  const nav = navItems();
  if (menuCursor >= nav.length) menuCursor = Math.max(0, nav.length - 1);
  hud.focusId = nav[menuCursor]?.id ?? "";
  placeHudInput(false, "0", "0", "0", "", "");
  const s = loadSettings();
  if (extraView === "splash") {
    hud.drawSplash();
  } else if (extraView === "home") {
    hud.drawHome(brandName(getName()), homeItems(), menuCursor, animateHome);
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
      ACTIONS.map((id) => ({
        id,
        label: ACTION_LABEL[id],
        bind: prettyKey(s.keys[id]) + " · pad " + s.pads[id],
      })),
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
    hud.drawPuzzles();
  } else if (extraView === "puzzles-seeded") {
    hud.drawSeeded();
    placeHudInput(true, "7.3%", "37.5%", "51%", "SEED", puzzleSeed, 24);
  } else if (extraView === "puzzles-gauntlet") {
    hud.drawGauntlet(puzzleDiff);
    placeHudInput(true, "7.3%", "53.5%", "51%", "SEED", gauntletSeed, 24);
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
                      startCustom([def], "history", { card: "classic" });
                      autoSolve = true;
                      solveFeeder = createFeeder(rec.cmds);
                    }
                  }
                : undefined,
          };
        }),
    });
  } else if (extraView === "creator") {
    hud.drawCreatorHub("Stage Creator", [
      { id: "creator-make", label: "Create" },
      { id: "creator-play", label: "Play" },
      { id: "back", label: "Back" },
    ], menuCursor);
  } else if (extraView === "creator-make") {
    hud.drawCreatorHub("Create", [
      { id: "creator-new-stage", label: "New Stage" },
      { id: "creator-manage", label: "Manage" },
      { id: "creator", label: "Back" },
    ], menuCursor);
  } else if (extraView === "creator-play") {
    hud.drawCreatorHub("Play", [
      { id: "creator-load", label: "Enter Code" },
      { id: "creator-saved", label: "Saved" },
      { id: "creator", label: "Back" },
    ], menuCursor);
  } else if (extraView === "creator-manage" || extraView === "creator-saved") {
    const all = listSaved();
    const maxScroll = Math.max(0, all.length - LIST_PAGE);
    if (listScroll > maxScroll) listScroll = maxScroll;
    const page = all.slice(listScroll, listScroll + LIST_PAGE);
    hud.drawCreatorList({
      title: extraView === "creator-manage" ? "Manage" : "Saved",
      rows: page.map((row, i) => {
        const idx = listScroll + i;
        return {
          title: row.name,
          meta: row.author + " · " + row.seed,
          openId: (extraView === "creator-manage" ? "manage:" : "saved:") + idx,
          deleteId: extraView === "creator-manage" ? "delete:" + idx : undefined,
        };
      }),
      empty:
        extraView === "creator-manage"
          ? "No saved stages yet. Paint one and Save."
          : "No saved stages yet.",
      backId: extraView === "creator-manage" ? "creator-make" : "creator-play",
      scroll: listScroll,
      total: all.length,
      pageSize: LIST_PAGE,
    });
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
    placeHudInput(true, "21.5%", "2.1%", "36%", "STAGE NAME", draftName, 24);
  }
}

function openPanel(name: Screen): void {
  extraView = name;
  menuCursor = 0;
  markHudDirty();
  lastHudPaint = "";
  if (name === "home") animateHome = true;
  if (name === "load") loadError = "";
  if (name === "creator-manage" || name === "creator-saved") listScroll = 0;
  if (name === "puzzles-seeded") puzzleSeed = freshSeed();
  if (name === "puzzles-gauntlet") gauntletSeed = freshSeed();
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
  if (extraView === "creator-saved") {
    openPanel("creator-play");
    return;
  }
  if (extraView === "puzzles-seeded" || extraView === "puzzles-gauntlet") {
    openPanel("puzzles");
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
  else if (act === "settings") openPanel("settings");
  else if (act === "remap") openPanel("remap");
  else if (act === "back") goBack();
  else if (act === "creator") openPanel("creator");
  else if (act === "creator-make") openPanel("creator-make");
  else if (act === "creator-play") openPanel("creator-play");
  else if (act === "creator-new-stage") {
    draft = emptyDraft();
    draftName = "Untitled";
    beaten = false;
    paint = newPaintState();
    undoStack = [];
    redoStack = [];
    scheduleBeatCheck();
    openPanel("creator-edit");
  } else if (act === "creator-manage") openPanel("creator-manage");
  else if (act === "creator-saved") openPanel("creator-saved");
  else if (act === "puzzles") openPanel("puzzles");
  else if (act === "puzzles-seeded") openPanel("puzzles-seeded");
  else if (act === "puzzles-gauntlet") openPanel("puzzles-gauntlet");
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
    if (s.rumble) rumble(180, 0.6, 0.5);
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
    draftName = "Untitled";
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
  else if (act === "creator-load") {
    if (extraView === "creator-play") openPlayCodeModal();
    else openCodeModal();
  }
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
  } else if (act.startsWith("dev:")) {
    beginPlay(Number(act.slice(4)), { kind: "campaign", defs: [], returnTo: "load", record: false, classicRun: false, card: "classic" });
  } else if (act === "puzzle-daily") playDaily();
  else if (act === "puzzle-seed-go") playSeededRun(hudInput()?.value.trim() || puzzleSeed);
  else if (act === "gauntlet-go") playGauntlet(hudInput()?.value.trim() || gauntletSeed, puzzleDiff);
  else if (act === "dev-beat") beatCurrentStage();
  else if (act === "dev-menu") {
    leavePlayTo("load");
  } else if (act.startsWith("manage:")) {
    const row = listSaved()[Number(act.slice(7))];
    if (!row) return;
    draft = structuredClone(row.def);
    draftName = row.name || "Untitled";
    beaten = true;
    paint = newPaintState();
    scheduleBeatCheck();
    openPanel("creator-edit");
  } else if (act.startsWith("saved:")) {
    const row = listSaved()[Number(act.slice(6))];
    if (row) playSavedStage(row, "creator-saved");
  } else if (act.startsWith("delete:")) {
    const row = listSaved()[Number(act.slice(7))];
    if (!row) return;
    deleteStage(row.code);
    const maxScroll = Math.max(0, listSaved().length - LIST_PAGE);
    if (listScroll > maxScroll) listScroll = maxScroll;
    markHudDirty();
    paintHud();
  } else if (act.startsWith("replay:")) {
    const rec = loadFinishedStages()[Number(act.slice(7))];
    if (!rec?.cmds.length) return;
    const defs = rawCampaignDefs();
    const def = defs[(rec.stage || 1) - 1];
    if (!def) return;
    startCustom([def], "history", { card: "classic" });
    autoSolve = true;
    solveFeeder = createFeeder(rec.cmds);
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
  paint.hint = "Copied reverse seed " + seed;
  markHudDirty();
  paintHud();
}

function modalBox(): HTMLElement | null {
  return $("hud-modal");
}

function modalInput(): HTMLInputElement | null {
  return $("hud-modal-input") as HTMLInputElement | null;
}

function openModal(kind: "code-play" | "code-edit", title: string, placeholder: string): void {
  modalKind = kind;
  const box = modalBox();
  const titleEl = $("hud-modal-title");
  const input = modalInput();
  if (titleEl) titleEl.textContent = title;
  if (input) {
    input.placeholder = placeholder;
    input.value = "";
    input.maxLength = 160;
  }
  box?.classList.add("is-open");
  window.setTimeout(() => input?.focus(), 0);
}

function closeModal(): void {
  modalKind = null;
  modalBox()?.classList.remove("is-open");
}

function playShareDef(def: ReturnType<typeof parseShare>, returnTo: Screen): void {
  if (!def) return;
  const saved = findBySeed(stageId(def), listSaved());
  startCustom([def], returnTo, {
    card: "custom",
    title: saved?.name || "CUSTOM STAGE",
    subtitle: saved?.author || "",
    author: saved?.author,
  });
}

function submitModal(): void {
  const value = modalInput()?.value.trim() || "";
  const kind = modalKind;
  closeModal();
  if (kind === "code-play") {
    const def = parseShare(value, listSaved());
    if (!def) {
      openPlayCodeModal();
      const titleEl = $("hud-modal-title");
      if (titleEl) titleEl.textContent = "Could not read that code.";
      return;
    }
    playShareDef(def, "creator-play");
    return;
  }
  if (kind === "code-edit") {
    const def = parseShare(value, listSaved());
    if (!def) {
      paint.hint = "Could not read that reverse seed. Paste a BXS. code.";
      markHudDirty();
      paintHud();
      return;
    }
    pushUndo();
    draft = def;
    draftName = "Untitled";
    beaten = false;
    paint = newPaintState();
    paint.hint = "Loaded share code.";
    scheduleBeatCheck();
    openPanel("creator-edit");
  }
}

function openCodeModal(): void {
  openModal("code-edit", "Enter reverse seed", "BXS. reverse seed");
}

function openPlayCodeModal(): void {
  openModal("code-play", "Enter code", "Paste a BXS. share code");
}

function playDaily(): void {
  const day = utcDateLabel();
  const p = generateDaily(new Date());
  startCustom([p.def], "puzzles", {
    card: "daily",
    title: "DAILY PUZZLE",
    subtitle: day,
    seed: p.seed,
  });
}

function playSeededRun(seed: string): void {
  const clean = seed.trim() || freshSeed();
  puzzleSeed = clean;
  const p = generateSeeded(clean);
  startCustom([p.def], "puzzles-seeded", {
    card: "seeded",
    title: "SEEDED RUN",
    subtitle: clean,
    seed: clean,
  });
}

function playGauntlet(seed: string, diff: Difficulty): void {
  const clean = seed.trim() || freshSeed();
  gauntletSeed = clean;
  const run = generateRun(clean, diff, GAUNTLET_LEN);
  startCustom(
    run.map((p) => p.def),
    "puzzles-gauntlet",
    {
      card: "gauntlet",
      title: "GAUNTLET " + difficultyLabel(diff).toUpperCase(),
      subtitle: clean,
      seed: clean,
    },
  );
}

function playSavedStage(row: { name: string; author: string; def: LevelDef }, returnTo: Screen): void {
  startCustom([structuredClone(row.def)], returnTo, {
    card: "custom",
    title: row.name || "CUSTOM STAGE",
    subtitle: row.author,
    author: row.author,
  });
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

function leavePlayTo(view: Screen): void {
  window.stage?.bloxWorld?.destroy?.();
  playSession = null;
  stopAutoSolve("");
  extraView = view;
  overlayMode = "";
  window.exportRoot?.gotoAndStop?.("menu");
  menuParked = false;
  parkCreateJsMenu();
  setMouseOverRate(5);
  hud?.setVisible(true);
  raiseHud();
  startMenuAudio();
  overlayMode = "menu";
  openPanel(view);
}

function beginPlay(levelNumber: number, session: PlaySession): void {
  playSession = session;
  extraView = "auto";
  tape = [];
  lastLevelNum = levelNumber;
  overlayMode = "run";
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

function startCustom(defs: LevelDef[], returnTo: Screen, opts: CustomPlayOpts = {}): void {
  if (!defs.length) return;
  beginPlay(1, {
    kind: "custom",
    defs,
    returnTo,
    record: returnTo !== "creator-edit",
    classicRun: false,
    title: opts.title,
    subtitle: opts.subtitle,
    card: opts.card ?? "custom",
    seed: opts.seed,
    author: opts.author,
  });
}

function usesVanillaTitle(): boolean {
  if (!playSession) return true;
  if (playSession.card === "classic") return true;
  if (playSession.kind === "campaign" && !playSession.defs.length) return true;
  return false;
}

function titleCardCopy(): { title: string; subtitle: string } | null {
  if (!playSession || usesVanillaTitle()) return null;
  const n = window.stage?.levelNumber ?? 1;
  const total = playSession.defs.length;
  let subtitle = playSession.subtitle || playSession.author || playSession.seed || "";
  if (playSession.card === "gauntlet" && total > 1) {
    subtitle = [playSession.subtitle || playSession.seed || "", `${n}/${total}`].filter(Boolean).join("   ");
  }
  return {
    title: playSession.title || "CUSTOM STAGE",
    subtitle,
  };
}

function setVanillaTitleVisible(on: boolean): void {
  const title = window.exportRoot?.stagetitle as { visible?: boolean } | undefined;
  if (title) title.visible = on;
}

function syncLetterbox(on: boolean): void {
  const st = window.stage;
  const cjs = window.createjs as { Shape?: new () => TintShape } | undefined;
  if (!st?.addChildAt || !cjs?.Shape) {
    document.body.classList.toggle("title-letterbox", on);
    return;
  }
  if (!letterbox) {
    letterbox = new cjs.Shape();
    letterbox.graphics.beginFill("#000").drawRect(0, 0, 550, 300);
    letterbox.mouseEnabled = false;
    st.addChildAt(letterbox, 0);
  }
  letterbox.visible = on;
  if (on && st.setChildIndex) st.setChildIndex(letterbox, 0);
  document.body.classList.toggle("title-letterbox", on);
}

type PlayBlock = {
  roll?: { idle?: boolean };
  currentFrame?: number;
  children?: PlayBlock[];
  image?: unknown;
  spriteSheet?: unknown;
  filters?: unknown;
  cacheID?: number;
  __bloxHue?: number;
  cache?: (x: number, y: number, w: number, h: number) => void;
  updateCache?: () => void;
  uncache?: () => void;
  getBounds?: () => { x: number; y: number; width: number; height: number } | null;
};

function walkNodes(node: PlayBlock | undefined, fn: (n: PlayBlock) => void): void {
  if (!node) return;
  fn(node);
  for (const child of node.children ?? []) walkNodes(child, fn);
}

function playBlocks(): PlayBlock[] {
  const live = window.stage?.bloxWorld?.blocks;
  if (live?.length) return live as PlayBlock[];
  const gc = window.stage?.gameContainer as PlayBlock | undefined;
  const out: PlayBlock[] = [];
  walkNodes(gc, (node) => {
    if (node.roll) out.push(node);
  });
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
  if (playSession?.kind === "campaign" && !playSession.defs.length && CAMPAIGN_WALKTHROUGH[n - 1]) {
    return expandWalkthrough(CAMPAIGN_WALKTHROUGH[n - 1]);
  }
  return null;
}

function stopAutoSolve(banner = ""): void {
  autoSolve = false;
  solveFeeder = null;
  if (solveCode) window.stage?.triggerKeyUp?.({ code: solveCode });
  solveCode = "";
  beatBanner = banner;
  lastHudPaint = "";
}

function tickSolve(): void {
  const stage = window.stage;
  if (!autoSolve || !solveFeeder) return;
  if (currentLabel() !== "game") return;
  if (!stage?.triggerKeyDown) return;
  const hasBlock = playBlocks().length > 0;
  const idle = hasBlock && blocksIdle();
  const act = tickFeeder(solveFeeder, { idle, hasBlock });
  if (act.release && solveCode) {
    stage.triggerKeyUp?.({ code: solveCode });
    solveCode = "";
  }
  if (act.press === "swap") {
    solveCode = cmdToCode("swap");
    stage.triggerKeyDown({ code: solveCode });
    stage.triggerKeyUp?.({ code: solveCode });
    solveCode = "";
  } else if (act.press) {
    solveCode = cmdToCode(act.press);
    stage.triggerKeyDown({ code: solveCode });
  } else if (act.hold) {
    solveCode = cmdToCode(act.hold);
    stage.triggerKeyDown({ code: solveCode });
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
  solveFeeder = createFeeder(cmds);
  solveCode = "";
  window.stage?.bloxWorld?.destroy?.();
  window.exportRoot?.gotoAndPlay?.("restart");
}

function syncHelpText(): void {
  const classicFirst =
    !!playSession?.classicRun && playSession.kind === "campaign" && (window.stage?.levelNumber ?? 0) === 1;
  const gc = window.stage?.gameContainer as {
    children?: { buttons?: unknown; menuButton?: unknown; roll?: unknown; totalFrames?: number; visible?: boolean; alpha?: number }[];
  } | undefined;
  for (const child of gc?.children ?? []) {
    if (child.buttons || child.menuButton || child.roll) continue;
    if (typeof child.totalFrames === "number" && child.totalFrames >= 40 && child.totalFrames <= 52) {
      child.visible = classicFirst;
      child.alpha = classicFirst ? 1 : 0;
    }
  }
}

function applyPlayTint(): void {
  const gc = window.stage?.gameContainer as {
    addChildAt?: (c: unknown, i: number) => void;
    setChildIndex?: (c: unknown, i: number) => void;
    children?: unknown[];
    numChildren?: number;
    __bloxTint?: TintShape;
  } | undefined;
  const cjs = window.createjs as { Shape?: new () => TintShape } | undefined;
  if (!gc?.addChildAt || !cjs?.Shape) return;
  let overlay = gc.__bloxTint;
  if (!overlay || !gc.children?.includes(overlay)) {
    overlay = new cjs.Shape();
    overlay.mouseEnabled = false;
    gc.addChildAt(overlay, 1);
    gc.__bloxTint = overlay;
  } else if (gc.setChildIndex) {
    const top = Math.max(0, (gc.numChildren ?? gc.children?.length ?? 1) - 1);
    gc.setChildIndex(overlay, Math.min(1, top));
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
  beatLabel = beatBadge(draft, isPlayable(draft));
  if (extraView === "creator-edit" || extraView === "creator") {
    markHudDirty();
    paintHud();
  }
}

function saveDraft(): void {
  if (!beaten) return;
  const issue = isPlayable(draft);
  if (issue) return;
  const raw = (hudInput()?.value.trim() || draftName).trim();
  const name = /^(BXS[-.]|BX1\.)/i.test(raw) ? draftName || "Untitled" : raw || "Untitled";
  draftName = name;
  const saved = {
    name,
    author: getName() || "Unknown",
    code: encodeSeed(draft),
    seed: stageId(draft),
    def: structuredClone(draft),
    source: "local" as const,
  };
  saveStage(saved);
  paint.hint = "Saved. Reverse seed: " + saved.code;
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
  startCustom([structuredClone(draft)], "creator-edit", {
    card: "custom",
    title: draftName || "CUSTOM STAGE",
    subtitle: getName() || "",
    author: getName() || "",
  });
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

function capturePadRebind(): void {
  if (extraView !== "remap" || !rebindAction) {
    prevPadButtons = heldPadButtons();
    return;
  }
  const held = heldPadButtons();
  for (const btn of held) {
    if (prevPadButtons.has(btn)) continue;
    const s = loadSettings();
    s.pads[rebindAction] = btn;
    saveSettings(s);
    rebindAction = null;
    markHudDirty();
    paintHud();
    break;
  }
  prevPadButtons = held;
}

function bindMenuPad(): void {
  for (const ev of pollMenuPad()) handleMenuNav(ev);
}

function bind(): void {
  if (bound) return;
  bound = true;

  const unlock = (): void => {
    unlockAudio(() => {
      const label = currentLabel();
      const playing = label === "game" || label === "restart" || label === "stagetitle" || label === "instructions";
      if (!playing && !playSession) startMenuAudio();
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

  modalInput()?.addEventListener("paste", () => {
    if (modalKind !== "code-play") return;
    window.setTimeout(() => submitModal(), 0);
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
    } else if (extraView === "puzzles-seeded") handleHudAction("puzzle-seed-go");
    else if (extraView === "puzzles-gauntlet") handleHudAction("gauntlet-go");
    else if (extraView === "creator-edit") {
      draftName = input.value.trim() || "Untitled";
    }
  });
  input?.addEventListener("keyup", (ev) => ev.stopPropagation());
  input?.addEventListener("keypress", (ev) => ev.stopPropagation());
  input?.addEventListener("input", () => {
    if (extraView === "creator-edit") {
      draftName = input.value;
      return;
    }
    if (extraView === "puzzles-seeded") {
      puzzleSeed = input.value;
      return;
    }
    if (extraView === "puzzles-gauntlet") {
      gauntletSeed = input.value;
      return;
    }
    if (extraView !== "name" && extraView !== "settings") return;
    const next = (input.value || "").trim();
    if (isDevName(next) && !cachedDev) setName(next);
  });
  window.addEventListener(
    "wheel",
    (ev) => {
      if (extraView !== "creator-manage" && extraView !== "creator-saved") return;
      const max = Math.max(0, listSaved().length - LIST_PAGE);
      if (!max) return;
      ev.preventDefault();
      listScroll = Math.max(0, Math.min(max, listScroll + (ev.deltaY > 0 ? 1 : -1)));
      markHudDirty();
      paintHud();
    },
    { passive: false },
  );

  window.addEventListener("keyup", (ev) => {
    if (currentLabel() !== "game") return;
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
    if (document.activeElement === hudInput() || document.activeElement === modalInput()) return;
    if (extraView === "splash") {
      ev.preventDefault();
      dismissSplash();
      return;
    }

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
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      handleMenuNav("down");
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      handleMenuNav("up");
    } else if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      handleMenuNav("left");
    } else if (ev.key === "ArrowRight") {
      ev.preventDefault();
      handleMenuNav("right");
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      playUiLatch();
      handleMenuNav("confirm");
    }
  });
}

function syncOverlay(): void {
  const version = $("build-version");
  const label = currentLabel();
  const stage = window.stage;
  const launching = !!playSession && extraView === "auto";
  const inRun =
    !!playSession &&
    (launching ||
      label === "game" ||
      label === "restart" ||
      label === "stagetitle" ||
      label === "instructions");
  const playing = label === "game" || label === "restart";
  const onTitle = label === "instructions" || label === "stagetitle";
  syncLetterbox(onTitle);
  if (onTitle) setVanillaTitleVisible(usesVanillaTitle());
  else setVanillaTitleVisible(true);

  if (version) {
    const hide = inRun;
    if (versionHidden !== hide) {
      versionHidden = hide;
      version.style.display = hide ? "none" : "block";
    }
  }

  if (label === "restart" && lastLabel === "game") {
    if (autoSolve && !solveFeeder?.pending && !solveFeeder?.queue.length && !solveFeeder?.held) {
      stopAutoSolve("Auto-solve failed");
    }
    if (!solveFeeder?.pending) {
      rumble(180, 0.6, 0.4);
      commitTape(false, stage?.levelNumber ?? lastLevelNum);
    }
  }

  if ((playing || label === "stagetitle") && stage) {
    if (lastLevelNum > 0 && stage.levelNumber > lastLevelNum) {
      commitTape(true, lastLevelNum);
      persistWonStage(lastLevelNum);
      rumble(220, 0.45, 0.4);
      if (autoSolve) stopAutoSolve("");
    }
    lastLevelNum = stage.levelNumber;
  }

  if (label === "finish" && lastLabel !== "finish") {
    if (autoSolve) stopAutoSolve("");
    rumble(220, 0.45, 0.4);
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
      back === "puzzles-seeded" ||
      back === "puzzles-gauntlet" ||
      back === "history" ||
      back === "load" ||
      back === "creator-saved"
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
    applyPlayTint();
    applyBlockHue();
    if (playing) {
      tickSolve();
      pollGamepad(stage);
      syncHelpText();
      const idle = !playBlocks().length || blocksIdle();
      if (!autoSolve && blocksWereIdle && !idle) rumble(90, 0.42, 0.62);
      blocksWereIdle = idle;
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
    } else if (label === "stagetitle") {
      const card = titleCardCopy();
      if (card) {
        if (!hud?.root.visible) {
          hud?.setVisible(true);
          raiseHud();
        }
        const key = "title:" + card.title + "|" + card.subtitle;
        if (lastHudPaint !== key) {
          lastHudPaint = key;
          hud?.drawTitleCard(card.title, card.subtitle);
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

  applyBlockHue();
  bindMenuPad();
  capturePadRebind();
  if (playSession && extraView === "auto") return;
  if (extraView === "finish") {
    paintHud();
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
      stagetitle?: { visible?: boolean };
    };
    stage?: StageLike;
    startBloxorzShell?: () => void;
    GAME_VERSION?: string;
    __bloxSetMouseOver?: (hz: number) => void;
    AdobeAn?: {
      getComposition: (id: string) => {
        getLibrary: () => LibCtor;
        getSpriteSheet?: () => Record<string, SpriteSheetLike>;
      };
    };
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
    const makeSpin = (): ReturnType<NonNullable<ExtraHud["makeMascot"]>> => {
      const Spin = adobeLib()?.spinna;
      if (!Spin) return null;
      return new Spin() as never;
    };
    hud.makeMascot = makeSpin;
    hud.makePreview = makeSpin;
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
  try {
    localStorage.removeItem("bloxorz-play-mode");
  } catch {
    /* ignore */
  }
  parkCreateJsMenu();
  setMouseOverRate(5);
  applyLooks();
  applyBlockHue();
  const sel = $("image_select") as HTMLSelectElement | null;
  if (sel) sel.value = currentTheme();
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
