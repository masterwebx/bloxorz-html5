import { describe, expect, it } from "vitest";
import { unzip, zipText } from "./unzip";

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

describe("unzip", () => {
  it("reads a stored theme.json", async () => {
    const buf = await zipOf([{ name: "theme.json", body: '{"id":"pack"}' }]);
    const files = await unzip(buf);
    expect(zipText(files, "theme.json")).toBe('{"id":"pack"}');
  });

  it("finds theme.json one folder down", async () => {
    const buf = await zipOf([{ name: "mewga/theme.json", body: '{"id":"original","name":"Original"}' }]);
    const files = await unzip(buf);
    expect(zipText(files, "theme.json")).toBe('{"id":"original","name":"Original"}');
    expect(files.has("mewga/theme.json")).toBe(true);
  });

  it("inflates a nested deflated atlas next to theme.json", async () => {
    const buf = await zipOf([
      { name: "mewga/theme.json", body: '{"id":"original","atlas":"atlas.png"}', deflate: true },
      { name: "mewga/atlas.png", body: new Uint8Array([1, 2, 3, 4, 5]), deflate: true },
    ]);
    const files = await unzip(buf);
    expect(zipText(files, "theme.json")).toContain("atlas.png");
    expect(files.get("mewga/atlas.png")).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it("can skip unused zip entries", async () => {
    const buf = await zipOf([{ name: "mewga/misc/skip.png", body: "nope" }]);
    const files = await unzip(buf, (name) => name.endsWith("theme.json"));
    expect(files.size).toBe(0);
  });
});
