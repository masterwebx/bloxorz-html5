import { describe, expect, it } from "vitest";
import { applyLocalSave, clearLocalSave, dumpLocalSave, parseSaveBackup, SAVE_BACKUP_VERSION } from "./saveBackup";

function memoryStore(seed: Record<string, string> = {}) {
  const data = { ...seed };
  const store = {
    get length() {
      return Object.keys(data).length;
    },
    key(i: number) {
      return Object.keys(data)[i] ?? null;
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key]! : null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
    removeItem(key: string) {
      delete data[key];
    },
  };
  return { data, store: store as unknown as Storage };
}

describe("save backup", () => {
  it("dumps bloxorz keys and campaign progress, not unrelated storage", () => {
    const { store } = memoryStore({
      "bloxorz-settings-v1": '{"music":0.2}',
      theme: "gray",
      level: "4",
      other: "nope",
    });
    expect(dumpLocalSave(store)).toEqual({
      "bloxorz-settings-v1": '{"music":0.2}',
      theme: "gray",
      level: "4",
    });
  });

  it("replaces existing save keys on import", () => {
    const { data, store } = memoryStore({
      "bloxorz-history-v1": "old",
      theme: "original",
    });
    applyLocalSave({ theme: "holiday", "bloxorz-settings-v1": "{}" }, store);
    expect(data.theme).toBe("holiday");
    expect(data["bloxorz-settings-v1"]).toBe("{}");
    expect(data["bloxorz-history-v1"]).toBeUndefined();
  });

  it("rejects a junk save file", () => {
    expect(() => parseSaveBackup("{}")).toThrow();
    const ok = parseSaveBackup(JSON.stringify({ v: SAVE_BACKUP_VERSION, local: { theme: "gray" }, themes: [] }));
    expect(ok.local.theme).toBe("gray");
  });

  it("clears all bloxorz save keys", () => {
    const { data, store } = memoryStore({
      "bloxorz-settings-v1": "{}",
      theme: "gray",
      level: "3",
      other: "keep",
    });
    clearLocalSave(store);
    expect(data.theme).toBeUndefined();
    expect(data.level).toBeUndefined();
    expect(data["bloxorz-settings-v1"]).toBeUndefined();
    expect(data.other).toBe("keep");
  });
});
