import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  gateSoundPlay,
  hushStageMusic,
  isMusicId,
  isMusicSrc,
  markAudioReadyForTests,
  normalizePlayArgs,
  playStageSting,
  resetAudioForTests,
  setMenuMusicAllowed,
  shouldBlockHtmlPlay,
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
    expect(w.stage.menuMusic).toBe(inst);
    const looping = w.createjs.Sound.play("Music", { loop: -1 });
    expect(played).toHaveLength(0);
    expect(looping?.loop).toBe(0);
    expect(w.stage.menuMusic).toBe(looping);
  });

  it("keeps a late Music play silent and does not let vanilla retry", () => {
    const played: unknown[][] = [];
    installSound((...args) => {
      played.push(args);
      return { loop: -1, stop() {} };
    });
    const w = window as unknown as { stage: { menuMusic?: SoundInst | null }; createjs: { Sound: { play: (...a: unknown[]) => SoundInst } } };
    setMenuMusicAllowed(false);
    stopAllSounds();
    window.setTimeout(() => {
      w.createjs.Sound.play("Music", { loop: -1 });
    }, 0);
    const inst = w.createjs.Sound.play("Music", { loop: -1 });
    expect(played).toHaveLength(0);
    expect(inst?.volume).toBe(0);
    expect(w.stage.menuMusic).toBeTruthy();
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
    const inst = sound.play("blox2wav");
    expect(inst?.loop).toBe(0);
    expect(tags[0]?.loop).toBe(false);
  });

  it("unloops a stage SFX tag without pausing the roll", () => {
    installSound(() => ({ loop: 0, stop() {} }));
    setMenuMusicAllowed(false);
    const paused: string[] = [];
    const el = {
      loop: true,
      currentSrc: "sounds/blox003wav.mp3",
      currentTime: 1,
      pause() {
        paused.push("sfx");
      },
      getAttribute() {
        return "";
      },
    };
    const prev = (globalThis as { document?: unknown }).document;
    (globalThis as { document: { querySelectorAll: (sel: string) => unknown[] } }).document = {
      querySelectorAll: () => [el],
    };
    hushStageMusic();
    expect(el.loop).toBe(false);
    expect(paused).toEqual([]);
    (globalThis as { document?: unknown }).document = prev;
  });

  it("does not let a delayed Music tag keep playing during a stage", () => {
    installSound(() => ({ loop: -1, stop() {} }));
    setMenuMusicAllowed(false);
    const paused: string[] = [];
    const el = {
      loop: true,
      currentSrc: "sounds/Music.mp3",
      currentTime: 2,
      pause() {
        paused.push("music");
      },
      getAttribute() {
        return "sounds/Music.mp3";
      },
    };
    const prev = (globalThis as { document?: unknown }).document;
    (globalThis as { document: { querySelectorAll: (sel: string) => unknown[] } }).document = {
      querySelectorAll: () => [el],
    };
    hushStageMusic();
    expect(paused).toEqual(["music"]);
    expect(el.loop).toBe(false);
    (globalThis as { document?: unknown }).document = prev;
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
    expect(w.stage.menuMusic).toBeTruthy();
    expect(w.stage.menuMusic?.volume).toBe(0);
  });
});

describe("in-game SFX", () => {
  it("does not treat roll or UI clips as music", () => {
    expect(isMusicId("Music")).toBe(true);
    expect(isMusicId("music")).toBe(true);
    expect(isMusicSrc("sounds/Music.mp3")).toBe(true);
    expect(isMusicId("blox003wav")).toBe(false);
    expect(isMusicId("Click")).toBe(false);
    expect(isMusicId("Latch")).toBe(false);
    expect(isMusicSrc("sounds/blox003wav.mp3")).toBe(false);
    expect(isMusicSrc("sounds/blox004wav.mp3")).toBe(false);
    expect(isMusicSrc("https://game/sounds/Click.mp3")).toBe(false);
  });

  it("does not block HTMLAudio.play on a pooled tag that still shows a Music src", () => {
    const pooled = { currentSrc: "sounds/Music.mp3" };
    const musicEl = { currentSrc: "blob:menu-music" };
    expect(shouldBlockHtmlPlay(pooled, musicEl, false)).toBe(false);
    expect(shouldBlockHtmlPlay(musicEl, musicEl, false)).toBe(true);
    expect(shouldBlockHtmlPlay(musicEl, musicEl, true)).toBe(false);
  });

  it("plays roll SFX after music is hushed, including repeated stage ticks", () => {
    const played: unknown[][] = [];
    const stops: unknown[] = [];
    installSound((...args) => {
      played.push(args);
      return { loop: 0, stop() {} };
    });
    const sound = (window as unknown as { createjs: { Sound: { play: (...a: unknown[]) => SoundInst; stop: (id?: string) => void } } }).createjs
      .Sound;
    sound.stop = (id?: string) => {
      stops.push(id);
    };
    setMenuMusicAllowed(false);
    hushStageMusic();
    hushStageMusic();
    hushStageMusic();
    const inst = sound.play("blox003wav");
    const click = sound.play("Click");
    expect(played.some((row) => row[0] === "blox003wav")).toBe(true);
    expect(played.some((row) => row[0] === "Click")).toBe(true);
    expect(inst?.loop).toBe(0);
    expect(click?.loop).toBe(0);
    expect(stops.every((id) => id === "Music" || id === "music")).toBe(true);
  });

  it("lets window.playSound reach CreateJS for a 1-arg roll clip", () => {
    const played: unknown[][] = [];
    installSound((...args) => {
      played.push(args);
      return { loop: 0, stop() {} };
    });
    const w = window as unknown as { playSound?: (id: string, loop?: number) => SoundInst };
    w.playSound = (id, loop) =>
      (window as unknown as { createjs: { Sound: { play: (...a: unknown[]) => SoundInst } } }).createjs.Sound.play(
        id,
        1,
        0,
        0,
        loop || 0,
      );
    gateSoundPlay();
    setMenuMusicAllowed(false);
    hushStageMusic();
    w.playSound?.("blox004wav");
    w.playSound?.("blox036wav");
    expect(played.some((row) => row[0] === "blox003wav" || row[0] === "blox004wav")).toBe(true);
    expect(played.some((row) => row[0] === "blox036wav")).toBe(true);
    expect(played.some((row) => row[0] === "Music")).toBe(false);
  });

  it("swallows stagesign window.playSound(blox2wav) so playStageSting owns the sting", () => {
    const played: unknown[][] = [];
    installSound((...args) => {
      played.push(args);
      return { loop: 0, stop() {} };
    });
    const w = window as unknown as { playSound?: (id: string, loop?: number) => SoundInst };
    w.playSound = (id, loop) =>
      (window as unknown as { createjs: { Sound: { play: (...a: unknown[]) => SoundInst } } }).createjs.Sound.play(
        id,
        1,
        0,
        0,
        loop || 0,
      );
    gateSoundPlay();
    setMenuMusicAllowed(false);
    markAudioReadyForTests();
    w.playSound?.("blox2wav");
    expect(played.some((row) => row[0] === "blox2wav")).toBe(false);
    playStageSting();
    expect(played.some((row) => row[0] === "blox2wav")).toBe(true);
  });
});
