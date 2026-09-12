import { describe, expect, it } from "vitest";
import {
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
  it("maps drag rect 1:1 in source space without aspect lock", () => {
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
    expect(crop.x).toBeCloseTo(0.2, 5);
    expect(crop.y).toBeCloseTo(0.2, 5);
    expect(crop.w).toBeCloseTo(0.4, 5);
    expect(crop.h).toBeCloseTo(0.15, 5);
    // Not forced to game aspect.
    expect(crop.w / crop.h).not.toBeCloseTo(gameNormAspect(vw, vh), 2);
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

  it("round-trips drag → overlay so preview matches selection", () => {
    const vw = 1280;
    const vh = 720;
    const cw = 550;
    const ch = 300;
    const layout = containLayout(vw, vh, cw, ch);
    const x0 = layout.offsetX + layout.displayW * 0.1;
    const y0 = layout.offsetY + layout.displayH * 0.15;
    const x1 = layout.offsetX + layout.displayW * 0.7;
    const y1 = layout.offsetY + layout.displayH * 0.8;
    const crop = cropFromDrag({ x0, y0, x1, y1, vw, vh, cw, ch });
    const rect = cropToOverlayRect(crop, vw, vh, cw, ch);
    expect(rect.left).toBeCloseTo(Math.min(x0, x1), 4);
    expect(rect.top).toBeCloseTo(Math.min(y0, y1), 4);
    expect(rect.width).toBeCloseTo(Math.abs(x1 - x0), 4);
    expect(rect.height).toBeCloseTo(Math.abs(y1 - y0), 4);
  });
});
