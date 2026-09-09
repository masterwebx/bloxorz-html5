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
import { pollGamepad, rumble } from "./gamepad";
import { loadRuns, pushGhost, saveRun, winningTape, type RunRecord, type TapeCmd } from "./history";
import { brandName, isDevName, loadSettings, saveSettings } from "./settings";
import { solveLevel } from "./solve";
import type { LevelDef } from "./types";
import { ExtraHud, type MenuItem } from "./hud";
import type { WalkCmd } from "./walkthrough";

type Screen =
  | "name"
  | "home"
  | "settings"
  | "creator"
  | "puzzles"
  | "history"
  | "dev"
  | "load"
  | "credits"
  | "finish"
  | "auto";
type PlayKind = "campaign" | "custom";

type PlaySession = {
  kind: PlayKind;
  defs: LevelDef[];
  returnTo: Screen;
  record: boolean;
  title?: string;
};

type StageLike = {
  levelNumber: number;
  triggerKeyDown?: (evt: { code: string }) => void;
  triggerKeyUp?: (evt: { code: string }) => void;
  doneIntro?: boolean;
  addChild?: (c: unknown) => void;
  addChildAt?: (c: unknown, i: number) => void;
  setChildIndex?: (c: unknown, i: number) => void;
  numChildren?: number;
  toggleSound?: () => void;
  totalMoves?: number;
  totalFalls?: number;
  gameContainer?: { visible?: boolean };
};

type SkyClip = {
  x: number;
  y: number;
  visible: boolean;
  mouseEnabled: boolean;
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
let lastHud = "";
let bound = false;
let sky: SkyClip | null = null;

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
  try {
    return (localStorage.getItem(NAME_KEY) || "").trim();
  } catch {
    return "";
  }
}

function setName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name.trim());
    const s = loadSettings();
    s.playerName = name.trim();
    saveSettings(s);
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

function adobeLib(): { bettersky_22?: new () => SkyClip } | undefined {
  const an = (window as unknown as { AdobeAn?: { getComposition: (id: string) => { getLibrary: () => { bettersky_22?: new () => SkyClip } } } }).AdobeAn;
  return an?.getComposition("FE31B685947E79408F0C8768D6EC8517")?.getLibrary();
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

function showGameSky(on: boolean): void {
  ensureSky();
  const root = window.exportRoot as { visible?: boolean } | undefined;
  if (sky) sky.visible = on;
  if (root) root.visible = !on;
  const box = window.stage?.gameContainer;
  if (box) box.visible = !on;
}

function parkCreateJsMenu(): void {
  const root = window.exportRoot;
  const st = window.stage;
  if (!root || !st) return;
  st.doneIntro = true;
  if (root.splash) root.splash.visible = false;
  if (root.currentLabel !== "menu") root.gotoAndStop?.("menu");
  if (root.menu && root.menu.currentFrame !== 133) root.menu.gotoAndStop(133);
  setVanillaButtonsVisible(false);
  showGameSky(true);
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

function placeHudInput(on: boolean, left: string, top: string, width: string, placeholder: string, value: string): void {
  const el = hudInput();
  if (!el) return;
  el.hidden = !on;
  if (!on) return;
  el.style.left = left;
  el.style.top = top;
  el.style.width = width;
  el.placeholder = placeholder;
  if (document.activeElement !== el) el.value = value;
}

function homeItems(): MenuItem[] {
  const items: MenuItem[] = [
    { id: "start", label: "Start New Game" },
    { id: "resume", label: "Resume Game", disabled: savedLevel() < 1 },
    { id: "load", label: "Load Stage" },
    { id: "creator", label: "Stage Creator" },
    { id: "puzzles", label: "Puzzles" },
    { id: "history", label: "History" },
    { id: "sound", label: (window.createjs?.Sound?.volume ?? 1) === 1 ? "Sound: On" : "Sound: Off" },
    { id: "credits", label: "Credits" },
    { id: "settings", label: "Settings" },
    { id: "legacy", label: "Legacy mode" },
  ];
  if (isDevName(getName())) items.push({ id: "dev", label: "Dev tools" });
  return items;
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
  return [
    extraView,
    homeCursor,
    savedLevel(),
    String(window.createjs?.Sound?.volume ?? 1),
    getName(),
    String(loadSettings().rumble),
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
  ].join("|");
}

function raiseHud(): void {
  const st = window.stage;
  if (!hud || !st?.setChildIndex || st.numChildren == null) return;
  st.setChildIndex(hud.root, st.numChildren - 1);
}

function paintHud(): void {
  if (!hud) return;
  const key = hudKey();
  if (key === lastHud) return;
  lastHud = key;
  placeHudInput(false, "0", "0", "0", "", "");
  if (extraView === "home") hud.drawHome(brandName(getName()), homeItems(), homeCursor);
  else if (extraView === "name") {
    hud.drawName();
    placeHudInput(true, "7.3%", "42.5%", "43%", "NAME", getName());
  } else if (extraView === "credits") hud.drawCredits();
  else if (extraView === "load") {
    hud.drawLoad(loadError);
    placeHudInput(true, "7.3%", "38%", "29%", "000000", "");
  } else if (extraView === "settings") {
    hud.drawSettings(loadSettings().rumble);
    placeHudInput(true, "7.3%", "36%", "43%", "NAME", getName());
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
  } else if (extraView === "dev") hud.drawDev();
  else if (extraView === "creator") {
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
  lastHud = "";
  if (name === "load") loadError = "";
  if (name === "creator") scheduleBeatCheck();
  paintHud();
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
    beginPlay(1, { kind: "campaign", defs: [], returnTo: "home", record: true });
  } else if (act === "resume") {
    const n = savedLevel();
    if (n) beginPlay(n, { kind: "campaign", defs: [], returnTo: "home", record: true });
  } else if (act === "load") openPanel("load");
  else if (act === "load-go") loadPasscode();
  else if (act === "sound") {
    window.stage?.toggleSound?.();
    lastHud = "";
    paintHud();
  } else if (act === "credits") openPanel("credits");
  else if (act === "legacy") {
    setMode("legacy");
    window.location.reload();
  } else if (act === "settings") openPanel("settings");
  else if (act === "back") openPanel("home");
  else if (act === "creator") openPanel("creator");
  else if (act === "puzzles") openPanel("puzzles");
  else if (act === "history") openPanel("history");
  else if (act === "dev") openPanel("dev");
  else if (act === "skip-name") {
    if (!getName()) setName("BLOX");
    openPanel("home");
  } else if (act === "name-continue") {
    const next = hudInput()?.value.trim();
    if (!next) return;
    setName(next);
    openPanel("home");
  } else if (act === "save-name") {
    const next = hudInput()?.value.trim();
    if (!next) return;
    setName(next);
    openPanel("home");
  } else if (act === "toggle-rumble") {
    const s = loadSettings();
    s.rumble = !s.rumble;
    saveSettings(s);
    lastHud = "";
    paintHud();
  } else if (act === "creator-test") playDraft();
  else if (act === "creator-save") saveDraft();
  else if (act === "creator-new") {
    draft = emptyDraft();
    beaten = false;
    paint = newPaintState();
    scheduleBeatCheck();
    lastHud = "";
    paintHud();
  } else if (act === "creator-load") loadShare();
  else if (act.startsWith("tool:")) {
    paint.tool = act.slice(5) as EditorToolId;
    paint.splitStep = 0;
    paint.splitAt = null;
    paint.linkFrom = null;
    lastHud = "";
    paintHud();
  } else if (act.startsWith("paint:")) {
    const parts = act.split(":");
    paintEditorCell(draft, Number(parts[1]), Number(parts[2]), paint);
    beaten = false;
    scheduleBeatCheck();
    lastHud = "";
    paintHud();
  } else if (act.startsWith("diff:")) {
    puzzleDiff = act.slice(5) as Difficulty;
    lastHud = "";
    paintHud();
  } else if (act.startsWith("len:")) {
    puzzleCount = Number(act.slice(4));
    lastHud = "";
    paintHud();
  } else if (act.startsWith("dev:")) {
    beginPlay(Number(act.slice(4)), { kind: "campaign", defs: [], returnTo: "dev", record: false });
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
    openPanel("dev");
  }
}

function returnToMenu(): void {
  const root = window.exportRoot;
  const stage = window.stage;
  if (stage) stage.doneIntro = true;
  root?.gotoAndStop?.("menu");
  root?.menu?.gotoAndStop(133);
}

function beginPlay(levelNumber: number, session: PlaySession): void {
  playSession = session;
  extraView = "auto";
  tape = [];
  lastLevelNum = levelNumber;
  lastHud = "";
  hud?.setVisible(false);
  placeHudInput(false, "0", "0", "0", "", "");
  showGameSky(false);
  const stage = window.stage;
  if (stage) stage.levelNumber = levelNumber;
  (window as unknown as { setCurrentLevel?: (n: number) => void }).setCurrentLevel?.(levelNumber);
  window.exportRoot?.gotoAndPlay?.("game");
}

function startCustom(defs: LevelDef[], returnTo: Screen, title?: string): void {
  if (!defs.length) return;
  beginPlay(1, { kind: "custom", defs, returnTo, record: returnTo !== "creator", title });
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
  solveHold = 12;
}

function tickSolve(): void {
  const stage = window.stage;
  if (!stage?.triggerKeyDown || currentLabel() !== "game") return;
  if (solveHold > 0) {
    solveHold--;
    if (solveHold === 8 && solveCode) stage.triggerKeyUp?.({ code: solveCode });
    return;
  }
  const cmd = solveQueue.shift();
  if (!cmd) return;
  solveCode = cmdToCode(cmd);
  stage.triggerKeyDown({ code: solveCode });
  solveHold = cmd === "swap" ? 10 : 18;
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
    if (issue) {
      beatLabel = issue;
    } else {
      beatLabel = checkBeatable(draft) ? "CAN BE BEAT" : "IMPOSSIBLE";
    }
    if (extraView === "creator") {
      lastHud = "";
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
  lastHud = "";
  paintHud();
}

function playDraft(): void {
  const issue = isPlayable(draft);
  if (issue) {
    paint.hint = issue;
    lastHud = "";
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
    lastHud = "";
    paintHud();
    return;
  }
  const codes = (window as unknown as { getLevelCodes?: () => string[] }).getLevelCodes?.() || [];
  const index = codes.indexOf(value);
  if (index === -1) {
    loadError = "That passcode is not a campaign stage.";
    lastHud = "";
    paintHud();
    return;
  }
  loadError = "";
  beginPlay(index + 1, { kind: "campaign", defs: [], returnTo: "home", record: true });
}

function showFinish(): void {
  parkCreateJsMenu();
  hud?.setVisible(true);
  openPanel("finish");
}

function loadShare(): void {
  const field = hudInput();
  const def = parseShare(field?.value || "", listSaved());
  if (!def) {
    paint.hint = "Could not read that code. Use BXS- / BXS. / BX1.";
    lastHud = "";
    paintHud();
    return;
  }
  draft = def;
  beaten = false;
  paint = newPaintState();
  paint.hint = "Loaded share code.";
  scheduleBeatCheck();
  lastHud = "";
  paintHud();
}

function bind(): void {
  if (bound) return;
  bound = true;

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
    if (currentLabel() === "game") {
      const cmd = KEY_CMD[ev.code];
      if (cmd) tape.push(cmd);
      return;
    }
    if (ev.key === "Escape" && extraView !== "home" && extraView !== "name" && extraView !== "auto") {
      openPanel("home");
      return;
    }
    if (extraView !== "home") return;
    if (ev.key === "ArrowDown") {
      moveHome(1);
      lastHud = "";
      paintHud();
    } else if (ev.key === "ArrowUp") {
      moveHome(-1);
      lastHud = "";
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
  const playing = label === "game" || label === "restart";
  const stage = window.stage;

  if (version) version.style.display = playing ? "none" : "block";

  if (label === "restart" && lastLabel === "game") {
    rumble(180, 0.6, 0.4);
    commitTape(false, stage?.levelNumber ?? lastLevelNum);
  }

  if (playing && stage) {
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
    if (back === "creator" || back === "puzzles" || back === "history") {
      parkCreateJsMenu();
      setExportRootMouse(false);
      playSession = null;
      hud?.setVisible(true);
      openPanel(back);
      return;
    }
    playSession = null;
    showFinish();
    return;
  }
  lastLabel = label;

  if (isLegacy()) {
    extraView = "auto";
    hud?.setVisible(false);
    placeHudInput(false, "0", "0", "0", "", "");
    showGameSky(false);
    setExportRootMouse(true);
    setVanillaButtonsVisible(true);
    show(exitBtn, onMainMenu());
    return;
  }

  show(exitBtn, false);
  raiseHud();

  if (playing) {
    showGameSky(false);
    setExportRootMouse(true);
    tickSolve();
    pollGamepad(stage, false);
    if (isDevName(getName())) {
      hud?.setVisible(true);
      if (lastHud !== "ingame") {
        lastHud = "ingame";
        hud?.drawInGameDev();
      }
    } else {
      hud?.setVisible(false);
      placeHudInput(false, "0", "0", "0", "", "");
    }
    return;
  }

  parkCreateJsMenu();
  setExportRootMouse(false);
  hud?.setVisible(true);
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
      splash?: { visible: boolean };
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
    AdobeAn?: { getComposition: (id: string) => { getLibrary: () => { bettersky_22?: new () => SkyClip } } };
    createjs?: { Sound?: { volume: number }; Ticker?: { addEventListener: (n: string, fn: () => void) => void } };
  }
}

export function startBloxorzShell(): void {
  const version = $("build-version");
  if (version) version.textContent = "v" + (window.GAME_VERSION || "2.4.1");
  wrapGetLevels();
  bind();
  if (window.stage && !hud) {
    hud = new ExtraHud(window.stage as { addChild: (c: unknown) => void });
    hud.onAction = handleHudAction;
  }
  if (!isLegacy()) parkCreateJsMenu();
  window.createjs?.Ticker?.addEventListener("tick", syncOverlay);
  syncOverlay();
}

window.startBloxorzShell = startBloxorzShell;
