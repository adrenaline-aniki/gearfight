import Phaser from 'phaser';
import './firebase/config';
import './style.css';
import { GAME_HEIGHT, GAME_WIDTH } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { ModeSelectScene } from './scenes/ModeSelectScene';
import { DialogueScene } from './scenes/DialogueScene';
import { GarageScene } from './scenes/GarageScene';
import { BattleScene } from './scenes/BattleScene';
import { TrainingScene } from './scenes/TrainingScene';
import { SelectScene } from './scenes/SelectScene';
import { EditorScene } from './scenes/EditorScene';

// A plain CSS `url(/fonts/...)` can't pick up Vite's `base` (needed so the
// GitHub Pages build target, which serves under /gearfight/, still finds its
// fonts), so the @font-face rule is injected here instead, where BASE_URL is available.
const fontBase = import.meta.env.BASE_URL;
const fontStyle = document.createElement('style');
fontStyle.textContent = `
@font-face {
  font-family: 'PixelMplus10';
  src: url('${fontBase}fonts/PixelMplus10-Regular.ttf') format('truetype');
  font-weight: normal;
  font-display: block;
}
@font-face {
  font-family: 'PixelMplus10';
  src: url('${fontBase}fonts/PixelMplus10-Bold.ttf') format('truetype');
  font-weight: bold;
  font-display: block;
}
`;
document.head.appendChild(fontStyle);

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
  scene: [BootScene, TitleScene, ModeSelectScene, DialogueScene, GarageScene, BattleScene, TrainingScene, SelectScene, EditorScene],
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  // Phaser only tracks 2 simultaneous pointers by default (1 + this many
  // extra touch pointers). This game's touch layout needs the stick held
  // down AND a button pressed at the same time as the common case, and up
  // to 3 fingers for the super move's simultaneous weak+strong while still
  // moving - the default silently drops whichever touch doesn't fit,
  // which read as the gear shifter / jump / super input "not responding".
  input: {
    activePointers: 4,
  },
};

const game = new Phaser.Game(config);
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
