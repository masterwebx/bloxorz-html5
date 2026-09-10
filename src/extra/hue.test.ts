import { describe, expect, it } from "vitest";
import {
  atlasHueFilter,
  bakeFrameBackup,
  bakeHueIntoPixels,
  blitHueRects,
  collectBlockFrameIndexes,
  hueDelta,
  hueRotateRgb,
  isBlockSpriteName,
  makeImageData,
  rustFaces,
  shiftingHue,
  clipHueAction,
} from "./hue";

describe("block hue bake", () => {
  it("leaves rust unchanged at hue 0", () => {
    expect(hueRotateRgb(196, 104, 32, 0)).toEqual([196, 104, 32]);
  });

  it("shifts rust off the orange band at 180", () => {
    const [r, , b] = hueRotateRgb(196, 104, 32, 180);
    expect(r).toBeLessThan(80);
    expect(b).toBeGreaterThan(140);
  });

  it("bakes the shift into a pixel buffer", () => {
    const data = new Uint8ClampedArray([196, 104, 32, 255, 0, 0, 0, 0]);
    bakeHueIntoPixels(data, 180);
    expect(data[0]).toBeLessThan(80);
    expect(data[2]).toBeGreaterThan(140);
    expect(data[4]).toBe(0);
    expect(data[7]).toBe(0);
  });

  it("bakes a copied bitmap frame without mutating the original pixels", () => {
    const original = makeImageData(new Uint8ClampedArray([196, 104, 32, 255]), 1, 1);
    const baked = bakeFrameBackup({ x: 0, y: 0, width: 1, height: 1, original }, 180);
    expect(original.data[0]).toBe(196);
    expect(baked.data[0]).toBeLessThan(80);
    expect(baked.data[2]).toBeGreaterThan(140);
  });

  it("shifts the block hue over time only when enabled", () => {
    expect(shiftingHue(10, false, 10_000)).toBe(10);
    expect(shiftingHue(10, true, 0)).toBe(10);
    expect(shiftingHue(10, true, 1000, 24)).toBe(34);
    expect(shiftingHue(350, true, 1000, 24)).toBe(14);
    expect(hueDelta(10, 14)).toBe(4);
    expect(hueDelta(350, 10)).toBe(20);
    expect(clipHueAction(undefined, 0, true)).toBe("skip");
    expect(clipHueAction(40, 0, true)).toBe("clear");
    expect(clipHueAction(10, 11, false)).toBe("apply");
    expect(clipHueAction(11, 11, true)).toBe("update");
    expect(clipHueAction(11, 11, false)).toBe("skip");
  });

  it("blits block rects with hue-rotate instead of walking pixels", () => {
    const calls: unknown[] = [];
    const ctx = {
      filter: "none",
      drawImage(...args: unknown[]) {
        calls.push([this.filter, ...args]);
      },
    };
    blitHueRects(ctx, {} as CanvasImageSource, [{ x: 2, y: 4, width: 8, height: 6 }], 40);
    expect(atlasHueFilter(40)).toBe("hue-rotate(40deg)");
    expect(atlasHueFilter(0)).toBe("none");
    expect(calls).toEqual([["hue-rotate(40deg)", {}, 2, 4, 8, 6, 2, 4, 8, 6]]);
    expect(ctx.filter).toBe("none");
  });

  it("builds preview face colors for the settings cuboid fallback", () => {
    const zero = rustFaces(0);
    const spun = rustFaces(140);
    expect(zero.top).toMatch(/^rgb\(/);
    expect(spun.top).not.toBe(zero.top);
  });

  it("collects roll, fall, land, and split cube frames but not shadows", () => {
    expect(isBlockSpriteName("blocka0007")).toBe(true);
    expect(isBlockSpriteName("blockafall0000")).toBe(true);
    expect(isBlockSpriteName("blockaland0001")).toBe(true);
    expect(isBlockSpriteName("blockasmall0000")).toBe(true);
    expect(isBlockSpriteName("blockashrink0002")).toBe(true);
    expect(isBlockSpriteName("blockashadow0000")).toBe(false);
    expect(isBlockSpriteName("blockalandshadow0000")).toBe(false);
    expect(isBlockSpriteName("blockasmallshadow0001")).toBe(false);
    expect(isBlockSpriteName("bettersky_22")).toBe(false);
    const frames = collectBlockFrameIndexes({
      blocka0000: "function () { this.gotoAndStop(38); }",
      blocka0120: "function () { this.gotoAndStop(158); }",
      blockafall0000: "function () { this.gotoAndStop(159); }",
      blockashadow0000: "function () { this.gotoAndStop(238); }",
      metal_v2: "function () { this.gotoAndStop(400); }",
    });
    expect(frames).toEqual([38, 158, 159]);
  });
});
