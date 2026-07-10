// Approach A: procedural sprite composer (spec §6.1 SpriteFactory / drawRobot).
// Renders part grids onto a cached offscreen canvas per pose and registers it
// as a normal Phaser texture, so Fighter can use it exactly like a sliced PNG.
import Phaser from 'phaser';
import { KAKASHI_ARM, KAKASHI_HEAD, KAKASHI_LEG, KAKASHI_PALETTE, KAKASHI_TORSO, rotate90, type PixelGrid } from './spriteParts';

const PIXEL_SCALE = 4;
const CANVAS_SIZE = 150;

function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: PixelGrid,
  palette: Record<number, number>,
  originX: number,
  originY: number,
  flipX = false,
) {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const idx = grid[row][col];
      if (!idx) continue;
      const color = palette[idx];
      if (color === undefined) continue;
      const w = grid[row].length;
      const px = flipX ? w - 1 - col : col;
      const x = originX + px * PIXEL_SCALE;
      const y = originY + row * PIXEL_SCALE;
      ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      ctx.fillRect(x, y, PIXEL_SCALE, PIXEL_SCALE);
    }
  }
}

interface PoseConfig {
  head: [number, number];
  torso: [number, number];
  armL: [number, number];
  armR: [number, number];
  legL: [number, number];
  legR: [number, number];
  lying?: boolean;
}

const KAKASHI_POSES: Record<string, PoseConfig> = {
  idle: { head: [26, 0], torso: [18, 20], armL: [4, 24], armR: [64, 24], legL: [24, 72], legR: [40, 72] },
  walk: { head: [26, 0], torso: [18, 20], armL: [2, 26], armR: [66, 22], legL: [16, 72], legR: [48, 70] },
  guard: { head: [26, 4], torso: [18, 24], armL: [26, 18], armR: [42, 18], legL: [24, 76], legR: [40, 76] },
  hitstun: { head: [34, 2], torso: [24, 20], armL: [2, 22], armR: [70, 22], legL: [26, 72], legR: [42, 74] },
  knockdown: { head: [6, 95], torso: [26, 90], armL: [4, 118], armR: [4, 75], legL: [78, 92], legR: [78, 110], lying: true },
};

function renderPose(ctx: CanvasRenderingContext2D, cfg: PoseConfig) {
  const legGrid: PixelGrid = cfg.lying ? rotate90(KAKASHI_LEG) : KAKASHI_LEG;
  const armGrid: PixelGrid = cfg.lying ? rotate90(KAKASHI_ARM) : KAKASHI_ARM;
  const torsoGrid: PixelGrid = cfg.lying ? rotate90(KAKASHI_TORSO) : KAKASHI_TORSO;
  const headGrid: PixelGrid = cfg.lying ? rotate90(KAKASHI_HEAD) : KAKASHI_HEAD;

  drawGrid(ctx, legGrid, KAKASHI_PALETTE, ...cfg.legL);
  drawGrid(ctx, legGrid, KAKASHI_PALETTE, ...cfg.legR);
  drawGrid(ctx, torsoGrid, KAKASHI_PALETTE, ...cfg.torso);
  drawGrid(ctx, armGrid, KAKASHI_PALETTE, ...cfg.armL);
  drawGrid(ctx, armGrid, KAKASHI_PALETTE, ...cfg.armR, true);
  drawGrid(ctx, headGrid, KAKASHI_PALETTE, ...cfg.head);
}

export function generateKakashiTextures(scene: Phaser.Scene) {
  for (const [pose, cfg] of Object.entries(KAKASHI_POSES)) {
    const key = `kakashi_${pose}`;
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, CANVAS_SIZE, CANVAS_SIZE);
    if (!tex) continue;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    renderPose(ctx, cfg);
    tex.refresh();
  }
}

export const KAKASHI_IDLE_SOURCE_HEIGHT = CANVAS_SIZE;
