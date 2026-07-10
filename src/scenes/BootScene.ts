import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import { SPRITE_FIGHTERS, SPRITE_POSES } from '../config/constants';
import { generateKakashiTextures } from '../graphics/SpriteFactory';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    AudioManager.preload(this);
    this.load.image('char_icons', '/char_icons.PNG');
    for (const fighter of SPRITE_FIGHTERS) {
      for (const pose of SPRITE_POSES) {
        this.load.image(`${fighter}_${pose}`, `/sprites/${fighter}/${pose}.png`);
      }
    }
  }

  create() {
    generateKakashiTextures(this);
    this.scene.start('TitleScene');
  }
}
