import { describe, expect, it } from "vitest";
import { looksLikeMobile, showVirtualPad } from "./touchPad";

describe("virtual pad visibility", () => {
  it("shows the pad only when mobile controls are on and a stage is running", () => {
    expect(showVirtualPad(true, true)).toBe(true);
    expect(showVirtualPad(true, false)).toBe(false);
    expect(showVirtualPad(false, true)).toBe(false);
  });

  it("detects common phone user agents", () => {
    expect(looksLikeMobile("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(looksLikeMobile("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(true);
  });
});
