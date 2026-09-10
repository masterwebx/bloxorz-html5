import { describe, expect, it } from "vitest";
import { resolveAtlasFile } from "./themeAtlas";
import {
  getTheme,
  installThemeZip,
  isHdTheme,
  isSolid3d,
  listCustomThemes,
  removeCustomTheme,
  setCurrentThemeId,
  themeMenuItems,
} from "./themePack";

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function zipOf(files: { name: string; body: string | Uint8Array; deflate?: boolean }[]): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const parts: { local: Uint8Array; central: Uint8Array }[] = [];
  let offset = 0;
  const w = (buf: Uint8Array, o: number, n: number, bytes: number) => {
    for (let i = 0; i < bytes; i++) buf[o + i] = (n >>> (8 * i)) & 0xff;
  };
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = typeof f.body === "string" ? enc.encode(f.body) : f.body;
    const payload = f.deflate ? await deflateRaw(data) : data;
    const method = f.deflate ? 8 : 0;
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + payload.length);
    local[0] = 0x50;
    local[1] = 0x4b;
    local[2] = 0x03;
    local[3] = 0x04;
    w(local, 8, method, 2);
    w(local, 14, crc, 4);
    w(local, 18, payload.length, 4);
    w(local, 22, data.length, 4);
    w(local, 26, nameBytes.length, 2);
    local.set(nameBytes, 30);
    local.set(payload, 30 + nameBytes.length);
    const central = new Uint8Array(46 + nameBytes.length);
    central[0] = 0x50;
    central[1] = 0x4b;
    central[2] = 0x01;
    central[3] = 0x02;
    w(central, 10, method, 2);
    w(central, 16, crc, 4);
    w(central, 20, payload.length, 4);
    w(central, 24, data.length, 4);
    w(central, 28, nameBytes.length, 2);
    w(central, 42, offset, 4);
    central.set(nameBytes, 46);
    parts.push({ local, central });
    offset += local.length;
  }
  const centralSize = parts.reduce((s, p) => s + p.central.length, 0);
  const out = new Uint8Array(offset + centralSize + 22);
  let o = 0;
  for (const p of parts) {
    out.set(p.local, o);
    o += p.local.length;
  }
  const cd = o;
  for (const p of parts) {
    out.set(p.central, o);
    o += p.central.length;
  }
  out[o] = 0x50;
  out[o + 1] = 0x4b;
  out[o + 2] = 0x05;
  out[o + 3] = 0x06;
  w(out, o + 8, parts.length, 2);
  w(out, o + 10, parts.length, 2);
  w(out, o + 12, centralSize, 4);
  w(out, o + 16, cd, 4);
  return out.buffer;
}

describe("theme packs", () => {
  it("ships original, gray, holiday, and solid 3D", () => {
    const ids = themeMenuItems(true).map((p) => p.id);
    expect(ids).toContain("original");
    expect(ids).toContain("gray");
    expect(ids).toContain("holiday");
    expect(ids).toContain("solid3d");
  });

  it("hides Solid 3D from the theme list unless DEV mode is on", () => {
    expect(themeMenuItems(false).map((p) => p.id)).not.toContain("solid3d");
    expect(themeMenuItems(true).map((p) => p.id)).toContain("solid3d");
  });

  it("marks the 3D pack as HD isometric cubes", () => {
    expect(isSolid3d("solid3d")).toBe(true);
    expect(isHdTheme("solid3d")).toBe(true);
    expect(getTheme("solid3d").render).toBe("solid3d");
  });

  it("does not require a packed atlas.png", () => {
    setCurrentThemeId("gray");
    expect(getTheme("gray").builtin).toBe(true);
    expect(getTheme("original").atlas).toBeUndefined();
  });

  it("puts a nested custom pack in the same list the theme dropdown uses", async () => {
    const json = JSON.stringify({ id: "original", name: "Original" });
    const buf = await zipOf([
      { name: "mewga/theme.json", body: json, deflate: true },
      { name: "mewga/tiles/metal_v2.png", body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]), deflate: true },
      { name: "mewga/animations/skip.png", body: "unused" },
    ]);
    const pack = await installThemeZip(buf);
    expect(pack.id).toBe("mewga");
    expect(pack.builtin).toBe(false);
    expect(pack.name).toBe("mewga");
    expect(pack.files?.["tiles/metal_v2.png"] || pack.files?.["metal_v2.png"]).toMatch(/^(blob:|data:)/);
    const menu = themeMenuItems();
    expect(menu.map((p) => p.id)).toContain("mewga");
    expect(menu.find((p) => p.id === "mewga")?.name).toBe("mewga");
    expect(getTheme("original").builtin).toBe(true);
  });

  it("does not overwrite a builtin or an already installed custom pack", async () => {
    const originalFiles = getTheme("original").files;
    const first = await installThemeZip(
      await zipOf([
        { name: "theme.json", body: '{"id":"original","name":"Hijack"}' },
        { name: "tiles/metal_v2.png", body: new Uint8Array([1, 2, 3, 4]) },
      ]),
    );
    expect(first.id).not.toBe("original");
    expect(getTheme("original").builtin).toBe(true);
    expect(getTheme("original").files).toBe(originalFiles);
    const again = await installThemeZip(
      await zipOf([
        { name: "theme.json", body: '{"id":"original","name":"Hijack"}' },
        { name: "tiles/metal_v2.png", body: new Uint8Array([5, 6, 7, 8]) },
      ]),
    );
    expect(again.id).not.toBe(first.id);
    expect(again.id).not.toBe("original");
    expect(getTheme(first.id).builtin).toBe(false);
  });

  it("resolves uploaded tile files for in-game atlas compose", async () => {
    const pack = await installThemeZip(
      await zipOf([
        { name: "theme.json", body: '{"id":"paint","name":"Paint"}' },
        { name: "tiles/metal_v2.png", body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) },
      ]),
    );
    const url = resolveAtlasFile(pack.id, "tiles/metal_v2.png");
    expect(url).toMatch(/^(blob:|data:)/);
    expect(url).not.toContain("themes/original/");
  });

  it("removes an uploaded custom pack from the theme list", async () => {
    const pack = await installThemeZip(
      await zipOf([
        { name: "theme.json", body: '{"id":"toss","name":"Toss"}' },
        { name: "tiles/metal_v2.png", body: new Uint8Array([1, 2, 3, 4]) },
      ]),
    );
    setCurrentThemeId(pack.id);
    expect(listCustomThemes().some((row) => row.id === pack.id)).toBe(true);
    const out = await removeCustomTheme(pack.id);
    expect(out.ok).toBe(true);
    expect(out.current).toBe("original");
    expect(listCustomThemes().some((row) => row.id === pack.id)).toBe(false);
    expect((await removeCustomTheme("original")).ok).toBe(false);
  });
});
