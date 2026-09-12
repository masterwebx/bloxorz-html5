import { describe, expect, it } from "vitest";
import { cachedThemeAtlasIds, forgetThemeAtlas, themeAtlasFiles } from "./themeAtlas";

describe("theme atlas folders", () => {
  it("maps sprites to folder files instead of atlas.png", () => {
    const files = themeAtlasFiles();
    expect(files).toContain("tiles/metal_v2.png");
    expect(files).toContain("tiles/softswitch_v3.png");
    expect(files).toContain("block/movement.png");
    expect(files).toContain("block/blockafall0000.png");
    expect(files).toContain("block/blockaland0000.png");
    expect(files).toContain("animations/bolckadoor0000.png");
    expect(files.some((f) => f.startsWith("misc/blocka"))).toBe(false);
    expect(files.some((f) => f.startsWith("animations/blocka"))).toBe(false);
    expect(files).toContain("misc/wina.png");
    expect(files.some((f) => f.endsWith("atlas.png"))).toBe(false);
  });

  it("exposes cache ids for eviction checks", () => {
    forgetThemeAtlas();
    expect(cachedThemeAtlasIds()).toEqual([]);
  });
});

/** composeThemeAtlas keeps a single sheet per active theme (evicts others) and
 *  prefers themes/<id>/atlas.png when that file loads — verified in-browser for RAM. */
