import { describe, expect, it } from "vitest";
import { armStageTitleClip, freezeStageTitleClip, stageTitleShouldArm, stageTitleShouldFreeze } from "./stageTitle";

describe("stage title sting", () => {
  it("arms once when the title card starts, then freezes so stagesign cannot loop", () => {
    expect(stageTitleShouldArm("menu", "stagetitle")).toBe(true);
    expect(stageTitleShouldArm("stagetitle", "stagetitle")).toBe(false);
    expect(stageTitleShouldFreeze("stagetitle", "game")).toBe(true);
  });

  it("stops the nested stagesign clip so blox2wav cannot retrigger", () => {
    const sign = {
      tickEnabled: true,
      loop: true,
      stop() {
        this.stopped = true;
      },
      stopped: false,
    };
    const title = {
      visible: true,
      tickEnabled: true,
      loop: true,
      instance: sign,
      stop() {
        this.stopped = true;
      },
      stopped: false,
    };
    freezeStageTitleClip(title);
    expect(title.visible).toBe(false);
    expect(title.tickEnabled).toBe(false);
    expect(title.loop).toBe(false);
    expect(sign.tickEnabled).toBe(false);
    expect(sign.loop).toBe(false);
    expect(sign.stopped).toBe(true);
  });

  it("rewinds a frozen clip so the next stage can play the sting once", () => {
    const played: number[] = [];
    const sign = {
      tickEnabled: false,
      loop: false,
      gotoAndPlay(n: number) {
        played.push(n);
      },
    };
    const title = {
      tickEnabled: false,
      loop: false,
      instance: sign,
      gotoAndPlay(n: number) {
        played.push(n + 100);
      },
    };
    armStageTitleClip(title);
    expect(title.tickEnabled).toBe(true);
    expect(sign.tickEnabled).toBe(true);
    expect(played).toEqual([0, 100]);
  });
});
