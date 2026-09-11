import { describe, expect, it } from "vitest";
import {
  cloneColorCustom,
  defaultColorCustom,
  findColorPreset,
  matchTilesToStone,
  normalizeColorPresets,
  normalizePresetName,
  removeColorPreset,
  upsertColorPreset,
} from "./colorCustom";
import { CLIP_OFFSET, pickBoardCell, boardScreen, GRID_W, GRID_H } from "./coolmathBoard";
import { finishSessionStatRows } from "./history";
import {
  collectTileFrameIndexesBySlot,
  needsTileColorBake,
  tileSlotForSpriteName,
} from "./hue";

describe("color presets", () => {
  it("normalizes names and upserts by case-insensitive key", () => {
    expect(normalizePresetName("  Neon  Glow  ")).toBe("Neon Glow");
    const base = defaultColorCustom();
    base.stone = { hex: "#112233", on: true };
    let list = upsertColorPreset([], "Neon", base);
    expect(list).toHaveLength(1);
    expect(list[0]!.colors.stone.on).toBe(true);
    const colder = cloneColorCustom(base);
    colder.stone = { hex: "#abcdef", on: true };
    list = upsertColorPreset(list, "neon", colder);
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("neon");
    expect(list[0]!.colors.stone.hex).toBe("#abcdef");
    expect(findColorPreset(list, "NEON")?.colors.stone.hex).toBe("#abcdef");
  });

  it("drops bad preset rows", () => {
    expect(normalizeColorPresets([{ name: "", colors: defaultColorCustom() }])).toEqual([]);
    const row = normalizeColorPresets([{ name: "Ok", colors: { stone: { hex: "bad", on: true } } }])[0]!;
    expect(row.name).toBe("Ok");
    expect(row.colors.stone.on).toBe(true);
    expect(row.colors.stone.hex).toBe("#d46820");
  });

  it("removes a preset and can match tiles to stone", () => {
    const base = defaultColorCustom();
    base.stone = { hex: "#445566", on: true };
    let list = upsertColorPreset([], "A", base);
    list = upsertColorPreset(list, "B", base);
    expect(removeColorPreset(list, "A")).toHaveLength(1);
    const matched = matchTilesToStone(base);
    expect(matched.exit).toEqual({ hex: "#445566", on: true });
    expect(matched.block.on).toBe(false);
  });
});

describe("finish session stat rows", () => {
  it("keeps only this run's stages within the session cap", () => {
    const rows = finishSessionStatRows(
      [
        { stage: 1, timeMs: 1, moves: 4, attempts: 1, tapes: [{ cmds: ["right"], won: true }] },
        { stage: 2, timeMs: 1, moves: 8, attempts: 2, tapes: [{ cmds: ["left"], won: true }] },
        { stage: 9, timeMs: 1, moves: 3, attempts: 1, tapes: [{ cmds: ["up"], won: true }] },
      ],
      { maxStage: 1 },
    );
    expect(rows).toEqual([{ stage: 1, moves: 4, attempts: 1 }]);
  });
});

describe("creator edge pick + bridge clip align", () => {
  it("snaps slightly out-of-bounds picks onto the rim", () => {
    const origin = boardScreen(0, 0);
    expect(pickBoardCell(origin.x - 6, origin.y - 4)).toEqual({ x: 0, y: 0 });
    const far = boardScreen(GRID_W - 1, GRID_H - 1);
    expect(pickBoardCell(far.x + 8, far.y + 6)).toEqual({ x: GRID_W - 1, y: GRID_H - 1 });
    expect(pickBoardCell(origin.x - 80, origin.y - 80)).toBeNull();
  });

  it("aligns metal_v3 / bridge fallback with stone registration", () => {
    expect(CLIP_OFFSET.metal_v3).toEqual(CLIP_OFFSET.metal_v2);
  });
});

describe("tile atlas bake helpers", () => {
  it("maps sprite names onto color slots and collects indexes", () => {
    expect(tileSlotForSpriteName("metal_v2")).toBe("stone");
    expect(tileSlotForSpriteName("bolckadoor0003")).toBe("bridgeL");
    expect(tileSlotForSpriteName("bolckadoorr0001")).toBe("bridgeR");
    const lib = {
      metal_v2: "function(){this.gotoAndStop(512)}",
      metal_v3: "function(){this.gotoAndStop(513)}",
      bolckadoor0000: "function(){this.gotoAndStop(472)}",
      blocka0000: "function(){this.gotoAndStop(10)}",
    };
    const bySlot = collectTileFrameIndexesBySlot(lib);
    expect(bySlot.stone).toEqual([512]);
    expect(bySlot.fragile).toEqual([513]);
    expect(bySlot.bridgeL).toEqual([472]);
  });

  it("needs a bake when a tile slot turns on or changes", () => {
    expect(needsTileColorBake({}, {}, false)).toBe(false);
    expect(needsTileColorBake({ stone: "#ff0000" }, {}, false)).toBe(true);
    expect(needsTileColorBake({ stone: "#ff0000" }, { stone: "#ff0000" }, true)).toBe(false);
    expect(needsTileColorBake({ stone: null }, { stone: "#ff0000" }, true)).toBe(true);
  });
});
