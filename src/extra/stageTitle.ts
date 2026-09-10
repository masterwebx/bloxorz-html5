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

export function armStageTitleClip(title: StageTitleClip | null | undefined): void {
  if (!title) return;
  title.visible = false;
  const wasFrozen = title.tickEnabled === false;
  title.tickEnabled = true;
  title.loop = false;
  const sign = title.instance;
  if (sign) {
    sign.tickEnabled = true;
    sign.loop = false;
    if (wasFrozen) sign.gotoAndPlay?.(0);
  }
  if (wasFrozen) title.gotoAndPlay?.(0);
}

export function stageTitleShouldArm(prevLabel: string, label: string): boolean {
  return label === "stagetitle" && prevLabel !== "stagetitle";
}

export function stageTitleShouldFreeze(prevLabel: string, label: string): boolean {
  return prevLabel === "stagetitle" && label !== "stagetitle";
}
