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

export type MoveHelpSession = {
  classicRun: boolean;
  kind: "campaign" | "custom";
  attract?: boolean;
  replay?: boolean;
};

/**
 * CreateJS per-stage HelpText (and HD `#play-help` for stage 01) is classic-campaign only.
 * Daily / seeded / gauntlet / custom / attract / load-stage all start at levelNumber 1 and
 * must never show the Stage 01 “arrow keys / WASD” tip.
 */
export function wantsClassicCampaignMoveHelp(opts: MoveHelpSession & { stageNo: number }): boolean {
  if (opts.attract || opts.replay) return false;
  if (!opts.classicRun || opts.kind !== "campaign") return false;
  return opts.stageNo >= 1;
}

/** HD overlay / Stage 01 tip string — only classic campaign stage 1. */
export function wantsClassicStage1MoveHint(opts: MoveHelpSession & { stageNo: number }): boolean {
  return wantsClassicCampaignMoveHelp(opts) && opts.stageNo === 1;
}

/**
 * First classic stages that introduce split-cube switching (levels with a `v` pad).
 * Classic campaign stages 08 and 09 are the first two; later split stages get no tip.
 */
export const CLASSIC_SWITCH_HINT_STAGES = [8, 9] as const;

/**
 * Classic campaign stages 08–09 switch tip (DOM `#play-help`).
 * Shows for any classic campaign entry — Start / Resume / Load Stage / passcode / DEV pick —
 * even when `classicRun` is false. Still skips attract, replay, and non-campaign (daily /
 * seeded / gauntlet / custom). Stage 01 move tip stays `classicRun`-gated separately.
 */
export function wantsClassicSwitchHint(opts: MoveHelpSession & { stageNo: number }): boolean {
  if (opts.attract || opts.replay) return false;
  if (opts.kind !== "campaign") return false;
  return (CLASSIC_SWITCH_HINT_STAGES as readonly number[]).includes(opts.stageNo);
}

/** True when DOM `#play-help` should show (stage-01 move tip and/or switch tip). */
export function wantsClassicDomPlayHelp(opts: MoveHelpSession & { stageNo: number }): boolean {
  return wantsClassicStage1MoveHint(opts) || wantsClassicSwitchHint(opts);
}
