import { loadSettings, type Action } from "./settings";

const DIR_CODE: Record<"up" | "down" | "left" | "right", string> = {
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
  let pulsed = false;
  for (const pad of navigator.getGamepads()) {
    const actuator = gActuator(pad);
    if (!actuator?.playEffect) continue;
    pulsed = true;
    void actuator.playEffect("dual-rumble", {
      startDelay: 0,
      duration: ms,
      strongMagnitude: strong,
      weakMagnitude: weak,
    });
  }
  if (!pulsed && typeof navigator.vibrate === "function") navigator.vibrate(ms);
}

export function heldPadButtons(): Set<number> {
  return collectHeld();
}

function gActuator(pad: Gamepad | null): GamepadHapticActuator | undefined {
  if (!pad) return undefined;
  return (pad as Gamepad & { vibrationActuator?: GamepadHapticActuator }).vibrationActuator;
}

let prevHeld: Record<string, boolean> = {};
let prevMenu: Record<string, boolean> = {};
let menuCool = 0;

function collectHeld(): Set<number> {
  const held = new Set<number>();
  for (const g of navigator.getGamepads()) {
    if (!g) continue;
    g.buttons.forEach((b, i) => {
      if (b.pressed) held.add(i);
    });
    const ax = g.axes[0] ?? 0;
    const ay = g.axes[1] ?? 0;
    if (ay < -0.55) held.add(12);
    if (ay > 0.55) held.add(13);
    if (ax < -0.55) held.add(14);
    if (ax > 0.55) held.add(15);
  }
  return held;
}

/** In-game: map pad to CreateJS arrow/space codes. */
export function pollGamepad(stage: StageLike | undefined): void {
  if (!stage?.triggerKeyDown) return;
  const settings = loadSettings();
  const held = collectHeld();
  const pressed: Record<string, boolean> = {};
  for (const dir of ["up", "down", "left", "right"] as const) {
    if (held.has(settings.pads[dir])) pressed[DIR_CODE[dir]] = true;
  }
  if (held.has(settings.pads.swap)) pressed.Space = true;
  if (held.has(settings.pads.pause)) pressed.Escape = true;

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

export type MenuPadEvent = "up" | "down" | "left" | "right" | "confirm" | "back";

/** Extra menus: edge-triggered pad events with repeat delay. */
export function pollMenuPad(): MenuPadEvent[] {
  if (menuCool > 0) menuCool--;
  const settings = loadSettings();
  const held = collectHeld();
  const now: Record<string, boolean> = {};
  const map: { btn: number; ev: MenuPadEvent }[] = [
    { btn: settings.pads.up, ev: "up" },
    { btn: settings.pads.down, ev: "down" },
    { btn: settings.pads.left, ev: "left" },
    { btn: settings.pads.right, ev: "right" },
    { btn: settings.pads.confirm, ev: "confirm" },
    { btn: settings.pads.back, ev: "back" },
  ];
  for (const m of map) if (held.has(m.btn)) now[m.ev] = true;

  const out: MenuPadEvent[] = [];
  for (const ev of Object.keys(now) as MenuPadEvent[]) {
    if (!prevMenu[ev] && menuCool === 0) {
      out.push(ev);
      menuCool = ev === "confirm" || ev === "back" ? 12 : 8;
    }
  }
  prevMenu = now;
  return out;
}

export function actionFromCode(code: string): Action | null {
  const keys = loadSettings().keys;
  for (const [act, bind] of Object.entries(keys) as [Action, string][]) {
    if (bind === code || (bind === "Space" && (code === "Space" || code === " "))) return act;
  }
  return null;
}
