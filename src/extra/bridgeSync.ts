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

/** Walkability after a bridge has settled visually open/closed. */
export function doorWalkableWhenSettled(door: { state: boolean; passable: boolean }): boolean {
  return !!door.state && !!door.passable;
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
