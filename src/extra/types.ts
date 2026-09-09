export type SwitchMode = "on" | "off" | "onoff";

export interface BridgeTarget {
  x: number;
  y: number;
  mode: SwitchMode;
}

export interface SwitchDef {
  x: number;
  y: number;
  bridges: BridgeTarget[];
}

export interface SplitDef {
  x: number;
  y: number;
  a: [number, number];
  b: [number, number];
}

export interface LevelDef {
  id: string;
  code: string;
  tiles: string[];
  spawn: [number, number];
  switches: SwitchDef[];
  splits: SplitDef[];
}
