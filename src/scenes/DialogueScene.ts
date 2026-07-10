import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT } from '../config/constants';
import { AudioManager } from '../systems/AudioManager';
import type { DialogueLine } from '../types/game';

interface DialogueSceneData {
  lines: DialogueLine[];
  nextScene: string;
  nextData?: Record<string, unknown>;
}

const SPEAKER_COLORS: Record<string, string> = {
  '父さん': '#ffdd44',
  '主人公': '#66ccff',
  'ノギ先生': '#ff99cc',
};

// Speaker name -> preloaded portrait texture key (see BootScene). Speakers
// without an entry (narration, 主人公) just show no face icon.
const SPEAKER_PORTRAITS: Record<string, string> = {
  '父さん': 'portrait_takumi',
  'ノギ先生': 'portrait_nogi',
};

const PORTRAIT_X = 24;
const PORTRAIT_WIDTH = 28;
const TEXT_X = 46;

// Generic tap-to-advance dialogue player, reused for the story prologue and
// future chapter-intro demos (spec §5.2 "章開始デモ"). Content lives in
// src/data/*.ts as DialogueLine[]; this scene only knows how to play it back.
export class DialogueScene extends Phaser.Scene {
  private audio!: AudioManager;
  private lines: DialogueLine[] = [];
  private nextScene = 'ModeSelectScene';
  private nextData?: Record<string, unknown>;
  private index = 0;

  private nameText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private hajimePortrait!: Phaser.GameObjects.Image;
  private speakerPortrait!: Phaser.GameObjects.Image;
  private finished = false;

  constructor() {
    super('DialogueScene');
  }

  init(data: DialogueSceneData) {
    this.lines = data.lines;
    this.nextScene = data.nextScene;
    this.nextData = data.nextData;
    this.index = 0;
    this.finished = false;
  }

  create() {
    this.audio = new AudioManager(this);
    this.audio.unlock();

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1628);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fillStyle(0x120e1c);
    bg.fillRect(0, GAME_HEIGHT - 56, GAME_WIDTH, 56);
    bg.fillStyle(0x4a4028, 0.35);
    bg.fillCircle(GAME_WIDTH / 2, 26, 26);
    bg.lineStyle(1, 0x3a3050);
    bg.strokeRect(70, 36, GAME_WIDTH - 140, GAME_HEIGHT - 100);

    this.hajimePortrait = this.add.image(GAME_WIDTH / 2, 108, 'hajime_idle')
      .setOrigin(0.5, 1)
      .setScale(0.6)
      .setAlpha(0)
      .setTint(0x777766);

    const boxY = GAME_HEIGHT - 46;
    this.add.rectangle(GAME_WIDTH / 2, boxY, GAME_WIDTH - 12, 44, 0x0d0d1a, 0.92)
      .setStrokeStyle(1, 0x4a4a6e);

    this.speakerPortrait = this.add.image(PORTRAIT_X, boxY, 'portrait_takumi')
      .setDisplaySize(PORTRAIT_WIDTH, 40)
      .setVisible(false);

    this.nameText = this.add.text(TEXT_X, boxY - 20, '', {
      fontSize: '10px', color: '#ffdd44', fontFamily: PIXEL_FONT, fontStyle: 'bold',
    });

    this.bodyText = this.add.text(TEXT_X, boxY - 7, '', {
      fontSize: '10px', color: '#ffffff', fontFamily: PIXEL_FONT,
      wordWrap: { width: GAME_WIDTH - 14 - TEXT_X, useAdvancedWrap: true },
      lineSpacing: 4,
    });

    this.promptText = this.add.text(GAME_WIDTH - 14, boxY + 15, '▼', {
      fontSize: '10px', color: '#aaaaaa', fontFamily: PIXEL_FONT,
    }).setOrigin(1, 0.5);
    this.tweens.add({ targets: this.promptText, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });

    const skip = this.add.text(GAME_WIDTH - 8, 8, 'スキップ ▶', {
      fontSize: '10px', color: '#888888', fontFamily: PIXEL_FONT,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    skip.on('pointerdown', () => this.finish());

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < 20 && pointer.x > GAME_WIDTH - 70) return;
      this.advance();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());

    this.showLine();
  }

  private showLine() {
    const line = this.lines[this.index];
    this.nameText.setText(line.speaker);
    this.nameText.setColor(SPEAKER_COLORS[line.speaker] ?? '#ffdd44');
    this.bodyText.setText(line.text);

    const portraitKey = SPEAKER_PORTRAITS[line.speaker];
    if (portraitKey) {
      this.speakerPortrait.setTexture(portraitKey).setVisible(true);
      this.nameText.setX(TEXT_X);
      this.bodyText.setX(TEXT_X);
      this.bodyText.setWordWrapWidth(GAME_WIDTH - 14 - TEXT_X, true);
    } else {
      this.speakerPortrait.setVisible(false);
      this.nameText.setX(14);
      this.bodyText.setX(14);
      this.bodyText.setWordWrapWidth(GAME_WIDTH - 28, true);
    }

    if (line.effect === 'reveal-hajime') {
      this.tweens.add({ targets: this.hajimePortrait, alpha: 1, duration: 700 });
    } else if (line.effect === 'awaken-hajime') {
      this.hajimePortrait.setTint(0xffffff);
      this.tweens.add({
        targets: this.hajimePortrait, alpha: 1, duration: 200, yoyo: true, repeat: 1,
        onComplete: () => this.hajimePortrait.setTint(0xaaaa99),
      });
    }
  }

  private advance() {
    if (this.finished) return;
    this.audio.playSe('select');
    this.index++;
    if (this.index >= this.lines.length) {
      this.finish();
      return;
    }
    this.showLine();
  }

  private finish() {
    if (this.finished) return;
    this.finished = true;
    this.scene.start(this.nextScene, this.nextData);
  }
}
