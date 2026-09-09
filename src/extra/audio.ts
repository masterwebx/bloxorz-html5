import { loadSettings } from "./settings";

type SoundInst = {
  volume?: number;
  stop?: () => void;
  playState?: string;
  paused?: boolean;
} | null;

let unlocked = false;
let origPlay: ((...args: unknown[]) => SoundInst) | null = null;
let menuMusic: SoundInst = null;
let pendingMusic = false;

function isMusicId(id: unknown): boolean {
  return id === "Music" || id === "music";
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

export function gateSoundPlay(): void {
  const sound = (window as unknown as { createjs?: { Sound?: { play: (...a: unknown[]) => SoundInst } } }).createjs
    ?.Sound;
  if (!sound?.play || origPlay) return;
  origPlay = sound.play.bind(sound);
  sound.play = function gated(...args: unknown[]) {
    if (!unlocked) return null;
    const inst = origPlay!(...args);
    if (inst && typeof inst === "object") {
      const s = loadSettings();
      inst.volume = isMusicId(args[0]) ? s.music : s.sfx;
    }
    if (isMusicId(args[0])) menuMusic = inst;
    return inst;
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

function musicAlive(): boolean {
  if (!menuMusic) return false;
  const st = menuMusic.playState;
  if (st === "playFinished" || st === "playFailed" || st === "playInterrupted") return false;
  return true;
}

/** Resume WebAudio, then run `after` so Music/SFX actually start on the first gesture. */
export function unlockAudio(after?: () => void): boolean {
  const first = !unlocked;
  unlocked = true;
  const cjs = (window as unknown as { createjs?: { Sound?: { volume: number } } }).createjs;
  if (cjs?.Sound) cjs.Sound.volume = 1;
  applyVolumes();

  const done = (): void => {
    applyVolumes();
    after?.();
    if (pendingMusic) {
      pendingMusic = false;
      ensureMenuMusic();
    }
  };

  const ctx = audioContext();
  const p = ctx?.resume?.();
  if (p && typeof (p as Promise<unknown>).then === "function") {
    void (p as Promise<unknown>).then(done).catch(done);
  } else {
    done();
  }
  return first;
}

export function ensureMenuMusic(): void {
  if (!unlocked) {
    pendingMusic = true;
    return;
  }
  if (!origPlay) {
    gateSoundPlay();
    if (!origPlay) {
      pendingMusic = true;
      return;
    }
  }
  const s = loadSettings();
  if (s.music <= 0) {
    stopMenuMusic();
    return;
  }
  if (musicAlive()) {
    menuMusic!.volume = s.music;
    return;
  }
  menuMusic = null;
  menuMusic = origPlay("Music", { loop: -1 });
  if (menuMusic) menuMusic.volume = s.music;
  // If the context was still suspended, retry after resume.
  const ctx = audioContext();
  if (ctx?.state === "suspended") {
    pendingMusic = true;
    void ctx.resume?.().then(() => {
      if (!musicAlive()) {
        menuMusic = null;
        ensureMenuMusic();
      }
    });
  }
}

export function stopMenuMusic(): void {
  menuMusic?.stop?.();
  menuMusic = null;
  pendingMusic = false;
}

export function applyVolumes(): void {
  const s = loadSettings();
  if (menuMusic) menuMusic.volume = s.music;
  const cjs = (window as unknown as { createjs?: { Sound?: { volume: number } } }).createjs;
  if (cjs?.Sound) cjs.Sound.volume = 1;
}

function playId(id: string): void {
  if (!unlocked || !origPlay) return;
  const inst = origPlay(id);
  if (inst) inst.volume = loadSettings().sfx;
}

/** Hover tick — Coolmath menu uses Click on mouseover. */
export function playUiClick(): void {
  playId("Click");
}

/** Confirm / menu-item press — Coolmath uses Latch. */
export function playUiLatch(): void {
  playId("Latch");
}

/** Menu options slide-in whoosh — Coolmath Menu frame 107 plays blox003wav. */
export function playMenuWhoosh(): void {
  playId("blox003wav");
}
