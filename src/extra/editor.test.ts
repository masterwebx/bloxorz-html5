import { describe, expect, it } from "vitest";
import { occupiedCells } from "./coolmathBoard";
import { emptyDraft, encodeLevel, decodeLevel, encodeSeed, decodeSeed, isPlayable, occupiedTileCount, parseShare, setTile, shareFromLocation, stageId } from "./customLevels";
import type { LevelDef } from "./types";
import { beatBadge, checkBeatable, newPaintState, paintEditorCell } from "./editor";
import { Stage } from "./engine";
import { playScript, solveLevel } from "./solve";

function countChar(def: ReturnType<typeof emptyDraft>, ch: string): number {
  return [...def.tiles.join("")].filter((c) => c === ch).length;
}

describe("stage creator switch tool", () => {
  it("places a soft switch then arms the link tool", () => {
    const def = emptyDraft();
    const state = newPaintState("soft");
    paintEditorCell(def, 3, 4, state);
    expect(def.tiles[4][3]).toBe("s");
    expect(state.tool).toBe("link");
    expect(state.linkFrom).toEqual({ x: 3, y: 4 });
    setTile(def, 6, 4, "l");
    paintEditorCell(def, 6, 4, state);
    expect(def.switches).toEqual([{ x: 3, y: 4, bridges: [{ x: 6, y: 4, mode: "onoff" }] }]);
  });
});

describe("stage creator split paint", () => {
  it("records cube destinations instead of painting extra split pads", () => {
    const def = emptyDraft();
    const state = newPaintState("split");
    paintEditorCell(def, 4, 4, state);
    expect(def.tiles[4][4]).toBe("v");
    expect(state.splitStep).toBe(1);
    paintEditorCell(def, 3, 4, state);
    expect(def.tiles[4][3]).toBe("b");
    expect(state.splitStep).toBe(2);
    paintEditorCell(def, 5, 4, state);
    expect(def.tiles[4][5]).toBe("b");
    expect(countChar(def, "v")).toBe(1);
    expect(def.splits).toEqual([{ x: 4, y: 4, a: [3, 4], b: [5, 4] }]);
    const stage = new Stage(def);
    stage.block = { x: 4, y: 4, ori: "up" };
    stage.beginSplit();
    expect(stage.split).toBe(true);
    expect(stage.cubeA).toEqual({ x: 3, y: 4 });
    expect(stage.cubeB).toEqual({ x: 5, y: 4 });
  });

  it("clears split data when the pad is overwritten", () => {
    const def = emptyDraft();
    const state = newPaintState("split");
    paintEditorCell(def, 4, 4, state);
    paintEditorCell(def, 3, 4, state);
    paintEditorCell(def, 5, 4, state);
    expect(def.splits).toHaveLength(1);
    setTile(def, 4, 4, "b");
    expect(def.splits).toEqual([]);
    expect(def.tiles[4][4]).toBe("b");
  });
});

describe("new stage starter path", () => {
  it("paints a full stone path plus an exit, not a single tile", () => {
    const cells = occupiedCells(emptyDraft().tiles);
    expect(cells.length).toBeGreaterThanOrEqual(7);
    expect(cells.filter((c) => c.ch === "b").length).toBeGreaterThanOrEqual(6);
    expect(cells.filter((c) => c.ch === "e")).toHaveLength(1);
    expect(new Set(cells.map((c) => c.y)).size).toBe(1);
    const xs = cells.map((c) => c.x).sort((a, b) => a - b);
    expect(xs[xs.length - 1] - xs[0]).toBe(xs.length - 1);
  });
});

describe("editor beatability", () => {
  it("marks the starter path as beatable right away", () => {
    expect(checkBeatable(emptyDraft())).toBe(true);
    expect(beatBadge(emptyDraft(), null)).toBe("CAN BE BEAT");
    expect(beatBadge(emptyDraft(), isPlayable(emptyDraft()))).toBe("CAN BE BEAT");
    expect(beatBadge(emptyDraft(), isPlayable(emptyDraft()))).not.toBe("Checking…");
    expect(playScript(emptyDraft(), "Rx4").result).toBe("win");
  });

  it("shows IMPOSSIBLE immediately for a disconnected hole", () => {
    const def = emptyDraft();
    def.tiles[4] = "  b      e    ";
    expect(beatBadge(def, null)).toBe("IMPOSSIBLE");
  });

  it("marks a disconnected hole as impossible", () => {
    const def = emptyDraft();
    def.tiles[4] = "  b      e    ";
    expect(checkBeatable(def)).toBe(false);
  });
});

describe("reverse seeds", () => {
  it("is stable for the same layout", () => {
    const a = emptyDraft();
    const b = emptyDraft();
    expect(stageId(a)).toMatch(/^BXS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    expect(stageId(a)).toBe(stageId(b));
  });

  it("round-trips through the compact BXS seed", () => {
    const def = emptyDraft();
    def.switches = [{ x: 2, y: 4, bridges: [{ x: 6, y: 4, mode: "onoff" }] }];
    def.splits = [{ x: 4, y: 4, a: [3, 4], b: [5, 4] }];
    setTile(def, 4, 4, "v");
    const seed = encodeSeed(def);
    expect(seed.startsWith("BXS.")).toBe(true);
    expect(seed.length).toBeLessThan(80);
    const back = decodeSeed(seed);
    expect(back?.tiles).toEqual(def.tiles);
    expect(back?.spawn).toEqual(def.spawn);
    expect(back?.switches).toEqual(def.switches);
    expect(back?.splits).toEqual(def.splits);
    expect(parseShare(seed)?.tiles).toEqual(def.tiles);
  });

  it("round-trips a 150-tile board and the reported reverse seed", () => {
    const tiles = Array.from({ length: 10 }, () => "bbbbbbbbbbbbbbb");
    tiles[9] = "bbbbbbbbbbbbbbe";
    const packed: LevelDef = {
      id: "custom",
      code: "000000",
      tiles,
      spawn: [0, 0],
      switches: [{ x: 1, y: 0, bridges: [{ x: 2, y: 0, mode: "on" }] }],
      splits: [],
    };
    const seed = encodeSeed(packed);
    expect(seed.length).toBeLessThan(200);
    const back = decodeSeed(seed);
    expect(back?.tiles).toEqual(tiles);
    expect(back?.spawn).toEqual([0, 0]);
    expect(back?.switches).toEqual(packed.switches);

    const reported =
      "BXS.AksAAQEBAgEDAQQBBQEGCAcICAgJCAoBCwEMAQ0BDwEQAREBEgETARQBFQEWARcBGAgZCBoIGwgcAh4BHwEgASEBIgEjAS0BLgEvATABMQEyATwBPQE-AT8BQAFBAUsBTAFNAU4BTwFQAVoBWwFcAV0BXgRfAWkBagFrAWwBbQFuAXgBeQF6AXsBfAF9AYgBiQGKAYsBjAE-AV4IBgEHAQgACQIYABkAGgAbAAA";
    const fromPaste = decodeSeed(reported);
    expect(fromPaste).not.toBeNull();
    expect(fromPaste?.tiles[0]).toBe("bbbbbbllllbbbb ");
    expect(fromPaste?.tiles[1]).toBe("bbbbbbbbblllle ");
    expect(fromPaste?.spawn).toEqual([2, 4]);
    expect(fromPaste?.switches).toHaveLength(1);
    expect(fromPaste?.switches[0]?.bridges).toHaveLength(8);
    const again = encodeSeed(fromPaste!);
    expect(again.length).toBeLessThan(reported.length);
    const loop = decodeSeed(again);
    expect(loop?.tiles).toEqual(fromPaste?.tiles);
    expect(loop?.spawn).toEqual(fromPaste?.spawn);
    expect(loop?.switches).toEqual(fromPaste?.switches);
    expect(loop?.splits).toEqual(fromPaste?.splits);
    expect(parseShare(reported)?.tiles).toEqual(fromPaste?.tiles);
    expect(decodeSeed(reported.slice(0, 160))).toBeNull();
    expect(decodeSeed(reported.slice(0, 80))).toBeNull();
    expect(occupiedTileCount(fromPaste!)).toBe(75);
    expect(shareFromLocation(`?code=${reported}`, "")).toBe(reported);
    expect(parseShare(shareFromLocation("", `#${reported}`))?.tiles).toEqual(fromPaste?.tiles);
  });

  it("keeps BX1 share codes working and tags them with the short id", () => {
    const def = emptyDraft();
    const code = encodeLevel(def);
    expect(code.startsWith("BX1.")).toBe(true);
    const back = decodeLevel(code);
    expect(back?.tiles).toEqual(def.tiles);
    expect(stageId(back!)).toBe(stageId(def));
  });

  it("beats any playable draft with BFS, not a canned route", () => {
    const def = emptyDraft();
    const solved = solveLevel(def, 80_000);
    expect(solved.ok).toBe(true);
    expect(solved.cmds.length).toBeGreaterThan(0);
  });

  it("lets the solver beat a custom split stage after destinations are set", () => {
    const def = emptyDraft();
    const state = newPaintState("split");
    paintEditorCell(def, 4, 4, state);
    paintEditorCell(def, 3, 4, state);
    paintEditorCell(def, 5, 4, state);
    expect(solveLevel(def, 80_000).ok).toBe(true);
  });
});
