import { LEVELS } from "./levels";
import type { LevelDef, SwitchMode } from "./types";

export const W = 15;
export const H = 10;

export type Tile =
  | "empty"
  | "stone"
  | "end"
  | "soft"
  | "heavy"
  | "fragile"
  | "split"
  | "bridgeL"
  | "bridgeR";

export type Ori = "up" | "forward" | "right";
export type Dir = "up" | "down" | "left" | "right";

export interface Cell {
  x: number;
  y: number;
}

export interface Bridge {
  x: number;
  y: number;
  kind: "l" | "r";
  on: boolean;
  frame: number;
  flash: number;
  flashOn: boolean;
}

export interface BlockState {
  x: number;
  y: number;
  ori: Ori;
}

export type AnimKind = "idle" | "roll" | "fall" | "sink" | "drop" | "splitdrop";

export interface Anim {
  kind: AnimKind;
  t: number;
  dur: number;
  dir?: Dir;
  from: BlockState;
  to: BlockState;
  from2?: Cell;
  to2?: Cell;
}

function charTile(ch: string): Tile {
  switch (ch) {
    case "b":
      return "stone";
    case "e":
      return "end";
    case "s":
      return "soft";
    case "h":
      return "heavy";
    case "f":
      return "fragile";
    case "v":
      return "split";
    case "l":
    case "k":
      return "bridgeL";
    case "r":
    case "q":
      return "bridgeR";
    default:
      return "empty";
  }
}

export function parseLevel(def: LevelDef): {
  tiles: Tile[];
  bridges: Bridge[];
} {
  const tiles: Tile[] = [];
  const bridges: Bridge[] = [];
  for (let y = 0; y < H; y++) {
    const row = def.tiles[y] ?? "";
    for (let x = 0; x < W; x++) {
      const ch = row[x] ?? " ";
      const tile = charTile(ch);
      tiles.push(tile);
      if (tile === "bridgeL" || tile === "bridgeR") {
        bridges.push({
          x,
          y,
          kind: tile === "bridgeL" ? "l" : "r",
          on: ch === "k" || ch === "q",
          frame: ch === "k" || ch === "q" ? 7 : 0,
          flash: 0,
          flashOn: false,
        });
      }
    }
  }
  return { tiles, bridges };
}

export function idx(x: number, y: number): number {
  return x + y * W;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < W && y < H;
}

export function occupied(block: BlockState): Cell[] {
  if (block.ori === "up") return [{ x: block.x, y: block.y }];
  if (block.ori === "forward") return [
    { x: block.x, y: block.y },
    { x: block.x, y: block.y + 1 },
  ];
  return [
    { x: block.x, y: block.y },
    { x: block.x + 1, y: block.y },
  ];
}

export function rolled(block: BlockState, dir: Dir): BlockState {
  const { x, y, ori } = block;
  if (dir === "up") {
    if (ori === "up") return { x, y: y - 2, ori: "forward" };
    if (ori === "forward") return { x, y: y - 1, ori: "up" };
    return { x, y: y - 1, ori: "right" };
  }
  if (dir === "down") {
    if (ori === "up") return { x, y: y + 1, ori: "forward" };
    if (ori === "forward") return { x, y: y + 2, ori: "up" };
    return { x, y: y + 1, ori: "right" };
  }
  if (dir === "left") {
    if (ori === "up") return { x: x - 2, y, ori: "right" };
    if (ori === "right") return { x: x - 1, y, ori: "up" };
    return { x: x - 1, y, ori: "forward" };
  }
  if (ori === "up") return { x: x + 1, y, ori: "right" };
  if (ori === "right") return { x: x + 2, y, ori: "up" };
  return { x: x + 1, y, ori: "forward" };
}

export function cubeShift(cell: Cell, dir: Dir): Cell {
  if (dir === "up") return { x: cell.x, y: cell.y - 1 };
  if (dir === "down") return { x: cell.x, y: cell.y + 1 };
  if (dir === "left") return { x: cell.x - 1, y: cell.y };
  return { x: cell.x + 1, y: cell.y };
}

export class Stage {
  readonly def: LevelDef;
  readonly tiles: Tile[];
  bridges: Bridge[];
  block: BlockState;
  split = false;
  cubeA: Cell = { x: 0, y: 0 };
  cubeB: Cell = { x: 0, y: 0 };
  active: 0 | 1 = 0;
  moves = 0;
  attempts = 0;
  anim: Anim | null = null;
  selectTimer = 0;
  won = false;
  failed = false;
  assemble = 1;
  scatter = 0;

  constructor(def: LevelDef) {
    this.def = def;
    const parsed = parseLevel(def);
    this.tiles = parsed.tiles;
    this.bridges = parsed.bridges;
    this.block = { x: def.spawn[0], y: def.spawn[1], ori: "up" };
  }

  tileAt(x: number, y: number): Tile {
    if (!inBounds(x, y)) return "empty";
    return this.tiles[idx(x, y)];
  }

  bridgeAt(x: number, y: number): Bridge | undefined {
    return this.bridges.find((b) => b.x === x && b.y === y);
  }

  isSolid(x: number, y: number, upright: boolean): boolean {
    const t = this.tileAt(x, y);
    if (t === "empty") return false;
    if (t === "bridgeL" || t === "bridgeR") return this.bridgeAt(x, y)?.on === true;
    if (t === "fragile" && upright) return false;
    return true;
  }

  endCell(): Cell {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.tileAt(x, y) === "end") return { x, y };
      }
    }
    return { x: -1, y: -1 };
  }

  private cellsValid(cells: Cell[], upright: boolean): boolean {
    return cells.every((c) => this.isSolid(c.x, c.y, upright));
  }

  tryMove(dir: Dir): boolean {
    if (this.anim) return false;

    if (this.split) {
      const from = this.active === 0 ? { ...this.cubeA } : { ...this.cubeB };
      const to = cubeShift(from, dir);
      this.moves++;
      this.anim = {
        kind: "roll",
        t: 0,
        dur: 0.16,
        dir,
        from: { x: from.x, y: from.y, ori: "up" },
        to: { x: to.x, y: to.y, ori: "up" },
      };
      return true;
    }

    const from = { ...this.block };
    const to = rolled(from, dir);
    this.moves++;
    this.anim = { kind: "roll", t: 0, dur: 0.22, dir, from, to };
    return true;
  }

  swapSplit(): void {
    if (!this.split) return;
    if (this.anim && this.anim.kind !== "splitdrop") return;
    this.active = this.active === 0 ? 1 : 0;
    this.selectTimer = 0.45;
  }

  dropIn(): void {
    this.anim = {
      kind: "drop",
      t: 0,
      dur: 0.38,
      from: { ...this.block },
      to: { ...this.block },
    };
  }

  finishMove(onSwitch: (opened: boolean, closed: boolean) => void): "ok" | "fail" | "win" | "split" {
    if (!this.anim || this.anim.kind !== "roll") return "ok";
    const dir = this.anim.dir!;

    if (this.split) {
      if (this.active === 0) this.cubeA = cubeShift(this.cubeA, dir);
      else this.cubeB = cubeShift(this.cubeB, dir);
      const cells = [this.cubeA, this.cubeB];
      const moving = this.active === 0 ? this.cubeA : this.cubeB;
      if (!this.isSolid(moving.x, moving.y, false)) return "fail";
      this.applySwitches(cells, true, onSwitch);
      this.tryJoin();
      return "ok";
    }

    this.block = this.anim.to;
    const cells = occupied(this.block);
    const upright = this.block.ori === "up";
    const end = this.endCell();
    if (upright && this.block.x === end.x && this.block.y === end.y) {
      this.won = true;
      return "win";
    }
    if (!this.cellsValid(cells, upright)) return "fail";
    this.applySwitches(cells, false, onSwitch);
    if (upright && this.tileAt(this.block.x, this.block.y) === "split") {
      return "split";
    }
    return "ok";
  }

  beginFall(): void {
    this.failed = true;
    this.anim = {
      kind: "fall",
      t: 0,
      dur: 0.42,
      dir: this.anim?.dir,
      from: this.split
        ? { x: (this.active === 0 ? this.cubeA : this.cubeB).x, y: (this.active === 0 ? this.cubeA : this.cubeB).y, ori: "up" }
        : { ...this.block },
      to: this.split
        ? { x: (this.active === 0 ? this.cubeA : this.cubeB).x, y: (this.active === 0 ? this.cubeA : this.cubeB).y, ori: "up" }
        : { ...this.block },
    };
  }

  beginScatter(): void {
    this.scatter = 0.001;
    this.anim = null;
  }

  beginSink(): void {
    this.anim = {
      kind: "sink",
      t: 0,
      dur: 0.45,
      from: { ...this.block },
      to: { ...this.block },
    };
  }

  beginSplit(): void {
    const pad =
      this.def.splits.find((s) => s.x === this.block.x && s.y === this.block.y) ??
      this.def.splits.find((s) => this.tileAt(s.x, s.y) === "split");
    if (!pad) return;
    this.split = true;
    this.active = 0;
    this.cubeA = { x: pad.a[0], y: pad.a[1] };
    this.cubeB = { x: pad.b[0], y: pad.b[1] };
    this.selectTimer = 0.5;
    this.anim = {
      kind: "splitdrop",
      t: 0,
      dur: 0.4,
      from: { x: this.cubeA.x, y: this.cubeA.y, ori: "up" },
      to: { x: this.cubeA.x, y: this.cubeA.y, ori: "up" },
      from2: { ...this.cubeA },
      to2: { ...this.cubeB },
    };
  }

  private applySwitches(
    cells: Cell[],
    split: boolean,
    onSwitch: (opened: boolean, closed: boolean) => void,
  ): void {
    let opened = false;
    let closed = false;
    const hit = (cell: Cell, allowHeavy: boolean) => {
      const t = this.tileAt(cell.x, cell.y);
      if (t !== "soft" && !(allowHeavy && t === "heavy")) return;
      const def = this.def.switches.find((s) => s.x === cell.x && s.y === cell.y);
      if (!def) return;
      for (const target of def.bridges) {
        const b = this.bridgeAt(target.x, target.y);
        if (!b) continue;
        const next = nextBridge(b.on, target.mode);
        if (next === b.on) continue;
        b.on = next;
        b.flash = 0.35;
        b.flashOn = next;
        if (next) opened = true;
        else closed = true;
      }
    };

    if (split) {
      const moving = this.active === 0 ? this.cubeA : this.cubeB;
      hit(moving, false);
    } else {
      const upright = this.block.ori === "up";
      hit(cells[0], upright);
      if (cells[1]) hit(cells[1], false);
    }
    if (opened || closed) onSwitch(opened, closed);
  }

  private tryJoin(): void {
    const a = this.cubeA;
    const b = this.cubeB;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    this.split = false;
    if (a.y === b.y) {
      this.block = { x: Math.min(a.x, b.x), y: a.y, ori: "right" };
    } else {
      this.block = { x: a.x, y: Math.min(a.y, b.y), ori: "forward" };
    }
  }

  tick(dt: number): void {
    for (const b of this.bridges) {
      const target = b.on ? 7 : 0;
      if (b.frame < target) b.frame = Math.min(target, b.frame + dt * 28);
      else if (b.frame > target) b.frame = Math.max(target, b.frame - dt * 28);
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt);
    }
    if (this.selectTimer > 0) this.selectTimer = Math.max(0, this.selectTimer - dt);
    if (this.assemble < 1) this.assemble = Math.min(1, this.assemble + dt / 1.25);
    if (this.scatter > 0 && this.scatter < 1) this.scatter = Math.min(1, this.scatter + dt / 0.85);
    if (this.anim) {
      this.anim.t += dt;
      if (this.anim.t >= this.anim.dur) this.anim.t = this.anim.dur;
    }
  }
}

export function levelByCode(code: string): number {
  return LEVELS.findIndex((l) => l.code === code);
}

export function nextBridge(on: boolean, mode: SwitchMode): boolean {
  if (mode === "on") return true;
  if (mode === "off") return false;
  return !on;
}

export { LEVELS };
