import { describe, expect, it } from "vitest";
import { occupiedCells } from "./coolmathBoard";
import { emptyDraft, encodeLevel, decodeLevel, encodeSeed, decodeSeed, parseShare, setTile, stageId } from "./customLevels";
import { checkBeatable, newPaintState, paintEditorCell } from "./editor";
import { Stage } from "./engine";
import { playScript, solveLevel } from "./solve";

function countChar(def: ReturnType<typeof emptyDraft>, ch: string): number {
  return [...def.tiles.join("")].filter((c) => c === ch).length;
}

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
  it("marks the starter path as beatable", () => {
    expect(checkBeatable(emptyDraft())).toBe(true);
    expect(playScript(emptyDraft(), "Rx4").result).toBe("win");
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
