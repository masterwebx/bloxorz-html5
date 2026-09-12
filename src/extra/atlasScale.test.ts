import { describe, expect, it } from "vitest";
import { atlasScaleForSheet } from "./atlasScale";

describe("atlasScaleForSheet", () => {
  it("treats 4096 as full scale", () => {
    expect(atlasScaleForSheet({ width: 4096 })).toBe(1);
    expect(atlasScaleForSheet({ naturalWidth: 4096 })).toBe(1);
  });

  it("treats 2048 as half scale", () => {
    expect(atlasScaleForSheet({ width: 2048 })).toBe(0.5);
    expect(atlasScaleForSheet({ naturalWidth: 2048 })).toBe(0.5);
  });
});
