import { describe, expect, it } from "vitest";
import {
  applyFeederToKeys,
  consumeCoolmathTick,
  createFeeder,
  simulateCoolmathAutoSolve,
  tickFeeder,
} from "./autoSolve";
import { emptyDraft } from "./customLevels";
import { Stage, LEVELS } from "./engine";
import { generatePuzzle } from "./generate";
import { applyCmd, solveLevel } from "./solve";
import { CAMPAIGN_WALKTHROUGH, expandWalkthrough } from "./walkthrough";

describe("Coolmath auto-solve feeder", () => {
  it("does not press until a block is idle", () => {
    const f = createFeeder(["right", "right"]);
    expect(tickFeeder(f, { idle: false, hasBlock: false })).toEqual({});
    expect(tickFeeder(f, { idle: true, hasBlock: false })).toEqual({});
    expect(tickFeeder(f, { idle: false, hasBlock: true })).toEqual({});
    expect(tickFeeder(f, { idle: true, hasBlock: true })).toEqual({ press: "right" });
  });

  it("keeps the key held while idle so Coolmath can consume it", () => {
    const f = createFeeder(["right"]);
    expect(tickFeeder(f, { idle: true, hasBlock: true })).toEqual({ press: "right" });
    expect(tickFeeder(f, { idle: true, hasBlock: true })).toEqual({ hold: "right" });
    expect(f.held).toBe("right");
    expect(tickFeeder(f, { idle: false, hasBlock: true })).toEqual({ release: true });
    expect(f.held).toBeNull();
  });

  it("never releases an arrow on a timeout while still idle", () => {
    const f = createFeeder(["down"]);
    tickFeeder(f, { idle: true, hasBlock: true });
    for (let i = 0; i < 40; i++) {
      expect(tickFeeder(f, { idle: true, hasBlock: true })).toEqual({ hold: "down" });
    }
    expect(f.held).toBe("down");
  });

  it("does not start a Coolmath roll if the key is released while still idle", () => {
    const keys = { code: "ArrowRight" };
    expect(consumeCoolmathTick(keys, true)).toBe("right");
    keys.code = "";
    expect(consumeCoolmathTick(keys, true)).toBeNull();
  });

  it("cannot beat stage 01 if each arrow is released before the world tick", () => {
    const cmds = expandWalkthrough(CAMPAIGN_WALKTHROUGH[0]);
    const stage = new Stage(LEVELS[0]);
    for (const cmd of cmds) {
      if (cmd === "swap") continue;
      const keys = { code: "" };
      expect(consumeCoolmathTick(keys, true)).toBeNull();
    }
    expect(stage.won).toBe(false);
  });

  it("plays the official stage 01 tape through the Coolmath hold protocol", () => {
    const cmds = expandWalkthrough(CAMPAIGN_WALKTHROUGH[0]);
    expect(simulateCoolmathAutoSolve(LEVELS[0], cmds)).toBe("win");
  });

  it("plays a BFS tape on a custom starter path", () => {
    const def = emptyDraft();
    const solved = solveLevel(def, 80_000);
    expect(solved.ok).toBe(true);
    expect(simulateCoolmathAutoSolve(def, solved.cmds)).toBe("win");
  });

  it("plays a BFS tape on a generated puzzle", () => {
    const p = generatePuzzle("feeder-puzzle", "easy");
    const solved = solveLevel(p.def, 80_000);
    expect(solved.ok).toBe(true);
    expect(simulateCoolmathAutoSolve(p.def, solved.cmds)).toBe("win");
  });

  it("re-asserts the held Coolmath code every idle tick until the roll starts", () => {
    const f = createFeeder(["left", "up"]);
    const keys = { code: "" };
    applyFeederToKeys(f, keys, { idle: true, hasBlock: true });
    expect(keys.code).toBe("ArrowLeft");
    keys.code = "";
    applyFeederToKeys(f, keys, { idle: true, hasBlock: true });
    expect(keys.code).toBe("ArrowLeft");
    expect(consumeCoolmathTick(keys, true)).toBe("left");
  });

  it("wins classic stage 01 when the feeder ticks before the Coolmath world tick", () => {
    const cmds = expandWalkthrough(CAMPAIGN_WALKTHROUGH[0]);
    const stage = new Stage(LEVELS[0]);
    const feeder = createFeeder(cmds);
    const keys = { code: "" };
    let idle = true;
    let last = "ok";
    for (let i = 0; i < 200; i++) {
      const act = applyFeederToKeys(feeder, keys, { idle, hasBlock: true });
      if (act.press === "swap") {
        last = applyCmd(stage, "swap");
        if (last === "win") break;
      }
      const consumed = consumeCoolmathTick(keys, idle);
      if (consumed) {
        last = applyCmd(stage, consumed);
        idle = false;
        if (last === "win") break;
      } else if (!idle) {
        idle = true;
      }
    }
    expect(last).toBe("win");
  });
});
