/** Cap CreateJS stage scale so fullscreen CSS can fill the screen without a huge backing store. */

/** Near typical windowed quality: ~550×2.5 ≈ 1375px wide (~1.0MP with matching height). */
export const MAX_STAGE_SCALE = 2.5;

/**
 * Split display scale (CSS letterbox fill) from render/stage scale (canvas buffer).
 * DPR stays up to 1.5 inside the product cap — we do not drop atlases to half-res.
 */
export function cappedStageScale(
  displayScale: number,
  pRatio: number,
  maxStage = MAX_STAGE_SCALE,
): { displayScale: number; stageScale: number; renderScale: number } {
  const d = Math.max(0, displayScale);
  const p = Math.max(1e-6, pRatio);
  const stageScale = Math.min(p * d, maxStage);
  return { displayScale: d, stageScale, renderScale: stageScale / p };
}

export function backingStoreSize(
  logicalW: number,
  logicalH: number,
  stageScale: number,
): { width: number; height: number; megapixels: number } {
  const width = Math.round(logicalW * stageScale);
  const height = Math.round(logicalH * stageScale);
  return { width, height, megapixels: (width * height) / 1e6 };
}

/**
 * Mirror CreateJS Stage pointer math when CSS size ≠ backing store
 * (fullscreen MAX_STAGE_SCALE): page offset → buffer px → divide by stage.scale*.
 * Creator paint should keep using MouseEvent.localX/Y; this documents the mapping.
 */
export function cssOffsetToStageLocal(
  cssX: number,
  cssY: number,
  cssW: number,
  cssH: number,
  canvasW: number,
  canvasH: number,
  stageScaleX: number,
  stageScaleY: number,
): { x: number; y: number } {
  const sx = stageScaleX || 1;
  const sy = stageScaleY || 1;
  const bufferX = cssW > 0 ? cssX / (cssW / canvasW) : 0;
  const bufferY = cssH > 0 ? cssY / (cssH / canvasH) : 0;
  return { x: bufferX / sx, y: bufferY / sy };
}
