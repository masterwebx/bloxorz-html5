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
  const min = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf[i] !== 0x50 || buf[i + 1] !== 0x4b || buf[i + 2] !== 0x05 || buf[i + 3] !== 0x06) continue;
    const comment = u16(buf, i + 20);
    if (i + 22 + comment !== buf.length) continue;
    const off = u32(buf, i + 16);
    const count = u16(buf, i + 10);
    if (count === 0) return i;
    if (off < buf.length && u32(buf, off) === 0x02014b50) return i;
  }
  return -1;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error("deflate");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const out = new Uint8Array(await new Response(stream).arrayBuffer());
  return out;
}

export type ZipEntry = {
  name: string;
  method: number;
  dataOff: number;
  comp: number;
};

export function zipBase(name: string): string {
  const parts = name.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || name;
}

export function listZipEntries(buffer: ArrayBuffer): ZipEntry[] {
  const buf = new Uint8Array(buffer);
  const eocd = findEocd(buf);
  if (eocd < 0) throw new Error("zip");
  const entries: ZipEntry[] = [];
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
    if (localOff + 30 > buf.length) continue;
    const localNameLen = u16(buf, localOff + 26);
    const localExtra = u16(buf, localOff + 28);
    const dataOff = localOff + 30 + localNameLen + localExtra;
    entries.push({ name, method, dataOff, comp });
  }
  return entries;
}

export async function inflateZipEntry(buffer: ArrayBuffer, entry: ZipEntry): Promise<Uint8Array> {
  const buf = new Uint8Array(buffer);
  const raw = buf.subarray(entry.dataOff, entry.dataOff + entry.comp);
  if (entry.method === 0) return raw.slice();
  if (entry.method === 8) return inflateRaw(raw);
  throw new Error("zip method");
}

export async function unzip(buffer: ArrayBuffer, keep?: (name: string) => boolean): Promise<ZipFiles> {
  const files: ZipFiles = new Map();
  for (const entry of listZipEntries(buffer)) {
    if (keep && !keep(entry.name) && !keep(zipBase(entry.name))) continue;
    let data: Uint8Array;
    try {
      data = await inflateZipEntry(buffer, entry);
    } catch {
      continue;
    }
    files.set(entry.name, data);
    const base = zipBase(entry.name);
    if (base && base !== entry.name && !files.has(base)) files.set(base, data);
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

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeU(buf: Uint8Array, o: number, n: number, bytes: number): void {
  for (let i = 0; i < bytes; i++) buf[o + i] = (n >>> (8 * i)) & 0xff;
}

/** Uncompressed zip (store). Used for the downloadable theme template. */
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: { local: Uint8Array; central: Uint8Array }[] = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = enc.encode(f.name.replace(/\\/g, "/"));
    const data = f.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    local[0] = 0x50;
    local[1] = 0x4b;
    local[2] = 0x03;
    local[3] = 0x04;
    writeU(local, 14, crc, 4);
    writeU(local, 18, data.length, 4);
    writeU(local, 22, data.length, 4);
    writeU(local, 26, nameBytes.length, 2);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    const central = new Uint8Array(46 + nameBytes.length);
    central[0] = 0x50;
    central[1] = 0x4b;
    central[2] = 0x01;
    central[3] = 0x02;
    writeU(central, 16, crc, 4);
    writeU(central, 20, data.length, 4);
    writeU(central, 24, data.length, 4);
    writeU(central, 28, nameBytes.length, 2);
    writeU(central, 42, offset, 4);
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
  writeU(out, o + 8, parts.length, 2);
  writeU(out, o + 10, parts.length, 2);
  writeU(out, o + 12, centralSize, 4);
  writeU(out, o + 16, cd, 4);
  return out;
}
