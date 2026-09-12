import { describe, expect, it } from "vitest";
import {
  atlasHueFilter,
  bakeFrameBackup,
  bakeHueIntoPixels,
  blitHueRects,
  blitPackedHue,
  blitPackedRecolor,
  bakeRecolorIntoPixels,
  collectBlockFrameIndexes,
  needsBlockColorBake,
  parseHexRgb,
  recolorRgb,
  rustFacesFromHex,
  extractPackedBlockSource,
  hueDelta,
  hueRotateRgb,
  isBlockSpriteName,
  makeImageData,
  needsBlockHueBake,
  packBlockLayout,
  rustFaces,
  shiftingHue,
  shiftHexHue,
  BG_CYCLE_DEG_PER_SEC,
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

  it("shifts hue continuously over time only when enabled", () => {
    expect(shiftingHue(10, false, 10_000)).toBe(10);
    expect(shiftingHue(10, true, 0)).toBe(10);
    expect(shiftingHue(10, true, 1000, 24)).toBe(34);
    expect(shiftingHue(350, true, 1000, 24)).toBe(14);
    // Fractional degrees — no hard 1° steps.
    expect(shiftingHue(10, true, 500, 24)).toBe(22);
    expect(shiftingHue(0, true, 250, 6)).toBeCloseTo(1.5, 5);
    expect(BG_CYCLE_DEG_PER_SEC).toBe(6);
    expect(shiftHexHue("#b86a2e", 0)).toBe("#b86a2e");
    expect(shiftHexHue("#ff0000", 120)).not.toBe("#ff0000");
    expect(hueDelta(10, 14)).toBe(4);
    expect(hueDelta(350, 10)).toBe(20);
    expect(clipHueAction(undefined, 0, true)).toBe("skip");
    expect(clipHueAction(40, 0, true)).toBe("clear");
    expect(clipHueAction(10, 11, false)).toBe("apply");
    expect(clipHueAction(11, 11, true)).toBe("update");
    expect(clipHueAction(11, 11, false)).toBe("skip");
  });

  it("skips atlas work when hue is still default and nothing is baked", () => {
    expect(needsBlockHueBake(0, -1, false)).toBe(false);
    expect(needsBlockHueBake(12, -1, false)).toBe(true);
    expect(needsBlockHueBake(12, 12, true)).toBe(false);
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

  it("packs block rects into a tight sheet smaller than a 4096 atlas", () => {
    const rects = Array.from({ length: 4 }, (_, i) => ({ x: i * 200, y: 0, width: 200, height: 150 }));
    const layout = packBlockLayout(rects);
    expect(layout.slots).toHaveLength(4);
    expect(layout.width * layout.height).toBeLessThan(4096 * 4096);
    expect(layout.width).toBe(400);
    expect(layout.height).toBe(300);
    expect(layout.slots[0]?.dest).toEqual(rects[0]);
    expect(layout.slots[0]?.src).toEqual({ x: 0, y: 0, width: 200, height: 150 });
    expect(layout.slots[3]?.src).toEqual({ x: 200, y: 150, width: 200, height: 150 });
  });

  it("extracts packed pristine pixels from live atlas rects only", () => {
    const liveCalls: unknown[] = [];
    const live = {} as CanvasImageSource;
    const layout = packBlockLayout([
      { x: 10, y: 20, width: 8, height: 6 },
      { x: 30, y: 40, width: 8, height: 6 },
    ]);
    const canvas = { width: 0, height: 0 } as HTMLCanvasElement;
    const ctx = {
      drawImage(...args: unknown[]) {
        liveCalls.push(args);
      },
    };
    const packed = extractPackedBlockSource(
      (w, h) => {
        canvas.width = w;
        canvas.height = h;
        return { canvas, ctx };
      },
      live,
      layout,
    );
    expect(packed).toBe(canvas);
    expect(canvas.width).toBe(layout.width);
    expect(canvas.height).toBe(layout.height);
    expect(liveCalls).toEqual([
      [live, 10, 20, 8, 6, 0, 0, 8, 6],
      [live, 30, 40, 8, 6, 8, 0, 8, 6],
    ]);
  });

  it("bakes hue with one filtered packed draw then unfiltered live copies", () => {
    const scratchCalls: unknown[] = [];
    const destCalls: unknown[] = [];
    const packed = {} as CanvasImageSource;
    const scratchCanvas = { width: 16, height: 6 } as HTMLCanvasElement;
    const scratch = {
      canvas: scratchCanvas,
      ctx: {
        filter: "none",
        drawImage(...args: unknown[]) {
          scratchCalls.push([this.filter, ...args]);
        },
      },
    };
    const dest = {
      filter: "hue-rotate(99deg)",
      drawImage(...args: unknown[]) {
        destCalls.push([this.filter, ...args]);
      },
    };
    const slots = packBlockLayout([
      { x: 2, y: 4, width: 8, height: 6 },
      { x: 12, y: 4, width: 8, height: 6 },
    ]).slots;
    blitPackedHue(dest, packed, scratch, slots, 40);
    expect(scratchCalls).toEqual([["hue-rotate(40deg)", packed, 0, 0, 16, 6, 0, 0, 16, 6]]);
    expect(scratch.ctx.filter).toBe("none");
    expect(dest.filter).toBe("none");
    expect(destCalls).toEqual([
      ["none", scratchCanvas, 0, 0, 8, 6, 2, 4, 8, 6],
      ["none", scratchCanvas, 8, 0, 8, 6, 12, 4, 8, 6],
    ]);
  });

  it("recolors rust toward a full RGB swatch (contrast-preserving tint)", () => {
    expect(parseHexRgb("#00ff80")).toEqual([0, 255, 128]);
    // Mid rust luminance ≈ base → output tracks the target green while keeping face ratios.
    const [r, g, b] = recolorRgb(196, 104, 32, 0, 255, 128);
    expect(r).toBeLessThan(40);
    expect(g).toBeGreaterThan(200);
    expect(b).toBeGreaterThan(60);
    expect(b).toBeLessThan(g);
    // Pure gray source still goes blue-ish toward the swatch.
    const [gr, gg, gb] = recolorRgb(128, 128, 128, 0, 0, 255);
    expect(gr).toBe(0);
    expect(gg).toBe(0);
    expect(gb).toBeGreaterThan(100);
    const data = new Uint8ClampedArray([196, 104, 32, 255, 0, 0, 0, 0]);
    bakeRecolorIntoPixels(data, "#00ff80");
    expect(data[1]).toBeGreaterThan(200);
    expect(data[4]).toBe(0);
    const faces = rustFacesFromHex("#3366ff");
    expect(faces.top).toMatch(/^rgb\(/);
    expect(needsBlockColorBake(null, null, false)).toBe(false);
    expect(needsBlockColorBake("#3366ff", null, false)).toBe(true);
    expect(needsBlockColorBake("#3366ff", "#3366ff", true)).toBe(false);
  });

  it("restores pristine pixels when recolor target is null", () => {
    const packed = {} as CanvasImageSource;
    const scratchCanvas = { width: 8, height: 6 };
    let cleared = false;
    const img = { data: new Uint8ClampedArray([196, 104, 32, 255]), width: 8, height: 6 };
    const scratch = {
      canvas: scratchCanvas,
      ctx: {
        filter: "hue-rotate(9deg)",
        clearRect() {
          cleared = true;
        },
        drawImage() {},
        getImageData() {
          return img;
        },
        putImageData() {},
      },
    };
    const destCalls: unknown[] = [];
    const dest = {
      filter: "x",
      drawImage(...args: unknown[]) {
        destCalls.push(args);
      },
    };
    const slots = packBlockLayout([{ x: 1, y: 2, width: 8, height: 6 }]).slots;
    blitPackedRecolor(dest, packed, scratch as never, slots, null);
    expect(cleared).toBe(true);
    expect(scratch.ctx.filter).toBe("none");
    expect(dest.filter).toBe("none");
    expect(destCalls).toHaveLength(1);
  });
});
