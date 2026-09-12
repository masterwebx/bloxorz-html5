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

export function rumble(ms: number, strong = 0.45, weak = 0.3, force = false): void {
  const settings = loadSettings();
  if (!settings.rumble) return;
  if (!force && !padDriving) return;
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
let menuHoldFrames = 0;
let menuHoldEv: MenuPadEvent | null = null;
let padDriving = false;
/** Last time mapped pad input armed rumble (ms). */
let lastPadAt = 0;

const MENU_REPEAT_INITIAL = 6;
const MENU_REPEAT_RATE = 4;
/** Ignore keyboard clear shortly after pad input (OS remappers fire keydown after poll). */
const KEYBOARD_CLEAR_GRACE_MS = 320;

function nowMs(): number {
  return Date.now();
}

/** True while any Settings-mapped pad control is held (buttons or stick dirs). */
function mappedPadHeld(): boolean {
  const held = collectHeld();
  if (!held.size) return false;
  for (const btn of Object.values(loadSettings().pads)) {
    if (held.has(btn)) return true;
  }
  return false;
}

function markPadDriving(): void {
  padDriving = true;
  lastPadAt = nowMs();
}

export function noteKeyboardPlay(): void {
  // Keep rumble armed for pad players when a mapped control is held, or when a
  // remapped keydown arrives just after the pad poll that armed driving.
  if (mappedPadHeld()) return;
  if (nowMs() - lastPadAt < KEYBOARD_CLEAR_GRACE_MS) return;
  padDriving = false;
}

export function isPadDriving(): boolean {
  return padDriving;
}

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

/** In-game: map pad to CreateJS arrow/space codes. Pause opens the stage pause menu. */
export function pollGamepad(
  stage: StageLike | undefined,
  onPause?: () => void,
  onCmd?: (cmd: "up" | "down" | "left" | "right" | "swap") => void,
): void {
  const settings = loadSettings();
  const held = collectHeld();
  const pressed: Record<string, boolean> = {};
  if (stage?.triggerKeyDown) {
    for (const dir of ["up", "down", "left", "right"] as const) {
      if (held.has(settings.pads[dir])) pressed[DIR_CODE[dir]] = true;
    }
    if (held.has(settings.pads.swap)) pressed.Space = true;
  }
  const pause = held.has(settings.pads.pause);
  // Refresh every poll while mapped controls are held — not only on press edges —
  // so fall/win/hover rumbles still fire after a keyboard blip cleared padDriving.
  if (Object.keys(pressed).length > 0 || pause) markPadDriving();

  if (stage?.triggerKeyDown) {
    for (const code of Object.keys(pressed)) {
      if (!prevHeld[code]) {
        stage.triggerKeyDown?.({ code });
        if (code === "Space") onCmd?.("swap");
        else if (code === "ArrowUp") onCmd?.("up");
        else if (code === "ArrowDown") onCmd?.("down");
        else if (code === "ArrowLeft") onCmd?.("left");
        else if (code === "ArrowRight") onCmd?.("right");
      }
    }
    for (const code of Object.keys(prevHeld)) {
      if (code === "pause") continue;
      if (!pressed[code]) stage.triggerKeyUp?.({ code });
    }
  }
  if (pause && !prevHeld.pause) onPause?.();
  prevHeld = pause ? { ...pressed, pause: true } : pressed;
}

export type MenuPadEvent = "up" | "down" | "left" | "right" | "confirm" | "back";

function menuRepeatDelay(_heldFrames: number): number {
  return MENU_REPEAT_RATE;
}

/** Extra menus: edge-triggered pad events with hold-to-repeat for stick/d-pad. */
export function pollMenuPad(opts?: { pauseConfirms?: boolean }): MenuPadEvent[] {
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
  if ((opts?.pauseConfirms ?? true) && held.has(settings.pads.pause)) now.confirm = true;
  if (Object.keys(now).length > 0) markPadDriving();

  const out: MenuPadEvent[] = [];
  const dirs: MenuPadEvent[] = ["up", "down", "left", "right"];
  const heldDir = dirs.find((ev) => now[ev]) ?? null;

  for (const ev of Object.keys(now) as MenuPadEvent[]) {
    if (!prevMenu[ev] && menuCool === 0) {
      out.push(ev);
      if (dirs.includes(ev)) {
        menuHoldEv = ev;
        menuHoldFrames = 0;
        menuCool = MENU_REPEAT_INITIAL;
      } else {
        menuHoldEv = null;
        menuHoldFrames = 0;
        menuCool = 12;
      }
    }
  }

  if (heldDir && menuHoldEv === heldDir && !out.length) {
    menuHoldFrames++;
    if (menuCool === 0) {
      out.push(heldDir);
      menuCool = menuRepeatDelay(menuHoldFrames);
    }
  } else if (!heldDir) {
    menuHoldEv = null;
    menuHoldFrames = 0;
  }

  prevMenu = now;
  return out;
}

/** Ignore a Start/confirm that is still held after leaving a screen. */
export function absorbHeldMenuConfirm(): void {
  prevMenu = { ...prevMenu, confirm: true };
  prevHeld = { ...prevHeld, pause: true };
  menuCool = 16;
  menuHoldEv = null;
  menuHoldFrames = 0;
}

export function resetPadState(): void {
  prevHeld = {};
  prevMenu = {};
  menuCool = 0;
  menuHoldEv = null;
  menuHoldFrames = 0;
  padDriving = false;
  lastPadAt = 0;
}

export function actionFromCode(code: string): Action | null {
  const keys = loadSettings().keys;
  for (const [act, bind] of Object.entries(keys) as [Action, string][]) {
    if (bind === code || (bind === "Space" && (code === "Space" || code === " "))) return act;
  }
  return null;
}
