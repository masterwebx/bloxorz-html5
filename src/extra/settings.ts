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

export type MobilePadChoice = "" | "on" | "off";

export interface Settings {
  music: number;
  sfx: number;
  rumble: boolean;
  showTimer: boolean;
  mobilePad: boolean;
  mobilePadChoice: MobilePadChoice;
  rotateScreen: boolean;
  themeBg: boolean;
  bgTint: number;
  bgHue: number;
  blockHue: number;
  playerName: string;
  keys: Record<Action, string>;
  pads: Record<Action, number>;
}

const DEFAULTS: Settings = {
  music: 0.7,
  sfx: 0.9,
  rumble: true,
  showTimer: false,
  mobilePad: false,
  mobilePadChoice: "",
  rotateScreen: false,
  themeBg: true,
  bgTint: 0,
  bgHue: 28,
  blockHue: 0,
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
      showTimer: parsed.showTimer === true,
      mobilePad: parsed.mobilePad === true,
      mobilePadChoice: parsed.mobilePadChoice === "on" || parsed.mobilePadChoice === "off" ? parsed.mobilePadChoice : "",
      rotateScreen: parsed.rotateScreen === true,
      themeBg: parsed.themeBg !== false,
      bgTint: clamp01(parsed.bgTint ?? DEFAULTS.bgTint),
      bgHue: clampHue(parsed.bgHue ?? DEFAULTS.bgHue),
      blockHue: clampHue(parsed.blockHue ?? DEFAULTS.blockHue),
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

export function setMobilePad(on: boolean): Settings {
  const s = loadSettings();
  s.mobilePad = on;
  s.mobilePadChoice = on ? "on" : "off";
  saveSettings(s);
  return s;
}

export function setRotateScreen(on: boolean): Settings {
  const s = loadSettings();
  s.rotateScreen = on;
  saveSettings(s);
  return s;
}

export function invalidateSettingsCache(): void {
  settingsCache = null;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function clampHue(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const wrapped = ((n % 360) + 360) % 360;
  return Math.round(wrapped);
}

export function hueRgb(hue: number): [number, number, number] {
  const h = clampHue(hue) / 360;
  const s = 0.72;
  const l = 0.42;
  const hue2rgb = (p: number, q: number, t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

export function hueCss(hue: number, alpha = 1): string {
  return `hsla(${clampHue(hue)}, 72%, 42%, ${clamp01(alpha)})`;
}

export function brandName(name: string): string {
  const stem = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, NAME_MAX) || "BLOX";
  return `${stem}ORZ+`;
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
