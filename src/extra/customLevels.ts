import type { LevelDef, SwitchMode } from "./types";
import { t } from "./i18n";

const STORE = "bloxorz-custom-stages-v1";
const DOWNLOADED = "bloxorz-downloaded-stages-v1";
const TILE_PACK = " befsvhklrq";
const SEED_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export interface SavedStage {
  name: string;
  author: string;
  code: string;
  seed: string;
  def: LevelDef;
  defs?: LevelDef[];
  kind?: "single" | "pack";
  source?: "local" | "downloaded";
}

export function isPack(stage: SavedStage): boolean {
  return stage.kind === "pack" || (stage.defs?.length ?? 0) > 1;
}

export function stageKindLabel(stage: SavedStage): "Single" | "Pack" {
  return isPack(stage) ? "Pack" : "Single";
}

export function packDefs(stage: SavedStage): LevelDef[] {
  if (stage.defs?.length) return stage.defs;
  return stage.def ? [stage.def] : [];
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

function readLinks(bytes: Uint8Array, i: number): { i: number; switches: LevelDef["switches"]; splits: LevelDef["splits"] } | null {
  if (i >= bytes.length) return null;
  const switches: LevelDef["switches"] = [];
  const nsw = bytes[i++] ?? 0;
  for (let s = 0; s < nsw; s++) {
    if (i + 2 > bytes.length) return null;
    const [x, y] = fromCell(bytes[i++] ?? 0);
    const nb = bytes[i++] ?? 0;
    if (i + nb * 2 > bytes.length) return null;
    const bridges: { x: number; y: number; mode: SwitchMode }[] = [];
    for (let b = 0; b < nb; b++) {
      const [bx, by] = fromCell(bytes[i++] ?? 0);
      const modeByte = bytes[i++] ?? 0;
      const mode: SwitchMode = modeByte === 1 ? "on" : modeByte === 2 ? "off" : "onoff";
      bridges.push({ x: bx, y: by, mode });
    }
    switches.push({ x, y, bridges });
  }
  if (i >= bytes.length) return null;
  const splits: LevelDef["splits"] = [];
  const nsp = bytes[i++] ?? 0;
  if (i + nsp * 3 > bytes.length) return null;
  for (let s = 0; s < nsp; s++) {
    const [x, y] = fromCell(bytes[i++] ?? 0);
    const a = fromCell(bytes[i++] ?? 0);
    const b = fromCell(bytes[i++] ?? 0);
    splits.push({ x, y, a, b });
  }
  return { i, switches, splits };
}

function packNibble(ch: string): number {
  const i = TILE_PACK.indexOf(ch);
  return i < 0 ? 0 : i;
}

/** Compact reverse seed that reconstructs the painted map. Sparse v2, dense v1 still decodes. */
export function encodeSeed(def: LevelDef): string {
  const tiles = padTiles(def.tiles);
  const occupied: { n: number; ch: string }[] = [];
  const cells: string[] = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 15; x++) {
      const ch = tiles[y][x] ?? " ";
      cells.push(ch);
      if (ch !== " ") occupied.push({ n: cellCode(x, y), ch });
    }
  }
  const bytes: number[] = [];
  if (occupied.length >= 37) {
    bytes.push(1);
    for (let n = 0; n < 75; n++) {
      bytes.push((packNibble(cells[n * 2] ?? " ") << 4) | packNibble(cells[n * 2 + 1] ?? " "));
    }
  } else {
    bytes.push(2, Math.min(255, occupied.length));
    for (const cell of occupied) bytes.push(cell.n, packNibble(cell.ch));
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
      if (bytes.length < i + count * 2 + 3) return null;
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
    if (i >= bytes.length) return null;
    const spawn = fromCell(bytes[i++] ?? 0);
    const links = readLinks(bytes, i);
    if (!links) return null;
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
  const defs = stage.defs?.length ? stage.defs : def ? [def] : [];
  const kind = stage.kind === "pack" || defs.length > 1 ? "pack" : "single";
  return {
    ...stage,
    author: stage.author || "Unknown",
    source: stage.source ?? source,
    kind,
    defs,
    def: defs[0] ?? def,
    seed: stage.seed || (kind === "pack" && defs.length ? encodePack(defs) : def ? stageId(def) : ""),
  };
}

/** Pull a BXS/BX1 code from ?code= / ?seed= or a #BXS… hash. */
export function shareFromLocation(search: string, hash: string): string {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(q);
  const fromQuery = (params.get("code") || params.get("seed") || "").trim();
  if (fromQuery) return fromQuery;
  let h = hash.startsWith("#") ? hash.slice(1) : hash;
  try {
    h = decodeURIComponent(h);
  } catch {
    /* keep raw */
  }
  h = h.trim();
  if (h.startsWith("BXS.") || h.startsWith("BX1.") || /^BXS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/i.test(h)) return h;
  return "";
}

export function occupiedTileCount(def: LevelDef): number {
  let n = 0;
  for (const row of def.tiles) {
    for (const ch of row) if (ch !== " ") n++;
  }
  return n;
}

export function parseShare(text: string, extra: SavedStage[] = []): LevelDef | null {
  const t = text.trim();
  const pack = decodePack(t);
  if (pack?.length) return pack[0]!;
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

/** Decode a single stage or an ordered pack of stages from a share code. */
export function parseShareDefs(text: string, extra: SavedStage[] = []): LevelDef[] | null {
  const pack = decodePack(text);
  if (pack?.length) return pack;
  const one = parseShare(text, extra);
  return one ? [one] : null;
}

/** Ordered multi-stage pack code (BXP.a~b~c…). */
export function encodePack(defs: LevelDef[]): string {
  if (!defs.length) return "";
  return "BXP." + defs.map((d) => encodeSeed(d).replace(/^BXS\./i, "")).join("~");
}

export function decodePack(text: string): LevelDef[] | null {
  const trimmed = text.trim();
  const m = /^BXP\.(.+)$/i.exec(trimmed);
  if (!m) return null;
  const parts = m[1].split("~").filter(Boolean);
  if (parts.length < 2) return null;
  const defs: LevelDef[] = [];
  for (const part of parts) {
    const def = decodeSeed("BXS." + part);
    if (!def) return null;
    defs.push(def);
  }
  return defs;
}

export function shareCodeFor(stage: SavedStage): string {
  if (isPack(stage)) {
    const defs = packDefs(stage);
    return stage.seed?.startsWith("BXP.") ? stage.seed : encodePack(defs);
  }
  return stage.seed || encodeSeed(stage.def);
}

export function findBySeed(seed: string, extra: SavedStage[] = []): SavedStage | undefined {
  const want = seed.trim().toUpperCase();
  if (!want) return undefined;
  return [...listAllStages(), ...extra].find((s) => {
    const keys = [
      s.seed,
      s.code,
      s.def ? stageId(s.def) : "",
      s.def ? encodeSeed(s.def) : "",
      ...(s.defs && s.defs.length > 1 ? [encodePack(s.defs)] : []),
    ];
    return keys.some((k) => !!k && k.toUpperCase() === want);
  });
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
  localStorage.setItem(key, JSON.stringify(all.slice(0, 200)));
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
  const defs = stage.defs?.length ? stage.defs : stage.def ? [stage.def] : [];
  const kind = stage.kind === "pack" || defs.length > 1 ? "pack" : "single";
  const code =
    stage.code ||
    (kind === "pack" ? encodePack(defs) : stage.seed || (stage.def ? stageId(stage.def) : String(Date.now())));
  const all = readList(key).filter((s) => s.code !== code);
  all.unshift({
    ...stage,
    code,
    kind,
    defs,
    def: defs[0] ?? stage.def,
    source: stage.source ?? "local",
    seed: stage.seed || (kind === "pack" ? encodePack(defs) : stageId(defs[0] ?? stage.def)),
  });
  writeList(key, all);
}

export function deleteStage(code: string): void {
  writeList(STORE, listSaved().filter((s) => s.code !== code));
  writeList(DOWNLOADED, listDownloaded().filter((s) => s.code !== code));
}

export function isPlayable(def: LevelDef): string | null {
  const exits = def.tiles.reduce((n, r) => n + [...r].filter((c) => c === "e").length, 0);
  const hasStone = def.tiles.some((r) => /[bshfvlrkq]/.test(r));
  if (exits === 0) return t("creator.needExit");
  if (exits > 1) return t("creator.oneExit");
  if (!hasStone) return t("creator.needTiles");
  const [sx, sy] = def.spawn;
  const ch = tileChar(def, sx, sy);
  if (ch === " " || ch === "e") return t("creator.spawnSolid");
  return null;
}
