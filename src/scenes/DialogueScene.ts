import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT } from '../config/constants';
import { AudioManager } from '../systems/AudioManager';
import { loadFighterIdle, loadPortraits, setLoaderBase } from '../systems/AssetPaths';
import type { DialogueLine } from '../types/game';

interface DialogueSceneData {
  lines: DialogueLine[];
  /** Omit when paired with resumeScene - resumes that scene instead of starting a new one. */
  nextScene?: string;
  nextData?: Record<string, unknown>;
  /**
   * Skips the opaque cutscene chrome (full-screen fill, decorative circle/
   * border) so a scene paused underneath (via scene.launch(), not started)
   * stays visible - for mid-battle narration (tutorial HUD explanations)
   * where the player needs to actually see what's being pointed at.
   */
  overlay?: boolean;
  /** Overlay mode with no nextScene: resume this paused scene on finish. */
  resumeScene?: string;
}

const SPEAKER_COLORS: Record<string, string> = {
  '父さん': '#ffdd44',
  '主人公': '#66ccff',
  'ノギ先生': '#7fd9c4',
  'ソニカ': '#ff8866',
  'ゴウケン': '#dd8833',
  'リン': '#88cc55',
  'カメイ': '#8899dd',
  'カイ': '#cccccc',
  '謎の青年': '#999999',
  'レイ': '#8866ff',
};

// Speaker name -> portrait character id (see PORTRAIT_EMOTION_IDS/PORTRAIT_FLAT_IDS
// in constants.ts). Speakers without an entry (narration) just show no face icon.
const SPEAKER_CHARACTER: Record<string, string> = {
  '父さん': 'takumi',
  'ノギ先生': 'nogi',
  '主人公': 'hajime',
  'ソニカ': 'wizel',
  'ゴウケン': 'ganrock',
  'リン': 'drift',
  'カメイ': 'aegis',
  'カイ': 'theorion',
  '謎の青年': 'omeganova',
  'レイ': 'omeganova',
};

// Enlarged from the original 42x32 box/portrait - the portrait was too
// small to make out faces clearly once it stopped ballooning past the box.
const PORTRAIT_X = 34;
const PORTRAIT_WIDTH = 52;
const PORTRAIT_HEIGHT = 48;
const TEXT_X = 68;
const BOX_HEIGHT = 60;

// Generic tap-to-advance dialogue player, reused for the story prologue and
// future chapter-intro demos (spec §5.2 "章開始デモ"). Content lives in
// src/data/*.ts as DialogueLine[]; this scene only knows how to play it back.
export class DialogueScene extends Phaser.Scene {
  private audio!: AudioManager;
  private lines: DialogueLine[] = [];
  private nextScene?: string;
  private nextData?: Record<string, unknown>;
  private overlay = false;
  private resumeScene?: string;
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
    this.overlay = data.overlay ?? false;
    this.resumeScene = data.resumeScene;
    this.index = 0;
    this.finished = false;
  }

  preload() {
    setLoaderBase(this);
    loadFighterIdle(this, 'hajime');
    const charIds = new Set<string>();
    for (const line of this.lines) {
      const charId = SPEAKER_CHARACTER[line.speaker];
      if (charId) charIds.add(charId);
    }
    for (const charId of charIds) loadPortraits(this, charId);
  }

  create() {
    this.audio = new AudioManager(this);
    this.audio.unlock();

    // Overlay mode (launched on top of a paused scene, e.g. mid-battle
    // tutorial narration) skips the opaque cutscene chrome entirely - the
    // whole point is that the player can still see the paused game/HUD
    // behind the dialogue box while Nogi-sensei describes it.
    if (!this.overlay) {
      const bg = this.add.graphics();
      bg.fillStyle(0x1a1628);
      bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      bg.fillStyle(0x120e1c);
      bg.fillRect(0, GAME_HEIGHT - 56, GAME_WIDTH, 56);
      bg.fillStyle(0x4a4028, 0.35);
      bg.fillCircle(GAME_WIDTH / 2, 26, 26);
      bg.lineStyle(1, 0x3a3050);
      bg.strokeRect(70, 36, GAME_WIDTH - 140, GAME_HEIGHT - 100);
    }

    // Created (but invisible) even in overlay mode - only the story-specific
    // reveal-hajime/awaken-hajime effects use it, which overlay dialogues
    // (tutorial narration) never do, but showLine() references it unconditionally.
    this.hajimePortrait = this.add.image(GAME_WIDTH / 2, 108, 'hajime_idle')
      .setOrigin(0.5, 1)
      .setScale(0.6)
      .setAlpha(0)
      .setTint(0x777766);

    const boxY = GAME_HEIGHT - BOX_HEIGHT / 2 - 24;
    this.add.rectangle(GAME_WIDTH / 2, boxY, GAME_WIDTH - 12, BOX_HEIGHT, 0x0d0d1a, 0.92)
      .setStrokeStyle(1, 0x4a4a6e);

    // Placeholder texture only - always loaded regardless of this dialogue's
    // speakers (see preload()), and hidden until showLine() sets the real one.
    this.speakerPortrait = this.add.image(PORTRAIT_X, boxY, 'hajime_idle')
      .setDisplaySize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT)
      .setVisible(false);

    this.nameText = this.add.text(TEXT_X, boxY - 26, '', {
      fontSize: '10px', color: '#ffdd44', fontFamily: PIXEL_FONT, fontStyle: 'bold',
    });

    this.bodyText = this.add.text(TEXT_X, boxY - 11, '', {
      fontSize: '10px', color: '#ffffff', fontFamily: PIXEL_FONT,
      wordWrap: { width: GAME_WIDTH - 14 - TEXT_X, useAdvancedWrap: true },
      lineSpacing: 4,
    });

    this.promptText = this.add.text(GAME_WIDTH - 14, boxY + 23, '▼', {
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

    const charId = SPEAKER_CHARACTER[line.speaker];
    if (charId) {
      // setTexture() doesn't preserve a previous setDisplaySize() - it keeps
      // the old scale factor, which was computed against a different-sized
      // frame, so it must be reapplied every time the texture changes or the
      // portrait balloons to whatever size that stale scale happens to produce
      // on the new (much larger, native-resolution) portrait frame.
      this.speakerPortrait.setTexture(this.resolvePortraitKey(charId, line.emotion))
        .setDisplaySize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT)
        .setVisible(true);
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

  private resolvePortraitKey(charId: string, emotion?: string): string {
    const withEmotion = `portrait_${charId}_${emotion ?? 'normal'}`;
    return this.textures.exists(withEmotion) ? withEmotion : `portrait_${charId}`;
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
    if (this.nextScene) {
      this.scene.start(this.nextScene, this.nextData);
    } else if (this.resumeScene) {
      // Overlay mode with nothing new to transition to - hand control back
      // to whatever scene was paused underneath (see BattleScene's tutorial
      // intro, which just wants to continue the same fight, not restart it).
      this.scene.stop();
      this.scene.resume(this.resumeScene);
    } else {
      this.scene.start('ModeSelectScene');
    }
  }
}
