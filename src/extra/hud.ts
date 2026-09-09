declare const createjs: {
  Container: new () => HudNode;
  Text: new (text: string, font: string, color: string) => HudText;
  Shape: new () => HudShape;
  Shadow: new (color: string, x: number, y: number, blur: number) => unknown;
  Graphics: new () => {
    beginFill: (c: string) => unknown;
    drawCircle: (x: number, y: number, r: number) => unknown;
  };
};

type HudNode = {
  x: number;
  y: number;
  scaleX?: number;
  scaleY?: number;
  visible: boolean;
  mouseEnabled: boolean;
  mouseChildren?: boolean;
  cursor?: string;
  hitArea?: HudNode;
  shadow?: unknown;
  addChild: (...c: HudNode[]) => void;
  removeAllChildren: () => void;
  addEventListener: (type: string, fn: (ev?: unknown) => void) => void;
};

type HudText = HudNode & {
  text: string;
  color: string;
  shadow: unknown;
  textAlign: string;
};

type HudShape = HudNode & {
  graphics: {
    beginFill: (c: string) => HudShape["graphics"];
    beginStroke: (c: string) => HudShape["graphics"];
    setStrokeStyle: (n: number) => HudShape["graphics"];
    drawRect: (x: number, y: number, w: number, h: number, r?: number) => HudShape["graphics"];
    drawCircle: (x: number, y: number, r: number) => HudShape["graphics"];
    clear: () => HudShape["graphics"];
  };
};

export type MenuItem = { id: string; label: string; disabled?: boolean };

const FONT = "Orbitron, sans-serif";
const INK = "#ffe6c4";
const HOT = "#ffffff";
const MUTED = "rgba(255,210,160,0.45)";
const GREEN = "#9dffb0";

const BILLBOARD: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00001", "00001", "00001", "00001", "10001", "01110"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "01010", "01010", "00100", "01010", "01010", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
};

const TILE_FILL: Record<string, string> = {
  " ": "#14110f",
  b: "#c45a18",
  e: "#0d0d0d",
  s: "#3d7ad9",
  h: "#8b3ad9",
  f: "#d9a13a",
  v: "#2f9d7a",
  l: "#7a3a18",
  k: "#a05020",
  r: "#5a2a10",
  q: "#804018",
};

function glow(node: HudText, hot: boolean): void {
  node.shadow = new createjs.Shadow(hot ? "rgba(255,255,255,0.95)" : "rgba(255,162,0,0.62)", 0, 0, hot ? 18 : 12);
}

function text(str: string, x: number, y: number, size: number, color = INK, align = "left"): HudText {
  const t = new createjs.Text(str, `700 ${size}px ${FONT}`, color);
  t.x = x;
  t.y = y;
  t.textAlign = align;
  t.mouseEnabled = false;
  glow(t, false);
  return t;
}

function hit(t: HudText, fn: () => void, disabled = false): HudText {
  t.mouseEnabled = !disabled;
  t.cursor = disabled ? "default" : "pointer";
  if (disabled) {
    t.color = MUTED;
    return t;
  }
  t.addEventListener("click", fn);
  t.addEventListener("mouseover", () => {
    t.color = HOT;
    glow(t, true);
  });
  t.addEventListener("mouseout", () => {
    t.color = INK;
    glow(t, false);
  });
  return t;
}

function fieldBox(x: number, y: number, w: number, h = 22): HudShape {
  const s = new createjs.Shape();
  s.graphics.beginFill("#1a120c").beginStroke("#c45a18").setStrokeStyle(1).drawRect(x, y, w, h);
  s.mouseEnabled = false;
  return s;
}

/** Neon-dot billboard brand from the remake. Returns width. */
export function drawBillboard(container: HudNode, label: string, x: number, y: number, maxWidth = 280): number {
  const letters = label.toUpperCase();
  const pitch = Math.min(5.2, maxWidth / (Math.max(1, letters.length) * 6));
  const radius = 2.1;
  letters.split("").forEach((ch, li) => {
    const glyph = BILLBOARD[ch];
    if (!glyph) return;
    const ox = x + li * 6 * pitch;
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] !== "1") continue;
        const bx = ox + col * pitch;
        const by = y + row * pitch;
        const glowDot = new createjs.Shape();
        glowDot.graphics.beginFill("rgba(255,140,30,0.35)").drawCircle(0, 0, 5.5);
        glowDot.x = bx;
        glowDot.y = by;
        glowDot.mouseEnabled = false;
        container.addChild(glowDot);
        const core = new createjs.Shape();
        core.graphics.beginFill("#fff4dc").drawCircle(0, 0, radius);
        core.x = bx;
        core.y = by;
        core.mouseEnabled = false;
        core.shadow = new createjs.Shadow("rgba(255,150,40,0.95)", 0, 0, 10);
        container.addChild(core);
      }
    }
  });
  return letters.length * 6 * pitch;
}

export class ExtraHud {
  readonly root: HudNode;
  private layer: HudNode;
  private mascot: HudNode | null = null;
  onAction: (act: string) => void = () => undefined;
  makeMascot: (() => HudNode | null) | null = null;

  constructor(stage: { addChild: (c: unknown) => void }) {
    this.root = new createjs.Container();
    this.layer = new createjs.Container();
    this.root.addChild(this.layer);
    this.root.mouseEnabled = true;
    this.root.mouseChildren = true;
    stage.addChild(this.root);
  }

  setVisible(on: boolean): void {
    this.root.visible = on;
    this.root.mouseEnabled = on;
    if (this.mascot) this.mascot.visible = on;
  }

  clear(): void {
    this.layer.removeAllChildren();
  }

  private add(...nodes: HudNode[]): void {
    for (const n of nodes) this.layer.addChild(n);
  }

  private placeMascot(brandWidth: number, brandX: number, brandY: number): void {
    if (!this.mascot && this.makeMascot) this.mascot = this.makeMascot();
    if (!this.mascot) return;
    this.mascot.visible = true;
    this.mascot.mouseEnabled = false;
    this.mascot.scaleX = 0.55;
    this.mascot.scaleY = 0.55;
    this.mascot.x = brandX + brandWidth + 36;
    this.mascot.y = brandY + 22;
    this.mascot.shadow = new createjs.Shadow("rgba(255,102,0,1)", 0, 0, 16);
    if ((this.mascot as { parent?: unknown }).parent !== this.root) this.root.addChild(this.mascot);
  }

  private hideMascot(): void {
    if (this.mascot) this.mascot.visible = false;
  }

  drawHome(title: string, items: MenuItem[], cursor: number): void {
    this.clear();
    const brandX = 36;
    const brandY = 18;
    const w = drawBillboard(this.layer, title, brandX, brandY, 300);
    this.placeMascot(w, brandX, brandY);
    items.forEach((item, i) => {
      const prefix = i === cursor && !item.disabled ? "> " : "  ";
      const line = hit(
        text(prefix + item.label, 48, 78 + i * 18, 13, item.disabled ? MUTED : INK),
        () => {
          this.onAction(item.id);
        },
        !!item.disabled,
      );
      this.add(line);
    });
  }

  drawName(): void {
    this.clear();
    this.hideMascot();
    this.add(text("What should we call you?", 40, 70, 18));
    this.add(text("This is how you show up. Type DEV for extra tools.", 40, 100, 11, MUTED));
    this.add(fieldBox(40, 128, 240));
    this.add(hit(text("Continue", 40, 168, 13), () => this.onAction("name-continue")));
    this.add(hit(text("Stay anonymous", 160, 168, 13), () => this.onAction("skip-name")));
  }

  drawCredits(): void {
    this.clear();
    this.hideMascot();
    this.add(hit(text("Back", 24, 16, 12), () => this.onAction("back")));
    this.add(text("Credits", 275, 28, 20, INK, "center"));
    this.add(text("Bloxorz — Damien Clarke / DX Interactive, 2007.", 40, 80, 11, MUTED));
    this.add(text("Playfield: Coolmath Animate HTML5 export.", 40, 102, 11, MUTED));
    this.add(text("Timer & themes — Nathan Spencer.", 40, 124, 11, MUTED));
    this.add(text("The block still rolls in their engine.", 40, 146, 11, MUTED));
  }

  drawLoad(error: string): void {
    this.clear();
    this.hideMascot();
    this.add(hit(text("Back", 24, 16, 12), () => this.onAction("back")));
    this.add(text("Load Stage", 275, 28, 20, INK, "center"));
    this.add(text("Campaign passcode, six digits.", 40, 80, 11, MUTED));
    this.add(fieldBox(40, 114, 160));
    if (error) this.add(text(error, 40, 150, 11, "#ff8a8a"));
    this.add(hit(text("Load", 40, 180, 13), () => this.onAction("load-go")));
  }

  drawSettings(rumble: boolean): void {
    this.clear();
    this.hideMascot();
    this.add(hit(text("Back", 24, 16, 12), () => this.onAction("back")));
    this.add(text("Settings", 275, 28, 20, INK, "center"));
    this.add(text("Name in the field. DEV unlocks tools.", 40, 80, 11, MUTED));
    this.add(fieldBox(40, 108, 240));
    this.add(hit(text(rumble ? "> Rumble  On" : "  Rumble  Off", 40, 148, 13), () => this.onAction("toggle-rumble")));
    this.add(hit(text("Save", 40, 180, 13), () => this.onAction("save-name")));
  }

  drawFinish(moves: number, falls: number): void {
    this.clear();
    this.hideMascot();
    this.add(text("Congratulations", 275, 40, 22, INK, "center"));
    this.add(text("You cleared the run.", 275, 80, 12, MUTED, "center"));
    this.add(text("Moves  " + moves, 275, 120, 13, INK, "center"));
    this.add(text("Falls  " + falls, 275, 142, 13, INK, "center"));
    this.add(hit(text("Menu", 275, 190, 14, INK, "center"), () => this.onAction("back")));
  }

  drawPuzzles(diff: string, count: number, dailyMeta: string): void {
    this.clear();
    this.hideMascot();
    this.add(hit(text("Back", 24, 16, 12), () => this.onAction("back")));
    this.add(text("Puzzles", 275, 28, 20, INK, "center"));
    this.add(text("Generated here. Played in their engine.", 40, 58, 11, MUTED));
    (["easy", "medium", "hard", "insane"] as const).forEach((d, i) => {
      const mark = d === diff ? "> " : "  ";
      this.add(hit(text(mark + d, 40 + i * 120, 90, 12), () => this.onAction("diff:" + d)));
    });
    this.add(text(dailyMeta, 40, 118, 10, MUTED));
    this.add(hit(text("Play Daily", 40, 140, 13), () => this.onAction("puzzle-daily")));
    [1, 5, 10].forEach((n, i) => {
      const mark = n === count ? "> " : "  ";
      this.add(hit(text(mark + n, 40 + i * 70, 168, 12), () => this.onAction("len:" + n)));
    });
    this.add(fieldBox(40, 198, 240));
    this.add(hit(text("Start Seeded Run", 40, 230, 13), () => this.onAction("puzzle-run")));
  }

  drawHistory(rows: { title: string; meta: string; replay?: () => void }[]): void {
    this.clear();
    this.hideMascot();
    this.add(hit(text("Back", 24, 16, 12), () => this.onAction("back")));
    this.add(text("History", 275, 28, 20, INK, "center"));
    if (!rows.length) {
      this.add(text("No runs yet.", 40, 80, 12, MUTED));
      return;
    }
    rows.slice(0, 6).forEach((row, i) => {
      const y = 62 + i * 36;
      this.add(text(row.title, 40, y, 11));
      this.add(text(row.meta, 40, y + 14, 10, MUTED));
      if (row.replay) this.add(hit(text("Replay", 420, y, 11), row.replay));
    });
  }

  drawDev(): void {
    this.clear();
    this.hideMascot();
    this.add(hit(text("Back", 24, 16, 12), () => this.onAction("back")));
    this.add(text("Dev tools", 275, 28, 20, INK, "center"));
    this.add(text("Jump to a campaign stage.", 40, 54, 11, MUTED));
    for (let i = 1; i <= 33; i++) {
      const col = (i - 1) % 11;
      const row = Math.floor((i - 1) / 11);
      const n = String(i).padStart(2, "0");
      this.add(hit(text(n, 40 + col * 42, 86 + row * 28, 13), () => this.onAction("dev:" + i)));
    }
  }

  drawCreator(opts: {
    tiles: string[];
    spawn: [number, number];
    tool: string;
    badge: string;
    hint: string;
    seed: string;
    canSave: boolean;
    marks: { x: number; y: number; label: string }[];
  }): void {
    this.clear();
    this.hideMascot();
    this.add(hit(text("Back", 16, 10, 12), () => this.onAction("back")));
    this.add(text("Stage Creator", 110, 10, 16));
    this.add(text(opts.badge, 330, 14, 11, GREEN));
    this.add(hit(text("Test", 430, 10, 12), () => this.onAction("creator-test")));

    const cell = 16;
    const ox = 18;
    const oy = 48;
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 15; x++) {
        const ch = opts.tiles[y][x] ?? " ";
        const s = new createjs.Shape();
        s.graphics.beginFill(TILE_FILL[ch] || "#14110f").drawRect(0, 0, cell - 1, cell - 1);
        if (ch === "e") s.graphics.beginStroke("#f4d36a").setStrokeStyle(1).drawRect(0.5, 0.5, cell - 2, cell - 2);
        s.x = ox + x * cell;
        s.y = oy + y * cell;
        s.mouseEnabled = true;
        s.cursor = "pointer";
        const ha = new createjs.Shape();
        ha.graphics.beginFill("#000").drawRect(0, 0, cell - 1, cell - 1);
        s.hitArea = ha;
        const cx = x;
        const cy = y;
        s.addEventListener("click", () => this.onAction("paint:" + cx + ":" + cy));
        this.add(s);
        if (opts.spawn[0] === x && opts.spawn[1] === y) {
          this.add(text("B", ox + x * cell + 3, oy + y * cell + 2, 9, "#fff"));
        }
        const mark = opts.marks.find((m) => m.x === x && m.y === y);
        if (mark) this.add(text(mark.label, ox + x * cell + 3, oy + y * cell + 2, 9, "#fff"));
      }
    }

    const tools = ["erase", "stone", "exit", "soft", "heavy", "fragile", "split", "bridgeL", "bridgeR", "spawn", "link"];
    const labels: Record<string, string> = {
      erase: "Erase",
      stone: "Stone",
      exit: "Exit",
      soft: "Soft Sw.",
      heavy: "Heavy Sw.",
      fragile: "Fragile",
      split: "Split",
      bridgeL: "Bridge L",
      bridgeR: "Bridge R",
      spawn: "Spawn",
      link: "Link Sw.",
    };
    tools.forEach((id, i) => {
      const mark = opts.tool === id ? "> " : "  ";
      this.add(hit(text(mark + labels[id], 280, 48 + i * 16, 12), () => this.onAction("tool:" + id)));
    });

    this.add(text(opts.hint, 18, 216, 10, MUTED));
    this.add(hit(text("New", 18, 236, 12), () => this.onAction("creator-new")));
    this.add(hit(text("Save", 70, 236, 12, opts.canSave ? INK : MUTED), () => this.onAction("creator-save"), !opts.canSave));
    this.add(text(opts.seed, 140, 238, 10, MUTED));
    this.add(fieldBox(18, 256, 250, 20));
    this.add(hit(text("Enter Code", 280, 258, 11), () => this.onAction("creator-load")));
  }

  drawInGameDev(): void {
    this.clear();
    this.hideMascot();
    this.add(hit(text("Beat stage for me", 12, 8, 11), () => this.onAction("dev-beat")));
    this.add(hit(text("Dev menu", 180, 8, 11), () => this.onAction("dev-menu")));
  }
}
