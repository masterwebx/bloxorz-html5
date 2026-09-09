import { Stage, type Dir } from "./engine";
import type { LevelDef } from "./types";
import { expandWalkthrough, type WalkCmd } from "./walkthrough";

export type StepResult = "ok" | "fail" | "win";

export function applyCmd(stage: Stage, cmd: WalkCmd): StepResult {
  if (cmd === "swap") {
    stage.anim = null;
    stage.swapSplit();
    return "ok";
  }
  stage.anim = null;
  if (!stage.tryMove(cmd)) return "fail";
  const result = stage.finishMove(() => undefined);
  stage.anim = null;
  if (result === "split") {
    stage.beginSplit();
    stage.anim = null;
    if (!stage.split) return "fail";
    return "ok";
  }
  if (result === "fail") return "fail";
  if (result === "win") return "win";
  return "ok";
}

export function playScript(def: LevelDef, script: string): { result: StepResult; step: number; cmds: WalkCmd[] } {
  const cmds = expandWalkthrough(script);
  const stage = new Stage(def);
  let last: StepResult = "ok";
  for (let i = 0; i < cmds.length; i++) {
    last = applyCmd(stage, cmds[i]);
    if (last === "fail" || last === "win") return { result: last, step: i, cmds };
  }
  return { result: stage.won ? "win" : last, step: cmds.length - 1, cmds };
}

type Pose =
  | { kind: "block"; x: number; y: number; ori: "up" | "forward" | "right" }
  | { kind: "split"; ax: number; ay: number; bx: number; by: number; active: 0 | 1 };

function bridgesKey(stage: Stage): string {
  return stage.bridges.map((b) => (b.on ? "1" : "0")).join("");
}

function poseOf(stage: Stage): Pose {
  if (stage.split) {
    return { kind: "split", ax: stage.cubeA.x, ay: stage.cubeA.y, bx: stage.cubeB.x, by: stage.cubeB.y, active: stage.active };
  }
  return { kind: "block", x: stage.block.x, y: stage.block.y, ori: stage.block.ori };
}

function stateKey(stage: Stage): string {
  return JSON.stringify({ p: poseOf(stage), b: bridgesKey(stage) });
}

const DIRS: Dir[] = ["up", "down", "left", "right"];

export interface SolveResult {
  ok: boolean;
  cmds: WalkCmd[];
  expanded: number;
}

/** BFS over poses + bridge bits. Used to prove a stage is beatable and to generate puzzles. */
export function solveLevel(def: LevelDef, limit = 250_000): SolveResult {
  const start = new Stage(def);
  const queue: { stage: Stage; cmds: WalkCmd[] }[] = [{ stage: start, cmds: [] }];
  let q = 0;
  const seen = new Set<string>([stateKey(start)]);
  let expanded = 0;

  while (q < queue.length) {
    const cur = queue[q++];
    expanded++;
    if (expanded > limit) return { ok: false, cmds: [], expanded };

    const options: WalkCmd[] = cur.stage.split ? [...DIRS, "swap"] : DIRS;
    for (const cmd of options) {
      const next = cloneStage(def, cur.stage);
      const result = applyCmd(next, cmd);
      if (result === "fail") continue;
      if (result === "win") return { ok: true, cmds: [...cur.cmds, cmd], expanded };
      const key = stateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ stage: next, cmds: [...cur.cmds, cmd] });
    }
  }
  return { ok: false, cmds: [], expanded };
}

function cloneStage(def: LevelDef, src: Stage): Stage {
  const s = new Stage(def);
  s.block = { ...src.block };
  s.split = src.split;
  s.cubeA = { ...src.cubeA };
  s.cubeB = { ...src.cubeB };
  s.active = src.active;
  s.moves = src.moves;
  s.won = src.won;
  s.failed = src.failed;
  s.bridges = src.bridges.map((b) => ({ ...b }));
  return s;
}

export function shortestLen(def: LevelDef, limit = 250_000): number {
  const r = solveLevel(def, limit);
  return r.ok ? r.cmds.length : -1;
}
