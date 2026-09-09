import { loadSettings } from "./settings";

type SoundInst = { volume?: number; stop?: () => void; playState?: string } | null;

let unlocked = false;
let origPlay: ((...args: unknown[]) => SoundInst) | null = null;
let menuMusic: SoundInst = null;

function isMusicId(id: unknown): boolean {
  return id === "Music" || id === "music";
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

export function gateSoundPlay(): void {
  const sound = (window as unknown as { createjs?: { Sound?: { play: (...a: unknown[]) => SoundInst } } }).createjs?.Sound;
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

export function unlockAudio(): void {
  unlocked = true;
  const w = window as unknown as {
    createjs?: {
      Sound?: { volume: number; activePlugin?: { context?: { resume?: () => Promise<unknown> } } };
      WebAudioPlugin?: { context?: { resume?: () => Promise<unknown> } };
    };
  };
  const cjs = w.createjs;
  const ctx = cjs?.WebAudioPlugin?.context || cjs?.Sound?.activePlugin?.context;
  void ctx?.resume?.();
  if (cjs?.Sound) cjs.Sound.volume = 1;
  applyVolumes();
}

export function ensureMenuMusic(): void {
  if (!unlocked || !origPlay) return;
  const s = loadSettings();
  if (s.music <= 0) {
    stopMenuMusic();
    return;
  }
  if (menuMusic && menuMusic.playState) {
    menuMusic.volume = s.music;
    return;
  }
  menuMusic = origPlay("Music", { loop: -1 });
  if (menuMusic) menuMusic.volume = s.music;
}

export function stopMenuMusic(): void {
  menuMusic?.stop?.();
  menuMusic = null;
}

export function applyVolumes(): void {
  const s = loadSettings();
  if (menuMusic) menuMusic.volume = s.music;
  const cjs = (window as unknown as { createjs?: { Sound?: { volume: number } } }).createjs;
  if (cjs?.Sound) cjs.Sound.volume = 1;
}

export function playUiClick(): void {
  if (!unlocked || !origPlay) return;
  const inst = origPlay("Click");
  if (inst) inst.volume = loadSettings().sfx;
}
