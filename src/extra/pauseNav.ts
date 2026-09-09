export const PAUSE_ACTIONS = ["returnToGame", "toggleSound", "quitToMenu"] as const;
export type PauseAction = (typeof PAUSE_ACTIONS)[number];

export function stepPauseFocus(focus: number, delta: number, count = PAUSE_ACTIONS.length): number {
  return ((focus + delta) % count + count) % count;
}

export function pauseNavFromPad(ev: "up" | "down" | "left" | "right" | "confirm" | "back"): "prev" | "next" | "confirm" | "back" {
  if (ev === "up" || ev === "left") return "prev";
  if (ev === "down" || ev === "right") return "next";
  return ev;
}
