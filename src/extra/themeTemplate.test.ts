import { describe, expect, it } from "vitest";
import { listZipEntries } from "./unzip";
import { assembleThemeTemplate, templateHasArt, templatePackNames } from "./themeTemplate";
import { themeAtlasFiles } from "./themeAtlas";

describe("theme template pack", () => {
  it("lists original art folders plus every sound", () => {
    const names = templatePackNames(themeAtlasFiles());
    expect(names).toContain("README.md");
    expect(names).toContain("theme.json");
    expect(names).toContain("tiles/metal_v2.png");
    expect(names).toContain("block/movement.png");
    expect(names).toContain("block/blockafall0000.png");
    expect(names).toContain("animations/bolckadoor0000.png");
    expect(names).toContain("misc/wina.png");
    expect(names).toContain("backgrounds/menuw.png");
    expect(names).toContain("tutorial/instrucpict1.png");
    expect(names).toContain("sounds/Music.mp3");
    expect(names).toContain("sounds/blox2wav.mp3");
    expect(templateHasArt(names)).toBe(true);
  });

  it("zips art and sounds together", async () => {
    const atlas = ["tiles/metal_v2.png", "block/movement.png", "animations/bolckadoor0000.png", "misc/wina.png"];
    const zip = await assembleThemeTemplate(async (name) => new TextEncoder().encode(name), atlas);
    const copy = new Uint8Array(zip.byteLength);
    copy.set(zip);
    const entries = listZipEntries(copy.buffer);
    const names = entries.map((e) => e.name);
    expect(templateHasArt(names)).toBe(true);
    expect(names).toContain("tiles/metal_v2.png");
    expect(names).toContain("sounds/Click.mp3");
  });
});
