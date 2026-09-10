import { describe, expect, it } from "vitest";
import { defaultSfxMap, GAME_SOUND_IDS, soundFileForId, soundIdFromPath } from "./sounds";
import { unzip, zipStore, zipText } from "./unzip";

describe("game sounds", () => {
  it("lists every Coolmath clip, not only Music", () => {
    expect(GAME_SOUND_IDS).toContain("Music");
    expect(GAME_SOUND_IDS).toContain("Click");
    expect(GAME_SOUND_IDS).toContain("blox003wav");
    expect(GAME_SOUND_IDS).toContain("blox036wav");
    expect(GAME_SOUND_IDS).toContain("unsplitwav");
    expect(GAME_SOUND_IDS.length).toBeGreaterThan(10);
    expect(soundFileForId("blox004wav")).toBe("sounds/blox004wav.mp3");
    expect(soundIdFromPath("sounds/Latch.mp3")).toBe("Latch");
    expect(Object.keys(defaultSfxMap())).not.toContain("Music");
    expect(defaultSfxMap().blox003wav).toBe("sounds/blox003wav.mp3");
  });
});

describe("theme template zip", () => {
  it("packs a README plus more than Music in sounds/", async () => {
    const enc = new TextEncoder();
    const zip = zipStore([
      { name: "README.md", data: enc.encode("# Theme pack\n") },
      { name: "theme.json", data: enc.encode('{"id":"my-theme"}') },
      { name: "sounds/Music.mp3", data: new Uint8Array([1, 2, 3]) },
      { name: "sounds/Click.mp3", data: new Uint8Array([4, 5]) },
      { name: "sounds/blox003wav.mp3", data: new Uint8Array([6]) },
    ]);
    const files = await unzip(zip.buffer as ArrayBuffer);
    expect(zipText(files, "README.md")).toContain("Theme pack");
    const sounds = [...files.keys()].filter((k) => k.startsWith("sounds/"));
    expect(sounds).toContain("sounds/Music.mp3");
    expect(sounds.length).toBeGreaterThan(1);
  });
});
