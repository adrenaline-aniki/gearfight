import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import { PORTRAIT_EMOTION_IDS, PORTRAIT_EMOTIONS, PORTRAIT_FLAT_IDS, SPRITE_FIGHTERS, SPRITE_POSES } from '../config/constants';
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
        this.load.image(`${fighter}_${pose}`, `/sprites/${fighter}/${pose}.png`);
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
