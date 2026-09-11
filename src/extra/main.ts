import { cmdToCode, createFeeder, tickFeeder, type SolveFeeder } from "./autoSolve";
import { checkBeatable, EDITOR_TOOLS, editorMarks, newPaintState, paintEditorCell, type EditorToolId } from "./editor";
import {
  decodeSeed,
  deleteStage,
  emptyDraft,
  encodeSeed,
  findBySeed,
  isPlayable,
  listSaved,
  occupiedTileCount,
  parseShare,
  saveStage,
  shareFromLocation,
  stageId,
  tileChar,
} from "./customLevels";
import { createJsToDef, defToCreateJs } from "./convert";
import {
  GAUNTLET_COUNTS,
  GAUNTLET_LEN,
  generateDaily,
  generateRun,
  generateSeeded,
  utcDateLabel,
  type Difficulty,
  type GauntletCount,
} from "./generate";
import { absorbHeldMenuConfirm, actionFromCode, heldPadButtons, noteKeyboardPlay, pollGamepad, pollMenuPad, resetPadState, rumble } from "./gamepad";
import { PAUSE_ACTIONS, pauseNavFromPad, stepPauseFocus, type PauseAction } from "./pauseNav";
import { blitHueRects, collectBlockFrameIndexes, wrapHue, type AtlasRect } from "./hue";
import { armStageTitleClip, freezeStageTitleClip, pinStageTitleClip, stageTitleShouldArm, stageTitleShouldFreeze, type StageTitleClip } from "./stageTitle";
import {
  loadFinishedStages,
  saveFinishedStage,
  saveRun,
  tapeCmdFromRoll,
  winningTape,
  type FinishedStage,
  type HistoryKind,
  type RunRecord,
  type TapeCmd,
} from "./history";
import {
  ACTIONS,
  brandName,
  currentTheme,
  hexToHue,
  hueCss,
  hueRgb,
  hueToHex,
  isDevName,
  loadSettings,
  NAME_MAX,
  normalizeTheme,
  prettyKey,
  saveSettings,
  setMobilePad,
  setRotateScreen,
  type Action,
  type ThemeId,
} from "./settings";
import { applyDocumentLocale, bootLocales, listLocales, loadExtraLocales, localeId, setLocale, t, usesHdType } from "./i18n";
import { LOCALE_TABLE } from "./locale.gen";
import {
  bootThemes,
  currentThemeId,
  getTheme,
  installThemeZip,
  isDevOnlyTheme,
  isHdTheme,
  isSolid3d,
  listCustomThemes,
  removeCustomTheme,
  setCurrentThemeId,
  themeMenuItems,
} from "./themePack";
import { composeThemeAtlas, forgetThemeAtlas } from "./themeAtlas";
import { applySaveBackup, buildSaveBackup, parseSaveBackup } from "./saveBackup";
import { clearTheme3d, syncTheme3d } from "./theme3d";
import { applyVolumes, ensureMenuMusic, gateSoundPlay, hushStageMusic, playDevJingle, playStageSting, playUiClick, playUiLatch, setMenuMusicAllowed, stopAllSounds, unlockAudio } from "./audio";
import { downloadThemeTemplate, setTemplateBusy } from "./themeTemplate";
import { solveLevel } from "./solve";
import type { LevelDef } from "./types";
import { ExtraHud, canBillboard, type MenuItem } from "./hud";
import { shouldBakeFloor, shouldSkipTileSpawn, tileIdleFrame } from "./playPerf";
import {
  ACH_COUNT,
  ACH_PAGE,
  REC_PAGE,
  achievementRows,
  hasAchievementMenu,
  recordCount,
  recordRows,
  hintTokens,
  noteCopiedSeed,
  noteFall,
  notePlayMs,
  noteReplayWatch,
  noteSaved,
  noteScreenshot,
  noteSwap,
  noteWin,
  onAchievementsUnlocked,
  achName,
  spendHint,
  uniqueStageKey,
  unlockedCount,
  type AchievementDef,
  type WinNote,
} from "./achievements";
import { CAMPAIGN_WALKTHROUGH, expandWalkthrough, type WalkCmd } from "./walkthrough";
import type { ClipName } from "./coolmathBoard";
import { looksLikeMobile, registerServiceWorker, TouchChrome } from "./touchPad";
import { fitHowtoNav, fitOverlayCopy, howtoNavIds, howtoSlide, padStage } from "./howto";

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
  | "achievements"
  | "records"
  | "load"
  | "credits"
  | "finish"
  | "mobile-ask"
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
  entry?: "start" | "resume" | "passcode" | "code" | "saved" | "creator-test" | "puzzle";
  diff?: Difficulty;
  replay?: boolean;
};

type CustomPlayOpts = {
  title?: string;
  subtitle?: string;
  card?: PlayCard;
  seed?: string;
  author?: string;
  record?: boolean;
  entry?: PlaySession["entry"];
  diff?: Difficulty;
  replay?: boolean;
};

type OverlayNode = BitmapMark & {
  x?: number;
  y?: number;
  _off?: boolean;
  currentFrame?: number;
  mouseEnabled?: boolean;
  dispatchEvent?: (ev: unknown) => void;
  localToGlobal?: (x: number, y: number) => { x: number; y: number };
  getBounds?: () => { x: number; y: number; width: number; height: number } | null;
  nominalBounds?: { x: number; y: number; width: number; height: number };
};

type PauseBtn = OverlayNode & {
  gotoAndStop?: (n: string | number) => void;
  scaleX?: number;
  scaleY?: number;
};

type PauseStats = OverlayNode & {
  instance?: OverlayNode;
  instance_1?: OverlayNode;
  instance_2?: OverlayNode;
  instance_3?: OverlayNode;
  instance_4?: OverlayNode;
  digit1?: OverlayNode;
  digit2?: OverlayNode;
  digit3?: OverlayNode;
  digit4?: OverlayNode;
  digit5?: OverlayNode;
  digit6?: OverlayNode;
  stage1?: OverlayNode;
  stage2?: OverlayNode;
  falls1?: OverlayNode;
  falls2?: OverlayNode;
  falls3?: OverlayNode;
  falls4?: OverlayNode;
};

type PauseMenuClip = {
  play?: () => void;
  currentFrame?: number;
  buttons?: {
    returnToGame?: PauseBtn;
    toggleSound?: PauseBtn;
    quitToMenu?: PauseBtn;
  };
  stats?: PauseStats;
  status?: PauseStats;
};

type BloxWorld = {
  destroy?: () => void;
  blocks?: { roll?: { idle?: boolean }; x?: number; y?: number; scaleX?: number; scaleY?: number; alpha?: number }[];
  keys?: { code?: string; tick?: () => void; focusIndex?: number };
  transitionOutLevelQuit?: () => void;
  pauseMenu?: PauseMenuClip;
  __bloxQuit?: boolean;
  __bloxTape?: boolean;
  onMove?: (mc: unknown, axis: string, change: number, position?: unknown) => void;
  layerTiles?: { x?: number; y?: number; scaleX?: number; scaleY?: number };
  layerBlocks?: unknown;
  tiles?: { x?: number; y?: number; type?: string; alpha?: number; visible?: boolean }[];
  background?: SkyClip & { instance_2?: SkyClip };
  helpText?: { alpha?: number; visible?: boolean };
  tick?: () => void;
  moves?: number;
};

type StageLike = {
  levelNumber: number;
  triggerKeyDown?: (evt: { code: string }) => void;
  triggerKeyUp?: (evt: { code: string }) => void;
  __bloxTapeKeys?: boolean;
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
  levelAttempts?: number;
  startTime?: number;
  touchMode?: boolean;
  localSave?: { get?: () => unknown; save?: (n: number) => void };
  gameContainer?: {
    visible?: boolean;
    addChild?: (c: unknown) => void;
    addChildAt?: (c: unknown, i: number) => void;
    removeChild?: (c: unknown) => void;
    contains?: (c: unknown) => boolean;
    setChildIndex?: (c: unknown, i: number) => void;
    getChildIndex?: (c: unknown) => number;
  };
  menuMusic?: { stop?: () => void } | null;
  bloxWorld?: BloxWorld | null;
};

type SkyClip = {
  x: number;
  y: number;
  visible: boolean;
  mouseEnabled: boolean;
  filters?: unknown;
  cache?: (x: number, y: number, w: number, h: number) => void;
  uncache?: () => void;
  getBounds?: () => { x: number; y: number; width: number; height: number } | null;
};
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
const LIST_HISTORY = 5;
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
let gauntletCount: GauntletCount = GAUNTLET_LEN;
let solveCode = "";
let solveFeeder: SolveFeeder | null = null;
let run: RunRecord | null = null;
let tape: TapeCmd[] = [];
let lastLabel = "";
let lastLevelNum = 0;
let stageFailed = false;
let playClock = 0;
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
let playLaunching = false;
let pauseFocus = 0;
let draftName = "Untitled";
let listScroll = 0;
let puzzleSeed = "";
let gauntletSeed = "";
let seededEndless = false;
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
let lastTintKey = "";
let lastPlayHudKey = "";
let themeUploadMsg = "";
let settingsChromeBound = false;
let editCursor = { x: 2, y: 4 };
let editorPaintHeld = false;
let replayExclude: TapeCmd[] = [];
let prevCreatorPad = new Set<number>();
let lastFinished: RunRecord | null = null;
let finishReturnTo: Screen = "home";
let finishKind: PlayCard = "classic";
let finishTitle = "";
let finishSubtitle = "";
let webcamStream: MediaStream | null = null;
let tabCastStream: MediaStream | null = null;
let tabCastPrompt: Promise<void> | null = null;
let atlasRects: AtlasRect[] | null = null;
let atlasCanvas: HTMLCanvasElement | null = null;
let atlasOriginal: HTMLCanvasElement | null = null;
let bakedHue = -1;
let beatBanner = "";
let autoSolve = false;
let solveTape: TapeCmd[] = [];
let solveRetries = 0;
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
let prevInstrStart = false;
let uiBusy = false;
let touchChrome: TouchChrome | null = null;
let localSaveWrapped = false;

function markHudDirty(): void {
  hudDirty = true;
}

/** Coalesce HUD redraws while dragging hue/tint so the atlas blit stays responsive. */
let hudPaintTimer = 0;
function scheduleHudPaint(delayMs = 32): void {
  markHudDirty();
  if (hudPaintTimer) return;
  hudPaintTimer = window.setTimeout(() => {
    hudPaintTimer = 0;
    paintHud();
  }, delayMs);
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
    if (!cachedDev && isDevOnlyTheme(currentThemeId())) applyTheme("original", true);
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
  getImages?: () => Record<string, CanvasImageSource>;
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
  // Invalidate hue bake only when the sheet is rebuilt from a fresh bitmap.
  if (source instanceof HTMLImageElement) {
    atlasRects = null;
    atlasCanvas = null;
    atlasOriginal = null;
    bakedHue = -1;
  }
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

function liveBlockHue(): number {
  return wrapHue(loadSettings().blockHue);
}

function snapshotAtlas(src: HTMLCanvasElement): HTMLCanvasElement | null {
  const copy = document.createElement("canvas");
  copy.width = src.width;
  copy.height = src.height;
  const ctx = copy.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0);
  return copy;
}

function collectBlockAtlas(): { live: HTMLCanvasElement; original: HTMLCanvasElement; rects: AtlasRect[] } | null {
  const sheet = atlasSheet();
  const lib = adobeLib() as unknown as Record<string, unknown>;
  if (!sheet?.getFrame || !lib) return null;
  const indexes = collectBlockFrameIndexes(lib);
  if (!indexes.length) return null;
  let source: CanvasImageSource | null = null;
  const rects: AtlasRect[] = [];
  for (const i of indexes) {
    const frame = sheet.getFrame(i);
    if (!frame?.rect || !frame.image) continue;
    source = frame.image;
    rects.push(frame.rect);
  }
  if (!source || !rects.length) return null;
  const live = adoptAtlasCanvas(sheet, source);
  if (!live) return null;
  // Reuse an existing pristine snapshot when the live canvas already holds one.
  if (atlasOriginal && atlasOriginal.width === live.width && atlasOriginal.height === live.height && atlasRects) {
    return { live, original: atlasOriginal, rects };
  }
  const original = snapshotAtlas(live);
  if (!original) return null;
  return { live, original, rects };
}

function clearPlayBlockHueFilters(): void {
  for (const block of playBlocks()) {
    const clip = block as { filters?: unknown; uncache?: () => void; __bloxHue?: number };
    if (clip.filters || clip.__bloxHue) {
      clip.filters = null;
      clip.uncache?.();
      clip.__bloxHue = 0;
    }
  }
}

let hueBlitPending = false;
function applyBlockHue(force = false): void {
  const hue = liveBlockHue();
  if (!force && atlasRects && atlasOriginal && atlasCanvas && bakedHue >= 0 && hue === bakedHue) return;
  if (!atlasRects || !atlasCanvas || !atlasOriginal) {
    const atlas = collectBlockAtlas();
    if (!atlas) return;
    atlasRects = atlas.rects;
    atlasCanvas = atlas.live;
    atlasOriginal = atlas.original;
  }
  // Coalesce rapid slider steps onto one rAF blit; run() re-reads the latest hue.
  if (!force && hueBlitPending) return;
  hueBlitPending = true;
  const run = () => {
    hueBlitPending = false;
    if (!atlasCanvas || !atlasOriginal || !atlasRects) return;
    const next = liveBlockHue();
    if (bakedHue >= 0 && next === bakedHue) return;
    const ctx = atlasCanvas.getContext("2d");
    if (!ctx) return;
    blitHueRects(ctx, atlasOriginal, atlasRects, next);
    bakedHue = next;
    clearPlayBlockHueFilters();
  };
  if (force || typeof requestAnimationFrame !== "function") run();
  else requestAnimationFrame(run);
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

function applySkySpriteTint(sprite: SkyClip | null | undefined, hue: number, amt: number): void {
  const cjs = window.createjs as { ColorFilter?: new (...args: number[]) => unknown } | undefined;
  if (!sprite) return;
  const tagged = sprite as SkyClip & { __bloxTintKey?: string };
  const key = !sThemeBg() || amt <= 0.01 || !cjs?.ColorFilter ? "off" : `${hue}|${amt.toFixed(3)}`;
  if (tagged.__bloxTintKey === key) return;
  tagged.__bloxTintKey = key;
  if (key === "off") {
    sprite.filters = null;
    sprite.uncache?.();
    return;
  }
  const Filter = cjs?.ColorFilter;
  if (!Filter) {
    tagged.__bloxTintKey = "off";
    return;
  }
  const [r, g, b] = hueRgb(hue);
  const wash = Math.min(1, amt);
  sprite.filters = [
    new Filter(1 - wash * 0.4, 1 - wash * 0.4, 1 - wash * 0.4, 1, r * wash * 0.7, g * wash * 0.7, b * wash * 0.7, 0),
  ];
  const box = sprite.getBounds?.();
  sprite.cache?.(box?.x ?? 0, box?.y ?? 0, box?.width ?? 550, box?.height ?? 300);
}

function sThemeBg(): boolean {
  return loadSettings().themeBg;
}

function usingWebcam(): boolean {
  return loadSettings().webcamBg;
}

function usingTabCast(): boolean {
  return loadSettings().tabCastBg;
}

function usingLiveBg(): boolean {
  return usingWebcam() || usingTabCast();
}

function applyLooks(): void {
  const s = loadSettings();
  const live = s.webcamBg || s.tabCastBg;
  document.body.classList.toggle("no-theme-bg", !s.themeBg && !live);
  document.body.classList.toggle("has-webcam-bg", live);
  document.body.style.setProperty("--bg-tint", hueCss(s.bgHue, s.bgTint * 0.55));
  document.body.style.setProperty("--play-tint", live ? "transparent" : s.bgTint > 0.01 ? hueCss(s.bgHue, Math.min(1, 0.28 + s.bgTint * 0.5)) : "#000");
  ensureTint();
  lastTintKey = "";
  if (sky) (sky as SkyClip & { __bloxTintKey?: string }).__bloxTintKey = "";
  const world = window.stage?.bloxWorld as { background?: { instance_2?: SkyClip & { __bloxTintKey?: string } } } | undefined;
  if (world?.background?.instance_2) world.background.instance_2.__bloxTintKey = "";
  if (live && sky) sky.visible = false;
  if (tintLayer) {
    tintLayer.graphics.clear();
    if (s.bgTint > 0.01 && !live) {
      tintLayer.graphics.beginFill(hueCss(s.bgHue, 1)).drawRect(0, 0, 550, 300);
      tintLayer.alpha = s.bgTint * 0.42;
      tintLayer.visible = true;
    } else {
      tintLayer.visible = false;
    }
  }
  applyPlayTint();
  applyThemeMedia();
  applyTabCrop();
}

function applyTabCrop(): void {
  const cam = $("theme-webcam") as HTMLVideoElement | null;
  if (!cam) return;
  const s = loadSettings();
  if (!s.tabCastBg) {
    cam.style.clipPath = "";
    cam.style.objectPosition = "";
    cam.style.transform = "";
    return;
  }
  const c = s.tabCrop;
  const invW = 1 / Math.max(0.05, c.w);
  const invH = 1 / Math.max(0.05, c.h);
  cam.style.objectFit = "cover";
  cam.style.transformOrigin = "0 0";
  cam.style.transform = `translate(${-c.x * invW * 100}%, ${-c.y * invH * 100}%) scale(${invW}, ${invH})`;
  cam.style.width = "100%";
  cam.style.height = "100%";
}

function applyThemeMedia(): void {
  const wrap = $("theme-media");
  const img = $("theme-media-img") as HTMLImageElement | null;
  const video = $("theme-media-video") as HTMLVideoElement | null;
  const cam = $("theme-webcam") as HTMLVideoElement | null;
  if (!wrap || !img || !video) return;
  const pack = getTheme(currentThemeId());
  const s = loadSettings();
  if (s.webcamBg || s.tabCastBg) {
    wrap.hidden = false;
    document.body.classList.add("has-theme-media", "has-webcam-bg");
    img.hidden = true;
    video.hidden = true;
    video.pause();
    if (cam) cam.hidden = false;
    if (s.tabCastBg) {
      stopWebcam();
      if (!tabCastStream && !tabCastPrompt) void startTabCast(cam);
      else if (tabCastStream && cam && cam.srcObject !== tabCastStream) {
        cam.srcObject = tabCastStream;
        cam.hidden = false;
        void cam.play().catch(() => undefined);
      }
    } else {
      stopTabCast();
      void startWebcam(cam);
    }
    lastTintKey = "";
    applyPlayTint();
    applyTabCrop();
    return;
  }
  document.body.classList.remove("has-webcam-bg");
  stopWebcam();
  stopTabCast();
  applyTabCrop();
  const src = pack.background.src
    ? pack.background.src.startsWith("/") || pack.background.src.startsWith("blob:") || pack.background.src.startsWith("http")
      ? pack.background.src
      : pack.builtin
        ? `themes/${pack.id}/${pack.background.src}`
        : pack.files?.[pack.background.src] ?? ""
    : "";
  const kind = pack.background.type;
  const show = s.themeBg && !!src && (kind === "image" || kind === "gif" || kind === "video");
  wrap.hidden = !show;
  document.body.classList.toggle("has-theme-media", show);
  if (!show) {
    video.pause();
    img.removeAttribute("src");
    video.removeAttribute("src");
    return;
  }
  if (kind === "video") {
    img.hidden = true;
    video.hidden = false;
    if (video.getAttribute("src") !== src) {
      video.src = src;
      void video.play().catch(() => undefined);
    }
  } else {
    video.pause();
    video.hidden = true;
    img.hidden = false;
    if (img.getAttribute("src") !== src) img.src = src;
  }
}

function stopWebcam(): void {
  const cam = $("theme-webcam") as HTMLVideoElement | null;
  if (cam && !tabCastStream) {
    cam.hidden = true;
    cam.srcObject = null;
  }
  if (webcamStream) {
    for (const track of webcamStream.getTracks()) track.stop();
    webcamStream = null;
  }
}

function stopTabCast(): void {
  const cam = $("theme-webcam") as HTMLVideoElement | null;
  if (cam && !webcamStream) {
    cam.hidden = true;
    cam.srcObject = null;
  }
  if (tabCastStream) {
    for (const track of tabCastStream.getTracks()) track.stop();
    tabCastStream = null;
  }
}

async function startWebcam(cam: HTMLVideoElement | null): Promise<void> {
  if (!cam) return;
  if (webcamStream && cam.srcObject === webcamStream) {
    void cam.play().catch(() => undefined);
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    if (!loadSettings().webcamBg) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    webcamStream = stream;
    cam.srcObject = stream;
    cam.hidden = false;
    void cam.play().catch(() => undefined);
  } catch {
    const s = loadSettings();
    s.webcamBg = false;
    saveSettings(s);
    cam.hidden = true;
    markHudDirty();
    paintHud();
  }
}

async function startTabCast(cam: HTMLVideoElement | null): Promise<void> {
  if (!cam) return;
  if (tabCastStream && cam.srcObject === tabCastStream) {
    void cam.play().catch(() => undefined);
    return;
  }
  if (tabCastPrompt) {
    await tabCastPrompt;
    if (tabCastStream && cam.srcObject !== tabCastStream) {
      cam.srcObject = tabCastStream;
      cam.hidden = false;
      void cam.play().catch(() => undefined);
    }
    return;
  }
  tabCastPrompt = (async () => {
    try {
      const display = navigator.mediaDevices as MediaDevices & {
        getDisplayMedia?: (opts: DisplayMediaStreamOptions) => Promise<MediaStream>;
      };
      if (!display.getDisplayMedia) throw new Error("unsupported");
      // Prefer the richest picker the browser offers (screen / window / tab).
      // Avoid preferCurrentTab + displaySurface:"browser" — those force a current-tab-only
      // prompt and were re-fired from applyLooks, stacking dialogs.
      const stream = await display.getDisplayMedia({
        video: true,
        audio: false,
        selfBrowserSurface: "include",
        surfaceSwitching: "include",
        monitorTypeSurfaces: "include",
      } as DisplayMediaStreamOptions & Record<string, unknown>);
      if (!loadSettings().tabCastBg) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      stopTabCast();
      tabCastStream = stream;
      cam.srcObject = stream;
      cam.hidden = false;
      void cam.play().catch(() => undefined);
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        const s = loadSettings();
        s.tabCastBg = false;
        saveSettings(s);
        stopTabCast();
        applyLooks();
        markHudDirty();
        paintHud();
      });
    } catch {
      const s = loadSettings();
      s.tabCastBg = false;
      saveSettings(s);
      cam.hidden = true;
      markHudDirty();
      paintHud();
    } finally {
      tabCastPrompt = null;
    }
  })();
  await tabCastPrompt;
}


function setHdRendering(on: boolean): void {
  document.body.classList.toggle("is-hd", on);
  const canvas = $("canvas") as HTMLCanvasElement | null;
  const ctx = canvas?.getContext("2d");
  if (ctx) ctx.imageSmoothingEnabled = on;
}

function themePackLabel(id: string, fallback: string): string {
  const key = "theme." + id;
  const label = t(key);
  return label === key ? fallback : label;
}

function closeSettingsDropdowns(): void {
  for (const id of ["hud-theme-select", "hud-locale-select"]) {
    const wrap = $(id);
    wrap?.classList.remove("is-open");
    const menu = wrap?.querySelector(".hud-dd-menu") as HTMLElement | null;
    const btn = wrap?.querySelector(".hud-dd-btn") as HTMLButtonElement | null;
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  $("dom_overlay_container")?.classList.remove("is-dd-open");
  $("animation_container")?.classList.remove("is-dd-open");
}

function toggleSettingsDropdown(wrap: HTMLElement): void {
  const willOpen = !wrap.classList.contains("is-open");
  closeSettingsDropdowns();
  if (!willOpen) return;
  wrap.classList.add("is-open");
  const menu = wrap.querySelector(".hud-dd-menu") as HTMLElement | null;
  const btn = wrap.querySelector(".hud-dd-btn") as HTMLButtonElement | null;
  if (menu) menu.hidden = false;
  if (btn) btn.setAttribute("aria-expanded", "true");
  $("dom_overlay_container")?.classList.add("is-dd-open");
  $("animation_container")?.classList.add("is-dd-open");
}

function themeSelectOpts(): { id: string; name: string }[] {
  return themeMenuItems(cachedDev).map((pack) => ({
    id: pack.id,
    name: pack.builtin ? themePackLabel(pack.id, pack.name) : pack.name,
  }));
}

function fillSettingsDropdown(
  wrap: HTMLElement | null,
  opts: { id: string; name: string }[],
  current: string,
  force = false,
): void {
  if (!wrap) return;
  const btn = wrap.querySelector(".hud-dd-btn") as HTMLButtonElement | null;
  const menu = wrap.querySelector(".hud-dd-menu") as HTMLElement | null;
  if (!btn || !menu) return;
  const key = localeId() + ":" + opts.map((o) => o.id).join(",");
  if (force || wrap.dataset.ids !== key) {
    menu.innerHTML = "";
    for (const opt of opts) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "hud-dd-opt";
      item.dataset.id = opt.id;
      item.role = "option";
      item.textContent = opt.name;
      menu.appendChild(item);
    }
    wrap.dataset.ids = key;
  }
  const cur = opts.find((o) => o.id === current);
  btn.textContent = cur?.name || current;
  for (const el of menu.querySelectorAll<HTMLElement>(".hud-dd-opt")) {
    const on = el.dataset.id === current;
    el.classList.toggle("is-current", on);
    el.setAttribute("aria-selected", on ? "true" : "false");
  }
}

function placeSettingsChrome(on: boolean, forceTheme = false): void {
  const themeSel = $("hud-theme-select");
  const localeSel = $("hud-locale-select");
  const upload = $("hud-theme-upload") as HTMLInputElement | null;
  const uploadBtn = $("hud-theme-upload-btn");
  const templateBtn = $("hud-theme-template-btn");
  const manageBtn = $("hud-theme-manage-btn");
  const manage = $("hud-theme-manage");
  const tintColor = $("hud-bg-color") as HTMLInputElement | null;
  for (const el of [themeSel, localeSel, uploadBtn, templateBtn, manageBtn, tintColor]) {
    if (!el) continue;
    el.hidden = !on;
  }
  if (upload) upload.hidden = true;
  if (!on && manage) manage.hidden = true;
  if (uploadBtn) uploadBtn.textContent = themeUploadMsg || t("settings.upload");
  if (templateBtn) templateBtn.textContent = t("settings.template");
  if (manageBtn) manageBtn.textContent = t("settings.manage");
  if (tintColor) {
    tintColor.value = hueToHex(loadSettings().bgHue);
    tintColor.title = t("settings.tint");
  }
  if (!on) {
    closeSettingsDropdowns();
    return;
  }
  fillSettingsDropdown(themeSel, themeSelectOpts(), currentThemeId(), forceTheme);
  fillSettingsDropdown(
    localeSel,
    listLocales().map((loc) => ({ id: loc.id, name: loc.name })),
    localeId(),
  );
}

function fillThemeManage(): void {
  const panel = $("hud-theme-manage");
  const list = $("hud-theme-manage-list");
  const empty = $("hud-theme-manage-empty");
  if (!panel || !list || !empty) return;
  const back = $("hud-theme-manage-back");
  if (back) back.textContent = t("common.back");
  const rows = listCustomThemes();
  list.replaceChildren();
  empty.hidden = rows.length > 0;
  empty.textContent = t("settings.noCustomThemes");
  for (const pack of rows) {
    const row = document.createElement("div");
    row.className = "hud-theme-row";
    const name = document.createElement("span");
    name.textContent = pack.name;
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = t("settings.deleteTheme");
    del.dataset.id = pack.id;
    row.append(name, del);
    list.append(row);
  }
}

function toggleThemeManage(force?: boolean): void {
  const panel = $("hud-theme-manage");
  if (!panel) return;
  const on = force ?? panel.hidden;
  if (on) fillThemeManage();
  panel.hidden = !on;
}

function bindSettingsChrome(): void {
  if (settingsChromeBound) return;
  settingsChromeBound = true;
  const themeSel = $("hud-theme-select");
  const localeSel = $("hud-locale-select");
  const upload = $("hud-theme-upload") as HTMLInputElement | null;
  const uploadBtn = $("hud-theme-upload-btn");
  const templateBtn = $("hud-theme-template-btn");
  const manageBtn = $("hud-theme-manage-btn");
  const manage = $("hud-theme-manage");
  themeSel?.querySelector(".hud-dd-btn")?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (themeSel) toggleSettingsDropdown(themeSel);
  });
  localeSel?.querySelector(".hud-dd-btn")?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (localeSel) toggleSettingsDropdown(localeSel);
  });
  themeSel?.querySelector(".hud-dd-menu")?.addEventListener("click", (ev) => {
    const id = (ev.target as HTMLElement | null)?.closest<HTMLElement>(".hud-dd-opt")?.dataset.id;
    if (!id) return;
    ev.stopPropagation();
    closeSettingsDropdowns();
    applyTheme(normalizeTheme(id), true);
  });
  localeSel?.querySelector(".hud-dd-menu")?.addEventListener("click", (ev) => {
    const id = (ev.target as HTMLElement | null)?.closest<HTMLElement>(".hud-dd-opt")?.dataset.id;
    if (!id) return;
    ev.stopPropagation();
    closeSettingsDropdowns();
    applyLanguage(id);
  });
  document.addEventListener(
    "pointerdown",
    (ev) => {
      const node = ev.target as Node | null;
      if (themeSel?.contains(node) || localeSel?.contains(node) || manageBtn?.contains(node) || manage?.contains(node)) return;
      closeSettingsDropdowns();
      if (manage) manage.hidden = true;
    },
    true,
  );
  uploadBtn?.addEventListener("click", () => upload?.click());
  templateBtn?.addEventListener("click", () => {
    if (uiBusy) return;
    uiBusy = true;
    setTemplateBusy(true, 0, t("settings.templateBusy"));
    void downloadThemeTemplate((done, total) => {
      setTemplateBusy(true, total ? done / total : 0, t("settings.templateBusy"));
    })
      .catch(() => {
        themeUploadMsg = t("theme.templateBad");
        lastHudPaint = "";
        markHudDirty();
        paintHud();
      })
      .finally(() => {
        uiBusy = false;
        setTemplateBusy(false, 1);
      });
  });
  manageBtn?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    toggleThemeManage();
  });
  $("hud-theme-manage-back")?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    toggleThemeManage(false);
  });
  const tintColor = $("hud-bg-color") as HTMLInputElement | null;
  tintColor?.addEventListener("input", () => {
    const s = loadSettings();
    s.bgHue = hexToHue(tintColor.value);
    saveSettings(s);
    applyLooks();
    markHudDirty();
    paintHud();
  });
  manage?.addEventListener("click", (ev) => {
    const id = (ev.target as HTMLElement | null)?.closest<HTMLElement>("button[data-id]")?.dataset.id;
    if (!id) return;
    ev.stopPropagation();
    if (!window.confirm(t("theme.deleteConfirm"))) return;
    const active = currentThemeId();
    void removeCustomTheme(id).then((out) => {
      if (!out.ok) return;
      forgetThemeAtlas(id);
      fillThemeManage();
      placeSettingsChrome(true, true);
      if (active === id) applyTheme("original", true);
    });
  });
  const saveImport = $("hud-save-import") as HTMLInputElement | null;
  saveImport?.addEventListener("change", () => {
    const file = saveImport.files?.[0];
    saveImport.value = "";
    if (!file) return;
    void file.text().then(async (raw) => {
      try {
        if (!window.confirm(t("settings.importConfirm"))) return;
        const data = parseSaveBackup(raw);
        await applySaveBackup(data);
        window.location.reload();
      } catch {
        themeUploadMsg = t("settings.importBad");
        lastHudPaint = "";
        markHudDirty();
        paintHud();
      }
    });
  });
  upload?.addEventListener("change", () => {
    const file = upload.files?.[0];
    upload.value = "";
    if (!file) return;
    void file.arrayBuffer().then(async (buf) => {
      try {
        const pack = await installThemeZip(buf);
        forgetThemeAtlas();
        try {
          applyTheme(pack.id, true);
        } catch {
          window.location.reload();
        }
      } catch {
        themeUploadMsg = t("theme.uploadBad");
        lastHudPaint = "";
        markHudDirty();
        placeSettingsChrome(extraView === "settings", true);
        paintHud();
      }
    });
  });
}

function applyLanguage(id: string): void {
  const prev = localeId();
  if (id === prev) return;
  setLocale(id);
  applyDocumentLocale(id);
  const s = loadSettings();
  s.locale = id;
  saveSettings(s);
  if (usesHdType(prev) !== usesHdType(id)) {
    window.location.reload();
    return;
  }
  applyDomCopy();
  lastHudPaint = "";
  lastPlayHudKey = "";
  markHudDirty();
  paintHud();
}

function applyDomCopy(): void {
  const title = $("hud-modal-title");
  if (title && extraView !== "settings") title.textContent = t("modal.code");
  const ok = $("hud-modal-ok");
  if (ok) ok.textContent = t("common.ok");
  const cancel = $("hud-modal-cancel");
  if (cancel) cancel.textContent = t("common.cancel");
  const install = $("install-hint")?.querySelector("p");
  if (install) install.textContent = t("boot.install");
  const installNow = $("install-now");
  if (installNow) installNow.textContent = t("boot.installNow");
  const installDismiss = $("install-dismiss");
  if (installDismiss) installDismiss.textContent = t("boot.notNow");
  const rotate = $("landscape-hint")?.querySelector("p");
  if (rotate) rotate.textContent = t("boot.rotate");
  const uploadBtn = $("hud-theme-upload-btn");
  if (uploadBtn) uploadBtn.textContent = t("settings.upload");
  const templateBtn = $("hud-theme-template-btn");
  if (templateBtn) templateBtn.textContent = t("settings.template");
  const manageBtn = $("hud-theme-manage-btn");
  if (manageBtn) manageBtn.textContent = t("settings.manage");
  const themeBtn = $("hud-theme-btn");
  if (themeBtn) themeBtn.setAttribute("aria-label", t("settings.theme"));
  const localeBtn = $("hud-locale-btn");
  if (localeBtn) localeBtn.setAttribute("aria-label", t("settings.language"));
  const stageHead = $("timer-stage-head");
  if (stageHead) stageHead.textContent = t("timer.stage");
  const timeHead = $("timer-time-head");
  if (timeHead) timeHead.textContent = t("timer.time");
}

type BitmapMark = { alpha?: number; visible?: boolean; children?: { alpha?: number; visible?: boolean }[] };

function playBitmapMarks(): BitmapMark[] {
  const bg = window.stage?.bloxWorld?.background as
    | {
        digit1?: BitmapMark;
        digit2?: BitmapMark;
        digit3?: BitmapMark;
        digit4?: BitmapMark;
        digit5?: BitmapMark;
        digit6?: BitmapMark;
        digit1a?: BitmapMark;
        digit2a?: BitmapMark;
        digit3a?: BitmapMark;
        digit4a?: BitmapMark;
        digit5a?: BitmapMark;
        digit6a?: BitmapMark;
        instance_1?: BitmapMark;
        menuButton?: BitmapMark;
      }
    | undefined;
  if (!bg) return [];
  return [
    bg.digit1,
    bg.digit2,
    bg.digit3,
    bg.digit4,
    bg.digit5,
    bg.digit6,
    bg.digit1a,
    bg.digit2a,
    bg.digit3a,
    bg.digit4a,
    bg.digit5a,
    bg.digit6a,
    bg.instance_1,
    bg.menuButton,
  ].filter((mark): mark is BitmapMark => !!mark);
}

function setMarkAlpha(mark: BitmapMark | undefined, alpha: number, cascade = false): void {
  if (!mark) return;
  mark.alpha = alpha;
  if (!cascade) return;
  for (const child of mark.children ?? []) {
    if (alpha === 0 || child.alpha === 0) child.alpha = alpha;
  }
}

function setBitmapPlayText(show: boolean): void {
  const alpha = show ? 1 : 0;
  const marks = playBitmapMarks();
  for (const mark of marks) setMarkAlpha(mark, alpha, false);
  const bg = window.stage?.bloxWorld?.background as { menuButton?: BitmapMark } | undefined;
  setMarkAlpha(bg?.menuButton, alpha, true);
}

function instructionTextMark(): OverlayNode | undefined {
  return (window.exportRoot?.inst as { instance_4?: OverlayNode } | undefined)?.instance_4;
}

function setInstructionBitmaps(show: boolean): void {
  setMarkAlpha(instructionTextMark(), show ? 1 : 0, true);
}

function vanillaTitleClip(): BitmapMark | undefined {
  return window.exportRoot?.stagetitle as BitmapMark | undefined;
}

function setVanillaTitleVisible(on: boolean): void {
  const title = vanillaTitleClip() as StageTitleClip | undefined;
  if (!title) return;
  title.visible = on;
  if (on && title.alpha === 0) title.alpha = 1;
}

function syncStageTitleAudio(label: string): void {
  const title = vanillaTitleClip() as StageTitleClip | undefined;
  if (stageTitleShouldArm(lastLabel, label)) {
    armStageTitleClip(title);
    playStageSting();
    return;
  }
  if (stageTitleShouldFreeze(lastLabel, label)) {
    freezeStageTitleClip(title);
    return;
  }
  if (label === "stagetitle") pinStageTitleClip(title);
  else freezeStageTitleClip(title);
}

function setVanillaCongraVisible(on: boolean): void {
  const clip = (window.exportRoot as { instance_1?: BitmapMark } | undefined)?.instance_1;
  if (!clip) return;
  clip.visible = on;
  clip.alpha = on ? 1 : 0;
}

function setGlyphVisible(node: OverlayNode | undefined, show: boolean): void {
  if (!node) return;
  node.visible = show;
  node.alpha = show ? 1 : 0;
  node.mouseEnabled = show;
  for (const child of node.children ?? []) {
    child.visible = show;
    if (!show) child.alpha = 0;
  }
}

function stageScale(): { sx: number; sy: number } {
  const st = window.stage as { scaleX?: number; scaleY?: number } | undefined;
  return { sx: st?.scaleX || 1, sy: st?.scaleY || 1 };
}

function placeOverlay(el: HTMLElement | null, node: OverlayNode | undefined, live: boolean, align: "center" | "left" | "right" = "center"): void {
  if (!el) return;
  el.hidden = !live;
  if (!live || !node?.localToGlobal) return;
  const b = node.getBounds?.() ?? node.nominalBounds;
  const { sx, sy } = stageScale();
  let localX = 0;
  let localY = 0;
  if (b) {
    localX = align === "left" ? b.x : align === "right" ? b.x + b.width : b.x + b.width / 2;
    localY = b.y + b.height / 2;
  }
  const p = node.localToGlobal(localX, localY);
  el.style.left = (p.x / sx / 550) * 100 + "%";
  el.style.top = (p.y / sy / 300) * 100 + "%";
  el.style.transform = align === "left" ? "translate(0, -50%)" : align === "right" ? "translate(-100%, -50%)" : "translate(-50%, -50%)";
}

/** Keep the HTML pause-stats copy locked to the sliding CreateJS stats panel. */
function placePauseStats(el: HTMLElement | null, node: OverlayNode | undefined, live: boolean): void {
  if (!el) return;
  el.hidden = !live;
  if (!live || !node?.localToGlobal) {
    el.style.transform = "";
    return;
  }
  // Prefer stable registration / nominalBounds — live getBounds() jitters as digit glyphs change.
  const b = node.nominalBounds;
  const localX = b?.x ?? 0;
  const localY = b?.y ?? 0;
  const { sx, sy } = stageScale();
  const p = node.localToGlobal(localX, localY);
  el.style.left = (p.x / sx / 550) * 100 + "%";
  el.style.top = (p.y / sy / 300) * 100 + "%";
  el.style.transform = "none";
}


function clickOverlay(node: OverlayNode | undefined): void {
  node?.dispatchEvent?.({ type: "click" });
}

function padClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(total / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function playHudStageName(stageNo: number): string {
  const card = titleCardCopy();
  if (card) {
    if (playSession?.card === "gauntlet" && playSession.defs.length > 1) {
      return `${card.title}  ${stageNo}/${playSession.defs.length}`;
    }
    return card.title;
  }
  return t("play.stage", { n: padStage(stageNo) });
}

function isClassicPlayHud(): boolean {
  if (!playSession) return false;
  if (playSession.card === "classic") return true;
  if (playSession.kind === "campaign" && !playSession.defs.length) return true;
  return !!playSession.classicRun;
}

function syncPlayStageName(on: boolean): void {
  const el = $("play-stage-name");
  if (!el) return;
  const want = on && loadSettings().showStageName;
  if (!want) {
    el.hidden = true;
    el.textContent = "";
    el.removeAttribute("data-sub");
    return;
  }
  const stageNo = window.stage?.levelNumber ?? 0;
  const title = playHudStageName(stageNo);
  const sub = playHudStageSubtitle();
  el.textContent = title;
  if (sub) el.setAttribute("data-sub", sub);
  else el.removeAttribute("data-sub");
  el.hidden = false;
}

function playHudStageSubtitle(): string {
  if (!playSession) return "";
  if (playSession.card === "custom") {
    return playSession.author || playSession.subtitle || "";
  }
  if (playSession.card === "daily") return playSession.subtitle || "";
  if (playSession.card === "gauntlet" || playSession.card === "seeded") {
    return playSession.seed || playSession.subtitle || "";
  }
  return playSession.subtitle || playSession.author || playSession.seed || "";
}

function cueMenuHover(): void {
  playUiClick();
  rumble(50, 0.28, 0.36);
}

function syncPlayChrome(on: boolean): void {
  syncPlayStageName(on);
  const box = $("play-chrome");
  if (!box) return;
  const show = on && usesHdType();
  box.hidden = !show;
  setBitmapPlayText(!show);
  const timeEl = $("play-time");
  if (!show) {
    lastPlayHudKey = "";
    box.classList.remove("has-pass", "has-play-time");
    if (timeEl) timeEl.hidden = true;
    return;
  }
  const world = window.stage?.bloxWorld as { moves?: number; background?: { menuButton?: { dispatchEvent?: (ev: unknown) => void } } } | undefined;
  const stageNo = window.stage?.levelNumber ?? 0;
  const moves = (world?.moves ?? 0) + (window.stage?.totalMoves ?? 0);
  const code = playSession?.defs[Math.max(0, stageNo - 1)]?.code || playDef()?.code || "";
  const classic = isClassicPlayHud();
  const classicFirst = !!playSession?.classicRun && playSession.kind === "campaign" && stageNo === 1;
  const stageName = playHudStageName(stageNo);
  const settings = loadSettings();
  const started = window.stage?.startTime ?? Date.now();
  const clock = padClock(Date.now() - started);
  const key = `${stageNo}|${moves}|${code}|${classic}|${classicFirst}|${stageName}|${localeId()}|${settings.showStageName}|${settings.showPlayTime}|${clock}`;
  if (key === lastPlayHudKey) return;
  lastPlayHudKey = key;
  const passBox = $("play-pass");
  const pass = $("play-pass-val");
  const passLab = $("play-pass-lab");
  const moveVal = $("play-moves-val");
  const moveLab = $("play-moves-lab");
  const menu = $("play-menu");
  const help = $("play-help");
  box.classList.toggle("has-pass", classic);
  box.classList.toggle("has-play-time", settings.showPlayTime);
  if (passBox) passBox.hidden = !classic;
  if (passLab) passLab.textContent = t("play.passcode") + ":";
  if (moveLab) moveLab.textContent = t("play.moves") + ":";
  if (pass) pass.textContent = code || String(stageNo).padStart(2, "0");
  if (moveVal) moveVal.textContent = String(moves);
  if (timeEl) {
    timeEl.hidden = !settings.showPlayTime;
    const timeLab = $("play-time-lab");
    const timeVal = $("play-time-val");
    if (timeLab) timeLab.textContent = t("hud.time") + ":";
    if (timeVal) timeVal.textContent = clock;
    if (!timeLab && !timeVal) timeEl.textContent = t("hud.time") + ": " + clock;
  }
  if (menu) menu.textContent = t("play.menu");
  if (help) {
    help.hidden = !classicFirst;
    help.textContent = t("play.help1");
  }
}

function syncStageCard(on: boolean, title = ""): void {
  const box = $("stage-card");
  const lab = $("stage-card-text");
  if (!box) return;
  const show = on && usesHdType();
  box.hidden = !show;
  if (lab && show) lab.textContent = title;
  const clip = vanillaTitleClip();
  if (clip && show) {
    clip.alpha = 0;
    clip.visible = false;
  }
}

function syncHowto(on: boolean): void {
  const copy = $("howto-copy");
  const page = $("howto-page");
  const nav = $("howto-nav");
  if (!copy || !page) return;
  const show = on && usesHdType();
  const inst = instructionClip();
  if (!show) {
    copy.hidden = true;
    page.hidden = true;
    if (nav) nav.hidden = true;
    setInstructionBitmaps(true);
    for (const btn of instructionGlyphs()) setGlyphVisible(btn, true);
    return;
  }
  setInstructionBitmaps(false);
  const frame = inst?.currentFrame ?? 0;
  const slide = howtoSlide(frame);
  if (slide < 0) {
    copy.hidden = true;
    page.hidden = true;
    if (nav) nav.hidden = true;
    for (const btn of instructionGlyphs()) setGlyphVisible(btn, false);
    return;
  }
  copy.hidden = false;
  page.hidden = false;
  if (nav) nav.hidden = false;
  copy.textContent = t("howto." + slide);
  page.textContent = t("howto.page", { n: slide + 1 });
  const back = $("howto-back");
  const skip = $("howto-skip");
  const prev = $("howto-prev");
  const next = $("howto-next");
  const start = $("howto-start");
  if (back) back.textContent = t("howto.menu");
  if (skip) skip.textContent = t("howto.skip");
  if (prev) prev.textContent = t("howto.prev");
  if (next) next.textContent = t("howto.next");
  if (start) start.textContent = t("howto.start");
  const live = new Set(howtoNavIds(slide));
  if (back) back.hidden = !live.has("back");
  if (skip) skip.hidden = !live.has("skip");
  if (prev) prev.hidden = !live.has("prev");
  if (next) next.hidden = !live.has("next");
  if (start) start.hidden = !live.has("start");
  for (const el of [back, skip, prev, next, start]) {
    if (!el) continue;
    el.style.left = "";
    el.style.top = "";
    el.style.width = "";
    el.style.height = "";
    el.style.transform = "";
  }
  fitOverlayCopy(copy);
  if (nav) fitHowtoNav(nav);
  for (const btn of instructionGlyphs()) setGlyphVisible(btn, false);
}

function syncPauseStats(on: boolean): void {
  const box = $("pause-stats");
  const nav = $("pause-nav");
  if (!box) return;
  const frame = pauseMenuFrame();
  const hd = usesHdType();
  const settled = on && hd && frame === 12;
  // Keep legacy bitmap glyphs hidden for the whole open/close tween so HD copy never flashes.
  const hideBitmaps = on && hd && frame > 0;
  box.hidden = !settled;
  if (nav) nav.hidden = !settled;
  const menu = pauseMenuClip();
  const panels = [menu?.stats, menu?.status];
  const buttons = menu?.buttons;
  const digitMarks: Array<BitmapMark | undefined> = [];
  for (const stats of panels) {
    digitMarks.push(
      stats?.instance,
      stats?.instance_1,
      stats?.instance_2,
      stats?.instance_3,
      stats?.instance_4,
      stats?.digit1,
      stats?.digit2,
      stats?.digit3,
      stats?.digit4,
      stats?.digit5,
      stats?.digit6,
      stats?.stage1,
      stats?.stage2,
      stats?.falls1,
      stats?.falls2,
      stats?.falls3,
      stats?.falls4,
    );
  }
  const btnMarks = [buttons?.returnToGame, buttons?.toggleSound, buttons?.quitToMenu];
  const glyphAlpha = hideBitmaps ? 0 : 1;
  for (const mark of digitMarks) setMarkAlpha(mark, glyphAlpha, false);
  for (const mark of btnMarks) setMarkAlpha(mark, glyphAlpha, true);
  if (!settled) {
    placePauseStats(box, menu?.stats, false);
    return;
  }
  const timeLab = $("pause-time")?.querySelector(".lab");
  const stageLab = $("pause-stage")?.querySelector(".lab");
  const tryLab = $("pause-tries")?.querySelector(".lab");
  if (timeLab) timeLab.textContent = t("hud.time") + ":";
  if (stageLab) stageLab.textContent = t("hud.stage") + ":";
  if (tryLab) tryLab.textContent = t("hud.attempts") + ":";
  const st = window.stage;
  const started = st?.startTime ?? Date.now();
  const timeVal = $("pause-time-val");
  const stageVal = $("pause-stage-val");
  const tryVal = $("pause-tries-val");
  if (timeVal) timeVal.textContent = padClock(Date.now() - started);
  if (stageVal) stageVal.textContent = padStage(st?.levelNumber ?? 1);
  if (tryVal) tryVal.textContent = String((st?.totalFalls ?? 0) + 1);
  const ret = $("pause-return");
  const sound = $("pause-sound");
  const quit = $("pause-quit");
  if (ret) {
    ret.textContent = t("pause.resume");
    ret.classList.toggle("is-focus", pauseFocus === 0);
  }
  if (sound) {
    sound.textContent = t("pause.sound");
    sound.classList.toggle("is-focus", pauseFocus === 1);
  }
  if (quit) {
    quit.textContent = t("pause.quit");
    quit.classList.toggle("is-focus", pauseFocus === 2);
  }
  placePauseStats(box, menu?.stats, true);
  placeOverlay(ret, buttons?.returnToGame, true, "left");
  placeOverlay(sound, buttons?.toggleSound, true, "left");
  placeOverlay(quit, buttons?.quitToMenu, true, "left");
}

function syncSelectPrompt(on: boolean): void {
  const el = $("play-select");
  if (!el) return;
  const hd = on && usesHdType();
  let live: OverlayNode | undefined;
  for (const block of playBlocks()) {
    walkNodes(block, (node) => {
      const sel = node.select;
      if (!sel) return;
      if (hd && !live && !sel._off && (sel.currentFrame ?? 0) > 0) live = sel;
    });
  }
  if (!hd) {
    el.hidden = true;
    return;
  }
  el.textContent = t("play.select");
  if (!live?.localToGlobal) {
    el.hidden = true;
    return;
  }
  const p = live.localToGlobal(12, -28);
  const { sx, sy } = stageScale();
  el.hidden = false;
  el.style.left = (p.x / sx / 550) * 100 + "%";
  el.style.top = (p.y / sy / 300) * 100 + "%";
}

function cycleList(ids: string[], cur: string, dir: -1 | 1): string {
  if (!ids.length) return cur;
  const i = Math.max(0, ids.indexOf(cur));
  return ids[(i + dir + ids.length) % ids.length]!;
}

function showGameSky(on: boolean): void {
  ensureSky();
  const bg = loadSettings().themeBg;
  const cam = usingLiveBg();
  if (sky) sky.visible = on && bg && !cam;
  parkExportRoot(on);
  const box = window.stage?.gameContainer;
  if (box) box.visible = !on;
  document.body.classList.toggle("no-theme-bg", !bg && !cam);
  document.body.classList.toggle("has-webcam-bg", cam);
  if (on) document.body.classList.remove("is-playing");
}

function syncSidePanel(show: boolean): void {
  if (sidePanelOn === show) return;
  sidePanelOn = show;
  const panel = $("side_panel");
  if (!panel) return;
  const sel = $("image_select");
  if (sel) sel.style.display = "none";
  panel.classList.toggle("is-open", show);
  panel.style.display = show ? "" : "none";
  $("animation_container")?.classList.toggle("has-speedrun", show);
  $("play-chrome")?.classList.toggle("has-speedrun", show);
}

function hideVanillaMenu(): void {
  const menu = window.exportRoot?.menu as { visible?: boolean; scaleX?: number; scaleY?: number } | undefined;
  if (menu) {
    menu.visible = false;
    menu.scaleX = 1;
    menu.scaleY = 1;
  }
  setVanillaButtonsVisible(false);
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
  hideVanillaMenu();
  showGameSky(true);
  syncSidePanel(false);
}

function enterPlayVisuals(): void {
  menuParked = false;
  showGameSky(false);
  document.body.classList.add("is-playing");
  setExportRootMouse(true);
  setMouseOverRate(0);
  hud?.parkForPlay();
  placeHudInput(false, "0", "0", "0", "", "");
  sidePanelOn = null;
  lastTintKey = "";
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

function keepRunTotals(session: PlaySession): boolean {
  return (
    session.card === "gauntlet" ||
    (session.card === "seeded" && session.defs.length > 1) ||
    (!!session.classicRun && session.kind === "campaign" && !session.defs.length)
  );
}

function wrapLocalSave(): void {
  const st = window.stage;
  if (!st?.localSave?.save || localSaveWrapped) return;
  const orig = st.localSave.save.bind(st.localSave);
  localSaveWrapped = true;
  st.localSave.save = (num: number) => {
    if (playSession?.classicRun && playSession.kind === "campaign" && !playSession.defs.length) orig(num);
  };
}

function resetStageTotals(): void {
  const st = window.stage;
  if (!st) return;
  st.totalMoves = 0;
  st.totalFalls = 0;
  st.levelAttempts = 0;
}

function quitPlay(): void {
  const back = playSession?.returnTo && playSession.returnTo !== "auto" ? playSession.returnTo : "home";
  leavePlayTo(back);
}

function pauseMenuClip(): PauseMenuClip | undefined {
  return window.stage?.bloxWorld?.pauseMenu;
}

function pauseMenuFrame(): number {
  return pauseMenuClip()?.currentFrame ?? 0;
}

function isPauseMenuOpen(): boolean {
  const frame = pauseMenuFrame();
  return frame > 0 && frame < 24;
}

function clickPauseButton(name: PauseAction): void {
  const menu = pauseMenuClip();
  if (!menu) return;
  if (name === "toggleSound") {
    window.stage?.toggleSound?.();
    return;
  }
  if (name === "returnToGame") {
    if ((menu.currentFrame ?? 0) >= 10) menu.play?.();
    return;
  }
  quitPlay();
}

function paintPauseFocus(): void {
  const buttons = pauseMenuClip()?.buttons;
  if (!buttons) return;
  PAUSE_ACTIONS.forEach((name, i) => {
    const btn = buttons[name];
    if (!btn) return;
    const on = i === pauseFocus;
    btn.gotoAndStop?.(on ? 1 : 0);
    btn.scaleX = on ? 1.1 : 1;
    btn.scaleY = on ? 1.1 : 1;
  });
}

function handlePauseNav(ev: "up" | "down" | "left" | "right" | "confirm" | "back"): void {
  const action = pauseNavFromPad(ev);
  if (action === "prev" || action === "next") {
    const next = stepPauseFocus(pauseFocus, action === "prev" ? -1 : 1);
    if (next !== pauseFocus) {
      pauseFocus = next;
      cueMenuHover();
    }
    paintPauseFocus();
    return;
  }
  if (action === "confirm") {
    clickPauseButton(PAUSE_ACTIONS[pauseFocus]);
    return;
  }
  clickPauseButton("returnToGame");
}

function releaseSteerKeys(): void {
  const stage = window.stage;
  for (const code of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]) {
    stage?.triggerKeyUp?.({ code });
  }
}

function togglePauseMenu(): void {
  const menu = pauseMenuClip();
  if (!menu?.play) return;
  const frame = menu.currentFrame ?? 0;
  if (frame !== 0 && frame !== 12) return;
  if (frame === 0) {
    releaseSteerKeys();
    pauseFocus = 0;
  }
  menu.play();
  absorbHeldMenuConfirm();
}

function pollPauseMenuPad(): void {
  pollGamepad(undefined, togglePauseMenu);
  if (!isPauseMenuOpen()) return;
  paintPauseFocus();
  for (const ev of pollMenuPad({ pauseConfirms: false })) handlePauseNav(ev);
}

function hookWorldQuit(): void {
  const world = window.stage?.bloxWorld as
    | (BloxWorld & { tick?: () => void; keys?: { tick?: () => void }; __bloxHard?: boolean })
    | undefined;
  if (!world || world.__bloxQuit) return;
  world.__bloxQuit = true;
  world.transitionOutLevelQuit = () => {
    const back = playSession?.returnTo && playSession.returnTo !== "auto" ? playSession.returnTo : "home";
    leavePlayTo(back);
  };
  if (world.__bloxHard) return;
  world.__bloxHard = true;
  const origTick = world.tick?.bind(world);
  world.tick = () => {
    const menu = world.pauseMenu;
    const frame = menu?.currentFrame ?? 0;
    if (menu) (menu as PauseMenuClip & { visible?: boolean }).visible = frame !== 0;
    if (frame === 0) {
      world.keys?.tick?.();
      return;
    }
    origTick?.();
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
  const items: MenuItem[] = [
    { id: "start", label: t("menu.start") },
    { id: "resume", label: t("menu.resume"), disabled: savedLevel() < 1 },
    { id: "load", label: t("menu.load") },
    { id: "creator", label: t("menu.creator") },
    { id: "puzzles", label: t("menu.puzzles") },
    { id: "history", label: t("menu.history") },
    { id: "records", label: t("menu.records") },
  ];
  if (hasAchievementMenu()) items.push({ id: "achievements", label: t("menu.achievements") });
  items.push({ id: "credits", label: t("menu.credits") }, { id: "settings", label: t("menu.settings") });
  return items;
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
  if (extraView === "mobile-ask") return [{ id: "mobile-pad-on" }, { id: "mobile-pad-off" }];
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
      { id: "toggle-mobile-pad" },
      { id: "toggle-timer" },
      { id: "toggle-stage-name" },
      ...(s.mobilePad ? [{ id: "toggle-rotate" }] : []),
      { id: "toggle-play-time" },
      { id: "theme-cycle", adjust: (d) => applyTheme(cycleList(themeMenuItems(cachedDev).map((p) => p.id), currentThemeId(), d), true) },
      { id: "locale-cycle", adjust: (d) => applyLanguage(cycleList(listLocales().map((p) => p.id), localeId(), d)) },
      { id: "toggle-theme-bg" },
      { id: "toggle-webcam" },
      { id: "toggle-tab-cast" },
      ...(s.tabCastBg ? [{ id: "tab-crop" }] : []),
      { id: "bgtint", adjust: (d) => handleHudAction("bgtint:" + clampStep(s.bgTint, d * 0.1, 0, 1).toFixed(2)) },
      { id: "blockhue", adjust: (d) => handleHudAction("blockhue:" + String(clampStep(s.blockHue, d * 12, 0, 360))) },
      { id: "remap" },
      { id: "export-save" },
      { id: "import-save" },
    ];
  }
  if (extraView === "remap") {
    return [{ id: "settings" }, ...ACTIONS.map((id) => ({ id: "rebind:" + id }))];
  }
  if (extraView === "puzzles") {
    return [{ id: "back" }, { id: "puzzle-daily" }, { id: "puzzles-seeded" }, { id: "puzzles-gauntlet" }];
  }
  if (extraView === "puzzles-seeded") {
    return [{ id: "puzzles" }, { id: "puzzle-seed-go" }, { id: "toggle-seeded-endless" }];
  }
  if (extraView === "puzzles-gauntlet") {
    return [
      { id: "puzzles" },
      { id: "diff:easy" },
      { id: "diff:medium" },
      { id: "diff:hard" },
      { id: "diff:insane" },
      ...GAUNTLET_COUNTS.map((n) => ({ id: "glen:" + n })),
      { id: "gauntlet-go" },
    ];
  }
  if (extraView === "history") {
    const rows = loadFinishedStages().slice(listScroll, listScroll + LIST_HISTORY);
    return [
      { id: "back" },
      ...rows.filter((rec) => rec.cmds.length).map((_, i) => ({ id: "replay:" + (listScroll + i) })),
    ];
  }
  if (extraView === "records") {
    return [{ id: "back" }, ...recordRows(listScroll, REC_PAGE).map((row) => ({ id: "rec:" + row.id }))];
  }
  if (extraView === "achievements") {
    return [
      { id: "back" },
      ...achievementRows(listScroll, ACH_PAGE).map((row) => ({ id: "ach:" + row.n })),
    ];
  }
  if (extraView === "finish") return [{ id: "screenshot" }, { id: "back" }];
  if (extraView === "creator") {
    return [
      { id: "creator-new-stage" },
      { id: "creator-saved" },
      { id: "creator-manage" },
      { id: "creator-load" },
      { id: "back" },
    ];
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
    const back = "creator";
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
      { id: "creator" },
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
  if (uiBusy) return;
  if (extraView === "remap" && rebindAction) return;
  if (extraView === "splash") {
    if (ev === "confirm" || ev === "back") dismissSplash();
    return;
  }
  if (extraView === "creator-edit") {
    handleCreatorNav(ev);
    return;
  }
  const items = navItems();
  if (ev === "up") {
    const before = menuCursor;
    const scroll = listScroll;
    moveNav(-1);
    if (menuCursor !== before || listScroll !== scroll) cueMenuHover();
    markHudDirty();
    paintHud();
    return;
  }
  if (ev === "down") {
    const before = menuCursor;
    const scroll = listScroll;
    moveNav(1);
    if (menuCursor !== before || listScroll !== scroll) cueMenuHover();
    markHudDirty();
    paintHud();
    return;
  }
  const item = items[menuCursor];
  if (ev === "left") {
    if (item?.adjust) {
      item.adjust(-1);
      return;
    }
    const before = menuCursor;
    const scroll = listScroll;
    moveNav(-1);
    if (menuCursor !== before || listScroll !== scroll) cueMenuHover();
    markHudDirty();
    paintHud();
    return;
  }
  if (ev === "right") {
    if (item?.adjust) {
      item.adjust(1);
      return;
    }
    const before = menuCursor;
    const scroll = listScroll;
    moveNav(1);
    if (menuCursor !== before || listScroll !== scroll) cueMenuHover();
    markHudDirty();
    paintHud();
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

function cycleEditorTool(dir: 1 | -1): void {
  const i = EDITOR_TOOLS.findIndex((t) => t.id === paint.tool);
  const next = EDITOR_TOOLS[(i + dir + EDITOR_TOOLS.length) % EDITOR_TOOLS.length];
  paint.tool = next.id;
  paint.splitStep = 0;
  paint.splitAt = null;
  if (next.id !== "link") paint.linkFrom = null;
  paint.hint = next.label;
  markHudDirty();
  paintHud();
}

function paintEditorAt(x: number, y: number, phase: "start" | "drag"): void {
  if (x < 0 || y < 0 || x >= 15 || y >= 10) return;
  if (phase === "drag") {
    if (paint.tool === "spawn") return;
    if (paint.tool === "split" && paint.splitStep > 0) return;
    if (paint.tool === "link") {
      const ch = tileChar(draft, x, y);
      if (ch !== "l" && ch !== "r" && ch !== "k" && ch !== "q") return;
      const from = paint.linkFrom;
      if (!from) return;
      const sw = draft.switches.find((s) => s.x === from.x && s.y === from.y);
      if (sw?.bridges.some((b) => b.x === x && b.y === y)) return;
    }
  }
  const key = x + ":" + y;
  if (key === lastPaintCell && phase === "drag") return;
  if (phase === "start") {
    pushUndo();
    lastPaintCell = "";
  }
  lastPaintCell = key;
  editCursor = { x, y };
  paintEditorCell(draft, x, y, paint);
  beaten = false;
  hud?.refreshCreatorBoard({ tiles: draft.tiles, spawn: draft.spawn, marks: editorMarks(draft), cursor: editCursor });
}

function handleCreatorNav(ev: "up" | "down" | "left" | "right" | "confirm" | "back"): void {
  if (ev === "back") {
    goBack();
    return;
  }
    if (ev === "left" || ev === "right" || ev === "up" || ev === "down") {
    if (ev === "left") editCursor.x = Math.max(0, editCursor.x - 1);
    if (ev === "right") editCursor.x = Math.min(14, editCursor.x + 1);
    if (ev === "up") editCursor.y = Math.max(0, editCursor.y - 1);
    if (ev === "down") editCursor.y = Math.min(9, editCursor.y + 1);
    const held = editorPaintHeld || heldPadButtons().has(loadSettings().pads.confirm);
    if (held) paintEditorAt(editCursor.x, editCursor.y, "drag");
    else {
      hud?.refreshCreatorBoard({ tiles: draft.tiles, spawn: draft.spawn, marks: editorMarks(draft), cursor: editCursor });
    }
    return;
  }
  if (ev === "confirm") {
    editorPaintHeld = true;
    paintEditorAt(editCursor.x, editCursor.y, "start");
    scheduleBeatCheck();
    markHudDirty();
    paintHud();
  }
}

function moveNav(dir: 1 | -1): void {
  if (extraView === "history") {
    const total = loadFinishedStages().length;
    const maxScroll = Math.max(0, total - LIST_HISTORY);
    if (dir === 1 && menuCursor >= navItems().length - 1 && listScroll < maxScroll) {
      listScroll += 1;
      menuCursor = navItems().length - 1;
      return;
    }
    if (dir === -1 && menuCursor <= 2 && listScroll > 0) {
      listScroll -= 1;
      menuCursor = 2;
      return;
    }
  }
  if (extraView === "records") {
    const maxScroll = Math.max(0, recordCount() - REC_PAGE);
    if (dir === 1 && menuCursor >= navItems().length - 1 && listScroll < maxScroll) {
      listScroll += 1;
      menuCursor = navItems().length - 1;
      return;
    }
    if (dir === -1 && menuCursor <= 1 && listScroll > 0) {
      listScroll -= 1;
      menuCursor = 1;
      return;
    }
  }
  if (extraView === "achievements") {
    const maxScroll = Math.max(0, ACH_COUNT - ACH_PAGE);
    if (dir === 1 && menuCursor >= navItems().length - 1 && listScroll < maxScroll) {
      listScroll += 1;
      menuCursor = navItems().length - 1;
      return;
    }
    if (dir === -1 && menuCursor <= 1 && listScroll > 0) {
      listScroll -= 1;
      menuCursor = 1;
      return;
    }
  }
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
    String(s.showStageName),
    String(s.showPlayTime),
    String(s.mobilePad),
    String(s.rotateScreen),
    String(s.themeBg),
    String(s.webcamBg),
    String(s.tabCastBg),
    String(s.bgTint),
    String(s.bgHue),
    String(s.blockHue),
    String(s.music),
    String(s.sfx),
    currentThemeId(),
    themeMenuItems(cachedDev).map((p) => p.id).join(","),
    themeUploadMsg,
    localeId(),
    finishKind,
    finishTitle,
    finishSubtitle,
    String(rebindAction),
    loadError,
    puzzleDiff,
    String(gauntletCount),
    puzzleSeed,
    String(seededEndless),
    gauntletSeed,
    draftName,
    String(listScroll),
    `${editCursor.x},${editCursor.y}`,
    paint.tool,
    paint.hint,
    beatLabel,
    String(beaten),
    draft.tiles.join(""),
    draft.spawn.join(","),
    String(loadFinishedStages().length),
    String(unlockedCount()),
    String(hintTokens()),
    listSaved().map((row) => row.code).join(","),
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
  document.body.classList.toggle("is-creator-edit", extraView === "creator-edit");
  touchChrome?.sync();
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
  placeSettingsChrome(false);
  const s = loadSettings();
  if (extraView === "splash") {
    hud.drawSplash();
  } else if (extraView === "home") {
    hud.drawHome(brandName(getName()), homeItems(), menuCursor, animateHome);
    animateHome = false;
  } else if (extraView === "name") {
    hud.drawName();
    placeHudInput(true, "7.3%", "42.5%", "43%", t("name.placeholder"), getName(), NAME_MAX);
  } else if (extraView === "credits") hud.drawCredits();
  else if (extraView === "mobile-ask") hud.drawMobileAsk();
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
      showStageName: s.showStageName,
      showPlayTime: s.showPlayTime,
      mobilePad: s.mobilePad,
      rotateScreen: s.rotateScreen,
      themeBg: s.themeBg,
      webcamBg: s.webcamBg,
      tabCastBg: s.tabCastBg,
      music: s.music,
      sfx: s.sfx,
      bgTint: s.bgTint,
      bgHue: s.bgHue,
      blockHue: s.blockHue,
    });
    placeHudInput(true, "18.2%", "8.6%", "40%", "", getName(), NAME_MAX);
    placeSettingsChrome(true);
  } else if (extraView === "remap") {
    hud.drawRemap(
      ACTIONS.map((id) => ({
        id,
        label: t("action." + id),
        bind: prettyKey(s.keys[id]) + " · pad " + s.pads[id],
      })),
      rebindAction,
    );
  } else if (extraView === "finish") {
    const st = window.stage;
    const copy = finishCopy();
    hud.drawFinish({
      title: copy.title,
      cleared: copy.cleared,
      moves: lastFinished?.totalMoves ?? st?.totalMoves ?? 0,
      falls: st?.totalFalls ?? 0,
      fails: lastFinished?.fails ?? 0,
      rows: finishStatRows(),
    });
  } else if (extraView === "puzzles") {
    hud.drawPuzzles(utcDateLabel());
  } else if (extraView === "puzzles-seeded") {
    hud.drawSeeded(seededEndless);
    placeHudInput(true, "7.3%", "29.5%", "51%", t("puzzles.seed"), puzzleSeed, 24);
  } else if (extraView === "puzzles-gauntlet") {
    hud.drawGauntlet(puzzleDiff, gauntletCount);
    placeHudInput(true, "7.3%", "58%", "51%", t("puzzles.seed"), gauntletSeed, 24);
  } else if (extraView === "history") {
    const all = loadFinishedStages();
    const maxScroll = Math.max(0, all.length - LIST_HISTORY);
    if (listScroll > maxScroll) listScroll = maxScroll;
    hud.drawHistory({
      scroll: listScroll,
      total: all.length,
      pageSize: LIST_HISTORY,
      rows: all.slice(listScroll, listScroll + LIST_HISTORY).map((rec, i) => {
        const title = rec.title || t("play.stage", { n: String(rec.stage).padStart(2, "0") });
        const kind = rec.kind && rec.kind !== "campaign" ? t("history.kind." + rec.kind) : "";
        return {
          title: `${title} · ${rec.player} · ${rec.moves} ${t("play.moves")}`,
          meta: [kind, rec.seed, new Date(rec.at).toLocaleString()].filter(Boolean).join(" · "),
          replay: rec.cmds.length ? () => startHistoryReplay(all[listScroll + i]!) : undefined,
        };
      }),
    });
  } else if (extraView === "records") {
    const total = recordCount();
    const maxScroll = Math.max(0, total - REC_PAGE);
    if (listScroll > maxScroll) listScroll = maxScroll;
    hud.drawRecords({
      rows: recordRows(listScroll, REC_PAGE).map((row) => ({ label: t(row.label), meta: row.meta })),
      scroll: listScroll,
      total,
      pageSize: REC_PAGE,
    });
  } else if (extraView === "achievements") {
    const maxScroll = Math.max(0, ACH_COUNT - ACH_PAGE);
    if (listScroll > maxScroll) listScroll = maxScroll;
    hud.drawAchievements({
      tokens: hintTokens(),
      have: unlockedCount(),
      total: ACH_COUNT,
      rows: achievementRows(listScroll, ACH_PAGE),
      scroll: listScroll,
      pageSize: ACH_PAGE,
    });
  } else if (extraView === "creator") {
    hud.drawCreatorHub(t("menu.creator"), [
      { id: "creator-new-stage", label: t("creator.create") },
      { id: "creator-saved", label: t("creator.play") },
      { id: "creator-manage", label: t("creator.manage") },
      { id: "creator-load", label: t("creator.code") },
      { id: "back", label: t("common.back") },
    ], menuCursor);
  } else if (extraView === "creator-make") {
    hud.drawCreatorHub(t("creator.create"), [
      { id: "creator-new-stage", label: t("creator.new") },
      { id: "creator-manage", label: t("creator.manage") },
      { id: "creator", label: t("common.back") },
    ], menuCursor);
  } else if (extraView === "creator-play") {
    hud.drawCreatorHub(t("creator.play"), [
      { id: "creator-load", label: t("creator.code") },
      { id: "creator-saved", label: t("creator.saved") },
      { id: "creator", label: t("common.back") },
    ], menuCursor);
  } else if (extraView === "creator-manage" || extraView === "creator-saved") {
    const all = listSaved();
    const maxScroll = Math.max(0, all.length - LIST_PAGE);
    if (listScroll > maxScroll) listScroll = maxScroll;
    const page = all.slice(listScroll, listScroll + LIST_PAGE);
    hud.drawCreatorList({
      title: extraView === "creator-manage" ? t("creator.manage") : t("creator.saved"),
      rows: page.map((row, i) => {
        const idx = listScroll + i;
        return {
          title: row.name,
          meta: row.author + " · " + row.seed,
          openId: (extraView === "creator-manage" ? "manage:" : "saved:") + idx,
          deleteId: extraView === "creator-manage" ? "delete:" + idx : undefined,
        };
      }),
      empty: extraView === "creator-manage" ? t("creator.empty") : t("creator.emptySaved"),
      backId: "creator",
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
      marks: editorMarks(draft),
      cursor: editCursor,
    });
    placeHudInput(true, "21.5%", "2.1%", "18%", t("creator.placeholder"), draftName, 24);
  }
}

function openPanel(name: Screen): void {
  extraView = name;
  markHudDirty();
  lastHudPaint = "";
  if (name === "home") animateHome = true;
  if (name === "load") loadError = "";
  if (name === "creator-manage" || name === "creator-saved" || name === "history" || name === "achievements" || name === "records") listScroll = 0;
  if (name === "creator-edit") {
    editCursor = { x: draft.spawn[0], y: draft.spawn[1] };
    editorPaintHeld = false;
  }
  if (name === "puzzles-seeded") puzzleSeed = freshSeed();
  if (name === "puzzles-gauntlet") gauntletSeed = freshSeed();
  if (name === "creator-edit") scheduleBeatCheck();
  if (name !== "remap") rebindAction = null;
  menuCursor = defaultMenuCursor();
  paintHud();
}

function defaultMenuCursor(): number {
  const items = navItems();
  const backIds = new Set(["back", "settings", "puzzles", "creator", "creator-make", "creator-play"]);
  const idx = items.findIndex((it) => !backIds.has(it.id) && !it.disabled);
  return idx >= 0 ? idx : 0;
}

function applyTheme(theme: ThemeId, reload = false): void {
  const id = isDevOnlyTheme(normalizeTheme(theme)) && !cachedDev ? "original" : normalizeTheme(theme);
  setCurrentThemeId(id);
  try {
    localStorage.setItem("theme", id);
  } catch {
    /* ignore */
  }
  let href = "";
  try {
    const url = new URL(window.location.href);
    if (id === "original" || id === "gray" || id === "holiday") url.searchParams.set("img", id);
    else url.searchParams.delete("img");
    href = url.toString();
    if (!reload) history.replaceState(null, "", href);
  } catch {
    href = "";
  }
  if (reload) {
    if (href && href !== window.location.href) window.location.replace(href);
    else window.location.reload();
    return;
  }
  const sel = $("image_select") as HTMLSelectElement | null;
  if (sel) {
    const ids = themeMenuItems(cachedDev);
    if (sel.dataset.ids !== ids.map((p) => p.id).join(",")) {
      sel.innerHTML = "";
      for (const pack of ids) {
        const opt = document.createElement("option");
        opt.value = pack.id;
        opt.textContent = pack.builtin ? themePackLabel(pack.id, pack.name) : pack.name;
        sel.appendChild(opt);
      }
      sel.dataset.ids = ids.map((p) => p.id).join(",");
    }
    sel.value = id;
  }
  setHdRendering(isHdTheme(id));
  void swapAtlasLive(id);
  applyLooks();
  for (const clip of hud?.hueClips() ?? []) (clip as { __bloxHue?: number }).__bloxHue = undefined;
  applyBlockHue();
  lastTintKey = "";
  window.__bloxResetStoneStamp?.();
  refreshPlayTilesAfterTheme();
  if (!isSolid3d(id)) clearTheme3d();
  markHudDirty();
  lastHudPaint = "";
  paintHud();
  ensureMenuMusic();
}

function loadAtlasImage(theme: ThemeId): Promise<HTMLCanvasElement> {
  return composeThemeAtlas(theme);
}

async function swapAtlasLive(theme: ThemeId): Promise<void> {
  try {
    const img = await loadAtlasImage(theme);
    const sheet = atlasSheet();
    if (sheet) adoptAtlasCanvas(sheet, img);
    const images = adobeComp()?.getImages?.();
    if (images) images.bloxorz_atlas_ = img;
    refreshPlayTilesAfterTheme();
  } catch {
    /* keep current atlas */
  }
}

function refreshPlayTilesAfterTheme(): void {
  const world = window.stage?.bloxWorld as
    | { tiles?: { image?: unknown; uncache?: () => void }[] }
    | undefined;
  if (!world?.tiles?.length) return;
  const stamp = window.__bloxGetStoneStamp?.();
  for (const tile of world.tiles) {
    if (tile.image && stamp) tile.image = stamp;
    else tile.uncache?.();
  }
}

function rawCampaignDefs(): LevelDef[] {
  const raw = origGetLevels?.() ?? [];
  return raw.map((level, i) => createJsToDef(level as ReturnType<typeof defToCreateJs>, i));
}

function shouldAskMobilePad(): boolean {
  const s = loadSettings();
  if (s.mobilePadChoice === "on" || s.mobilePadChoice === "off") return false;
  return looksLikeMobile();
}

function afterIdentity(): void {
  if (applyPendingShare()) return;
  if (shouldAskMobilePad()) openPanel("mobile-ask");
  else openPanel("home");
}

function chooseMobilePad(on: boolean): void {
  setMobilePad(on);
  touchChrome?.sync();
  openPanel("home");
}

function toggleRotateScreen(): void {
  setRotateScreen(!loadSettings().rotateScreen);
  try {
    void screen.orientation?.unlock?.();
  } catch {
    /* standalone iOS stays portrait; CSS rotate covers that */
  }
  lastHudPaint = "";
  touchChrome?.sync();
  markHudDirty();
  paintHud();
}

function dismissSplash(): void {
  if (splashDone) return;
  splashDone = true;
  unlockAudio(() => {
    setMenuMusicAllowed(true);
    ensureMenuMusic();
  });
  if (!getName()) openPanel("name");
  else afterIdentity();
}

function goBack(): void {
  if (extraView === "mobile-ask") {
    chooseMobilePad(false);
    return;
  }
  if (extraView === "finish") {
    openPanel(finishReturnTo);
    return;
  }
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
    openPanel("creator");
    return;
  }
  if (extraView === "creator-make" || extraView === "creator-play") {
    openPanel("creator");
    return;
  }
  if (extraView === "creator-manage" || extraView === "creator-saved") {
    openPanel("creator");
    return;
  }
  if (extraView === "puzzles-seeded" || extraView === "puzzles-gauntlet") {
    openPanel("puzzles");
    return;
  }
  openPanel("home");
}

function sessionKind(): HistoryKind {
  if (playSession?.card === "daily") return "daily";
  if (playSession?.card === "gauntlet") return "gauntlet";
  if (playSession?.card === "seeded") return "seeded";
  if (playSession?.kind === "custom") return "custom";
  return "campaign";
}

function sessionSeed(stageNo: number): string {
  const def = playSession?.defs[stageNo - 1] ?? playDef();
  if (def && (playSession?.kind === "custom" || playSession?.card === "daily" || playSession?.card === "gauntlet" || playSession?.card === "seeded")) {
    return encodeSeed(def);
  }
  return playSession?.seed || "";
}

function recordCmd(cmd: TapeCmd): void {
  if (!playSession?.record || autoSolve) return;
  if (currentLabel() !== "game") return;
  if (cmd === "swap" && playBlocks().length <= 1) return;
  tape.push(cmd);
  if (cmd === "swap") noteSwap();
}

let rawKeyDown: ((evt: { code: string }) => void) | undefined;
function tapedKeyDown(evt: { code: string }): void {
  rawKeyDown?.(evt);
  if (evt.code === "Space") recordCmd("swap");
}

let rawOnMove: ((mc: unknown, axis: string, change: number, position?: unknown) => void) | undefined;
function tapedOnMove(mc: unknown, axis: string, change: number, position?: unknown): void {
  rawOnMove?.(mc, axis, change, position);
  const cmd = tapeCmdFromRoll(axis, change);
  if (cmd) recordCmd(cmd);
}

function hookReplayCapture(): void {
  const st = window.stage;
  if (st?.triggerKeyDown && st.triggerKeyDown !== tapedKeyDown) {
    rawKeyDown = st.triggerKeyDown.bind(st);
    st.triggerKeyDown = tapedKeyDown;
  }
  const world = st?.bloxWorld;
  if (world?.onMove && world.onMove !== tapedOnMove) {
    rawOnMove = world.onMove.bind(world);
    world.onMove = tapedOnMove;
  }
}

function persistWonStage(stageNo: number): void {
  if (!playSession?.record) return;
  const lv = run?.levels.find((l) => l.stage === stageNo);
  const cmds = lv ? winningTape(lv) : null;
  if (!cmds?.length) return;
  const kind = sessionKind();
  const seed = sessionSeed(stageNo);
  const title =
    playSession.title && playSession.card !== "classic"
      ? playSession.defs.length > 1
        ? `${playSession.title} ${stageNo}/${playSession.defs.length}`
        : playSession.title
      : `Stage ${String(stageNo).padStart(2, "0")}`;
  saveFinishedStage({
    id: `${run?.id || Date.now()}-${kind}-${stageNo}-${seed || title}`,
    at: Date.now(),
    player: run?.player || getName() || "BLOX",
    stage: stageNo,
    moves: cmds.length,
    cmds,
    title,
    kind,
    seed: seed || undefined,
  });
}

function reportPlayWin(stageNo: number): void {
  if (autoSolve) return;
  const creatorTest = playSession?.returnTo === "creator-edit" || playSession?.entry === "creator-test";
  if (!playSession?.record && !creatorTest) return;
  if (playClock) {
    notePlayMs(Date.now() - playClock);
    playClock = Date.now();
  }
  const kind = sessionKind();
  const seed = sessionSeed(stageNo);
  const uniqueKey = uniqueStageKey(kind, stageNo, kind === "daily" ? playSession?.subtitle || seed : seed);
  const lv = run?.levels.find((l) => l.stage === stageNo);
  const cmds = (lv ? winningTape(lv) : null) || tape;
  const failTapes = lv?.tapes.filter((row) => !row.won).length ?? (stageFailed ? 1 : 0);
  const moves = cmds.length || window.stage?.bloxWorld?.moves || 0;
  const def =
    playSession?.defs[stageNo - 1] ??
    (kind === "campaign" && !playSession?.defs.length ? rawCampaignDefs()[stageNo - 1] : playDef());
  const gauntletLen = playSession?.card === "gauntlet" ? playSession.defs.length || GAUNTLET_LEN : undefined;
  const gauntletNoFallRun =
    !!gauntletLen &&
    stageNo >= gauntletLen &&
    !!run &&
    run.levels.filter((l) => l.stage <= gauntletLen).every((l) => !l.tapes.some((row) => !row.won)) &&
    failTapes === 0;
  const classicComplete = !!playSession?.classicRun && kind === "campaign" && stageNo === 33;
  const note: WinNote = {
    kind,
    stageNo,
    uniqueKey,
    moves,
    noFall: failTapes === 0 && !stageFailed,
    cmds,
    theme: currentTheme(),
    timerOn: loadSettings().showTimer,
    classicRun: !!playSession?.classicRun,
    classicComplete,
    classicFalls: classicComplete ? (run?.fails ?? window.stage?.totalFalls ?? 0) : undefined,
    classicMoves: classicComplete ? (window.stage?.totalMoves ?? run?.totalMoves ?? moves) : undefined,
    def,
    via: playSession?.entry,
    dailyDate: kind === "daily" ? playSession?.subtitle : undefined,
    gauntletDiff: playSession?.diff,
    gauntletLen,
    gauntletNoFallRun,
    comeback: failTapes > 0 || stageFailed,
    stubborn: failTapes >= 5,
    day: utcDateLabel(),
  };
  noteWin(note);
  stageFailed = false;
}

function defForFinished(rec: FinishedStage): LevelDef | null {
  if (rec.seed) return parseShare(rec.seed) ?? decodeSeed(rec.seed);
  if ((rec.kind ?? "campaign") === "campaign") {
    return rawCampaignDefs()[(rec.stage || 1) - 1] ?? null;
  }
  return null;
}

function startHistoryReplay(rec: FinishedStage): void {
  const def = defForFinished(rec);
  if (!def || !rec.cmds.length) return;
  resetPadState();
  startCustom([structuredClone(def)], "history", {
    card: rec.kind === "daily" ? "daily" : rec.kind === "campaign" ? "classic" : "custom",
    title: rec.title || "REPLAY",
    seed: rec.seed,
    record: false,
    replay: true,
  });
  autoSolve = true;
  solveTape = rec.cmds.slice();
  solveRetries = 0;
  solveFeeder = createFeeder(solveTape);
  noteReplayWatch();
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
    beginPlay(1, { kind: "campaign", defs: [], returnTo: "home", record: true, classicRun: true, entry: "start" });
  } else if (act === "resume") {
    const n = savedLevel();
    if (n) beginPlay(n, { kind: "campaign", defs: [], returnTo: "home", record: true, classicRun: true, entry: "resume" });
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
  else if (act === "records") openPanel("records");
  else if (act === "achievements") openPanel("achievements");
  else if (act === "skip-name") {
    if (!getName()) setName("BLOX");
    afterIdentity();
  } else if (act === "name-continue") {
    const next = hudInput()?.value.trim();
    if (!next) return;
    setName(next);
    afterIdentity();
  } else if (act === "mobile-pad-on") {
    chooseMobilePad(true);
  } else if (act === "mobile-pad-off") {
    chooseMobilePad(false);
  } else if (act === "toggle-mobile-pad") {
    setMobilePad(!loadSettings().mobilePad);
    lastHudPaint = "";
    touchChrome?.sync();
    markHudDirty();
    paintHud();
  } else if (act === "toggle-rotate") {
    toggleRotateScreen();
  } else if (act === "toggle-rumble") {
    const s = loadSettings();
    s.rumble = !s.rumble;
    saveSettings(s);
    if (s.rumble) rumble(180, 0.6, 0.5, true);
    markHudDirty();
    paintHud();
  } else if (act === "toggle-timer") {
    const s = loadSettings();
    s.showTimer = !s.showTimer;
    saveSettings(s);
    markHudDirty();
    paintHud();
  } else if (act === "toggle-stage-name") {
    const s = loadSettings();
    s.showStageName = !s.showStageName;
    saveSettings(s);
    markHudDirty();
    paintHud();
  } else if (act === "toggle-play-time") {
    const s = loadSettings();
    s.showPlayTime = !s.showPlayTime;
    saveSettings(s);
    lastPlayHudKey = "";
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
  } else if (act === "toggle-webcam") {
    const s = loadSettings();
    s.webcamBg = !s.webcamBg;
    if (s.webcamBg) s.tabCastBg = false;
    saveSettings(s);
    applyLooks();
    showGameSky(true);
    lastTintKey = "";
    applyThemeMedia();
    markHudDirty();
    paintHud();
  } else if (act === "toggle-tab-cast") {
    const s = loadSettings();
    s.tabCastBg = !s.tabCastBg;
    if (s.tabCastBg) s.webcamBg = false;
    saveSettings(s);
    applyLooks();
    showGameSky(true);
    lastTintKey = "";
    applyThemeMedia();
    markHudDirty();
    paintHud();
  } else if (act === "tab-crop") {
    openTabCropModal();
  } else if (act === "export-save") {
    void exportSaveFile();
  } else if (act === "import-save") {
    ($("hud-save-import") as HTMLInputElement | null)?.click();
  } else if (act === "toggle-seeded-endless") {
    seededEndless = !seededEndless;
    markHudDirty();
    paintHud();
  } else if (act === "screenshot") {
    void copyGameShot();
    noteScreenshot();
    markHudDirty();
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
    scheduleHudPaint();
  } else if (act.startsWith("bghue:")) {
    const s = loadSettings();
    s.bgHue = Number(act.slice(6));
    saveSettings(s);
    applyLooks();
    scheduleHudPaint();
  } else if (act.startsWith("blockhue:")) {
    const s = loadSettings();
    s.blockHue = Number(act.slice(9));
    saveSettings(s);
    applyBlockHue();
    scheduleHudPaint();
  } else if (act.startsWith("theme:")) {
    applyTheme(normalizeTheme(act.slice(6)), true);
  } else if (act === "theme-cycle") {
    applyTheme(cycleList(themeMenuItems(cachedDev).map((p) => p.id), currentThemeId(), 1), true);
  } else if (act === "locale-cycle") {
    applyLanguage(cycleList(listLocales().map((p) => p.id), localeId(), 1));
  } else if (act.startsWith("locale:")) {
    applyLanguage(act.slice(7));
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
    paintEditorAt(x, y, parts[3] === "drag" ? "drag" : "start");
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
  else if (act.startsWith("glen:")) {
    const n = Number(act.slice(5));
    if (GAUNTLET_COUNTS.includes(n as GauntletCount)) {
      gauntletCount = n as GauntletCount;
      markHudDirty();
      paintHud();
    }
  } else if (act === "gauntlet-go") playGauntlet(hudInput()?.value.trim() || gauntletSeed, puzzleDiff, gauntletCount);
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
    lastHudPaint = "";
    markHudDirty();
    paintHud();
  } else if (act.startsWith("replay:")) {
    const rec = loadFinishedStages()[Number(act.slice(7))];
    if (rec) startHistoryReplay(rec);
  } else if (act.startsWith("ach:")) {
    const n = Number(act.slice(4));
    const result = spendHint(n);
    if (result === "tokens") paint.hint = t("achievements.need");
    lastHudPaint = "";
    markHudDirty();
    paintHud();
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
  noteCopiedSeed();
  markHudDirty();
  paintHud();
}

function modalBox(): HTMLElement | null {
  return $("hud-modal");
}

function modalInput(): HTMLTextAreaElement | null {
  return $("hud-modal-input") as HTMLTextAreaElement | null;
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
    input.maxLength = 4096;
  }
  box?.classList.add("is-open");
  window.setTimeout(() => input?.focus(), 0);
}

/** Simple percent crop editor for the cast tab background. */
function openTabCropModal(): void {
  const s = loadSettings();
  const cur = s.tabCrop;
  const raw = window.prompt(
    t("settings.tabCropPrompt"),
    `${Math.round(cur.x * 100)},${Math.round(cur.y * 100)},${Math.round(cur.w * 100)},${Math.round(cur.h * 100)}`,
  );
  if (raw == null) return;
  const parts = raw.split(/[,\s]+/).map((n) => Number(n));
  if (parts.length < 4 || parts.some((n) => !Number.isFinite(n))) return;
  const [x, y, w, h] = parts;
  s.tabCrop = {
    x: Math.max(0, Math.min(0.95, x / 100)),
    y: Math.max(0, Math.min(0.95, y / 100)),
    w: Math.max(5, Math.min(100, w)) / 100,
    h: Math.max(5, Math.min(100, h)) / 100,
  };
  saveSettings(s);
  applyTabCrop();
  markHudDirty();
  paintHud();
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
    title: saved?.name || t("play.custom"),
    subtitle: saved?.author || "",
    author: saved?.author,
    entry: "code",
    seed: encodeSeed(def),
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
    loadShareIntoEditor(def);
  }
}

function loadShareIntoEditor(def: LevelDef): void {
  pushUndo();
  draft = def;
  draftName = "Untitled";
  beaten = false;
  paint = newPaintState();
  paint.hint = `Loaded ${occupiedTileCount(def)} tiles from reverse seed.`;
  scheduleBeatCheck();
  openPanel("creator-edit");
}

function applyPendingShare(): boolean {
  const raw = shareFromLocation(location.search, location.hash);
  if (!raw) return false;
  const def = parseShare(raw, listSaved());
  if (!def) return false;
  splashDone = true;
  if (!getName()) setName("BLOX");
  loadShareIntoEditor(def);
  try {
    history.replaceState(null, "", `${location.pathname}${location.search.replace(/[?&](code|seed)=[^&]*/g, "").replace(/^&/, "?")}`);
  } catch {
    /* ignore */
  }
  return true;
}

function openCodeModal(): void {
  openModal("code-edit", t("modal.seed"), "BXS.");
}

function openPlayCodeModal(): void {
  openModal("code-play", t("modal.code"), "BXS.");
}

function playDaily(): void {
  const day = utcDateLabel();
  const p = generateDaily(new Date());
  startCustom([p.def], "puzzles", {
    card: "daily",
    title: t("play.daily"),
    subtitle: day,
    seed: p.seed,
    entry: "puzzle",
  });
}

function playSeededRun(seed: string): void {
  const clean = seed.trim() || freshSeed();
  puzzleSeed = clean;
  if (seededEndless) {
    const run = generateRun(clean, "insane", 33);
    startCustom(
      run.map((p) => p.def),
      "puzzles-seeded",
      {
        card: "seeded",
        title: t("play.seeded"),
        subtitle: clean,
        seed: clean,
        entry: "puzzle",
        diff: "insane",
      },
    );
    return;
  }
  const p = generateSeeded(clean);
  startCustom([p.def], "puzzles-seeded", {
    card: "seeded",
    title: t("play.seeded"),
    subtitle: clean,
    seed: clean,
    entry: "puzzle",
  });
}

function playGauntlet(seed: string, diff: Difficulty, count: GauntletCount = gauntletCount): void {
  const clean = seed.trim() || freshSeed();
  gauntletSeed = clean;
  gauntletCount = count;
  const run = generateRun(clean, diff, count);
  startCustom(
    run.map((p) => p.def),
    "puzzles-gauntlet",
    {
      card: "gauntlet",
      title: t("play.gauntlet", { diff: t("diff." + diff) }),
      subtitle: clean,
      seed: clean,
      entry: "puzzle",
      diff,
    },
  );
}

function playSavedStage(row: { name: string; author: string; def: LevelDef }, returnTo: Screen): void {
  startCustom([structuredClone(row.def)], returnTo, {
    card: "custom",
    title: row.name || t("play.custom"),
    subtitle: row.author,
    author: row.author,
    entry: "saved",
    seed: encodeSeed(row.def),
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
  hushStageMusic();
}

function finishStatRows(): { title: string; meta: string }[] {
  const levels = (lastFinished?.levels ?? []).filter((lv) => lv.tapes.some((row) => row.won && row.cmds.length) || lv.moves);
  if (levels.length) {
    return levels.map((lv) => ({
      title: t("play.stage", { n: String(lv.stage).padStart(2, "0") }),
      meta: `${lv.moves} ${t("play.moves")} · ${lv.attempts} ${t("finish.attempts")}`,
    }));
  }
  const st = window.stage;
  const moves = lastFinished?.totalMoves ?? st?.totalMoves ?? 0;
  const attempts = (lastFinished?.fails ?? 0) + 1;
  const stageNo = lastFinished?.levels[0]?.stage ?? st?.levelNumber ?? 1;
  return [
    {
      title: t("play.stage", { n: String(stageNo).padStart(2, "0") }),
      meta: `${moves} ${t("play.moves")} · ${attempts} ${t("finish.attempts")}`,
    },
  ];
}

function finishCopy(): { title: string; cleared: string } {
  if (finishKind === "daily") {
    return { title: t("finish.dailyTitle"), cleared: t("finish.dailyCleared", { day: finishSubtitle || utcDateLabel() }) };
  }
  if (finishKind === "seeded") {
    return { title: t("finish.seededTitle"), cleared: t("finish.seededCleared", { seed: finishSubtitle }) };
  }
  if (finishKind === "gauntlet") {
    return { title: t("finish.gauntletTitle"), cleared: t("finish.gauntletCleared", { seed: finishSubtitle }) };
  }
  return { title: finishTitle || t("finish.title"), cleared: t("finish.cleared") };
}

function rememberFinish(session: PlaySession | null): void {
  finishKind = session?.card ?? "classic";
  finishTitle = session?.title || t("finish.title");
  finishSubtitle = session?.subtitle || session?.seed || "";
  const back = session?.returnTo;
  finishReturnTo = back && back !== "auto" && back !== "finish" ? back : "home";
}

async function copyGameShot(): Promise<void> {
  const canvas = $("canvas") as HTMLCanvasElement | null;
  if (!canvas) return;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

async function exportSaveFile(): Promise<void> {
  const backup = await buildSaveBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const a = document.createElement("a");
  const href = URL.createObjectURL(blob);
  a.href = href;
  a.download = `bloxorz-save-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1500);
}

function showFinish(): void {
  overlayMode = "";
  menuParked = false;
  parkCreateJsMenu();
  setVanillaCongraVisible(false);
  setMouseOverRate(5);
  hud?.setVisible(true);
  raiseHud();
  openPanel("finish");
  startMenuAudio();
  overlayMode = "menu";
}

function leavePlayTo(view: Screen): void {
  if (playClock) {
    notePlayMs(Date.now() - playClock);
    playClock = 0;
  }
  window.stage?.bloxWorld?.destroy?.();
  const flags = window as unknown as { setStageLoaded?: (n: number) => void; setSplit?: (n: number) => void };
  flags.setStageLoaded?.(0);
  flags.setSplit?.(0);
  playSession = null;
  lastTintKey = "";
  syncPlayChrome(false);
  syncHowto(false);
  syncStageCard(false);
  syncPauseStats(false);
  syncSelectPrompt(false);
  clearTheme3d();
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
  absorbHeldMenuConfirm();
}

function beginPlay(levelNumber: number, session: PlaySession): void {
  if (session.kind === "custom") {
    for (const def of session.defs) def.code = "000000";
  }
  if (session.record && !run) {
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
  }
  replayExclude = session.record ? [] : replayExclude;
  playSession = session;
  extraView = "auto";
  tape = [];
  lastLevelNum = levelNumber;
  stageFailed = false;
  playClock = Date.now();
  overlayMode = "run";
  playLaunching = true;
  lastTintKey = "";
  enterPlayVisuals();
  hushPlayAudio();
  unlockAudio();
  const stage = window.stage;
  if (stage) stage.touchMode = false;
  if (stage) stage.levelNumber = levelNumber;
  wrapLocalSave();
  if (!keepRunTotals(session) || levelNumber <= 1) resetStageTotals();
  (window as unknown as { setCurrentLevel?: (n: number) => void }).setCurrentLevel?.(levelNumber);
  syncSidePanel(!!session.classicRun && session.entry === "start" && loadSettings().showTimer);
  if (session.replay) {
    window.exportRoot?.gotoAndPlay?.("game");
    return;
  }
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
    record: opts.record ?? returnTo !== "creator-edit",
    classicRun: false,
    title: opts.title,
    subtitle: opts.subtitle,
    card: opts.card ?? "custom",
    seed: opts.seed,
    author: opts.author,
    entry: opts.entry ?? (returnTo === "creator-edit" ? "creator-test" : "puzzle"),
    diff: opts.diff,
    replay: opts.replay,
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
    title: playSession.title || t("play.custom"),
    subtitle,
  };
}

function syncLetterbox(on: boolean): void {
  const st = window.stage;
  const root = window.exportRoot as
    | (StageLike & { __bloxBox?: TintShape; addChildAt?: (c: unknown, i: number) => void })
    | undefined;
  const cjs = window.createjs as { Shape?: new () => TintShape } | undefined;
  document.body.classList.toggle("title-letterbox", on);
  if (on && sky) sky.visible = false;
  if (!cjs?.Shape) return;

  if (!letterbox) {
    letterbox = new cjs.Shape();
    letterbox.graphics.beginFill("#000").drawRect(-80, -80, 710, 460);
    letterbox.mouseEnabled = false;
  }
  letterbox.visible = on;

  if (root?.addChildAt) {
    if (!root.contains?.(letterbox)) root.addChildAt(letterbox, 0);
    else if (root.setChildIndex) root.setChildIndex(letterbox, 0);
    return;
  }
  if (st?.addChildAt) {
    if (!st.contains?.(letterbox)) st.addChildAt(letterbox, 0);
    else if (st.setChildIndex) st.setChildIndex(letterbox, 0);
  }
}

type PlayBlock = {
  roll?: { idle?: boolean };
  currentFrame?: number;
  children?: PlayBlock[];
  image?: unknown;
  spriteSheet?: unknown;
  filters?: unknown;
  cacheID?: number;
  select?: OverlayNode;
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
  solveTape = [];
  solveRetries = 0;
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
  const ht = window.stage?.bloxWorld?.helpText;
  const gc = window.stage?.gameContainer as {
    children?: { buttons?: unknown; menuButton?: unknown; roll?: unknown; totalFrames?: number; visible?: boolean; alpha?: number }[];
  } | undefined;
  if (!usesHdType()) {
    if (ht && ht.visible === false) {
      ht.visible = true;
      ht.alpha = 1;
    }
    for (const child of gc?.children ?? []) {
      if (child.buttons || child.menuButton || child.roll) continue;
      if (typeof child.totalFrames === "number" && child.totalFrames >= 40 && child.totalFrames <= 52 && child.visible === false) {
        child.visible = true;
        child.alpha = 1;
      }
    }
    return;
  }
  if (ht) {
    ht.alpha = 0;
    ht.visible = false;
  }
  for (const child of gc?.children ?? []) {
    if (child.buttons || child.menuButton || child.roll) continue;
    if (typeof child.totalFrames === "number" && child.totalFrames >= 40 && child.totalFrames <= 52) {
      child.visible = false;
      child.alpha = 0;
    }
  }
}

function applyPlayTint(): void {
  const gc = window.stage?.gameContainer as {
    addChildAt?: (c: unknown, i: number) => void;
    setChildIndex?: (c: unknown, i: number) => void;
    getChildIndex?: (c: unknown) => number;
    children?: unknown[];
    numChildren?: number;
    __bloxTint?: TintShape;
  } | undefined;
  const world = window.stage?.bloxWorld as {
    background?: SkyClip & { instance_2?: SkyClip };
  } | undefined;
  const cjs = window.createjs as { Shape?: new () => TintShape } | undefined;
  const s = loadSettings();
  const cam = usingLiveBg();
  const skySpr = world?.background?.instance_2;
  if (skySpr) skySpr.visible = s.themeBg && !cam;
  if (sky) sky.visible = !cam && sky.visible;
  applySkySpriteTint(cam ? null : skySpr, s.bgHue, s.bgTint);
  applySkySpriteTint(cam ? null : sky, s.bgHue, s.bgTint);
  if (!gc?.addChildAt || !cjs?.Shape) return;
  const key = `${s.bgTint}|${s.bgHue}|${s.themeBg}|${cam}`;
  let overlay = gc.__bloxTint;
  const listed = !!(overlay && gc.children?.includes(overlay));
  if (!listed) {
    overlay = new cjs.Shape();
    overlay.mouseEnabled = false;
    gc.addChildAt(overlay, Math.min(1, gc.numChildren ?? 1));
    gc.__bloxTint = overlay;
    lastTintKey = "";
  }
  if (overlay && gc.setChildIndex && gc.getChildIndex) {
    const bg = world?.background;
    const bgIdx = bg ? gc.getChildIndex(bg) : -1;
    const want = bgIdx >= 0 ? bgIdx + 1 : 1;
    const idx = gc.getChildIndex(overlay);
    if (idx !== want) gc.setChildIndex(overlay, Math.min(want, Math.max(0, (gc.numChildren ?? 1) - 1)));
  }
  if (!overlay) return;
  if (key === lastTintKey && listed) return;
  lastTintKey = key;
  overlay.graphics.clear();
  if (s.themeBg && s.bgTint > 0.01 && !cam) {
    overlay.graphics.beginFill(hueCss(s.bgHue, 1)).drawRect(-40, -40, 630, 380);
    overlay.alpha = Math.min(0.55, 0.12 + s.bgTint * 0.4);
    overlay.visible = true;
  } else {
    overlay.visible = false;
  }
}

function commitTape(won: boolean, stageNo: number): void {
  if (!won && !autoSolve) {
    stageFailed = true;
    if (playClock) {
      notePlayMs(Date.now() - playClock);
      playClock = Date.now();
    }
    noteFall();
  }
  if (!playSession?.record) {
    tape = [];
    return;
  }
  if (run) {
    let lv = run.levels.find((l) => l.stage === stageNo);
    if (!lv) {
      lv = { stage: stageNo, timeMs: 0, moves: tape.length, attempts: 0, tapes: [] };
      run.levels.push(lv);
    }
    lv.attempts += 1;
    if (won) {
      lv.tapes = [{ cmds: tape.slice(), won: true }];
      lv.moves = tape.length;
    } else {
      run.fails += 1;
    }
  }
  tape = [];
}

function scheduleBeatCheck(): void {
  const issue = isPlayable(draft);
  if (issue) {
    beatLabel = issue;
    beaten = false;
  } else {
    beaten = checkBeatable(draft);
    beatLabel = beaten ? t("creator.beatable") : t("creator.impossible");
  }
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
  noteSaved(draft);
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
    title: draftName || t("play.custom"),
    subtitle: getName() || "",
    author: getName() || "",
  });
}

function loadPasscode(): void {
  const field = hudInput();
  const value = ((field?.value || "") + "").replace(/\D/g, "").slice(0, 6);
  if (field) field.value = value;
  if (value.length !== 6) {
    loadError = t("error.passcode");
    markHudDirty();
    paintHud();
    return;
  }
  const codes = (window as unknown as { getLevelCodes?: () => string[] }).getLevelCodes?.() || [];
  const index = codes.indexOf(value);
  if (index === -1) {
    loadError = t("error.unknownPass");
    markHudDirty();
    paintHud();
    return;
  }
  loadError = "";
  beginPlay(index + 1, { kind: "campaign", defs: [], returnTo: "home", record: true, classicRun: false, entry: "passcode" });
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

function instructionClip(): {
  play?: () => void;
  gotoAndPlay?: (n: string | number) => void;
  currentFrame?: number;
  paused?: boolean;
  nextButton?: OverlayNode;
  nextButton2?: OverlayNode;
  prevButton?: OverlayNode;
  skipButton?: OverlayNode;
  backButton?: OverlayNode;
  startButton?: OverlayNode;
  instance?: OverlayNode;
  instance_1?: OverlayNode;
  instance_2?: OverlayNode;
  instance_3?: OverlayNode;
} | undefined {
  return window.exportRoot?.inst;
}

function instructionGlyphs(): OverlayNode[] {
  const inst = instructionClip();
  if (!inst) return [];
  return [inst.nextButton, inst.nextButton2, inst.prevButton, inst.skipButton, inst.backButton, inst.startButton, inst.instance, inst.instance_1, inst.instance_2, inst.instance_3].filter((n): n is OverlayNode => !!n);
}

function advanceInstructions(dir: 1 | -1 | 0): void {
  const inst = instructionClip();
  if (!inst?.play) return;
  if (inst.paused === false) return;
  const frame = inst.currentFrame ?? 0;
  if (dir === 0) {
    inst.gotoAndPlay?.("skip");
    return;
  }
  if (dir < 0) {
    if (frame <= 20) return;
    inst.gotoAndPlay?.(Math.max(0, frame - 30));
    return;
  }
  inst.play();
}

function pollInstructionsPad(): void {
  const start = heldPadButtons().has(loadSettings().pads.pause);
  if (start && !prevInstrStart) {
    prevInstrStart = true;
    advanceInstructions(0);
    pollMenuPad();
    return;
  }
  prevInstrStart = start;
  for (const ev of pollMenuPad()) {
    if (ev === "confirm" || ev === "right" || ev === "down") advanceInstructions(1);
    else if (ev === "left" || ev === "up") advanceInstructions(-1);
    else if (ev === "back") {
      if ((instructionClip()?.currentFrame ?? 0) <= 20) quitPlay();
      else advanceInstructions(-1);
    }
  }
}

function inStagePlay(): boolean {
  const label = currentLabel();
  return label === "game" || label === "restart";
}

function handleTouchPadDown(code: string): void {
  if (currentLabel() === "instructions") {
    if (code === "ArrowRight" || code === "ArrowDown") advanceInstructions(1);
    else if (code === "ArrowLeft" || code === "ArrowUp") advanceInstructions(-1);
    else if (code === "Space") advanceInstructions(1);
    return;
  }
  if (inStagePlay()) {
    if (isPauseMenuOpen()) {
      if (code === "ArrowUp" || code === "ArrowLeft") handlePauseNav("up");
      else if (code === "ArrowDown" || code === "ArrowRight") handlePauseNav("down");
      else if (code === "Space") handlePauseNav("confirm");
      return;
    }
      const cmd = KEY_CMD[code];
      if (cmd) {
        noteKeyboardPlay();
        window.stage?.triggerKeyDown?.({ code });
      }
    return;
  }
  if (code === "ArrowUp") handleMenuNav("up");
  else if (code === "ArrowDown") handleMenuNav("down");
  else if (code === "ArrowLeft") handleMenuNav("left");
  else if (code === "ArrowRight") handleMenuNav("right");
  else if (code === "Space") handleMenuNav("confirm");
}

function handleTouchPadUp(code: string): void {
  if (extraView === "creator-edit" && (code === "Space" || code === "Enter")) editorPaintHeld = false;
  if (inStagePlay()) window.stage?.triggerKeyUp?.({ code });
}

function handleTouchPadRotate(): void {
  if (extraView === "creator-edit") {
    cycleEditorTool(1);
    return;
  }
  toggleRotateScreen();
}

function handleTouchPadPause(): void {
  if (inStagePlay()) {
    togglePauseMenu();
    return;
  }
  if (currentLabel() === "instructions" || currentLabel() === "stagetitle" || playSession) {
    quitPlay();
    return;
  }
  if (extraView !== "home" && extraView !== "name" && extraView !== "splash") goBack();
}

function bindMenuPad(): void {
  if (extraView === "creator-edit") {
    const held = heldPadButtons();
    const pads = loadSettings().pads;
    if (!held.has(pads.confirm)) editorPaintHeld = false;
    const edges: { btn: number; fn: () => void }[] = [
      { btn: pads.swap, fn: () => cycleEditorTool(1) },
      { btn: 4, fn: () => cycleEditorTool(-1) },
      { btn: 5, fn: () => cycleEditorTool(1) },
      { btn: pads.pause, fn: () => handleHudAction("creator-test") },
    ];
    for (const edge of edges) {
      if (held.has(edge.btn) && !prevCreatorPad.has(edge.btn)) edge.fn();
    }
    prevCreatorPad = held;
    for (const ev of pollMenuPad({ pauseConfirms: false })) handleMenuNav(ev);
    return;
  }
  prevCreatorPad = new Set();
  if (uiBusy) {
    pollMenuPad();
    return;
  }
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
  $("hud-busy")?.addEventListener(
    "pointerdown",
    (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    },
    true,
  );
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
      if (extraView === "history") {
        const max = Math.max(0, loadFinishedStages().length - LIST_HISTORY);
        if (!max) return;
        ev.preventDefault();
        listScroll = Math.max(0, Math.min(max, listScroll + (ev.deltaY > 0 ? 1 : -1)));
        markHudDirty();
        paintHud();
        return;
      }
      if (extraView === "records") {
        const max = Math.max(0, recordCount() - REC_PAGE);
        if (!max) return;
        ev.preventDefault();
        listScroll = Math.max(0, Math.min(max, listScroll + (ev.deltaY > 0 ? 1 : -1)));
        markHudDirty();
        paintHud();
        return;
      }
      if (extraView === "achievements") {
        const max = Math.max(0, ACH_COUNT - ACH_PAGE);
        if (!max) return;
        ev.preventDefault();
        listScroll = Math.max(0, Math.min(max, listScroll + (ev.deltaY > 0 ? 1 : -1)));
        markHudDirty();
        paintHud();
        return;
      }
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
    if (extraView === "creator-edit" && (ev.code === "Space" || ev.key === "Enter")) {
      editorPaintHeld = false;
    }
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
    if (uiBusy) {
      ev.preventDefault();
      return;
    }
    if (document.activeElement === hudInput() || document.activeElement === modalInput()) return;
    if (extraView === "splash") {
      ev.preventDefault();
      dismissSplash();
      return;
    }

    if (currentLabel() === "instructions") {
      ev.preventDefault();
      const act = actionFromCode(ev.code);
      if (act === "pause") {
        advanceInstructions(0);
      } else if (act === "confirm" || ev.key === "Enter" || ev.key === " " || ev.key === "ArrowRight" || ev.key === "ArrowDown") {
        advanceInstructions(1);
      } else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") {
        advanceInstructions(-1);
      } else if (act === "back" || ev.key === "Escape" || ev.key === "Backspace") {
        if ((instructionClip()?.currentFrame ?? 0) <= 20) quitPlay();
        else advanceInstructions(-1);
      }
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

    if (extraView === "creator-edit") {
      const act = actionFromCode(ev.code);
      if ((ev.key === "s" || ev.key === "S") && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        handleHudAction("creator-save");
        return;
      }
      if (act === "up" || ev.key === "ArrowUp" || ev.code === "KeyW") {
        ev.preventDefault();
        handleCreatorNav("up");
        return;
      }
      if (act === "down" || ev.key === "ArrowDown" || ev.code === "KeyS") {
        ev.preventDefault();
        handleCreatorNav("down");
        return;
      }
      if (act === "left" || ev.key === "ArrowLeft" || ev.code === "KeyA") {
        ev.preventDefault();
        handleCreatorNav("left");
        return;
      }
      if (act === "right" || ev.key === "ArrowRight" || ev.code === "KeyD") {
        ev.preventDefault();
        handleCreatorNav("right");
        return;
      }
      if (act === "confirm" || ev.key === "Enter") {
        ev.preventDefault();
        handleCreatorNav("confirm");
        return;
      }
      if (act === "swap" || ev.code === "Space") {
        ev.preventDefault();
        editorPaintHeld = true;
        paintEditorAt(editCursor.x, editCursor.y, "start");
        scheduleBeatCheck();
        markHudDirty();
        paintHud();
        return;
      }
      if (ev.key === "q" || ev.key === "Q" || ev.key === "[") {
        ev.preventDefault();
        cycleEditorTool(-1);
        return;
      }
      if (ev.key === "e" || ev.key === "E" || ev.key === "]") {
        ev.preventDefault();
        cycleEditorTool(1);
        return;
      }
      if (ev.key === "t" || ev.key === "T") {
        ev.preventDefault();
        handleHudAction("creator-test");
        return;
      }
      if (act === "back" || ev.key === "Escape") {
        ev.preventDefault();
        goBack();
        return;
      }
    }

    if (currentLabel() === "game") {
      const act = actionFromCode(ev.code);
      if (act === "pause" || act === "back" || ev.key === "Escape") {
        ev.preventDefault();
        togglePauseMenu();
        return;
      }
      if (isPauseMenuOpen()) {
        ev.preventDefault();
        noteKeyboardPlay();
        if (act === "confirm" || ev.key === "Enter") handlePauseNav("confirm");
        else if (act === "up" || ev.key === "ArrowUp") handlePauseNav("up");
        else if (act === "down" || ev.key === "ArrowDown") handlePauseNav("down");
        else if (act === "left" || ev.key === "ArrowLeft") handlePauseNav("up");
        else if (act === "right" || ev.key === "ArrowRight") handlePauseNav("down");
        return;
      }
      let code = ev.code;
      if (act === "up") code = "ArrowUp";
      else if (act === "down") code = "ArrowDown";
      else if (act === "left") code = "ArrowLeft";
      else if (act === "right") code = "ArrowRight";
      else if (act === "swap") code = "Space";
      const cmd = KEY_CMD[code];
      if (cmd) {
        noteKeyboardPlay();
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
      noteKeyboardPlay();
      handleMenuNav("down");
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      noteKeyboardPlay();
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
  const labeledRun =
    label === "game" || label === "restart" || label === "stagetitle" || label === "instructions";
  if (labeledRun) playLaunching = false;
  const inRun = !!playSession && (labeledRun || playLaunching);
  const playing = label === "game" || label === "restart";
  const onTitle = label === "instructions" || label === "stagetitle";
  syncLetterbox(onTitle);
  setVanillaTitleVisible(false);
  syncStageTitleAudio(label);

  if (playSession && !playLaunching && !labeledRun && label !== "finish" && (extraView === "auto" || label === "menu" || label === "splash")) {
    const back = playSession.returnTo && playSession.returnTo !== "auto" ? playSession.returnTo : "home";
    leavePlayTo(back);
    return;
  }

  if (lastLabel === "instructions" && label !== "instructions") stopAllSounds();

  if (version) {
    const hide = inRun;
    if (versionHidden !== hide) {
      versionHidden = hide;
      version.style.display = hide ? "none" : "block";
    }
  }

  if (label === "restart" && lastLabel === "game") {
    if (autoSolve && playSession?.replay && solveTape.length && solveRetries < 2) {
      solveRetries += 1;
      if (solveCode) stage?.triggerKeyUp?.({ code: solveCode });
      solveCode = "";
      solveFeeder = createFeeder(solveTape);
    } else if (autoSolve && !solveFeeder?.pending && !solveFeeder?.queue.length && !solveFeeder?.held) {
      stopAutoSolve(playSession?.replay ? "Replay failed" : "Auto-solve failed");
    }
    if (!autoSolve) {
      rumble(180, 0.6, 0.4);
      commitTape(false, stage?.levelNumber ?? lastLevelNum);
    }
  }

  if ((playing || label === "stagetitle") && stage) {
    if (lastLevelNum > 0 && stage.levelNumber > lastLevelNum) {
      commitTape(true, lastLevelNum);
      persistWonStage(lastLevelNum);
      reportPlayWin(lastLevelNum);
      rumble(220, 0.45, 0.4);
      if (autoSolve) stopAutoSolve("");
      stageFailed = false;
    }
    lastLevelNum = stage.levelNumber;
  }

  if (label === "finish" && lastLabel !== "finish") {
    if (playSession?.replay) {
      lastLabel = label;
      leavePlayTo(playSession.returnTo && playSession.returnTo !== "auto" ? playSession.returnTo : "history");
      return;
    }
    if (autoSolve) stopAutoSolve("");
    rumble(220, 0.45, 0.4);
    beaten = playSession?.returnTo === "creator-edit" ? true : beaten;
    const finishStage = lastLevelNum || stage?.levelNumber || 1;
    if (tape.length) {
      commitTape(true, finishStage);
      persistWonStage(finishStage);
    }
    reportPlayWin(finishStage);
    if (run && playSession?.record) {
      run.complete = true;
      run.totalTimeMs = Date.now() - run.at;
      run.totalMoves = stage?.totalMoves ?? run.totalMoves;
      lastFinished = run;
      saveRun(run);
      run = null;
    } else {
      lastFinished = {
        id: `${Date.now()}`,
        at: Date.now(),
        player: getName() || "BLOX",
        totalTimeMs: 0,
        totalMoves: stage?.totalMoves ?? 0,
        fails: stage?.totalFalls ?? 0,
        complete: true,
        levels: [],
      };
    }
    rememberFinish(playSession);
    lastLabel = label;
    overlayMode = "";
    menuParked = false;
    if (!usesHdType() && playSession?.classicRun && playSession.kind === "campaign") {
      setVanillaCongraVisible(true);
      hud?.setVisible(false);
      setExportRootMouse(true);
      playSession = null;
      overlayMode = "run";
      return;
    }
    setVanillaCongraVisible(false);
    playSession = null;
    showFinish();
    overlayMode = "menu";
    return;
  }
  if (label === "finish" && !usesHdType()) {
    setVanillaCongraVisible(true);
    hud?.setVisible(false);
    setExportRootMouse(true);
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
    hookWorldQuit();
    hookReplayCapture();
    touchChrome?.sync(playing && !isPauseMenuOpen());
    if (label === "instructions") pollInstructionsPad();
    syncSidePanel(playing && !!playSession?.classicRun && playSession.entry === "start" && loadSettings().showTimer);
    applyPlayTint();
    applyBlockHue();
    syncPlayChrome(playing);
    syncHowto(label === "instructions");
    syncPauseStats(playing && isPauseMenuOpen());
    syncSelectPrompt(playing);
    if (playing) {
      syncStageCard(false);
      tickSolve();
      if (isPauseMenuOpen()) pollPauseMenuPad();
      else if (!autoSolve) pollGamepad(stage, togglePauseMenu);
      if (!playSession) return;
      syncHelpText();
      const world3 = window.stage?.bloxWorld;
      if (isSolid3d()) {
        syncTheme3d({
          on: true,
          tiles: world3?.tiles,
          blocks: playBlocks(),
          layerTiles: world3?.layerTiles,
          gameContainer: window.stage?.gameContainer,
        });
      }
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
        syncStageCard(false);
        setVanillaTitleVisible(false);
        if (!hud?.root.visible) {
          hud?.setVisible(true);
          raiseHud();
        }
        const key = "title:" + card.title + "|" + card.subtitle;
        if (lastHudPaint !== key) {
          lastHudPaint = key;
          hud?.drawTitleCard(card.title, card.subtitle);
        }
      } else if (usesHdType()) {
        const n = padStage(window.stage?.levelNumber ?? 1);
        const title = t("play.stageCard", { n });
        setVanillaTitleVisible(false);
        if (canBillboard(title)) {
          syncStageCard(false);
          if (!hud?.root.visible) {
            hud?.setVisible(true);
            raiseHud();
          }
          const key = "title:" + title;
          if (lastHudPaint !== key) {
            lastHudPaint = key;
            hud?.drawTitleCard(title);
          }
        } else {
          syncStageCard(true, title);
          if (hud?.root.visible) hud.setVisible(false);
        }
      } else {
        syncStageCard(false);
        setVanillaTitleVisible(true);
        if (hud?.root.visible) hud.setVisible(false);
      }
    } else {
      syncStageCard(false);
      if (hud?.root.visible && !cachedDev) hud.setVisible(false);
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
  hideVanillaMenu();
  syncPlayChrome(false);
  syncHowto(false);
  syncStageCard(false);
  syncPauseStats(false);
  syncSelectPrompt(false);
  placeSettingsChrome(extraView === "settings");
  touchChrome?.sync(false);

  bindMenuPad();
  capturePadRebind();
  if (playLaunching) return;
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
  } else if (shouldAskMobilePad() && (extraView === "auto" || extraView === "name" || extraView === "mobile-ask")) {
    if (extraView !== "mobile-ask") openPanel("mobile-ask");
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
      inst?: {
        play?: () => void;
        gotoAndPlay?: (n: string | number) => void;
        currentFrame?: number;
        paused?: boolean;
      };
    };
    stage?: StageLike;
    startBloxorzShell?: () => void;
    GAME_VERSION?: string;
    __bloxSetMouseOver?: (hz: number) => void;
    __bloxResetStoneStamp?: () => void;
    __bloxGetStoneStamp?: () => CanvasImageSource | null;
    __bloxShouldBakeFloor?: (n: number) => boolean;
    __bloxShouldSkipSpawn?: (n: number) => boolean;
    __bloxTileIdleFrame?: (type: string, doorOpen?: boolean) => number | null;
    __bloxDenseBoard?: boolean;
    applyLiveTheme?: (theme: string) => void;
    __bloxLoadThemeAtlas?: (theme: string) => Promise<HTMLCanvasElement>;
    AdobeAn?: {
      getComposition: (id: string) => {
        getLibrary: () => LibCtor;
        getSpriteSheet?: () => Record<string, SpriteSheetLike>;
        getImages?: () => Record<string, CanvasImageSource>;
      };
    };
    createjs?: {
      Sound?: {
        volume: number;
        play?: (...args: unknown[]) => unknown;
        stop?: () => void;
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

function showAchievementToasts(rows: AchievementDef[]): void {
  const host = $("ach-toasts");
  if (!host || !rows.length) return;
  for (const row of rows.slice(0, 5)) {
    const el = document.createElement("div");
    el.className = "ach-toast";
    const title = document.createElement("b");
    title.textContent = t("achievements.unlocked");
    const body = document.createElement("span");
    body.textContent = `#${String(row.n).padStart(3, "0")}  ${achName(row)}`;
    el.append(title, body);
    host.appendChild(el);
    window.setTimeout(() => {
      el.classList.add("is-out");
      window.setTimeout(() => el.remove(), 380);
    }, 4200);
  }
}

export function startBloxorzShell(): void {
  window.__bloxShouldBakeFloor = shouldBakeFloor;
  window.__bloxShouldSkipSpawn = shouldSkipTileSpawn;
  window.__bloxTileIdleFrame = tileIdleFrame;
  const version = $("build-version");
  if (version) version.textContent = "v" + (window.GAME_VERSION || "1.0.1");
  const saved = loadSettings();
  const locale = bootLocales(LOCALE_TABLE, saved.locale || null);
  if (!saved.locale) {
    saved.locale = locale;
    saveSettings(saved);
  }
  applyDocumentLocale(locale);
  applyDomCopy();
  setCurrentThemeId(currentTheme());
  refreshNameCache();
  gateSoundPlay();
  bindSettingsChrome();
  const playMenu = $("play-menu");
  playMenu?.addEventListener("click", () => {
    const btn = window.stage?.bloxWorld?.background as { menuButton?: { dispatchEvent?: (ev: unknown) => void } } | undefined;
    btn?.menuButton?.dispatchEvent?.({ type: "click" });
    if (!btn?.menuButton) togglePauseMenu();
  });
  $("howto-next")?.addEventListener("click", () => advanceInstructions(1));
  $("howto-prev")?.addEventListener("click", () => advanceInstructions(-1));
  $("howto-skip")?.addEventListener("click", () => advanceInstructions(0));
  $("howto-back")?.addEventListener("click", () => clickOverlay(instructionClip()?.backButton));
  $("howto-start")?.addEventListener("click", () => clickOverlay(instructionClip()?.startButton));
  $("pause-return")?.addEventListener("click", () => clickPauseButton("returnToGame"));
  $("pause-sound")?.addEventListener("click", () => clickPauseButton("toggleSound"));
  $("pause-quit")?.addEventListener("click", () => clickPauseButton("quitToMenu"));
  void (async () => {
    const savedTheme = currentTheme();
    const warmAtlas = composeThemeAtlas(savedTheme).catch(() => null);
    const theme = await bootThemes(savedTheme, cachedDev);
    setCurrentThemeId(theme);
    await loadExtraLocales();
    applyDocumentLocale(localeId());
    applyDomCopy();
    setHdRendering(isHdTheme(theme));
    applyThemeMedia();
    if (theme !== savedTheme) await composeThemeAtlas(theme).catch(() => null);
    else await warmAtlas;
    void swapAtlasLive(theme);
    lastHudPaint = "";
    markHudDirty();
    paintHud();
  })();
  wrapGetLevels();
  wrapLocalSave();
  if (window.stage) window.stage.touchMode = false;
  bind();
  if (!touchChrome) {
    touchChrome = new TouchChrome();
    touchChrome.mount({
      down: handleTouchPadDown,
      up: handleTouchPadUp,
      pause: handleTouchPadPause,
      rotate: handleTouchPadRotate,
    });
    registerServiceWorker();
  }
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
      try {
        const lib = adobeLib() as unknown as Record<string, new () => unknown>;
        const Ctor = lib?.[name];
        if (!Ctor) return null;
        return new Ctor() as never;
      } catch {
        return null;
      }
    };
    hud.makeTile = (ch: string) => {
      const Tile = adobeLib()?.Tile;
      if (!Tile) return null;
      try {
        const tile = new Tile() as {
          gotoAndStop?: (n: string | number) => void;
          tickEnabled?: boolean;
          mouseEnabled?: boolean;
          flasher?: { visible?: boolean; filters?: unknown };
        };
        if (ch === "b") tile.gotoAndStop?.(24);
        else {
          const idle = tileIdleFrame(ch, ch === "k" || ch === "q");
          if (idle != null) tile.gotoAndStop?.(idle);
        }
        tile.tickEnabled = false;
        tile.mouseEnabled = false;
        if (tile.flasher) {
          tile.flasher.visible = false;
          tile.flasher.filters = null;
        }
        return tile as never;
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
  onAchievementsUnlocked((rows) => showAchievementToasts(rows));
  const sel = $("image_select") as HTMLSelectElement | null;
  if (sel) {
    const ids = themeMenuItems(cachedDev);
    sel.innerHTML = "";
    for (const pack of ids) {
      const opt = document.createElement("option");
      opt.value = pack.id;
      opt.textContent = pack.builtin ? themePackLabel(pack.id, pack.name) : pack.name;
      sel.appendChild(opt);
    }
    sel.dataset.ids = ids.map((p) => p.id).join(",");
    sel.value = currentThemeId();
  }
  window.applyLiveTheme = (theme: string) => applyTheme(normalizeTheme(theme), false);
  window.createjs?.Ticker?.addEventListener("tick", syncOverlay);
  if (applyPendingShare()) {
    raiseHud();
    hud?.setVisible(true);
  }
  syncOverlay();
}

window.startBloxorzShell = startBloxorzShell;
window.__bloxLoadThemeAtlas = async (theme: string) => {
  let dev = false;
  try {
    dev = isDevName((localStorage.getItem(NAME_KEY) || "").trim());
  } catch {
    /* ignore */
  }
  const id = await bootThemes(theme, dev);
  return composeThemeAtlas(id, true);
};

(function patchHitCanvas(): void {
  if (typeof HTMLCanvasElement === "undefined") return;
  const proto = HTMLCanvasElement.prototype as typeof HTMLCanvasElement.prototype & { __bloxHit?: boolean };
  if (proto.__bloxHit) return;
  proto.__bloxHit = true;
  const orig = proto.getContext;
  proto.getContext = function (this: HTMLCanvasElement, type: string, attrs?: CanvasRenderingContext2DSettings) {
    if (type === "2d") {
      return orig.call(this, type, { ...(attrs || {}), willReadFrequently: true });
    }
    return orig.call(this, type, attrs);
  } as typeof orig;
})();

gateSoundPlay();
