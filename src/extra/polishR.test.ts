import { describe, expect, it } from "vitest";
import { BG_CYCLE_DEG_PER_SEC, shiftHexHue, shiftingHue, wrapHue } from "./hue";

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
});
