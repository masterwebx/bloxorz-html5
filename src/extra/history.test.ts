import { describe, expect, it } from "vitest";
import {
  loadFinishedStages,
  saveFinishedStage,
  saveRun,
  setHistoryStorage,
  winningTape,
  type RunRecord,
} from "./history";

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

describe("history finished stages", () => {
  it("does not keep a run that has no winning stages", () => {
    const store = memoryStore();
    setHistoryStorage(store);
    const run: RunRecord = {
      id: "r1",
      at: 1,
      player: "BLOX",
      totalTimeMs: 10,
      totalMoves: 4,
      fails: 1,
      complete: false,
      levels: [{ stage: 1, timeMs: 4, moves: 4, attempts: 2, tapes: [{ cmds: ["right"], won: false }] }],
    };
    saveRun(run);
    expect(store.getItem("bloxorz-history-v1")).toBeNull();
  });

  it("saves only winning tapes when a run is recorded", () => {
    const store = memoryStore();
    setHistoryStorage(store);
    saveRun({
      id: "r2",
      at: 2,
      player: "DEV",
      totalTimeMs: 20,
      totalMoves: 8,
      fails: 1,
      complete: true,
      levels: [
        { stage: 1, timeMs: 4, moves: 4, attempts: 2, tapes: [{ cmds: ["left"], won: false }, { cmds: ["right", "down"], won: true }] },
        { stage: 2, timeMs: 4, moves: 0, attempts: 1, tapes: [{ cmds: ["up"], won: false }] },
      ],
    });
    const rows = JSON.parse(store.getItem("bloxorz-history-v1") || "[]") as RunRecord[];
    expect(rows).toHaveLength(1);
    expect(rows[0].levels).toHaveLength(1);
    expect(rows[0].levels[0].stage).toBe(1);
    expect(winningTape(rows[0].levels[0])).toEqual(["right", "down"]);
  });

  it("lists finished stages", () => {
    setHistoryStorage(memoryStore());
    saveFinishedStage({
      id: "s1",
      at: 3,
      player: "BLOX",
      stage: 1,
      moves: 8,
      cmds: ["right", "right", "down"],
      title: "Stage 01",
    });
    const rows = loadFinishedStages();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Stage 01");
  });
});
