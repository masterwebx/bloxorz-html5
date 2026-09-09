import { describe, expect, it } from "vitest";
import { billboardSupports } from "./hud";

describe("home billboard", () => {
  it("can draw the plus on ORZ+", () => {
    expect(billboardSupports("+")).toBe(true);
    expect(billboardSupports("Z")).toBe(true);
  });
});
