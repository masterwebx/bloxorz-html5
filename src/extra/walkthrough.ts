/** Official Free Web Arcade / JayIsGames solutions. UDLR = grid axes, S = swap cubes.
 * Stage 03 uses a BFS-verified path: the published Rx3/Dx3 FAQ falls off this GBA reconstruction. */
export const CAMPAIGN_WALKTHROUGH = [
  "Rx2, D, Rx3, D",
  "U, R, D, Rx3, Ux3, R, Dx2, Rx4, U, L, U",
  "U, L, D, R, U, Rx4, Ux2, L, D, R, U, Rx3, Dx3, R",
  "U, L, U, Rx2, U, Rx6, D, R, Dx5, R, U, Lx6, D",
  "Lx3, R, Lx5, D, R, Dx2, Rx4, D, Rx4, Lx4, D, Lx6",
  "Rx3, Dx2, R, Dx2, R, D, R, U, Lx3, Ux2, L, Ux3, Rx3, Dx2, R, D, R, D, R, Ux2, L, D, R, U, L, D, R",
  "D, L, U, Rx5, D, R, L, U, Lx5, D, R, D, R, D, Rx3, Ux2, R, D, L, U, R, Ux2, Rx3, D, R, D, R, D, L, U",
  "Rx2, Dx3, Rx2, S, Ux3, Rx2",
  "R, D, Rx6, U, R, D, Lx5, U, S, D, Rx5, D",
  "Rx2, L, Dx3, R, Dx5, Lx4, U, Lx3, D, U, Rx3, D, Rx3, U, S, Rx2, Dx3, R, Dx3, L, D, U, R, Ux4, Lx2, D, R, Ux2, Lx7",
  "Rx4, U, L, Dx3, Rx4, Ux2, L, Ux2, Lx3, D, R, U, Rx2, D, R, U, Lx3, Dx2, Lx3, Ux2, R, Ux2, L, D, R, U, R, D, L",
  "L, D, R, U, R, U, R, U, R, U, L, D, R, U, Rx3, Dx2, L, D, R, U, L, D, R, U, L, D, L, U, R, Ux3, Lx3, Rx3, Dx3, L, D, R, Ux2, R, D, L, D, R, Ux3, R, U, D, L, Dx3, L, U, R, Ux2, Lx3, U, L, D, Rx2, U, L, Dx3, L",
  "U, L, D, R, D, L, U, Rx2, D, L, Ux4, Lx7, Dx3, R, U, L, D, R, Dx2, R, Dx2, R, U, Lx2, D, R, Ux2, L, D, R, U, Rx2, Ux2",
  "Rx3, Ux2, R, D, Lx2, U, R, Dx2, Rx2, Dx4, Lx3, D, R, U, Rx2, Ux2, Dx2, Lx2, D, R, D, Rx2, Lx2, U, Lx2, U, Rx3, Ux4, Lx6, U, R, D, Lx5, Dx3, R, D, R",
  "Rx4, Ux2, S, Ux5, Rx3, Ux2, Rx4, Dx2, Ux2, Rx2, S, Lx2, R, Lx3, U, R, D, Lx2, U, R, D, Lx3, D, Lx3, Dx4, L, U, R, D, Rx7",
  "Rx4, S, R, D, S, R, U, S, R, Lx3, S, Rx3, S, Rx5, Lx4, Rx8, S, D, Rx9",
  "Dx5, L, U, Rx5, U, Rx3, Lx3, D, Lx4, Ux6, Rx4, D, Rx4, U, L, D, Rx2, U, L, Dx2, R, U, L, D, U, R, D, L, Ux2, R, D, Lx2, U, R, D, Lx4, U, Lx4, Dx6, Rx4, U, Rx3, Dx2, U, L, U, Lx3, D, Lx3, U, L, Ux3, Rx5, D, Rx3",
  "R, D, L, U, Rx2, D, L, U, Rx3, Ux2, Dx2, Lx3, D, R, U, Lx2, D, R, U, Rx3, Dx2, Ux2, Lx3, D, L, U, Rx2, D, L, Ux2, R, D, L, U, Lx2, Dx4, Rx2, Lx2, Ux4, Rx2, D, R, U, L, Dx2, R, U, L, D, R, U, Rx5, Dx3, R, U, L, Dx2, R, U, L, D, L, U, R",
  "Rx8, D, R, U, Lx6, D, R, U, Rx5, Dx5, Lx5, D, L, U, Rx6, U, L, D, Lx5, Dx4, Rx3, Lx6, Ux2",
  "D, L, D, R, D, L, Ux2, R, Ux2, Lx4, Dx2, R, U, Lx2, Dx3, L, D, U, R, Ux2, R, Ux2, Rx3, Dx3, L, U, S, L, U, D, R, S, Lx5, Dx5, Rx5, D",
  "R, D, L, U, L, D, R, U, Rx2, U, Rx3, U, L, Dx3, Ux3, R, D, Lx3, D, Lx2, D, L, U, R, D, R, U, L, D, R, U, L, D, R, Dx2, R, Dx2, Rx3, Ux2, Dx2, Lx2, U, L, D, Rx3, Ux4, Rx3",
  "R, U, L, D, L, U, Rx3, U, Rx2, D, R, D, Rx2, U, L, D, L, U, L, D, Rx2, Dx3, L, D, U, R, Ux3, Lx2, U, R, D, R, D, R, U, Lx3, U, Lx3, D, L, D, Lx2, U, R, Dx2, L, U, Rx2, D, L, Ux2, R, D, L, U, R, D, L, Dx3, R, D, U, L, Ux3, R, U, L, D, L, U, Rx3, U, Rx2, D, Rx2, Dx2, L, U, Rx3, U",
  "D, L, U, R, Dx2, R, U, Rx6, U, L, D, R, Lx3, Ux5, Rx4, U, D, Lx6, Dx4, Lx7, Ux3, Rx2, U, D, L, U, R, Dx2, R, Dx3, Rx8, U, L, D, R, Lx4, Ux3, S, D, Rx2, Dx3, Rx4, Ux2",
  "Dx2, Rx2, Ux2, R, U, Rx4, U, R, D, Lx2, U, R, D, L, R, U, L, D, L, U, R, D, Lx4, D, Lx3, D, L, D, R, D, L, Ux2, Dx2, R, U, L, U, R, U, Rx3, U, Rx4, U, L, D, R, U, R, D, Lx6, D, R, L, U, Rx6, U, L, D, L, U, R, D, R, S, D, S, R, D, L, R, U, Rx3",
  "U, R, D, L, U, R, D, Lx2, U, Rx4, Ux2, Lx2, U, R, L, D, Rx2, Dx2, Lx4, D, Rx2, U, Rx3, Ux2, Rx3, U, L, D, R, Ux2, L, D, R, U, R, D, L",
  "Ux2, Lx3, D, Lx3, D, R, U, Rx2, Ux2, Rx2, D, Rx2, D, Rx2, Ux2, Lx2, U, Lx6, D, Lx3, Dx3, S, Ux3, Lx6, D, Lx3, Dx3, Ux2, R, U, L, D, R, U, Rx2, Ux2, Rx2, D, Rx2, D, Rx2, Ux2, Lx2, U, Lx4, Dx5, Rx3, S, Ux3, Lx4, Dx5, Rx2, L",
  "Rx5, U, L, D, R, U, R, D, Lx6, U, R, D, Lx2, U, R, D, Rx4, U, Rx4, Dx3, L, Dx3, Lx3, D, L, Ux4, R, D, Lx7, U, L, Dx2, R, U, L, D, R, U, L",
  "L, Dx3, R, D, L, U, R, Dx2, Rx2, Dx2, Rx3, Ux3, L, U, L, U, L, U, L, D, Rx2, D, R, D, R, D, Rx2, D, L, D, Lx2, Ux3, L, U, L, U, Lx2, U, Lx2, D, L, U, Rx3, D, R, D, R, D, R, D, R, Lx4, Dx3, Lx5, Ux2, Lx3, D, S, Lx7, Ux2, Lx3, U",
  "L, D, R, U, Rx2, D, L, U, R, Dx2, Rx2, Lx2, Ux2, L, D, R, U, L, D, L, U, L, Ux2, Lx2, Rx2, Dx2, R, D, R, U, R, D, L, U, R, Ux2, Rx2, Lx2, Dx6, Rx2, Lx2, Ux4, L, D, L, U, L, D, R, U, Rx5, Lx5, D, R, U, Lx2, D, R, U, Lx5, Rx5, U, L, D, L, Dx3, Lx3, U, R, D, Lx2, U, R, Dx2, L, U, R, D, R, U, L",
  "D, R, Dx2, Rx2, U, Rx2, D, Rx4, U, D, Lx4, U, Lx3, Dx2, L, U, Rx6, Ux3, Rx3, U, R, Dx3, Lx2, D, L, D, R, Ux2, R, D, L, D, Lx4, U, Lx2, D, Lx2, U, L, D, L, U, R, U, D, L, D, R, U, R, D, Rx2, U, L, Dx2, L, U, Rx7, U, L, Ux3, Rx3, U, R, U, Lx5, D, L",
  "U, L, D, Lx2, Ux4, Dx4, Rx3, U, L, D, R, Ux4, R, U, L, Dx2, Lx6, D, L, U, Rx2, D, L, U, Rx4, Dx3, L, Dx2, Ux2, R, Ux3, Lx4, U, R, D, Lx2, U, R, Dx2, L, U, R, Dx4, L, D, R, Ux2, L, D, R, U, L, D, R, L, D, R, U, L, D, R, Ux2, L, D, L, U, Rx4, U, Rx2, D, Rx3, U, L, D, R, Ux5, R, D, L",
  "Ux2, L, D, R, U, R, U, R, D, L, R, U, L, D, L, D, L, U, R, D, L, U, R, U, R, U, R, D, Lx2, Dx4, Lx4, U, R, D, Rx3, Ux5, R, U, Rx2, U, D, Lx2, D, L, Dx5, Lx4, U, R, L, D, Rx4, Ux5, R, U, Rx2, U, D, Lx2, D, L, Dx5, Lx3, U, L, D, Rx4, Ux4, Rx2, U, L, D, L, D, L, D, R, U, Lx2, U, Lx5, D",
  "Rx4, U, L, Dx3, Rx2, U, L, U, L, Ux2, Rx2, D, R, D, R, U, Lx2, U, R, D, R, Dx2, R, D, L, Dx2, Rx2, U, D, Lx2, Ux4, L, U, L, D, R, D, R, U, L, U, Lx3, Dx3, L, D, Lx2, D, L, U",
] as const;

export type WalkCmd = "up" | "down" | "left" | "right" | "swap";

const DIR: Record<string, Exclude<WalkCmd, "swap">> = {
  U: "up",
  D: "down",
  L: "left",
  R: "right",
};

export function expandWalkthrough(script: string): WalkCmd[] {
  const cmds: WalkCmd[] = [];
  for (const token of script.split(",")) {
    const t = token.trim();
    const m = t.match(/^([UDLRS])(?:x(\d+))?$/i);
    if (!m) throw new Error(`Bad walkthrough token: ${t}`);
    const letter = m[1].toUpperCase();
    const n = m[2] ? Number(m[2]) : 1;
    const cmd: WalkCmd = letter === "S" ? "swap" : DIR[letter];
    for (let i = 0; i < n; i++) cmds.push(cmd);
  }
  return cmds;
}
