type Gfx = {
  beginFill: (c: string) => Gfx;
  beginStroke: (c: string) => Gfx;
  setStrokeStyle: (n: number) => Gfx;
  moveTo: (x: number, y: number) => Gfx;
  lineTo: (x: number, y: number) => Gfx;
  endFill: () => Gfx;
  clear: () => Gfx;
  drawCircle: (x: number, y: number, r: number) => Gfx;
};

type Shape = {
  graphics: Gfx;
  x: number;
  y: number;
  visible: boolean;
  alpha: number;
  mouseEnabled: boolean;
  scaleX?: number;
  scaleY?: number;
};

type TileLike = {
  x?: number;
  y?: number;
  type?: string;
  alpha?: number;
  visible?: boolean;
};

type BlockLike = {
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  alpha?: number;
  roll?: { idle?: boolean };
};

type Layer = {
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  mouseEnabled?: boolean;
  mouseChildren?: boolean;
  addChild: (c: unknown) => void;
  removeAllChildren: () => void;
};

const FACE: Record<string, { top: string; left: string; right: string; stroke: string; h: number }> = {
  b: { top: "#e8a060", left: "#8a3c14", right: "#c06028", stroke: "#ffd0a0", h: 10 },
  e: { top: "#1a1208", left: "#3a2810", right: "#2a1c0c", stroke: "#f4d36a", h: 6 },
  s: { top: "#5aa8ff", left: "#1e4e96", right: "#2f74c8", stroke: "#c8e4ff", h: 8 },
  h: { top: "#c46cff", left: "#5a2088", right: "#8a38c0", stroke: "#efd0ff", h: 8 },
  f: { top: "#f0c45a", left: "#8a6810", right: "#c09028", stroke: "#ffe8a8", h: 6 },
  v: { top: "#3ec89a", left: "#186048", right: "#249870", stroke: "#b8ffe0", h: 8 },
  l: { top: "#9a5830", left: "#4a2010", right: "#703818", stroke: "#e0a070", h: 8 },
  k: { top: "#d88848", left: "#6a3810", right: "#9a5020", stroke: "#ffd0a0", h: 10 },
  r: { top: "#7a3818", left: "#3a180c", right: "#582410", stroke: "#d08050", h: 8 },
  q: { top: "#c07038", left: "#5a2810", right: "#8a4018", stroke: "#f0b070", h: 10 },
};

let layer: Layer | null = null;
let lastKey = "";
let blockShapes: Shape[] = [];

function cjsShape(): Shape | null {
  const Ctor = (window as unknown as { createjs?: { Shape?: new () => Shape } }).createjs?.Shape;
  if (!Ctor) return null;
  return new Ctor();
}

function cjsContainer(): Layer | null {
  const Ctor = (window as unknown as { createjs?: { Container?: new () => Layer } }).createjs?.Container;
  if (!Ctor) return null;
  return new Ctor();
}

function drawCube(s: Shape, face: (typeof FACE)[string], ox = 0, oy = 0): void {
  const w = 15;
  const d = 8;
  const h = face.h;
  const g = s.graphics;
  g.clear();
  g.beginFill(face.left)
    .moveTo(ox - w, oy)
    .lineTo(ox, oy + d)
    .lineTo(ox, oy + d + h)
    .lineTo(ox - w, oy + h)
    .endFill();
  g.beginFill(face.right)
    .moveTo(ox, oy + d)
    .lineTo(ox + w, oy)
    .lineTo(ox + w, oy + h)
    .lineTo(ox, oy + d + h)
    .endFill();
  g.beginFill(face.top)
    .beginStroke(face.stroke)
    .setStrokeStyle(1)
    .moveTo(ox, oy - h)
    .lineTo(ox + w, oy - h + d)
    .lineTo(ox, oy + d)
    .lineTo(ox - w, oy - h + d)
    .lineTo(ox, oy - h)
    .endFill();
}

function ensureLayer(gc: {
  addChild?: (c: unknown) => void;
  addChildAt?: (c: unknown, i: number) => void;
  contains?: (c: unknown) => boolean;
  getChildIndex?: (c: unknown) => number;
}): Layer | null {
  if (layer) return layer;
  const next = cjsContainer();
  if (!next || !gc.addChild) return null;
  next.mouseEnabled = false;
  next.mouseChildren = false;
  layer = next;
  gc.addChild(next);
  return layer;
}

export function clearTheme3d(): void {
  layer?.removeAllChildren();
  lastKey = "";
  blockShapes = [];
}

export function syncTheme3d(opts: {
  on: boolean;
  tiles?: TileLike[];
  blocks?: BlockLike[];
  layerTiles?: { x?: number; y?: number; scaleX?: number; scaleY?: number };
  gameContainer?: {
    addChild?: (c: unknown) => void;
    addChildAt?: (c: unknown, i: number) => void;
    contains?: (c: unknown) => boolean;
    getChildIndex?: (c: unknown) => number;
    setChildIndex?: (c: unknown, i: number) => void;
    numChildren?: number;
  };
}): void {
  const gc = opts.gameContainer;
  if (!opts.on || !gc) {
    if (layer) {
      layer.removeAllChildren();
      lastKey = "";
    }
    if (opts.tiles) for (const tile of opts.tiles) tile.alpha = 1;
    if (opts.blocks) for (const b of opts.blocks) if (b.alpha != null && b.alpha < 0.2) b.alpha = 1;
    return;
  }
  const host = ensureLayer(gc);
  if (!host) return;
  if (opts.layerTiles) {
    host.x = opts.layerTiles.x ?? 0;
    host.y = opts.layerTiles.y ?? 0;
    host.scaleX = opts.layerTiles.scaleX ?? 1;
    host.scaleY = opts.layerTiles.scaleY ?? 1;
  }
  if (gc.setChildIndex && gc.numChildren != null) gc.setChildIndex(host, Math.max(0, gc.numChildren - 1));

  const tiles = opts.tiles ?? [];
  const key = tiles.map((t) => `${t.type ?? ""}:${Math.round(t.x ?? 0)}:${Math.round(t.y ?? 0)}:${t.visible !== false}`).join("|");
  if (key !== lastKey) {
    lastKey = key;
    host.removeAllChildren();
    blockShapes = [];
    for (const tile of tiles) {
      tile.alpha = 0;
      if (tile.visible === false) continue;
      const ch = tile.type ?? "b";
      const face = FACE[ch] ?? FACE.b;
      const s = cjsShape();
      if (!s) continue;
      drawCube(s, face);
      s.x = tile.x ?? 0;
      s.y = tile.y ?? 0;
      s.mouseEnabled = false;
      host.addChild(s);
      if (ch === "s" || ch === "h" || ch === "v") {
        const pad = cjsShape();
        if (pad) {
          pad.graphics.beginFill(ch === "h" ? "#f0c8ff" : ch === "v" ? "#b8ffe0" : "#c8e4ff").drawCircle(0, -face.h + 2, 5);
          pad.x = s.x;
          pad.y = s.y;
          pad.mouseEnabled = false;
          host.addChild(pad);
        }
      }
      if (ch === "e") {
        const hole = cjsShape();
        if (hole) {
          hole.graphics.beginFill("#000").drawCircle(0, -2, 7);
          hole.x = s.x;
          hole.y = s.y;
          hole.mouseEnabled = false;
          host.addChild(hole);
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      const s = cjsShape();
      if (!s) break;
      drawCube(s, { top: "#ff9a3c", left: "#8a3010", right: "#d05018", stroke: "#ffd0a0", h: 22 });
      s.visible = false;
      s.mouseEnabled = false;
      host.addChild(s);
      blockShapes.push(s);
    }
  }

  const blocks = opts.blocks ?? [];
  for (let i = 0; i < blockShapes.length; i++) {
    const s = blockShapes[i]!;
    const b = blocks[i];
    if (!b) {
      s.visible = false;
      continue;
    }
    b.alpha = 0.12;
    s.visible = true;
    s.x = b.x ?? 0;
    s.y = (b.y ?? 0) - 8;
    s.scaleX = b.scaleX ?? 1;
    s.scaleY = b.scaleY ?? 1;
  }
}

