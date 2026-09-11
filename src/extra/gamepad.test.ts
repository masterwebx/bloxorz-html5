import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  absorbHeldMenuConfirm,
  isPadDriving,
  noteKeyboardPlay,
  pollGamepad,
  pollMenuPad,
  resetPadState,
  rumble,
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
});
