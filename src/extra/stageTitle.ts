/** Vanilla stage title / stagesign clip. CreateJS loops it, which retriggers blox2wav. */

export type StageTitleClip = {
  visible?: boolean;
  alpha?: number;
  stop?: () => void;
  gotoAndPlay?: (n: number | string) => void;
  tickEnabled?: boolean;
  loop?: boolean;
  instance?: StageTitleClip;
};

export function freezeStageTitleClip(title: StageTitleClip | null | undefined): void {
  if (!title) return;
  title.visible = false;
  title.stop?.();
  title.tickEnabled = false;
  title.loop = false;
  const sign = title.instance;
  if (!sign) return;
  sign.stop?.();
  sign.tickEnabled = false;
  sign.loop = false;
}

/**
 * Rewind the title card for digits, but keep nested stagesign frozen.
 * CreateJS stagesign would loop/retrigger blox2wav; playStageSting owns the audio.
 */
export function armStageTitleClip(title: StageTitleClip | null | undefined): void {
  if (!title) return;
  title.visible = false;
  title.tickEnabled = true;
  title.loop = false;
  const sign = title.instance;
  if (sign) {
    sign.loop = false;
    sign.tickEnabled = false;
    sign.stop?.();
  }
  title.gotoAndPlay?.(0);
  // Parent rewind can restart the child — freeze sign again so it never plays.
  if (sign) {
    sign.stop?.();
    sign.tickEnabled = false;
    sign.loop = false;
  }
}

/** Keep the title non-looping without stopping mid-sting every tick. */
export function pinStageTitleClip(title: StageTitleClip | null | undefined): void {
  if (!title) return;
  title.visible = false;
  title.loop = false;
  const sign = title.instance;
  if (sign) sign.loop = false;
}

export function stageTitleShouldArm(prevLabel: string, label: string): boolean {
  return label === "stagetitle" && prevLabel !== "stagetitle";
}

export function stageTitleShouldFreeze(prevLabel: string, label: string): boolean {
  return prevLabel === "stagetitle" && label !== "stagetitle";
}

/** Real stage intros: classic stage 1 (instructions) and every other stage title card. */
export function stageStartShouldSting(prevLabel: string, label: string): boolean {
  if (label !== "stagetitle" && label !== "instructions") return false;
  return prevLabel !== label;
}
