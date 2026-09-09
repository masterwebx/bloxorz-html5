import type { LevelDef, SwitchMode } from "./types";

const STORE = "bloxorz-custom-stages-v1";
const DOWNLOADED = "bloxorz-downloaded-stages-v1";
const PACKS = "bloxorz-stage-packs-v1";
const TILE_PACK = " befsvhklrq";
const SEED_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export interface SavedStage {
  name: string;
  author: string;
  code: string;
  seed: string;
  def: LevelDef;
  source?: "local" | "downloaded";
}

export interface StagePack {
  id: string;
  name: string;
  author: string;
  codes: string[];
}

export function padTiles(tiles: string[]): string[] {
  return tiles.map((r) => (r + "               ").slice(0, 15));
}

export function emptyDraft(): LevelDef {
  const tiles = padTiles([
    "               ",
    "               ",
    "               ",
    "               ",
    "  bbbbbbe      ",
    "               ",
    "               ",
    "               ",
    "               ",
    "               ",
  ]);
  return {
    id: "custom",
    code: "000000",
    tiles,
    spawn: [2, 4],
    switches: [],
    splits: [],
  };
}

export function setTile(def: LevelDef, x: number, y: number, ch: string): void {
  if (y < 0 || y >= 10 || x < 0 || x >= 15) return;
  const prev = def.tiles[y][x] ?? " ";
  const row = def.tiles[y].split("");
  row[x] = ch;
  def.tiles[y] = row.join("");
  if (prev === "v" && ch !== "v") {
    def.splits = def.splits.filter((s) => !(s.x === x && s.y === y));
  }
  if ((prev === "s" || prev === "h") && ch !== "s" && ch !== "h") {
    def.switches = def.switches.filter((s) => !(s.x === x && s.y === y));
  }
}

export function tileChar(def: LevelDef, x: number, y: number): string {
  return def.tiles[y]?.[x] ?? " ";
}

function canonicalLayout(def: LevelDef): string {
  const switches = [...(def.switches ?? [])]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((sw) => ({
      x: sw.x,
      y: sw.y,
      bridges: [...sw.bridges].sort((a, b) => a.y - b.y || a.x - b.x),
    }));
  const splits = [...(def.splits ?? [])].sort((a, b) => a.y - b.y || a.x - b.x);
  return JSON.stringify({ t: padTiles(def.tiles), s: def.spawn, w: switches, p: splits });
}

function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Short stable id for a layout, e.g. BXS-7K3MPQ2R. */
export function stageId(def: LevelDef): string {
  let n = hash32(canonicalLayout(def));
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += SEED_ALPHABET[n & 31];
    n = Math.imul(n ^ (n >>> 13), 0x5bd1e995) >>> 0;
  }
  return `BXS-${s}`;
}

function cellCode(x: number, y: number): number {
  return Math.max(0, Math.min(149, y * 15 + x));
}

function fromCell(n: number): [number, number] {
  return [n % 15, Math.floor(n / 15)];
}

function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64(text: string): Uint8Array | null {
  try {
    let b64 = text.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function writeLinks(bytes: number[], def: LevelDef): void {
  const switches = def.switches ?? [];
  bytes.push(Math.min(255, switches.length));
  for (const sw of switches) {
    bytes.push(cellCode(sw.x, sw.y), Math.min(255, sw.bridges.length));
    for (const b of sw.bridges) {
      const mode = b.mode === "on" ? 1 : b.mode === "off" ? 2 : 0;
      bytes.push(cellCode(b.x, b.y), mode);
    }
  }
  const splits = def.splits ?? [];
  bytes.push(Math.min(255, splits.length));
  for (const s of splits) {
    bytes.push(cellCode(s.x, s.y), cellCode(s.a[0], s.a[1]), cellCode(s.b[0], s.b[1]));
  }
}

function readLinks(bytes: Uint8Array, i: number): { i: number; switches: LevelDef["switches"]; splits: LevelDef["splits"] } {
  const switches: LevelDef["switches"] = [];
  const nsw = bytes[i++] ?? 0;
  for (let s = 0; s < nsw; s++) {
    const [x, y] = fromCell(bytes[i++] ?? 0);
    const nb = bytes[i++] ?? 0;
    const bridges: { x: number; y: number; mode: SwitchMode }[] = [];
    for (let b = 0; b < nb; b++) {
      const [bx, by] = fromCell(bytes[i++] ?? 0);
      const modeByte = bytes[i++] ?? 0;
      const mode: SwitchMode = modeByte === 1 ? "on" : modeByte === 2 ? "off" : "onoff";
      bridges.push({ x: bx, y: by, mode });
    }
    switches.push({ x, y, bridges });
  }
  const splits: LevelDef["splits"] = [];
  const nsp = bytes[i++] ?? 0;
  for (let s = 0; s < nsp; s++) {
    const [x, y] = fromCell(bytes[i++] ?? 0);
    const a = fromCell(bytes[i++] ?? 0);
    const b = fromCell(bytes[i++] ?? 0);
    splits.push({ x, y, a, b });
  }
  return { i, switches, splits };
}

/** Compact reverse seed that reconstructs the painted map. Sparse v2, dense v1 still decodes. */
export function encodeSeed(def: LevelDef): string {
  const tiles = padTiles(def.tiles);
  const occupied: { n: number; ch: string }[] = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 15; x++) {
      const ch = tiles[y][x] ?? " ";
      if (ch !== " ") occupied.push({ n: cellCode(x, y), ch });
    }
  }
  const bytes: number[] = [2, Math.min(255, occupied.length)];
  for (const cell of occupied) {
    bytes.push(cell.n, Math.max(0, TILE_PACK.indexOf(cell.ch)));
  }
  bytes.push(cellCode(def.spawn[0], def.spawn[1]));
  writeLinks(bytes, def);
  return `BXS.${toB64(Uint8Array.from(bytes))}`;
}

export function decodeSeed(text: string): LevelDef | null {
  try {
    const trimmed = text.trim();
    if (!trimmed.startsWith("BXS.")) return null;
    const bytes = fromB64(trimmed.slice(4));
    if (!bytes || bytes.length < 4) return null;
    const cells = Array.from({ length: 150 }, () => " ");
    let i = 1;
    if (bytes[0] === 1) {
      if (bytes.length < 79) return null;
      for (let n = 0; n < 75; n++) {
        const byte = bytes[i++] ?? 0;
        cells[n * 2] = TILE_PACK[(byte >> 4) & 15] ?? " ";
        cells[n * 2 + 1] = TILE_PACK[byte & 15] ?? " ";
      }
    } else if (bytes[0] === 2) {
      const count = bytes[i++] ?? 0;
      for (let n = 0; n < count; n++) {
        const at = bytes[i++] ?? 0;
        const ch = TILE_PACK[bytes[i++] ?? 0] ?? " ";
        if (at < 150) cells[at] = ch;
      }
    } else {
      return null;
    }
    const tiles: string[] = [];
    for (let y = 0; y < 10; y++) tiles.push(cells.slice(y * 15, y * 15 + 15).join(""));
    const spawn = fromCell(bytes[i++] ?? 0);
    const links = readLinks(bytes, i);
    return { id: "custom", code: "000000", tiles, spawn, switches: links.switches, splits: links.splits };
  } catch {
    return null;
  }
}

export function encodeLevel(def: LevelDef): string {
  const raw = JSON.stringify({ t: padTiles(def.tiles), s: def.spawn, w: def.switches, p: def.splits, k: stageId(def) });
  const b64 = btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `BX1.${b64}`;
}

export function decodeLevel(code: string): LevelDef | null {
  try {
    const trimmed = code.trim();
    if (!trimmed.startsWith("BX1.")) return null;
    let b64 = trimmed.slice(4).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const raw = decodeURIComponent(escape(atob(b64)));
    const data = JSON.parse(raw) as { t: string[]; s: [number, number]; w: LevelDef["switches"]; p: LevelDef["splits"] };
    if (!Array.isArray(data.t) || data.t.length !== 10) return null;
    return {
      id: "custom",
      code: "000000",
      tiles: padTiles(data.t),
      spawn: data.s,
      switches: data.w ?? [],
      splits: data.p ?? [],
    };
  } catch {
    return null;
  }
}

function hydrate(stage: SavedStage, source: SavedStage["source"]): SavedStage {
  const def = stage.def;
  return {
    ...stage,
    author: stage.author || "Unknown",
    source: stage.source ?? source,
    seed: stage.seed || (def ? stageId(def) : ""),
  };
}

export function parseShare(text: string, extra: SavedStage[] = []): LevelDef | null {
  const t = text.trim();
  const compact = t.match(/BXS\.[A-Za-z0-9_-]+/);
  if (compact) {
    const def = decodeSeed(compact[0]);
    if (def) return def;
  }
  const bx1 = t.match(/BX1\.[A-Za-z0-9_-]+/);
  if (bx1) return decodeLevel(bx1[0]);
  const short = t.match(/BXS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}/i);
  if (short) {
    const hit = findBySeed(short[0], extra);
    if (hit) return hit.def;
  }
  return decodeLevel(t) ?? decodeSeed(t);
}

export function findBySeed(seed: string, extra: SavedStage[] = []): SavedStage | undefined {
  const want = seed.trim().toUpperCase();
  return [...listAllStages(), ...extra].find((s) => (s.seed || stageId(s.def)).toUpperCase() === want);
}

function readList(key: string): SavedStage[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedStage[];
    return parsed.map((s) => hydrate(s, key === DOWNLOADED ? "downloaded" : "local"));
  } catch {
    return [];
  }
}

function writeList(key: string, all: SavedStage[]): void {
  localStorage.setItem(key, JSON.stringify(all.slice(0, 80)));
}

export function listSaved(): SavedStage[] {
  return readList(STORE);
}

export function listDownloaded(): SavedStage[] {
  return readList(DOWNLOADED);
}

export function listAllStages(): SavedStage[] {
  return [...listSaved(), ...listDownloaded()];
}

export function saveStage(stage: SavedStage): void {
  const key = stage.source === "downloaded" ? DOWNLOADED : STORE;
  const all = readList(key).filter((s) => s.code !== stage.code);
  all.unshift({
    ...stage,
    source: stage.source ?? "local",
    seed: stage.seed || stageId(stage.def),
  });
  writeList(key, all);
}

export function deleteStage(code: string): void {
  writeList(STORE, listSaved().filter((s) => s.code !== code));
  writeList(DOWNLOADED, listDownloaded().filter((s) => s.code !== code));
}

export function findStage(code: string): SavedStage | undefined {
  const want = code.trim();
  return listAllStages().find((s) => s.code === want || (s.seed && s.seed.toUpperCase() === want.toUpperCase()));
}

export function listPacks(): StagePack[] {
  try {
    const raw = localStorage.getItem(PACKS);
    if (!raw) return [];
    return JSON.parse(raw) as StagePack[];
  } catch {
    return [];
  }
}

export function savePack(pack: StagePack): void {
  const all = listPacks().filter((p) => p.id !== pack.id);
  all.unshift(pack);
  localStorage.setItem(PACKS, JSON.stringify(all.slice(0, 40)));
}

export function deletePack(id: string): void {
  localStorage.setItem(PACKS, JSON.stringify(listPacks().filter((p) => p.id !== id)));
}

export function packStages(pack: StagePack): SavedStage[] {
  return pack.codes.map((c) => findStage(c)).filter((s): s is SavedStage => !!s);
}

export function isPlayable(def: LevelDef): string | null {
  const exits = def.tiles.reduce((n, r) => n + [...r].filter((c) => c === "e").length, 0);
  const hasStone = def.tiles.some((r) => /[bshfvlrkq]/.test(r));
  if (exits === 0) return "Place an exit hole.";
  if (exits > 1) return "Only one exit is allowed.";
  if (!hasStone) return "Paint some tiles.";
  const [sx, sy] = def.spawn;
  const ch = tileChar(def, sx, sy);
  if (ch === " " || ch === "e") return "Spawn must sit on a solid tile.";
  return null;
}
