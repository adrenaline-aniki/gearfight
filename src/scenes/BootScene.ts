import Phaser from 'phaser';
import { generateKakashiTextures } from '../graphics/SpriteFactory';

// Deliberately minimal: this used to preload every character's full sprite
// set (115 PNGs), all 90 portrait images, and both ~7MB BGM tracks before
// the title screen could even appear - a real ~15s wait on a phone, for
// assets most of which a given session never touches (you rarely fight
// with more than 2-3 of the 8 sprite fighters, and dialogue only ever shows
// a handful of speakers). Each scene now loads only what it actually needs,
// in its own preload() (see GarageScene/BattleScene/DialogueScene/TitleScene) -
// Phaser's loader skips a key that's already cached, so nothing is re-fetched
// across scene transitions within a session.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    generateKakashiTextures(this);
    Promise.all([
      document.fonts.load('10px "PixelMplus10"'),
      document.fonts.load('bold 10px "PixelMplus10"'),
    ]).catch(() => {}).then(() => this.scene.start('TitleScene'));
  }
}
