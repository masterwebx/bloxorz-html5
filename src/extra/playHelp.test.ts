import { describe, expect, it } from "vitest";
import {
  CLASSIC_SWITCH_HINT_STAGES,
  wantsClassicCampaignMoveHelp,
  wantsClassicStage1MoveHint,
  wantsClassicSwitchHint,
} from "./attract";
import {
  classicPlayHelpKind,
  instructionPadAdvance,
  splashPadShouldDismiss,
  switchHelpKeyLabel,
  wantsCreateJsHelpBitmap,
} from "./playHelp";
import type { Settings } from "./settings";

describe("classic switch hint stages", () => {
  const classic = { classicRun: true, kind: "campaign" as const };
  const daily = { classicRun: false, kind: "custom" as const };

  it("targets the first two classic split stages (08 and 09)", () => {
    expect([...CLASSIC_SWITCH_HINT_STAGES]).toEqual([8, 9]);
    expect(wantsClassicSwitchHint({ ...classic, stageNo: 8 })).toBe(true);
    expect(wantsClassicSwitchHint({ ...classic, stageNo: 9 })).toBe(true);
    expect(wantsClassicSwitchHint({ ...classic, stageNo: 10 })).toBe(false);
    expect(wantsClassicSwitchHint({ ...classic, stageNo: 1 })).toBe(false);
  });

  it("stays classic-campaign only", () => {
    expect(wantsClassicSwitchHint({ ...daily, stageNo: 8 })).toBe(false);
    expect(wantsClassicSwitchHint({ ...classic, stageNo: 8, attract: true })).toBe(false);
    expect(wantsClassicSwitchHint({ ...classic, stageNo: 8, replay: true })).toBe(false);
    expect(wantsClassicCampaignMoveHelp({ ...classic, stageNo: 8 })).toBe(true);
  });

  it("uses DOM play-help for switch tips and keeps stage-01 move bitmap on classic English", () => {
    expect(classicPlayHelpKind({ ...classic, stageNo: 1 })).toBe("move");
    expect(classicPlayHelpKind({ ...classic, stageNo: 8 })).toBe("switch");
    expect(classicPlayHelpKind({ ...classic, stageNo: 2 })).toBe(null);
    expect(wantsCreateJsHelpBitmap({ ...classic, stageNo: 1, hdType: false })).toBe(true);
    expect(wantsCreateJsHelpBitmap({ ...classic, stageNo: 1, hdType: true })).toBe(false);
    expect(wantsCreateJsHelpBitmap({ ...classic, stageNo: 8, hdType: false })).toBe(false);
    expect(wantsCreateJsHelpBitmap({ ...classic, stageNo: 8, hdType: true })).toBe(false);
    expect(wantsClassicStage1MoveHint({ ...classic, stageNo: 1 })).toBe(true);
  });

  it("reads the remapped swap key label", () => {
    expect(switchHelpKeyLabel({ keys: { swap: "Space" } as Settings["keys"] })).toBe("Space");
    expect(switchHelpKeyLabel({ keys: { swap: "KeyQ" } as Settings["keys"] })).toBe("Q");
  });
});

describe("instruction pad advance", () => {
  it("maps confirm / A / swap / d-pad to carousel continue", () => {
    expect(instructionPadAdvance("confirm", 13)).toBe(1);
    expect(instructionPadAdvance("swap", 13)).toBe(1);
    expect(instructionPadAdvance("right", 13)).toBe(1);
    expect(instructionPadAdvance("down", 13)).toBe(1);
    expect(instructionPadAdvance("left", 40)).toBe(-1);
    expect(instructionPadAdvance("up", 40)).toBe(-1);
    expect(instructionPadAdvance("pause", 13)).toBe(0);
    expect(instructionPadAdvance("back", 10)).toBe("quit");
    expect(instructionPadAdvance("back", 40)).toBe(-1);
  });
});

describe("splash pad dismiss", () => {
  it("fires only on a newly pressed mapped button", () => {
    expect(splashPadShouldDismiss([0], [], [0, 1, 9])).toBe(true);
    expect(splashPadShouldDismiss([0], [0], [0, 1, 9])).toBe(false);
    expect(splashPadShouldDismiss([], [], [0, 1, 9])).toBe(false);
    expect(splashPadShouldDismiss([99], [], [0, 1, 9])).toBe(false);
    expect(splashPadShouldDismiss([9], [0], [0, 1, 9])).toBe(true);
  });
});
