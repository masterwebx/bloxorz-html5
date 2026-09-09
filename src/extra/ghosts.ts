import { gamePos } from "./coolmathBoard";
import { occupied, type Stage } from "./engine";

export function ghostFootprints(stage: Stage): { x: number; y: number }[] {
  if (stage.split) return [stage.cubeA, stage.cubeB];
  const anim = stage.anim;
  if (anim?.kind === "roll" && anim.dur) {
    const t = anim.t / anim.dur;
    return occupied(t < 0.55 ? anim.from : anim.to);
  }
  return occupied(stage.block);
}

export function ghostScreenPos(cell: { x: number; y: number }): { x: number; y: number } {
  const [x, y] = gamePos(cell.x, cell.y);
  return { x, y };
}
