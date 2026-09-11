import { describe, expect, it } from "vitest";
import {
  blockInsertIndex,
  shouldBakeFloor,
  shouldSkipTileSpawn,
  TILE_SPAWN_LABEL_FRAME,
  tileIdleFrame,
  tileIsBehindBlock,
} from "./playPerf";

describe("dense playfield helpers", () => {
  it("bakes the floor only once a board is packed", () => {
    expect(shouldBakeFloor(12)).toBe(false);
    expect(shouldBakeFloor(24)).toBe(true);
    expect(shouldSkipTileSpawn(8)).toBe(false);
    expect(shouldSkipTileSpawn(39)).toBe(false);
    expect(shouldSkipTileSpawn(40)).toBe(true);
  });

  it("rests switches on the idle frame, not the empty spawn label", () => {
    expect(tileIdleFrame("s")).toBe(69);
    expect(tileIdleFrame("h")).toBe(92);
    expect(tileIdleFrame("v")).toBe(159);
    expect(tileIdleFrame("s")).not.toBe(TILE_SPAWN_LABEL_FRAME.s);
    expect(tileIdleFrame("h")).not.toBe(TILE_SPAWN_LABEL_FRAME.h);
    expect(tileIdleFrame("v")).not.toBe(TILE_SPAWN_LABEL_FRAME.v);
    expect(tileIdleFrame("k", true)).toBe(39);
    expect(tileIdleFrame("l", false)).toBe(32);
  });

  it("treats north-east tiles as behind the block in iso space", () => {
    expect(tileIsBehindBlock(4, 3, 3, 3)).toBe(true);
    expect(tileIsBehindBlock(2, 4, 3, 3)).toBe(false);
  });

  it("inserts the block before the first front tile instead of restacking the board", () => {
    const tiles = [
      { x: 4, y: 2, index: 0 },
      { x: 3, y: 3, index: 1 },
      { x: 2, y: 4, index: 2 },
    ];
    expect(blockInsertIndex(tiles, 3, 3, 3)).toBe(2);
  });
});
