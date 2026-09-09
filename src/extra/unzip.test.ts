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

function storeZip(name: string, body: string): ArrayBuffer {
  const nameBytes = new TextEncoder().encode(name);
  const data = new TextEncoder().encode(body);
  const crc = crc32(data);
  const local = 30 + nameBytes.length + data.length;
  const central = 46 + nameBytes.length;
  const out = new Uint8Array(local + central + 22);
  const w = (o: number, n: number, bytes: number) => {
    for (let i = 0; i < bytes; i++) out[o + i] = (n >>> (8 * i)) & 0xff;
  };
  out[0] = 0x50;
  out[1] = 0x4b;
  out[2] = 0x03;
  out[3] = 0x04;
  w(18, data.length, 4);
  w(22, data.length, 4);
  w(26, nameBytes.length, 2);
  out.set(nameBytes, 30);
  out.set(data, 30 + nameBytes.length);
  const c = local;
  out[c] = 0x50;
  out[c + 1] = 0x4b;
  out[c + 2] = 0x01;
  out[c + 3] = 0x02;
  w(c + 16, crc, 4);
  w(c + 20, data.length, 4);
  w(c + 24, data.length, 4);
  w(c + 28, nameBytes.length, 2);
  out.set(nameBytes, c + 46);
  const e = local + central;
  out[e] = 0x50;
  out[e + 1] = 0x4b;
  out[e + 2] = 0x05;
  out[e + 3] = 0x06;
  w(e + 8, 1, 2);
  w(e + 10, 1, 2);
  w(e + 12, central, 4);
  w(e + 16, local, 4);
  return out.buffer;
}

describe("unzip", () => {
  it("reads a stored theme.json", async () => {
    const buf = storeZip("theme.json", '{"id":"pack"}');
    const files = await unzip(buf);
    expect(zipText(files, "theme.json")).toBe('{"id":"pack"}');
  });
});
