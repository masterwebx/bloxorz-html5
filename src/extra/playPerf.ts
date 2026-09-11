export const DENSE_TILE_COUNT = 24;
export const SKIP_SPAWN_TILE_COUNT = 40;

export function shouldBakeFloor(tileCount: number): boolean {
  return tileCount >= DENSE_TILE_COUNT;
}

export function shouldSkipTileSpawn(tileCount: number): boolean {
  return tileCount >= SKIP_SPAWN_TILE_COUNT;
}

/**
 * lib.Tile spawn labels (`gotoAndStop("softswitch")` etc.) are empty stop
 * frames. The pad graphic only exists after the fly-in lands on these frames.
 */
export const TILE_SPAWN_LABEL_FRAME: Record<string, number> = {
  s: 47,
  h: 70,
  v: 137,
};

export const TILE_IDLE_FRAME: Record<string, number> = {
  s: 69,
  h: 92,
  e: 114,
  v: 159,
  f: 182,
};

export function tileIdleFrame(type: string, doorOpen?: boolean): number | null {
  if (type === "l" || type === "k") return doorOpen ? 39 : 32;
  if (type === "r" || type === "q") return doorOpen ? 129 : 122;
  return TILE_IDLE_FRAME[type] ?? null;
}

/** Same iso test bloxorz uses: tile is behind the block if it is north-east of it. */
export function tileIsBehindBlock(tx: number, ty: number, bx: number, by: number): boolean {
  return ty <= by && tx >= bx;
}

/** Child index to insert the block so front tiles still draw on top. */
export function blockInsertIndex(
  tiles: { x: number; y: number; index: number }[],
  bx: number,
  by: number,
  childCount: number,
): number {
  let insertAt = childCount;
  for (const tile of tiles) {
    if (tileIsBehindBlock(tile.x, tile.y, bx, by)) continue;
    if (tile.index >= 0 && tile.index < insertAt) insertAt = tile.index;
  }
  return insertAt;
}
