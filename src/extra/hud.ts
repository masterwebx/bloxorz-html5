import { playHomeWhoosh, playUiClick, playUiLatch } from "./audio";
import {
  BOARD_SCALE,
  BOARD_VIEW,
  CLIP_OFFSET,
  boardScreen,
  clipForTile,
  occupiedCells,
  pickBoardCell,
  type ClipName,
} from "./coolmathBoard";
import { EDITOR_TOOLS } from "./editor";
import { GAUNTLET_QUALITY } from "./generate";
import { TILE_FACE, TOOL_CH, isoPt, type IsoMetrics } from "./isoBoard";
import { rustFaces } from "./hue";
import { t } from "./i18n";
import { currentTheme } from "./settings";
import { themePaint } from "./themePack";
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
  private preview: HudNode | null = null;
  onAction: (act: string) => void = () => undefined;
  makeMascot: (() => HudNode | null) | null = null;
  makePreview: (() => HudNode | null) | null = null;
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

  hueClips(): HudNode[] {
    const out: HudNode[] = [];
    if (this.mascot?.parent) out.push(this.mascot);
    if (this.preview?.parent) out.push(this.preview);
    return out;
  }

  private placePreview(x: number, y: number, hue = 0): void {
    if (!this.preview && this.makePreview) this.preview = this.makePreview();
    if (!this.preview) {
      this.add(blockPreview(x, y, hue));
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
    music: number;
    sfx: number;
    bgTint: number;
    bgHue: number;
    blockHue: number;
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
    this.add(this.act("toggle-tab-cast", `${this.focusId === "toggle-tab-cast" ? "> " : "  "}${t("settings.tabCast")}  ${onOff(opts.tabCastBg)}`, 40, 210, 11, false, 240));
    if (opts.tabCastBg) {
      this.add(this.act("tab-crop", `${this.focusId === "tab-crop" ? "> " : "  "}${t("settings.tabCrop")}`, 300, 210, 11, false, 180));
    }
    this.add(text(t("settings.tint"), 40, 230, 12, this.focusId === "bgtint" ? theme.hot : theme.ink));
    this.add(slider(150, 230, 140, opts.bgTint, (v) => this.onAction("bgtint:" + v.toFixed(2))));
    this.add(swatch(310, 232, opts.bgHue, Math.max(0.35, opts.bgTint)));
    this.add(text(t("settings.blockHue"), 40, 250, 12, this.focusId === "blockhue" ? theme.hot : theme.ink));
    this.add(slider(150, 250, 120, opts.blockHue / 360, (v) => this.onAction("blockhue:" + Math.round(v * 360))));
    this.add(swatch(290, 252, opts.blockHue, opts.blockHue > 0 ? 1 : 0.35));
    this.placePreview(392, 210, opts.blockHue);
    this.add(this.act("remap", t("settings.remap"), 40, 272, 12, false, 160));
    this.add(this.act("export-save", t("settings.export"), 200, 272, 12, false, 130));
    this.add(this.act("import-save", t("settings.import"), 350, 272, 12, false, 160));
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
    showStats: boolean;
    rows: { title: string; meta: string }[];
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    const heading = opts.title.toUpperCase();
    if (canBillboard(heading)) {
      const label = foldBillboard(heading).slice(0, 18);
      const pitch = Math.min(4.6, 500 / (Math.max(1, label.length) * 6));
      const width = label.length * 6 * pitch;
      drawBillboard(this.layer, label, 275 - width / 2, 18, 500);
    } else {
      this.add(text(opts.title, 275, 28, 20, theme.ink, "center"));
    }
    this.add(text(opts.cleared, 275, 62, 12, theme.muted, "center"));
    this.add(text(`${t("finish.moves")}  ${opts.moves}    ${t("finish.falls")}  ${opts.falls}    ${t("finish.attempts")}  ${opts.fails}`, 275, 86, 12, theme.ink, "center"));
    this.add(this.act("toggle-stats", opts.showStats ? t("finish.hide") : t("finish.show"), 40, 110, 12, false, 150));
    this.add(this.act("screenshot", t("finish.screenshot"), 200, 110, 12, false, 130));
    this.add(this.act("back", t("common.menu"), 340, 110, 12, false, 90));
    if (opts.showStats) {
      if (!opts.rows.length) this.add(text(t("finish.none"), 40, 146, 11, theme.muted));
      opts.rows.slice(0, 5).forEach((row, i) => {
        this.add(text(row.title, 40, 146 + i * 22, 11));
        this.add(text(row.meta, 320, 146 + i * 22, 11, theme.muted));
      });
    }
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
    this.add(text(t("puzzles.share"), 40, 248, 11, theme.muted));
  }

  drawSeeded(): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("puzzles", t("common.back"), 24, 16, 12, false, 80));
    this.add(text(t("seeded.title"), 275, 28, 20, theme.ink, "center"));
    this.add(text(t("seeded.hint"), 40, 80, 12, theme.muted));
    this.add(fieldBox(40, 112, 280));
    this.add(this.act("puzzle-seed-go", t("common.play"), 40, 154, 14, false, 100));
    this.add(text(t("seeded.same"), 40, 200, 11, theme.muted));
  }

  drawGauntlet(diff: string, count = 5): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("puzzles", t("common.back"), 24, 16, 12, false, 80));
    this.add(text(t("gauntlet.title"), 275, 28, 20, theme.ink, "center"));
    (["easy", "medium", "hard", "insane"] as const).forEach((d, i) => {
      const mark = d === diff ? "> " : "  ";
      this.add(this.act("diff:" + d, mark + t("diff." + d), 40 + i * 120, 68, 13, false, 100));
    });
    this.add(text(t("gauntlet.stages"), 40, 98, 12, theme.muted));
    ([5, 10, 15, 33] as const).forEach((n, i) => {
      const mark = n === count ? "> " : "  ";
      this.add(this.act("glen:" + n, mark + String(n), 40 + i * 70, 118, 13, false, 56));
    });
    const band = diff === "easy" || diff === "medium" || diff === "hard" || diff === "insane" ? diff : "easy";
    const era = band === "easy" ? t("hint.era.mid") : band === "medium" ? t("hint.era.late") : t("hint.era.end");
    this.add(text(t("hint.campaign", { n: GAUNTLET_QUALITY[band].minMoves, era }), 40, 146, 11, theme.muted));
    this.add(text(t("gauntlet.seed"), 40, 168, 12, theme.muted));
    this.add(fieldBox(40, 186, 280));
    this.add(this.act("gauntlet-go", t("gauntlet.play"), 40, 226, 14, false, 180));
    this.add(text(t("gauntlet.countHint", { n: count }), 40, 258, 11, theme.muted));
  }

  drawTitleCard(title: string, subtitle = ""): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    const bg = new createjs.Shape();
    bg.graphics.beginFill("#000").drawRect(0, 0, 550, 300);
    bg.mouseEnabled = false;
    this.add(bg);
    const label = foldBillboard(title).slice(0, 18);
    const pitch = Math.min(5.2, 500 / (Math.max(1, label.length) * 6));
    const width = label.length * 6 * pitch;
    drawBillboard(this.layer, label, 275 - width / 2, 108, 500);
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
    this.add(this.act(opts.backId, t("common.back"), 24, 16, 12, false, 80));
    this.add(text(opts.title, 275, 18, 18, theme.ink, "center"));
    if (!opts.rows.length) {
      this.add(text(opts.empty, 40, 80, 12, theme.muted));
      return;
    }
    opts.rows.forEach((row, i) => {
      const y = 48 + i * 38;
      this.add(this.act(row.openId, row.title || "Untitled", 40, y, 13, false, 300));
      this.add(text(row.meta, 40, y + 18, 10, theme.muted));
      if (row.deleteId) this.add(this.act(row.deleteId, t("creator.delete"), 420, y, 13, false, 96));
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
    cursor?: { x: number; y: number };
  }): void {
    this.clear();
    this.hideMascot();
    const theme = paint();
    this.add(this.act("creator-make", t("common.back"), 10, 6, 12, false, 56));
    this.add(text(t("creator.name"), 72, 8, 12));
    this.add(fieldBox(118, 6, 200));
    this.add(text(opts.badge, 330, 8, 11, theme.green));
    this.add(this.act("creator-test", t("creator.test"), 490, 6, 12, false, 50));

    this.board = new createjs.Container();
    try {
      this.refreshCreatorBoard(opts);
    } catch {
      /* keep the rest of the editor even if a clip fails */
    }
    this.add(this.board);

    const hit = new createjs.Shape();
    const area = new createjs.Shape();
    area.graphics.beginFill("#000").drawRect(BOARD_VIEW.x, BOARD_VIEW.y, BOARD_VIEW.w, BOARD_VIEW.h);
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
      const x = pad ? 372 + col * 86 : 300 + col * 128;
      const y = pad ? 28 + row * 26 : 32 + row * 28;
      const mark = opts.tool === tool.id ? "> " : "  ";
      const icon = this.toolClip(tool.id, x, y);
      this.add(icon);
      const label = t("editor." + tool.id);
      this.add(this.act("tool:" + tool.id, mark + label, x + 16, y, pad ? 9 : 11, false, pad ? 80 : col === 0 ? 104 : 88));
    });

    if (opts.hint) this.add(text(opts.hint, 10, pad ? 214 : 236, 10, theme.muted));
    this.add(text(t(pad ? "creator.padHintMobile" : "creator.padHint"), 10, pad ? 228 : 250, 9, theme.muted));
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
    tray.y = pad ? 242 : 266;
    let barX = 0;
    let size = 11;
    const extra = pad ? 36 : 24;
    const guess = (label: string): number => Math.max(36, Math.ceil(label.length * size * 0.62) + extra);
    let total = bar.reduce((sum, row) => sum + guess(row.label), 0) + 4 * (bar.length - 1);
    while (total > 534 && size > 8) {
      size--;
      total = bar.reduce((sum, row) => sum + guess(row.label), 0) + 4 * (bar.length - 1);
    }
    for (const row of bar) {
      const node = this.act(row.id, row.label, barX, 0, size, row.off, 36);
      tray.addChild(node);
      barX += (node.hitW ?? guess(row.label)) + 4;
    }
    if (barX > 534) tray.scaleX = 534 / barX;
    this.add(tray);
  }

  refreshCreatorBoard(opts: {
    tiles: string[];
    spawn: [number, number];
    marks: { x: number; y: number; label: string }[];
    cursor?: { x: number; y: number };
  }): void {
    if (!this.board) return;
    this.board.removeAllChildren();
    const mesh = new createjs.Shape();
    mesh.mouseEnabled = false;
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 15; x++) {
        if ((opts.tiles[y]?.[x] ?? " ") !== " ") continue;
        drawBoardCell(mesh, x, y, " ");
      }
    }
    this.board.addChild(mesh);
    const cells = occupiedCells(opts.tiles);
    cells.sort((a, b) => a.y - a.x - (b.y - b.x));
    for (const cell of cells) {
      const clip = this.placeBoardClip(cell.ch, cell.x, cell.y);
      if (clip) this.board.addChild(clip);
      else drawBoardCell(mesh, cell.x, cell.y, cell.ch);
    }
    const spawn = boardScreen(opts.spawn[0], opts.spawn[1]);
    const block = this.placeBoardClip("Block", opts.spawn[0], opts.spawn[1]) || spawnMarker(spawn.x, spawn.y);
    this.board.addChild(block);
    for (const mark of opts.marks) {
      const p = boardScreen(mark.x, mark.y);
      this.board.addChild(text(mark.label, p.x - 3, p.y - 6, 9, "#fff"));
    }
    if (opts.cursor) {
      const p = boardScreen(opts.cursor.x, opts.cursor.y);
      const ring = new createjs.Shape();
      ring.graphics.beginStroke("#fff4c8").setStrokeStyle(2).beginFill("rgba(255,200,80,0.22)").drawCircle(p.x, p.y - 4, 9);
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
      block.gotoAndStop?.(0);
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
    const ch = TOOL_CH[id] ?? " ";
    const icon = ch === " " ? null : this.placeBoardClip(ch, 0, 0);
    if (icon) {
      icon.x = 8;
      icon.y = 12;
      icon.scaleX = (icon.scaleX || 1) * 0.38;
      icon.scaleY = (icon.scaleY || 1) * 0.38;
      wrap.addChild(icon);
      return wrap;
    }
    const s = new createjs.Shape();
    drawIsoTile(s, 0, 0, ch, { ox: 2, oy: 10, s: 0.42 });
    wrap.addChild(s);
    return wrap;
  }

  drawInGameDev(banner = "", autoSolve = false): void {
    this.clear();
    this.hideMascot();
    this.add(hitRow(autoSolve ? "Stop auto-solve" : "Beat stage for me", 12, 32, 11, () => this.onAction("dev-beat"), false, 180));
    this.add(hitRow("Dev menu", 12, 52, 11, () => this.onAction("dev-menu"), false, 120));
    if (banner) this.add(text(banner, 12, 74, 11, paint().green));
  }
}

function boardCellPts(x: number, y: number): [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] {
  return [boardScreen(x, y), boardScreen(x + 1, y), boardScreen(x + 1, y + 1), boardScreen(x, y + 1)];
}

function drawBoardCell(shape: HudShape, x: number, y: number, ch: string): void {
  const face = TILE_FACE[ch] || TILE_FACE[" "];
  const [a, b, c, d] = boardCellPts(x, y);
  shape.graphics.beginFill(face.top).beginStroke(face.stroke).setStrokeStyle(ch === " " ? 0.6 : 1)
    .moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c.x, c.y).lineTo(d.x, d.y).lineTo(a.x, a.y).endFill();
}

function spawnMarker(x: number, y: number): HudShape {
  const block = new createjs.Shape();
  block.graphics.beginFill("#ff7a18").drawRect(-5, -14, 10, 16);
  block.x = x;
  block.y = y;
  block.mouseEnabled = false;
  return block;
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
