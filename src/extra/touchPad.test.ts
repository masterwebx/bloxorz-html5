import { describe, expect, it } from "vitest";
import { looksLikeMobile, padDirToCode, padMenuLabel, showSwapPad, showVirtualPad, swapPadLabel } from "./touchPad";

describe("virtual pad visibility", () => {
  it("shows the pad whenever mobile controls are on", () => {
    expect(showVirtualPad(true)).toBe(true);
    expect(showVirtualPad(false)).toBe(false);
  });

  it("detects common phone user agents", () => {
    expect(looksLikeMobile("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(looksLikeMobile("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(true);
  });
});

describe("virtual pad labels and rotate map", () => {
  it("uses OK in menus and Switch only when a live stage is already split", () => {
    expect(swapPadLabel(false)).toBe("OK");
    expect(swapPadLabel(true, false)).toBe("OK");
    expect(swapPadLabel(true, true)).toBe("SWITCH");
    expect(showSwapPad(true, false, false)).toBe(false);
    expect(showSwapPad(true, true, false)).toBe(true);
    expect(showSwapPad(false, false, false)).toBe(true);
    expect(showSwapPad(true, false, true)).toBe(true);
  });

  it("labels the menu button BACK off-stage and PAUSE in a live stage", () => {
    expect(padMenuLabel(false)).toBe("BACK");
    expect(padMenuLabel(true)).toBe("PAUSE");
  });

  it("remaps pad dirs to undo a clockwise CSS rotate", () => {
    expect(padDirToCode("up", false)).toBe("ArrowUp");
    expect(padDirToCode("right", false)).toBe("ArrowRight");
    expect(padDirToCode("up", true)).toBe("ArrowLeft");
    expect(padDirToCode("right", true)).toBe("ArrowUp");
    expect(padDirToCode("down", true)).toBe("ArrowRight");
    expect(padDirToCode("left", true)).toBe("ArrowDown");
  });
});
