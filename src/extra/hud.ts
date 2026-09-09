import { playHomeWhoosh, playUiClick, playUiLatch } from "./audio";
import {
  BOARD_OX,
  BOARD_OY,
  BOARD_SCALE,
  BOARD_VIEW,
  CLIP_OFFSET,
  clipForTile,
  gamePos,
  pickBoardCell,
  type ClipName,
} from "./coolmathBoard";
import { EDITOR_TOOLS } from "./editor";
import { difficultyHint } from "./generate";
import { currentTheme, type ThemeId } from "./settings";

declare const createjs: {
  Container: new () => HudNode;
  Text: new (text: string, font: string, color: string) => HudText;
  Shape: new () => HudShape;
  Shadow: new (color: string, x: number, y: number, blur: number) => unknown;
  Tween?: {
    get: (
      target: HudNode,
      props?: { override?: boolean },
    ) => {
      wait: (ms: number) => { to: (props: object, dur: number, ease?: unknown) => unknown };
      to: (props: object, dur: number, ease?: unknown) => unknown;
    };
  };
  Ease?: { quadOut?: unknown };
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
  parent?: unknown;
  cacheID?: number;
  addChild: (...c: HudNode[]) => void;
  removeChild?: (c: HudNode) => void;
  removeAllChildren: () => void;
  addEventListener: (type: string, fn: (ev?: unknown) => void) => void;
  cache?: (x: number, y: number, w: number, h: number, scale?: number) => void;
  uncache?: () => void;
};

type HudText = HudNode & {
  text: string;
  color: string;
  shadow: unknown;
  textAlign: string;
  getMeasuredWidth?: () => number;
  getMeasuredHeight?: () => number;
};

type HudShape = HudNode & {
  graphics: {
    beginFill: (c: string) => HudShape["graphics"];
    beginStroke: (c: string) => HudShape["graphics"];
    setStrokeStyle: (n: number) => HudShape["graphics"];
    moveTo: (x: number, y: number) => HudShape["graphics"];
    lineTo: (x: number, y: number) => HudShape["graphics"];
    endFill: () => HudShape["graphics"];
    drawRect: (x: number, y: number, w: number, h: number, r?: number) => HudShape["graphics"];
    drawCircle: (x: number, y: number, r: number) => HudShape["graphics"];
    clear: () => HudShape["graphics"];
  };
};

export type MenuItem = { id: string; label: string; disabled?: boolean };

type ThemePaint = {
  ink: string;
  hot: string;
  muted: string;
  green: string;
  field: string;
  stroke: string;
  track: string;
  fill: string;
  billboardCore: string;
  billboardGlow: string;
  shadow: string;
};

const THEME_PAINT: Record<ThemeId, ThemePaint> = {
  original: {
    ink: "#ffe6c4",
    hot: "#ffffff",
    muted: "rgba(255,210,160,0.45)",
    green: "#9dffb0",
    field: "#1a120c",
    stroke: "#c45a18",
    track: "#2a1810",
    fill: "#c45a18",
    billboardCore: "#fff4dc",
    billboardGlow: "rgba(255,140,30,0.35)",
    shadow: "rgba(255,150,40,0.95)",
  },
  gray: {
    ink: "#e8eef5",
    hot: "#ffffff",
    muted: "rgba(200,210,220,0.5)",
    green: "#9fd6ff",
    field: "#14181e",
    stroke: "#7a8899",
    track: "#1c222b",
    fill: "#8aa0b8",
    billboardCore: "#f2f6fa",
    billboardGlow: "rgba(160,190,220,0.35)",
    shadow: "rgba(180,200,220,0.9)",
  },
  holiday: {
    ink: "#ffe8ef",
    hot: "#ffffff",
    muted: "rgba(255,190,200,0.5)",
    green: "#9dffb8",
    field: "#1a0c12",
    stroke: "#d64545",
    track: "#2a1018",
    fill: "#d64545",
    billboardCore: "#fff0f3",
    billboardGlow: "rgba(255,80,100,0.35)",
    shadow: "rgba(255,80,100,0.9)",
  },
};

function paint(): ThemePaint {
  return THEME_PAINT[currentTheme()] || THEME_PAINT.original;
}

const FONT = "Orbitron, sans-serif";

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

function glow(node: HudText, hot: boolean, theme: ThemePaint): void {
  node.shadow = new createjs.Shadow(hot ? "rgba(255,255,255,0.85)" : theme.shadow, 0, 0, hot ? 12 : 8);
}

function text(str: string, x: number, y: number, size: number, color?: string, align = "left"): HudText {
  const theme = paint();
  const t = new createjs.Text(str, `700 ${size}px ${FONT}`, color ?? theme.ink);
  t.x = x;
  t.y = y;
  t.textAlign = align;
  t.mouseEnabled = false;
  glow(t, false, theme);
  return t;
}

function hitRow(label: string, x: number, y: number, size: number, fn: () => void, disabled = false, minW = 220): HudNode {
  const theme = paint();
  const row = new createjs.Container();
  row.x = x;
  row.y = y;
  const t = text(label, 0, 0, size, disabled ? theme.muted : theme.ink);
  t.mouseEnabled = false;
  const w = Math.max(minW, (t.getMeasuredWidth?.() || label.length * size * 0.62) + 24);
  const h = Math.max(22, size + 10);
  const area = new createjs.Shape();
  area.graphics.beginFill("rgba(0,0,0,0.01)").drawRect(-8, -4, w, h);
  area.mouseEnabled = !disabled;
  area.cursor = disabled ? "default" : "pointer";
  if (!disabled) {
    const ink = theme.ink;
    const hot = theme.hot;
    area.addEventListener("click", () => {
      playUiLatch();
      fn();
    });
    area.addEventListener("mouseover", () => {
      playUiClick();
      t.color = hot;
      glow(t, true, theme);
    });
    area.addEventListener("mouseout", () => {
      t.color = ink;
      glow(t, false, theme);
    });
  }
  row.addChild(area);
  row.addChild(t);
  row.mouseEnabled = true;
  row.mouseChildren = true;
  return row;
}

function fieldBox(x: number, y: number, w: number, h = 22): HudShape {
  const theme = paint();
  const s = new createjs.Shape();
  s.graphics.beginFill(theme.field).beginStroke(theme.stroke).setStrokeStyle(1).drawRect(x, y, w, h);
  s.mouseEnabled = false;
  return s;
}

function slider(x: number, y: number, w: number, value: number, onSet: (v: number) => void): HudNode {
  const theme = paint();
  const row = new createjs.Container();
  row.x = x;
  row.y = y;
  const track = new createjs.Shape();
  track.graphics.beginFill(theme.track).drawRect(28, 4, w, 10);
  const fill = new createjs.Shape();
  fill.graphics.beginFill(theme.fill).drawRect(28, 4, Math.max(2, w * value), 10);
  const minus = hitRow("-", 0, 0, 14, () => onSet(Math.max(0, Math.round((value - 0.1) * 10) / 10)), false, 24);
  const plus = hitRow("+", 36 + w, 0, 14, () => onSet(Math.min(1, Math.round((value + 0.1) * 10) / 10)), false, 24);
  const hit = new createjs.Shape();
  hit.graphics.beginFill("rgba(0,0,0,0.01)").drawRect(28, 0, w, 18);
  hit.cursor = "pointer";
  hit.mouseEnabled = true;
  hit.addEventListener("click", (ev?: unknown) => {
    const e = ev as { localX?: number };
    const lx = typeof e?.localX === "number" ? Math.max(0, e.localX - 28) : w * value;
    onSet(Math.max(0, Math.min(1, Math.round((lx / w) * 10) / 10)));
  });
  row.addChild(track);
  row.addChild(fill);
  row.addChild(hit);
  row.addChild(minus);
  row.addChild(plus);
  return row;
}

/** Neon billboard as two Shape layers (not hundreds of shadowed dots). */
export function drawBillboard(container: HudNode, label: string, x: number, y: number, maxWidth = 280): number {
  const theme = paint();
  const letters = label.toUpperCase();
  const pitch = Math.min(5.2, maxWidth / (Math.max(1, letters.length) * 6));
  const glowLayer = new createjs.Shape();
  const coreLayer = new createjs.Shape();
  glowLayer.mouseEnabled = false;
  coreLayer.mouseEnabled = false;
  letters.split("").forEach((ch, li) => {
    const glyph = BILLBOARD[ch];
    if (!glyph) return;
    const ox = x + li * 6 * pitch;
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] !== "1") continue;
        const bx = ox + col * pitch;
        const by = y + row * pitch;
        glowLayer.graphics.beginFill(theme.billboardGlow).drawCircle(bx, by, 5.2);
        coreLayer.graphics.beginFill(theme.billboardCore).drawCircle(bx, by, 2.1);
      }
    }
  });
  coreLayer.shadow = new createjs.Shadow(theme.shadow, 0, 0, 10);
  container.addChild(glowLayer);
  container.addChild(coreLayer);
  return letters.length * 6 * pitch;
}

export class ExtraHud {
  readonly root: HudNode;
  private layer: HudNode;
  private board: HudNode | null = null;
  private mascot: HudNode | null = null;
  onAction: (act: string) => void = () => undefined;
  makeMascot: (() => HudNode | null) | null = null;
  makeClip: ((name: ClipName) => HudNode | null) | null = null;

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
    this.root.mouseChildren = on;
  }

  clear(): void {
    this.layer.uncache?.();
    this.layer.removeAllChildren();
  }

  /** Drop HUD display objects so in-game ticks do not traverse them. */
  parkForPlay(): void {
    this.clear();
    this.hideMascot();
    this.setVisible(false);
  }

  private add(...nodes: HudNode[]): void {
    for (const n of nodes) this.layer.addChild(n);
  }

  private placeMascot(brandWidth: number, brandX: number, brandY: number): void {
    if (!this.mascot && this.makeMascot) this.mascot = this.makeMascot();
    if (!this.mascot) return;
    this.mascot.visible = true;
    this.mascot.mouseEnabled = false;
    this.mascot.scaleX = 0.92;
    this.mascot.scaleY = 0.92;
    this.mascot.x = brandX + brandWidth + 10;
    this.mascot.y = brandY + 52;
    this.mascot.shadow = new createjs.Shadow("rgba(255,102,0,1)", 0, 0, 16);
    if (this.mascot.parent !== this.root) this.root.addChild(this.mascot);
  }

  hideMascot(): void {
    if (!this.mascot) return;
    this.mascot.visible = false;
    if (this.mascot.parent === this.root) this.root.removeChild?.(this.mascot);
  }

  drawHome(title: string, items: MenuItem[], cursor: number, animate = false): void {
    this.clear();
    const brandX = 28;
    const brandY = 14;
    const w = drawBillboard(this.layer, title, brandX, brandY, 300);
    this.placeMascot(w, brandX, brandY);
    const rows: HudNode[] = [];
    items.forEach((item, i) => {
      const prefix = i === cursor && !item.disabled ? "> " : "  ";
      const targetX = 40;
      const y = 72 + i * 20;
      const row = hitRow(prefix + item.label, animate ? -160 : targetX, y, 13, () => this.onAction(item.id), !!item.disabled, 240);
      this.add(row);
      rows.push(row);
    });
    if (animate) {
      playHomeWhoosh();
      rows.forEach((row, i) => {
        const tw = createjs.Tween?.get(row, { override: true });
        if (tw) tw.wait(i * 35).to({ x: 40 }, 320, createjs.Ease?.quadOut);
        else row.x = 40;
      });
    }
  }

  drawSplash(): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    const hit = new createjs.Shape();
    hit.graphics.beginFill("rgba(0,0,0,0.01)").drawRect(0, 0, 550, 300);
    hit.mouseEnabled = true;
    hit.cursor = "pointer";
    hit.addEventListener("click", () => {
      playUiLatch();
      this.onAction("splash-continue");
    });
    this.add(hit);
    this.add(text("All graphics, audio, ActionScript and puzzles", 275, 108, 13, theme.ink, "center"));
    this.add(text("in Bloxorz created by Damien Clarke,", 275, 132, 13, theme.ink, "center"));
    this.add(text("DX Interactive, 21st June 2007.", 275, 156, 13, theme.ink, "center"));
    this.add(text("Click or press any key", 275, 214, 12, theme.muted, "center"));
  }

  drawName(): void {
    this.clear();
    this.hideMascot();
    this.add(text("What should we call you?", 40, 70, 18));
    this.add(fieldBox(40, 128, 240));
    this.add(hitRow("Continue", 40, 168, 13, () => this.onAction("name-continue"), false, 120));
    this.add(hitRow("Stay anonymous", 160, 168, 13, () => this.onAction("skip-name"), false, 160));
  }

  drawCredits(): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(hitRow("Back", 24, 16, 12, () => this.onAction("back"), false, 80));
    this.add(text("Credits", 275, 28, 20, theme.ink, "center"));
    this.add(text("Bloxorz — Damien Clarke / DX Interactive, 2007.", 40, 80, 11, theme.muted));
    this.add(text("Playfield: Coolmath Animate HTML5 export.", 40, 102, 11, theme.muted));
    this.add(text("Timer & themes — Nathan Spencer.", 40, 124, 11, theme.muted));
  }

  drawLoadPasscode(error: string): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(hitRow("Back", 24, 16, 12, () => this.onAction("back"), false, 80));
    this.add(text("Load Stage", 275, 28, 20, theme.ink, "center"));
    this.add(text("Campaign passcode, six digits.", 40, 80, 11, theme.muted));
    this.add(fieldBox(40, 114, 160));
    if (error) this.add(text(error, 40, 150, 11, "#ff8a8a"));
    this.add(hitRow("Load", 40, 180, 13, () => this.onAction("load-go"), false, 80));
  }

  drawLoadStages(): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(hitRow("Back", 24, 16, 12, () => this.onAction("back"), false, 80));
    this.add(text("Load Stage", 275, 28, 20, theme.ink, "center"));
    this.add(text("Jump to a campaign stage.", 40, 54, 11, theme.muted));
    for (let i = 1; i <= 33; i++) {
      const col = (i - 1) % 11;
      const row = Math.floor((i - 1) / 11);
      const n = String(i).padStart(2, "0");
      this.add(hitRow(n, 40 + col * 42, 86 + row * 28, 13, () => this.onAction("dev:" + i), false, 36));
    }
  }

  drawSettings(opts: {
    rumble: boolean;
    showTimer: boolean;
    themeBg: boolean;
    music: number;
    sfx: number;
    theme: string;
    bgTint: number;
    bgHue: number;
    blockHue: number;
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(hitRow("Back", 24, 8, 12, () => this.onAction("back"), false, 80));
    this.add(text("Settings", 275, 8, 16, theme.ink, "center"));
    this.add(text("Name", 40, 34, 12));
    this.add(fieldBox(100, 32, 220));
    this.add(text("Music", 40, 62, 12));
    this.add(slider(100, 62, 140, opts.music, (v) => this.onAction("music:" + v.toFixed(2))));
    this.add(text(Math.round(opts.music * 100) + "%", 300, 62, 11, theme.muted));
    this.add(text("SFX", 40, 84, 12));
    this.add(slider(100, 84, 140, opts.sfx, (v) => this.onAction("sfx:" + v.toFixed(2))));
    this.add(text(Math.round(opts.sfx * 100) + "%", 300, 84, 11, theme.muted));
    this.add(hitRow(opts.rumble ? "> Rumble  On" : "  Rumble  Off", 40, 106, 12, () => this.onAction("toggle-rumble"), false, 200));
    this.add(
      hitRow(opts.showTimer ? "> Speedrun timer  On" : "  Speedrun timer  Off", 40, 126, 12, () => this.onAction("toggle-timer"), false, 240),
    );
    this.add(text("Theme", 40, 146, 12));
    (["original", "gray", "holiday"] as const).forEach((th, i) => {
      const mark = opts.theme === th ? "> " : "  ";
      this.add(hitRow(mark + th, 110 + i * 110, 146, 12, () => this.onAction("theme:" + th), false, 100));
    });
    this.add(
      hitRow(opts.themeBg ? "> Theme background  On" : "  Theme background  Off", 40, 166, 12, () => this.onAction("toggle-theme-bg"), false, 260),
    );
    this.add(text("Backdrop tint", 40, 188, 12));
    this.add(slider(160, 188, 120, opts.bgTint, (v) => this.onAction("bgtint:" + v.toFixed(2))));
    this.add(swatch(300, 190, opts.bgHue, opts.bgTint));
    this.add(text("Backdrop hue", 40, 210, 12));
    this.add(slider(160, 210, 120, opts.bgHue / 360, (v) => this.onAction("bghue:" + Math.round(v * 360))));
    this.add(text(String(Math.round(opts.bgHue)), 300, 210, 11, theme.muted));
    this.add(text("Block hue", 40, 232, 12));
    this.add(slider(160, 232, 120, opts.blockHue / 360, (v) => this.onAction("blockhue:" + Math.round(v * 360))));
    this.add(swatch(300, 234, opts.blockHue, opts.blockHue > 0 ? 1 : 0));
    this.add(hitRow("Remap controls", 40, 256, 12, () => this.onAction("remap"), false, 180));
  }

  drawRemap(rows: { id: string; label: string; bind: string }[], waiting: string | null): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(hitRow("Back", 24, 12, 12, () => this.onAction("settings"), false, 80));
    this.add(text("Remap controls", 275, 12, 18, theme.ink, "center"));
    this.add(text(waiting ? "Press a key for " + waiting + "…" : "Click a row, then press a key.", 40, 40, 11, theme.muted));
    rows.forEach((row, i) => {
      const y = 68 + i * 22;
      const mark = waiting === row.id ? "> " : "  ";
      this.add(hitRow(`${mark}${row.label}`, 40, y, 12, () => this.onAction("rebind:" + row.id), false, 200));
      this.add(text(row.bind, 320, y, 12, theme.muted));
    });
  }

  drawFinish(opts: {
    moves: number;
    falls: number;
    fails: number;
    showStats: boolean;
    rows: { title: string; meta: string }[];
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(text("Congratulations", 275, 28, 20, theme.ink, "center"));
    this.add(text("You cleared the run.", 275, 56, 12, theme.muted, "center"));
    this.add(text("Moves  " + opts.moves + "    Falls  " + opts.falls + "    Attempts  " + opts.fails, 275, 82, 12, theme.ink, "center"));
    this.add(hitRow(opts.showStats ? "> Hide Stats" : "  Show Stats", 40, 104, 12, () => this.onAction("toggle-stats"), false, 160));
    this.add(hitRow("Menu", 230, 104, 12, () => this.onAction("back"), false, 90));
    if (opts.showStats) {
      if (!opts.rows.length) this.add(text("No per-stage times recorded.", 40, 140, 11, theme.muted));
      opts.rows.slice(0, 6).forEach((row, i) => {
        this.add(text(row.title, 40, 136 + i * 22, 11));
        this.add(text(row.meta, 320, 136 + i * 22, 11, theme.muted));
      });
    }
  }

  drawPuzzles(diff: string, count: number): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(hitRow("Back", 24, 16, 12, () => this.onAction("back"), false, 80));
    this.add(text("Puzzles", 275, 28, 20, theme.ink, "center"));
    this.add(text("Select Difficulty.", 40, 58, 13));
    (["easy", "medium", "hard", "insane"] as const).forEach((d, i) => {
      const mark = d === diff ? "> " : "  ";
      this.add(hitRow(mark + d, 40 + i * 120, 86, 12, () => this.onAction("diff:" + d), false, 100));
    });
    this.add(text(difficultyHint(diff as "easy" | "medium" | "hard" | "insane"), 40, 118, 11, theme.muted));
    this.add(hitRow("Play Daily", 40, 146, 13, () => this.onAction("puzzle-daily"), false, 140));
    this.add(text("Stages", 40, 178, 12));
    [1, 5, 10].forEach((n, i) => {
      const mark = n === count ? "> " : "  ";
      this.add(hitRow(mark + String(n), 120 + i * 70, 178, 12, () => this.onAction("len:" + n), false, 50));
    });
    this.add(hitRow("Start Seeded Run", 40, 220, 13, () => this.onAction("puzzle-run"), false, 180));
  }

  drawHistory(opts: {
    rows: { title: string; meta: string; replay?: () => void }[];
    seeGhosts: boolean;
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(hitRow("Back", 24, 16, 12, () => this.onAction("back"), false, 80));
    this.add(text("History", 275, 16, 18, theme.ink, "center"));
    this.add(
      hitRow(opts.seeGhosts ? "> See ghosts  On" : "  See ghosts  Off", 320, 16, 11, () => this.onAction("toggle-ghosts"), false, 180),
    );
    if (!opts.rows.length) {
      this.add(text("No finished stages yet. Clear a stage to record it here.", 40, 80, 12, theme.muted));
      return;
    }
    opts.rows.slice(0, 6).forEach((row, i) => {
      const y = 52 + i * 36;
      this.add(text(row.title, 40, y, 11));
      this.add(text(row.meta, 40, y + 14, 10, theme.muted));
      if (row.replay) this.add(hitRow("Replay", 420, y, 11, row.replay, false, 80));
    });
  }

  drawCreator(opts: {
    tiles: string[];
    spawn: [number, number];
    tool: string;
    badge: string;
    hint: string;
    seed: string;
    canSave: boolean;
    canUndo: boolean;
    canRedo: boolean;
    marks: { x: number; y: number; label: string }[];
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(hitRow("Back", 10, 6, 12, () => this.onAction("back"), false, 56));
    this.add(text("Stage Creator", 72, 8, 15));
    this.add(text(opts.badge, 250, 10, 11, theme.green));
    this.add(hitRow("Test", 490, 6, 12, () => this.onAction("creator-test"), false, 50));

    this.board = new createjs.Container();
    this.refreshCreatorBoard(opts);
    this.add(this.board);

    const hit = new createjs.Shape();
    hit.graphics.beginFill("rgba(0,0,0,0.01)").drawRect(BOARD_VIEW.x, BOARD_VIEW.y, BOARD_VIEW.w, BOARD_VIEW.h);
    hit.mouseEnabled = true;
    hit.cursor = "pointer";
    const cellOf = (ev?: unknown): { x: number; y: number } | null => {
      const e = ev as { localX?: number; localY?: number };
      if (typeof e?.localX !== "number" || typeof e?.localY !== "number") return null;
      return pickBoardCell(e.localX, e.localY);
    };
    hit.addEventListener("mousedown", (ev?: unknown) => {
      const c = cellOf(ev);
      if (c) this.onAction("paint:" + c.x + ":" + c.y + ":start");
    });
    hit.addEventListener("pressmove", (ev?: unknown) => {
      const c = cellOf(ev);
      if (c) this.onAction("paint:" + c.x + ":" + c.y + ":drag");
    });
    hit.addEventListener("pressup", () => this.onAction("paint-end"));
    this.add(hit);

    EDITOR_TOOLS.forEach((tool, i) => {
      const y = 30 + i * 18;
      const mark = opts.tool === tool.id ? "> " : "  ";
      const icon = this.toolClip(tool.id, 372, y);
      if (icon) this.add(icon);
      this.add(hitRow(mark + tool.label, 392, y, 11, () => this.onAction("tool:" + tool.id), false, 150));
    });

    if (opts.hint) this.add(text(opts.hint, 10, 248, 10, theme.muted));
    this.add(hitRow("New", 10, 266, 11, () => this.onAction("creator-new"), false, 40));
    this.add(hitRow("Clear", 56, 266, 11, () => this.onAction("creator-clear"), false, 48));
    this.add(hitRow("Undo", 112, 266, 11, () => this.onAction("creator-undo"), !opts.canUndo, 44));
    this.add(hitRow("Redo", 164, 266, 11, () => this.onAction("creator-redo"), !opts.canRedo, 44));
    this.add(hitRow("Save", 216, 266, 11, () => this.onAction("creator-save"), !opts.canSave, 44));
    this.add(hitRow("Copy Seed", 268, 266, 11, () => this.onAction("creator-copy"), false, 88));
    this.add(hitRow("Enter Code", 364, 266, 11, () => this.onAction("creator-load"), false, 96));
    this.add(hitRow("Online", 468, 266, 11, () => this.onAction("online"), false, 64));
  }

  refreshCreatorBoard(opts: {
    tiles: string[];
    spawn: [number, number];
    marks: { x: number; y: number; label: string }[];
  }): void {
    if (!this.board) return;
    this.board.removeAllChildren();
    const world = new createjs.Container();
    world.x = BOARD_OX;
    world.y = BOARD_OY;
    world.scaleX = BOARD_SCALE;
    world.scaleY = BOARD_SCALE;
    world.mouseEnabled = false;
    const cells: { x: number; y: number; ch: string }[] = [];
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 15; x++) {
        cells.push({ x, y, ch: opts.tiles[y]?.[x] ?? " " });
      }
    }
    cells.sort((a, b) => a.y - a.x - (b.y - b.x));
    for (const cell of cells) {
      const spec = clipForTile(cell.ch);
      const [px, py] = gamePos(cell.x, cell.y);
      if (!spec) {
        const ghost = new createjs.Shape();
        ghost.graphics.beginFill("rgba(255,255,255,0.05)").beginStroke("rgba(255,255,255,0.12)").setStrokeStyle(1)
          .moveTo(px - 8, py + 2).lineTo(px + 16, py - 4).lineTo(px + 28, py + 10).lineTo(px + 4, py + 16).lineTo(px - 8, py + 2);
        ghost.mouseEnabled = false;
        world.addChild(ghost);
        continue;
      }
      const clip = this.makeClip?.(spec.name);
      if (!clip) continue;
      const [ox, oy] = CLIP_OFFSET[spec.name];
      clip.x = px + ox;
      clip.y = py + oy;
      clip.mouseEnabled = false;
      if (spec.dim < 1) clip.scaleX = clip.scaleY = 1;
      (clip as HudNode & { alpha?: number }).alpha = spec.dim;
      world.addChild(clip);
    }
    const [sx, sy] = gamePos(opts.spawn[0], opts.spawn[1]);
    const block = this.makeClip?.("Block");
    if (block) {
      const [ox, oy] = CLIP_OFFSET.Block;
      block.x = sx + ox;
      block.y = sy + oy;
      block.mouseEnabled = false;
      (block as HudNode & { gotoAndStop?: (n: string | number) => void }).gotoAndStop?.("up");
      world.addChild(block);
    } else {
      const fallback = new createjs.Shape();
      fallback.graphics.beginFill("#ff7a18").drawRect(-6, -16, 12, 18);
      fallback.x = sx;
      fallback.y = sy;
      fallback.mouseEnabled = false;
      world.addChild(fallback);
    }
    this.board.addChild(world);
    for (const mark of opts.marks) {
      const [mx, my] = gamePos(mark.x, mark.y);
      const label = text(mark.label, BOARD_OX + mx * BOARD_SCALE, BOARD_OY + (my - 18) * BOARD_SCALE, 9, "#fff");
      this.board.addChild(label);
    }
  }

  private toolClip(id: string, x: number, y: number): HudNode | null {
    const ch = id === "erase" ? " " : id === "spawn" ? "b" : id === "link" ? "s" : id === "exit" ? "e" : id === "stone" ? "b" : id === "soft" ? "s" : id === "heavy" ? "h" : id === "fragile" ? "f" : id === "split" ? "v" : id === "bridgeL" ? "l" : id === "bridgeR" ? "r" : " ";
    const spec = clipForTile(ch);
    if (!spec) {
      const s = new createjs.Shape();
      s.graphics.beginFill("rgba(255,255,255,0.08)").drawRect(x, y, 12, 10);
      s.mouseEnabled = false;
      return s;
    }
    const clip = this.makeClip?.(spec.name);
    if (!clip) return null;
    clip.x = x;
    clip.y = y;
    clip.scaleX = 0.28;
    clip.scaleY = 0.28;
    clip.mouseEnabled = false;
    return clip;
  }

  drawOnline(rows: { title: string; meta: string; play: () => void }[], status: string): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(hitRow("Back", 24, 16, 12, () => this.onAction("creator"), false, 80));
    this.add(text("Online Stages", 275, 18, 18, theme.ink, "center"));
    if (status) this.add(text(status, 40, 80, 12, theme.muted));
    rows.slice(0, 7).forEach((row, i) => {
      const y = 54 + i * 30;
      this.add(text(row.title, 40, y, 12));
      this.add(text(row.meta, 40, y + 14, 10, theme.muted));
      this.add(hitRow("Play", 430, y, 11, row.play, false, 70));
    });
  }

  drawInGameDev(banner = ""): void {
    this.clear();
    this.hideMascot();
    this.add(hitRow("Beat stage for me", 12, 30, 11, () => this.onAction("dev-beat"), false, 160));
    this.add(hitRow("Dev menu", 12, 50, 11, () => this.onAction("dev-menu"), false, 120));
    if (banner) this.add(text(banner, 12, 72, 11, paint().green));
  }
}

function swatch(x: number, y: number, hue: number, amt: number): HudShape {
  const s = new createjs.Shape();
  const a = Math.max(0.15, amt);
  s.graphics.beginFill(`hsla(${Math.round(hue)}, 72%, 48%, ${a})`).drawRect(x, y, 16, 12);
  s.mouseEnabled = false;
  return s;
}
