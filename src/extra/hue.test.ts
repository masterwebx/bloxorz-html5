import { describe, expect, it } from "vitest";
import { bakeHueIntoPixels, hueRotateRgb, rustFaces } from "./hue";

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

  it("builds preview face colors for the settings cuboid", () => {
    const zero = rustFaces(0);
    const spun = rustFaces(140);
    expect(zero.top).toMatch(/^rgb\(/);
    expect(spun.top).not.toBe(zero.top);
  });
});
