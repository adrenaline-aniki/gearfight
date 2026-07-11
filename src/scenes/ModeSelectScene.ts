import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT } from '../config/constants';
import { AudioManager } from '../systems/AudioManager';
import { SaveManager } from '../systems/SaveManager';
import { OPENING_DIALOGUE } from '../data/openingDialogue';
import { FINAL_CHAPTER_INTRO, FINAL_CHAPTER_VICTORY } from '../data/finalChapterDialogue';
import { TUTORIAL_INTRO } from '../data/tutorialDialogue';
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

    this.add.text(GAME_WIDTH / 2, 13, 'モード選択', {
      fontSize: '20px', color: '#fff', fontFamily: PIXEL_FONT, fontStyle: 'bold',
    }).setOrigin(0.5);

    const save = SaveManager.load();
    const toBattle = (config: BattleConfig) => () => this.scene.start('BattleScene', config);
    const toBattleWithIntro = (introLines: typeof OPENING_DIALOGUE, config: BattleConfig) => () =>
      this.scene.start('DialogueScene', { lines: introLines, nextScene: 'BattleScene', nextData: config });
    const modes: { label: string; color?: string; action: () => void }[] = [
      {
        label: 'オープニング（物語の冒頭）', color: '#ffdd44',
        action: () => this.scene.start('DialogueScene', { lines: OPENING_DIALOGUE, nextScene: 'ModeSelectScene' }),
      },
      { label: 'ガレージ（パーツ換装）', color: '#88ddff', action: () => this.scene.start('GarageScene') },
      {
        label: 'チュートリアル（第0章）',
        action: toBattleWithIntro(TUTORIAL_INTRO, { mode: 'tutorial', player1: 'hajime', player2: 'kakashi', roundTime: 90, roundsToWin: 1, tutorialStep: 1, assistMode: save.assistMode }),
      },
      { label: 'ストーリー（第1章 vs ソニカ）', action: toBattle({ mode: 'story', player1: 'hajime', player2: 'wizel', roundTime: 45, roundsToWin: 2, assistMode: save.assistMode }) },
      { label: 'ストーリー（第2章 vs ゴウケン）', action: toBattle({ mode: 'story', player1: 'hajime', player2: 'ganrock', roundTime: 45, roundsToWin: 2, assistMode: save.assistMode }) },
      { label: 'ストーリー（第3章 vs リン）', action: toBattle({ mode: 'story', player1: 'hajime', player2: 'drift', roundTime: 45, roundsToWin: 2, assistMode: save.assistMode }) },
      { label: 'ストーリー（第4章 vs カメイ）', action: toBattle({ mode: 'story', player1: 'hajime', player2: 'aegis', roundTime: 45, roundsToWin: 2, assistMode: save.assistMode }) },
      { label: 'ストーリー（第5章 vs カイ）', action: toBattle({ mode: 'story', player1: 'hajime', player2: 'theorion', roundTime: 45, roundsToWin: 2, assistMode: save.assistMode }) },
      {
        label: '最終章（vs オメガノヴァ）',
        action: toBattleWithIntro(FINAL_CHAPTER_INTRO, {
          mode: 'story', player1: 'hajime', player2: 'omeganova', roundTime: 60, roundsToWin: 2,
          assistMode: save.assistMode, postWinDialogue: FINAL_CHAPTER_VICTORY,
        }),
      },
      { label: '隠しボス（vs ソフィス・レギオン）', action: toBattle({ mode: 'story', player1: 'hajime', player2: 'sophislegion', roundTime: 60, roundsToWin: 2, assistMode: save.assistMode }) },
      { label: 'フリー対戦（vs CPU）', action: toBattle({ mode: 'free', player1: 'hajime', player2: 'wizel', roundTime: 60, roundsToWin: 1, assistMode: save.assistMode }) },
    ];

    modes.forEach((m, i) => {
      const y = 33 + i * 12;
      const btn = this.add.text(GAME_WIDTH / 2, y, m.label, {
        fontSize: '10px', color: m.color ?? '#fff', fontFamily: PIXEL_FONT,
        backgroundColor: '#2c3e6e', padding: { x: 10, y: 1 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.audio.playSe('select');
        m.action();
      });
    });

    this.assistText = this.add.text(GAME_WIDTH / 2, 180, `アシストモード: ${save.assistMode ? 'ON' : 'OFF'}`, {
      fontSize: '10px', color: '#88ff88', fontFamily: PIXEL_FONT,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.assistText.on('pointerdown', () => {
      const s = SaveManager.load();
      SaveManager.save({ assistMode: !s.assistMode });
      this.assistText.setText(`アシストモード: ${!s.assistMode ? 'ON' : 'OFF'}`);
      this.audio.playSe('select');
    });

    const back = this.add.text(8, GAME_HEIGHT - 14, '← タイトル', {
      fontSize: '10px', color: '#aaa', fontFamily: PIXEL_FONT,
    }).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('TitleScene'));
  }
}
