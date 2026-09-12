import { describe, expect, it } from "vitest";
import { LEVELS } from "./engine";
import {
  GAUNTLET_QUALITY,
  HARD_BFS,
  INSANE_THINKING,
  assessPuzzle,
  generateAttract,
  generateRun,
  hasOffOrToggle,
  hasStartingOnBridges,
  isStrictHard,
  mechanismScore,
  meetsInsaneDesign,
  meetsInsaneThinking,
  sharedBridgeCount,
  tryArchetypePuzzle,
} from "./generate";

describe("mechanismScore / insane design", () => {
  it("scores official end-campaign floors as highly novel", () => {
    for (let i = 28; i <= 32; i++) {
      const score = mechanismScore(LEVELS[i]!);
      expect(score, `level ${i}`).toBeGreaterThanOrEqual(4);
      expect(meetsInsaneDesign(LEVELS[i]!)).toBe(true);
    }
  });

  it("scores a plain ON-only one-gate corridor below the insane bar", () => {
    const def = {
      id: "linear",
      code: "000000",
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
      spawn: [2, 1] as [number, number],
      switches: [{ x: 2, y: 3, bridges: [{ x: 6, y: 2, mode: "on" as const }] }],
      splits: [],
    };
    expect(mechanismScore(def)).toBeLessThan(4);
    expect(meetsInsaneDesign(def)).toBe(false);
  });
});

describe("insane attract novelty", () => {
  it("ships thinking or full-quality insane puzzles for showcase seeds", () => {
    const q = GAUNTLET_QUALITY.insane;
    for (const seed of ["BLOX", "attract-a", "polish-n-attract-1", "soft", "demo"]) {
      const p = generateAttract(seed);
      expect(p.difficulty).toBe("insane");
      const assess = assessPuzzle(p.def, Math.min(q.bfs, HARD_BFS));
      expect(assess.solvable, seed).toBe(true);
      expect(assess.gated, seed).toBe(true);
      expect(assess.requiredCount, seed).toBeGreaterThanOrEqual(q.minRequired);
      expect(assess.requiredCount, seed).toBe(assess.switchCount);
      expect(
        isStrictHard(assess, q) || meetsInsaneThinking(p, assess),
        `${seed} len=${assess.solutionLen} novelty=${mechanismScore(p.def)}`,
      ).toBe(true);
      expect(meetsInsaneDesign(p.def), seed).toBe(true);
      expect(mechanismScore(p.def), seed).toBeGreaterThanOrEqual(INSANE_THINKING.minNovelty);
      expect(assess.solutionLen, seed).toBeGreaterThanOrEqual(INSANE_THINKING.minMoves);
    }
  }, 300_000);

  it("strict archetype tries honor minNovelty (ribbon soft stays null when strict)", () => {
    const strict = tryArchetypePuzzle("polish-p-ribbon", "ribbon", "insane", GAUNTLET_QUALITY.insane, 3, {
      strictQuality: true,
      minNovelty: 4,
    });
    if (strict) {
      expect(meetsInsaneDesign(strict.def)).toBe(true);
      const assess = assessPuzzle(strict.def, HARD_BFS);
      expect(isStrictHard(assess, GAUNTLET_QUALITY.insane) || meetsInsaneThinking(strict, assess)).toBe(true);
    } else {
      expect(strict).toBeNull();
    }
  });
});

describe("insane gauntlet novelty", () => {
  it("floors meet thinking/quality gates and mechanism novelty across seeds", () => {
    const q = GAUNTLET_QUALITY.insane;
    for (const seed of ["test", "gauntlet", "20260911"]) {
      const run = generateRun(seed, "insane", 5);
      expect(run).toHaveLength(5);
      const keys = new Set<string>();
      let thinkingOrRemix = 0;
      for (const floor of run) {
        const assess = assessPuzzle(floor.def, Math.min(q.bfs, HARD_BFS));
        expect(assess.solutionLen, floor.seed).toBeGreaterThanOrEqual(INSANE_THINKING.minMoves);
        expect(assess.gated, floor.seed).toBe(true);
        expect(assess.requiredCount, floor.seed).toBeGreaterThanOrEqual(q.minRequired);
        expect(assess.requiredCount, floor.seed).toBe(assess.switchCount);
        expect(isStrictHard(assess, q) || meetsInsaneThinking(floor, assess), floor.seed).toBe(true);
        expect(meetsInsaneDesign(floor.def), floor.seed).toBe(true);
        const novel =
          sharedBridgeCount(floor.def) >= 1 ||
          hasStartingOnBridges(floor.def) ||
          hasOffOrToggle(floor.def) ||
          (floor.def.splits ?? []).length > 0;
        expect(novel, floor.seed).toBe(true);
        keys.add(floor.def.tiles.join(""));
        if (meetsInsaneThinking(floor, assess)) thinkingOrRemix++;
      }
      expect(keys.size, seed).toBe(5);
      expect(thinkingOrRemix, seed).toBeGreaterThan(0);
    }
  }, 360_000);

  it("prefers enriched generative floors over only flipped level-28/29 pairs", () => {
    const run = generateRun("variety-probe", "insane", 8);
    const fingerprints = new Set(
      run.map((p) => {
        const modes = [...new Set((p.def.switches ?? []).flatMap((s) => s.bridges.map((b) => b.mode)))]
          .sort()
          .join(",");
        return `${(p.def.splits ?? []).length}:${modes}:${mechanismScore(p.def)}`;
      }),
    );
    // At least two distinct mechanism fingerprints across 8 floors.
    expect(fingerprints.size).toBeGreaterThanOrEqual(2);
  }, 300_000);
});
