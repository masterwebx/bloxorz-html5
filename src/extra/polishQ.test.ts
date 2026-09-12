import { describe, expect, it } from "vitest";
import {
  DIFFICULTIES,
  GAUNTLET_QUALITY,
  HARD_BFS,
  THINKING,
  assessPuzzle,
  generateAttract,
  generateRun,
  hasOffOrToggle,
  hasStartingOnBridges,
  isObviousIslandChain,
  isStrictHard,
  mechanismScore,
  meetsThinking,
  meetsThinkingDesign,
  sharedBridgeCount,
} from "./generate";

describe("isObviousIslandChain", () => {
  it("flags plain ON-only sequential gates and accepts shared/toggle layouts", () => {
    const linear = {
      id: "chain",
      code: "000000",
      tiles: [
        "               ",
        "  bbb bbb bbbe ",
        "  bbblbbblbbb  ",
        "  s     s      ",
        "               ",
        "               ",
        "               ",
        "               ",
        "               ",
        "               ",
      ],
      spawn: [2, 1] as [number, number],
      switches: [
        { x: 2, y: 3, bridges: [{ x: 5, y: 2, mode: "on" as const }] },
        { x: 8, y: 3, bridges: [{ x: 9, y: 2, mode: "on" as const }] },
      ],
      splits: [],
    };
    expect(isObviousIslandChain(linear)).toBe(true);
    expect(mechanismScore(linear)).toBeLessThan(THINKING.insane.minNovelty);

    const shared = {
      ...linear,
      switches: [
        {
          x: 2,
          y: 3,
          bridges: [
            { x: 5, y: 2, mode: "on" as const },
            { x: 9, y: 2, mode: "onoff" as const },
          ],
        },
        { x: 8, y: 3, bridges: [{ x: 9, y: 2, mode: "on" as const }] },
      ],
    };
    expect(isObviousIslandChain(shared)).toBe(false);
    expect(mechanismScore(shared)).toBeGreaterThanOrEqual(3);
  });
});

describe("attract thinking showcase", () => {
  it("ships gated non-chain puzzles with mechanism novelty", () => {
    const q = GAUNTLET_QUALITY.insane;
    for (const seed of ["BLOX", "attract-q", "soft-chain", "demo"]) {
      const p = generateAttract(seed);
      expect(p.difficulty).toBe("insane");
      const assess = assessPuzzle(p.def, Math.min(q.bfs, HARD_BFS));
      expect(assess.solvable, seed).toBe(true);
      expect(assess.gated, seed).toBe(true);
      expect(isObviousIslandChain(p.def), seed).toBe(false);
      expect(meetsThinkingDesign(p.def, "insane") || meetsThinking(p, assess, "insane"), seed).toBe(true);
      expect(mechanismScore(p.def), seed).toBeGreaterThanOrEqual(THINKING.insane.minNovelty);
      const novel =
        sharedBridgeCount(p.def) >= 1 ||
        hasStartingOnBridges(p.def) ||
        hasOffOrToggle(p.def) ||
        (p.def.splits ?? []).length > 0;
      expect(novel, seed).toBe(true);
    }
  }, 300_000);
});

describe("gauntlet thinking at all difficulties", () => {
  it("floors prefer planning signals over move-padded island chains", () => {
    for (const diff of DIFFICULTIES) {
      const q = GAUNTLET_QUALITY[diff];
      const t = THINKING[diff];
      const run = generateRun(`think-${diff}`, diff, 3);
      expect(run).toHaveLength(3);
      const fingerprints = new Set<string>();
      for (const floor of run) {
        const assess = assessPuzzle(floor.def, Math.min(q.bfs, HARD_BFS));
        expect(assess.solvable, floor.seed).toBe(true);
        expect(assess.gated, floor.seed).toBe(true);
        expect(isObviousIslandChain(floor.def), floor.seed).toBe(false);
        expect(
          isStrictHard(assess, q) || meetsThinking(floor, assess, diff),
          `${floor.seed} len=${assess.solutionLen} nov=${mechanismScore(floor.def)}`,
        ).toBe(true);
        expect(mechanismScore(floor.def), floor.seed).toBeGreaterThanOrEqual(Math.min(2, t.minNovelty));
        const modes = [...new Set((floor.def.switches ?? []).flatMap((s) => s.bridges.map((b) => b.mode)))]
          .sort()
          .join(",");
        fingerprints.add(`${(floor.def.splits ?? []).length}:${modes}:${mechanismScore(floor.def)}`);
      }
      expect(fingerprints.size, diff).toBeGreaterThanOrEqual(1);
    }
  }, 420_000);

  it("easy still fair but idea-based; insane stays deep", () => {
    const easy = generateRun("fair-easy", "easy", 2);
    for (const floor of easy) {
      const assess = assessPuzzle(floor.def, HARD_BFS);
      expect(assess.solutionLen).toBeGreaterThanOrEqual(THINKING.easy.minMoves);
      expect(meetsThinkingDesign(floor.def, "easy") || mechanismScore(floor.def) >= 2).toBe(true);
    }
    const insane = generateRun("deep-insane", "insane", 2);
    for (const floor of insane) {
      expect(mechanismScore(floor.def)).toBeGreaterThanOrEqual(THINKING.insane.minNovelty);
      expect(isObviousIslandChain(floor.def)).toBe(false);
    }
  }, 240_000);
});
