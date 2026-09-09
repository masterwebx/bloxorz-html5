import { describe, expect, it } from "vitest";
import { bootLocales, detectLocale, listLocales, setLocale, t } from "./i18n";
import { LOCALE_TABLE } from "./locale.gen";

describe("i18n", () => {
  it("defaults English speakers to classic wording", () => {
    bootLocales(LOCALE_TABLE, null);
    expect(detectLocale("en-US")).toBe("en-classic");
    expect(detectLocale("en")).toBe("en-classic");
  });

  it("picks a shipped language when the browser matches", () => {
    expect(detectLocale("es-MX")).toBe("es");
    expect(detectLocale("zh-CN")).toBe("zh");
    expect(detectLocale("ja-JP")).toBe("ja");
    expect(detectLocale("de-DE")).toBe("de");
  });

  it("lists drop-in packs including English classic", () => {
    bootLocales(LOCALE_TABLE, "en");
    const ids = listLocales().map((row) => row.id);
    expect(ids).toContain("en");
    expect(ids).toContain("en-classic");
    expect(ids).toContain("es");
    expect(ids).toContain("zh");
    expect(ids).toContain("ja");
    expect(ids).toContain("de");
  });

  it("falls back to English when a key is missing", () => {
    bootLocales(LOCALE_TABLE, "en");
    setLocale("en");
    expect(t("play.moves")).toBe("Moves");
    expect(t("play.stage", { n: 4 })).toBe("Stage 4");
  });
});
