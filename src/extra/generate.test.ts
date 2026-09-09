import { describe, expect, it } from "vitest";
import { LEVELS, Stage } from "./engine";
import { dailySeed, generatePuzzle, generateRun, hashSeed, difficultyHint } from "./generate";
import { applyCmd, playScript, solveLevel } from "./solve";
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

describe("seeded generator", () => {
  it("is deterministic for a seed and difficulty", () => {
    const a = generatePuzzle("wex", "easy");
    const b = generatePuzzle("wex", "easy");
    expect(a.def.tiles).toEqual(b.def.tiles);
    expect(a.def.spawn).toEqual(b.def.spawn);
    expect(a.solutionLen).toBe(b.solutionLen);
  });

  it("makes different maps for different seeds", () => {
    const a = generatePuzzle("alpha", "easy");
    const b = generatePuzzle("beta", "easy");
    expect(a.def.tiles.join("")).not.toBe(b.def.tiles.join(""));
  });

  it("produces a standing spawn on solid ground and a hole", () => {
    const p = generatePuzzle("spawn-check", "medium");
    const [x, y] = p.def.spawn;
    expect(p.def.tiles[y][x]).not.toBe(" ");
    expect(p.def.tiles[y][x]).not.toBe("e");
    expect(p.def.tiles.some((row) => row.includes("e"))).toBe(true);
    const stage = new Stage(p.def);
    expect(stage.tileAt(x, y)).not.toBe("empty");
  });

  it("builds a 5-stage run from one seed", () => {
    const run = generateRun("series", "easy", 5);
    expect(run).toHaveLength(5);
    expect(new Set(run.map((p) => p.def.tiles.join(""))).size).toBeGreaterThan(1);
  });

  it("names a daily seed from the UTC date", () => {
    expect(dailySeed(new Date("2026-09-09T12:00:00Z"), "hard")).toBe("daily:2026-09-09:hard");
    expect(hashSeed("daily:2026-09-09:hard")).toBeGreaterThan(0);
  });

  it("BFS-solves a generated puzzle and the tape wins", () => {
    const p = generatePuzzle("autosolve-check", "easy");
    const solved = solveLevel(p.def, 80_000);
    expect(solved.ok).toBe(true);
    const stage = new Stage(p.def);
    let last = "ok";
    for (const cmd of solved.cmds) last = applyCmd(stage, cmd);
    expect(last).toBe("win");
  });
});

describe("stage 03 verified path", () => {
  it("wins with the BFS-verified substitute for the FAQ script", () => {
    expect(playScript(LEVELS[2], CAMPAIGN_WALKTHROUGH[2]).result).toBe("win");
  });
});
