import { describe, expect, it } from "vitest";
import {
  billboardSupports,
  canBillboard,
  customizePreviewForceShapes,
  foldBillboard,
  FONT,
  neonTitleMode,
  spawnPaletteUsesBlockClip,
} from "./hud";
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

  it("keeps English STAGE 01 on LED billboard lamps", () => {
    expect(neonTitleMode("STAGE 01")).toBe("billboard");
    expect(neonTitleMode("LEVEL 02")).toBe("billboard");
    expect(neonTitleMode("ETAPE 01")).toBe("billboard");
    expect(neonTitleMode("FASE 03")).toBe("billboard");
  });

  it("falls back to Orbitron neon when lamps cannot spell the locale", () => {
    expect(FONT).toMatch(/Orbitron/);
    expect(neonTitleMode("ステージ 01")).toBe("orbitron");
    expect(neonTitleMode("스테이지 01")).toBe("orbitron");
    expect(neonTitleMode("第 01 关")).toBe("orbitron");
    expect(neonTitleMode("ЭТАП 01")).toBe("orbitron");
    expect(neonTitleMode("المرحلة 01")).toBe("orbitron");
    expect(neonTitleMode("चरण 01")).toBe("orbitron");
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
