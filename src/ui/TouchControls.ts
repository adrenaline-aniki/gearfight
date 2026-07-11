import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT } from '../config/constants';
import type { GearLevel } from '../config/constants';
import type { InputManager } from '../systems/InputManager';

const GEAR_LEVELS: GearLevel[] = [1, 2, 3, 4, 5];

// Solo (P1-only) touch layout, using the whole screen width: stick on the
// near edge, buttons on the far edge, like a real 2-thumb mobile layout.
export class TouchControls {
  private container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private input: InputManager;
  private shifterNotches: Phaser.GameObjects.Arc[] = [];
  private shifterHandle!: Phaser.GameObjects.Rectangle;
  private shifterY!: { top: number; bottom: number };

  constructor(scene: Phaser.Scene, input: InputManager) {
    this.scene = scene;
    this.input = input;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(90);

    const cx = GAME_WIDTH * 0.15;
    const cy = GAME_HEIGHT - 48;

    const stick = this.scene.add.circle(cx, cy, 26, 0xffffff, 0.15).setInteractive();
    const knob = this.scene.add.circle(cx, cy, 10, 0xffffff, 0.4);

    stick.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const dx = Phaser.Math.Clamp(p.x - cx, -20, 20);
      const dy = Phaser.Math.Clamp(p.y - cy, -20, 20);
      knob.setPosition(cx + dx, cy + dy);
      this.applyStick(dx, dy);
    });
    stick.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const dx = Phaser.Math.Clamp(p.x - cx, -20, 20);
      const dy = Phaser.Math.Clamp(p.y - cy, -20, 20);
      knob.setPosition(cx + dx, cy + dy);
      this.applyStick(dx, dy);
    });
    stick.on('pointerup', () => {
      knob.setPosition(cx, cy);
      this.applyStick(0, 0);
    });

    this.buildGearShifter(GAME_WIDTH * 0.44);
    this.buildActionButtons();

    this.container.add([stick, knob]);
  }

  // A vertical car-gearstick-style widget: 5 notches for GL1 (bottom) to
  // GL5 (top). Tapping a notch steps one gear toward it - it does not jump
  // straight there - so the existing one-gear-at-a-time shift minigame and
  // its mid-shift vulnerability are preserved; this is just a friendlier
  // input for "up" / "down" than two small, easy-to-mix-up +/- buttons.
  private buildGearShifter(x: number) {
    const top = 118;
    const bottom = 198;
    this.shifterY = { top, bottom };

    const rail = this.scene.add.rectangle(x, (top + bottom) / 2, 4, bottom - top, 0xffffff, 0.25);
    this.container.add(rail);

    const notches: Phaser.GameObjects.Arc[] = [];
    GEAR_LEVELS.forEach((gl, i) => {
      // GL1 at the bottom, GL5 at the top - shifting up moves the lever up.
      const y = bottom - (i / (GEAR_LEVELS.length - 1)) * (bottom - top);
      const notch = this.scene.add.circle(x, y, 8, 0x3498db, 0.35).setInteractive({ useHandCursor: true });
      const label = this.scene.add.text(x + 16, y, `${gl}`, {
        fontSize: '10px', color: '#aaaacc', fontFamily: PIXEL_FONT,
      }).setOrigin(0.5);
      notch.on('pointerdown', () => this.shiftToward(gl));
      notches.push(notch);
      this.container.add([notch, label]);
    });
    this.shifterNotches = notches;

    const handle = this.scene.add.rectangle(x, bottom, 20, 10, 0xffdd44, 0.9)
      .setInteractive({ useHandCursor: true, draggable: true });
    this.container.add(handle);
    this.shifterHandle = handle;

    // Swipe the lever directly instead of only tapping a notch - dragging
    // snaps the handle to the nearest notch and fires shiftToward() whenever
    // that nearest notch changes, so a fast swipe steps one gear at a time
    // just like repeated taps would (no skipping straight to GL5).
    let lastDragGear: GearLevel | null = null;
    handle.on('dragstart', () => {
      const index = notches.findIndex((n) => n.getData('current'));
      lastDragGear = index >= 0 ? GEAR_LEVELS[index] : 3;
    });
    handle.on('drag', (_p: Phaser.Input.Pointer, _dx: number, dragY: number) => {
      const clampedY = Phaser.Math.Clamp(dragY, top, bottom);
      handle.setPosition(x, clampedY);
      const nearestIndex = Math.round(((bottom - clampedY) / (bottom - top)) * (GEAR_LEVELS.length - 1));
      const nearestGear = GEAR_LEVELS[Phaser.Math.Clamp(nearestIndex, 0, GEAR_LEVELS.length - 1)];
      if (nearestGear !== lastDragGear) {
        this.shiftToward(nearestGear);
        lastDragGear = nearestGear;
      }
    });
    handle.on('dragend', () => {
      // Snap back to wherever the fighter's actual gear ends up - the next
      // updateGear() call (every frame from BattleScene) handles this, but
      // resolving lastDragGear here avoids a stale read on the next drag.
      lastDragGear = null;
    });
  }

  private shiftToward(targetGear: GearLevel) {
    const currentIndex = this.shifterNotches.findIndex((n) => n.getData('current'));
    const currentGear = currentIndex >= 0 ? GEAR_LEVELS[currentIndex] : 3;
    if (targetGear > currentGear) this.input.triggerTouchButton('p1', 'gearUp');
    else if (targetGear < currentGear) this.input.triggerTouchButton('p1', 'gearDown');
  }

  // Called every frame by BattleScene so the shifter handle tracks the
  // fighter's actual current gear (and mid-shift target), like a real
  // gearstick visibly sitting in whichever gear is currently engaged.
  updateGear(gear: GearLevel) {
    const { top, bottom } = this.shifterY;
    const index = GEAR_LEVELS.indexOf(gear);
    const y = bottom - (index / (GEAR_LEVELS.length - 1)) * (bottom - top);
    this.shifterHandle.setPosition(this.shifterHandle.x, y);
    this.shifterNotches.forEach((n, i) => {
      n.setData('current', i === index);
      n.setFillStyle(0x3498db, i === index ? 0.8 : 0.35);
    });
  }

  private buildActionButtons() {
    const weakX = GAME_WIDTH * 0.68;
    const strongX = GAME_WIDTH * 0.90;
    const lowY = GAME_HEIGHT - 30;
    const jumpX = GAME_WIDTH * 0.79;
    const jumpY = GAME_HEIGHT - 62;

    const buttons: { label: string; x: number; y: number; action: () => void; color: number }[] = [
      { label: 'A', x: weakX, y: lowY, action: () => this.tap('weak'), color: 0x3498db },
      { label: 'B', x: strongX, y: lowY, action: () => this.tap('strong'), color: 0x3498db },
      { label: '↑', x: jumpX, y: jumpY, action: () => this.tap('jump'), color: 0x2ecc71 },
    ];

    buttons.forEach((b) => {
      const btn = this.scene.add.circle(b.x, b.y, 15, b.color, 0.5).setInteractive({ useHandCursor: true });
      const label = this.scene.add.text(b.x, b.y, b.label, { fontSize: '10px', color: '#fff', fontFamily: PIXEL_FONT }).setOrigin(0.5);
      btn.on('pointerdown', b.action);
      this.container.add([btn, label]);
    });
  }

  private applyStick(dx: number, dy: number) {
    this.input.setTouchHold('p1', {
      left: dx < -6,
      right: dx > 6,
      up: dy < -6,
      down: dy > 6,
    });
  }

  private tap(action: 'weak' | 'strong' | 'gearUp' | 'gearDown' | 'jump') {
    this.input.triggerTouchButton('p1', action);
  }

  setVisible(v: boolean) {
    this.container.setVisible(v);
  }

  destroy() {
    this.container.destroy();
  }
}
