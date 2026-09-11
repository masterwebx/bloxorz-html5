/** Keep CreateJS door collision (`passable`) aligned with visual `state`. */
export function syncDoorPassable(door: {
  state: boolean;
  passable: boolean;
  onChange?: (passable: boolean) => void;
}): void {
  const open = !!door.state;
  if (door.onChange) door.onChange(open);
  else door.passable = open;
}

/**
 * Timeline scripts pass true/false blindly; collision must follow logical `state`.
 * Use this inside door.onChange so frame_40/130 cannot desync passable during rapid toggles.
 */
export function passableFromDoorState(state: boolean, _timelineArg?: boolean): boolean {
  return !!state;
}

/** Walkability after a bridge has settled visually open/closed. */
export function doorWalkableWhenSettled(door: { state: boolean; passable: boolean }): boolean {
  return !!door.state && !!door.passable;
}

/** True when every door's collision matches state and the clip is no longer animating. */
export function doorsSettled(
  tiles: { door?: { state: boolean; passable: boolean }; tickEnabled?: boolean }[],
): boolean {
  for (const tile of tiles) {
    const door = tile.door;
    if (!door) continue;
    if (!!door.passable !== !!door.state) return false;
    if (tile.tickEnabled) return false;
  }
  return true;
}

/** HUD move total: only accumulate across stages when the mode wants run totals. */
export function displayMoveCount(worldMoves: number, totalMoves: number, accumulate: boolean): number {
  return Math.max(0, worldMoves) + (accumulate ? Math.max(0, totalMoves) : 0);
}

/** Prefer the focused split cube's select marker when several are animating. */
export function focusedSelectIndex(blockCount: number, focusIndex: number | undefined): number {
  if (blockCount <= 0) return -1;
  if (blockCount === 1) return 0;
  const i = focusIndex ?? 0;
  return ((i % blockCount) + blockCount) % blockCount;
}
