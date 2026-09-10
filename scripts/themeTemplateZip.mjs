import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeU(buf, o, n, bytes) {
  for (let i = 0; i < bytes; i++) buf[o + i] = (n >>> (8 * i)) & 0xff;
}

function zipStore(files) {
  const enc = new TextEncoder();
  const parts = [];
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

function atlasFiles() {
  const map = JSON.parse(readFileSync(path.join(root, "src/extra/atlasMap.json"), "utf8"));
  const files = new Set();
  for (const row of map.frames) {
    if (row.file) files.add(String(row.file).replace(/\\/g, "/"));
  }
  return [...files];
}

function soundIds() {
  const src = readFileSync(path.join(root, "src/extra/sounds.ts"), "utf8");
  const block = src.match(/GAME_SOUND_IDS = \[([\s\S]*?)\] as const/);
  if (!block) return [];
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function readFirst(...rels) {
  for (const rel of rels) {
    const file = path.join(root, rel);
    if (existsSync(file)) return new Uint8Array(readFileSync(file));
  }
  return null;
}

export function buildThemeTemplateZip() {
  const files = [];
  const readme = readFirst("themes/_template/README.md");
  const json = readFirst("themes/_template/theme.json");
  if (readme) files.push({ name: "README.md", data: readme });
  if (json) files.push({ name: "theme.json", data: json });
  for (const rel of atlasFiles()) {
    const data = readFirst(`themes/original/${rel}`, `themes/_template/${rel}`);
    if (data) files.push({ name: rel, data });
  }
  const ids = soundIds();
  for (const id of ids) {
    const rel = `sounds/${id}.mp3`;
    const data = readFirst(`themes/_template/${rel}`, `src/${rel}`);
    if (data) files.push({ name: rel, data });
  }
  if (!files.some((f) => f.name === "README.md")) throw new Error("template-readme");
  if (!files.some((f) => f.name.startsWith("block/"))) throw new Error("template-block");
  if (!files.some((f) => f.name.startsWith("tiles/"))) throw new Error("template-tiles");
  if (!files.some((f) => f.name.startsWith("sounds/"))) throw new Error("template-sounds");
  return zipStore(files);
}

export function writeThemeTemplateZip(dest) {
  const zip = buildThemeTemplateZip();
  writeFileSync(dest, zip);
  return zip;
}
