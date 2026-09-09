import { describe, expect, it } from "vitest";
import { looksLikeMobile, padDirToCode, showVirtualPad, swapPadLabel } from "./touchPad";

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
  it("uses OK in menus and SPLIT in a live stage", () => {
    expect(swapPadLabel(false)).toBe("OK");
    expect(swapPadLabel(true)).toBe("SPLIT");
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
