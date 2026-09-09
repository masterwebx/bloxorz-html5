export type Action =
  | "up"
  | "down"
  | "left"
  | "right"
  | "confirm"
  | "back"
  | "pause"
  | "swap";

export const ACTIONS: Action[] = ["up", "down", "left", "right", "confirm", "back", "pause", "swap"];

export const ACTION_LABEL: Record<Action, string> = {
  up: "Move Up",
  down: "Move Down",
  left: "Move Left",
  right: "Move Right",
  confirm: "Confirm / Select",
  back: "Back / Cancel",
  pause: "Pause / Menu",
  swap: "Swap Split Block",
};

export type ThemeId = "original" | "gray" | "holiday";

export interface Settings {
  music: number;
  sfx: number;
  rumble: boolean;
  showTimer: boolean;
  playerName: string;
  keys: Record<Action, string>;
  pads: Record<Action, number>;
}

const DEFAULTS: Settings = {
  music: 0.7,
  sfx: 0.9,
  rumble: true,
  showTimer: true,
  playerName: "",
  keys: {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    confirm: "Enter",
    back: "Escape",
    pause: "Escape",
    swap: "Space",
  },
  pads: {
    up: 12,
    down: 13,
    left: 14,
    right: 15,
    confirm: 0,
    back: 1,
    pause: 9,
    swap: 2,
  },
};

const KEY = "bloxorz-settings-v1";
export const NAME_MAX = 10;

let settingsCache: Settings | null = null;

export function loadSettings(): Settings {
  if (settingsCache) return settingsCache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      settingsCache = structuredClone(DEFAULTS);
      return settingsCache;
    }
    const parsed = JSON.parse(raw) as Partial<Settings>;
    settingsCache = {
      music: clamp01(parsed.music ?? DEFAULTS.music),
      sfx: clamp01(parsed.sfx ?? DEFAULTS.sfx),
      rumble: parsed.rumble !== false,
      showTimer: parsed.showTimer !== false,
      playerName: typeof parsed.playerName === "string" ? parsed.playerName.slice(0, NAME_MAX) : "",
      keys: { ...DEFAULTS.keys, ...parsed.keys },
      pads: { ...DEFAULTS.pads, ...parsed.pads },
    };
    return settingsCache;
  } catch {
    settingsCache = structuredClone(DEFAULTS);
    return settingsCache;
  }
}

export function saveSettings(s: Settings): void {
  settingsCache = s;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function invalidateSettingsCache(): void {
  settingsCache = null;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function brandName(name: string): string {
  const stem = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, NAME_MAX) || "BLOX";
  return `${stem}ORZ`;
}

export function isDevName(name: string): boolean {
  return name.trim().toUpperCase() === "DEV";
}

export function prettyKey(code: string): string {
  if (code === " ") return "Space";
  if (code === "Space") return "Space";
  if (code.startsWith("Arrow")) return code.slice(5);
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}

export function normalizeTheme(value: string | null | undefined): ThemeId {
  if (value === "gray" || value === "holiday" || value === "original") return value;
  return "original";
}

export function currentTheme(): ThemeId {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("img")) return normalizeTheme(params.get("img"));
    return normalizeTheme(localStorage.getItem("theme"));
  } catch {
    return "original";
  }
}
