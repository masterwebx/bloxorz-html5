import { describe, expect, it } from "vitest";
import { billboardSupports, canBillboard, customizePreviewForceShapes, foldBillboard, spawnPaletteUsesBlockClip } from "./hud";
import { TOOL_CH } from "./isoBoard";

describe("home billboard", () => {
  it("can draw the plus on ORZ+", () => {
    expect(billboardSupports("+")).toBe(true);
    expect(billboardSupports("Z")).toBe(true);
  });

  it("folds accents so STAGE cards stay on the lamp font", () => {
    expect(foldBillboard("étape 01")).toBe("ETAPE 01");
    expect(canBillboard("STAGE 01")).toBe(true);
    expect(canBillboard("LEVEL 02")).toBe(true);
    expect(canBillboard("ステージ 01")).toBe(false);
  });
});

describe("customize colors preview", () => {
  it("mirrors Stage Creator tiles after bake (no forceShapes flats)", () => {
    expect(customizePreviewForceShapes(true)).toBe(false);
    expect(customizePreviewForceShapes(false)).toBe(true);
  });
});

describe("spawn tool palette", () => {
  it("uses the Block clip path when the library is ready", () => {
    expect(spawnPaletteUsesBlockClip(true)).toBe(true);
    expect(TOOL_CH.spawn).toBeUndefined();
  });
});
