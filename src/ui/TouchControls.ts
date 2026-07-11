import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT } from '../config/constants';
import type { InputManager } from '../systems/InputManager';

export class TouchControls {
  private container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private input: InputManager;

  constructor(scene: Phaser.Scene, input: InputManager, side: 'left' | 'right' | 'both') {
    this.scene = scene;
    this.input = input;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(90);
    if (side === 'left' || side === 'both') this.buildSide('p1', 0, GAME_WIDTH / 2);
    if (side === 'right' || side === 'both') this.buildSide('p2', GAME_WIDTH / 2, GAME_WIDTH / 2);
  }

  private buildSide(player: 'p1' | 'p2', offsetX: number, width: number) {
    const cx = offsetX + width * 0.25;
    const cy = GAME_HEIGHT - 50;
    const btnY = GAME_HEIGHT - 28;

    const stick = this.scene.add.circle(cx, cy, 28, 0xffffff, 0.15).setInteractive();
    const knob = this.scene.add.circle(cx, cy, 10, 0xffffff, 0.4);

    let dragX = 0;
    let dragY = 0;

    stick.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragX = p.x - cx;
      dragY = p.y - cy;
    });
    stick.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      dragX = Phaser.Math.Clamp(p.x - cx, -20, 20);
      dragY = Phaser.Math.Clamp(p.y - cy, -20, 20);
      knob.setPosition(cx + dragX, cy + dragY);
      this.applyStick(player, dragX, dragY);
    });
    stick.on('pointerup', () => {
      dragX = 0;
      dragY = 0;
      knob.setPosition(cx, cy);
      this.applyStick(player, 0, 0);
    });

    const buttons: { label: string; x: number; action: () => void }[] = [
      { label: 'A', x: offsetX + width * 0.65, action: () => this.tap(player, 'weak') },
      { label: 'B', x: offsetX + width * 0.78, action: () => this.tap(player, 'strong') },
      { label: '↑G', x: offsetX + width * 0.55, action: () => this.tap(player, 'gearUp') },
      { label: '↓G', x: offsetX + width * 0.45, action: () => this.tap(player, 'gearDown') },
    ];

    buttons.forEach((b) => {
      const btn = this.scene.add.circle(b.x, btnY, 14, 0x3498db, 0.5).setInteractive();
      const label = this.scene.add.text(b.x, btnY, b.label, { fontSize: '10px', color: '#fff', fontFamily: PIXEL_FONT }).setOrigin(0.5);
      btn.on('pointerdown', b.action);
      this.container.add([btn, label]);
    });

    this.container.add([stick, knob]);
  }

  private applyStick(player: 'p1' | 'p2', dx: number, dy: number) {
    this.input.setTouchHold(player, {
      left: dx < -6,
      right: dx > 6,
      up: dy < -6,
      down: dy > 6,
      jump: dy < -12,
    });
  }

  private tap(player: 'p1' | 'p2', action: 'weak' | 'strong' | 'gearUp' | 'gearDown') {
    this.input.triggerTouchButton(player, action);
  }

  setVisible(v: boolean) {
    this.container.setVisible(v);
  }

  destroy() {
    this.container.destroy();
  }
}
