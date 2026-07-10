// Approach A: parts-composition procedural pixel art (spec §6.1 SpriteFactory).
// Each part is a small 2D grid of palette indices (0 = transparent).
export type PixelGrid = number[][];

export const KAKASHI_PALETTE: Record<number, number> = {
  1: 0x6b4a1f, // dark wood (outline)
  2: 0x8b6914, // mid wood
  3: 0xcd853f, // light wood highlight
  4: 0x2a1a0a, // near-black (eyes / joint bands)
  5: 0xcc2222, // red target ring
  6: 0xf5f5f0, // white target ring
  7: 0x555555, // grey bolt
};

export const KAKASHI_HEAD: PixelGrid = [
  [0, 2, 2, 2, 2, 2, 0],
  [2, 3, 3, 3, 3, 3, 2],
  [2, 3, 4, 3, 4, 3, 2],
  [2, 3, 3, 3, 3, 3, 2],
  [2, 3, 3, 3, 3, 3, 2],
  [0, 2, 2, 2, 2, 2, 0],
];

export const KAKASHI_TORSO: PixelGrid = [
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2],
  [2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2],
  [2, 3, 3, 0, 5, 5, 5, 0, 3, 3, 2],
  [2, 3, 3, 5, 6, 6, 6, 5, 3, 3, 2],
  [2, 3, 3, 5, 6, 4, 6, 5, 3, 3, 2],
  [2, 3, 3, 5, 6, 6, 6, 5, 3, 3, 2],
  [2, 3, 3, 0, 5, 5, 5, 0, 3, 3, 2],
  [2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2],
  [2, 7, 3, 3, 3, 3, 3, 3, 3, 7, 2],
  [2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2],
  [2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2],
  [2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
];

export const KAKASHI_ARM: PixelGrid = [
  [2, 2, 2],
  [2, 3, 2],
  [2, 3, 2],
  [2, 4, 2],
  [2, 3, 2],
  [2, 3, 2],
  [2, 3, 2],
  [2, 2, 2],
];

export const KAKASHI_LEG: PixelGrid = [
  [2, 2, 2, 2],
  [2, 3, 3, 2],
  [2, 3, 3, 2],
  [2, 4, 4, 2],
  [2, 3, 3, 2],
  [2, 3, 3, 2],
  [2, 3, 3, 2],
  [2, 3, 3, 2],
  [2, 2, 2, 2],
  [1, 1, 1, 1],
  [1, 1, 1, 1],
];

export function rotate90(grid: PixelGrid): PixelGrid {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const out: PixelGrid = [];
  for (let col = 0; col < w; col++) {
    const row: number[] = [];
    for (let r = h - 1; r >= 0; r--) row.push(grid[r][col]);
    out.push(row);
  }
  return out;
}
