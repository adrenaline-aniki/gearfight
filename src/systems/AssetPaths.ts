import Phaser from 'phaser';
import { PORTRAIT_EMOTIONS, PORTRAIT_FLAT_IDS, SPRITE_POSES, SPRITE_WALK_FRAME_COUNT } from '../config/constants';
import type { SpriteFighterId } from '../types/game';

// Every scene that loads its own assets (see BootScene's comment for why
// loading moved out of one central preload) needs this - each Scene has its
// own independent LoaderPlugin, so Vite's base path (root locally/Firebase,
// /gearfight/ on the GitHub Pages build) has to be set again per scene.
export function setLoaderBase(scene: Phaser.Scene) {
  scene.load.setBaseURL(import.meta.env.BASE_URL);
}

// Queues one sprite fighter's full pose set (idle/attack/guard/etc. + however
// many walk-cycle frames it has) if not already cached. Skips fighters with
// no PNG folder (i.e. kakashi, which is procedurally generated instead).
// Just the idle pose - for spots that only ever show a static portrait-style
// image (e.g. DialogueScene's Hajime reveal effect) and don't need the full
// pose set that loadFighterSprites() queues for actual battle.
export function loadFighterIdle(scene: Phaser.Scene, fighter: string) {
  if (scene.textures.exists(`${fighter}_idle`)) return;
  scene.load.image(`${fighter}_idle`, `sprites/${fighter}/idle.png`);
}

export function loadFighterSprites(scene: Phaser.Scene, fighter: SpriteFighterId) {
  if (scene.textures.exists(`${fighter}_idle`)) return;

  for (const pose of SPRITE_POSES) {
    if (pose === 'walk') continue; // handled below (may be multiple frames)
    scene.load.image(`${fighter}_${pose}`, `sprites/${fighter}/${pose}.png`);
  }
  const walkFrames = SPRITE_WALK_FRAME_COUNT[fighter] ?? 1;
  if (walkFrames > 1) {
    for (let i = 0; i < walkFrames; i++) {
      scene.load.image(`${fighter}_walk_${i}`, `sprites/${fighter}/walk_${i}.png`);
    }
  } else {
    scene.load.image(`${fighter}_walk`, `sprites/${fighter}/walk.png`);
  }
}

// Queues one character's full portrait emotion set for DialogueScene, if not
// already cached.
export function loadPortraits(scene: Phaser.Scene, charId: string) {
  if (scene.textures.exists(`portrait_${charId}_normal`) || scene.textures.exists(`portrait_${charId}`)) return;

  if (PORTRAIT_FLAT_IDS.includes(charId)) {
    scene.load.image(`portrait_${charId}`, `sprites/portraits/${charId}.png`);
    return;
  }
  for (const emotion of PORTRAIT_EMOTIONS) {
    scene.load.image(`portrait_${charId}_${emotion}`, `sprites/portraits/${charId}/${emotion}.png`);
  }
}
