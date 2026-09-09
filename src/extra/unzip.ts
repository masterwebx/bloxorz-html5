/** Minimal ZIP reader (store + deflate). No extra dependency. */

export type ZipFiles = Map<string, Uint8Array>;

const TD = new TextDecoder();

function u16(b: Uint8Array, o: number): number {
  return b[o]! | (b[o + 1]! << 8);
}

function u32(b: Uint8Array, o: number): number {
  return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
}

function findEocd(buf: Uint8Array): number {
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 0xffff; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) return i;
  }
  return -1;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error("deflate");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const out = new Uint8Array(await new Response(stream).arrayBuffer());
  return out;
}

export async function unzip(buffer: ArrayBuffer): Promise<ZipFiles> {
  const buf = new Uint8Array(buffer);
  const files: ZipFiles = new Map();
  const eocd = findEocd(buf);
  if (eocd < 0) throw new Error("zip");
  let off = u32(buf, eocd + 16);
  const count = u16(buf, eocd + 10);
  for (let n = 0; n < count; n++) {
    if (u32(buf, off) !== 0x02014b50) break;
    const method = u16(buf, off + 10);
    const comp = u32(buf, off + 20);
    const nameLen = u16(buf, off + 28);
    const extraLen = u16(buf, off + 30);
    const commentLen = u16(buf, off + 32);
    const localOff = u32(buf, off + 42);
    const name = TD.decode(buf.subarray(off + 46, off + 46 + nameLen)).replace(/\\/g, "/");
    off += 46 + nameLen + extraLen + commentLen;
    if (!name || name.endsWith("/")) continue;
    const localNameLen = u16(buf, localOff + 26);
    const localExtra = u16(buf, localOff + 28);
    const dataOff = localOff + 30 + localNameLen + localExtra;
    const raw = buf.subarray(dataOff, dataOff + comp);
    let data: Uint8Array;
    if (method === 0) data = raw.slice();
    else if (method === 8) data = await inflateRaw(raw);
    else continue;
    files.set(name, data);
    const base = name.split("/").pop();
    if (base && base !== name && !files.has(base)) files.set(base, data);
  }
  return files;
}

export function zipText(files: ZipFiles, name: string): string | null {
  const hit = files.get(name) ?? [...files.entries()].find(([k]) => k.endsWith("/" + name) || k === name)?.[1];
  if (!hit) return null;
  return TD.decode(hit);
}

export function zipFile(files: ZipFiles, name: string): Uint8Array | null {
  if (files.has(name)) return files.get(name)!;
  const hit = [...files.entries()].find(([k]) => k === name || k.endsWith("/" + name));
  return hit ? hit[1] : null;
}
