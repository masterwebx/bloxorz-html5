/** Official Coolmath instruction slides, keyed as howto.0 … howto.8 */

export const HOWTO_SLIDE_COUNT = 9;

export type HowtoNavId = "back" | "skip" | "prev" | "next" | "start";

export function howtoSlide(frame: number): number {
  if (frame < 24) return 0;
  if (frame >= 173) return 8;
  return Math.min(7, Math.max(0, Math.floor((frame - 13) / 20)));
}

export function howtoNavIds(slide: number): HowtoNavId[] {
  if (slide <= 0) return ["back", "skip", "next"];
  if (slide >= 8) return ["start"];
  return ["prev", "next"];
}

export function padStage(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export function fitOverlayCopy(el: HTMLElement, max = 11, min = 6): void {
  el.style.fontSize = "";
  let size = max;
  el.style.fontSize = `calc(${size} * 100cqh / 300)`;
  while (size > min && el.scrollHeight > el.clientHeight + 1) {
    size -= 0.5;
    el.style.fontSize = `calc(${size} * 100cqh / 300)`;
  }
}

export function fitHowtoNav(root: HTMLElement): void {
  const buttons = [...root.querySelectorAll("button")].filter((b) => !(b as HTMLElement).hidden) as HTMLElement[];
  if (!buttons.length) return;
  let size = 11;
  const apply = (): void => {
    for (const b of buttons) b.style.fontSize = `calc(${size} * 100cqh / 300)`;
  };
  apply();
  const overflow = (): boolean =>
    root.scrollWidth > root.clientWidth + 1 || buttons.some((b) => b.scrollWidth > b.clientWidth + 1);
  while (size > 6 && overflow()) {
    size -= 0.5;
    apply();
  }
}
