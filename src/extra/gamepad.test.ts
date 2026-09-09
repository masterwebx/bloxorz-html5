import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  absorbHeldMenuConfirm,
  pollGamepad,
  pollMenuPad,
  resetPadState,
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
});
