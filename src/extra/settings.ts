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

export interface Settings {
  music: number;
  sfx: number;
  rumble: boolean;
  playerName: string;
  keys: Record<Action, string>;
  pads: Record<Action, number>;
}

const DEFAULTS: Settings = {
  music: 0.7,
  sfx: 0.9,
  rumble: true,
  playerName: "",
  keys: {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    confirm: "Enter",
    back: "Escape",
    pause: "Escape",
    swap: " ",
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

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      music: clamp01(parsed.music ?? DEFAULTS.music),
      sfx: clamp01(parsed.sfx ?? DEFAULTS.sfx),
      rumble: parsed.rumble !== false,
      playerName: typeof parsed.playerName === "string" ? parsed.playerName : "",
      keys: { ...DEFAULTS.keys, ...parsed.keys },
      pads: { ...DEFAULTS.pads, ...parsed.pads },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function brandName(name: string): string {
  const stem = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "BLOX";
  return `${stem}ORZ`;
}

export function isDevName(name: string): boolean {
  return name.trim().toUpperCase() === "DEV";
}
