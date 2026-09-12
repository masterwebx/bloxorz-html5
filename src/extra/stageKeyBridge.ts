/**
 * Classic bloxorz.js registers the same `down`/`up` fns on `window` and on
 * `stage.triggerKeyDown` / `triggerKeyUp`. Extra also forwards keyboard via
 * triggerKeyDown. Physical Space therefore ran swap twice (no visible change)
 * while remapped swap / pad (single triggerKeyDown) worked.
 *
 * Detach the window listeners once so host forwarding is the sole path.
 */
export function detachClassicWindowKeyListeners(
  stage: {
    triggerKeyDown?: ((evt: { code: string }) => void) | EventListener;
    triggerKeyUp?: ((evt: { code: string }) => void) | EventListener;
  },
  target: {
    removeEventListener: (type: string, listener: EventListener) => void;
  } = typeof window !== "undefined" ? window : { removeEventListener: () => undefined },
): void {
  if (typeof stage.triggerKeyDown === "function") {
    target.removeEventListener("keydown", stage.triggerKeyDown as EventListener);
  }
  if (typeof stage.triggerKeyUp === "function") {
    target.removeEventListener("keyup", stage.triggerKeyUp as EventListener);
  }
}

/** Pad confirm-release must not end a mouse paint stroke (only keyboard/pad holds). */
export function shouldEndCreatorStrokeFromPad(editorPaintHeld: boolean, confirmHeld: boolean): boolean {
  return editorPaintHeld && !confirmHeld;
}
