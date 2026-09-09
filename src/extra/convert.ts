import { padTiles } from "./customLevels";
import type { LevelDef, SwitchMode } from "./types";

export type CreateJsLevel = unknown[];

function swatchKey(x: number, y: number): string {
  return "swatch" + x + y;
}

function parseSwatchKey(key: string): { x: number; y: number } | null {
  const m = /^swatch(\d+)(\d)$/.exec(key);
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]) };
}

export function defToCreateJs(def: LevelDef): CreateJsLevel {
  const tiles = padTiles(def.tiles);
  const swatches: Record<string, [number, number, string][]> = {};
  for (const sw of def.switches ?? []) {
    swatches[swatchKey(sw.x, sw.y)] = sw.bridges.map((b) => [b.x, b.y, b.mode]);
  }
  const splits: Record<string, number[]> = {};
  for (const sp of def.splits ?? []) {
    splits[swatchKey(sp.x, sp.y)] = [sp.a[0], sp.a[1], sp.b[0], sp.b[1]];
  }
  return [def.code || "000000", ...tiles, def.spawn, swatches, splits];
}

export function createJsToDef(level: CreateJsLevel, index = 0): LevelDef {
  const tiles = (level.slice(1, 11) as string[]).map((row) => (String(row) + "               ").slice(0, 15));
  const spawn = (level[11] as [number, number]) || [0, 0];
  const swatches = (level[12] as Record<string, [number, number, string][]>) || {};
  const splitsRaw = (level[13] as Record<string, number[]>) || {};
  const switches: LevelDef["switches"] = [];
  for (const [key, links] of Object.entries(swatches)) {
    const at = parseSwatchKey(key);
    if (!at || !Array.isArray(links)) continue;
    switches.push({
      x: at.x,
      y: at.y,
      bridges: links.map((link) => ({
        x: Number(link[0]),
        y: Number(link[1]),
        mode: (link[2] as SwitchMode) || "onoff",
      })),
    });
  }
  const splits: LevelDef["splits"] = [];
  for (const [key, pair] of Object.entries(splitsRaw)) {
    const at = parseSwatchKey(key);
    if (!at || !Array.isArray(pair) || pair.length < 4) continue;
    splits.push({ x: at.x, y: at.y, a: [pair[0], pair[1]], b: [pair[2], pair[3]] });
  }
  const code = String(level[0] ?? "").replace(/\D/g, "").padStart(6, "0").slice(0, 6);
  return {
    id: `stage-${index + 1}`,
    code,
    tiles,
    spawn,
    switches,
    splits,
  };
}

export function campaignDefs(): LevelDef[] {
  const getLevels = (window as unknown as { getLevels?: () => CreateJsLevel[] }).getLevels;
  if (typeof getLevels !== "function") return [];
  try {
    return getLevels().map((level, i) => createJsToDef(level, i));
  } catch {
    return [];
  }
}
