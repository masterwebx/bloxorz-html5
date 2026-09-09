import { describe, expect, it } from "vitest";
import { pauseNavFromPad, PAUSE_ACTIONS, stepPauseFocus } from "./pauseNav";

describe("pause menu focus", () => {
  it("cycles through return, sound, and quit", () => {
    expect(PAUSE_ACTIONS).toEqual(["returnToGame", "toggleSound", "quitToMenu"]);
    expect(stepPauseFocus(0, 1)).toBe(1);
    expect(stepPauseFocus(2, 1)).toBe(0);
    expect(stepPauseFocus(0, -1)).toBe(2);
  });

  it("maps pad dirs onto that list", () => {
    expect(pauseNavFromPad("up")).toBe("prev");
    expect(pauseNavFromPad("left")).toBe("prev");
    expect(pauseNavFromPad("down")).toBe("next");
    expect(pauseNavFromPad("right")).toBe("next");
    expect(pauseNavFromPad("confirm")).toBe("confirm");
    expect(pauseNavFromPad("back")).toBe("back");
  });
});
