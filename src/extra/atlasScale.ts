/** Scale factor of the live atlas image vs logical 4096 ssMetadata coords (1 = full, 0.5 = half). */
let atlasImageScale = 1;

export function setAtlasImageScale(scale: number): void {
  atlasImageScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function getAtlasImageScale(): number {
  return atlasImageScale;
}

/** Infer scale from a loaded sheet vs logical atlas map size. */
export function atlasScaleForSheet(sheet: { width?: number; naturalWidth?: number }, logicalW = 4096): number {
  const w = (sheet.naturalWidth || sheet.width || logicalW) | 0;
  if (w <= 0 || logicalW <= 0) return 1;
  const s = w / logicalW;
  // Snap common sizes; avoid tiny float noise.
  if (Math.abs(s - 1) < 0.02) return 1;
  if (Math.abs(s - 0.5) < 0.02) return 0.5;
  return s;
}

type SpriteLike = {
  DisplayObject_draw?: (ctx: CanvasRenderingContext2D, ignore?: boolean) => boolean;
  _normalizeFrame?: () => void;
  spriteSheet?: { getFrame: (i: number) => FrameLike | null };
  _currentFrame?: number;
  image?: CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
  sourceRect?: { x: number; y: number; width: number; height: number } | null;
};

type FrameLike = {
  image: CanvasImageSource;
  rect: { x: number; y: number; width: number; height: number };
  regX: number;
  regY: number;
};

let patched = false;

/**
 * When a sheet is unexpectedly not 1:1 with ssMetadata (should not ship), CreateJS
 * frame rects stay in logical 4096 space. Sample the image at rect*scale.
 * Full-res atlases keep scale=1 and use the native CreateJS draw path.
 */
export function patchCreateJsAtlasScale(): void {
  if (patched) return;
  const cjs = (window as unknown as { createjs?: { Sprite?: { prototype: SpriteLike }; Bitmap?: { prototype: SpriteLike } } })
    .createjs;
  if (!cjs?.Sprite?.prototype?.draw) return;
  patched = true;

  const spriteProto = cjs.Sprite.prototype as SpriteLike & {
    draw: (ctx: CanvasRenderingContext2D, ignore?: boolean) => boolean;
    __bloxDraw?: typeof spriteProto.draw;
  };
  if (!spriteProto.__bloxDraw) {
    spriteProto.__bloxDraw = spriteProto.draw;
    spriteProto.draw = function bloxSpriteDraw(this: SpriteLike, a: CanvasRenderingContext2D, b?: boolean) {
      const s = atlasImageScale;
      if (s === 1 || !this.spriteSheet) {
        return spriteProto.__bloxDraw!.call(this, a, b);
      }
      if (this.DisplayObject_draw?.(a, b)) return true;
      this._normalizeFrame?.();
      const c = this.spriteSheet.getFrame(0 | (this._currentFrame || 0));
      if (!c) return false;
      const d = c.rect;
      if (d.width && d.height) {
        a.drawImage(
          c.image,
          d.x * s,
          d.y * s,
          d.width * s,
          d.height * s,
          -c.regX,
          -c.regY,
          d.width,
          d.height,
        );
      }
      return true;
    };
  }

  const bitmapProto = cjs.Bitmap?.prototype as
    | (SpriteLike & { draw: (ctx: CanvasRenderingContext2D, ignore?: boolean) => boolean; __bloxDraw?: Function })
    | undefined;
  if (bitmapProto && !bitmapProto.__bloxDraw) {
    bitmapProto.__bloxDraw = bitmapProto.draw;
    bitmapProto.draw = function bloxBitmapDraw(this: SpriteLike, a: CanvasRenderingContext2D, b?: boolean) {
      const s = atlasImageScale;
      if (s === 1 || !this.sourceRect || !this.image) {
        return bitmapProto.__bloxDraw!.call(this, a, b);
      }
      if (this.DisplayObject_draw?.(a, b) || !this.image) return true;
      const c = this.image;
      const d = this.sourceRect;
      const iw = (c as HTMLImageElement).naturalWidth || c.width || 0;
      const ih = (c as HTMLImageElement).naturalHeight || c.height || 0;
      // Only rescale when sourceRect looks like logical atlas coords against a scaled bitmap.
      if (iw >= d.x + d.width && ih >= d.y + d.height) {
        return bitmapProto.__bloxDraw!.call(this, a, b);
      }
      let e = d.x * s;
      let f = d.y * s;
      let g = e + d.width * s;
      let h = f + d.height * s;
      let i = 0;
      let j = 0;
      const k = iw;
      const l = ih;
      if (e < 0) {
        i -= e / s;
        e = 0;
      }
      if (g > k) g = k;
      if (f < 0) {
        j -= f / s;
        f = 0;
      }
      if (h > l) h = l;
      a.drawImage(c, e, f, g - e, h - f, i, j, (g - e) / s, (h - f) / s);
      return true;
    };
  }
}
