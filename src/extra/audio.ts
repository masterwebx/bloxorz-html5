import { loadSettings } from "./settings";
import { playThemeSound, stopThemeMusic, themeSoundUrl } from "./themePack";

type SoundInst = {
  volume?: number;
  loop?: number;
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
  if (id === "Music" || id === "music") return true;
  return typeof id === "string" && /music/i.test(id);
}

export function isAudioUnlocked(): boolean {
  return unlocked && ctxReady;
}

function gatedPlay(...args: unknown[]): SoundInst {
  if (isMusicId(args[0]) && !allowMenuMusic) {
    hushStageMusic();
    return mutedMusic;
  }
  if (!ctxReady) {
    queued.push(args);
    return null;
  }
  return playNow(args);
}

export function gateSoundPlay(): void {
  hookHtmlAudioPlay();
  hookHtmlAudioLoop();
  hookBufferStart();
  hookWindowPlaySound();
  watchSoundLoads();
  const sound = (window as unknown as { createjs?: { Sound?: { play: (...a: unknown[]) => SoundInst } } }).createjs
    ?.Sound;
  if (!sound?.play) return;
  if (sound.play === gatedPlay) return;
  origPlay = sound.play.bind(sound);
  sound.play = gatedPlay;
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

/** Animate's playSound passes `undefined` as loop, which HTMLAudio treats as infinite. */
export function soundLoopCount(loop: unknown): number {
  if (typeof loop === "number" && Number.isFinite(loop)) return loop;
  return 0;
}

export function normalizePlayArgs(args: PlayArgs): PlayArgs {
  if (!args.length) return args;
  if (args.length === 1) {
    const interrupt =
      typeof window !== "undefined"
        ? (window as unknown as { createjs?: { Sound?: { INTERRUPT_EARLY?: number } } }).createjs?.Sound?.INTERRUPT_EARLY ?? 0
        : 0;
    return [args[0], interrupt, 0, 0, 0];
  }
  if (args.length >= 5) {
    const next = args.slice();
    next[4] = soundLoopCount(args[4]);
    return next;
  }
  if (args.length === 2 && args[1] && typeof args[1] === "object") {
    const props = args[1] as { loop?: unknown };
    return [args[0], { ...props, loop: soundLoopCount(props.loop) }];
  }
  if (args.length === 2 && (typeof args[1] === "number" || args[1] == null)) {
    return [args[0], 0, 0, 0, soundLoopCount(args[1])];
  }
  const next = args.slice();
  while (next.length < 5) next.push(0);
  next[4] = soundLoopCount(next[4]);
  return next;
}

function playbackTag(inst: SoundInst): { loop?: unknown } | null {
  if (!inst || typeof inst !== "object") return null;
  const rec = inst as { playbackResource?: { loop?: unknown }; _playbackResource?: { loop?: unknown } };
  return rec.playbackResource || rec._playbackResource || null;
}

function pinPlayOnce(inst: SoundInst): void {
  if (!inst || typeof inst !== "object") return;
  inst.loop = 0;
  const tag = playbackTag(inst);
  if (tag) tag.loop = false;
}

function unloopHtmlAudio(): void {
  try {
    document.querySelectorAll("audio").forEach((el) => {
      if (allowMenuMusic && el === musicEl) return;
      el.loop = false;
    });
  } catch {
    /* ignore */
  }
}

const mutedMusic: NonNullable<SoundInst> = {
  loop: 0,
  volume: 0,
  stop() {
    /* already silent */
  },
};

function musicSrcOf(el: HTMLAudioElement): string {
  return `${el.currentSrc || el.getAttribute("src") || ""}`.toLowerCase();
}

function isMusicElement(el: HTMLAudioElement): boolean {
  return el === musicEl || /music/i.test(musicSrcOf(el));
}

function stopCreatejsMusic(): void {
  try {
    const sound = (window as unknown as { createjs?: { Sound?: { stop?: (id?: string) => void; _instances?: SoundInst[] } } }).createjs
      ?.Sound;
    sound?.stop?.("Music");
    sound?.stop?.("music");
    const rows = sound?._instances;
    if (Array.isArray(rows)) {
      for (const inst of [...rows]) {
        const rec = inst as { src?: string; stop?: () => void };
        const src = `${rec.src || ""}`;
        if (isMusicId(rec.src) || /music/i.test(src)) inst?.stop?.();
      }
    }
  } catch {
    /* plugin may not be ready */
  }
}

function pinSilentMenuHandle(): void {
  if (typeof window === "undefined") return;
  const st = (window as unknown as { stage?: { menuMusic?: SoundInst } }).stage;
  if (!st) return;
  try {
    if (st.menuMusic && st.menuMusic !== mutedMusic) st.menuMusic.stop?.();
  } catch {
    /* ignore */
  }
  st.menuMusic = mutedMusic;
}

function hushHtmlAudio(): void {
  try {
    document.querySelectorAll("audio").forEach((el) => {
      if (allowMenuMusic && el === musicEl) return;
      el.loop = false;
      if (isMusicElement(el)) {
        el.pause();
        try {
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
    });
  } catch {
    /* ignore */
  }
}

export function hushStageMusic(): void {
  allowMenuMusic = false;
  stopMenuMusic();
  stopThemeMusic();
  stopCreatejsMusic();
  pinSilentMenuHandle();
  hushHtmlAudio();
  gateSoundPlay();
}

function hookHtmlAudioPlay(): void {
  if (typeof HTMLAudioElement === "undefined") return;
  const proto = HTMLAudioElement.prototype as HTMLAudioElement["prototype"] & { __bloxPlay?: typeof HTMLAudioElement.prototype.play };
  if (proto.__bloxPlay) return;
  const orig = proto.play;
  proto.__bloxPlay = orig;
  proto.play = function bloxPlay(this: HTMLAudioElement, ...args: unknown[]) {
    if (!allowMenuMusic) {
      if (isMusicElement(this)) {
        this.loop = false;
        this.pause();
        return Promise.resolve();
      }
      this.loop = false;
    }
    return orig.apply(this, args as []);
  };
}

function hookHtmlAudioLoop(): void {
  if (typeof HTMLAudioElement === "undefined") return;
  const proto = HTMLAudioElement.prototype as HTMLAudioElement & { __bloxLoop?: boolean };
  if (proto.__bloxLoop) return;
  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "loop") || Object.getOwnPropertyDescriptor(HTMLAudioElement.prototype, "loop");
  if (!desc?.get || !desc.set) return;
  proto.__bloxLoop = true;
  Object.defineProperty(HTMLAudioElement.prototype, "loop", {
    configurable: true,
    get() {
      return desc.get!.call(this) as boolean;
    },
    set(v: boolean) {
      if (!allowMenuMusic && this !== musicEl) {
        desc.set!.call(this, false);
        return;
      }
      desc.set!.call(this, v);
    },
  });
}

function hookBufferStart(): void {
  if (typeof AudioBufferSourceNode === "undefined") return;
  const proto = AudioBufferSourceNode.prototype as AudioBufferSourceNode & {
    __bloxStart?: typeof AudioBufferSourceNode.prototype.start;
  };
  if (proto.__bloxStart) return;
  const orig = proto.start;
  proto.__bloxStart = orig;
  proto.start = function bloxStart(this: AudioBufferSourceNode, ...args: unknown[]) {
    if (!allowMenuMusic && this.loop) this.loop = false;
    return orig.apply(this, args as []);
  };
}

let origWindowPlay: ((id: string, loop?: number) => SoundInst) | null = null;

function hookWindowPlaySound(): void {
  const w = window as unknown as { playSound?: (id: string, loop?: number) => SoundInst };
  if (!w.playSound || w.playSound === gatedWindowPlay) return;
  origWindowPlay = w.playSound.bind(window);
  w.playSound = gatedWindowPlay;
}

function gatedWindowPlay(id: string, loop?: number): SoundInst {
  if (isMusicId(id) && !allowMenuMusic) {
    hushStageMusic();
    return mutedMusic;
  }
  return origWindowPlay ? origWindowPlay(id, loop) : mutedMusic;
}

function watchSoundLoads(): void {
  const sound = (window as unknown as { createjs?: { Sound?: { addEventListener?: (n: string, fn: () => void) => void; __bloxLoad?: boolean } } })
    .createjs?.Sound;
  if (!sound?.addEventListener || sound.__bloxLoad) return;
  sound.__bloxLoad = true;
  sound.addEventListener("fileload", () => {
    if (!allowMenuMusic) hushStageMusic();
  });
}

function playNow(args: PlayArgs): SoundInst {
  const play = normalizePlayArgs(args);
  if (isMusicId(play[0])) {
    if (!allowMenuMusic) {
      hushStageMusic();
      return mutedMusic;
    }
    ensureMenuMusic();
    return menuMusic;
  }
  if (!origPlay) return null;
  const id = typeof play[0] === "string" ? play[0] : "";
  if (id && themeSoundUrl(id)) {
    const html = playThemeSound(id, false);
    const s = loadSettings();
    if (html) {
      html.loop = false;
      html.volume = s.sfx;
    }
    return html as SoundInst;
  }
  const inst = origPlay(...play);
  const loop = play.length >= 5 ? soundLoopCount(play[4]) : 0;
  if (inst && typeof inst === "object") {
    const s = loadSettings();
    inst.volume = s.sfx;
    if (loop === 0) {
      pinPlayOnce(inst);
      queueMicrotask(() => pinPlayOnce(inst));
      if (typeof window !== "undefined") window.setTimeout(() => pinPlayOnce(inst), 0);
    }
  }
  unloopHtmlAudio();
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
  if (!on) hushStageMusic();
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

export function stopVanillaMenuMusic(): void {
  hushStageMusic();
}

export function stopAllSounds(): void {
  setMenuMusicAllowed(false);
  queued = [];
  unloopHtmlAudio();
  try {
    document.querySelectorAll("audio").forEach((el) => {
      el.loop = false;
      el.pause();
      el.currentTime = 0;
    });
  } catch {
    /* ignore */
  }
  try {
    (window as unknown as { createjs?: { Sound?: { stop?: () => void } } }).createjs?.Sound?.stop?.();
  } catch {
    /* plugin may not be ready */
  }
  pinSilentMenuHandle();
}

export function resetAudioForTests(): void {
  const sound =
    typeof window === "undefined"
      ? undefined
      : (window as unknown as { createjs?: { Sound?: { play: (...a: unknown[]) => SoundInst } } }).createjs?.Sound;
  if (sound && origPlay) sound.play = origPlay;
  origPlay = null;
  unlocked = false;
  ctxReady = false;
  queued = [];
  whooshOnce = false;
  allowMenuMusic = false;
  stopTrackedMusic();
}

export function markAudioReadyForTests(): void {
  ctxReady = true;
  unlocked = true;
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
