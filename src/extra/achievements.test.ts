import { describe, expect, it } from "vitest";
import {
  ACH_COUNT,
  ACHIEVEMENTS,
  achievementRows,
  hasAchievementMenu,
  hintTokens,
  loadAchievements,
  noSwapStages,
  noteCopiedSeed,
  noteFall,
  noteWin,
  padAch,
  parMoves,
  setAchievementsStorage,
  spendHint,
  uniqueStageKey,
} from "./achievements";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

describe("achievements", () => {
  it("ships 300 uniquely numbered achievements", () => {
    expect(ACHIEVEMENTS).toHaveLength(ACH_COUNT);
    const nums = ACHIEVEMENTS.map((row) => row.n);
    expect(new Set(nums).size).toBe(ACH_COUNT);
    expect(nums[0]).toBe(1);
    expect(nums[ACH_COUNT - 1]).toBe(ACH_COUNT);
    expect(padAch(7)).toBe("007");
  });

  it("never hints about developer tools", () => {
    const banned = /dev\s*mode|auto-?solve|dev name|goto stage|jump to stage|cheat/i;
    for (const row of ACHIEVEMENTS) {
      expect(row.hint, `#${row.n} ${row.name}`).not.toMatch(banned);
      expect(row.name, `#${row.n}`).not.toMatch(banned);
    }
  });

  it("hides the menu until something unlocks, then spends unique-stage hints", () => {
    setAchievementsStorage(memoryStore());
    expect(hasAchievementMenu()).toBe(false);
    expect(hintTokens()).toBe(0);

    const fresh = noteWin({
      kind: "campaign",
      stageNo: 1,
      uniqueKey: uniqueStageKey("campaign", 1),
      moves: parMoves(1),
      noFall: true,
      cmds: ["right", "right", "down", "right"],
      theme: "original",
      timerOn: false,
      classicRun: true,
      day: "2026-09-09",
    });
    expect(fresh.length).toBeGreaterThan(0);
    expect(hasAchievementMenu()).toBe(true);
    expect(hintTokens()).toBe(1);

    const locked = ACHIEVEMENTS.find((row) => !loadAchievements().unlocked[String(row.n)])!;
    expect(spendHint(locked.n)).toBe("ok");
    expect(hintTokens()).toBe(0);
    expect(spendHint(locked.n)).toBe("hinted");
    expect(spendHint(ACHIEVEMENTS.find((row) => !loadAchievements().unlocked[String(row.n)] && !loadAchievements().hinted.includes(row.n))!.n)).toBe("tokens");

    const rows = achievementRows(0, 6);
    expect(rows[0]?.unlocked).toBe(true);
    expect(rows[0]?.label).toContain("#001");
  });

  it("counts a fall and does not treat no-swap stages as requiring swap", () => {
    setAchievementsStorage(memoryStore());
    noteFall();
    expect(loadAchievements().falls).toBe(1);
    expect(noSwapStages()).toContain(1);
    expect(noSwapStages()).not.toContain(8);
  });

  it("does not charge a hint for copying a seed twice", () => {
    setAchievementsStorage(memoryStore());
    expect(noteCopiedSeed().length).toBeGreaterThan(0);
    expect(noteCopiedSeed().length).toBe(0);
  });
});
