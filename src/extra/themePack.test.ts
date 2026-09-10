import { describe, expect, it } from "vitest";
import { atlasUrlFor, getTheme, installThemeZip, isHdTheme, isSolid3d, setCurrentThemeId, themeMenuItems } from "./themePack";

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
    const ids = themeMenuItems().map((p) => p.id);
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

  it("puts a nested custom pack in the same list the theme dropdown uses", async () => {
    const json = JSON.stringify({ id: "original", name: "Original", atlas: "atlas.png" });
    const buf = await zipOf([
      { name: "mewga/theme.json", body: json, deflate: true },
      { name: "mewga/atlas.png", body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]), deflate: true },
      { name: "mewga/animations/skip.png", body: "unused" },
    ]);
    const pack = await installThemeZip(buf);
    expect(pack.id).toBe("mewga");
    expect(pack.builtin).toBe(false);
    expect(pack.name).toBe("mewga");
    expect(pack.atlas).toMatch(/^(blob:|data:)/);
    const menu = themeMenuItems();
    expect(menu.map((p) => p.id)).toContain("mewga");
    expect(menu.find((p) => p.id === "mewga")?.name).toBe("mewga");
    expect(getTheme("original").builtin).toBe(true);
  });
});
