import { describe, expect, it } from "vitest";
import { difficultyHint } from "./generate";
import { CAMPAIGN_WALKTHROUGH, expandWalkthrough } from "./walkthrough";

describe("puzzle difficulty copy", () => {
  it("describes difficulty by move count and obstacles", () => {
    expect(difficultyHint("easy")).toContain("moves");
    expect(difficultyHint("easy")).toContain("obstacles");
    expect(difficultyHint("insane")).toMatch(/22/);
  });
});

describe("campaign walkthrough", () => {
  it("expands the official stage 01 route", () => {
    const cmds = expandWalkthrough(CAMPAIGN_WALKTHROUGH[0]);
    expect(cmds).toEqual(["right", "right", "down", "right", "right", "right", "down"]);
  });
});
