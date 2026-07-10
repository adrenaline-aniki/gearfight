import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { AudioManager } from '../systems/AudioManager';
import { SaveManager } from '../systems/SaveManager';
import type { BattleConfig } from '../types/game';

export class ModeSelectScene extends Phaser.Scene {
  private audio!: AudioManager;
  private assistText!: Phaser.GameObjects.Text;

  constructor() {
    super('ModeSelectScene');
  }

  create() {
    this.audio = new AudioManager(this);
    this.audio.unlock();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1a2e);

    this.add.text(GAME_WIDTH / 2, 16, 'モード選択', {
      fontSize: '14px', color: '#fff', fontFamily: 'sans-serif',
    }).setOrigin(0.5);

    const save = SaveManager.load();
    const modes: { label: string; config: BattleConfig }[] = [
      { label: 'チュートリアル（第0章）', config: { mode: 'tutorial', player1: 'hajime', player2: 'kakashi', roundTime: 90, roundsToWin: 1, tutorialStep: 1, assistMode: save.assistMode } },
      { label: 'ストーリー（第1章 vs ソニカ）', config: { mode: 'story', player1: 'hajime', player2: 'wizel', roundTime: 45, roundsToWin: 2, assistMode: save.assistMode } },
      { label: 'ストーリー（第2章 vs ゴウケン）', config: { mode: 'story', player1: 'hajime', player2: 'ganrock', roundTime: 45, roundsToWin: 2, assistMode: save.assistMode } },
      { label: 'ストーリー（第3章 vs リン）', config: { mode: 'story', player1: 'hajime', player2: 'drift', roundTime: 45, roundsToWin: 2, assistMode: save.assistMode } },
      { label: 'ストーリー（第4章 vs カメイ）', config: { mode: 'story', player1: 'hajime', player2: 'aegis', roundTime: 45, roundsToWin: 2, assistMode: save.assistMode } },
      { label: 'ストーリー（第5章 vs カイ）', config: { mode: 'story', player1: 'hajime', player2: 'theorion', roundTime: 45, roundsToWin: 2, assistMode: save.assistMode } },
      { label: '最終章（vs オメガノヴァ）', config: { mode: 'story', player1: 'hajime', player2: 'omeganova', roundTime: 60, roundsToWin: 2, assistMode: save.assistMode } },
      { label: '隠しボス（vs ソフィス・レギオン）', config: { mode: 'story', player1: 'hajime', player2: 'sophislegion', roundTime: 60, roundsToWin: 2, assistMode: save.assistMode } },
      { label: '教室モード（2P対戦）', config: { mode: 'classroom', player1: 'hajime', player2: 'hajime', roundTime: 60, roundsToWin: 1, assistMode: save.assistMode } },
      { label: 'フリー対戦（vs CPU）', config: { mode: 'free', player1: 'hajime', player2: 'wizel', roundTime: 60, roundsToWin: 1, assistMode: save.assistMode } },
    ];

    modes.forEach((m, i) => {
      const y = 30 + i * 14;
      const btn = this.add.text(GAME_WIDTH / 2, y, m.label, {
        fontSize: '8px', color: '#fff', fontFamily: 'sans-serif',
        backgroundColor: '#2c3e6e', padding: { x: 10, y: 2 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.audio.playSe('select');
        this.scene.start('BattleScene', m.config);
      });
    });

    this.assistText = this.add.text(GAME_WIDTH / 2, 178, `アシストモード: ${save.assistMode ? 'ON' : 'OFF'}`, {
      fontSize: '9px', color: '#88ff88', fontFamily: 'sans-serif',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.assistText.on('pointerdown', () => {
      const s = SaveManager.load();
      SaveManager.save({ assistMode: !s.assistMode });
      this.assistText.setText(`アシストモード: ${!s.assistMode ? 'ON' : 'OFF'}`);
      this.audio.playSe('select');
    });

    const back = this.add.text(8, GAME_HEIGHT - 14, '← タイトル', {
      fontSize: '8px', color: '#aaa', fontFamily: 'sans-serif',
    }).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('TitleScene'));
  }
}
