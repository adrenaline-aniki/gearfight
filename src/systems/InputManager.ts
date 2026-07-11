import Phaser from 'phaser';
import type { PlayerInput } from '../types/game';

export const EMPTY_INPUT: PlayerInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  weak: false,
  strong: false,
  gearUp: false,
  gearDown: false,
  jump: false,
};

type HoldField = 'left' | 'right' | 'up' | 'down';
type PulseField = 'weak' | 'strong' | 'gearUp' | 'gearDown' | 'jump';
const EMPTY_HOLD: Record<HoldField, boolean> = { left: false, right: false, up: false, down: false };
const EMPTY_PULSE: Record<PulseField, boolean> = { weak: false, strong: false, gearUp: false, gearDown: false, jump: false };

export class InputManager {
  private p1 = { ...EMPTY_INPUT };
  private p2 = { ...EMPTY_INPUT };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  // Touch is event-driven (pointerdown/move/up from TouchControls), not
  // polled every frame like the keyboard scan below - previously
  // TouchControls wrote straight into p1/p2 via setP1/setP2, but update()
  // unconditionally rebuilt those from keyboard state every single frame
  // regardless, so any touch input was discarded before Fighter ever read it.
  // Holds (movement) persist while the control is active; pulses (attack/gear/
  // jump buttons) fire for exactly one update() call, matching the keyboard's
  // JustDown so a held finger can't spam repeated inputs.
  private touchHoldP1: Record<HoldField, boolean> = { ...EMPTY_HOLD };
  private touchHoldP2: Record<HoldField, boolean> = { ...EMPTY_HOLD };
  private touchPulseP1: Record<PulseField, boolean> = { ...EMPTY_PULSE };
  private touchPulseP2: Record<PulseField, boolean> = { ...EMPTY_PULSE };

  constructor(scene: Phaser.Scene) {
    if (scene.input.keyboard) {
      this.keys = scene.input.keyboard.addKeys({
        p1Left: 'LEFT',
        p1Right: 'RIGHT',
        p1Up: 'UP',
        p1Down: 'DOWN',
        p1Weak: 'Z',
        p1Strong: 'X',
        p1GearUp: 'E',
        p1GearDown: 'Q',
        p1Jump: 'SPACE',
        p2Left: 'A',
        p2Right: 'D',
        p2Up: 'W',
        p2Down: 'S',
        p2Weak: 'J',
        p2Strong: 'K',
        p2GearUp: 'O',
        p2GearDown: 'I',
        p2Jump: 'L',
      }) as Record<string, Phaser.Input.Keyboard.Key>;
    }
  }

  update() {
    if (!this.keys) return;
    this.p1 = {
      left: this.keys.p1Left.isDown || this.touchHoldP1.left,
      right: this.keys.p1Right.isDown || this.touchHoldP1.right,
      up: this.keys.p1Up.isDown || this.touchHoldP1.up,
      down: this.keys.p1Down.isDown || this.touchHoldP1.down,
      weak: Phaser.Input.Keyboard.JustDown(this.keys.p1Weak) || this.consumePulse(this.touchPulseP1, 'weak'),
      strong: Phaser.Input.Keyboard.JustDown(this.keys.p1Strong) || this.consumePulse(this.touchPulseP1, 'strong'),
      gearUp: Phaser.Input.Keyboard.JustDown(this.keys.p1GearUp) || this.consumePulse(this.touchPulseP1, 'gearUp'),
      gearDown: Phaser.Input.Keyboard.JustDown(this.keys.p1GearDown) || this.consumePulse(this.touchPulseP1, 'gearDown'),
      jump: Phaser.Input.Keyboard.JustDown(this.keys.p1Jump) || this.consumePulse(this.touchPulseP1, 'jump'),
    };
    this.p2 = {
      left: this.keys.p2Left.isDown || this.touchHoldP2.left,
      right: this.keys.p2Right.isDown || this.touchHoldP2.right,
      up: this.keys.p2Up.isDown || this.touchHoldP2.up,
      down: this.keys.p2Down.isDown || this.touchHoldP2.down,
      weak: Phaser.Input.Keyboard.JustDown(this.keys.p2Weak) || this.consumePulse(this.touchPulseP2, 'weak'),
      strong: Phaser.Input.Keyboard.JustDown(this.keys.p2Strong) || this.consumePulse(this.touchPulseP2, 'strong'),
      gearUp: Phaser.Input.Keyboard.JustDown(this.keys.p2GearUp) || this.consumePulse(this.touchPulseP2, 'gearUp'),
      gearDown: Phaser.Input.Keyboard.JustDown(this.keys.p2GearDown) || this.consumePulse(this.touchPulseP2, 'gearDown'),
      jump: Phaser.Input.Keyboard.JustDown(this.keys.p2Jump) || this.consumePulse(this.touchPulseP2, 'jump'),
    };
  }

  private consumePulse(pulse: Record<PulseField, boolean>, field: PulseField): boolean {
    if (pulse[field]) {
      pulse[field] = false;
      return true;
    }
    return false;
  }

  getP1(): PlayerInput {
    return { ...this.p1 };
  }

  getP2(): PlayerInput {
    return { ...this.p2 };
  }

  // Movement/jump: held for as long as the touch control (stick) is active.
  setTouchHold(player: 'p1' | 'p2', patch: Partial<Record<HoldField, boolean>>) {
    Object.assign(player === 'p1' ? this.touchHoldP1 : this.touchHoldP2, patch);
  }

  // Attack/gear buttons: fires once, consumed on the next update() call.
  triggerTouchButton(player: 'p1' | 'p2', field: PulseField) {
    (player === 'p1' ? this.touchPulseP1 : this.touchPulseP2)[field] = true;
  }
}
