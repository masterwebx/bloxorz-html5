import en from "../../translations/en.json";
import enClassic from "../../translations/en-classic.json";

export type LocaleId = string;

export interface LocaleMeta {
  id: LocaleId;
  name: string;
}

type Dict = Record<string, string>;

const packs = new Map<string, Dict>([
  ["en", en as Dict],
  ["en-classic", enClassic as Dict],
]);
let current = "en-classic";
let ready = false;

export function localeId(): LocaleId {
  return current;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = packs.get(current) ?? packs.get("en") ?? {};
  const fallback = packs.get("en") ?? {};
  let out = dict[key] ?? fallback[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

export function listLocales(): LocaleMeta[] {
  const metas: LocaleMeta[] = [];
  for (const [id, dict] of packs) {
    metas.push({ id, name: dict["locale.name"] ?? id });
  }
  metas.sort((a, b) => a.name.localeCompare(b.name));
  return metas;
}

export function hasLocale(id: string): boolean {
  return packs.has(id);
}

export function setLocale(id: string): void {
  if (packs.has(id)) current = id;
}

export function registerLocale(id: string, dict: Dict): void {
  packs.set(id, dict);
}

export function detectLocale(nav = typeof navigator !== "undefined" ? navigator.language : "en"): LocaleId {
  const raw = (nav || "en").toLowerCase();
  const base = raw.split("-")[0] ?? "en";
  if (raw.startsWith("en")) return packs.has("en-classic") ? "en-classic" : "en";
  if (base === "zh") return packs.has("zh") ? "zh" : "en-classic";
  if (packs.has(base)) return base;
  return packs.has("en-classic") ? "en-classic" : "en";
}

export function bootLocales(table: Record<string, Dict>, saved?: string | null): LocaleId {
  for (const [id, dict] of Object.entries(table)) registerLocale(id, dict);
  ready = true;
  if (saved && packs.has(saved)) {
    current = saved;
    return current;
  }
  current = detectLocale();
  return current;
}

export function localesReady(): boolean {
  return ready;
}

export async function loadExtraLocales(): Promise<void> {
  try {
    const idx = (await fetch("/translations/index.json").then((r) => (r.ok ? r.json() : []))) as string[];
    for (const id of idx) {
      if (packs.has(id)) continue;
      const dict = (await fetch(`/translations/${id}.json`).then((r) => (r.ok ? r.json() : null))) as Dict | null;
      if (dict) registerLocale(id, dict);
    }
  } catch {
    /* bundled table is enough */
  }
}

const RTL = new Set(["ar", "he", "fa", "ur"]);

export function applyDocumentLocale(id = current): void {
  if (typeof document === "undefined") return;
  const base = id.split("-")[0] ?? id;
  document.documentElement.lang = id === "en-classic" ? "en" : id;
  document.documentElement.dir = RTL.has(base) ? "rtl" : "ltr";
}
