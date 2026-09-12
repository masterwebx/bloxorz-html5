import { describe, expect, it } from "vitest";
import { ATTRACT_TITLE_Y } from "./attract";
import {
  ATTRACT_ARCHETYPES,
  attractArchetypeForSeed,
  generateAttract,
} from "./generate";
import { customizePreviewForceShapes } from "./hud";
import { needsTileColorBake } from "./hue";
import { solveLevel } from "./solve";

describe("attract archetype variety", () => {
  it("lists every showcase archetype including campaign remix", () => {
    expect(ATTRACT_ARCHETYPES).toEqual([
      "plain",
      "bridges",
      "split",
      "slots",
      "ribbon",
      "packed",
      "fullBoard",
      "campaignRemix",
    ]);
  });

  it("rotates archetypes across seeds instead of locking fullBoard", () => {
    const seen = new Set(ATTRACT_ARCHETYPES.map((a) => attractArchetypeForSeed(`rot-${a}-x`)));
    // Probe many seeds until the roster is represented.
    for (let i = 0; i < 64; i++) seen.add(attractArchetypeForSeed(`attract-probe-${i}`));
    expect(seen.size).toBe(ATTRACT_ARCHETYPES.length);
    expect(seen.has("fullBoard")).toBe(true);
    expect(seen.has("plain")).toBe(true);
    expect(seen.has("campaignRemix")).toBe(true);
  });

  it("generateAttract returns a solvable tape for auto-solve", () => {
    const p = generateAttract("polish-m-attract-1");
    expect(p.difficulty).toBe("insane");
    expect(p.solution?.length).toBeGreaterThan(0);
    expect(p.solutionLen).toBe(p.solution!.length);
    const solved = solveLevel(p.def, 180_000);
    expect(solved.ok).toBe(true);
    expect(solved.cmds.length).toBeGreaterThan(0);
  });
});

describe("attract title position", () => {
  it("anchors the brand near the bottom of the game HUD", () => {
    expect(ATTRACT_TITLE_Y).toBeGreaterThanOrEqual(240);
    expect(ATTRACT_TITLE_Y).toBeLessThanOrEqual(290);
  });
});

describe("tile bake skip + customize preview shapes", () => {
  it("does not need a bake when every tile slot is off and nothing was baked", () => {
    expect(needsTileColorBake({}, {}, false)).toBe(false);
    expect(needsTileColorBake({ stone: null, exit: null }, {}, false)).toBe(false);
  });

  it("uses Stage Creator clips once the atlas is ready", () => {
    expect(customizePreviewForceShapes(false)).toBe(true);
    expect(customizePreviewForceShapes(true)).toBe(false);
  });
});
