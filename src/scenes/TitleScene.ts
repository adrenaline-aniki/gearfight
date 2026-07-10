import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { AudioManager } from '../systems/AudioManager';

export class TitleScene extends Phaser.Scene {
  private audio!: AudioManager;

  constructor() {
    super('TitleScene');
  }

  create() {
    this.audio = new AudioManager(this);

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
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 78, '〜 理（リクツ）で勝つ格闘ゲーム 〜', {
      fontSize: '8px',
      color: '#aaaacc',
      fontFamily: 'sans-serif',
    }).setOrigin(0.5);

    const startBtn = this.add.text(GAME_WIDTH / 2, 140, 'タップでスタート', {
      fontSize: '12px',
      color: '#ffdd44',
      fontFamily: 'sans-serif',
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
      this.audio.playBgm('bgmTitle');
    });
  }
}
