import { describe, expect, it, vi } from "vitest";
import {
  detachClassicWindowKeyListeners,
  shouldEndCreatorStrokeFromPad,
} from "./stageKeyBridge";
import { resolveStagePlayCode } from "./playKeys";

describe("detachClassicWindowKeyListeners", () => {
  it("removes classic window keydown so physical Space is forwarded once via triggerKeyDown", () => {
    const swaps: string[] = [];
    const down = (evt: { code: string }) => {
      if (evt.code === "Space") swaps.push("swap");
    };
    const up = vi.fn();
    const stage = { triggerKeyDown: down, triggerKeyUp: up };

    const keydown = new Set<EventListener>();
    const keyup = new Set<EventListener>();
    const target = {
      addEventListener(type: string, listener: EventListener) {
        (type === "keydown" ? keydown : keyup).add(listener);
      },
      removeEventListener(type: string, listener: EventListener) {
        (type === "keydown" ? keydown : keyup).delete(listener);
      },
      dispatch(type: "keydown" | "keyup", code: string) {
        const bag = type === "keydown" ? keydown : keyup;
        for (const fn of bag) fn({ code } as unknown as Event);
      },
    };

    // Mirror bloxorz.js: same fn on window + stage.triggerKeyDown.
    target.addEventListener("keydown", down as EventListener);
    target.addEventListener("keyup", up as EventListener);
    expect(keydown.size).toBe(1);

    detachClassicWindowKeyListeners(stage, target);
    expect(keydown.size).toBe(0);
    expect(keyup.size).toBe(0);

    // Native Space must not hit classic directly (would double-toggle with host forward).
    target.dispatch("keydown", "Space");
    expect(swaps).toEqual([]);

    // Host play path (and pad) still invoke swap once — same as remapped swap.
    const code = resolveStagePlayCode("Space", "swap");
    expect(code).toBe("Space");
    stage.triggerKeyDown({ code: code! });
    expect(swaps).toEqual(["swap"]);

    stage.triggerKeyUp({ code: "Space" });
    expect(up).toHaveBeenCalledWith({ code: "Space" });
  });
});

describe("shouldEndCreatorStrokeFromPad", () => {
  it("ends only keyboard/pad holds — not mouse drag strokes", () => {
    expect(shouldEndCreatorStrokeFromPad(true, false)).toBe(true);
    expect(shouldEndCreatorStrokeFromPad(true, true)).toBe(false);
    // Mouse drag: creatorPaintStroke active but editorPaintHeld false.
    expect(shouldEndCreatorStrokeFromPad(false, false)).toBe(false);
    expect(shouldEndCreatorStrokeFromPad(false, true)).toBe(false);
  });

  it("treats keyboard Enter/Space as confirmHeld so pad poll does not clear the hold", () => {
    // Pad A not pressed, but keyboard paint key still down → must not end.
    expect(shouldEndCreatorStrokeFromPad(true, true)).toBe(false);
  });
});
