import { describe, expect, it } from "vitest";
import { LEVELS } from "./engine";
import { playScript, solveLevel } from "./solve";
import { CAMPAIGN_WALKTHROUGH } from "./walkthrough";

describe("official campaign walkthrough", () => {
  it("has a script for every stage", () => {
    expect(CAMPAIGN_WALKTHROUGH).toHaveLength(33);
  });

  for (let i = 0; i < LEVELS.length; i++) {
    it(`plays stage ${String(i + 1).padStart(2, "0")} (${LEVELS[i].code})`, () => {
      const { result, step, cmds } = playScript(LEVELS[i], CAMPAIGN_WALKTHROUGH[i]);
      expect(result, `failed at step ${step + 1}/${cmds.length} (${cmds[step]})`).toBe("win");
    });
  }
});

describe("BFS solvability", () => {
  it.each(LEVELS.map((l, i) => [i, l.code] as const))(
    "can reach the hole on stage %s (%s)",
    (i) => {
      const r = solveLevel(LEVELS[i]);
      expect(r.ok, `stage ${i + 1} has no solution`).toBe(true);
    },
    15_000,
  );
});
