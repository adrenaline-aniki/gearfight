import Phaser from 'phaser';
import { GEAR_TABLE, GAME_WIDTH } from '../config/constants';
import type { Fighter } from '../entities/Fighter';
import type { TheoryBonusEvent } from '../types/game';

export class BattleHUD {
  private container: Phaser.GameObjects.Container;
  private p1HpBar!: Phaser.GameObjects.Graphics;
  private p2HpBar!: Phaser.GameObjects.Graphics;
  private heatBar!: Phaser.GameObjects.Graphics;
  private superBar!: Phaser.GameObjects.Graphics;
  private gearText!: Phaser.GameObjects.Text;
  private ratioText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private theoryText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private meshGlow!: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(100);
    this.build();
  }

  private build() {
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.5);
    bg.fillRect(0, 0, GAME_WIDTH, 22);
    this.container.add(bg);

    this.p1HpBar = this.scene.add.graphics();
    this.p2HpBar = this.scene.add.graphics();
    this.heatBar = this.scene.add.graphics();
    this.superBar = this.scene.add.graphics();
    this.meshGlow = this.scene.add.graphics();

    this.gearText = this.scene.add.text(8, 24, '', { fontSize: '8px', color: '#fff', fontFamily: 'monospace' });
    this.ratioText = this.scene.add.text(8, 34, '', { fontSize: '7px', color: '#aaa', fontFamily: 'monospace' });
    this.timerText = this.scene.add.text(GAME_WIDTH / 2, 4, '', { fontSize: '10px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5, 0);
    this.theoryText = this.scene.add.text(GAME_WIDTH - 8, 24, '', { fontSize: '7px', color: '#ffdd44', fontFamily: 'monospace' }).setOrigin(1, 0);
    this.hintText = this.scene.add.text(GAME_WIDTH / 2, 50, '', { fontSize: '8px', color: '#88ff88', fontFamily: 'sans-serif', align: 'center', wordWrap: { width: 340 } }).setOrigin(0.5, 0);

    this.container.add([
      this.p1HpBar, this.p2HpBar, this.heatBar, this.superBar, this.meshGlow,
      this.gearText, this.ratioText, this.timerText, this.theoryText, this.hintText,
    ]);
  }

  update(p1: Fighter, p2: Fighter, timeLeft: number, theoryCount: number, hint = '') {
    this.drawHpBar(this.p1HpBar, 8, 6, 140, 8, p1.hp, p1.maxHp, 0x3498db);
    this.drawHpBar(this.p2HpBar, GAME_WIDTH - 148, 6, 140, 8, p2.hp, p2.maxHp, 0xe74c3c);

    const gear = GEAR_TABLE[p1.gear];
    this.gearText.setText(`GL${p1.gear}  ${gear.teeth}`);
    this.ratioText.setText(`比 = ${gear.ratio}  SPD×${gear.speedMul} DMG×${gear.damageMul}`);

    this.heatBar.clear();
    const heatColor = p1.heat > 85 ? 0xff0000 : p1.heat > 60 ? 0xffaa00 : 0x44aa44;
    this.heatBar.fillStyle(0x333333);
    this.heatBar.fillRect(8, 44, 60, 4);
    this.heatBar.fillStyle(heatColor);
    this.heatBar.fillRect(8, 44, 60 * (p1.heat / 100), 4);

    this.superBar.clear();
    this.superBar.fillStyle(0x333333);
    this.superBar.fillRect(72, 44, 40, 4);
    this.superBar.fillStyle(0xffdd00);
    this.superBar.fillRect(72, 44, 40 * (p1.superGauge / 100), 4);

    const mins = Math.floor(timeLeft / 60);
    const secs = Math.floor(timeLeft % 60);
    this.timerText.setText(`${mins}:${secs.toString().padStart(2, '0')}`);
    this.theoryText.setText(theoryCount > 0 ? `THEORY ${theoryCount}` : '');
    this.hintText.setText(hint);

    this.meshGlow.clear();
    if (p1.state === 'shift' && p1.shiftPerfectWindow) {
      this.meshGlow.fillStyle(0xffff00, 0.6);
      this.meshGlow.fillCircle(30, 30, 6);
    }
  }

  showTheoryBonus(event: TheoryBonusEvent) {
    const popup = this.scene.add.text(GAME_WIDTH / 2, 80, `THEORY BONUS!\n${event.label}`, {
      fontSize: '10px',
      color: '#ffdd44',
      fontFamily: 'sans-serif',
      align: 'center',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 4 },
    }).setOrigin(0.5).setDepth(200);

    this.scene.tweens.add({
      targets: popup,
      y: 60,
      alpha: 0,
      duration: 1500,
      onComplete: () => popup.destroy(),
    });
  }

  private drawHpBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, hp: number, max: number, color: number) {
    g.clear();
    g.fillStyle(0x333333);
    g.fillRect(x, y, w, h);
    g.fillStyle(color);
    g.fillRect(x, y, w * (hp / max), h);
  }

  destroy() {
    this.container.destroy();
  }
}
