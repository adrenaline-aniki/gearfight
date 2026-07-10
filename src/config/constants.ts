export const GAME_WIDTH = 384;
export const GAME_HEIGHT = 216;
export const FPS = 60;
export const GROUND_Y = 170;

export const GEAR_TABLE = {
  1: { ratio: 0.33, teeth: '30:10', speedMul: 1.6, startup: 5, damageMul: 0.5, recovery: 14, guardBreak: false, heatPerSec: -20 },
  2: { ratio: 0.6, teeth: '25:15', speedMul: 1.3, startup: 7, damageMul: 0.75, recovery: 18, guardBreak: false, heatPerSec: -10 },
  3: { ratio: 1.0, teeth: '20:20', speedMul: 1.0, startup: 10, damageMul: 1.0, recovery: 24, guardBreak: false, heatPerSec: 0 },
  4: { ratio: 1.67, teeth: '15:25', speedMul: 0.8, startup: 15, damageMul: 1.5, recovery: 34, guardBreak: true, heatPerSec: 15 },
  5: { ratio: 3.0, teeth: '10:30', speedMul: 0.6, startup: 20, damageMul: 2.2, recovery: 44, guardBreak: true, heatPerSec: 30 },
} as const;

export type GearLevel = keyof typeof GEAR_TABLE;

export const SHIFT_FRAMES = 12;
export const PERFECT_SHIFT_FRAMES = 4;
export const PERFECT_SHIFT_WINDOW = 4;
export const PERFECT_SHIFT_WINDOW_ASSIST = 8;
export const PERFECT_SHIFT_CYCLE = 30;
export const INPUT_BUFFER = 8;
export const COYOTE_FRAMES = 3;
export const OVERHEAT_DURATION = 180;
export const HEAT_ON_HIT = 5;

export const AUDIO_URLS = {
  bgmTitle: '/music/next-gear.mp3',
  bgmBattle: '/music/next-gear-(instrumental-version).mp3',
} as const;

export const SPRITE_POSES = [
  'idle', 'walk', 'jump', 'attack_weak', 'attack_strong', 'guard',
  'shift_start', 'shift_complete', 'hitstun', 'knockdown', 'victory', 'defeat',
] as const;
export type SpritePose = (typeof SPRITE_POSES)[number];

// PNG-backed fighters, loaded from public/sprites/<id>/<pose>.png by BootScene.
export const SPRITE_FIGHTERS = ['hajime', 'wizel', 'ganrock', 'aegis', 'drift', 'theorion', 'omeganova'] as const;

// Procedurally-composed fighters (Approach A / spec §6.1 SpriteFactory), textures
// generated at runtime by graphics/SpriteFactory.ts instead of loaded from disk.
export const PROCEDURAL_FIGHTERS = ['kakashi'] as const;

export const ALL_SPRITE_FIGHTERS = [...SPRITE_FIGHTERS, ...PROCEDURAL_FIGHTERS] as const;

// Target on-screen height (px) for each fighter's idle pose; other poses scale uniformly with it.
export const SPRITE_TARGET_HEIGHT = 62;
export const SPRITE_IDLE_SOURCE_HEIGHT: Record<(typeof ALL_SPRITE_FIGHTERS)[number], number> = {
  hajime: 180,
  wizel: 166,
  kakashi: 150,
  ganrock: 167,
  aegis: 178,
  drift: 190,
  theorion: 343,
  omeganova: 479,
};
