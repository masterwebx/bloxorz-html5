import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  gateSoundPlay,
  markAudioReadyForTests,
  normalizePlayArgs,
  resetAudioForTests,
  setMenuMusicAllowed,
  soundLoopCount,
  stopAllSounds,
  stopVanillaMenuMusic,
} from "./audio";

beforeAll(() => {
  (globalThis as { window?: typeof globalThis }).window = globalThis;
});

type SoundInst = {
  loop?: unknown;
  volume?: number;
  stop?: () => void;
  playbackResource?: { loop: boolean };
};

function installSound(play: (...args: unknown[]) => SoundInst) {
  resetAudioForTests();
  const w = window as unknown as { createjs?: { Sound?: { play: typeof play; stop?: () => void; INTERRUPT_EARLY?: number } }; stage?: { menuMusic?: SoundInst | null } };
  w.createjs = {
    Sound: {
      INTERRUPT_EARLY: 1,
      play,
      stop() {
        /* no-op */
      },
    },
  };
  w.stage = { menuMusic: null };
  gateSoundPlay();
  markAudioReadyForTests();
}

afterEach(() => {
  resetAudioForTests();
});

describe("sound loop count", () => {
  it("treats a missing Animate loop arg as play-once", () => {
    expect(soundLoopCount(undefined)).toBe(0);
    expect(soundLoopCount(null)).toBe(0);
    expect(soundLoopCount(-1)).toBe(-1);
    expect(soundLoopCount(2)).toBe(2);
    expect(soundLoopCount("nope")).toBe(0);
  });
});

describe("normalizePlayArgs", () => {
  it("turns a 1-arg playSound call into loop 0", () => {
    const play = normalizePlayArgs(["Music"]);
    expect(play[4]).toBe(0);
    expect(normalizePlayArgs(["blox003wav"])[4]).toBe(0);
  });

  it("fills a missing object loop as play-once, and keeps infinite menu music", () => {
    expect((normalizePlayArgs(["Click", {}])[1] as { loop: number }).loop).toBe(0);
    expect((normalizePlayArgs(["Music", { loop: -1 }])[1] as { loop: number }).loop).toBe(-1);
  });
});

describe("stage start audio", () => {
  it("does not start looping music when a stage begins", () => {
    const played: unknown[][] = [];
    installSound((...args) => {
      played.push(args);
      const tag = { loop: true };
      return { loop: args[4] ?? (args[1] as { loop?: number } | undefined)?.loop, playbackResource: tag, stop() {} };
    });
    const w = window as unknown as { stage: { menuMusic?: SoundInst | null }; createjs: { Sound: { play: (...a: unknown[]) => SoundInst } } };
    w.stage.menuMusic = { loop: -1, stop() {} };
    setMenuMusicAllowed(false);
    stopAllSounds();
    const inst = w.createjs.Sound.play("Music");
    expect(played).toHaveLength(0);
    expect(inst?.loop).toBe(0);
    expect(w.stage.menuMusic).toBeNull();
    const looping = w.createjs.Sound.play("Music", { loop: -1 });
    expect(played).toHaveLength(0);
    expect(looping?.loop).toBe(0);
  });

  it("forces 1-arg SFX onto a play-once HTML tag", () => {
    const tags: { loop: boolean }[] = [];
    installSound((...args) => {
      const tag = { loop: true };
      tags.push(tag);
      return { loop: args[4], playbackResource: tag, stop() {} };
    });
    setMenuMusicAllowed(false);
    const sound = (window as unknown as { createjs: { Sound: { play: (...a: unknown[]) => SoundInst } } }).createjs.Sound;
    const inst = sound.play("blox003wav");
    expect(inst?.loop).toBe(0);
    expect(tags[0]?.loop).toBe(false);
  });

  it("clears the vanilla menuMusic handle used on New Game / Continue", () => {
    const stopped: string[] = [];
    const w = window as unknown as { stage: { menuMusic?: { stop: () => void } | null } };
    w.stage = {
      menuMusic: {
        stop() {
          stopped.push("music");
        },
      },
    };
    stopVanillaMenuMusic();
    expect(stopped).toEqual(["music"]);
    expect(w.stage.menuMusic).toBeNull();
  });
});
