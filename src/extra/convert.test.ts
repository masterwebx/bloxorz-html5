import { describe, expect, it } from "vitest";
import { createJsToDef, defToCreateJs } from "./convert";
import { LEVELS } from "./engine";
import { playScript, solveLevel } from "./solve";
import { CAMPAIGN_WALKTHROUGH } from "./walkthrough";

describe("Coolmath map convert", () => {
  it("round-trips campaign stage 01", () => {
    const raw = defToCreateJs(LEVELS[0]);
    const back = createJsToDef(raw, 0);
    expect(back.tiles).toEqual(LEVELS[0].tiles);
    expect(back.spawn).toEqual(LEVELS[0].spawn);
    expect(back.switches).toEqual(LEVELS[0].switches);
    expect(back.splits).toEqual(LEVELS[0].splits);
  });

  it("lets BFS beat a converted custom path the same as the engine map", () => {
    const solved = solveLevel(LEVELS[0], 80_000);
    expect(solved.ok).toBe(true);
    const back = createJsToDef(defToCreateJs(LEVELS[0]), 0);
    expect(playScript(back, CAMPAIGN_WALKTHROUGH[0]).result).toBe("win");
  });
});
