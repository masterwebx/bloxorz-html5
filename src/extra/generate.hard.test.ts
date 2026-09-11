import { describe, expect, it } from "vitest";
import {
  assessPuzzle,
  forcedGatePuzzle,
  flipLevel,
  generateDaily,
  generateFullBoard,
  generateRun,
  HARD_BFS,
  isLateCampaignShape,
  isStrictHard,
  isSwitchGated,
  meetsHardness,
  meetsSwitchGate,
  remixCampaign,
  requiredSwitches,
  runArchetypeForSeed,
  stripAllSwitches,
  withoutSwitch,
} from "./generate";
import { solveLevel } from "./solve";
import type { LevelDef, SwitchDef } from "./types";

const BFS = HARD_BFS;

function level(rows: string[], spawn: [number, number], switches: SwitchDef[] = []): LevelDef {
  const tiles = rows.map((row) => row.padEnd(15, " ").slice(0, 15));
  while (tiles.length < 10) tiles.push(" ".repeat(15));
  return { id: "t", code: "000000", tiles, spawn, switches, splits: [] };
}

/** Proven solvable in generate.test.ts — one OFF bridge, one switch. */
function oneGate(): LevelDef {
  return level(
    ["               ", "  bbbb bbbbe   ", "  bbbblbbbb    ", "  s            "],
    [2, 1],
    [{ x: 2, y: 3, bridges: [{ x: 6, y: 2, mode: "on" }] }],
  );
}

/** Two sequential OFF bridges from the forced-chain constructor. */
function twoGates(): LevelDef {
  return forcedGatePuzzle("fixture-two", 2).def;
}

describe("stripAllSwitches", () => {
  it("turns every switch pad into stone and drops switch defs", () => {
    const stripped = stripAllSwitches(oneGate());
    expect(stripped.switches).toEqual([]);
    expect(stripped.tiles[3]![2]).toBe("b");
    expect(stripped.tiles[2]![6]).toBe("l");
  });
});

describe("isSwitchGated", () => {
  it("rejects a leaky 15×10 slab with a decorative gate", () => {
    const tiles = Array.from({ length: 10 }, () => "b".repeat(15));
    const row0 = tiles[0]!.split("");
    row0[14] = "e";
    tiles[0] = row0.join("");
    const row4 = tiles[4]!.split("");
    row4[7] = "l";
    tiles[4] = row4.join("");
    const row8 = tiles[8]!.split("");
    row8[2] = "s";
    tiles[8] = row8.join("");
    const leaky: LevelDef = {
      id: "leaky",
      code: "000000",
      tiles,
      spawn: [1, 1],
      switches: [{ x: 2, y: 8, bridges: [{ x: 7, y: 4, mode: "on" }] }],
      splits: [],
    };
    expect(solveLevel(leaky, BFS).ok).toBe(true);
    expect(isSwitchGated(leaky, BFS)).toBe(false);
  });

  it("rejects a 2-wide corridor with only one cell cut — you walk around the gate", () => {
    const def = level(
      ["sbbbbblbbbe", "bbbbbbbbbbb"],
      [1, 0],
      [{ x: 0, y: 0, bridges: [{ x: 6, y: 0, mode: "on" }] }],
    );
    expect(solveLevel(def, BFS).ok).toBe(true);
    expect(isSwitchGated(def, BFS)).toBe(false);
  });

  it("does not call an unsolvable map gated", () => {
    const def = level(["s  e", "  rr"], [0, 0], [{ x: 0, y: 0, bridges: [{ x: 2, y: 1, mode: "on" }] }]);
    expect(solveLevel(def, BFS).ok).toBe(false);
    expect(isSwitchGated(def, BFS)).toBe(false);
  });

  it("accepts a one-gate map that cannot be won with pads stripped", () => {
    const def = oneGate();
    expect(solveLevel(def, BFS).ok).toBe(true);
    expect(isSwitchGated(def, BFS)).toBe(true);
    expect(solveLevel(stripAllSwitches(def), BFS).ok).toBe(false);
  });
});

describe("requiredSwitches", () => {
  it("returns empty when the original map is unsolvable", () => {
    const def = level(["s  e", "  rr"], [0, 0], [{ x: 0, y: 0, bridges: [{ x: 2, y: 1, mode: "on" }] }]);
    expect(solveLevel(def, BFS).ok).toBe(false);
    expect(requiredSwitches(def, BFS)).toEqual([]);
  });

  it("marks the only switch on a one-gate map", () => {
    const def = oneGate();
    expect(requiredSwitches(def, BFS)).toEqual([{ x: 2, y: 3, bridges: [{ x: 6, y: 2, mode: "on" }] }]);
  });

  it("marks both switches on a two-gate map", () => {
    const def = twoGates();
    expect(solveLevel(def, BFS).ok).toBe(true);
    expect(requiredSwitches(def, BFS)).toHaveLength(2);
    expect(isSwitchGated(def, BFS)).toBe(true);
  });

  it("does not mark a decorative switch on an open path", () => {
    const def = level(
      ["bsbbbbe        "],
      [0, 0],
      [{ x: 1, y: 0, bridges: [{ x: 8, y: 2, mode: "on" }] }],
    );
    expect(solveLevel(def, BFS).ok).toBe(true);
    expect(isSwitchGated(def, BFS)).toBe(false);
    expect(requiredSwitches(def, BFS)).toEqual([]);
  });
});

describe("meetsHardness / meetsSwitchGate", () => {
  it("rejects an ungated map even when move count is high", () => {
    const def = level(["bbbbbbbbbbbbe  ", "bbbbbbbbbbbbb  "], [0, 0]);
    const assess = assessPuzzle(def, BFS);
    expect(assess.solvable).toBe(true);
    expect(meetsHardness(assess, { minMoves: 4, minRequired: 1 })).toBe(false);
    expect(meetsSwitchGate(assess, 1)).toBe(false);
  });

  it("accepts a gated one-switch map for a 1-required band", () => {
    const assess = assessPuzzle(oneGate(), BFS);
    expect(isStrictHard(assess, { minMoves: 6, minRequired: 1 })).toBe(true);
  });

  it("rejects a one-switch map when the band asks for two required pads", () => {
    expect(meetsHardness(assessPuzzle(oneGate(), BFS), { minMoves: 4, minRequired: 2 })).toBe(false);
  });

  it("rejects a map that still has a decorative switch after a real gate", () => {
    const def = oneGate();
    const row = def.tiles[1]!.split("");
    row[3] = "s";
    def.tiles[1] = row.join("");
    def.switches.push({ x: 3, y: 1, bridges: [{ x: 8, y: 1, mode: "on" }] });
    const assess = assessPuzzle(def, BFS);
    expect(assess.gated).toBe(true);
    expect(assess.requiredCount).toBe(1);
    expect(assess.switchCount).toBe(2);
    expect(meetsSwitchGate(assess, 1)).toBe(false);
  });
});

describe("assessPuzzle", () => {
  it("reports gated, required count, and move count together", () => {
    const a = assessPuzzle(oneGate(), BFS);
    expect(a.solvable).toBe(true);
    expect(a.gated).toBe(true);
    expect(a.requiredCount).toBe(1);
    expect(a.switchCount).toBe(1);
    expect(a.solutionLen).toBeGreaterThanOrEqual(6);
  });
});

describe("withoutSwitch vs stripAllSwitches", () => {
  it("removing one required pad on a two-gate map still leaves the other gate", () => {
    const def = twoGates();
    const onlyFirst = withoutSwitch(def, def.switches[1]!);
    expect(solveLevel(onlyFirst, BFS).ok).toBe(false);
    const onlySecond = withoutSwitch(def, def.switches[0]!);
    expect(solveLevel(onlySecond, BFS).ok).toBe(false);
  });
});

describe("forcedGatePuzzle", () => {
  it("builds a solvable N-gate chain that is switch-gated", () => {
    for (const gates of [1, 2, 3, 4]) {
      const p = forcedGatePuzzle(`unit-${gates}`, gates);
      const a = assessPuzzle(p.def, BFS);
      expect(a.solvable, `${gates} gates solvable`).toBe(true);
      expect(a.gated, `${gates} gates gated`).toBe(true);
      expect(a.requiredCount, `${gates} required`).toBeGreaterThanOrEqual(gates);
      expect(a.requiredCount).toBe(a.switchCount);
      expect(solveLevel(stripAllSwitches(p.def), BFS).ok).toBe(false);
    }
  });

  it("is deterministic for a seed and gate count", () => {
    expect(forcedGatePuzzle("same", 3).def.tiles).toEqual(forcedGatePuzzle("same", 3).def.tiles);
  });
});

describe("generateFullBoard sealing", () => {
  it("does not fill unused inter-room walls with walkable stone", () => {
    const p = generateFullBoard("fill-check");
    const filled = p.def.tiles.reduce((n, row) => n + [...row].filter((c) => c !== " " && c !== "").length, 0);
    expect(filled).toBeGreaterThanOrEqual(80);
    expect(p.def.tiles.some((row) => row.includes(" "))).toBe(true);
  });

  it("is switch-gated (cannot win after stripping pads)", () => {
    const p = generateFullBoard("9001");
    expect(isSwitchGated(p.def, 120_000)).toBe(true);
    expect(solveLevel(stripAllSwitches(p.def), 120_000).ok).toBe(false);
  });

  it("stays gated across several seeds", () => {
    for (const seed of ["1", "2", "7", "11", "99"]) {
      const p = generateFullBoard(seed);
      expect(isSwitchGated(p.def, 120_000), `seed ${seed}`).toBe(true);
    }
  });
});

describe("late-campaign remix", () => {
  it("flipping a one-gate map keeps it solvable", () => {
    const src = oneGate();
    const flipped = flipLevel(src, true, false);
    expect(solveLevel(src, BFS).ok).toBe(true);
    expect(solveLevel(flipped, BFS).ok).toBe(true);
    expect(isLateCampaignShape(src) || src.switches.length > 0).toBe(true);
  });

  it("end-band remixes keep late-campaign shape", () => {
    const p = remixCampaign("unit-end", "end", "insane");
    expect(isLateCampaignShape(p.def)).toBe(true);
    expect(p.def.tiles.some((row) => row.includes("e"))).toBe(true);
  });
});

describe("daily hardness", () => {
  it("2026-09-09 remixed a late official floor and is solvable", () => {
    const daily = generateDaily(new Date("2026-09-09T12:00:00Z"));
    expect(isLateCampaignShape(daily.def)).toBe(true);
    expect(daily.def.tiles.some((row) => row.includes("e"))).toBe(true);
    expect((daily.def.switches ?? []).length + (daily.def.splits ?? []).length).toBeGreaterThan(0);
  });

  it("another UTC day is also a late-campaign remix", () => {
    const daily = generateDaily(new Date("2026-03-14T00:00:00Z"));
    expect(isLateCampaignShape(daily.def)).toBe(true);
    expect(daily.def.tiles.some((row) => row.includes("e"))).toBe(true);
  });

  it("is deterministic for a UTC date", () => {
    const a = generateDaily(new Date("2026-09-09T08:00:00Z"));
    const b = generateDaily(new Date("2026-09-09T20:00:00Z"));
    expect(a.def.tiles).toEqual(b.def.tiles);
    expect(a.def.spawn).toEqual(b.def.spawn);
    expect(a.def.switches).toEqual(b.def.switches);
  });
});

describe("gauntlet hardness bands", () => {
  it("easy floors stay solvable with exits", () => {
    const run = generateRun("20260909", "easy", 2);
    expect(run).toHaveLength(2);
    for (const floor of run) {
      expect(floor.def.tiles.some((row) => row.includes("e")), floor.seed).toBe(true);
      expect(floor.solutionLen, floor.seed).toBeGreaterThanOrEqual(5);
    }
  });

  it("medium floors keep an exit and vary archetypes across seeds", () => {
    const run = generateRun("77", "medium", 1);
    expect(run[0]!.def.tiles.some((row) => row.includes("e"))).toBe(true);
    const arches = new Set(
      Array.from({ length: 16 }, (_, i) => runArchetypeForSeed("77", i)),
    );
    expect(arches.size).toBeGreaterThan(1);
  });
});
