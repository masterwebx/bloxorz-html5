import { describe, expect, it } from "vitest";
import { Stage } from "./engine";
import type { LevelDef } from "./types";
import { H, W } from "./engine";
import {
  GhostRunner,
  ghostsForStage,
  loadFinishedStages,
  loadRuns,
  loadSeeGhosts,
  pushGhost,
  saveFinishedStage,
  saveRun,
  saveSeeGhosts,
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

  it("keeps unique ghost tapes per stage", () => {
    setHistoryStorage(memoryStore());
    pushGhost(0, ["right"]);
    pushGhost(0, ["right"]);
    pushGhost(0, ["left"]);
    pushGhost(1, ["up"]);
    expect(ghostsForStage(0)).toEqual([["right"], ["left"]]);
    expect(ghostsForStage(0, ["left"])).toEqual([["right"]]);
    expect(ghostsForStage(1)).toEqual([["up"]]);
  });

  it("defaults see-ghosts to on", () => {
    setHistoryStorage(memoryStore());
    expect(loadSeeGhosts()).toBe(true);
    saveSeeGhosts(false);
    expect(loadSeeGhosts()).toBe(false);
  });
});

describe("ghost playback", () => {
  it("replays a short winning tape onto the exit", () => {
    const def = mini(["bbbe"], [0, 0]);
    const ghost = new GhostRunner(def, ["right", "right"]);
    for (let i = 0; i < 80; i++) ghost.tick(0.05);
    expect(ghost.finished).toBe(true);
    expect(ghost.stage.won).toBe(true);
    expect(ghost.stage.block).toEqual({ x: 3, y: 0, ori: "up" });
  });

  it("marks a falling tape finished without resetting attempts on the live stage", () => {
    const def = mini(["bbbe"], [1, 0]);
    const live = new Stage(def);
    live.attempts = 3;
    const ghost = new GhostRunner(def, ["left"]);
    for (let i = 0; i < 80; i++) ghost.tick(0.05);
    expect(ghost.finished).toBe(true);
    expect(ghost.stage.failed).toBe(true);
    expect(live.attempts).toBe(3);
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
