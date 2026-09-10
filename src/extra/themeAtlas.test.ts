import { describe, expect, it } from "vitest";
import { themeAtlasFiles } from "./themeAtlas";

describe("theme atlas folders", () => {
  it("maps sprites to folder files instead of atlas.png", () => {
    const files = themeAtlasFiles();
    expect(files).toContain("tiles/metal_v2.png");
    expect(files).toContain("tiles/softswitch_v3.png");
    expect(files).toContain("block/movement.png");
    expect(files).toContain("misc/wina.png");
    expect(files.some((f) => f.endsWith("atlas.png"))).toBe(false);
  });
});
