import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import { PORTRAIT_EMOTION_IDS, PORTRAIT_EMOTIONS, PORTRAIT_FLAT_IDS, SPRITE_FIGHTERS, SPRITE_POSES, SPRITE_WALK_FRAME_COUNT } from '../config/constants';
import { generateKakashiTextures } from '../graphics/SpriteFactory';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    AudioManager.preload(this);
    this.load.image('char_icons', '/char_icons.PNG');
    for (const id of PORTRAIT_EMOTION_IDS) {
      for (const emotion of PORTRAIT_EMOTIONS) {
        this.load.image(`portrait_${id}_${emotion}`, `/sprites/portraits/${id}/${emotion}.png`);
      }
    }
    for (const id of PORTRAIT_FLAT_IDS) {
      this.load.image(`portrait_${id}`, `/sprites/portraits/${id}.png`);
    }
    for (const fighter of SPRITE_FIGHTERS) {
      for (const pose of SPRITE_POSES) {
        if (pose === 'walk') continue; // handled below (may be multiple frames)
        this.load.image(`${fighter}_${pose}`, `/sprites/${fighter}/${pose}.png`);
      }
      const walkFrames = SPRITE_WALK_FRAME_COUNT[fighter] ?? 1;
      if (walkFrames > 1) {
        for (let i = 0; i < walkFrames; i++) {
          this.load.image(`${fighter}_walk_${i}`, `/sprites/${fighter}/walk_${i}.png`);
        }
      } else {
        this.load.image(`${fighter}_walk`, `/sprites/${fighter}/walk.png`);
      }
    }
  }

  create() {
    generateKakashiTextures(this);
    Promise.all([
      document.fonts.load('10px "PixelMplus10"'),
      document.fonts.load('bold 10px "PixelMplus10"'),
    ]).catch(() => {}).then(() => this.scene.start('TitleScene'));
  }
}
