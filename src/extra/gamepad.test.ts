import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  absorbHeldMenuConfirm,
  clearExtraMenuHeld,
  isPadDriving,
  noteKeyboardPlay,
  pollGamepad,
  pollMenuPad,
  primeMenuDirHold,
  resetPadState,
  rumble,
  setExtraMenuHeld,
} from "./gamepad";
import { invalidateSettingsCache } from "./settings";

const mem: Record<string, string> = {};

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => {
      mem[k] = v;
    },
    removeItem: (k: string) => {
      delete mem[k];
    },
    clear: () => {
      for (const k of Object.keys(mem)) delete mem[k];
    },
  },
});

function fakePad(pressed: number[]): Gamepad {
  const buttons = Array.from({ length: 17 }, (_, i) => ({
    pressed: pressed.includes(i),
    touched: pressed.includes(i),
    value: pressed.includes(i) ? 1 : 0,
  }));
  return {
    axes: [0, 0, 0, 0],
    buttons,
    connected: true,
    id: "test-pad",
    index: 0,
    mapping: "standard",
    timestamp: 1,
  } as unknown as Gamepad;
}

function hold(pressed: number[]): void {
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => [fakePad(pressed)],
  });
}

describe("gamepad pause and menu confirm", () => {
  beforeEach(() => {
    localStorage.clear();
    invalidateSettingsCache();
    resetPadState();
    hold([]);
  });

  it("reports the pressed move once for recording", () => {
    const stage = { triggerKeyDown: vi.fn(), triggerKeyUp: vi.fn() };
    const onCmd = vi.fn();
    hold([]);
    pollGamepad(stage, undefined, onCmd);
    hold([15]);
    pollGamepad(stage, undefined, onCmd);
    pollGamepad(stage, undefined, onCmd);
    expect(onCmd).toHaveBeenCalledTimes(1);
    expect(onCmd).toHaveBeenCalledWith("right");
  });

  it("fires onPause once when Start is pressed during play", () => {
    const stage = { triggerKeyDown: vi.fn(), triggerKeyUp: vi.fn() };
    const onPause = vi.fn();
    hold([]);
    pollGamepad(stage, onPause);
    hold([9]);
    pollGamepad(stage, onPause);
    pollGamepad(stage, onPause);
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(stage.triggerKeyDown).not.toHaveBeenCalled();
  });

  it("still reports Start while movement is suppressed", () => {
    const onPause = vi.fn();
    hold([9]);
    pollGamepad(undefined, onPause);
    expect(onPause).toHaveBeenCalledTimes(1);
    pollGamepad(undefined, onPause);
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("does not treat a held Start as menu confirm after absorb", () => {
    hold([9]);
    absorbHeldMenuConfirm();
    expect(pollMenuPad()).toEqual([]);
    expect(pollMenuPad()).toEqual([]);
  });

  it("can leave Start out of menu confirm while the pause menu is open", () => {
    hold([9]);
    expect(pollMenuPad({ pauseConfirms: false })).toEqual([]);
    hold([0]);
    resetPadState();
    hold([0]);
    expect(pollMenuPad({ pauseConfirms: false })).toEqual(["confirm"]);
  });

  it("marks the pad as driving when a menu d-pad event fires", () => {
    hold([]);
    pollMenuPad();
    expect(isPadDriving()).toBe(false);
    hold([12]);
    expect(pollMenuPad()).toEqual(["up"]);
    expect(isPadDriving()).toBe(true);
  });

  it("maps A/South and Start to menu confirm for splash unlock", () => {
    hold([]);
    pollMenuPad();
    hold([0]);
    expect(pollMenuPad()).toEqual(["confirm"]);
    hold([]);
    pollMenuPad();
    resetPadState();
    hold([9]);
    expect(pollMenuPad()).toEqual(["confirm"]);
  });

  it("repeats stick navigation while held", () => {
    hold([]);
    pollMenuPad();
    hold([13]);
    expect(pollMenuPad()).toEqual(["down"]);
    let saw = false;
    for (let i = 0; i < 40; i++) {
      const ev = pollMenuPad();
      if (ev.includes("down")) {
        saw = true;
        break;
      }
    }
    expect(saw).toBe(true);
  });

  it("keeps a steady hold-repeat rate without ramping up", () => {
    hold([]);
    pollMenuPad();
    hold([13]);
    expect(pollMenuPad()).toEqual(["down"]);
    const gaps: number[] = [];
    let since = 0;
    for (let i = 0; i < 80; i++) {
      since++;
      const ev = pollMenuPad();
      if (ev.includes("down")) {
        gaps.push(since);
        since = 0;
      }
    }
    expect(gaps.length).toBeGreaterThan(3);
    const steady = gaps.slice(1);
    expect(Math.max(...steady) - Math.min(...steady)).toBeLessThanOrEqual(1);
  });

  it("uses faster creator repeat cadence when requested", () => {
    hold([]);
    pollMenuPad({ repeatInitial: 2, repeatRate: 2 });
    hold([13]);
    expect(pollMenuPad({ repeatInitial: 2, repeatRate: 2 })).toEqual(["down"]);
    const gaps: number[] = [];
    let since = 0;
    for (let i = 0; i < 40; i++) {
      since++;
      const ev = pollMenuPad({ repeatInitial: 2, repeatRate: 2 });
      if (ev.includes("down")) {
        gaps.push(since);
        since = 0;
      }
    }
    expect(gaps[0]).toBe(2);
    expect(gaps.slice(1).every((g) => g === 2)).toBe(true);
  });

  it("merges synthetic keyboard dirs without marking pad driving", () => {
    hold([]);
    pollMenuPad();
    expect(isPadDriving()).toBe(false);
    setExtraMenuHeld({ down: true });
    expect(pollMenuPad()).toEqual(["down"]);
    expect(isPadDriving()).toBe(false);
    clearExtraMenuHeld();
  });

  it("keeps dir hold-repeat armed across confirm when requested", () => {
    const opts = { keepDirHoldOnConfirm: true, confirmCool: 3, repeatInitial: 2, repeatRate: 2 };
    hold([]);
    pollMenuPad(opts);
    hold([13]);
    expect(pollMenuPad(opts)).toEqual(["down"]);
    // Drain dir cool so confirm edge can fire.
    expect(pollMenuPad(opts)).toEqual([]);
    hold([13, 0]);
    expect(pollMenuPad(opts)).toEqual(["confirm"]);
    let saw = false;
    for (let i = 0; i < 20; i++) {
      if (pollMenuPad(opts).includes("down")) {
        saw = true;
        break;
      }
    }
    expect(saw).toBe(true);
  });

  it("primes keyboard dir hold without double-firing the edge", () => {
    hold([]);
    pollMenuPad({ repeatInitial: 2, repeatRate: 2 });
    setExtraMenuHeld({ right: true });
    primeMenuDirHold("right", 2);
    expect(pollMenuPad({ repeatInitial: 2, repeatRate: 2 })).toEqual([]);
    expect(pollMenuPad({ repeatInitial: 2, repeatRate: 2 })).toEqual(["right"]);
    clearExtraMenuHeld();
  });

  it("does not rumble for keyboard play even if a pad is plugged in", () => {
    const playEffect = vi.fn();
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [
        {
          ...fakePad([]),
          vibrationActuator: { playEffect },
        },
      ],
    });
    noteKeyboardPlay();
    rumble(90, 0.4, 0.4);
    expect(playEffect).not.toHaveBeenCalled();
    expect(isPadDriving()).toBe(false);
  });

  it("rumbles after the last move came from the pad", () => {
    const playEffect = vi.fn();
    const pad = {
      ...fakePad([15]),
      vibrationActuator: { playEffect },
    };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [pad],
    });
    pollGamepad({ triggerKeyDown: vi.fn(), triggerKeyUp: vi.fn() });
    expect(isPadDriving()).toBe(true);
    rumble(90, 0.4, 0.4);
    expect(playEffect).toHaveBeenCalled();
  });

  it("keeps rumble armed after pad release so fall/win pulses still fire", () => {
    const playEffect = vi.fn();
    const stage = { triggerKeyDown: vi.fn(), triggerKeyUp: vi.fn() };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [{ ...fakePad([15]), vibrationActuator: { playEffect } }],
    });
    pollGamepad(stage);
    hold([]);
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [{ ...fakePad([]), vibrationActuator: { playEffect } }],
    });
    pollGamepad(stage);
    expect(isPadDriving()).toBe(true);
    rumble(180, 0.6, 0.4);
    expect(playEffect).toHaveBeenCalled();
  });

  it("does not clear padDriving when keyboard notes arrive while the stick is held", () => {
    const playEffect = vi.fn();
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [{ ...fakePad([12]), vibrationActuator: { playEffect } }],
    });
    pollGamepad({ triggerKeyDown: vi.fn(), triggerKeyUp: vi.fn() });
    noteKeyboardPlay();
    expect(isPadDriving()).toBe(true);
    rumble(90, 0.4, 0.4);
    expect(playEffect).toHaveBeenCalled();
  });

  it("ignores remapped keydown shortly after a pad poll so later event rumbles still work", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const playEffect = vi.fn();
    const stage = { triggerKeyDown: vi.fn(), triggerKeyUp: vi.fn() };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [{ ...fakePad([15]), vibrationActuator: { playEffect } }],
    });
    pollGamepad(stage);
    hold([]);
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [{ ...fakePad([]), vibrationActuator: { playEffect } }],
    });
    pollGamepad(stage);
    // Remapper keydown ~50ms after the poll must not disarm rumble for the session.
    vi.setSystemTime(50);
    noteKeyboardPlay();
    expect(isPadDriving()).toBe(true);
    rumble(220, 0.45, 0.4);
    expect(playEffect).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("lets a later keyboard-only move disarm rumble", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const playEffect = vi.fn();
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [{ ...fakePad([15]), vibrationActuator: { playEffect } }],
    });
    pollGamepad({ triggerKeyDown: vi.fn(), triggerKeyUp: vi.fn() });
    hold([]);
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [{ ...fakePad([]), vibrationActuator: { playEffect } }],
    });
    vi.setSystemTime(500);
    noteKeyboardPlay();
    expect(isPadDriving()).toBe(false);
    rumble(90, 0.4, 0.4);
    expect(playEffect).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("re-arms rumble while a mapped control stays held across polls", () => {
    const playEffect = vi.fn();
    const stage = { triggerKeyDown: vi.fn(), triggerKeyUp: vi.fn() };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [{ ...fakePad([15]), vibrationActuator: { playEffect } }],
    });
    pollGamepad(stage);
    // Simulate a clear that somehow landed, then another poll while still held.
    noteKeyboardPlay();
    pollGamepad(stage);
    expect(isPadDriving()).toBe(true);
    rumble(90, 0.4, 0.4);
    expect(playEffect).toHaveBeenCalled();
  });
});
