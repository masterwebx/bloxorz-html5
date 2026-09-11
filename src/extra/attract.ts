/** Title-screen arcade attract (idle demo) helpers. */

export const ATTRACT_IDLE_MS = 60_000;
export const ATTRACT_FADE_MS = 700;

/** True when the home idle clock should fire attract mode. */
export function shouldStartAttract(opts: {
  now: number;
  lastInputAt: number;
  onHome: boolean;
  /** User moved menu cursor / is mid-navigation on title. */
  navigating: boolean;
  alreadyAttracting: boolean;
  idleMs?: number;
}): boolean {
  if (opts.alreadyAttracting || !opts.onHome || opts.navigating) return false;
  const need = opts.idleMs ?? ATTRACT_IDLE_MS;
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
