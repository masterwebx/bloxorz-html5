import original from "../../themes/original/theme.json";
import gray from "../../themes/gray/theme.json";
import holiday from "../../themes/holiday/theme.json";
import solid3d from "../../themes/solid3d/theme.json";
import { inflateZipEntry, listZipEntries, zipBase, type ZipEntry } from "./unzip";

export type ThemeRender = "atlas" | "solid3d";
export type ThemeBgType = "sky" | "image" | "gif" | "video";

export interface ThemePaint {
  ink: string;
  hot: string;
  muted: string;
  green: string;
  field: string;
  stroke: string;
  track: string;
  fill: string;
  billboardCore: string;
  billboardGlow: string;
  shadow: string;
}

export interface ThemePack {
  id: string;
  name: string;
  atlas?: string;
  atlasScale: number;
  hd: boolean;
  render: ThemeRender;
  paint: ThemePaint;
  background: { type: ThemeBgType; src?: string };
  audio: { music?: string; sfx?: Record<string, string> };
  builtin: boolean;
  files?: Record<string, string>;
}

const DEFAULT_PAINT: ThemePaint = {
  ink: "#ffe6c4",
  hot: "#ffffff",
  muted: "rgba(255,210,160,0.45)",
  green: "#9dffb0",
  field: "#1a120c",
  stroke: "#c45a18",
  track: "#2a1810",
  fill: "#c45a18",
  billboardCore: "#fff4dc",
  billboardGlow: "rgba(255,140,30,0.35)",
  shadow: "rgba(255,150,40,0.95)",
};

const IDB_NAME = "bloxorz-themes";
const IDB_STORE = "packs";

const packs = new Map<string, ThemePack>();
const objectUrls: string[] = [];
let currentId = "original";
let customAudio: HTMLAudioElement | null = null;

type RawTheme = {
  id?: string;
  name?: string;
  atlas?: string;
  atlasScale?: number;
  hd?: boolean;
  render?: string;
  paint?: Partial<ThemePaint>;
  background?: { type?: string; src?: string };
  audio?: { music?: string; sfx?: Record<string, string> };
};

function normalizePack(raw: RawTheme, fallbackId: string, builtin: boolean, files?: Record<string, string>): ThemePack {
  const id = (raw.id || fallbackId).trim() || fallbackId;
  const bgType = raw.background?.type;
  return {
    id,
    name: raw.name || id,
    atlas: raw.atlas || undefined,
    atlasScale: Number(raw.atlasScale) > 0 ? Number(raw.atlasScale) : 1,
    hd: raw.hd === true || Number(raw.atlasScale) > 1,
    render: raw.render === "solid3d" ? "solid3d" : "atlas",
    paint: { ...DEFAULT_PAINT, ...raw.paint },
    background: {
      type: bgType === "image" || bgType === "gif" || bgType === "video" ? bgType : "sky",
      src: raw.background?.src,
    },
    audio: { music: raw.audio?.music, sfx: raw.audio?.sfx ?? {} },
    builtin,
    files,
  };
}

function seedBuiltins(): void {
  if (packs.size) return;
  for (const raw of [original, gray, holiday, solid3d] as RawTheme[]) {
    const pack = normalizePack(raw, raw.id || "original", true);
    packs.set(pack.id, pack);
  }
}

export function listThemes(): ThemePack[] {
  seedBuiltins();
  return [...packs.values()].sort((a, b) => {
    if (a.builtin !== b.builtin) return a.builtin ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function isDevOnlyTheme(id: string): boolean {
  return id === "solid3d";
}

export function themeMenuItems(dev = false): { id: string; name: string; builtin: boolean }[] {
  return listThemes()
    .filter((pack) => !isDevOnlyTheme(pack.id) || dev)
    .map((pack) => ({ id: pack.id, name: pack.name, builtin: pack.builtin }));
}

export function getTheme(id: string): ThemePack {
  seedBuiltins();
  return packs.get(id) || packs.get("original")!;
}

export function hasTheme(id: string): boolean {
  seedBuiltins();
  return packs.has(id);
}

export function currentThemeId(): string {
  return currentId;
}

export function setCurrentThemeId(id: string): void {
  seedBuiltins();
  if (packs.has(id)) currentId = id;
}

export function themePaint(id = currentId): ThemePaint {
  return getTheme(id).paint;
}

export function isSolid3d(id = currentId): boolean {
  return getTheme(id).render === "solid3d";
}

export function isHdTheme(id = currentId): boolean {
  return getTheme(id).hd;
}

export function themeFileUrl(id: string, file: string): string {
  if (!file) return "";
  if (file.startsWith("blob:") || file.startsWith("data:") || file.startsWith("http")) return file;
  const rel = file.replace(/^\/+/, "");
  if (rel.startsWith("themes/")) return rel;
  return `themes/${id}/${rel}`;
}

export function atlasUrlFor(id: string): string {
  const pack = getTheme(id);
  if (pack.atlas?.startsWith("blob:") || pack.atlas?.startsWith("data:") || pack.atlas?.startsWith("http")) return pack.atlas;
  if (pack.atlas && pack.files?.[pack.atlas]) return pack.files[pack.atlas]!;
  if (pack.atlas && pack.files) {
    const hit = Object.entries(pack.files).find(([k]) => k.endsWith("/" + pack.atlas) || k === pack.atlas);
    if (hit) return hit[1];
  }
  if (pack.atlas && pack.builtin) return themeFileUrl(pack.id, pack.atlas);
  return "";
}

export function mediaUrlFor(pack: ThemePack): string | null {
  const src = pack.background.src;
  if (!src) return null;
  if (src.startsWith("blob:") || src.startsWith("data:") || src.startsWith("http")) return src;
  if (src.startsWith("/")) return src.replace(/^\/+/, "");
  if (pack.files?.[src]) return pack.files[src]!;
  if (pack.builtin) return themeFileUrl(pack.id, src);
  return null;
}

export function themeSoundUrl(id: string): string | null {
  const pack = getTheme(currentId);
  if (id === "Music" || id === "music") {
    const src = pack.audio.music;
    if (!src) return null;
    if (src.startsWith("blob:") || src.startsWith("http") || src.startsWith("themes/")) return src;
    if (pack.files?.[src]) return pack.files[src]!;
    if (pack.builtin) return themeFileUrl(pack.id, src);
    return null;
  }
  const src = pack.audio.sfx?.[id];
  if (!src) return null;
  if (src.startsWith("blob:") || src.startsWith("http") || src.startsWith("themes/")) return src;
  if (pack.files?.[src]) return pack.files[src]!;
  if (pack.builtin) return themeFileUrl(pack.id, src);
  return null;
}

export function playThemeSound(id: string, loop = false): HTMLAudioElement | null {
  const url = themeSoundUrl(id);
  if (!url) return null;
  const audio = new Audio(url);
  audio.loop = loop;
  if (id === "Music" || id === "music") {
    customAudio?.pause();
    customAudio = audio;
  }
  void audio.play().catch(() => undefined);
  return audio;
}

export function stopThemeMusic(): void {
  customAudio?.pause();
  customAudio = null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

type StoredPack = { json: RawTheme; files: Record<string, ArrayBuffer> };

async function idbEntries(): Promise<{ key: string; row: StoredPack }[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).openCursor();
      const out: { key: string; row: StoredPack }[] = [];
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) {
          resolve(out);
          return;
        }
        out.push({ key: String(cur.key), row: cur.value as StoredPack });
        cur.continue();
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function idbPut(id: string, row: StoredPack): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(row, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function filesToUrls(files: Record<string, ArrayBuffer>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, buf] of Object.entries(files)) {
    const url = URL.createObjectURL(new Blob([new Uint8Array(buf)]));
    objectUrls.push(url);
    out[name] = url;
    const base = zipBase(name);
    if (base !== name && !out[base]) out[base] = url;
  }
  return out;
}

function lookupFile(files: Record<string, string>, name?: string): string | undefined {
  if (!name) return undefined;
  if (files[name]) return files[name];
  const want = fileKey(name);
  const hit = Object.entries(files).find(([k]) => fileKey(k) === want || fileKey(zipBase(k)) === want);
  return hit?.[1];
}

function registerStored(row: StoredPack): ThemePack | null {
  if (!row?.json) return null;
  const urls = filesToUrls(row.files ?? {});
  const pack = normalizePack(row.json, row.json.id || "custom", false, urls);
  const atlas = lookupFile(urls, pack.atlas);
  if (atlas) pack.atlas = atlas;
  const bg = lookupFile(urls, pack.background.src);
  if (bg) pack.background.src = bg;
  const music = lookupFile(urls, pack.audio.music);
  if (music) pack.audio.music = music;
  if (pack.audio.sfx) {
    const mapped: Record<string, string> = {};
    for (const [k, v] of Object.entries(pack.audio.sfx)) mapped[k] = lookupFile(urls, v) ?? v;
    pack.audio.sfx = mapped;
  }
  if (packs.get(pack.id)?.builtin || packs.has(pack.id)) {
    pack.id = uniqueCustomId(pack.id, "");
  }
  packs.set(pack.id, pack);
  return pack;
}

let themesBooted = false;

export async function bootThemes(saved?: string | null, dev = false): Promise<string> {
  seedBuiltins();
  if (!themesBooted) {
    try {
      const idx = (await fetch("themes/index.json").then((r) => (r.ok ? r.json() : []))) as string[];
      for (const id of idx) {
        if (packs.has(id) || id.startsWith("_")) continue;
        const raw = (await fetch(`themes/${id}/theme.json`).then((r) => (r.ok ? r.json() : null))) as RawTheme | null;
        if (!raw) continue;
        const pack = normalizePack(raw, id, true);
        packs.set(pack.id, pack);
      }
    } catch {
      /* bundled builtins are enough */
    }
    for (const { key, row } of await idbEntries()) {
      if (!row?.json) continue;
      const claimed = sanitizeThemeId(row.json.id || key || "custom") || "custom";
      let id = claimed;
      if (packs.has(id)) {
        id = uniqueCustomId(claimed, "");
        row.json = { ...row.json, id };
        try {
          await idbPut(id, row);
          if (key !== id) await idbDelete(key);
        } catch {
          /* keep the remapped pack live even if IDB rewrite fails */
        }
      }
      registerStored({ ...row, json: { ...row.json, id } });
    }
    themesBooted = true;
  }
  if (saved && packs.has(saved) && (dev || !isDevOnlyTheme(saved))) currentId = saved;
  else currentId = "original";
  return currentId;
}

function themeFolder(jsonName: string): string {
  const n = jsonName.replace(/\\/g, "/");
  const i = n.lastIndexOf("/");
  return i > 0 ? n.slice(0, i) : "";
}

function sanitizeThemeId(id: string): string {
  return id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function uniqueCustomId(rawId: string, folder = ""): string {
  seedBuiltins();
  const wanted = sanitizeThemeId(rawId);
  const folderId = sanitizeThemeId(folder);
  const base =
    (!wanted || packs.has(wanted)) && folderId && !packs.has(folderId) ? folderId : wanted || folderId || "custom";
  if (!packs.has(base)) return base;
  const stem = folderId && !packs.has(folderId) ? folderId : `${base}-pack`;
  if (!packs.has(stem)) return stem;
  let n = 2;
  while (packs.has(`${stem}-${n}`)) n += 1;
  return `${stem}-${n}`;
}

function fileKey(name: string): string {
  return name.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

function isThemeAsset(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|mp3|wav|ogg|mp4|webm)$/i.test(name);
}

function neededThemeFiles(raw: RawTheme): Set<string> {
  const names = new Set<string>();
  if (raw.atlas) names.add(fileKey(raw.atlas));
  if (raw.background?.src) names.add(fileKey(raw.background.src));
  if (raw.audio?.music) names.add(fileKey(raw.audio.music));
  for (const src of Object.values(raw.audio?.sfx ?? {})) {
    if (src) names.add(fileKey(src));
  }
  return names;
}

function matchesNeeded(entryName: string, folder: string, needed: Set<string>): boolean {
  const n = fileKey(entryName);
  const base = fileKey(zipBase(entryName));
  const prefix = fileKey(folder);
  const rel = prefix && n.startsWith(prefix + "/") ? n.slice(prefix.length + 1) : n;
  if (/(^|\/)atlas\.png$/.test(rel) || rel.endsWith(".json")) return false;
  if (isThemeAsset(rel)) return true;
  return needed.has(n) || needed.has(base) || needed.has(rel);
}

function copyBuf(data: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}

export async function installThemeZip(buffer: ArrayBuffer): Promise<ThemePack> {
  const entries = listZipEntries(buffer);
  const jsonEntry = entries.find((e) => zipBase(e.name).toLowerCase() === "theme.json");
  if (!jsonEntry) throw new Error("theme.json");
  const jsonBytes = await inflateZipEntry(buffer, jsonEntry);
  const jsonText = new TextDecoder().decode(jsonBytes);
  const raw = JSON.parse(jsonText) as RawTheme;
  const folder = themeFolder(jsonEntry.name);
  const id = uniqueCustomId(raw.id || folder || "custom", folder);
  const display = folder && (raw.id === "original" || !raw.name) ? folder : raw.name || id;
  const savedJson: RawTheme = { ...raw, id, name: display };
  const needed = neededThemeFiles(raw);
  const stored: Record<string, ArrayBuffer> = {};
  const want = entries.filter((e) => matchesNeeded(e.name, folder, needed));
  const inflates: { entry: ZipEntry; key: string }[] = [];
  for (const entry of want) {
    const rel = folder && entry.name.startsWith(folder + "/") ? entry.name.slice(folder.length + 1) : zipBase(entry.name);
    if (rel.toLowerCase().endsWith(".json")) continue;
    inflates.push({ entry, key: rel });
  }
  for (const row of inflates) {
    try {
      const data = await inflateZipEntry(buffer, row.entry);
      stored[row.key] = copyBuf(data);
      const base = zipBase(row.key);
      if (base !== row.key && !stored[base]) stored[base] = stored[row.key]!;
    } catch {
      /* skip a bad optional asset */
    }
  }
  try {
    await idbPut(id, { json: savedJson, files: stored });
  } catch {
    /* keep the pack live even if IDB quota rejects a huge pack */
  }
  const live = registerStored({ json: savedJson, files: stored }) ?? normalizePack(savedJson, id, false);
  return live;
}

export { DEFAULT_PAINT };
