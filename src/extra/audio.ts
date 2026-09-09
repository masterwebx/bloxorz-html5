import { loadSettings } from "./settings";
import { playThemeSound, themeSoundUrl } from "./themePack";

type SoundInst = {
  volume?: number;
  stop?: () => void;
  playState?: string;
  paused?: boolean;
} | null;

type PlayArgs = unknown[];

let unlocked = false;
let ctxReady = false;
let origPlay: ((...args: unknown[]) => SoundInst) | null = null;
let menuMusic: SoundInst = null;
let musicInsts: NonNullable<SoundInst>[] = [];
let queued: PlayArgs[] = [];
let whooshOnce = false;
let allowMenuMusic = false;

function isMusicId(id: unknown): boolean {
  return id === "Music" || id === "music";
}

export function isAudioUnlocked(): boolean {
  return unlocked && ctxReady;
}

export function gateSoundPlay(): void {
  const sound = (window as unknown as { createjs?: { Sound?: { play: (...a: unknown[]) => SoundInst } } }).createjs
    ?.Sound;
  if (!sound?.play || origPlay) return;
  origPlay = sound.play.bind(sound);
  sound.play = function gated(...args: unknown[]) {
    if (!ctxReady) {
      queued.push(args);
      return null;
    }
    return playNow(args);
  };
}

function audioContext(): { resume?: () => Promise<unknown>; state?: string } | undefined {
  const w = window as unknown as {
    createjs?: {
      Sound?: { activePlugin?: { context?: { resume?: () => Promise<unknown>; state?: string } } };
      WebAudioPlugin?: { context?: { resume?: () => Promise<unknown>; state?: string } };
    };
  };
  const cjs = w.createjs;
  return cjs?.WebAudioPlugin?.context || cjs?.Sound?.activePlugin?.context;
}

function playNow(args: PlayArgs): SoundInst {
  if (!origPlay) return null;
  const id = typeof args[0] === "string" ? args[0] : "";
  if (id && themeSoundUrl(id)) {
    if (isMusicId(id) && !allowMenuMusic) return null;
    if (isMusicId(id)) stopTrackedMusic();
    const loop = isMusicId(id);
    const html = playThemeSound(id, loop);
    const s = loadSettings();
    if (html) html.volume = isMusicId(id) ? s.music : s.sfx;
    return html as SoundInst;
  }
  if (isMusicId(args[0])) {
    if (!allowMenuMusic) return null;
    stopTrackedMusic();
  }
  const inst = origPlay(...args);
  if (inst && typeof inst === "object") {
    const s = loadSettings();
    inst.volume = isMusicId(args[0]) ? s.music : s.sfx;
    if (isMusicId(args[0])) {
      menuMusic = inst;
      musicInsts.push(inst);
    }
  }
  return inst;
}

function flushQueue(): void {
  const pending = queued;
  queued = [];
  for (const args of pending) {
    if (isMusicId(args[0]) && !allowMenuMusic) continue;
    if (isMusicId(args[0]) && musicAlive()) continue;
    playNow(args);
  }
}

function musicAlive(): boolean {
  if (!menuMusic || !ctxReady) return false;
  const st = menuMusic.playState;
  if (st === "playFinished" || st === "playFailed" || st === "playInterrupted") return false;
  return true;
}

function markReady(): void {
  ctxReady = true;
  unlocked = true;
  const cjs = (window as unknown as { createjs?: { Sound?: { volume: number } } }).createjs;
  if (cjs?.Sound) cjs.Sound.volume = 1;
  applyVolumes();
  flushQueue();
}

/** Resume WebAudio, then flush any Click / Latch / Music that arrived on the first gesture. */
export function unlockAudio(after?: () => void): boolean {
  const first = !unlocked;
  unlocked = true;
  gateSoundPlay();

  const finish = (): void => {
    markReady();
    after?.();
  };

  const ctx = audioContext();
  if (ctx?.state === "running") {
    finish();
    return first;
  }
  const p = ctx?.resume?.();
  if (p && typeof (p as Promise<unknown>).then === "function") {
    void (p as Promise<unknown>).then(finish).catch(finish);
  } else {
    // Some browsers only unlock after a second tick.
    window.setTimeout(finish, 0);
  }
  return first;
}

export function setMenuMusicAllowed(on: boolean): void {
  allowMenuMusic = on;
  if (!on) stopMenuMusic();
}

export function ensureMenuMusic(): void {
  if (!allowMenuMusic) return;
  if (!origPlay) gateSoundPlay();
  const s = loadSettings();
  if (s.music <= 0) {
    stopMenuMusic();
    return;
  }
  if (!ctxReady) {
    queued.push(["Music", { loop: -1 }]);
    return;
  }
  if (musicAlive()) {
    menuMusic!.volume = s.music;
    return;
  }
  playNow(["Music", { loop: -1 }]);
}

function stopTrackedMusic(): void {
  for (const inst of musicInsts) inst.stop?.();
  menuMusic?.stop?.();
  musicInsts = [];
  menuMusic = null;
}

export function stopMenuMusic(): void {
  stopTrackedMusic();
  queued = queued.filter((args) => !isMusicId(args[0]));
  const stage = (window as unknown as { stage?: { menuMusic?: SoundInst } }).stage;
  if (stage?.menuMusic) {
    stage.menuMusic.stop?.();
    stage.menuMusic = null;
  }
}

export function applyVolumes(): void {
  const s = loadSettings();
  if (menuMusic) menuMusic.volume = s.music;
  const cjs = (window as unknown as { createjs?: { Sound?: { volume: number } } }).createjs;
  if (cjs?.Sound) cjs.Sound.volume = 1;
}

function playId(id: string): void {
  if (!origPlay) gateSoundPlay();
  if (!ctxReady) {
    queued.push([id]);
    return;
  }
  playNow([id]);
}

export function playUiClick(): void {
  playId("Click");
}

export function playUiLatch(): void {
  playId("Latch");
}

export function playMenuWhoosh(): void {
  playId("blox003wav");
}

/** First home reveal: whoosh once the context is actually running. */
export function playHomeWhoosh(): void {
  if (whooshOnce && ctxReady) {
    playMenuWhoosh();
    return;
  }
  whooshOnce = true;
  playMenuWhoosh();
}

export function playDevJingle(): void {
  // Remake uses whoosh_2 for the DEV unlock. Coolmath's matching clip is blox2wav.
  if (!ctxReady) {
    queued.push(["blox2wav"]);
    queued.push(["blox003wav"]);
    return;
  }
  playId("blox2wav");
  window.setTimeout(() => playId("blox003wav"), 30);
}
