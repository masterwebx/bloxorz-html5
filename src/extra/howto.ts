/** Official Coolmath instruction slides, keyed as howto.0 … howto.8 */

export const HOWTO_SLIDE_COUNT = 9;

export function howtoSlide(frame: number): number {
  if (frame < 24) return 0;
  if (frame >= 173) return 8;
  return Math.min(7, Math.max(0, Math.floor((frame - 13) / 20)));
}

export function padStage(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}
