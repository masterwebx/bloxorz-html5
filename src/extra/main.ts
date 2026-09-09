import {
  checkBeatable,
  EDITOR_TOOLS,
  newPaintState,
  paintEditorCell,
  splitMarks,
  type EditorToolId,
} from "./editor";
import {
  emptyDraft,
  encodeLevel,
  encodeSeed,
  isPlayable,
  listSaved,
  parseShare,
  saveStage,
  stageId,
  tileChar,
} from "./customLevels";
import { campaignDefs, defToCreateJs } from "./convert";
import { dailySeed, difficultyLabel, generatePuzzle, generateRun, type Difficulty } from "./generate";
import { pollGamepad, rumble } from "./gamepad";
import { loadRuns, saveRun, winningTape, type RunRecord, type TapeCmd } from "./history";
import { brandName, isDevName, loadSettings, saveSettings } from "./settings";
import { solveLevel } from "./solve";
import type { LevelDef } from "./types";
import type { WalkCmd } from "./walkthrough";

type Screen = "name" | "home" | "settings" | "creator" | "puzzles" | "history" | "dev" | "load" | "credits" | "finish" | "auto";
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
};

const MODE_KEY = "bloxorz-play-mode";
const NAME_KEY = "bloxorz-player-name";
const VANILLA_BUTTONS = ["startNewGame", "resumeGame", "loadStage", "toggleSound", "credits"];
const PANELS: Screen[] = ["name", "home", "settings", "creator", "puzzles", "history", "dev", "load", "credits", "finish"];
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
let origGetLevels: (() => unknown[]) | null = null;

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

function setPlayfieldVisible(on: boolean): void {
  const canvas = document.getElementById("canvas");
  if (canvas) canvas.style.visibility = on ? "visible" : "hidden";
}

function parkCreateJsMenu(): void {
  const root = window.exportRoot as {
    currentLabel?: string;
    splash?: { visible: boolean };
    gotoAndStop?: (l: string) => void;
    menu?: { currentFrame: number; gotoAndStop: (n: number) => void };
  } | undefined;
  const st = window.stage as StageLike | undefined;
  if (!root || !st) return;
  st.doneIntro = true;
  if (root.splash) root.splash.visible = false;
  if (root.currentLabel !== "menu") root.gotoAndStop?.("menu");
  if (root.menu && root.menu.currentFrame !== 133) root.menu.gotoAndStop(133);
  setVanillaButtonsVisible(false);
}

function findMenu(): Record<string, { visible?: boolean; mouseEnabled?: boolean; dispatchEvent: (e: string) => void }> | null {
  const root = window.exportRoot as { menu?: Record<string, { visible?: boolean; mouseEnabled?: boolean; dispatchEvent: (e: string) => void }> } | undefined;
  return root?.menu ?? null;
}

function onMainMenu(): boolean {
  const root = window.exportRoot as { currentLabel?: string; menu?: { currentFrame: number } } | undefined;
  if (!root?.menu) return false;
  if (root.currentLabel !== "menu") return false;
  return root.menu.currentFrame === 133;
}

function currentLabel(): string {
  return (window.exportRoot as { currentLabel?: string } | undefined)?.currentLabel || "";
}

function show(el: HTMLElement | null, on: boolean): void {
  if (!el) return;
  el.classList.toggle("is-open", on);
}

function setVanillaButtonsVisible(visible: boolean): void {
  const menu = findMenu();
  if (!menu) return;
  for (const name of VANILLA_BUTTONS) {
    const btn = menu[name] as { visible?: boolean } | undefined;
    if (btn) btn.visible = visible;
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

function openPanel(name: Screen): void {
  extraView = name;
  for (const id of PANELS) {
    const el = $("extra-" + id);
    if (el) el.hidden = id !== name;
  }
  if (name === "settings") {
    const field = $("settings-name") as HTMLInputElement | null;
    if (field) field.value = getName();
    const rumbleBox = $("settings-rumble") as HTMLInputElement | null;
    if (rumbleBox) rumbleBox.checked = loadSettings().rumble;
  }
  if (name === "name") {
    const field = $("player-name") as HTMLInputElement | null;
    if (field && !field.value) field.value = getName();
  }
  if (name === "creator") renderEditor();
  if (name === "puzzles") renderPuzzles();
  if (name === "history") renderHistory();
  if (name === "dev") renderDev();
}

function paintExtraMenu(): void {
  const name = getName();
  const title = $("extra-brand");
  if (title) title.textContent = brandName(name);
  const resume = $("extra-resume") as HTMLButtonElement | null;
  if (resume) resume.disabled = savedLevel() < 1;
  const sound = $("extra-sound");
  if (sound) sound.textContent = (window.createjs?.Sound?.volume ?? 1) === 1 ? "Sound: On" : "Sound: Off";
  const dev = $("extra-dev-btn");
  if (dev) (dev as HTMLElement).hidden = !isDevName(name);
}

function returnToMenu(): void {
  const root = window.exportRoot as { gotoAndStop?: (l: string) => void; menu?: { gotoAndStop: (n: number) => void } } | undefined;
  const stage = window.stage as StageLike | undefined;
  if (stage) stage.doneIntro = true;
  root?.gotoAndStop?.("menu");
  root?.menu?.gotoAndStop(133);
}

function beginPlay(levelNumber: number, session: PlaySession): void {
  playSession = session;
  extraView = "auto";
  const stage = window.stage as StageLike | undefined;
  if (stage) stage.levelNumber = levelNumber;
  (window as unknown as { setCurrentLevel?: (n: number) => void }).setCurrentLevel?.(levelNumber);
  show($("extra-shell"), false);
  setPlayfieldVisible(true);
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
  const stage = window.stage as StageLike | undefined;
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
  const stage = window.stage as StageLike | undefined;
  const n = stage?.levelNumber ?? 1;
  const def = playSession?.defs.length ? playSession.defs[stage!.levelNumber - 1] : campaignDefs()[n - 1];
  if (!def) return;
  const result = solveLevel(def, 200_000);
  if (!result.ok) {
    beatLabel = "No solution found.";
    return;
  }
  enqueueSolve(result.cmds);
}

function renderEditor(): void {
  const grid = $("creator-grid");
  if (!grid) return;
  const marks = splitMarks(draft);
  grid.replaceChildren();
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 15; x++) {
      const cell = document.createElement("button");
      cell.type = "button";
      const ch = tileChar(draft, x, y);
      cell.className = "tile tile-" + (ch === " " ? "empty" : ch);
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      if (draft.spawn[0] === x && draft.spawn[1] === y) cell.classList.add("is-spawn");
      const mark = marks.find((m) => m.x === x && m.y === y);
      cell.textContent = mark ? mark.label : ch === " " ? "" : ch.toUpperCase();
      grid.appendChild(cell);
    }
  }
  const tools = $("creator-tools");
  if (tools && !tools.dataset.ready) {
    tools.dataset.ready = "1";
    for (const tool of EDITOR_TOOLS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.tool = tool.id;
      btn.textContent = tool.label;
      tools.appendChild(btn);
    }
  }
  tools?.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("is-on", (btn as HTMLButtonElement).dataset.tool === paint.tool);
  });
  const issue = isPlayable(draft);
  const badge = $("creator-badge");
  if (badge) badge.textContent = issue || beatLabel;
  const hint = $("creator-hint");
  if (hint) hint.textContent = paint.hint || "Paint a 15×10 stage. Split is pad, then cube A, then cube B.";
  const saveBtn = $("creator-save") as HTMLButtonElement | null;
  if (saveBtn) saveBtn.disabled = !beaten || !!issue;
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
    if (extraView === "creator") renderEditor();
  }, 200);
}

function renderPuzzles(): void {
  const daily = $("puzzle-daily-meta");
  if (daily) {
    const seed = dailySeed(new Date(), puzzleDiff);
    daily.textContent = seed + " · " + difficultyLabel(puzzleDiff);
  }
  $("puzzle-diff")?.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("is-on", (btn as HTMLButtonElement).dataset.diff === puzzleDiff);
  });
  $("puzzle-len")?.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("is-on", Number((btn as HTMLButtonElement).dataset.n) === puzzleCount);
  });
}

function renderHistory(): void {
  const list = $("history-list");
  if (!list) return;
  const runs = loadRuns();
  list.replaceChildren();
  if (!runs.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "No runs yet. Clear stages in extra mode and they show up here.";
    list.appendChild(p);
    return;
  }
  for (const rec of runs) {
    const row = document.createElement("div");
    row.className = "history-row";
    const when = new Date(rec.at).toLocaleString();
    const title = document.createElement("p");
    title.textContent = `${rec.player} · ${rec.complete ? "Finished" : "Stopped"} · ${rec.levels.length} stages · ${rec.fails} falls`;
    const meta = document.createElement("p");
    meta.className = "hint";
    meta.textContent = when;
    row.appendChild(title);
    row.appendChild(meta);
    rec.levels.forEach((lv, i) => {
      const tape = winningTape(lv);
      if (!tape) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `Replay stage ${lv.stage || i + 1}`;
      btn.addEventListener("click", () => {
        const defs = campaignDefs();
        const def = defs[(lv.stage || i + 1) - 1];
        if (!def) return;
        startCustom([def], "history", `Replay ${lv.stage}`);
        enqueueSolve(tape);
      });
      row.appendChild(btn);
    });
    list.appendChild(row);
  }
}

function renderDev(): void {
  const list = $("dev-stages");
  if (!list || list.dataset.ready) return;
  list.dataset.ready = "1";
  for (let i = 1; i <= 33; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(i).padStart(2, "0");
    btn.addEventListener("click", () => {
      beginPlay(i, { kind: "campaign", defs: [], returnTo: "dev", record: false });
    });
    list.appendChild(btn);
  }
}

function saveDraft(): void {
  if (!beaten) return;
  const issue = isPlayable(draft);
  if (issue) return;
  const name = ( $("creator-name") as HTMLInputElement | null )?.value.trim() || "Untitled";
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
  renderEditor();
}

function playDraft(): void {
  const issue = isPlayable(draft);
  if (issue) {
    paint.hint = issue;
    renderEditor();
    return;
  }
  startCustom([structuredClone(draft)], "creator");
}

function loadPasscode(): void {
  const field = $("load-code") as HTMLInputElement | null;
  const err = $("load-error");
  const value = ((field?.value || "") + "").replace(/\D/g, "").slice(0, 6);
  if (field) field.value = value;
  if (value.length !== 6) {
    if (err) {
      err.hidden = false;
      err.textContent = "Enter a 6-digit passcode.";
    }
    return;
  }
  const codes = (window as unknown as { getLevelCodes?: () => string[] }).getLevelCodes?.() || [];
  const index = codes.indexOf(value);
  if (index === -1) {
    if (err) {
      err.hidden = false;
      err.textContent = "That passcode is not a campaign stage.";
    }
    return;
  }
  if (err) err.hidden = true;
  beginPlay(index + 1, { kind: "campaign", defs: [], returnTo: "home", record: true });
}

function showFinish(): void {
  const moves = $("finish-moves");
  const fails = $("finish-fails");
  const st = window.stage as StageLike & { totalMoves?: number; totalFalls?: number } | undefined;
  if (moves) moves.textContent = String(st?.totalMoves ?? 0);
  if (fails) fails.textContent = String(st?.totalFalls ?? 0);
  parkCreateJsMenu();
  setPlayfieldVisible(false);
  show($("extra-shell"), true);
  openPanel("finish");
}

function loadShare(): void {
  const field = $("creator-code") as HTMLInputElement | null;
  const def = parseShare(field?.value || "", listSaved());
  if (!def) {
    paint.hint = "Could not read that code. Use BXS- / BXS. / BX1.";
    renderEditor();
    return;
  }
  draft = def;
  beaten = false;
  paint = newPaintState();
  paint.hint = "Loaded share code.";
  scheduleBeatCheck();
  renderEditor();
}

function bindCreator(): void {
  $("creator-grid")?.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!btn?.dataset.x) return;
    paintEditorCell(draft, Number(btn.dataset.x), Number(btn.dataset.y), paint);
    beaten = false;
    scheduleBeatCheck();
    renderEditor();
  });
  $("creator-tools")?.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!btn?.dataset.tool) return;
    paint.tool = btn.dataset.tool as EditorToolId;
    paint.splitStep = 0;
    paint.splitAt = null;
    paint.linkFrom = null;
    paint.hint = "";
    renderEditor();
  });
}

function syncOverlay(): void {
  const extra = $("extra-shell");
  const exitBtn = $("exit-legacy");
  const version = $("build-version");
  const ingame = $("extra-ingame");
  const label = currentLabel();
  const playing = label === "game" || label === "restart";

  if (version) version.style.display = isLegacy() ? (onMainMenu() ? "block" : "none") : playing ? "none" : "block";

  if (label === "restart" && lastLabel === "game") rumble(180, 0.6, 0.4);

  if (label === "finish" && !isLegacy() && lastLabel !== "finish") {
    beaten = playSession?.returnTo === "creator" ? true : beaten;
    if (run && playSession?.record) {
      run.complete = true;
      run.totalTimeMs = Date.now() - run.at;
      saveRun(run);
      run = null;
    }
    const back = playSession?.returnTo;
    playSession = playSession ? { ...playSession, returnTo: back || "home" } : null;
    lastLabel = label;
    if (back === "creator" || back === "puzzles" || back === "history") {
      parkCreateJsMenu();
      setPlayfieldVisible(false);
      show(extra, true);
      openPanel(back);
      playSession = null;
      return;
    }
    showFinish();
    playSession = null;
    return;
  }
  lastLabel = label;

  if (isLegacy()) {
    extraView = "auto";
    show(extra, false);
    setPlayfieldVisible(true);
    setVanillaButtonsVisible(true);
    show(exitBtn, onMainMenu());
    show(ingame, false);
    return;
  }

  show(exitBtn, false);
  const devOn = isDevName(getName());
  show(ingame, playing && devOn);

  if (playing) {
    show(extra, false);
    setPlayfieldVisible(true);
    tickSolve();
    pollGamepad(window.stage as StageLike, false);
    return;
  }

  parkCreateJsMenu();
  setPlayfieldVisible(false);
  show(extra, true);
  paintExtraMenu();
  if (extraView === "finish") return;
  if (playSession?.returnTo && extraView === "auto") {
    const back = playSession.returnTo;
    playSession = null;
    openPanel(back);
    return;
  }
  if (!getName()) {
    if (extraView !== "name") openPanel("name");
  } else if (extraView === "auto" || extraView === "name") {
    openPanel("home");
  }
}

function bind(): void {
  const extra = $("extra-shell");
  const exitBtn = $("exit-legacy");
  if (!extra || !exitBtn) return;

  extra.addEventListener("keydown", (ev) => ev.stopPropagation());
  extra.addEventListener("keyup", (ev) => ev.stopPropagation());

  extra.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("button[data-act]") as HTMLButtonElement | null;
    if (!btn || btn.disabled) return;
    const act = btn.getAttribute("data-act");
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
      if (!n) return;
      beginPlay(n, { kind: "campaign", defs: [], returnTo: "home", record: true });
    } else if (act === "load") openPanel("load");
    else if (act === "load-go") loadPasscode();
    else if (act === "sound") {
      window.stage?.toggleSound?.();
      paintExtraMenu();
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
      paintExtraMenu();
      openPanel("home");
    } else if (act === "save-name") {
      const field = $("settings-name") as HTMLInputElement | null;
      if (!field?.value.trim()) return;
      setName(field.value);
      const rumbleBox = $("settings-rumble") as HTMLInputElement | null;
      const s = loadSettings();
      s.rumble = rumbleBox ? rumbleBox.checked : s.rumble;
      saveSettings(s);
      paintExtraMenu();
      openPanel("home");
    } else if (act === "creator-test") playDraft();
    else if (act === "creator-save") saveDraft();
    else if (act === "creator-new") {
      draft = emptyDraft();
      beaten = false;
      paint = newPaintState();
      scheduleBeatCheck();
      renderEditor();
    } else if (act === "creator-load") loadShare();
    else if (act === "puzzle-daily") {
      const p = generatePuzzle(dailySeed(new Date(), puzzleDiff), puzzleDiff);
      startCustom([p.def], "puzzles", "Daily");
    } else if (act === "puzzle-run") {
      const seed = ($("puzzle-seed") as HTMLInputElement | null)?.value.trim() || `seed-${Date.now()}`;
      const runP = generateRun(seed, puzzleDiff, puzzleCount);
      startCustom(
        runP.map((p) => p.def),
        "puzzles",
        seed,
      );
    }
  });

  extra.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const field = $("player-name") as HTMLInputElement | null;
    if (!field?.value.trim()) return;
    setName(field.value);
    paintExtraMenu();
    openPanel("home");
  });

  $("puzzle-diff")?.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!btn?.dataset.diff) return;
    puzzleDiff = btn.dataset.diff as Difficulty;
    renderPuzzles();
  });
  $("puzzle-len")?.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!btn?.dataset.n) return;
    puzzleCount = Number(btn.dataset.n);
    renderPuzzles();
  });

  exitBtn.addEventListener("click", () => {
    setMode("extra");
    window.location.reload();
  });

  $("extra-ingame")?.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("button[data-act]") as HTMLButtonElement | null;
    if (!btn) return;
    if (btn.dataset.act === "dev-beat") beatCurrentStage();
    if (btn.dataset.act === "dev-menu") {
      returnToMenu();
      openPanel("dev");
    }
  });

  window.addEventListener("keydown", (ev) => {
    if (currentLabel() !== "game") return;
    const cmd = KEY_CMD[ev.code];
    if (!cmd) return;
    tape.push(cmd);
  });

  bindCreator();
  const nameField = $("player-name") as HTMLInputElement | null;
  if (nameField) nameField.value = getName();
}

declare global {
  interface Window {
    exportRoot?: {
      currentLabel?: string;
      splash?: { visible: boolean };
      menu?: { currentFrame: number; gotoAndStop: (n: number) => void };
      gotoAndPlay?: (l: string) => void;
      gotoAndStop?: (l: string) => void;
    };
    stage?: StageLike & { toggleSound?: () => void };
    startBloxorzShell?: () => void;
    GAME_VERSION?: string;
    createjs?: { Sound?: { volume: number }; Ticker?: { addEventListener: (n: string, fn: () => void) => void } };
  }
}

declare const createjs: {
  Sound?: { volume: number };
  Ticker?: { addEventListener: (n: string, fn: () => void) => void };
};

export function startBloxorzShell(): void {
  const version = $("build-version");
    if (version) version.textContent = "v" + (window.GAME_VERSION || "2.3.0");
  wrapGetLevels();
  bind();
  if (!isLegacy()) parkCreateJsMenu();
  createjs.Ticker?.addEventListener("tick", syncOverlay);
  syncOverlay();
}

window.startBloxorzShell = startBloxorzShell;
