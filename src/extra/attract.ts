/** Title-screen arcade attract (idle demo) helpers. */

export const ATTRACT_IDLE_MS = 60_000;
export const ATTRACT_IDLE_DEV_MS = 30_000;
export const ATTRACT_FADE_MS = 700;
/** Billboard / fallback title baseline — bottom-center of the 550×300 game HUD. */
export const ATTRACT_TITLE_Y = 268;

/** Idle duration: 30s while DEV is signed in, otherwise ~1 minute. */
export function attractIdleMs(dev: boolean): number {
  return dev ? ATTRACT_IDLE_DEV_MS : ATTRACT_IDLE_MS;
}

/** True when the home idle clock should fire attract mode. */
export function shouldStartAttract(opts: {
  now: number;
  lastInputAt: number;
  onHome: boolean;
  /** User moved menu cursor / is mid-navigation on title. */
  navigating: boolean;
  alreadyAttracting: boolean;
  idleMs?: number;
  dev?: boolean;
}): boolean {
  if (opts.alreadyAttracting || !opts.onHome || opts.navigating) return false;
  const need = opts.idleMs ?? attractIdleMs(!!opts.dev);
  return opts.now - opts.lastInputAt >= need;
}

/** Fresh activity bumps the idle clock (any title input). */
export function bumpAttractIdle(now: number): number {
  return now;
}

export function attractTitleLabel(brand: string): string {
  const trimmed = brand.trim();
  return trimmed || "BLOXORZ+";
}

/** True when the attract billboard must be rebuilt (enter / brand change / hide). */
export function shouldRepaintAttractTitle(prevKey: string, on: boolean, label: string): boolean {
  if (!on) return prevKey !== "";
  return prevKey !== label;
}

/** English Classic instruction bitmaps (“Use the arrow keys”, etc.). */
export function classicInstructionBitmapsVisible(opts: {
  hdType: boolean;
  attracting: boolean;
  label: string;
}): boolean {
  if (opts.hdType || opts.attracting) return false;
  return opts.label === "instructions";
}

/** English Classic stage-complete / congrats bitmap. */
export function classicCongratsVisible(opts: {
  hdType: boolean;
  attracting: boolean;
  onFinish: boolean;
}): boolean {
  if (opts.hdType || opts.attracting || !opts.onFinish) return false;
  return true;
}
