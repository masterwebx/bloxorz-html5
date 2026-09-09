import { describe, expect, it } from "vitest";
import { bootLocales, detectLocale, listLocales, setLocale, t, usesHdType } from "./i18n";
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
    expect(listLocales().find((row) => row.id === "en")?.name).toBe("English HD");
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
    expect(t("play.stageCard", { n: "01" })).toBe("STAGE 01");
    setLocale("es");
    expect(t("play.stageCard", { n: "01" })).toBe("FASE 01");
    expect(t("howto.0")).toContain("33");
    expect(t("howto.next")).toBe("Siguiente >");
    expect(t("pause.resume")).toBe("Volver al juego");
    expect(t("timer.stage")).toBe("Fase");
  });

  it("keeps English Classic on bitmap marks and English on HD type", () => {
    bootLocales(LOCALE_TABLE, "en-classic");
    expect(usesHdType("en-classic")).toBe(false);
    expect(usesHdType("en")).toBe(true);
    expect(usesHdType("es")).toBe(true);
  });
});
