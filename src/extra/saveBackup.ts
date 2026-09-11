import { invalidateSettingsCache } from "./settings";

export const SAVE_BACKUP_VERSION = 1;

const KEEP = new Set([
  "theme",
  "level",
  "soundEnabled",
]);

export type ThemePackBackup = {
  id: string;
  json: unknown;
  files: Record<string, string>;
};

export type SaveBackup = {
  v: number;
  at: number;
  local: Record<string, string>;
  themes: ThemePackBackup[];
};

function isSaveKey(key: string): boolean {
  return key.startsWith("bloxorz-") || KEEP.has(key);
}

export function dumpLocalSave(store: Storage = localStorage): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || !isSaveKey(key)) continue;
    const val = store.getItem(key);
    if (val != null) out[key] = val;
  }
  return out;
}

export function applyLocalSave(local: Record<string, string>, store: Storage = localStorage): void {
  const drop: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key && isSaveKey(key)) drop.push(key);
  }
  for (const key of drop) store.removeItem(key);
  for (const [key, val] of Object.entries(local)) {
    if (isSaveKey(key) && typeof val === "string") store.setItem(key, val);
  }
  invalidateSettingsCache();
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

type StoredPack = { json: unknown; files: Record<string, ArrayBuffer> };

async function openThemeDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return null;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("bloxorz-themes", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("packs");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dumpThemePacks(): Promise<ThemePackBackup[]> {
  const db = await openThemeDb();
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction("packs", "readonly");
    const req = tx.objectStore("packs").openCursor();
    const out: ThemePackBackup[] = [];
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) {
        resolve(out);
        return;
      }
      const row = cur.value as StoredPack;
      const files: Record<string, string> = {};
      for (const [name, buf] of Object.entries(row.files ?? {})) {
        files[name] = bufToB64(buf);
      }
      out.push({ id: String(cur.key), json: row.json, files });
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function restoreThemePacks(rows: ThemePackBackup[]): Promise<void> {
  const db = await openThemeDb();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("packs", "readwrite");
    const store = tx.objectStore("packs");
    store.clear();
    for (const row of rows) {
      const files: Record<string, ArrayBuffer> = {};
      for (const [name, b64] of Object.entries(row.files ?? {})) {
        files[name] = b64ToBuf(b64);
      }
      store.put({ json: row.json, files }, row.id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function buildSaveBackup(): Promise<SaveBackup> {
  return {
    v: SAVE_BACKUP_VERSION,
    at: Date.now(),
    local: dumpLocalSave(),
    themes: await dumpThemePacks(),
  };
}

export function parseSaveBackup(raw: string): SaveBackup {
  const data = JSON.parse(raw) as SaveBackup;
  if (!data || typeof data !== "object" || !data.local || typeof data.local !== "object") {
    throw new Error("save");
  }
  return {
    v: SAVE_BACKUP_VERSION,
    at: typeof data.at === "number" ? data.at : Date.now(),
    local: data.local,
    themes: Array.isArray(data.themes) ? data.themes : [],
  };
}

export async function applySaveBackup(data: SaveBackup): Promise<void> {
  applyLocalSave(data.local);
  await restoreThemePacks(data.themes);
}

/** Wipe campaign + plus save keys (and optional custom theme packs). */
export function clearLocalSave(store: Storage = localStorage): void {
  applyLocalSave({}, store);
}

export async function clearSaveData(): Promise<void> {
  clearLocalSave();
  await restoreThemePacks([]);
}
