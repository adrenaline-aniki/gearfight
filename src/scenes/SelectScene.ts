import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, PIXEL_FONT } from '../config/constants';
import { ROSTER } from '../combat/roster';
import type { MatchConfig } from './TrainingScene';

// GEAR FIGHT — character / mode select (new engine).
//
// The front door to the real game: pick a mode (ひとり=arcade CPU ladder, 対戦=
// local 2P) and each side's character, then launch the match. Deliberately light
// (color-coded cards + type blurb, no rig instancing) so it stays snappy.

type Mode = 'arcade' | 'versus';

const TYPE_COLOR: Record<string, number> = { hajime: 0x7ad0ff, wizel: 0x6affc8, ganrock: 0xffa24a };

export class SelectScene extends Phaser.Scene {
  private mode: Mode = 'arcade';
  private p1 = 0;   // roster index
  private p2 = 1;
  private modeBtns: Phaser.GameObjects.Text[] = [];
  private p1Name!: Phaser.GameObjects.Text;
  private p2Name!: Phaser.GameObjects.Text;
  private p1Blurb!: Phaser.GameObjects.Text;
  private p2Blurb!: Phaser.GameObjects.Text;
  private p1Dot!: Phaser.GameObjects.Graphics;
  private p2Dot!: Phaser.GameObjects.Graphics;
  private p2Panel!: Phaser.GameObjects.Container;
  private cpuLabel!: Phaser.GameObjects.Text;

  constructor() { super('SelectScene'); }

  create() {
    this.cameras.main.setBackgroundColor('#0d1420');
    this.add.text(GAME_WIDTH / 2, 6, 'キャラクター選択', {
      fontFamily: PIXEL_FONT, fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setResolution(2);

    // mode toggle
    const mk = (x: number, label: string, m: Mode) => {
      const t = this.add.text(x, 30, label, {
        fontFamily: PIXEL_FONT, fontSize: '10px', color: '#8899aa', backgroundColor: '#26303e', padding: { x: 8, y: 2 },
      }).setOrigin(0.5, 0).setResolution(2).setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => { this.mode = m; this.refresh(); });
      this.modeBtns.push(t);
      return t;
    };
    mk(GAME_WIDTH / 2 - 60, 'ひとり (アーケード)', 'arcade');
    mk(GAME_WIDTH / 2 + 60, '対戦 (2P)', 'versus');

    // P1 panel (left)
    this.buildPicker(70, 'P1', 'left');
    // P2 panel (right)
    this.buildPicker(GAME_WIDTH - 70, 'P2', 'right');

    // START / back
    const start = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 48, '▶ はじめる', {
      fontFamily: PIXEL_FONT, fontSize: '20px', color: '#eaffe0', backgroundColor: '#2c6', padding: { x: 10, y: 3 },
    }).setOrigin(0.5, 0).setResolution(2).setInteractive({ useHandCursor: true });
    start.on('pointerover', () => start.setScale(1.06));
    start.on('pointerout', () => start.setScale(1));
    start.on('pointerdown', () => this.launch());

    this.add.text(4, 4, '← 戻る', { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#aabbcc' })
      .setResolution(2).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('ModeSelectScene'));

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 8,
      'P1: A/D で選択 ｜ P2: ←/→ ｜ M でモード ｜ Enter で開始', {
      fontFamily: PIXEL_FONT, fontSize: '10px', color: '#556677',
    }).setOrigin(0.5, 1).setResolution(2);

    // keyboard
    const kb = this.input.keyboard;
    kb?.on('keydown-A', () => { this.p1 = (this.p1 + ROSTER.length - 1) % ROSTER.length; this.refresh(); });
    kb?.on('keydown-D', () => { this.p1 = (this.p1 + 1) % ROSTER.length; this.refresh(); });
    kb?.on('keydown-LEFT', () => { this.p2 = (this.p2 + ROSTER.length - 1) % ROSTER.length; this.refresh(); });
    kb?.on('keydown-RIGHT', () => { this.p2 = (this.p2 + 1) % ROSTER.length; this.refresh(); });
    kb?.on('keydown-M', () => { this.mode = this.mode === 'arcade' ? 'versus' : 'arcade'; this.refresh(); });
    kb?.on('keydown-ENTER', () => this.launch());
    kb?.on('keydown-ESC', () => this.scene.start('ModeSelectScene'));

    // Defer the first refresh one tick: mutating a Text's style (setColor/setText)
    // in the same frame it was created, before its first render, throws a null-
    // texture error in this Phaser build. After one render tick it's safe.
    this.time.delayedCall(0, () => this.refresh());
  }

  private buildPicker(cx: number, tag: string, side: 'left' | 'right') {
    this.add.text(cx, 48, tag, { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#8899aa' }).setOrigin(0.5, 0).setResolution(2);
    const left = this.add.text(cx - 46, 66, '◀', { fontFamily: PIXEL_FONT, fontSize: '20px', color: '#fff' })
      .setOrigin(0.5).setResolution(2).setInteractive({ useHandCursor: true });
    const right = this.add.text(cx + 46, 66, '▶', { fontFamily: PIXEL_FONT, fontSize: '20px', color: '#fff' })
      .setOrigin(0.5).setResolution(2).setInteractive({ useHandCursor: true });
    const step = (d: number) => {
      if (side === 'left') this.p1 = (this.p1 + ROSTER.length + d) % ROSTER.length;
      else this.p2 = (this.p2 + ROSTER.length + d) % ROSTER.length;
      this.refresh();
    };
    left.on('pointerdown', () => step(-1));
    right.on('pointerdown', () => step(1));

    const dot = this.add.graphics();
    const name = this.add.text(cx, 60, '', { fontFamily: PIXEL_FONT, fontSize: '20px', color: '#fff', fontStyle: 'bold' })
      .setOrigin(0.5, 0).setResolution(2);
    const blurb = this.add.text(cx, 90, '', { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#cdd8e6', align: 'center' })
      .setOrigin(0.5, 0).setResolution(2).setWordWrapWidth(150, true);

    if (side === 'left') { this.p1Name = name; this.p1Blurb = blurb; this.p1Dot = dot; }
    else {
      this.p2Name = name; this.p2Blurb = blurb; this.p2Dot = dot;
      // arcade overlay: hide the P2 picker and show "CPU ladder" instead.
      this.p2Panel = this.add.container(0, 0, [left, right]);
      this.cpuLabel = this.add.text(cx, 66, 'CPU 勝ち抜き\n(全員撃破せよ)', {
        fontFamily: PIXEL_FONT, fontSize: '10px', color: '#ffcc66', align: 'center', fontStyle: 'bold',
      }).setOrigin(0.5).setResolution(2);
    }
  }

  private refresh() {
    for (const b of this.modeBtns) {
      const active = (b.text.startsWith('ひとり') && this.mode === 'arcade') || (b.text.startsWith('対戦') && this.mode === 'versus');
      // NB: avoid setBackgroundColor at runtime (Phaser crashes rebuilding the text
      // texture before its first render). Indicate state with colour + scale.
      b.setColor(active ? '#eaffe0' : '#8899aa');
      b.setScale(active ? 1.05 : 1);
    }
    const e1 = ROSTER[this.p1];
    this.p1Name.setText(e1.name);
    this.p1Blurb.setText(e1.blurb);
    this.p1Dot.clear().fillStyle(TYPE_COLOR[e1.id] ?? 0xffffff, 1).fillCircle(this.p1Name.x, 84, 4);

    const arcade = this.mode === 'arcade';
    // In arcade, P2 is the ladder; hide the P2 picker and its card.
    this.p2Panel.setVisible(!arcade);
    this.cpuLabel.setVisible(arcade);
    this.p2Name.setVisible(!arcade);
    this.p2Blurb.setVisible(!arcade);
    this.p2Dot.setVisible(!arcade);
    if (!arcade) {
      const e2 = ROSTER[this.p2];
      this.p2Name.setText(e2.name);
      this.p2Blurb.setText(e2.blurb);
      this.p2Dot.clear().fillStyle(TYPE_COLOR[e2.id] ?? 0xffffff, 1).fillCircle(this.p2Name.x, 84, 4);
    }
  }

  private launch() {
    const cfg: MatchConfig = this.mode === 'arcade'
      ? { mode: 'arcade', p1: ROSTER[this.p1].id, from: 'SelectScene' }
      : { mode: 'versus', p1: ROSTER[this.p1].id, p2: ROSTER[this.p2].id, p2human: true, from: 'SelectScene' };
    this.scene.start('TrainingScene', { config: cfg });
  }
}
