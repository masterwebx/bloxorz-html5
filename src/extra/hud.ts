import { playHomeWhoosh, playUiClick, playUiLatch } from "./audio";
import {
  BOARD_VIEW,
  CLIP_OFFSET,
  clipForTile,
  type ClipName,
} from "./coolmathBoard";
import { EDITOR_TOOLS } from "./editor";
import { difficultyHint } from "./generate";
import { DEFAULT_ISO, TILE_FACE, isoCenter, isoPt, pickIsoCell, type IsoMetrics } from "./isoBoard";
import { rustFaces } from "./hue";
import { currentTheme, type ThemeId } from "./settings";
import { wantsVirtualPad } from "./touchPad";

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

function hitFill(): string {
  return wantsVirtualPad() ? "rgba(255,180,80,0.16)" : "rgba(255,180,80,0.08)";
}

function hitRow(label: string, x: number, y: number, size: number, fn: () => void, disabled = false, minW = 220, focused = false): HudNode {
  const theme = paint();
  const row = new createjs.Container();
  row.x = x;
  row.y = y;
  const t = text(label, 0, 0, size, disabled ? theme.muted : focused ? theme.hot : theme.ink);
  t.mouseEnabled = false;
  if (focused && !disabled) glow(t, true, theme);
  const pad = wantsVirtualPad();
  const w = Math.max(minW, (t.getMeasuredWidth?.() || label.length * size * 0.62) + (pad ? 36 : 24));
  const h = Math.max(pad ? 32 : 24, size + (pad ? 16 : 10));
  const area = new createjs.Shape();
  area.graphics.beginFill(hitFill()).drawRect(-8, -6, w, h);
  area.mouseEnabled = !disabled;
  area.cursor = disabled ? "default" : "pointer";
  if (!disabled) {
    const ink = theme.ink;
    const hot = theme.hot;
    let last = 0;
    const fire = (): void => {
      const now = Date.now();
      if (now - last < 280) return;
      last = now;
      playUiLatch();
      fn();
    };
    area.addEventListener("click", fire);
    area.addEventListener("mousedown", fire);
    area.addEventListener("mouseover", () => {
      playUiClick();
      t.color = hot;
      glow(t, true, theme);
    });
    area.addEventListener("mouseout", () => {
      t.color = focused ? hot : ink;
      glow(t, focused, theme);
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
    hit.graphics.beginFill(hitFill()).drawRect(28, 0, w, 22);
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

const CLIP_ISO_SCALE = 0.3;

export class ExtraHud {
  readonly root: HudNode;
  private layer: HudNode;
  private board: HudNode | null = null;
  private mascot: HudNode | null = null;
  onAction: (act: string) => void = () => undefined;
  makeMascot: (() => HudNode | null) | null = null;
  makeClip: ((name: ClipName) => HudNode | null) | null = null;
  makePreview: (() => HudNode | null) | null = null;
  focusId = "";
  private preview: HudNode | null = null;

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

  private act(id: string, label: string, x: number, y: number, size: number, disabled = false, minW = 220): HudNode {
    return hitRow(label, x, y, size, () => this.onAction(id), disabled, minW, this.focusId === id);
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

  private placePreview(x: number, y: number): void {
    if (!this.preview && this.makePreview) this.preview = this.makePreview();
    if (!this.preview) {
      this.add(blockPreview(x, y, 0));
      return;
    }
    this.preview.visible = true;
    this.preview.mouseEnabled = false;
    this.preview.scaleX = 0.34;
    this.preview.scaleY = 0.34;
    this.preview.x = x;
    this.preview.y = y + 36;
    this.add(this.preview);
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
      const y = 70 + i * (wantsVirtualPad() ? 24 : 20);
      const row = hitRow(prefix + item.label, animate ? -160 : targetX, y, wantsVirtualPad() ? 15 : 13, () => this.onAction(item.id), !!item.disabled, 260);
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
    hit.graphics.beginFill("rgba(255,180,80,0.04)").drawRect(0, 0, 550, 300);
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
    this.add(this.act("name-continue", "Continue", 40, 168, 13, false, 120));
    this.add(this.act("skip-name", "Stay anonymous", 160, 168, 13, false, 160));
  }

  drawCredits(): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("back", "Back", 24, 16, 12, false, 80));
    this.add(text("Credits", 275, 28, 20, theme.ink, "center"));
    this.add(text("Bloxorz — Damien Clarke / DX Interactive, 2007.", 40, 80, 11, theme.muted));
    this.add(text("Playfield: Coolmath Animate HTML5 export.", 40, 102, 11, theme.muted));
    this.add(text("Timer & themes — Nathan Spencer.", 40, 124, 11, theme.muted));
  }

  drawLoadPasscode(error: string): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("back", "Back", 24, 16, 12, false, 80));
    this.add(text("Load Stage", 275, 28, 20, theme.ink, "center"));
    this.add(text("Campaign passcode, six digits.", 40, 80, 11, theme.muted));
    this.add(fieldBox(40, 114, 160));
    if (error) this.add(text(error, 40, 150, 11, "#ff8a8a"));
    this.add(this.act("load-go", "Load", 40, 180, 13, false, 80));
  }

  drawLoadStages(): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("back", "Back", 24, 16, 12, false, 80));
    this.add(text("Load Stage", 275, 28, 20, theme.ink, "center"));
    this.add(text("Jump to a campaign stage.", 40, 54, 11, theme.muted));
    for (let i = 1; i <= 33; i++) {
      const col = (i - 1) % 11;
      const row = Math.floor((i - 1) / 11);
      const n = String(i).padStart(2, "0");
      this.add(this.act("dev:" + i, n, 40 + col * 42, 86 + row * 28, 13, false, 36));
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
    this.add(this.act("back", "Back", 24, 8, 12, false, 80));
    this.add(text("Settings", 275, 8, 16, theme.ink, "center"));
    this.add(text("Name", 40, 34, 12));
    this.add(fieldBox(100, 32, 220));
    this.add(text("Music", 40, 62, 12, this.focusId === "music" ? theme.hot : theme.ink));
    this.add(slider(100, 62, 140, opts.music, (v) => this.onAction("music:" + v.toFixed(2))));
    this.add(text(Math.round(opts.music * 100) + "%", 300, 62, 11, theme.muted));
    this.add(text("SFX", 40, 84, 12, this.focusId === "sfx" ? theme.hot : theme.ink));
    this.add(slider(100, 84, 140, opts.sfx, (v) => this.onAction("sfx:" + v.toFixed(2))));
    this.add(text(Math.round(opts.sfx * 100) + "%", 300, 84, 11, theme.muted));
    this.add(this.act("toggle-rumble", opts.rumble ? "> Rumble  On" : "  Rumble  Off", 40, 106, 12, false, 200));
    this.add(this.act("toggle-timer", opts.showTimer ? "> Speedrun timer  On" : "  Speedrun timer  Off", 40, 126, 12, false, 240));
    this.add(text("Theme", 40, 146, 12));
    (["original", "gray", "holiday"] as const).forEach((th, i) => {
      const mark = opts.theme === th ? "> " : "  ";
      this.add(this.act("theme:" + th, mark + th, 110 + i * 110, 146, 12, false, 100));
    });
    this.add(this.act("toggle-theme-bg", opts.themeBg ? "> Theme background  On" : "  Theme background  Off", 40, 166, 12, false, 260));
    this.add(text("Backdrop tint", 40, 188, 12, this.focusId === "bgtint" ? theme.hot : theme.ink));
    this.add(slider(160, 188, 120, opts.bgTint, (v) => this.onAction("bgtint:" + v.toFixed(2))));
    this.add(swatch(300, 190, opts.bgHue, opts.bgTint));
    this.add(text("Backdrop hue", 40, 210, 12, this.focusId === "bghue" ? theme.hot : theme.ink));
    this.add(slider(160, 210, 120, opts.bgHue / 360, (v) => this.onAction("bghue:" + Math.round(v * 360))));
    this.add(text(String(Math.round(opts.bgHue)), 300, 210, 11, theme.muted));
    this.add(text("Block hue", 40, 232, 12, this.focusId === "blockhue" ? theme.hot : theme.ink));
    this.add(slider(160, 232, 120, opts.blockHue / 360, (v) => this.onAction("blockhue:" + Math.round(v * 360))));
    this.add(swatch(300, 234, opts.blockHue, opts.blockHue > 0 ? 1 : 0.35));
    this.placePreview(392, 188);
    this.add(this.act("remap", "Remap controls", 40, 256, 12, false, 180));
  }

  drawRemap(rows: { id: string; label: string; bind: string }[], waiting: string | null): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("settings", "Back", 24, 12, 12, false, 80));
    this.add(text("Remap controls", 275, 12, 18, theme.ink, "center"));
    this.add(text(waiting ? "Press a key or pad button for " + waiting + "…" : "Click a row, then press a key or pad button.", 40, 40, 11, theme.muted));
    rows.forEach((row, i) => {
      const y = 68 + i * 22;
      const mark = waiting === row.id ? "> " : "  ";
      this.add(this.act("rebind:" + row.id, `${mark}${row.label}`, 40, y, 12, false, 200));
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
    this.add(this.act("toggle-stats", opts.showStats ? "> Hide Stats" : "  Show Stats", 40, 104, 12, false, 160));
    this.add(this.act("back", "Menu", 230, 104, 12, false, 90));
    if (opts.showStats) {
      if (!opts.rows.length) this.add(text("No per-stage times recorded.", 40, 140, 11, theme.muted));
      opts.rows.slice(0, 6).forEach((row, i) => {
        this.add(text(row.title, 40, 136 + i * 22, 11));
        this.add(text(row.meta, 320, 136 + i * 22, 11, theme.muted));
      });
    }
  }

  drawPuzzles(date: string): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("back", "Back", 24, 12, 12, false, 80));
    this.add(text("Puzzles", 275, 12, 18, theme.ink, "center"));
    const card = new createjs.Shape();
    card.graphics.beginFill("rgba(255,120,30,0.16)").beginStroke("#c45a18").setStrokeStyle(1).drawRect(24, 44, 502, 148);
    card.mouseEnabled = false;
    this.add(card);
    this.add(text("DAILY PUZZLE", 40, 56, 22, theme.ink));
    this.add(text(date, 40, 86, 14, theme.muted));
    this.add(text("Full 15×10 board. Same brutal stage for everyone today.", 40, 110, 12, theme.muted));
    this.add(this.act("puzzle-daily", "Play Daily", 40, 142, 16, false, 200));
    this.add(this.act("puzzles-seeded", "Seeded", 40, 208, 14, false, 140));
    this.add(this.act("puzzles-gauntlet", "Gauntlet", 200, 208, 14, false, 140));
    this.add(text("Share a seed, or run five stages.", 40, 248, 11, theme.muted));
  }

  drawSeeded(): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("puzzles", "Back", 24, 16, 12, false, 80));
    this.add(text("Seeded Run", 275, 28, 20, theme.ink, "center"));
    this.add(text("Play this seed, or type another.", 40, 80, 12, theme.muted));
    this.add(fieldBox(40, 112, 280));
    this.add(this.act("puzzle-seed-go", "Play", 40, 154, 14, false, 100));
    this.add(text("Same seed, same map. Built to need the switches.", 40, 200, 11, theme.muted));
  }

  drawGauntlet(diff: string): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("puzzles", "Back", 24, 16, 12, false, 80));
    this.add(text("Gauntlet", 275, 28, 20, theme.ink, "center"));
    (["easy", "medium", "hard", "insane"] as const).forEach((d, i) => {
      const mark = d === diff ? "> " : "  ";
      this.add(this.act("diff:" + d, mark + d, 40 + i * 120, 78, 13, false, 100));
    });
    this.add(text(difficultyHint(diff as "easy" | "medium" | "hard" | "insane"), 40, 110, 11, theme.muted));
    this.add(text("Seed — share this with friends.", 40, 138, 12, theme.muted));
    this.add(fieldBox(40, 160, 280));
    this.add(this.act("gauntlet-go", "Play Gauntlet", 40, 200, 14, false, 180));
    this.add(text("Five stages. Same seed, same gauntlet.", 40, 236, 11, theme.muted));
  }

  drawTitleCard(title: string, subtitle = ""): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    const bg = new createjs.Shape();
    bg.graphics.beginFill("#000").drawRect(0, 0, 550, 300);
    bg.mouseEnabled = false;
    this.add(bg);
    const label = title.toUpperCase().slice(0, 18);
    const pitch = Math.min(5.2, 500 / (Math.max(1, label.length) * 6));
    const width = label.length * 6 * pitch;
    drawBillboard(this.layer, label, 275 - width / 2, 108, 500);
    if (subtitle) this.add(text(subtitle, 275, 168, 14, theme.muted, "center"));
  }

  drawHistory(opts: {
    rows: { title: string; meta: string; replay?: () => void }[];
    seeGhosts: boolean;
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("back", "Back", 24, 16, 12, false, 80));
    this.add(text("History", 275, 16, 18, theme.ink, "center"));
    this.add(this.act("toggle-ghosts", opts.seeGhosts ? "> See ghosts   On" : "  See ghosts   Off", 40, 48, 14, false, 280));
    if (!opts.rows.length) {
      this.add(text("No finished stages yet. Clear a stage to record it here.", 40, 96, 12, theme.muted));
      return;
    }
    opts.rows.slice(0, 5).forEach((row, i) => {
      const y = 86 + i * 38;
      this.add(text(row.title, 40, y, 11));
      this.add(text(row.meta, 40, y + 14, 10, theme.muted));
      if (row.replay) this.add(this.act("replay:" + i, "Replay", 420, y, 11, false, 80));
    });
  }

  drawCreatorHub(title: string, items: MenuItem[], cursor = 0): void {
    this.clear();
    this.hideMascot();
    this.add(text(title, 40, 70, 20));
    items.forEach((item, i) => {
      const mark = i === cursor ? "> " : "  ";
      this.add(hitRow(mark + item.label, 40, 118 + i * 32, 16, () => this.onAction(item.id), !!item.disabled, 260));
    });
  }

  drawCreatorList(opts: {
    title: string;
    rows: { title: string; meta: string; openId: string; deleteId?: string }[];
    empty: string;
    backId: string;
    scroll: number;
    total: number;
    pageSize: number;
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act(opts.backId, "Back", 24, 16, 12, false, 80));
    this.add(text(opts.title, 275, 18, 18, theme.ink, "center"));
    if (!opts.rows.length) {
      this.add(text(opts.empty, 40, 80, 12, theme.muted));
      return;
    }
    opts.rows.forEach((row, i) => {
      const y = 48 + i * 38;
      this.add(this.act(row.openId, row.title || "Untitled", 40, y, 13, false, 300));
      this.add(text(row.meta, 40, y + 18, 10, theme.muted));
      if (row.deleteId) this.add(this.act(row.deleteId, "Delete", 420, y, 13, false, 96));
    });
    if (opts.total > opts.pageSize) {
      const trackH = 210;
      const trackX = 528;
      const trackY = 50;
      const bar = new createjs.Shape();
      bar.graphics.beginFill(theme.track).drawRect(trackX, trackY, 6, trackH);
      const thumbH = Math.max(18, trackH * (opts.pageSize / opts.total));
      const max = Math.max(1, opts.total - opts.pageSize);
      const thumbY = trackY + (trackH - thumbH) * (opts.scroll / max);
      bar.graphics.beginFill(theme.fill).drawRect(trackX, thumbY, 6, thumbH);
      bar.mouseEnabled = false;
      this.add(bar);
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
    canUndo: boolean;
    canRedo: boolean;
    marks: { x: number; y: number; label: string }[];
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("creator-make", "Back", 10, 6, 12, false, 56));
    this.add(text("Name", 72, 8, 12));
    this.add(fieldBox(118, 6, 200));
    this.add(text(opts.badge, 330, 8, 11, theme.green));
    this.add(this.act("creator-test", "Test", 490, 6, 12, false, 50));

    this.board = new createjs.Container();
    this.refreshCreatorBoard(opts);
    this.add(this.board);

    const hit = new createjs.Shape();
    hit.graphics.beginFill("rgba(255,180,80,0.04)").drawRect(BOARD_VIEW.x, BOARD_VIEW.y, BOARD_VIEW.w, BOARD_VIEW.h);
    hit.mouseEnabled = true;
    hit.cursor = "pointer";
    const cellOf = (ev?: unknown): { x: number; y: number } | null => {
      const e = ev as { localX?: number; localY?: number };
      if (typeof e?.localX !== "number" || typeof e?.localY !== "number") return null;
      return pickIsoCell(e.localX, e.localY, DEFAULT_ISO);
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
      const col = i < 6 ? 0 : 1;
      const row = i < 6 ? i : i - 6;
      const x = 360 + col * 96;
      const y = 32 + row * 28;
      const mark = opts.tool === tool.id ? "> " : "  ";
      const icon = this.toolClip(tool.id, x, y);
      if (icon) this.add(icon);
      this.add(this.act("tool:" + tool.id, mark + tool.label, x + 18, y, 11, false, 78));
    });

    if (opts.hint) this.add(text(opts.hint, 10, 248, 10, theme.muted));
    this.add(this.act("creator-new", "New", 10, 266, 11, false, 40));
    this.add(this.act("creator-clear", "Clear", 56, 266, 11, false, 48));
    this.add(this.act("creator-undo", "Undo", 112, 266, 11, !opts.canUndo, 44));
    this.add(this.act("creator-redo", "Redo", 164, 266, 11, !opts.canRedo, 44));
    this.add(this.act("creator-save", "Save", 216, 266, 11, !opts.canSave, 44));
    this.add(this.act("creator-copy", "Copy Seed", 268, 266, 11, false, 88));
    this.add(this.act("creator-load", "Enter Code", 364, 266, 11, false, 96));
  }

  refreshCreatorBoard(opts: {
    tiles: string[];
    spawn: [number, number];
    marks: { x: number; y: number; label: string }[];
  }): void {
    if (!this.board) return;
    this.board.removeAllChildren();
    const mesh = new createjs.Shape();
    mesh.mouseEnabled = false;
    const cells: { x: number; y: number; ch: string }[] = [];
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 15; x++) cells.push({ x, y, ch: opts.tiles[y]?.[x] ?? " " });
    }
    cells.sort((a, b) => a.y - a.x - (b.y - b.x));
    const overlays: HudNode[] = [];
    for (const cell of cells) {
      drawIsoTile(mesh, cell.x, cell.y, cell.ch, DEFAULT_ISO);
      if (cell.ch === " ") continue;
      const clip = this.tryAtlasClip(cell.ch);
      if (!clip) continue;
      const spec = clipForTile(cell.ch);
      const p = isoCenter(cell.x, cell.y, DEFAULT_ISO);
      const [ox, oy] = spec ? CLIP_OFFSET[spec.name] : [0, 0];
      clip.x = p.x + ox * CLIP_ISO_SCALE;
      clip.y = p.y + oy * CLIP_ISO_SCALE;
      clip.scaleX = CLIP_ISO_SCALE;
      clip.scaleY = CLIP_ISO_SCALE;
      clip.mouseEnabled = false;
      if (spec && spec.dim < 1) (clip as HudNode & { alpha?: number }).alpha = spec.dim;
      overlays.push(clip);
    }
    this.board.addChild(mesh);
    for (const clip of overlays) this.board.addChild(clip);
    const spawn = isoCenter(opts.spawn[0], opts.spawn[1], DEFAULT_ISO);
    const block = new createjs.Shape();
    block.graphics.beginFill("#ff7a18").drawRect(-5, -14, 10, 16);
    block.x = spawn.x;
    block.y = spawn.y;
    block.mouseEnabled = false;
    this.board.addChild(block);
    for (const mark of opts.marks) {
      const p = isoCenter(mark.x, mark.y, DEFAULT_ISO);
      this.board.addChild(text(mark.label, p.x - 3, p.y - 6, 9, "#fff"));
    }
  }

  private tryAtlasClip(ch: string): HudNode | null {
    if (ch === " ") return null;
    const spec = clipForTile(ch);
    if (!spec) return null;
    try {
      return this.makeClip?.(spec.name) ?? null;
    } catch {
      return null;
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
    this.add(this.act("creator-play", "Back", 24, 16, 12, false, 80));
    this.add(text("Online Stages", 275, 18, 18, theme.ink, "center"));
    if (status) this.add(text(status, 40, 80, 12, theme.muted));
    rows.slice(0, 7).forEach((row, i) => {
      const y = 54 + i * 30;
      this.add(text(row.title, 40, y, 12));
      this.add(text(row.meta, 40, y + 14, 10, theme.muted));
      this.add(this.act("online-play:" + i, "Play", 430, y, 11, false, 70));
    });
  }

  drawInGameDev(banner = "", autoSolve = false): void {
    this.clear();
    this.hideMascot();
    this.add(hitRow(autoSolve ? "Stop auto-solve" : "Beat stage for me", 12, 30, 11, () => this.onAction("dev-beat"), false, 160));
    this.add(hitRow("Dev menu", 12, 50, 11, () => this.onAction("dev-menu"), false, 120));
    if (banner) this.add(text(banner, 12, 72, 11, paint().green));
  }
}

function drawIsoTile(shape: HudShape, x: number, y: number, ch: string, m: IsoMetrics): void {
  const face = TILE_FACE[ch] || TILE_FACE[" "];
  const a = isoPt(x, y, m);
  const b = isoPt(x + 1, y, m);
  const c = isoPt(x + 1, y + 1, m);
  const d = isoPt(x, y + 1, m);
  const h = ch === " " ? 0 : 5 * m.s;
  if (h > 0) {
    shape.graphics.beginFill(face.left).moveTo(a.x, a.y).lineTo(d.x, d.y).lineTo(d.x, d.y + h).lineTo(a.x, a.y + h).endFill();
    shape.graphics.beginFill(face.right).moveTo(d.x, d.y).lineTo(c.x, c.y).lineTo(c.x, c.y + h).lineTo(d.x, d.y + h).endFill();
  }
  shape.graphics.beginFill(face.top).beginStroke(face.stroke).setStrokeStyle(0.8)
    .moveTo(a.x, a.y - h).lineTo(b.x, b.y - h).lineTo(c.x, c.y - h).lineTo(d.x, d.y - h).lineTo(a.x, a.y - h).endFill();
}

function blockPreview(x: number, y: number, hue: number): HudShape {
  const face = rustFaces(hue);
  const s = new createjs.Shape();
  const ox = x + 18;
  const oy = y + 28;
  s.graphics.beginFill(face.top).beginStroke(face.edge).setStrokeStyle(1)
    .moveTo(ox, oy - 22).lineTo(ox + 16, oy - 14).lineTo(ox, oy - 6).lineTo(ox - 16, oy - 14).lineTo(ox, oy - 22).endFill();
  s.graphics.beginFill(face.left)
    .moveTo(ox - 16, oy - 14).lineTo(ox, oy - 6).lineTo(ox, oy + 12).lineTo(ox - 16, oy + 4).lineTo(ox - 16, oy - 14).endFill();
  s.graphics.beginFill(face.right)
    .moveTo(ox, oy - 6).lineTo(ox + 16, oy - 14).lineTo(ox + 16, oy + 4).lineTo(ox, oy + 12).lineTo(ox, oy - 6).endFill();
  s.mouseEnabled = false;
  return s;
}

function swatch(x: number, y: number, hue: number, amt: number): HudShape {
  const s = new createjs.Shape();
  const a = Math.max(0.15, amt);
  s.graphics.beginFill(`hsla(${Math.round(hue)}, 72%, 48%, ${a})`).drawRect(x, y, 16, 12);
  s.mouseEnabled = false;
  return s;
}
