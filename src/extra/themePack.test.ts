import { describe, expect, it } from "vitest";
import { atlasUrlFor, getTheme, isHdTheme, isSolid3d, listThemes, setCurrentThemeId } from "./themePack";

describe("theme packs", () => {
  it("ships original, gray, holiday, and solid 3D", () => {
    const ids = listThemes().map((p) => p.id);
    expect(ids).toContain("original");
    expect(ids).toContain("gray");
    expect(ids).toContain("holiday");
    expect(ids).toContain("solid3d");
  });

  it("marks the 3D pack as HD isometric cubes", () => {
    expect(isSolid3d("solid3d")).toBe(true);
    expect(isHdTheme("solid3d")).toBe(true);
    expect(getTheme("solid3d").render).toBe("solid3d");
  });

  it("resolves builtin atlas paths", () => {
    setCurrentThemeId("gray");
    expect(atlasUrlFor("gray")).toContain("gray");
    expect(atlasUrlFor("original")).toContain("original");
  });
});
