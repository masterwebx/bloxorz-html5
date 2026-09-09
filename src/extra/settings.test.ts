import { beforeEach, describe, expect, it } from "vitest";
import {
  hueRgb,
  invalidateSettingsCache,
  loadSettings,
  setMobilePad,
  setRotateScreen,
} from "./settings";

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

describe("mobile settings", () => {
  beforeEach(() => {
    localStorage.clear();
    invalidateSettingsCache();
  });

  it("defaults mobile pad and rotate off until chosen", () => {
    const s = loadSettings();
    expect(s.mobilePad).toBe(false);
    expect(s.mobilePadChoice).toBe("");
    expect(s.rotateScreen).toBe(false);
    expect(s.showTimer).toBe(false);
  });

  it("keeps an explicit speedrun timer on", () => {
    localStorage.setItem(
      "bloxorz-settings-v1",
      JSON.stringify({ showTimer: true }),
    );
    expect(loadSettings().showTimer).toBe(true);
  });

  it("records an explicit mobile-pad choice", () => {
    setMobilePad(true);
    expect(loadSettings().mobilePad).toBe(true);
    expect(loadSettings().mobilePadChoice).toBe("on");
    setMobilePad(false);
    expect(loadSettings().mobilePad).toBe(false);
    expect(loadSettings().mobilePadChoice).toBe("off");
  });

  it("stores rotate screen independently", () => {
    setRotateScreen(true);
    expect(loadSettings().rotateScreen).toBe(true);
    setRotateScreen(false);
    expect(loadSettings().rotateScreen).toBe(false);
  });

  it("turns backdrop hue into RGB for the in-game sky filter", () => {
    const red = hueRgb(0);
    expect(red[0]).toBeGreaterThan(red[1]);
    expect(red[0]).toBeGreaterThan(red[2]);
    const green = hueRgb(120);
    expect(green[1]).toBeGreaterThan(green[0]);
    const blue = hueRgb(240);
    expect(blue[2]).toBeGreaterThan(blue[0]);
  });
});
