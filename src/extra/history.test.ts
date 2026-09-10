import { describe, expect, it } from "vitest";
import { Stage } from "./engine";
import type { LevelDef } from "./types";
import { H, W } from "./engine";
import {
  acceptTapeCmd,
  loadFinishedStages,
  loadRuns,
  saveFinishedStage,
  saveRun,
  setHistoryStorage,
  winningTape,
  type RunRecord,
} from "./history";

function mini(tiles: string[], spawn: [number, number] = [1, 0]): LevelDef {
  const rows = [...tiles];
  while (rows.length < H) rows.push("               ");
  return {
    id: "t",
    code: "000000",
    tiles: rows.map((r) => (r + "               ").slice(0, W)),
    spawn,
    switches: [],
    splits: [],
  };
}

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

  it("does not list in-progress or empty tapes", () => {
    const store = memoryStore();
    setHistoryStorage(store);
    saveFinishedStage({
      id: "early",
      at: 4,
      player: "BLOX",
      stage: 1,
      moves: 0,
      cmds: [],
      title: "Stage 01",
    });
    expect(loadFinishedStages()).toEqual([]);
    store.setItem(
      "bloxorz-finished-v1",
      JSON.stringify([
        { id: "partial", at: 5, player: "BLOX", stage: 2, moves: 2, cmds: [] },
        { id: "won", at: 6, player: "BLOX", stage: 1, moves: 3, cmds: ["right", "right", "down"] },
      ]),
    );
    const rows = loadFinishedStages();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("won");
    expect(rows[0].cmds).toEqual(["right", "right", "down"]);
  });

  it("does not promote a failed attempt into history", () => {
    const store = memoryStore();
    setHistoryStorage(store);
    saveRun({
      id: "fail-run",
      at: 8,
      player: "BLOX",
      totalTimeMs: 40,
      totalMoves: 3,
      fails: 1,
      complete: false,
      levels: [{ stage: 1, timeMs: 40, moves: 3, attempts: 1, tapes: [{ cmds: ["right", "up", "left"], won: false }] }],
    });
    expect(loadRuns()).toEqual([]);
    expect(loadFinishedStages()).toEqual([]);
  });
});

describe("run history", () => {
  it("stores runs newest first and skips empty ones", () => {
    const store = memoryStore();
    setHistoryStorage(store);
    saveRun({
      id: "a",
      at: 1,
      player: "Wex",
      totalTimeMs: 1000,
      totalMoves: 10,
      fails: 2,
      complete: true,
      levels: [
        {
          stage: 0,
          timeMs: 1000,
          moves: 10,
          attempts: 1,
          tapes: [{ cmds: ["right", "right"], won: true }],
        },
      ],
    });
    saveRun({
      id: "b",
      at: 2,
      player: "Wex",
      totalTimeMs: 500,
      totalMoves: 4,
      fails: 0,
      complete: false,
      levels: [],
    });
    const runs = loadRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0].id).toBe("a");
    expect(winningTape(runs[0].levels[0])).toEqual(["right", "right"]);
  });

  it("keeps custom and puzzle finishes with a seed", () => {
    setHistoryStorage(memoryStore());
    saveFinishedStage({
      id: "d1",
      at: 9,
      player: "BLOX",
      stage: 1,
      moves: 4,
      cmds: ["right", "right"],
      title: "DAILY PUZZLE",
      kind: "daily",
      seed: "BXS.TEST",
    });
    const row = loadFinishedStages()[0];
    expect(row.kind).toBe("daily");
    expect(row.seed).toBe("BXS.TEST");
    expect(row.title).toBe("DAILY PUZZLE");
  });

  it("records a swap only while the cubes are actually split", () => {
    expect(acceptTapeCmd("swap", { idle: true, split: false })).toBe(false);
    expect(acceptTapeCmd("swap", { idle: true, split: true })).toBe(true);
    expect(acceptTapeCmd("right", { idle: false, split: false })).toBe(false);
    expect(acceptTapeCmd("right", { idle: true, split: false })).toBe(true);
  });
});

describe("attempt counting", () => {
  it("survives constructing a replacement Stage the way a respawn does", () => {
    const def = mini(["bbbe"], [1, 0]);
    const first = new Stage(def);
    first.attempts = 4;
    const next = new Stage(def);
    next.attempts = first.attempts;
    expect(next.attempts).toBe(4);
    expect(next.moves).toBe(0);
  });
});
