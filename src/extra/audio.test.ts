import { describe, expect, it } from "vitest";
import { soundLoopCount } from "./audio";

describe("sound loop count", () => {
  it("treats a missing Animate loop arg as play-once", () => {
    expect(soundLoopCount(undefined)).toBe(0);
    expect(soundLoopCount(null)).toBe(0);
    expect(soundLoopCount(-1)).toBe(-1);
    expect(soundLoopCount(2)).toBe(2);
    expect(soundLoopCount("nope")).toBe(0);
  });
});
