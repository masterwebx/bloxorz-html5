import { setTile, tileChar } from "./customLevels";
import type { LevelDef, SwitchMode } from "./types";
import { solveLevel } from "./solve";

export const EDITOR_TOOLS = [
  { id: "erase", label: "Erase", ch: " " },
  { id: "stone", label: "Stone", ch: "b" },
  { id: "exit", label: "Exit", ch: "e" },
  { id: "soft", label: "Soft Switch", ch: "s" },
  { id: "heavy", label: "Heavy Switch", ch: "h" },
  { id: "fragile", label: "Fragile", ch: "f" },
  { id: "split", label: "Split", ch: "v" },
  { id: "bridgeL", label: "Bridge L", ch: "l" },
  { id: "bridgeR", label: "Bridge R", ch: "r" },
  { id: "spawn", label: "Spawn", ch: null },
  { id: "link", label: "Link Switch", ch: null },
] as const;

export type EditorToolId = (typeof EDITOR_TOOLS)[number]["id"];
export interface EditorPaintState {
  tool: EditorToolId;
  splitStep: 0 | 1 | 2;
  splitAt: { x: number; y: number } | null;
  linkFrom: { x: number; y: number } | null;
  hint: string;
}

export function newPaintState(tool: EditorToolId = "stone"): EditorPaintState {
  return { tool, splitStep: 0, splitAt: null, linkFrom: null, hint: "" };
}

export function splitMarks(def: LevelDef): { x: number; y: number; label: string }[] {
  const marks: { x: number; y: number; label: string }[] = [];
  for (const s of def.splits) {
    marks.push({ x: s.a[0], y: s.a[1], label: "A" });
    marks.push({ x: s.b[0], y: s.b[1], label: "B" });
  }
  return marks;
}

export function linkMarks(def: LevelDef): { x: number; y: number; label: string }[] {
  const marks: { x: number; y: number; label: string }[] = [];
  for (const sw of def.switches ?? []) {
    for (const b of sw.bridges) {
      const label = b.mode === "on" ? "ON" : b.mode === "off" ? "OFF" : "T";
      marks.push({ x: b.x, y: b.y, label });
    }
  }
  return marks;
}

export function editorMarks(def: LevelDef): { x: number; y: number; label: string }[] {
  return [...splitMarks(def), ...linkMarks(def)];
}

export function checkBeatable(def: LevelDef, limit = 80_000): boolean {
  if (!def.tiles.some((row) => row.includes("e"))) return false;
  return solveLevel(def, limit).ok;
}

export function beatBadge(def: LevelDef, playable: string | null): string {
  if (playable) return playable;
  return checkBeatable(def) ? "CAN BE BEAT" : "IMPOSSIBLE";
}

function solid(def: LevelDef, x: number, y: number): boolean {
  const ch = tileChar(def, x, y);
  return ch !== " " && ch !== "e";
}

export function paintEditorCell(def: LevelDef, x: number, y: number, state: EditorPaintState): void {
  const tool = EDITOR_TOOLS.find((t) => t.id === state.tool);
  if (!tool) return;

  if (tool.id === "spawn") {
    def.spawn = [x, y];
    state.hint = "Spawn set.";
    return;
  }

  if (tool.id === "link") {
    const ch = tileChar(def, x, y);
    if (ch === "s" || ch === "h") {
      state.linkFrom = { x, y };
      state.hint = "Now click a bridge to link. Click again to cycle On / Off / Toggle.";
      return;
    }
    if (!state.linkFrom) {
      state.hint = "Click a soft or heavy switch first.";
      return;
    }
    if (ch !== "l" && ch !== "r" && ch !== "k" && ch !== "q") {
      state.hint = "Link target must be a bridge.";
      return;
    }
    const from = state.linkFrom;
    let sw = def.switches.find((s) => s.x === from.x && s.y === from.y);
    if (!sw) {
      sw = { x: from.x, y: from.y, bridges: [] };
      def.switches.push(sw);
    }
    const existing = sw.bridges.find((b) => b.x === x && b.y === y);
    const cycle: SwitchMode[] = ["onoff", "on", "off"];
    if (existing) {
      existing.mode = cycle[(cycle.indexOf(existing.mode) + 1) % 3];
      state.hint = `Bridge link set to ${existing.mode}.`;
    } else {
      sw.bridges.push({ x, y, mode: "onoff" });
      state.hint = "Bridge linked (toggle). Click again to change mode.";
    }
    return;
  }

  if (tool.ch === "v") {
    if (state.splitStep === 1 && state.splitAt) {
      if (!solid(def, x, y)) {
        state.hint = "Cube A needs a solid tile, not empty or the hole.";
        return;
      }
      const at = state.splitAt;
      const pad = def.splits.find((s) => s.x === at.x && s.y === at.y);
      if (pad) pad.a = [x, y];
      else def.splits.push({ x: at.x, y: at.y, a: [x, y], b: [x, y] });
      state.splitStep = 2;
      state.hint = "Click destination for cube B.";
      return;
    }
    if (state.splitStep === 2 && state.splitAt) {
      if (!solid(def, x, y)) {
        state.hint = "Cube B needs a solid tile, not empty or the hole.";
        return;
      }
      const at = state.splitAt;
      let pad = def.splits.find((s) => s.x === at.x && s.y === at.y);
      if (!pad) {
        pad = { x: at.x, y: at.y, a: [x, y], b: [x, y] };
        def.splits.push(pad);
      }
      pad.b = [x, y];
      state.splitStep = 0;
      state.splitAt = null;
      state.hint = "Split destinations set. Cubes drop onto those tiles, not extra split pads.";
      return;
    }
    setTile(def, x, y, "v");
    def.splits = def.splits.filter((s) => !(s.x === x && s.y === y));
    state.splitAt = { x, y };
    state.splitStep = 1;
    state.hint = "Click destination for cube A (an existing tile, not another split pad).";
    return;
  }

  if (tool.ch !== null) {
    if (tool.ch === "e") {
      for (let yy = 0; yy < 10; yy++) {
        for (let xx = 0; xx < 15; xx++) {
          if (tileChar(def, xx, yy) === "e") setTile(def, xx, yy, " ");
        }
      }
      setTile(def, x, y, "e");
      state.hint = "Exit set. Only one exit can be placed.";
      return;
    }
    if (tool.ch === "l" || tool.ch === "r") {
      const cur = tileChar(def, x, y);
      if (tool.ch === "l" && cur === "l") {
        setTile(def, x, y, "k");
        state.hint = "Left bridge starts ON. Click again to start OFF.";
        return;
      }
      if (tool.ch === "l" && cur === "k") {
        setTile(def, x, y, "l");
        state.hint = "Left bridge starts OFF.";
        return;
      }
      if (tool.ch === "r" && cur === "r") {
        setTile(def, x, y, "q");
        state.hint = "Right bridge starts ON. Click again to start OFF.";
        return;
      }
      if (tool.ch === "r" && cur === "q") {
        setTile(def, x, y, "r");
        state.hint = "Right bridge starts OFF.";
        return;
      }
    }
    setTile(def, x, y, tool.ch);
    if (tool.ch === " ") state.hint = "Erased.";
    else if (tool.ch === "s" || tool.ch === "h") {
      state.tool = "link";
      state.linkFrom = { x, y };
      state.hint = "Switch placed. Click or drag bridges to link. Click a linked bridge again to cycle On / Off / Toggle.";
    } else if (tool.ch === "l" || tool.ch === "r") state.hint = "Bridge starts OFF. Click again to start ON.";
    else state.hint = "";
  }
}
