import { beforeEach, describe, expect, it } from "vitest";
import {
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
});
