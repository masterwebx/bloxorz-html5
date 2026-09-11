import { beforeEach, describe, expect, it } from "vitest";
import {
  activeBlockHex,
  activeBg,
  defaultColorCustom,
  normalizeColorCustom,
  resolveTileFace,
} from "./colorCustom";
import { invalidateSettingsCache, loadSettings } from "./settings";

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

describe("colorCustom", () => {
  beforeEach(() => {
    localStorage.clear();
    invalidateSettingsCache();
  });

  it("defaults every slot off with catalog hexes", () => {
    const colors = defaultColorCustom();
    expect(colors.block.on).toBe(false);
    expect(colors.bg.on).toBe(false);
    expect(colors.stone.on).toBe(false);
    expect(colors.block.hex).toBe("#b86a2e");
    expect(colors.exit.hex).toBe("#0c0c0c");
  });

  it("activeBlockHex is null when the block slot is off", () => {
    const colors = defaultColorCustom();
    expect(activeBlockHex(colors, "#3366ff", 40)).toBeNull();
    colors.block = { hex: "#3366ff", on: true };
    expect(activeBlockHex(colors, "#b86a2e", 0)).toBe("#3366ff");
  });

  it("activeBg is null when backdrop slot is off", () => {
    const colors = defaultColorCustom();
    expect(activeBg(colors, "#b86a2e", 0.8)).toBeNull();
    colors.bg = { hex: "#33aaff", on: true };
    expect(activeBg(colors, "#b86a2e", 0.1)).toEqual({ hex: "#33aaff", tint: 0.55 });
  });

  it("normalizeColorCustom rejects bad hex and keeps on=false unless true", () => {
    const colors = normalizeColorCustom({
      block: { hex: "nope", on: "yes" },
      stone: { hex: "AABBCC", on: true },
    });
    expect(colors.block.on).toBe(false);
    expect(colors.block.hex).toBe("#b86a2e");
    expect(colors.stone.on).toBe(true);
    expect(colors.stone.hex).toBe("#aabbcc");
  });

  it("migrates legacy tint/block into colorCustom on first load", () => {
    localStorage.setItem(
      "bloxorz-settings-v1",
      JSON.stringify({ bgTint: 0.6, bgColor: "#33aaff", blockHue: 120, blockColor: "#00ff80" }),
    );
    const s = loadSettings();
    expect(s.colorCustom.bg.on).toBe(true);
    expect(s.colorCustom.bg.hex).toBe("#33aaff");
    expect(s.colorCustom.block.on).toBe(true);
    expect(s.colorCustom.block.hex).toBe("#00ff80");
    expect(s.colorCustom.stone.on).toBe(false);
  });

  it("does not re-migrate when colorCustom already exists", () => {
    localStorage.setItem(
      "bloxorz-settings-v1",
      JSON.stringify({
        bgTint: 0.9,
        colorCustom: { bg: { hex: "#111111", on: false }, block: { hex: "#222222", on: false } },
      }),
    );
    const s = loadSettings();
    expect(s.colorCustom.bg.on).toBe(false);
    expect(s.colorCustom.bg.hex).toBe("#111111");
    expect(s.colorCustom.block.on).toBe(false);
  });

  it("resolveTileFace returns vanilla when slot off and tinted when on", () => {
    const off = defaultColorCustom();
    const base = resolveTileFace("s", off);
    off.soft = { hex: "#ff0000", on: true };
    const tinted = resolveTileFace("s", off);
    expect(tinted.top).not.toBe(base.top);
    expect(tinted.top.startsWith("rgb(")).toBe(true);
  });
});
