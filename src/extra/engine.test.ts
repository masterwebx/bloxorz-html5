import { describe, expect, it } from "vitest";
import {
  H,
  LEVELS,
  Stage,
  W,
  levelByCode,
  nextBridge,
  occupied,
  parseLevel,
  rolled,
  type BlockState,
} from "./engine";
import type { LevelDef } from "./levels";
import { brandName, isDevName } from "./settings";

/** AS2 `levelcodes` array, stage 01 → 33. */
const AS2_CODES = [
  "780464",
  "290299",
  "918660",
  "520967",
  "028431",
  "524383",
  "189493",
  "499707",
  "074355",
  "300590",
  "291709",
  "958640",
  "448106",
  "210362",
  "098598",
  "000241",
  "683596",
  "284933",
  "119785",
  "543019",
  "728724",
  "987319",
  "293486",
  "088198",
  "250453",
  "426329",
  "660141",
  "769721",
  "691859",
  "280351",
  "138620",
  "879021",
  "614955",
];

function mini(
  tiles: string[],
  spawn: [number, number] = [1, 1],
  extra: Partial<LevelDef> = {},
): LevelDef {
  const rows = [...tiles];
  while (rows.length < H) rows.push("               ");
  return {
    id: "t",
    code: "000000",
    tiles: rows.map((r) => (r + "               ").slice(0, W)),
    spawn,
    switches: [],
    splits: [],
    ...extra,
  };
}

function finish(stage: Stage) {
  const result = stage.finishMove(() => undefined);
  stage.anim = null;
  return result;
}

function play(stage: Stage, dir: "up" | "down" | "left" | "right") {
  stage.anim = null;
  expect(stage.tryMove(dir)).toBe(true);
  return finish(stage);
}

describe("AS2 campaign data", () => {
  it("ships all 33 original stages", () => {
    expect(LEVELS).toHaveLength(33);
  });

  it("matches the AS2 levelcodes table in order", () => {
    expect(LEVELS.map((l) => l.code)).toEqual(AS2_CODES);
  });

  it("looks up every passcode", () => {
    AS2_CODES.forEach((code, i) => expect(levelByCode(code)).toBe(i));
    expect(levelByCode("999999")).toBe(-1);
  });
});

describe("rolling 1×1×2 block", () => {
  const up: BlockState = { x: 5, y: 5, ori: "up" };
  const fwd: BlockState = { x: 5, y: 5, ori: "forward" };
  const right: BlockState = { x: 5, y: 5, ori: "right" };

  it("occupies one cell standing and two cells lying", () => {
    expect(occupied(up)).toEqual([{ x: 5, y: 5 }]);
    expect(occupied(fwd)).toEqual([
      { x: 5, y: 5 },
      { x: 5, y: 6 },
    ]);
    expect(occupied(right)).toEqual([
      { x: 5, y: 5 },
      { x: 6, y: 5 },
    ]);
  });

  it("rolls through standing and both lying orientations", () => {
    expect(rolled(up, "right")).toEqual({ x: 6, y: 5, ori: "right" });
    expect(rolled({ x: 6, y: 5, ori: "right" }, "right")).toEqual({ x: 8, y: 5, ori: "up" });
    expect(rolled({ x: 6, y: 5, ori: "right" }, "left")).toEqual({ x: 5, y: 5, ori: "up" });
    expect(rolled(up, "down")).toEqual({ x: 5, y: 6, ori: "forward" });
    expect(rolled(fwd, "down")).toEqual({ x: 5, y: 7, ori: "up" });
    expect(rolled(fwd, "up")).toEqual({ x: 5, y: 4, ori: "up" });
  });
});

describe("win / fail / orange tiles", () => {
  it("wins when rolling upright into the hole", () => {
    const def = mini(["bbbeh"], [0, 0]);
    const stage = new Stage(def);
    expect(play(stage, "right")).toBe("ok");
    expect(play(stage, "right")).toBe("win");
  });

  it("does not win when lying across the hole", () => {
    const def = mini(["bebbb"], [3, 0]);
    const stage = new Stage(def);
    expect(play(stage, "left")).toBe("ok");
    expect(stage.won).toBe(false);
    expect(stage.block.ori).toBe("right");
  });

  it("fails when any occupied cell is empty", () => {
    const def = mini(["bbb"], [1, 0]);
    const stage = new Stage(def);
    expect(play(stage, "up")).toBe("fail");
  });

  it("falls through an orange tile when standing", () => {
    const def = mini(["bbbf"], [0, 0]);
    const stage = new Stage(def);
    expect(play(stage, "right")).toBe("ok");
    expect(play(stage, "right")).toBe("fail");
  });

  it("can lie across orange tiles", () => {
    const def = mini(["fff"], [0, 0]);
    const stage = new Stage(def);
    expect(play(stage, "right")).toBe("ok");
  });
});

describe("bridges and switches", () => {
  it("starts L/R bridges off and K/Q bridges on", () => {
    const parsed = parseLevel(mini(["lrkq"]));
    expect(parsed.bridges.map((b) => b.on)).toEqual([false, false, true, true]);
  });

  it("cycles toggle / open-only / close-only modes", () => {
    expect(nextBridge(false, "onoff")).toBe(true);
    expect(nextBridge(true, "onoff")).toBe(false);
    expect(nextBridge(false, "on")).toBe(true);
    expect(nextBridge(true, "on")).toBe(true);
    expect(nextBridge(true, "off")).toBe(false);
    expect(nextBridge(false, "off")).toBe(false);
  });

  it("lets a soft switch toggle a bridge from a lying block", () => {
    const def = mini(["sbbbl"], [2, 0], {
      switches: [{ x: 0, y: 0, bridges: [{ x: 4, y: 0, mode: "onoff" }] }],
    });
    const stage = new Stage(def);
    expect(stage.bridgeAt(4, 0)?.on).toBe(false);
    expect(play(stage, "left")).toBe("ok");
    expect(stage.block.ori).toBe("right");
    expect(stage.bridgeAt(4, 0)?.on).toBe(true);
  });

  it("requires a standing block for a heavy switch", () => {
    const def = mini(["hbbbl"], [3, 0], {
      switches: [{ x: 0, y: 0, bridges: [{ x: 4, y: 0, mode: "onoff" }] }],
    });
    const lying = new Stage(def);
    expect(play(lying, "left")).toBe("ok");
    expect(lying.block.ori).toBe("right");
    expect(lying.bridgeAt(4, 0)?.on).toBe(false);

    const stand = new Stage(def);
    expect(play(stand, "left")).toBe("ok");
    expect(play(stand, "left")).toBe("ok");
    expect(stand.block.ori).toBe("up");
    expect(stand.block.x).toBe(0);
    expect(stand.bridgeAt(4, 0)?.on).toBe(true);
  });
});

describe("split cubes", () => {
  it("splits on the teleport pad and rejoins when adjacent", () => {
    const def = mini(["vbbb"], [0, 0], {
      splits: [{ x: 0, y: 0, a: [1, 0], b: [3, 0] }],
    });
    const stage = new Stage(def);
    stage.beginSplit();
    stage.anim = null;
    expect(stage.split).toBe(true);
    expect(stage.cubeA).toEqual({ x: 1, y: 0 });
    expect(stage.cubeB).toEqual({ x: 3, y: 0 });
    expect(play(stage, "right")).toBe("ok");
    expect(stage.split).toBe(false);
    expect(stage.block.ori).toBe("right");
  });

  it("swaps which cube is controlled", () => {
    const def = mini(["vbbb"], [0, 0], {
      splits: [{ x: 0, y: 0, a: [1, 0], b: [3, 0] }],
    });
    const stage = new Stage(def);
    stage.beginSplit();
    stage.anim = null;
    expect(stage.active).toBe(0);
    stage.swapSplit();
    expect(stage.active).toBe(1);
    stage.swapSplit();
    expect(stage.active).toBe(0);
  });

  it("fails if the active cube steps off the map", () => {
    const def = mini(["vbbb"], [0, 0], {
      splits: [{ x: 0, y: 0, a: [0, 0], b: [2, 0] }],
    });
    const stage = new Stage(def);
    stage.beginSplit();
    stage.anim = null;
    expect(play(stage, "up")).toBe("fail");
  });
});

describe("DEV unlock", () => {
  it("unlocks only when the player name is DEV", () => {
    expect(isDevName("DEV")).toBe(true);
    expect(isDevName("dev")).toBe(true);
    expect(isDevName(" Dev ")).toBe(true);
    expect(isDevName("Wex")).toBe(false);
    expect(brandName("DEV")).toBe("DEVORZ");
  });
});
