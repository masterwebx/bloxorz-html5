import { applyCmd, type StepResult } from "./solve";
import { Stage } from "./engine";
import type { LevelDef } from "./types";
import type { WalkCmd } from "./walkthrough";

/** Coolmath holds a key code until the idle block consumes it on the next world tick. */
export interface SolveFeeder {
  pending: WalkCmd[] | null;
  queue: WalkCmd[];
  held: WalkCmd | null;
}

export function createFeeder(cmds: WalkCmd[]): SolveFeeder {
  return { pending: cmds.slice(), queue: [], held: null };
}

export interface FeedView {
  idle: boolean;
  hasBlock: boolean;
}

export interface FeedAction {
  press?: WalkCmd;
  release?: boolean;
  hold?: WalkCmd;
  done?: boolean;
}

const ARROW_FROM_CODE: Record<string, Exclude<WalkCmd, "swap">> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

export function coolmathKeyDown(keys: { code: string }, code: string): void {
  keys.code = code;
}

export function coolmathKeyUp(keys: { code: string }, code: string): void {
  if (code === keys.code) keys.code = "";
}

/** World tick: Coolmath only starts a roll while the block is idle and a code is held. */
export function consumeCoolmathTick(keys: { code: string }, idle: boolean): WalkCmd | null {
  if (!idle) return null;
  return ARROW_FROM_CODE[keys.code] ?? null;
}

/**
 * Drive one Coolmath-style step. Never release an arrow while the block is still idle —
 * that is what made auto-solve no-op on both classic and custom stages.
 */
export function tickFeeder(feeder: SolveFeeder, view: FeedView): FeedAction {
  if (feeder.pending) {
    if (!view.hasBlock || !view.idle) return {};
    feeder.queue = feeder.pending.slice();
    feeder.pending = null;
  }
  if (feeder.held) {
    if (!view.idle) {
      feeder.held = null;
      return { release: true };
    }
    return { hold: feeder.held };
  }
  if (!feeder.queue.length) return { done: true };
  if (!view.hasBlock || !view.idle) return {};
  const cmd = feeder.queue.shift();
  if (!cmd) return { done: true };
  if (cmd === "swap") return { press: cmd, release: true };
  feeder.held = cmd;
  return { press: cmd };
}

export function cmdToCode(cmd: WalkCmd): string {
  if (cmd === "up") return "ArrowUp";
  if (cmd === "down") return "ArrowDown";
  if (cmd === "left") return "ArrowLeft";
  if (cmd === "swap") return "Space";
  return "ArrowRight";
}

/**
 * Drive the feeder onto a Coolmath-style keys object, then let the world tick
 * consume the held code. Extra HUD ticks first; World.keys.tick runs after.
 */
export function applyFeederToKeys(feeder: SolveFeeder, keys: { code: string }, view: FeedView): FeedAction {
  const act = tickFeeder(feeder, view);
  if (act.release) coolmathKeyUp(keys, keys.code);
  if (act.press === "swap") {
    coolmathKeyDown(keys, cmdToCode("swap"));
    coolmathKeyUp(keys, "Space");
  } else if (act.press) {
    coolmathKeyDown(keys, cmdToCode(act.press));
  } else if (act.hold) {
    coolmathKeyDown(keys, cmdToCode(act.hold));
  }
  return act;
}

/** Same protocol Coolmath uses: hold the code, world tick consumes it only while idle. */
export function simulateCoolmathAutoSolve(def: LevelDef, cmds: WalkCmd[], limit = 8000): StepResult {
  const stage = new Stage(def);
  const feeder = createFeeder(cmds);
  const keys = { code: "" };
  let idle = true;
  let last: StepResult = "ok";
  for (let i = 0; i < limit; i++) {
    const act = applyFeederToKeys(feeder, keys, { idle, hasBlock: true });
    if (act.press === "swap") {
      last = applyCmd(stage, "swap");
      if (last === "win" || last === "fail") return last;
    }
    const consumed = consumeCoolmathTick(keys, idle);
    if (consumed) {
      last = applyCmd(stage, consumed);
      idle = false;
      if (last === "win" || last === "fail") return last;
    } else if (!idle) {
      idle = true;
    }
    if (act.done && !feeder.held && idle) return stage.won ? "win" : last;
  }
  return last;
}
