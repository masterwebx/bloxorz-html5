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
let queued: PlayArgs[] = [];
let whooshOnce = false;
let allowMenuMusic = false;
let musicEl: HTMLAudioElement | null = null;
let musicSrc = "";

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
  if (isMusicId(args[0])) {
    if (!allowMenuMusic) return null;
    ensureMenuMusic();
    return menuMusic;
  }
  if (!origPlay) return null;
  const id = typeof args[0] === "string" ? args[0] : "";
  if (id && themeSoundUrl(id)) {
    const html = playThemeSound(id, false);
    const s = loadSettings();
    if (html) html.volume = s.sfx;
    return html as SoundInst;
  }
  const inst = origPlay(...args);
  if (inst && typeof inst === "object") {
    const s = loadSettings();
    inst.volume = s.sfx;
  }
  return inst;
}

function flushQueue(): void {
  const pending = queued;
  queued = [];
  for (const args of pending) {
    if (isMusicId(args[0])) {
      if (allowMenuMusic) ensureMenuMusic();
      continue;
    }
    playNow(args);
  }
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
    window.setTimeout(finish, 0);
  }
  return first;
}

export function setMenuMusicAllowed(on: boolean): void {
  allowMenuMusic = on;
  if (!on) stopMenuMusic();
}

function defaultMusicUrl(): string {
  return themeSoundUrl("Music") || "sounds/Music.mp3";
}

function bindMusicElement(el: HTMLAudioElement): SoundInst {
  const inst: NonNullable<SoundInst> = {
    get volume() {
      return el.volume;
    },
    set volume(v: number) {
      el.volume = v;
    },
    get paused() {
      return el.paused;
    },
    stop() {
      el.pause();
    },
  };
  return inst;
}

function musicPlaying(): boolean {
  return !!musicEl && !musicEl.paused && !musicEl.ended;
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
    queued = queued.filter((args) => !isMusicId(args[0]));
    queued.push(["Music", { loop: -1 }]);
    return;
  }
  const url = defaultMusicUrl();
  if (musicEl && musicSrc === url) {
    musicEl.volume = s.music;
    menuMusic = bindMusicElement(musicEl);
    if (!musicPlaying()) void musicEl.play().catch(() => undefined);
    return;
  }
  stopTrackedMusic();
  const el = new Audio(url);
  el.loop = true;
  el.preload = "auto";
  el.volume = s.music;
  musicEl = el;
  musicSrc = url;
  menuMusic = bindMusicElement(el);
  void el.play().catch(() => undefined);
}

function stopTrackedMusic(): void {
  if (musicEl) {
    musicEl.pause();
    musicEl.removeAttribute("src");
    musicEl.load();
  }
  musicEl = null;
  musicSrc = "";
  menuMusic = null;
}

export function stopMenuMusic(): void {
  stopTrackedMusic();
  queued = queued.filter((args) => !isMusicId(args[0]));
}

export function applyVolumes(): void {
  const s = loadSettings();
  if (musicEl) musicEl.volume = s.music;
  if (menuMusic) menuMusic.volume = s.music;
  const cjs = (window as unknown as { createjs?: { Sound?: { volume: number } } }).createjs;
  if (cjs?.Sound) cjs.Sound.volume = 1;
}

function playId(id: string): void {
  if (isMusicId(id)) {
    ensureMenuMusic();
    return;
  }
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
  if (!ctxReady) {
    queued.push(["blox2wav"]);
    queued.push(["blox003wav"]);
    return;
  }
  playId("blox2wav");
  window.setTimeout(() => playId("blox003wav"), 30);
}
