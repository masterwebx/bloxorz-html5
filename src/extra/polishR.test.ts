import { describe, expect, it } from "vitest";
import {
  BG_CYCLE_CACHE_MS,
  BG_CYCLE_DEG_PER_SEC,
  colorMatrixHue,
  shiftHexHue,
  shiftingHue,
  shouldUpdateBgCycle,
  skyCycleCacheKey,
  wrapHue,
} from "./hue";

/** Finish list paging: visible window + scroll range for long gauntlets. */
export function finishScrollWindow(total: number, scroll: number, pageSize = 5): {
  start: number;
  end: number;
  maxScroll: number;
} {
  const maxScroll = Math.max(0, total - pageSize);
  const start = Math.max(0, Math.min(maxScroll, scroll));
  return { start, end: Math.min(total, start + pageSize), maxScroll };
}

describe("win screen finish scroll", () => {
  it("pages long stage lists so every row is reachable", () => {
    const total = 15;
    const page = 5;
    expect(finishScrollWindow(total, 0, page)).toEqual({ start: 0, end: 5, maxScroll: 10 });
    expect(finishScrollWindow(total, 10, page)).toEqual({ start: 10, end: 15, maxScroll: 10 });
    expect(finishScrollWindow(total, 99, page).start).toBe(10);
    expect(finishScrollWindow(3, 0, page)).toEqual({ start: 0, end: 3, maxScroll: 0 });
  });
});

describe("backdrop hue cycle quality", () => {
  it("advances slowly through a continuous full spectrum", () => {
    expect(BG_CYCLE_DEG_PER_SEC).toBe(6);
    // ~60s for 360° — slower than the old ~16s / 22°/s path.
    expect(shiftingHue(0, true, 60_000, BG_CYCLE_DEG_PER_SEC)).toBeCloseTo(0, 5);
    expect(shiftingHue(0, true, 30_000, BG_CYCLE_DEG_PER_SEC)).toBeCloseTo(180, 5);
    const a = shiftingHue(0, true, 1000, BG_CYCLE_DEG_PER_SEC);
    const b = shiftingHue(0, true, 1016, BG_CYCLE_DEG_PER_SEC);
    expect(b - a).toBeCloseTo(BG_CYCLE_DEG_PER_SEC * 0.016, 5);
    expect(wrapHue(shiftingHue(350, true, 2000, BG_CYCLE_DEG_PER_SEC))).toBeCloseTo(2, 5);
    expect(shiftHexHue("#b86a2e", 180)).not.toBe("#b86a2e");
  });

  it("maps past 180° into CreateJS ±180 so the second half of the wheel plays", () => {
    expect(colorMatrixHue(0)).toBe(0);
    expect(colorMatrixHue(90)).toBe(90);
    expect(colorMatrixHue(180)).toBe(180);
    expect(colorMatrixHue(181)).toBeCloseTo(-179, 5);
    expect(colorMatrixHue(270)).toBe(-90);
    expect(colorMatrixHue(359)).toBeCloseTo(-1, 5);
    // Full walk: after cyan, continue through purple/red instead of sticking at +180.
    expect([0, 60, 120, 180, 240, 300].map(colorMatrixHue)).toEqual([0, 60, 120, 180, -120, -60]);
  });

  it("quantizes Cycle sky cache keys to integer degrees and time-throttles updates", () => {
    expect(skyCycleCacheKey(12.4)).toBe(12);
    expect(skyCycleCacheKey(12.6)).toBe(13);
    expect(skyCycleCacheKey(359.7)).toBe(0);
    expect(BG_CYCLE_CACHE_MS).toBe(100);
    expect(shouldUpdateBgCycle(1000, 900)).toBe(true);
    expect(shouldUpdateBgCycle(1000, 950)).toBe(false);
    // At 6°/s, integer keys change about every 167ms — far below the old 10×/frame tenths path.
    const a = skyCycleCacheKey(shiftingHue(0, true, 0, BG_CYCLE_DEG_PER_SEC));
    const b = skyCycleCacheKey(shiftingHue(0, true, 80, BG_CYCLE_DEG_PER_SEC));
    expect(a).toBe(b);
    expect(skyCycleCacheKey(shiftingHue(0, true, 200, BG_CYCLE_DEG_PER_SEC))).toBe(a + 1);
  });
});
