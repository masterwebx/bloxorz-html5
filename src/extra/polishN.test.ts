import { describe, expect, it } from "vitest";
import {
  defaultColorCustom,
  matchTilesToStone,
  removeColorPreset,
  STONE_MATCH_SLOTS,
  upsertColorPreset,
} from "./colorCustom";
import {
  ATTRACT_ARCHETYPES,
  attractArchetypeForSeed,
  GAUNTLET_QUALITY,
  generateAttract,
  generateRun,
  runArchetypeForSeed,
} from "./generate";
import { spawnPaletteUsesBlockClip } from "./hud";
import { TOOL_CH } from "./isoBoard";
import { solveLevel } from "./solve";

describe("spawn palette Block clip", () => {
  it("prefers the live Block clip when available", () => {
    expect(spawnPaletteUsesBlockClip(true)).toBe(true);
    expect(spawnPaletteUsesBlockClip(false)).toBe(false);
  });

  it("does not map spawn to a stone tile char", () => {
    expect(TOOL_CH.spawn).toBeUndefined();
  });
});

describe("attract insane gauntlet quality", () => {
  it("keeps archetype rotation across seeds", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 64; i++) seen.add(attractArchetypeForSeed(`polish-n-attract-${i}`));
    expect(seen.size).toBe(ATTRACT_ARCHETYPES.length);
  });

  it("builds an insane solvable attract stage", () => {
    const p = generateAttract("polish-n-attract-1");
    expect(p.difficulty).toBe("insane");
    const solved = solveLevel(p.def, GAUNTLET_QUALITY.insane.bfs);
    expect(solved.ok).toBe(true);
    expect(solved.cmds.length).toBeGreaterThan(0);
  });
});

describe("gauntlet archetype variety", () => {
  it("rotates run archetypes by floor index", () => {
    const seen = new Set(ATTRACT_ARCHETYPES.map((_, i) => runArchetypeForSeed("gauntlet-rot", i)));
    for (let i = 0; i < 48; i++) seen.add(runArchetypeForSeed(`gauntlet-probe-${i % 7}`, i));
    expect(seen.size).toBe(ATTRACT_ARCHETYPES.length);
  });

  it("generateRun floors stay unique and exit-bearing", () => {
    const run = generateRun("polish-n-run", "easy", 4);
    expect(run).toHaveLength(4);
    const keys = new Set(run.map((p) => p.def.tiles.join("")));
    expect(keys.size).toBe(4);
    for (const floor of run) {
      expect(floor.def.tiles.some((row) => row.includes("e"))).toBe(true);
      expect(floor.difficulty).toBe("easy");
    }
  });
});

describe("tiles match stone + preset remove", () => {
  it("copies stone onto every tile slot and leaves bg/block alone", () => {
    const base = defaultColorCustom();
    base.stone = { hex: "#112233", on: true };
    base.block = { hex: "#abcdef", on: true };
    base.bg = { hex: "#fedcba", on: false };
    base.exit = { hex: "#000000", on: false };
    const next = matchTilesToStone(base);
    expect(next.bg).toEqual(base.bg);
    expect(next.block).toEqual(base.block);
    expect(next.stone).toEqual(base.stone);
    for (const id of STONE_MATCH_SLOTS) {
      expect(next[id]).toEqual({ hex: "#112233", on: true });
    }
  });

  it("removes presets by case-insensitive name", () => {
    const colors = defaultColorCustom();
    let list = upsertColorPreset([], "Neon", colors);
    list = upsertColorPreset(list, "Cool", colors);
    list = removeColorPreset(list, "neon");
    expect(list.map((row) => row.name)).toEqual(["Cool"]);
  });
});
