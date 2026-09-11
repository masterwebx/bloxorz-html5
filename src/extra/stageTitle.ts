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

/** Rewind and let stagesign fire blox2wav once; always disable looping. */
export function armStageTitleClip(title: StageTitleClip | null | undefined): void {
  if (!title) return;
  title.visible = false;
  title.tickEnabled = true;
  title.loop = false;
  const sign = title.instance;
  if (sign) {
    sign.tickEnabled = true;
    sign.loop = false;
    sign.gotoAndPlay?.(0);
  }
  title.gotoAndPlay?.(0);
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
