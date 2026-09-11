/** Per-asset color customize slots (block, backdrop, tiles). Off = original art. */

import { luminance, parseHexRgb, recolorRgb, rustFacesFromHex } from "./hue";
import { TILE_FACE } from "./isoBoard";

export type ColorSlotId =
  | "bg"
  | "block"
  | "stone"
  | "exit"
  | "soft"
  | "heavy"
  | "fragile"
  | "split"
  | "bridgeL"
  | "bridgeR";

export type ColorSlotState = { hex: string; on: boolean };

export type ColorCustom = Record<ColorSlotId, ColorSlotState>;

export const COLOR_SLOT_META: {
  id: ColorSlotId;
  labelKey: string;
  defaultHex: string;
  /** Board char used in creator / preview, if any. */
  tile?: string;
}[] = [
  { id: "bg", labelKey: "settings.colorBg", defaultHex: "#b86a2e" },
  { id: "block", labelKey: "settings.colorBlock", defaultHex: "#b86a2e" },
  { id: "stone", labelKey: "settings.colorStone", defaultHex: "#d46820", tile: "b" },
  { id: "exit", labelKey: "settings.colorExit", defaultHex: "#0c0c0c", tile: "e" },
  { id: "soft", labelKey: "settings.colorSoft", defaultHex: "#4a8ee8", tile: "s" },
  { id: "heavy", labelKey: "settings.colorHeavy", defaultHex: "#9b48e0", tile: "h" },
  { id: "fragile", labelKey: "settings.colorFragile", defaultHex: "#e8b44a", tile: "f" },
  { id: "split", labelKey: "settings.colorSplit", defaultHex: "#2f9d7a", tile: "v" },
  { id: "bridgeL", labelKey: "settings.colorBridgeL", defaultHex: "#8a4820", tile: "l" },
  { id: "bridgeR", labelKey: "settings.colorBridgeR", defaultHex: "#6a3018", tile: "r" },
];

const TILE_TO_SLOT: Record<string, ColorSlotId> = {
  b: "stone",
  e: "exit",
  s: "soft",
  h: "heavy",
  f: "fragile",
  v: "split",
  l: "bridgeL",
  k: "bridgeL",
  r: "bridgeR",
  q: "bridgeR",
};

export function defaultColorCustom(): ColorCustom {
  const out = {} as ColorCustom;
  for (const slot of COLOR_SLOT_META) {
    out[slot.id] = { hex: slot.defaultHex, on: false };
  }
  return out;
}

export function normalizeColorCustom(raw: unknown): ColorCustom {
  const base = defaultColorCustom();
  if (!raw || typeof raw !== "object") return base;
  const src = raw as Partial<Record<ColorSlotId, Partial<ColorSlotState>>>;
  for (const slot of COLOR_SLOT_META) {
    const row = src[slot.id];
    if (!row || typeof row !== "object") continue;
    const hex =
      typeof row.hex === "string" && /^#?[0-9a-fA-F]{6}$/.test(row.hex.trim())
        ? row.hex.trim().startsWith("#")
          ? row.hex.trim().toLowerCase()
          : `#${row.hex.trim().toLowerCase()}`
        : slot.defaultHex;
    base[slot.id] = { hex, on: row.on === true };
  }
  return base;
}

export function slotForTile(ch: string): ColorSlotId | null {
  return TILE_TO_SLOT[ch] ?? null;
}

/** Preview stage layout: one of each asset so the picker shows in-game look. */
export const COLOR_PREVIEW_STAGE: { ch: string; x: number; y: number }[] = [
  { ch: "b", x: 1, y: 2 },
  { ch: "b", x: 2, y: 2 },
  { ch: "b", x: 3, y: 2 },
  { ch: "e", x: 5, y: 2 },
  { ch: "s", x: 1, y: 4 },
  { ch: "h", x: 3, y: 4 },
  { ch: "f", x: 5, y: 4 },
  { ch: "v", x: 1, y: 6 },
  { ch: "l", x: 3, y: 6 },
  { ch: "r", x: 4, y: 6 },
  { ch: "b", x: 5, y: 6 },
];

export const COLOR_PREVIEW_SPAWN: [number, number] = [2, 2];

export function activeTileHex(colors: ColorCustom, ch: string): string | null {
  const id = slotForTile(ch);
  if (!id) return null;
  const row = colors[id];
  return row?.on ? row.hex : null;
}

function parseCssRgb(css: string): [number, number, number] | null {
  if (css.startsWith("#")) return parseHexRgb(css);
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(css);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Resolve iso face colors, applying customize tint when the slot is on. */
export function resolveTileFace(
  ch: string,
  colors: ColorCustom | null | undefined,
): { top: string; left: string; right: string; stroke: string } {
  const base = TILE_FACE[ch] || TILE_FACE[" "]!;
  const hex = colors ? activeTileHex(colors, ch) : null;
  if (!hex) return base;
  const rgb = parseHexRgb(hex);
  if (!rgb) return base;
  const paint = (css: string) => {
    const src = parseCssRgb(css) ?? [136, 136, 136];
    const [r, g, b] = recolorRgb(src[0], src[1], src[2], rgb[0], rgb[1], rgb[2], src);
    return `rgb(${r},${g},${b})`;
  };
  return {
    top: paint(base.top),
    left: paint(base.left),
    right: paint(base.right),
    stroke: paint(base.stroke),
  };
}

export function activeBlockHex(
  colors: ColorCustom | null | undefined,
  fallbackHex: string,
  fallbackHue: number,
): string | null {
  const row = colors?.block;
  if (row) {
    if (!row.on) return null;
    return row.hex;
  }
  // Legacy path before colorCustom existed: hue 0 + default rust = off.
  if (fallbackHue === 0 && fallbackHex.toLowerCase() === "#b86a2e") return null;
  return fallbackHex;
}

export function activeBg(
  colors: ColorCustom | null | undefined,
  bgColor: string,
  bgTint: number,
): { hex: string; tint: number } | null {
  const row = colors?.bg;
  if (row) {
    if (!row.on) return null;
    return { hex: row.hex, tint: Math.max(bgTint, 0.55) };
  }
  if (bgTint <= 0.01) return null;
  return { hex: bgColor, tint: bgTint };
}

export function blockPreviewFaces(hex: string): { top: string; left: string; right: string; edge: string } {
  return rustFacesFromHex(hex);
}

export function slotContrastOk(hex: string): boolean {
  const rgb = parseHexRgb(hex);
  if (!rgb) return false;
  return luminance(rgb[0], rgb[1], rgb[2]) > 8;
}

/** Named snapshot of every color-custom slot (hex + on). */
export type ColorPreset = { name: string; colors: ColorCustom };

export const COLOR_PRESET_NAME_MAX = 24;
export const COLOR_PRESET_MAX = 24;

export function normalizePresetName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, COLOR_PRESET_NAME_MAX);
}

export function cloneColorCustom(colors: ColorCustom): ColorCustom {
  return normalizeColorCustom(colors);
}

export function normalizeColorPresets(raw: unknown): ColorPreset[] {
  if (!Array.isArray(raw)) return [];
  const out: ColorPreset[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const name = normalizePresetName(typeof (row as ColorPreset).name === "string" ? (row as ColorPreset).name : "");
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, colors: normalizeColorCustom((row as ColorPreset).colors) });
    if (out.length >= COLOR_PRESET_MAX) break;
  }
  return out;
}

/** Upsert by case-insensitive name; newest name casing wins. */
export function upsertColorPreset(list: ColorPreset[], name: string, colors: ColorCustom): ColorPreset[] {
  const clean = normalizePresetName(name);
  if (!clean) return normalizeColorPresets(list);
  const next = { name: clean, colors: cloneColorCustom(colors) };
  const key = clean.toLowerCase();
  const filtered = list.filter((row) => row.name.toLowerCase() !== key);
  return normalizeColorPresets([next, ...filtered]);
}

export function findColorPreset(list: ColorPreset[], name: string): ColorPreset | null {
  const key = normalizePresetName(name).toLowerCase();
  if (!key) return null;
  return list.find((row) => row.name.toLowerCase() === key) ?? null;
}
