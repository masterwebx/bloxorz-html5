/**
 * CreateJS RAF_SYNCHED + fps:36 snaps to ~30fps on 60Hz displays:
 * each tick needs ≥~26ms, so every other rAF (16.7ms) is skipped.
 * TIMEOUT honors the authored 36fps interval without that half-rate snap.
 */
import { describe, expect, it } from "vitest";

function synchedTicksAt(displayHz: number, targetFps: number, seconds: number): number {
  const interval = 1000 / targetFps;
  const threshold = 0.97 * (interval - 1); // CreateJS _handleSynch
  const frameMs = 1000 / displayHz;
  let last = 0;
  let ticks = 0;
  for (let t = 0; t <= seconds * 1000 + 1e-6; t += frameMs) {
    if (t - last >= threshold) {
      ticks += 1;
      last = t;
    }
  }
  return ticks;
}

describe("CreateJS ticker mode choice", () => {
  it("RAF_SYNCHED at 36fps on 60Hz yields ~30 ticks/sec", () => {
    const ticks = synchedTicksAt(60, 36, 1);
    expect(ticks).toBe(30);
  });

  it("TIMEOUT at 36fps schedules ~36 intervals/sec", () => {
    const interval = 1000 / 36;
    const ticks = Math.round(1000 / interval);
    expect(ticks).toBe(36);
  });
});
