import { loadSettings, type Action } from "./settings";

const CODE: Record<Exclude<Action, "confirm" | "back" | "pause" | "swap">, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

type StageLike = {
  triggerKeyDown?: (evt: { code: string }) => void;
  triggerKeyUp?: (evt: { code: string }) => void;
};

export function rumble(ms: number, strong = 0.45, weak = 0.3): void {
  const settings = loadSettings();
  if (!settings.rumble) return;
  for (const pad of navigator.getGamepads()) {
    if (!gActuator(pad)) continue;
    void gActuator(pad)!.playEffect("dual-rumble", {
      startDelay: 0,
      duration: ms,
      strongMagnitude: strong,
      weakMagnitude: weak,
    });
  }
}

function gActuator(pad: Gamepad | null): GamepadHapticActuator | undefined {
  if (!pad) return undefined;
  return (pad as Gamepad & { vibrationActuator?: GamepadHapticActuator }).vibrationActuator;
}

let prevHeld: Record<string, boolean> = {};

export function pollGamepad(stage: StageLike | undefined, overlayOpen: boolean): void {
  if (!stage?.triggerKeyDown || overlayOpen) return;
  const settings = loadSettings();
  const pads = navigator.getGamepads();
  const pressed: Record<string, boolean> = {};
  for (const g of pads) {
    if (!g) continue;
    const buttons = g.buttons;
    const ax = g.axes[0] ?? 0;
    const ay = g.axes[1] ?? 0;
    const held = new Set<number>();
    buttons.forEach((b, i) => {
      if (b.pressed) held.add(i);
    });
    if (ay < -0.55) held.add(12);
    if (ay > 0.55) held.add(13);
    if (ax < -0.55) held.add(14);
    if (ax > 0.55) held.add(15);
    for (const dir of ["up", "down", "left", "right"] as const) {
      if (held.has(settings.pads[dir])) pressed[CODE[dir]] = true;
    }
    if (held.has(settings.pads.swap)) pressed.Space = true;
    if (held.has(settings.pads.pause)) pressed.Escape = true;
  }

  for (const code of Object.keys(pressed)) {
    if (!prevHeld[code]) stage.triggerKeyDown?.({ code });
  }
  for (const code of Object.keys(prevHeld)) {
    if (!pressed[code]) stage.triggerKeyUp?.({ code });
  }
  if (pressed.Escape && !prevHeld.Escape) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
  }
  prevHeld = pressed;
}
