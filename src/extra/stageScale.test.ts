import { describe, expect, it } from "vitest";
import { backingStoreSize, cappedStageScale, MAX_STAGE_SCALE } from "./stageScale";

describe("cappedStageScale", () => {
  it("keeps windowed ~960 CSS near the cap without dropping DPR", () => {
    const display = Math.min(960 / 550, 540 / 300);
    const { stageScale, renderScale } = cappedStageScale(display, 1.5);
    expect(MAX_STAGE_SCALE).toBe(2.5);
    expect(stageScale).toBeLessThanOrEqual(MAX_STAGE_SCALE);
    expect(renderScale).toBeCloseTo(stageScale / 1.5, 5);
    const { width, megapixels } = backingStoreSize(550, 300, stageScale);
    expect(width).toBeLessThanOrEqual(Math.round(550 * MAX_STAGE_SCALE));
    expect(megapixels).toBeLessThan(1.2);
  });

  it("bounds fullscreen 4K backing store while CSS displayScale stays large", () => {
    const display = Math.min(3840 / 550, 2160 / 300);
    expect(display).toBeGreaterThan(6);
    const uncapped = 1.5 * display;
    expect(uncapped).toBeGreaterThan(10);
    const { displayScale, stageScale } = cappedStageScale(display, 1.5);
    expect(displayScale).toBe(display);
    expect(stageScale).toBe(MAX_STAGE_SCALE);
    const { width, height, megapixels } = backingStoreSize(550, 300, stageScale);
    expect(width).toBe(1375);
    expect(height).toBe(750);
    expect(megapixels).toBeCloseTo(1.03125, 5);
  });

  it("still applies DPR up to 1.5 inside the product cap on mid sizes", () => {
    const display = 1.2; // ~660 CSS-wide
    const { stageScale } = cappedStageScale(display, 1.5);
    expect(stageScale).toBeCloseTo(1.8, 5);
    expect(stageScale).toBeLessThan(MAX_STAGE_SCALE);
  });
});
