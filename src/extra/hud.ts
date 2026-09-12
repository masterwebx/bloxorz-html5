import { playHomeWhoosh, playUiClick, playUiLatch } from "./audio";
import { ATTRACT_TITLE_Y } from "./attract";
import {
  BOARD_SCALE,
  BOARD_VIEW,
  CLIP_OFFSET,
  boardCellCenter,
  boardCellCorners,
  boardScreen,
  clipForTile,
  occupiedCells,
  pickBoardCell,
  type ClipName,
} from "./coolmathBoard";
import {
  COLOR_PREVIEW_DEF,
  COLOR_PREVIEW_SPAWN,
  COLOR_SLOT_META,
  resolveTileFace,
  type ColorCustom,
} from "./colorCustom";
import { EDITOR_TOOLS } from "./editor";
import { TOOL_CH, isoPt, type IsoMetrics } from "./isoBoard";
import { t } from "./i18n";
import { currentTheme } from "./settings";
import { themePaint } from "./themePack";
import { wantsVirtualPad } from "./touchPad";

/** Customize Colors preview: shapes only before bake; real Stage Creator clips after. */
export function customizePreviewForceShapes(tileAtlasReady: boolean): boolean {
  return !tileAtlasReady;
}

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
  hitW?: number;
  visible: boolean;
  alpha?: number;
  mouseEnabled: boolean;
  mouseChildren?: boolean;
  cursor?: string;
  hitArea?: HudNode;
  shadow?: unknown;
  parent?: unknown;
  cacheID?: number;
  gotoAndStop?: (n: string | number) => void;
  tickEnabled?: boolean;
  addChild: (...c: HudNode[]) => void;
  removeChild?: (c: HudNode) => void;
  removeAllChildren: () => void;
  addEventListener: (type: string, fn: (ev?: unknown) => void) => void;
  cache?: (x: number, y: number, w: number, h: number, scale?: number) => void;
  updateCache?: () => void;
  uncache?: () => void;
  getBounds?: () => { x: number; y: number; width: number; height: number } | null;
  filters?: unknown;
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
    drawEllipse: (x: number, y: number, w: number, h: number) => HudShape["graphics"];
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

function paint(): ThemePaint {
  return themePaint(currentTheme());
}

/** Title / attract brand stack — Orbitron first, system sans for unsupported glyphs. */
export const FONT = "Orbitron, sans-serif";

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
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
};

export function billboardSupports(ch: string): boolean {
  return Object.prototype.hasOwnProperty.call(BILLBOARD, ch);
}

export function foldBillboard(label: string): string {
  return label.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
}

export function canBillboard(label: string): boolean {
  const folded = foldBillboard(label);
  const chars = [...folded].filter((ch) => ch !== " ");
  return chars.length > 0 && chars.every((ch) => billboardSupports(ch));
}

/** LED dots when every glyph is in the billboard atlas; else neon Orbitron text. */
export function neonTitleMode(label: string): "billboard" | "orbitron" {
  return canBillboard(label) ? "billboard" : "orbitron";
}

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

/**
 * Orbitron neon brand title when billboard lamps cannot spell the label.
 * Uses billboard core/shadow colors so attract / stage cards still read as title chrome.
 */
function brandOrbitron(str: string, x: number, y: number, size: number, align = "center"): HudText {
  const theme = paint();
  const t = new createjs.Text(str, `700 ${size}px ${FONT}`, theme.billboardCore);
  t.x = x;
  t.y = y;
  t.textAlign = align;
  t.mouseEnabled = false;
  t.shadow = new createjs.Shadow(theme.shadow, 0, 0, Math.max(14, Math.round(size * 0.5)));
  return t;
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
  row.hitW = w;
  const area = new createjs.Shape();
  area.graphics.beginFill("#000").drawRect(-8, -6, w, h);
  row.hitArea = area;
  row.cursor = disabled ? "default" : "pointer";
  row.mouseEnabled = !disabled;
  row.mouseChildren = false;
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
    row.addEventListener("click", fire);
    row.addEventListener("mousedown", fire);
    row.addEventListener("mouseover", () => {
      playUiClick();
      t.color = hot;
      glow(t, true, theme);
    });
    row.addEventListener("mouseout", () => {
      t.color = focused ? hot : ink;
      glow(t, focused, theme);
    });
  }
  row.addChild(t);
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
  const area = new createjs.Shape();
  area.graphics.beginFill("#000").drawRect(28, 0, w, 22);
  hit.hitArea = area;
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
  makeTile: ((ch: string) => HudNode | null) | null = null;
  focusId = "";

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
    this.mascot.scaleX = 0.82;
    this.mascot.scaleY = 0.82;
    this.mascot.x = brandX + brandWidth + 10;
    // Sit below the billboard top edge so the spinning block isn't cropped.
    this.mascot.y = brandY + 58;
    this.mascot.shadow = new createjs.Shadow("rgba(255,102,0,1)", 0, 0, 16);
    if (this.mascot.parent !== this.root) this.root.addChild(this.mascot);
  }

  hideMascot(): void {
    if (!this.mascot) return;
    this.mascot.visible = false;
    if (this.mascot.parent === this.root) this.root.removeChild?.(this.mascot);
  }

  hueClips(): HudNode[] {
    const out: HudNode[] = [];
    if (this.mascot?.parent) out.push(this.mascot);
    return out;
  }

  drawHome(title: string, items: MenuItem[], cursor: number, animate = false): void {
    this.clear();
    const brandX = 28;
    const brandY = 14;
    let w: number;
    if (neonTitleMode(title) === "billboard") {
      w = drawBillboard(this.layer, title, brandX, brandY, 300);
    } else {
      const node = brandOrbitron(title, brandX, brandY + 6, 26, "left");
      this.add(node);
      w = node.getMeasuredWidth?.() || Math.max(120, title.length * 16);
    }
    this.placeMascot(w, brandX, brandY);
    const rows: HudNode[] = [];
    const gap = items.length > 8 ? (wantsVirtualPad() ? 20 : 18) : wantsVirtualPad() ? 24 : 20;
    items.forEach((item, i) => {
      const prefix = i === cursor && !item.disabled ? "> " : "  ";
      const targetX = 40;
      const fromX = i % 2 === 0 ? -180 : 580;
      const y = 70 + i * gap;
      const row = hitRow(prefix + item.label, animate ? fromX : targetX, y, wantsVirtualPad() ? 15 : 13, () => this.onAction(item.id), !!item.disabled, 260);
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
    const area = new createjs.Shape();
    area.graphics.beginFill("#000").drawRect(0, 0, 550, 300);
    hit.hitArea = area;
    hit.mouseEnabled = true;
    hit.cursor = "pointer";
    hit.addEventListener("click", () => {
      playUiLatch();
      this.onAction("splash-continue");
    });
    this.add(hit);
    this.add(text(t("splash.line1"), 275, 108, 13, theme.ink, "center"));
    this.add(text(t("splash.line2"), 275, 132, 13, theme.ink, "center"));
    this.add(text(t("splash.line3"), 275, 156, 13, theme.ink, "center"));
    this.add(text(t("splash.prompt"), 275, 214, 12, theme.muted, "center"));
  }

  drawName(): void {
    this.clear();
    this.hideMascot();
    this.add(text(t("name.title"), 40, 70, 18));
    this.add(fieldBox(40, 128, 240));
    this.add(this.act("name-continue", t("name.continue"), 40, 168, 13, false, 120));
    this.add(this.act("skip-name", t("name.skip"), 160, 168, 13, false, 160));
  }

  /** In-HUD color preset naming (replaces window.prompt). */
  drawPresetName(): void {
    this.clear();
    this.hideMascot();
    this.add(text(t("settings.savePresetPrompt"), 40, 70, 16));
    this.add(fieldBox(40, 128, 240));
    this.add(this.act("preset-name-save", t("name.continue"), 40, 168, 13, false, 120));
    this.add(this.act("preset-name-cancel", t("common.back"), 160, 168, 13, false, 160));
  }

  drawRecords(opts: {
    rows: { label: string; meta: string }[];
    scroll: number;
    total: number;
    pageSize: number;
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("back", t("common.back"), 24, 8, 12, false, 80));
    this.add(text(t("records.title"), 275, 8, 16, theme.ink, "center"));
    opts.rows.forEach((row, i) => {
      const y = 48 + i * 38;
      this.add(text(row.label, 24, y, 13, theme.ink));
      this.add(text(row.meta, 40, y + 16, 9, theme.muted));
    });
    if (opts.total > opts.pageSize) {
      const trackH = 228;
      const trackX = 528;
      const trackY = 48;
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

  drawAchievements(opts: {
    tokens: number;
    have: number;
    total: number;
    rows: { n: number; label: string; meta: string }[];
    scroll: number;
    pageSize: number;
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("back", t("common.back"), 24, 8, 12, false, 80));
    this.add(text(t("achievements.title"), 275, 8, 16, theme.ink, "center"));
    this.add(text(`${t("achievements.tokens", { n: opts.tokens })}   ${t("achievements.progress", { have: opts.have, total: opts.total })}`, 275, 28, 10, theme.muted, "center"));
    opts.rows.forEach((row, i) => {
      const y = 48 + i * 38;
      this.add(this.act("ach:" + row.n, row.label, 24, y, 12, false, 400));
      this.add(text(row.meta, 40, y + 16, 9, theme.muted));
    });
    if (opts.total > opts.pageSize) {
      const trackH = 228;
      const trackX = 528;
      const trackY = 48;
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

  drawCredits(): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("back", t("common.back"), 24, 16, 12, false, 80));
    this.add(text(t("credits.title"), 275, 28, 20, theme.ink, "center"));
    this.add(text(t("credits.damien"), 40, 72, 11, theme.muted));
    this.add(text(t("credits.coolmath"), 40, 94, 11, theme.muted));
    this.add(text(t("credits.spencer"), 40, 116, 11, theme.muted));
    this.add(text(t("credits.plus"), 40, 138, 11, theme.muted));
  }

  drawLoadPasscode(error: string): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("back", t("common.back"), 24, 16, 12, false, 80));
    this.add(text(t("load.title"), 275, 28, 20, theme.ink, "center"));
    this.add(text(t("load.hint"), 40, 80, 11, theme.muted));
    this.add(fieldBox(40, 114, 160));
    if (error) this.add(text(error, 40, 150, 11, "#ff8a8a"));
    this.add(this.act("load-go", t("common.load"), 40, 180, 13, false, 80));
  }

  drawLoadStages(): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("back", t("common.back"), 24, 16, 12, false, 80));
    this.add(text(t("load.title"), 275, 28, 20, theme.ink, "center"));
    this.add(text(t("load.jump"), 40, 54, 11, theme.muted));
    for (let i = 1; i <= 33; i++) {
      const col = (i - 1) % 11;
      const row = Math.floor((i - 1) / 11);
      const n = String(i).padStart(2, "0");
      this.add(this.act("dev:" + i, n, 40 + col * 42, 86 + row * 28, 13, false, 36));
    }
  }

  drawMobileAsk(): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(text(t("mobile.title"), 275, 36, 20, theme.ink, "center"));
    this.add(text(t("mobile.body1"), 275, 80, 12, theme.muted, "center"));
    this.add(text(t("mobile.body2"), 275, 100, 12, theme.muted, "center"));
    this.add(this.act("mobile-pad-on", t("mobile.enable"), 40, 150, 16, false, 160));
    this.add(this.act("mobile-pad-off", t("mobile.later"), 230, 150, 16, false, 160));
    this.add(text(t("mobile.footer"), 275, 220, 11, theme.muted, "center"));
  }

  drawSettings(opts: {
    rumble: boolean;
    showTimer: boolean;
    showStageName: boolean;
    showPlayTime: boolean;
    mobilePad: boolean;
    rotateScreen: boolean;
    themeBg: boolean;
    webcamBg: boolean;
    tabCastBg: boolean;
    fullscreen?: boolean;
    music: number;
    sfx: number;
    bgTint: number;
    bgHue: number;
    bgColorOn: boolean;
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    const onOff = (on: boolean) => (on ? t("common.on") : t("common.off"));
    this.add(this.act("back", t("common.back"), 24, 6, 12, false, 80));
    this.add(text(t("settings.title"), 275, 6, 16, theme.ink, "center"));
    this.add(text(t("settings.name"), 40, 26, 12));
    this.add(fieldBox(100, 24, 220));
    this.add(text(t("settings.music"), 40, 48, 12, this.focusId === "music" ? theme.hot : theme.ink));
    this.add(slider(100, 48, 140, opts.music, (v) => this.onAction("music:" + v.toFixed(2))));
    this.add(text(Math.round(opts.music * 100) + "%", 300, 48, 11, theme.muted));
    this.add(text(t("settings.sfx"), 40, 66, 12, this.focusId === "sfx" ? theme.hot : theme.ink));
    this.add(slider(100, 66, 140, opts.sfx, (v) => this.onAction("sfx:" + v.toFixed(2))));
    this.add(text(Math.round(opts.sfx * 100) + "%", 300, 66, 11, theme.muted));
    this.add(this.act("toggle-rumble", `${this.focusId === "toggle-rumble" ? "> " : "  "}${t("settings.rumble")}  ${onOff(opts.rumble)}`, 40, 86, 12, false, 150));
    this.add(this.act("toggle-mobile-pad", `${this.focusId === "toggle-mobile-pad" ? "> " : "  "}${t("settings.pad")}  ${onOff(opts.mobilePad)}`, 250, 86, 12, false, 180));
    this.add(this.act("toggle-timer", `${this.focusId === "toggle-timer" ? "> " : "  "}${t("settings.timer")}  ${onOff(opts.showTimer)}`, 40, 106, 12, false, opts.mobilePad ? 155 : 175));
    this.add(this.act("toggle-stage-name", `${this.focusId === "toggle-stage-name" ? "> " : "  "}${t("settings.stageName")}  ${onOff(opts.showStageName)}`, opts.mobilePad ? 198 : 230, 106, 11, false, opts.mobilePad ? 140 : 200));
    if (opts.mobilePad) {
      this.add(this.act("toggle-rotate", `${this.focusId === "toggle-rotate" ? "> " : "  "}${t("settings.rotate")}  ${onOff(opts.rotateScreen)}`, 350, 106, 11, false, 185));
    }
    this.add(this.act("toggle-play-time", `${this.focusId === "toggle-play-time" ? "> " : "  "}${t("settings.playTime")}  ${onOff(opts.showPlayTime)}`, 40, 126, 12, false, 220));
    this.add(text(t("settings.theme"), 40, 148, 12, this.focusId === "theme-cycle" ? theme.hot : theme.ink));
    this.add(text(t("settings.language"), 40, 170, 12, this.focusId === "locale-cycle" ? theme.hot : theme.ink));
    this.add(this.act("toggle-theme-bg", `${this.focusId === "toggle-theme-bg" ? "> " : "  "}${t("settings.themeBg")}  ${onOff(opts.themeBg)}`, 40, 192, 11, false, 200));
    this.add(this.act("toggle-webcam", `${this.focusId === "toggle-webcam" ? "> " : "  "}${t("settings.webcam")}  ${onOff(opts.webcamBg)}`, 250, 192, 11, false, 200));
    this.add(this.act("toggle-tab-cast", `${this.focusId === "toggle-tab-cast" ? "> " : "  "}${t("settings.tabCast")}  ${onOff(opts.tabCastBg)}`, 40, 210, 11, false, 200));
    if (opts.tabCastBg) {
      this.add(this.act("tab-crop", `${this.focusId === "tab-crop" ? "> " : "  "}${t("settings.tabCrop")}`, 300, 210, 11, false, 180));
    }
    // Backdrop tint + block preview live under Customize colors.
    this.add(this.act("settings-colors", t("settings.customizeColors"), 40, 234, 12, false, 200));
    this.add(
      this.act(
        "toggle-fullscreen",
        `${this.focusId === "toggle-fullscreen" ? "> " : "  "}${t("settings.fullscreen")}  ${onOff(!!opts.fullscreen)}`,
        250,
        234,
        11,
        false,
        200,
      ),
    );
    this.add(this.act("remap", t("settings.remap"), 40, 258, 12, false, 160));
    this.add(this.act("settings-save", t("settings.manageSave"), 220, 258, 12, false, 220));
  }

  drawCustomizeColors(opts: {
    colors: ColorCustom;
    tileAtlasReady?: boolean;
    presets?: { name: string }[];
    activePreset?: string;
    bgCycle?: boolean;
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("settings", t("common.back"), 24, 6, 12, false, 80));
    this.add(text(t("settings.customizeColors"), 275, 6, 16, theme.ink, "center"));
    this.add(text(t("settings.customizeColorsHint"), 40, 26, 10, theme.muted));
    // Keep color rows compact so Load preset / match-stone fit under Bridge R (not on top of it).
    const rowY0 = 40;
    const rowStep = 18;
    COLOR_SLOT_META.forEach((slot, i) => {
      const y = rowY0 + i * rowStep;
      const row = opts.colors[slot.id];
      const pickId = "color-pick:" + slot.id;
      const toggleId = "color-toggle:" + slot.id;
      this.add(text(t(slot.labelKey), 24, y, 11, this.focusId === pickId ? theme.hot : theme.ink));
      this.add(
        this.act(
          toggleId,
          `${this.focusId === toggleId ? "> " : "  "}${row.on ? t("settings.colorOn") : t("settings.colorOff")}`,
          118,
          y,
          11,
          false,
          slot.id === "bg" ? 44 : 56,
        ),
      );
      // Leave x≈200 for the HTML color swatch; pad focus opens it via color-pick.
      this.add(this.act(pickId, " ", 198, y, 11, false, 28));
      if (slot.id === "bg") {
        // Cycle sits to the right of the backdrop swatch — backdrop-only hue shift.
        const cycleId = "toggle-bg-cycle";
        const cycleOn = !!opts.bgCycle;
        this.add(
          this.act(
            cycleId,
            `${this.focusId === cycleId ? "> " : "  "}${cycleOn ? t("settings.colorCycleOn") : t("settings.colorCycleOff")}`,
            232,
            y,
            11,
            false,
            78,
          ),
        );
      }
    });
    // Last slot (Bridge R) ends at y≈202. Vertical stack below — never beside Bridge R or each other.
    const loadY = 218;
    const matchY = 238;
    const footY = 258;
    this.add(text(t("settings.loadPreset"), 24, loadY, 11, this.focusId === "color-preset" ? theme.hot : theme.ink));
    this.add(this.act("colors-match-stone", t("settings.matchStone"), 24, matchY, 10, false, 220));
    this.add(this.act("colors-reset", t("settings.resetColors"), 24, footY, 11, false, 100));
    this.add(this.act("colors-save-preset", t("settings.savePreset"), 130, footY, 11, false, 120));
    this.add(this.act("colors-manage-presets", t("settings.managePresets"), 260, footY, 11, false, 120));
    // HTML preset dropdown sits beside "Load preset" on loadY (placeSettingsChrome / CSS).

    const tiles = colorPreviewTiles();
    const wrap = new createjs.Container();
    wrap.x = 300;
    wrap.y = 36;
    wrap.scaleX = 0.78;
    wrap.scaleY = 0.78;
    wrap.mouseEnabled = false;
    wrap.mouseChildren = false;
    const board = new createjs.Container();
    // boardScreen coords are absolute to BOARD_VIEW — shift so the view origin sits at wrap (0,0).
    board.x = -BOARD_VIEW.x;
    board.y = -BOARD_VIEW.y;
    wrap.addChild(board);
    try {
      this.board = board;
      this.refreshCreatorBoard({
        tiles,
        spawn: COLOR_PREVIEW_SPAWN,
        marks: [],
        colors: opts.colors,
        // Shapes while picking / before bake; real Stage Creator atlas clips after bake-on-exit.
        forceShapes: customizePreviewForceShapes(!!opts.tileAtlasReady),
      });
    } catch {
      /* preview is optional */
    }
    this.add(wrap);
  }

  /** Attract-mode brand as billboard glyphs — bottom-center of the game screen. */
  drawAttractTitle(label: string): void {
    this.clear();
    this.hideMascot();
    const raw = (label.trim() || "BLOXORZ+").slice(0, 24);
    if (neonTitleMode(raw) === "orbitron") {
      // Neon Orbitron (not plain ink) when lamps cannot spell the locale brand.
      this.add(brandOrbitron(raw, 275, ATTRACT_TITLE_Y - 10, 22, "center"));
      return;
    }
    const title = foldBillboard(raw).slice(0, 18);
    const pitch = Math.min(4.6, 500 / (Math.max(1, title.length) * 6));
    const width = title.length * 6 * pitch;
    // Billboard draws from the glyph top; lift so the word sits near the bottom edge.
    const y = ATTRACT_TITLE_Y - Math.round(7 * pitch);
    drawBillboard(this.layer, title, 275 - width / 2, y, 500);
  }

  /** Live Customize Colors board refresh without rebuilding chrome (keeps native picker open). */
  refreshColorPreview(colors: ColorCustom, tileAtlasReady = false): void {
    if (!this.board) return;
    try {
      this.refreshCreatorBoard({
        tiles: colorPreviewTiles(),
        spawn: COLOR_PREVIEW_SPAWN,
        marks: [],
        colors,
        forceShapes: customizePreviewForceShapes(tileAtlasReady),
      });
    } catch {
      /* preview is optional */
    }
  }

  drawSaveData(deleteStep = 0): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("settings", t("common.back"), 24, 12, 12, false, 80));
    this.add(text(t("settings.manageSave"), 275, 12, 18, theme.ink, "center"));
    this.add(this.act("export-save", t("settings.export"), 40, 80, 14, false, 220));
    this.add(this.act("import-save", t("settings.import"), 40, 118, 14, false, 220));
    if (deleteStep <= 0) {
      this.add(this.act("delete-save", t("settings.delete"), 40, 156, 14, false, 220));
    } else {
      const prompts = [t("settings.deleteSure1"), t("settings.deleteSure2"), t("settings.deleteSure3")];
      this.add(text(prompts[Math.min(2, deleteStep - 1)]!, 40, 156, 13, theme.hot));
      this.add(this.act("delete-save-yes", t("common.continue"), 40, 200, 14, false, 160));
      this.add(this.act("delete-save-no", t("common.cancel"), 220, 200, 14, false, 120));
    }
  }

  drawRemap(rows: { id: string; label: string; bind: string }[], waiting: string | null): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("settings", t("common.back"), 24, 12, 12, false, 80));
    this.add(text(t("remap.title"), 275, 12, 18, theme.ink, "center"));
    this.add(text(waiting ? t("remap.wait") : t("remap.hint"), 40, 40, 11, theme.muted));
    rows.forEach((row, i) => {
      const y = 68 + i * 22;
      const mark = waiting === row.id ? "> " : "  ";
      this.add(this.act("rebind:" + row.id, `${mark}${row.label}`, 40, y, 12, false, 200));
      this.add(text(row.bind, 320, y, 12, theme.muted));
    });
  }

  drawFinish(opts: {
    title: string;
    cleared: string;
    moves: number;
    falls: number;
    fails: number;
    rows: { title: string; meta: string }[];
    scroll?: number;
    pageSize?: number;
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    const scroll = Math.max(0, opts.scroll ?? 0);
    const pageSize = opts.pageSize ?? 5;
    const total = opts.rows.length;
    const heading = opts.title.trim() || opts.title;
    if (neonTitleMode(heading) === "billboard") {
      const label = foldBillboard(heading).slice(0, 18);
      const pitch = Math.min(4.6, 500 / (Math.max(1, label.length) * 6));
      const width = label.length * 6 * pitch;
      drawBillboard(this.layer, label, 275 - width / 2, 18, 500);
    } else {
      this.add(brandOrbitron(heading.slice(0, 24), 275, 22, 22, "center"));
    }
    this.add(text(opts.cleared, 275, 62, 12, theme.muted, "center"));
    this.add(text(`${t("finish.moves")}  ${opts.moves}    ${t("finish.falls")}  ${opts.falls}    ${t("finish.attempts")}  ${opts.fails}`, 275, 86, 12, theme.ink, "center"));
    if (!opts.rows.length) this.add(text(t("finish.none"), 40, 118, 11, theme.muted));
    opts.rows.slice(scroll, scroll + pageSize).forEach((row, i) => {
      this.add(text(row.title, 40, 118 + i * 22, 11));
      this.add(text(row.meta, 320, 118 + i * 22, 11, theme.muted));
    });
    if (total > pageSize) {
      const trackH = 140;
      const trackX = 528;
      const trackY = 112;
      const bar = new createjs.Shape();
      bar.graphics.beginFill(theme.track).drawRect(trackX, trackY, 6, trackH);
      const thumbH = Math.max(18, trackH * (pageSize / total));
      const max = Math.max(1, total - pageSize);
      const thumbY = trackY + (trackH - thumbH) * (scroll / max);
      bar.graphics.beginFill(theme.fill).drawRect(trackX, thumbY, 6, thumbH);
      bar.mouseEnabled = false;
      this.add(bar);
    }
    // Screenshot + Menu anchored bottom-left under the stage list.
    this.add(this.act("screenshot", t("finish.screenshot"), 40, 268, 12, false, 130));
    this.add(this.act("back", t("common.menu"), 180, 268, 12, false, 90));
  }

  drawPuzzles(date: string): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("back", t("common.back"), 24, 12, 12, false, 80));
    this.add(text(t("puzzles.title"), 275, 12, 18, theme.ink, "center"));
    const card = new createjs.Shape();
    card.graphics.beginFill("rgba(255,120,30,0.16)").beginStroke("#c45a18").setStrokeStyle(1).drawRect(24, 44, 502, 148);
    card.mouseEnabled = false;
    this.add(card);
    this.add(text(t("puzzles.daily"), 40, 56, 22, theme.ink));
    this.add(text(date, 40, 86, 14, theme.muted));
    this.add(this.act("puzzle-daily", t("puzzles.playDaily"), 40, 128, 16, false, 200));
    this.add(this.act("puzzles-seeded", t("puzzles.seeded"), 40, 208, 14, false, 140));
    this.add(this.act("puzzles-gauntlet", t("puzzles.gauntlet"), 200, 208, 14, false, 140));
  }

  drawSeeded(endless = false): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    const onOff = (on: boolean) => (on ? t("common.on") : t("common.off"));
    this.add(this.act("puzzles", t("common.back"), 24, 16, 12, false, 80));
    this.add(text(t("seeded.title"), 275, 28, 20, theme.ink, "center"));
    this.add(fieldBox(40, 88, 280));
    this.add(this.act("puzzle-seed-go", t("common.play"), 40, 130, 14, false, 100));
    this.add(
      this.act(
        "toggle-seeded-endless",
        `${this.focusId === "toggle-seeded-endless" ? "> " : "  "}${t("seeded.endless")}  ${onOff(endless)}`,
        40,
        172,
        13,
        false,
        220,
      ),
    );
  }

  drawGauntlet(diff: string, count = 5): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("puzzles", t("common.back"), 24, 16, 12, false, 80));
    this.add(text(t("gauntlet.title"), 275, 28, 20, theme.ink, "center"));
    this.add(text(t("gauntlet.difficulty"), 40, 56, 12, theme.muted));
    (["easy", "medium", "hard", "insane"] as const).forEach((d, i) => {
      const mark = d === diff ? "> " : "  ";
      this.add(this.act("diff:" + d, mark + t("diff." + d), 40 + i * 120, 78, 13, false, 100));
    });
    this.add(text(t("gauntlet.stages"), 40, 112, 12, theme.muted));
    ([5, 10, 15, 33] as const).forEach((n, i) => {
      const mark = n === count ? "> " : "  ";
      this.add(this.act("glen:" + n, mark + String(n), 40 + i * 70, 132, 13, false, 56));
    });
    this.add(text(t("gauntlet.seed"), 40, 168, 12, theme.muted));
    this.add(fieldBox(40, 186, 280));
    this.add(this.act("gauntlet-go", t("gauntlet.play"), 40, 226, 14, false, 180));
  }

  drawTitleCard(title: string, subtitle = ""): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    const bg = new createjs.Shape();
    bg.graphics.beginFill("#000").drawRect(0, 0, 550, 300);
    bg.mouseEnabled = false;
    this.add(bg);
    const raw = title.trim() || title;
    if (neonTitleMode(raw) === "billboard") {
      const label = foldBillboard(raw).slice(0, 18);
      const pitch = Math.min(5.2, 500 / (Math.max(1, label.length) * 6));
      const width = label.length * 6 * pitch;
      drawBillboard(this.layer, label, 275 - width / 2, 108, 500);
    } else {
      // Locale stage cards (CJK / Cyrillic / …): Orbitron neon, not silent lamp dropouts.
      this.add(brandOrbitron(raw.slice(0, 24), 275, 118, 28, "center"));
    }
    if (subtitle) this.add(text(subtitle, 275, 168, 14, theme.muted, "center"));
  }

  drawHistory(opts: {
    rows: { title: string; meta: string; replay?: () => void }[];
    scroll?: number;
    total?: number;
    pageSize?: number;
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    const scroll = opts.scroll ?? 0;
    const pageSize = opts.pageSize ?? 5;
    const total = opts.total ?? opts.rows.length;
    this.add(this.act("back", t("common.back"), 24, 16, 12, false, 80));
    this.add(text(t("history.title"), 275, 16, 18, theme.ink, "center"));
    if (!opts.rows.length) {
      this.add(text(t("history.empty"), 40, 80, 12, theme.muted));
      this.add(text(t("history.emptyLine2"), 40, 98, 12, theme.muted));
      return;
    }
    opts.rows.slice(0, pageSize).forEach((row, i) => {
      const y = 56 + i * 42;
      this.add(text(row.title, 40, y, 11));
      this.add(text(row.meta, 40, y + 14, 10, theme.muted));
      if (row.replay) this.add(this.act("replay:" + (scroll + i), t("history.replay"), 420, y, 11, false, 80));
    });
    if (total > pageSize) {
      const trackH = 210;
      const trackX = 528;
      const trackY = 52;
      const bar = new createjs.Shape();
      bar.graphics.beginFill(theme.track).drawRect(trackX, trackY, 6, trackH);
      const thumbH = Math.max(18, trackH * (pageSize / total));
      const max = Math.max(1, total - pageSize);
      const thumbY = trackY + (trackH - thumbH) * (scroll / max);
      bar.graphics.beginFill(theme.fill).drawRect(trackX, thumbY, 6, thumbH);
      bar.mouseEnabled = false;
      this.add(bar);
    }
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
    rows: { title: string; meta: string; openId: string; deleteId?: string; shareId?: string; kind?: string }[];
    empty: string;
    backId: string;
    scroll: number;
    total: number;
    pageSize: number;
    footerId?: string;
    footerLabel?: string;
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act(opts.backId, t("common.back"), 24, 16, 12, false, 80));
    this.add(text(opts.title, 275, 18, 18, theme.ink, "center"));
    if (!opts.rows.length) {
      this.add(text(opts.empty, 40, 80, 12, theme.muted));
      if (opts.footerId && opts.footerLabel) {
        this.add(this.act(opts.footerId, opts.footerLabel, 40, 250, 13, false, 240));
      }
      return;
    }
    opts.rows.forEach((row, i) => {
      const y = 48 + i * 38;
      const kind = row.kind ? ` · ${row.kind}` : "";
      this.add(this.act(row.openId, row.title || "Untitled", 40, y, 13, false, 250));
      this.add(text(row.meta + kind, 40, y + 18, 10, theme.muted));
      if (row.shareId) this.add(this.act(row.shareId, t("creator.share"), 310, y, 12, false, 72));
      if (row.deleteId) this.add(this.act(row.deleteId, t("creator.delete"), 400, y, 12, false, 80));
    });
    if (opts.footerId && opts.footerLabel) {
      this.add(this.act(opts.footerId, opts.footerLabel, 40, 250, 13, false, 240));
    }
    if (opts.total > opts.pageSize) {
      const trackH = 190;
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

  drawPackBuilder(opts: {
    rows: { title: string; meta: string; toggleId: string; ord: number }[];
    scroll: number;
    total: number;
    pageSize: number;
    selected: number;
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("creator-manage", t("common.back"), 24, 16, 12, false, 80));
    this.add(text(t("creator.createPack"), 275, 18, 18, theme.ink, "center"));
    this.add(text(t("creator.name"), 40, 42, 12, theme.ink));
    this.add(fieldBox(100, 40, 200));
    this.add(text(t("creator.packHint", { n: opts.selected }), 40, 68, 11, theme.muted));
    if (!opts.rows.length) {
      this.add(text(t("creator.empty"), 40, 110, 12, theme.muted));
      return;
    }
    opts.rows.forEach((row, i) => {
      const y = 90 + i * 34;
      const mark = row.ord > 0 ? `${row.ord}. ` : "  ";
      this.add(this.act(row.toggleId, mark + (row.title || "Untitled"), 40, y, 13, false, 360));
      this.add(text(row.meta, 40, y + 16, 10, theme.muted));
    });
    this.add(this.act("pack-save", t("common.save"), 40, 255, 14, opts.selected < 2, 140));
    if (opts.total > opts.pageSize) {
      const trackH = 140;
      const trackX = 528;
      const trackY = 90;
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
    cursor?: { x: number; y: number };
    colorCustom?: ColorCustom | null;
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("creator", t("common.back"), 10, 6, 12, false, 56));
    this.add(text(t("creator.name"), 72, 8, 12));
    this.add(fieldBox(118, 6, 100));
    this.add(text(opts.badge, 330, 8, 11, theme.green));

    this.board = new createjs.Container();
    try {
      this.refreshCreatorBoard({
        tiles: opts.tiles,
        spawn: opts.spawn,
        marks: opts.marks,
        cursor: opts.cursor,
        spawnTool: opts.tool === "spawn",
        colors: opts.colorCustom,
      });
    } catch {
      /* keep the rest of the editor even if a clip fails */
    }
    this.add(this.board);

    const hit = new createjs.Shape();
    const area = new createjs.Shape();
    // Pad the hit rect so rim cells (esp. top/left tips) stay clickable.
    area.graphics.beginFill("#000").drawRect(BOARD_VIEW.x - 10, BOARD_VIEW.y - 10, BOARD_VIEW.w + 20, BOARD_VIEW.h + 16);
    hit.hitArea = area;
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

    const pad = wantsVirtualPad();
    EDITOR_TOOLS.forEach((tool, i) => {
      const col = pad ? i % 2 : i < 6 ? 0 : 1;
      const row = pad ? Math.floor(i / 2) : i < 6 ? i : i - 6;
      // Right column starts further right so icon glyphs sit left of labels without crowding the mid gutter.
      const x = pad ? 338 + col * 110 : 330 + col * 124;
      const y = pad ? 28 + row * 26 : 32 + row * 28;
      const mark = opts.tool === tool.id ? "> " : "  ";
      const icon = this.toolClip(tool.id, x, y);
      this.add(icon);
      const label = t("editor." + tool.id);
      this.add(this.act("tool:" + tool.id, mark + label, x + 20, y, pad ? 9 : 11, false, pad ? 90 : col === 0 ? 110 : 100));
    });

    // Keep spawn/solid hints on the far left so they never crowd the TEST control.
    if (opts.hint) this.add(text(opts.hint, 4, pad ? 208 : 228, 10, theme.muted));
    this.add(text(t(pad ? "creator.padHintMobile" : "creator.padHint"), 4, pad ? 222 : 242, 9, theme.muted));
    // Large TEST sits above Enter Code on the right; tray keeps the other actions.
    this.add(this.act("creator-test", "TEST", pad ? 400 : 420, pad ? 228 : 248, 22, false, 120));
    const bar = [
      { id: "creator-new", label: t("creator.new"), off: false },
      { id: "creator-clear", label: t("creator.clear"), off: false },
      { id: "creator-undo", label: t("creator.undo"), off: !opts.canUndo },
      { id: "creator-redo", label: t("creator.redo"), off: !opts.canRedo },
      { id: "creator-save", label: t("common.save"), off: !opts.canSave },
      { id: "creator-copy", label: t("creator.copy"), off: false },
      { id: "creator-load", label: t("creator.code"), off: false },
    ];
    const tray = new createjs.Container();
    tray.x = 8;
    tray.y = pad ? 258 : 278;
    let barX = 0;
    let size = 11;
    const extra = pad ? 36 : 24;
    const guess = (label: string): number => Math.max(36, Math.ceil(label.length * size * 0.62) + extra);
    let total = bar.reduce((sum, row) => sum + guess(row.label), 0) + 4 * (bar.length - 1);
    while (total > 400 && size > 8) {
      size--;
      total = bar.reduce((sum, row) => sum + guess(row.label), 0) + 4 * (bar.length - 1);
    }
    for (const row of bar) {
      const node = this.act(row.id, row.label, barX, 0, size, row.off, 36);
      tray.addChild(node);
      barX += (node.hitW ?? guess(row.label)) + 4;
    }
    if (barX > 400) tray.scaleX = 400 / barX;
    this.add(tray);
  }

  refreshCreatorBoard(opts: {
    tiles: string[];
    spawn: [number, number];
    marks: { x: number; y: number; label: string }[];
    cursor?: { x: number; y: number };
    spawnTool?: boolean;
    colors?: ColorCustom | null;
    forceShapes?: boolean;
  }): void {
    if (!this.board) return;
    this.board.removeAllChildren();
    const mesh = new createjs.Shape();
    mesh.mouseEnabled = false;
    const colors = opts.colors ?? null;
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 15; x++) {
        if ((opts.tiles[y]?.[x] ?? " ") !== " ") continue;
        drawBoardCell(mesh, x, y, " ", colors);
      }
    }
    this.board.addChild(mesh);
    const cells = occupiedCells(opts.tiles);
    cells.sort((a, b) => a.y - a.x - (b.y - b.x));
    for (const cell of cells) {
      const clip = opts.forceShapes ? null : this.placeBoardClip(cell.ch, cell.x, cell.y);
      if (clip) this.board.addChild(clip);
      else drawBoardCell(mesh, cell.x, cell.y, cell.ch, colors);
    }
    // Spawn = the Block alone (no yellow circle/keyhole overlay). Stub roll so frame_0 cannot wipe the board.
    try {
      const block = this.placeBoardClip("Block", opts.spawn[0], opts.spawn[1]);
      if (block) this.board.addChild(block);
      else this.board.addChild(spawnBlockOnly(boardCellCenter(opts.spawn[0], opts.spawn[1]).x, boardCellCenter(opts.spawn[0], opts.spawn[1]).y));
    } catch {
      const face = boardCellCenter(opts.spawn[0], opts.spawn[1]);
      this.board.addChild(spawnBlockOnly(face.x, face.y));
    }
    if (opts.spawnTool && opts.cursor && (opts.cursor.x !== opts.spawn[0] || opts.cursor.y !== opts.spawn[1])) {
      const ghost = boardCellCenter(opts.cursor.x, opts.cursor.y);
      this.board.addChild(spawnBlockOnly(ghost.x, ghost.y, 0.55));
    }
    for (const mark of opts.marks) {
      const p = boardCellCenter(mark.x, mark.y);
      this.board.addChild(text(mark.label, p.x - 3, p.y - 6, 9, "#fff"));
    }
    if (opts.cursor) {
      const p = boardCellCenter(opts.cursor.x, opts.cursor.y);
      // Location cursor: white circle only (no yellow halo / double ring).
      const ring = new createjs.Shape();
      ring.graphics.beginStroke("#ffffff").setStrokeStyle(2).drawCircle(p.x, p.y, 7);
      ring.mouseEnabled = false;
      this.board.addChild(ring);
    }
  }

  private placeBoardClip(ch: string, x: number, y: number): HudNode | null {
    const p = boardScreen(x, y);
    if (ch === "Block") {
      const block = this.makeClip?.("Block");
      if (!block) return null;
      block.x = p.x;
      block.y = p.y;
      block.scaleX = BOARD_SCALE;
      block.scaleY = BOARD_SCALE;
      block.mouseEnabled = false;
      if (block.tickEnabled !== undefined) block.tickEnabled = false;
      // Live play installs roll via addBlockRoll; creator preview never does, and frame_0
      // assigns this.roll.idle — stub it so gotoAndStop does not throw and wipe the board.
      const clip = block as { roll?: { idle: boolean; position: string }; gotoAndStop?: (n: number) => void };
      if (!clip.roll) clip.roll = { idle: true, position: "up" };
      try {
        clip.gotoAndStop?.(0);
      } catch {
        /* keep the clip even if the timeline script still fails */
      }
      return block;
    }
    const tile = this.makeTile?.(ch);
    if (tile) {
      tile.x = p.x;
      tile.y = p.y;
      tile.scaleX = BOARD_SCALE;
      tile.scaleY = BOARD_SCALE;
      tile.mouseEnabled = false;
      if (tile.tickEnabled !== undefined) tile.tickEnabled = false;
      return tile;
    }
    const spec = clipForTile(ch);
    if (!spec) return null;
    const clip = this.makeClip?.(spec.name);
    if (!clip) return null;
    const [ox, oy] = CLIP_OFFSET[spec.name];
    clip.x = p.x + ox * BOARD_SCALE;
    clip.y = p.y + oy * BOARD_SCALE;
    clip.scaleX = BOARD_SCALE * spec.dim;
    clip.scaleY = BOARD_SCALE * spec.dim;
    clip.mouseEnabled = false;
    if (clip.tickEnabled !== undefined) clip.tickEnabled = false;
    return clip;
  }

  private toolClip(id: string, x: number, y: number): HudNode {
    const wrap = new createjs.Container();
    wrap.x = x;
    wrap.y = y;
    wrap.mouseEnabled = false;
    wrap.mouseChildren = false;
    if (id === "spawn") {
      // Same Block clip as board spawn (not a hand-drawn cuboid).
      const icon = this.placeBoardClip("Block", 0, 0);
      if (icon) {
        icon.x = 8;
        icon.y = 12;
        icon.scaleX = (icon.scaleX || 1) * 0.38;
        icon.scaleY = (icon.scaleY || 1) * 0.38;
        wrap.addChild(icon);
        return wrap;
      }
      wrap.addChild(spawnBlockOnly(8, 4));
      return wrap;
    }
    const ch = TOOL_CH[id] ?? " ";
    const icon = ch === " " ? null : this.placeBoardClip(ch, 0, 0);
    if (icon) {
      icon.x = 8;
      icon.y = 12;
      const boost = id === "bridgeL" || id === "bridgeR" ? 0.72 : 0.38;
      icon.scaleX = (icon.scaleX || 1) * boost;
      icon.scaleY = (icon.scaleY || 1) * boost;
      wrap.addChild(icon);
      return wrap;
    }
    const s = new createjs.Shape();
    drawIsoTile(s, 0, 0, ch, { ox: 2, oy: 10, s: 0.42 });
    wrap.addChild(s);
    return wrap;
  }

  drawInGameDev(banner = "", autoSolve = false, unlimitedEndless = false): void {
    this.clear();
    this.hideMascot();
    this.add(hitRow(autoSolve ? "Stop auto-solve" : "Beat stage for me", 12, 32, 11, () => this.onAction("dev-beat"), false, 180));
    this.add(
      hitRow(
        `Unlimited endless  ${unlimitedEndless ? "ON" : "OFF"}`,
        12,
        52,
        11,
        () => this.onAction("toggle-unlimited-endless"),
        false,
        200,
      ),
    );
    if (banner) this.add(text(banner, 12, 74, 11, paint().green));
  }
}

/** Coolmath tile face: tip at (x,y) with the diamond toward y-1 (matches shadow mask). */
function drawBoardCell(shape: HudShape, x: number, y: number, ch: string, colors?: ColorCustom | null): void {
  const face = resolveTileFace(ch, colors);
  const [a, b, c, d] = boardCellCorners(x, y);
  shape.graphics.beginFill(face.top).beginStroke(face.stroke).setStrokeStyle(ch === " " ? 0.6 : 1)
    .moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c.x, c.y).lineTo(d.x, d.y).lineTo(a.x, a.y).endFill();
}

function spawnBlockOnly(x: number, y: number, alpha = 1): HudShape {
  // Cuboid only — no circle/keyhole overlay (spawn must read as the block alone).
  const block = new createjs.Shape();
  block.graphics.beginFill("rgba(0,0,0,0.5)").drawEllipse(-10, 2, 20, 9);
  block.graphics.beginFill("#ff9a2a").beginStroke("#fff4c8").setStrokeStyle(2).drawRect(-6, -18, 12, 20);
  block.graphics.beginFill("#ffe082").drawRect(-3.5, -25, 7, 7);
  block.x = x;
  block.y = y;
  block.alpha = alpha;
  block.mouseEnabled = false;
  return block;
}

/** Spawn palette prefers the live Block clip when the library is ready. */
export function spawnPaletteUsesBlockClip(hasBlockClip: boolean): boolean {
  return hasBlockClip;
}

function drawIsoTile(shape: HudShape, x: number, y: number, ch: string, m: IsoMetrics, colors?: ColorCustom | null): void {
  const face = resolveTileFace(ch, colors);
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

function colorPreviewTiles(): string[] {
  return COLOR_PREVIEW_DEF.tiles.map((row) => row.padEnd(15, " ").slice(0, 15));
}

