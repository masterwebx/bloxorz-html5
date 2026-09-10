export const DENSE_TILE_COUNT = 30;
export const SKIP_SPAWN_TILE_COUNT = 60;

export function shouldBakeFloor(tileCount: number): boolean {
  return tileCount >= DENSE_TILE_COUNT;
}

export function shouldSkipTileSpawn(tileCount: number): boolean {
  return tileCount >= SKIP_SPAWN_TILE_COUNT;
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
