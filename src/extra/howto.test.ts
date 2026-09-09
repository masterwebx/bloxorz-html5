import { describe, expect, it } from "vitest";
import { howtoSlide, padStage } from "./howto";

describe("howto slides", () => {
  it("maps the official stop frames to slides 0–8", () => {
    expect(howtoSlide(13)).toBe(0);
    expect(howtoSlide(33)).toBe(1);
    expect(howtoSlide(53)).toBe(2);
    expect(howtoSlide(73)).toBe(3);
    expect(howtoSlide(93)).toBe(4);
    expect(howtoSlide(113)).toBe(5);
    expect(howtoSlide(133)).toBe(6);
    expect(howtoSlide(153)).toBe(7);
    expect(howtoSlide(173)).toBe(8);
  });

  it("pads stage numbers like the original title card", () => {
    expect(padStage(1)).toBe("01");
    expect(padStage(33)).toBe("33");
  });
});
