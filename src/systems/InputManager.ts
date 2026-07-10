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

export class InputManager {
  private p1 = { ...EMPTY_INPUT };
  private p2 = { ...EMPTY_INPUT };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

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
      left: this.keys.p1Left.isDown,
      right: this.keys.p1Right.isDown,
      up: this.keys.p1Up.isDown,
      down: this.keys.p1Down.isDown,
      weak: Phaser.Input.Keyboard.JustDown(this.keys.p1Weak),
      strong: Phaser.Input.Keyboard.JustDown(this.keys.p1Strong),
      gearUp: Phaser.Input.Keyboard.JustDown(this.keys.p1GearUp),
      gearDown: Phaser.Input.Keyboard.JustDown(this.keys.p1GearDown),
      jump: Phaser.Input.Keyboard.JustDown(this.keys.p1Jump),
    };
    this.p2 = {
      left: this.keys.p2Left.isDown,
      right: this.keys.p2Right.isDown,
      up: this.keys.p2Up.isDown,
      down: this.keys.p2Down.isDown,
      weak: Phaser.Input.Keyboard.JustDown(this.keys.p2Weak),
      strong: Phaser.Input.Keyboard.JustDown(this.keys.p2Strong),
      gearUp: Phaser.Input.Keyboard.JustDown(this.keys.p2GearUp),
      gearDown: Phaser.Input.Keyboard.JustDown(this.keys.p2GearDown),
      jump: Phaser.Input.Keyboard.JustDown(this.keys.p2Jump),
    };
  }

  getP1(): PlayerInput {
    return { ...this.p1 };
  }

  getP2(): PlayerInput {
    return { ...this.p2 };
  }

  setP1(input: Partial<PlayerInput>) {
    this.p1 = { ...this.p1, ...input };
  }

  setP2(input: Partial<PlayerInput>) {
    this.p2 = { ...this.p2, ...input };
  }
}
