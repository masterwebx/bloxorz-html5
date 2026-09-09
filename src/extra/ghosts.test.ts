import { describe, expect, it } from "vitest";
import { Stage } from "./engine";
import { ghostFootprints, ghostScreenPos } from "./ghosts";
import type { LevelDef } from "./types";

function mini(tiles: string[], spawn: [number, number] = [0, 0]): LevelDef {
  const rows = [...tiles];
  while (rows.length < 10) rows.push("               ");
  return {
    id: "g",
    code: "000000",
    tiles: rows.map((r) => (r + "               ").slice(0, 15)),
    spawn,
    switches: [],
    splits: [],
  };
}

describe("ghost footprints", () => {
  it("uses the standing cell for an idle upright block", () => {
    const stage = new Stage(mini(["bbbe"], [0, 0]));
    expect(ghostFootprints(stage)).toEqual([{ x: 0, y: 0 }]);
  });

  it("projects a cell onto the Coolmath playfield", () => {
    expect(ghostScreenPos({ x: 0, y: 0 })).toEqual({ x: 30, y: 130 });
    expect(ghostScreenPos({ x: 2, y: 1 }).x).toBeGreaterThan(30);
  });
});
