import { describe, expect, it } from "vitest";
import { blockInsertIndex, shouldBakeFloor, shouldSkipTileSpawn, tileIsBehindBlock } from "./playPerf";

describe("dense playfield helpers", () => {
  it("bakes the floor only once a board is packed", () => {
    expect(shouldBakeFloor(12)).toBe(false);
    expect(shouldBakeFloor(30)).toBe(true);
    expect(shouldSkipTileSpawn(8)).toBe(false);
    expect(shouldSkipTileSpawn(40)).toBe(false);
    expect(shouldSkipTileSpawn(60)).toBe(true);
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
