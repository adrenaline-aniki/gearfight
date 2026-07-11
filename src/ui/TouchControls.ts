import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT } from '../config/constants';
import type { GearLevel } from '../config/constants';
import type { InputManager } from '../systems/InputManager';

const GEAR_LEVELS: GearLevel[] = [1, 2, 3, 4, 5];

export class TouchControls {
  private container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private input: InputManager;
  private shifterNotches: Partial<Record<'p1' | 'p2', Phaser.GameObjects.Arc[]>> = {};
  private shifterHandles: Partial<Record<'p1' | 'p2', Phaser.GameObjects.Rectangle>> = {};
  private shifterY: Partial<Record<'p1' | 'p2', { top: number; bottom: number }>> = {};

  constructor(scene: Phaser.Scene, input: InputManager, side: 'left' | 'right' | 'both') {
    this.scene = scene;
    this.input = input;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(90);
    // Solo play gets the whole screen width (stick on the near edge, buttons
    // on the far edge, like a real 2-thumb mobile layout) instead of being
    // squeezed into just half the screen - that half-width squeeze was why
    // the buttons overlapped each other and were hard to tap precisely.
    // Classroom's shared-screen 2P mode still splits the width in half.
    if (side === 'both') {
      this.buildSide('p1', 0, GAME_WIDTH / 2);
      this.buildSide('p2', GAME_WIDTH / 2, GAME_WIDTH / 2);
    } else if (side === 'left') {
      this.buildSide('p1', 0, GAME_WIDTH);
    } else {
      this.buildSide('p2', 0, GAME_WIDTH);
    }
  }

  private buildSide(player: 'p1' | 'p2', offsetX: number, width: number) {
    const cx = offsetX + width * 0.15;
    const cy = GAME_HEIGHT - 48;

    const stick = this.scene.add.circle(cx, cy, 26, 0xffffff, 0.15).setInteractive();
    const knob = this.scene.add.circle(cx, cy, 10, 0xffffff, 0.4);

    stick.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const dx = Phaser.Math.Clamp(p.x - cx, -20, 20);
      const dy = Phaser.Math.Clamp(p.y - cy, -20, 20);
      knob.setPosition(cx + dx, cy + dy);
      this.applyStick(player, dx, dy);
    });
    stick.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const dx = Phaser.Math.Clamp(p.x - cx, -20, 20);
      const dy = Phaser.Math.Clamp(p.y - cy, -20, 20);
      knob.setPosition(cx + dx, cy + dy);
      this.applyStick(player, dx, dy);
    });
    stick.on('pointerup', () => {
      knob.setPosition(cx, cy);
      this.applyStick(player, 0, 0);
    });

    this.buildGearShifter(player, offsetX + width * 0.44);
    this.buildActionButtons(player, offsetX, width);

    this.container.add([stick, knob]);
  }

  // A vertical car-gearstick-style widget: 5 notches for GL1 (bottom) to
  // GL5 (top). Tapping a notch steps one gear toward it - it does not jump
  // straight there - so the existing one-gear-at-a-time shift minigame and
  // its mid-shift vulnerability are preserved; this is just a friendlier
  // input for "up" / "down" than two small, easy-to-mix-up +/- buttons.
  private buildGearShifter(player: 'p1' | 'p2', x: number) {
    const top = 118;
    const bottom = 198;
    this.shifterY[player] = { top, bottom };

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
      notch.on('pointerdown', () => this.shiftToward(player, gl));
      notches.push(notch);
      this.container.add([notch, label]);
    });
    this.shifterNotches[player] = notches;

    const handle = this.scene.add.rectangle(x, bottom, 20, 10, 0xffdd44, 0.9);
    this.container.add(handle);
    this.shifterHandles[player] = handle;
  }

  private shiftToward(player: 'p1' | 'p2', targetGear: GearLevel) {
    const notches = this.shifterNotches[player];
    if (!notches) return;
    // The handle's current notch encodes "current gear" as of the last
    // updateGear() call from BattleScene - see below.
    const currentIndex = notches.findIndex((n) => n.getData('current'));
    const currentGear = currentIndex >= 0 ? GEAR_LEVELS[currentIndex] : 3;
    if (targetGear > currentGear) this.input.triggerTouchButton(player, 'gearUp');
    else if (targetGear < currentGear) this.input.triggerTouchButton(player, 'gearDown');
  }

  // Called every frame by BattleScene so the shifter handle tracks the
  // fighter's actual current gear (and mid-shift target), like a real
  // gearstick visibly sitting in whichever gear is currently engaged.
  updateGear(player: 'p1' | 'p2', gear: GearLevel) {
    const range = this.shifterY[player];
    const handle = this.shifterHandles[player];
    const notches = this.shifterNotches[player];
    if (!range || !handle || !notches) return;

    const index = GEAR_LEVELS.indexOf(gear);
    const y = range.bottom - (index / (GEAR_LEVELS.length - 1)) * (range.bottom - range.top);
    handle.setPosition(handle.x, y);
    notches.forEach((n, i) => {
      n.setData('current', i === index);
      n.setFillStyle(0x3498db, i === index ? 0.8 : 0.35);
    });
  }

  private buildActionButtons(player: 'p1' | 'p2', offsetX: number, width: number) {
    const weakX = offsetX + width * 0.68;
    const strongX = offsetX + width * 0.90;
    const lowY = GAME_HEIGHT - 30;
    const jumpX = offsetX + width * 0.79;
    const jumpY = GAME_HEIGHT - 62;

    const buttons: { label: string; x: number; y: number; action: () => void; color: number }[] = [
      { label: 'A', x: weakX, y: lowY, action: () => this.tap(player, 'weak'), color: 0x3498db },
      { label: 'B', x: strongX, y: lowY, action: () => this.tap(player, 'strong'), color: 0x3498db },
      { label: '↑', x: jumpX, y: jumpY, action: () => this.tap(player, 'jump'), color: 0x2ecc71 },
    ];

    buttons.forEach((b) => {
      const btn = this.scene.add.circle(b.x, b.y, 15, b.color, 0.5).setInteractive({ useHandCursor: true });
      const label = this.scene.add.text(b.x, b.y, b.label, { fontSize: '10px', color: '#fff', fontFamily: PIXEL_FONT }).setOrigin(0.5);
      btn.on('pointerdown', b.action);
      this.container.add([btn, label]);
    });
  }

  private applyStick(player: 'p1' | 'p2', dx: number, dy: number) {
    this.input.setTouchHold(player, {
      left: dx < -6,
      right: dx > 6,
      up: dy < -6,
      down: dy > 6,
    });
  }

  private tap(player: 'p1' | 'p2', action: 'weak' | 'strong' | 'gearUp' | 'gearDown' | 'jump') {
    this.input.triggerTouchButton(player, action);
  }

  setVisible(v: boolean) {
    this.container.setVisible(v);
  }

  destroy() {
    this.container.destroy();
  }
}
