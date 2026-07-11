import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT } from '../config/constants';
import { AudioManager } from '../systems/AudioManager';
import { setLoaderBase } from '../systems/AssetPaths';

export class TitleScene extends Phaser.Scene {
  private audio!: AudioManager;
  private wantsBgm = false;

  constructor() {
    super('TitleScene');
  }

  create() {
    this.audio = new AudioManager(this);

    // Title music (~7MB) loads in the background instead of blocking this
    // screen from appearing - see BootScene's comment for why upfront
    // loading was cut way back. If the player has already tapped to start
    // by the time it's ready, play it then instead of missing it entirely.
    setLoaderBase(this);
    AudioManager.preloadTitle(this);
    if (this.load.list.size > 0) {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        if (this.wantsBgm && this.scene.isActive()) this.audio.playBgm('bgmTitle');
      });
      this.load.start();
    }

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    for (let i = 0; i < 5; i++) {
      const gear = this.add.graphics();
      gear.lineStyle(1, 0x444466);
      gear.strokeCircle(60 + i * 70, 80 + (i % 2) * 20, 12 + i * 2);
      this.tweens.add({ targets: gear, angle: 360, duration: 4000 + i * 500, repeat: -1 });
    }

    this.add.text(GAME_WIDTH / 2, 50, 'GEAR FIGHT', {
      fontSize: '30px',
      color: '#ffffff',
      fontFamily: PIXEL_FONT,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 80, '〜 理（リクツ）で勝つ格闘ゲーム 〜', {
      fontSize: '10px',
      color: '#aaaacc',
      fontFamily: PIXEL_FONT,
    }).setOrigin(0.5);

    const startBtn = this.add.text(GAME_WIDTH / 2, 140, 'タップでスタート', {
      fontSize: '10px',
      color: '#ffdd44',
      fontFamily: PIXEL_FONT,
      backgroundColor: '#333355',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startBtn.on('pointerdown', () => {
      this.audio.unlock();
      this.audio.playSe('select');
      this.audio.stopBgm();
      this.scene.start('ModeSelectScene');
    });

    this.input.keyboard?.once('keydown-SPACE', () => {
      this.audio.unlock();
      this.audio.stopBgm();
      this.scene.start('ModeSelectScene');
    });

    this.input.once('pointerdown', () => {
      this.audio.unlock();
      this.wantsBgm = true;
      this.audio.playBgm('bgmTitle');
    });
  }
}
