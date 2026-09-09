import { describe, expect, it } from "vitest";
import { createJsToDef } from "./convert";
import { playScript } from "./solve";
import { CAMPAIGN_WALKTHROUGH, expandWalkthrough } from "./walkthrough";

const STAGE_01 = [
  "780464",
  "               ",
  "               ",
  "  bbb          ",
  "  bbbbbb       ",
  "  bbbbbbbbb    ",
  "   bbbbbbbbb   ",
  "       bbebb   ",
  "        bbb    ",
  "               ",
  "               ",
  [3, 3],
  {},
  {},
];

describe("campaign walkthrough vs Coolmath maps", () => {
  it("beats stage 01 with the published route", () => {
    const def = createJsToDef(STAGE_01, 0);
    const played = playScript(def, CAMPAIGN_WALKTHROUGH[0]);
    expect(expandWalkthrough(CAMPAIGN_WALKTHROUGH[0])).toHaveLength(7);
    expect(played.result).toBe("win");
  });
});
