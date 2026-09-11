import { describe, expect, it } from "vitest";
import {
  ATTRACT_IDLE_DEV_MS,
  ATTRACT_IDLE_MS,
  attractIdleMs,
  attractTitleLabel,
  bumpAttractIdle,
  shouldStartAttract,
} from "./attract";

describe("title attract idle gate", () => {
  it("starts only after idle on home when not navigating", () => {
    const t0 = 1_000_000;
    expect(
      shouldStartAttract({
        now: t0 + ATTRACT_IDLE_MS - 1,
        lastInputAt: t0,
        onHome: true,
        navigating: false,
        alreadyAttracting: false,
      }),
    ).toBe(false);
    expect(
      shouldStartAttract({
        now: t0 + ATTRACT_IDLE_MS,
        lastInputAt: t0,
        onHome: true,
        navigating: false,
        alreadyAttracting: false,
      }),
    ).toBe(true);
  });

  it("uses a 30s idle gate in dev", () => {
    expect(attractIdleMs(true)).toBe(ATTRACT_IDLE_DEV_MS);
    expect(attractIdleMs(false)).toBe(ATTRACT_IDLE_MS);
    const t0 = 5_000;
    expect(
      shouldStartAttract({
        now: t0 + ATTRACT_IDLE_DEV_MS,
        lastInputAt: t0,
        onHome: true,
        navigating: false,
        alreadyAttracting: false,
        dev: true,
      }),
    ).toBe(true);
    expect(
      shouldStartAttract({
        now: t0 + ATTRACT_IDLE_DEV_MS - 1,
        lastInputAt: t0,
        onHome: true,
        navigating: false,
        alreadyAttracting: false,
        dev: true,
      }),
    ).toBe(false);
  });

  it("does not start while navigating or already attracting or off home", () => {
    const t0 = 5_000;
    const base = {
      now: t0 + ATTRACT_IDLE_MS + 10,
      lastInputAt: t0,
      onHome: true,
      navigating: false,
      alreadyAttracting: false,
    };
    expect(shouldStartAttract({ ...base, navigating: true })).toBe(false);
    expect(shouldStartAttract({ ...base, alreadyAttracting: true })).toBe(false);
    expect(shouldStartAttract({ ...base, onHome: false })).toBe(false);
  });

  it("bumps idle and formats the bottom title", () => {
    expect(bumpAttractIdle(42)).toBe(42);
    expect(attractTitleLabel("DEVORZ+")).toBe("DEVORZ+");
    expect(attractTitleLabel("  ")).toBe("BLOXORZ+");
  });
});
