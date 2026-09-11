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

export type ThemeId = string;

export type MobilePadChoice = "" | "on" | "off";

export interface Settings {
  music: number;
  sfx: number;
  rumble: boolean;
  showTimer: boolean;
  showStageName: boolean;
  showPlayTime: boolean;
  mobilePad: boolean;
  mobilePadChoice: MobilePadChoice;
  rotateScreen: boolean;
  themeBg: boolean;
  webcamBg: boolean;
  tabCastBg: boolean;
  tabCrop: { x: number; y: number; w: number; h: number };
  bgTint: number;
  bgHue: number;
  blockHue: number;
  unlimitedEndless: boolean;
  playerName: string;
  locale: string;
  keys: Record<Action, string>;
  pads: Record<Action, number>;
}

const DEFAULT_TAB_CROP = { x: 0, y: 0, w: 1, h: 1 };

const DEFAULTS: Settings = {
  music: 0.7,
  sfx: 0.9,
  rumble: true,
  showTimer: false,
  showStageName: true,
  showPlayTime: false,
  mobilePad: false,
  mobilePadChoice: "",
  rotateScreen: false,
  themeBg: true,
  webcamBg: false,
  tabCastBg: false,
  tabCrop: { ...DEFAULT_TAB_CROP },
  bgTint: 0,
  bgHue: 28,
  blockHue: 0,
  unlimitedEndless: false,
  playerName: "",
  locale: "",
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
      showStageName: parsed.showStageName !== false,
      showPlayTime: parsed.showPlayTime === true,
      mobilePad: parsed.mobilePad === true,
      mobilePadChoice: parsed.mobilePadChoice === "on" || parsed.mobilePadChoice === "off" ? parsed.mobilePadChoice : "",
      rotateScreen: parsed.rotateScreen === true,
      themeBg: parsed.themeBg !== false,
      webcamBg: parsed.webcamBg === true,
      tabCastBg: parsed.tabCastBg === true,
      tabCrop: normalizeTabCrop(parsed.tabCrop),
      bgTint: clamp01(parsed.bgTint ?? DEFAULTS.bgTint),
      bgHue: clampHue(parsed.bgHue ?? DEFAULTS.bgHue),
      blockHue: clampHue(parsed.blockHue ?? DEFAULTS.blockHue),
      unlimitedEndless: parsed.unlimitedEndless === true,
      playerName: typeof parsed.playerName === "string" ? parsed.playerName.slice(0, NAME_MAX) : "",
      locale: typeof parsed.locale === "string" ? parsed.locale : "",
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

let settingsWriteTimer = 0;

/** Mutate cached settings and optionally debounce the localStorage write. */
export function updateSettings(mut: (s: Settings) => void, flushMs = 0): Settings {
  const s = loadSettings();
  mut(s);
  settingsCache = s;
  if (flushMs <= 0) {
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }
  if (typeof window === "undefined") {
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }
  if (settingsWriteTimer) window.clearTimeout(settingsWriteTimer);
  settingsWriteTimer = window.setTimeout(() => {
    settingsWriteTimer = 0;
    if (settingsCache) localStorage.setItem(KEY, JSON.stringify(settingsCache));
  }, flushMs);
  return s;
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

function normalizeTabCrop(raw: unknown): { x: number; y: number; w: number; h: number } {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_TAB_CROP };
  const o = raw as Record<string, unknown>;
  const x = clamp01(typeof o.x === "number" ? o.x : 0);
  const y = clamp01(typeof o.y === "number" ? o.y : 0);
  const w = clamp01(typeof o.w === "number" ? o.w : 1);
  const h = clamp01(typeof o.h === "number" ? o.h : 1);
  return {
    x,
    y,
    w: Math.max(0.05, Math.min(1 - x, w)),
    h: Math.max(0.05, Math.min(1 - y, h)),
  };
}

export function hueToHex(hue: number): string {
  const [r, g, b] = hueRgb(hue);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export function hexToHue(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return DEFAULTS.bgHue;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return clampHue(h * 360);
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
  const id = (value || "").trim();
  return id || "original";
}

export function isAtlasTheme(value: string): value is "original" | "gray" | "holiday" {
  return value === "original" || value === "gray" || value === "holiday";
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
