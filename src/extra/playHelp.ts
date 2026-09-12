import {
  wantsClassicCampaignMoveHelp,
  wantsClassicStage1MoveHint,
  wantsClassicSwitchHint,
  type MoveHelpSession,
} from "./attract";
import { prettyKey, type Settings } from "./settings";

export type PlayHelpKind = "move" | "switch" | null;

/** Which classic DOM tip to show on `#play-help` (same overlay as Stage 01). */
export function classicPlayHelpKind(opts: MoveHelpSession & { stageNo: number }): PlayHelpKind {
  if (wantsClassicStage1MoveHint(opts)) return "move";
  if (wantsClassicSwitchHint(opts)) return "switch";
  return null;
}

/** Remapped swap key label for switch-hint copy (settings binding, not hard-coded Space). */
export function switchHelpKeyLabel(settings: Pick<Settings, "keys">): string {
  return prettyKey(settings.keys.swap);
}

/**
 * CreateJS HelpText bitmaps for classic-English campaign.
 * Switch-hint stages hide the bitmap so remapped `#play-help` copy can show alone.
 */
export function wantsCreateJsHelpBitmap(opts: MoveHelpSession & { stageNo: number; hdType: boolean }): boolean {
  if (opts.hdType) return false;
  if (!wantsClassicCampaignMoveHelp(opts)) return false;
  if (wantsClassicSwitchHint(opts)) return false;
  return true;
}

/** Map menu-pad / confirm-style events onto instruction carousel advances. */
export function instructionPadAdvance(
  ev: "up" | "down" | "left" | "right" | "confirm" | "back" | "swap" | "pause",
  frame: number,
): 1 | -1 | 0 | "quit" | null {
  if (ev === "pause") return 0;
  if (ev === "confirm" || ev === "swap" || ev === "right" || ev === "down") return 1;
  if (ev === "left" || ev === "up") return -1;
  if (ev === "back") return frame <= 20 ? "quit" : -1;
  return null;
}

/**
 * Boot splash is “press any key”. True when any mapped pad button is newly pressed
 * (not merely held from a prior screen).
 */
export function splashPadShouldDismiss(
  held: Iterable<number>,
  prev: Iterable<number>,
  mapped: Iterable<number>,
): boolean {
  const prevSet = new Set(prev);
  const mappedSet = new Set(mapped);
  for (const btn of held) {
    if (mappedSet.has(btn) && !prevSet.has(btn)) return true;
  }
  return false;
}
