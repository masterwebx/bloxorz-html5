import { describe, expect, it } from "vitest";
import { isStagePlayLabel, resolveStagePlayCode } from "./playKeys";

describe("isStagePlayLabel", () => {
  it("matches pad game|restart (not only game)", () => {
    expect(isStagePlayLabel("game")).toBe(true);
    expect(isStagePlayLabel("restart")).toBe(true);
    expect(isStagePlayLabel("stagetitle")).toBe(false);
    expect(isStagePlayLabel("instructions")).toBe(false);
    expect(isStagePlayLabel("menu")).toBe(false);
    expect(isStagePlayLabel("")).toBe(false);
  });
});

describe("resolveStagePlayCode", () => {
  it("forwards Space and remapped swap to CreateJS Space", () => {
    expect(resolveStagePlayCode("Space", null)).toBe("Space");
    expect(resolveStagePlayCode("Space", "swap")).toBe("Space");
    expect(resolveStagePlayCode("KeyQ", "swap")).toBe("Space");
    expect(resolveStagePlayCode("KeyE", "swap")).toBe("Space");
  });

  it("maps remapped directions to Arrow codes", () => {
    expect(resolveStagePlayCode("KeyW", "up")).toBe("ArrowUp");
    expect(resolveStagePlayCode("KeyS", "down")).toBe("ArrowDown");
    expect(resolveStagePlayCode("KeyA", "left")).toBe("ArrowLeft");
    expect(resolveStagePlayCode("KeyD", "right")).toBe("ArrowRight");
    expect(resolveStagePlayCode("ArrowUp", null)).toBe("ArrowUp");
  });

  it("ignores unrelated keys", () => {
    expect(resolveStagePlayCode("Escape", "pause")).toBe(null);
    expect(resolveStagePlayCode("Enter", "confirm")).toBe(null);
    expect(resolveStagePlayCode("KeyF", null)).toBe(null);
  });
});
