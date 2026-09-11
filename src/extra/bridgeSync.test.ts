import { describe, expect, it } from "vitest";
import { displayMoveCount, doorWalkableWhenSettled, focusedSelectIndex, syncDoorPassable } from "./bridgeSync";
import { needsBlockHueBake } from "./hue";

describe("bridge passable sync", () => {
  it("sets passable from visual state when a bridge deactivates", () => {
    const door = {
      state: false,
      passable: true,
      onChange(passable: boolean) {
        door.passable = passable;
      },
    };
    syncDoorPassable(door);
    expect(door.passable).toBe(false);
    expect(doorWalkableWhenSettled(door)).toBe(false);
  });

  it("keeps an open bridge walkable after sync", () => {
    const door = { state: true, passable: false };
    syncDoorPassable(door);
    expect(door.passable).toBe(true);
    expect(doorWalkableWhenSettled(door)).toBe(true);
  });
});

describe("seeded endless move display", () => {
  it("resets to the current stage moves when totals are not accumulated", () => {
    expect(displayMoveCount(12, 40, false)).toBe(12);
    expect(displayMoveCount(3, 99, true)).toBe(102);
  });
});

describe("split select focus", () => {
  it("tracks the actively selected block index", () => {
    expect(focusedSelectIndex(2, 0)).toBe(0);
    expect(focusedSelectIndex(2, 1)).toBe(1);
    expect(focusedSelectIndex(2, 3)).toBe(1);
    expect(focusedSelectIndex(1, 0)).toBe(0);
    expect(focusedSelectIndex(0, 0)).toBe(-1);
  });
});

describe("lazy block hue bake", () => {
  it("skips atlas work on default hue before the first bake", () => {
    expect(needsBlockHueBake(0, -1, false)).toBe(false);
    expect(needsBlockHueBake(40, -1, false)).toBe(true);
    expect(needsBlockHueBake(40, 40, true)).toBe(false);
    expect(needsBlockHueBake(0, 40, true)).toBe(true);
  });
});
