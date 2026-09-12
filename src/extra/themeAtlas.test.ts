import { describe, expect, it } from "vitest";
import { themeAtlasFiles } from "./themeAtlas";

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
});

/** composeThemeAtlas returns clones of the pristine cache (see themeAtlas.ts) so
 *  tile/block bake cannot poison Reset all / Default — verified manually in-browser. */
