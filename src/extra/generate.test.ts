import { describe, expect, it } from "vitest";
import { LEVELS, Stage } from "./engine";
import {
  dailySeed,
  difficultyHint,
  filledCellCount,
  generateFullBoard,
  generatePuzzle,
  generateRun,
  hashSeed,
  pruneOptionalSwitches,
  pruneUnusedSwitches,
  usedObstacleKeys,
} from "./generate";
import { applyCmd, playScript, solveLevel } from "./solve";
import { CAMPAIGN_WALKTHROUGH, expandWalkthrough, type WalkCmd } from "./walkthrough";
import type { LevelDef } from "./types";

describe("puzzle difficulty copy", () => {
  it("describes difficulty by required switches and move count", () => {
    expect(difficultyHint("easy")).toContain("moves");
    expect(difficultyHint("easy")).toContain("switches");
    expect(difficultyHint("insane")).toMatch(/36/);
  });
});

describe("campaign walkthrough", () => {
  it("expands the official stage 01 route", () => {
    const cmds = expandWalkthrough(CAMPAIGN_WALKTHROUGH[0]);
    expect(cmds).toEqual(["right", "right", "down", "right", "right", "right", "down"]);
  });
});

describe("switch pruning", () => {
  it("turns switches the winning tape never stands on into stone", () => {
    const def: LevelDef = {
      id: "prune-unused",
      code: "000001",
      tiles: [
        "bbbbbbe        ",
        "               ",
        "s              ",
        "               ",
        "               ",
        "               ",
        "               ",
        "               ",
        "               ",
        "               ",
      ],
      spawn: [0, 0],
      switches: [{ x: 0, y: 2, bridges: [{ x: 8, y: 0, mode: "on" }] }],
      splits: [],
    };
    const cmds: WalkCmd[] = ["right", "right", "right"];
    const pruned = pruneUnusedSwitches(def, cmds);
    expect(pruned.tiles[2][0]).toBe("b");
    expect(pruned.switches).toEqual([]);
  });

  it("drops a switch you can walk over but do not need", () => {
    const def: LevelDef = {
      id: "prune-optional",
      code: "000002",
      tiles: [
        "bsbbbbe        ",
        "               ",
        "        l      ",
        "               ",
        "               ",
        "               ",
        "               ",
        "               ",
        "               ",
        "               ",
      ],
      spawn: [0, 0],
      switches: [{ x: 1, y: 0, bridges: [{ x: 8, y: 2, mode: "on" }] }],
      splits: [],
    };
    const pruned = pruneOptionalSwitches(def, 20_000);
    expect(pruned.switches).toEqual([]);
    expect(pruned.tiles[0][1]).toBe("b");
  });
});

describe("used obstacles", () => {
  it("counts only obstacle cells the winning tape occupies", () => {
    const def: LevelDef = {
      id: "used-test",
      code: "000001",
      tiles: [
        "               ",
        "  bbbb bbbbe   ",
        "  bbbblbbbb    ",
        "  s            ",
        "               ",
        "               ",
        "               ",
        "               ",
        "               ",
        "               ",
      ],
      spawn: [2, 1],
      switches: [{ x: 2, y: 3, bridges: [{ x: 6, y: 2, mode: "on" }] }],
      splits: [],
    };
    const solved = solveLevel(def, 80_000);
    expect(solved.ok).toBe(true);
    const used = usedObstacleKeys(def, solved.cmds);
    expect(used).toContain("2,3");
    expect(used).toContain("6,2");
    expect(used.length).toBeGreaterThanOrEqual(2);
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
    const p = generatePuzzle("spawn-check", "easy");
    const [x, y] = p.def.spawn;
    expect(p.def.tiles[y][x]).not.toBe(" ");
    expect(p.def.tiles[y][x]).not.toBe("e");
    expect(p.def.tiles.some((row) => row.includes("e"))).toBe(true);
    const stage = new Stage(p.def);
    expect(stage.tileAt(x, y)).not.toBe("empty");
  });

  it("builds a multi-stage run from one seed", () => {
    const run = generateRun("series", "easy", 2);
    expect(run).toHaveLength(2);
    expect(run[0].def.tiles.join("")).not.toBe(run[1].def.tiles.join(""));
  });

  it("fills most of the 15×10 board and leaves unused walls empty", () => {
    const p = generateFullBoard("fill-check");
    expect(filledCellCount(p.def.tiles)).toBeGreaterThanOrEqual(120);
    expect(p.def.tiles.join("")).toContain(" ");
    expect(p.def.tiles.some((row) => row.includes("e"))).toBe(true);
  });

  it("names a daily seed from the UTC date only", () => {
    expect(dailySeed(new Date("2026-09-09T12:00:00Z"))).toBe("daily:2026-09-09");
    expect(dailySeed(new Date("2026-09-09T23:00:00Z"))).toBe("daily:2026-09-09");
    expect(hashSeed("daily:2026-09-09")).toBeGreaterThan(0);
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
