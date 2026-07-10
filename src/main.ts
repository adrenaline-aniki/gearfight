import Phaser from 'phaser';
import './firebase/config';
import './style.css';
import { GAME_HEIGHT, GAME_WIDTH } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { ModeSelectScene } from './scenes/ModeSelectScene';
import { BattleScene } from './scenes/BattleScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a1a2e',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [BootScene, TitleScene, ModeSelectScene, BattleScene],
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
};

const game = new Phaser.Game(config);
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
