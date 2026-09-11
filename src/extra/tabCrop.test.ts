import { describe, expect, it } from "vitest";
import {
  GAME_ASPECT,
  containLayout,
  coverCropLayout,
  cropFromDrag,
  cropToOverlayRect,
  gameNormAspect,
  normalizeTabCrop,
} from "./tabCrop";

describe("tabCrop cover layout", () => {
  it("uses uniform scale so crop fills the game screen without stretch", () => {
    const crop = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 };
    const layout = coverCropLayout(crop, 1920, 1080, 550, 300);
    // Video element keeps source aspect (uniform scale).
    expect(layout.width / layout.height).toBeCloseTo(1920 / 1080, 5);
    // Crop region covers the container (cover ≥ both axes).
    const scale = layout.width / 1920;
    expect(0.5 * 1920 * scale).toBeGreaterThanOrEqual(550 - 0.5);
    expect(0.5 * 1080 * scale).toBeGreaterThanOrEqual(300 - 0.5);
  });

  it("centers a matching-aspect crop flush with the game screen", () => {
    const vw = 1920;
    const vh = 1080;
    const cw = 550;
    const ch = 300;
    const aspect = gameNormAspect(vw, vh);
    const w = 0.4;
    const h = w / aspect;
    const crop = normalizeTabCrop({ x: 0.2, y: 0.2, w, h });
    const layout = coverCropLayout(crop, vw, vh, cw, ch);
    const scale = layout.width / vw;
    // Aspects match → cover scale equals both axes; crop maps flush.
    expect(crop.w * vw * scale).toBeCloseTo(cw, 5);
    expect(crop.h * vh * scale).toBeCloseTo(ch, 5);
    expect(layout.left).toBeCloseTo(-crop.x * vw * scale, 5);
    expect(layout.top).toBeCloseTo(-crop.y * vh * scale, 5);
  });
});

describe("tabCrop drag selection", () => {
  it("locks drag rect to the game screen aspect in source space", () => {
    const vw = 1920;
    const vh = 1080;
    const cw = 550;
    const ch = 300;
    const layout = containLayout(vw, vh, cw, ch);
    const x0 = layout.offsetX + layout.displayW * 0.2;
    const y0 = layout.offsetY + layout.displayH * 0.2;
    const x1 = layout.offsetX + layout.displayW * 0.6;
    const y1 = layout.offsetY + layout.displayH * 0.35; // shallower drag
    const crop = cropFromDrag({ x0, y0, x1, y1, vw, vh, cw, ch });
    expect(crop.w / crop.h).toBeCloseTo(gameNormAspect(vw, vh), 5);
    expect(crop.w / crop.h).toBeCloseTo((GAME_ASPECT * vh) / vw, 5);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.w).toBeLessThanOrEqual(1 + 1e-9);
    expect(crop.y + crop.h).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("maps crop back to overlay pixels inside the letterbox", () => {
    const crop = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
    const rect = cropToOverlayRect(crop, 1000, 1000, 400, 200);
    const layout = containLayout(1000, 1000, 400, 200);
    expect(rect.left).toBeCloseTo(layout.offsetX + 0.25 * layout.displayW, 5);
    expect(rect.width).toBeCloseTo(0.5 * layout.displayW, 5);
  });
});
