import Phaser from 'phaser';
import { GROUND_Y } from '../config/constants';
import type { FighterConfig, FighterId, FighterState } from '../types/game';
import {
  COYOTE_FRAMES,
  GEAR_TABLE,
  HEAT_ON_HIT,
  INPUT_BUFFER,
  OVERHEAT_DURATION,
  PERFECT_SHIFT_CYCLE,
  PERFECT_SHIFT_FRAMES,
  PERFECT_SHIFT_WINDOW,
  PERFECT_SHIFT_WINDOW_ASSIST,
  SHIFT_FRAMES,
  SPRITE_IDLE_SOURCE_HEIGHT,
  SPRITE_TARGET_HEIGHT,
  type GearLevel,
} from '../config/constants';
import type { PlayerInput } from '../types/game';

const BASE_SPEED = 1.8;
const BASE_DAMAGE_WEAK = 40;
const BASE_DAMAGE_STRONG = 90;
const GRAVITY = 0.35;
const JUMP_VEL = -5.5;
const SPRITE_FOOT_OFFSET = 10;

export class Fighter {
  id: FighterId;
  name: string;
  container: Phaser.GameObjects.Container;
  sprite!: Phaser.GameObjects.Image;
  private spriteScale = 1;
  private currentPose = '';

  x: number;
  y: number;
  vy = 0;
  facing: 1 | -1;
  hp: number;
  maxHp: number;

  gear: GearLevel = 3;
  heat = 0;
  overheatTimer = 0;
  superGauge = 0;
  guardGauge = 100;

  state: FighterState = 'idle';
  stateTimer = 0;
  shiftTarget: GearLevel | null = null;
  shiftPerfectWindow = false;
  shiftCycleTimer = 0;
  perfectShiftBonus = false;
  perfectShiftCount = 0;

  attackActive = false;
  hitbox: Phaser.Geom.Rectangle | null = null;
  invuln = 0;

  inputBuffer: { type: string; frames: number }[] = [];
  coyoteTimer = 0;

  isPlayer = false;
  isAI = false;

  constructor(scene: Phaser.Scene, config: FighterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.x = config.x;
    this.y = GROUND_Y;
    this.facing = config.facing;
    this.maxHp = config.maxHp;
    this.hp = config.maxHp;
    if (config.gear) this.gear = config.gear;

    this.spriteScale = SPRITE_TARGET_HEIGHT / SPRITE_IDLE_SOURCE_HEIGHT[this.id];
    this.sprite = scene.add.image(0, SPRITE_FOOT_OFFSET, `${this.id}_idle`);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setScale(this.spriteScale);
    this.container = scene.add.container(this.x, this.y, [this.sprite]);
    this.container.setDepth(10);
    this.redraw();
  }

  redraw() {
    this.redrawSprite();
  }

  private poseForState(): string {
    switch (this.state) {
      case 'walk': return 'walk';
      case 'jump': return 'jump';
      case 'attack_weak': return 'attack_weak';
      case 'attack_strong': return 'attack_strong';
      case 'block': return 'guard';
      case 'shift': return this.stateTimer <= 4 ? 'shift_complete' : 'shift_start';
      case 'hitstun': return 'hitstun';
      case 'knockdown': return 'knockdown';
      case 'dead': return 'defeat';
      default: return 'idle';
    }
  }

  private redrawSprite() {
    const sprite = this.sprite;
    const pose = this.poseForState();
    if (pose !== this.currentPose) {
      sprite.setTexture(`${this.id}_${pose}`);
      this.currentPose = pose;
    }

    if (this.overheatTimer > 0) {
      sprite.setTint(0xff8888);
    } else if (this.perfectShiftBonus) {
      sprite.setTint(0xffff88);
    } else {
      sprite.clearTint();
    }
  }

  updateFacing(opponentX: number) {
    if (this.state === 'shift' || this.state === 'hitstun' || this.state === 'knockdown') return;
    this.facing = opponentX >= this.x ? 1 : -1;
  }

  bufferInput(input: PlayerInput) {
    if (input.weak) this.inputBuffer.push({ type: 'weak', frames: INPUT_BUFFER });
    if (input.strong) this.inputBuffer.push({ type: 'strong', frames: INPUT_BUFFER });
    if (input.gearUp) this.inputBuffer.push({ type: 'gearUp', frames: INPUT_BUFFER });
    if (input.gearDown) this.inputBuffer.push({ type: 'gearDown', frames: INPUT_BUFFER });
    if (input.jump) this.inputBuffer.push({ type: 'jump', frames: INPUT_BUFFER });
  }

  consumeBuffered(type: string): boolean {
    const idx = this.inputBuffer.findIndex((b) => b.type === type && b.frames > 0);
    if (idx >= 0) {
      this.inputBuffer.splice(idx, 1);
      return true;
    }
    return false;
  }

  tickBuffer() {
    this.inputBuffer = this.inputBuffer
      .map((b) => ({ ...b, frames: b.frames - 1 }))
      .filter((b) => b.frames > 0);
  }

  processInput(input: PlayerInput, assistMode: boolean) {
    this.bufferInput(input);

    if (this.overheatTimer > 0) {
      this.gear = 1;
      this.handleMovement(input, true);
      return;
    }

    if (this.state === 'shift') {
      this.handleShiftInput(input, assistMode);
      return;
    }

    if (this.state === 'hitstun' || this.state === 'knockdown' || this.state === 'dead') return;

    const blocking = (this.facing === 1 && input.left) || (this.facing === -1 && input.right);
    if (blocking && this.state !== 'attack_weak' && this.state !== 'attack_strong') {
      this.state = 'block';
      this.hitbox = null;
      this.redraw();
      return;
    }

    if (this.consumeBuffered('weak') || (assistMode && input.weak)) {
      this.startAttack('attack_weak');
      return;
    }
    if (this.consumeBuffered('strong') || (assistMode && input.strong)) {
      this.startAttack('attack_strong');
      return;
    }
    if (this.consumeBuffered('gearUp') || input.gearUp) {
      this.startShift(1, assistMode);
      return;
    }
    if (this.consumeBuffered('gearDown') || input.gearDown) {
      this.startShift(-1, assistMode);
      return;
    }
    if ((this.consumeBuffered('jump') || input.jump) && this.isGrounded()) {
      this.vy = JUMP_VEL;
      this.state = 'jump';
      this.coyoteTimer = 0;
      return;
    }

    this.handleMovement(input, false);
  }

  private handleMovement(input: PlayerInput, overheat: boolean) {
    const gear = GEAR_TABLE[this.gear];
    let dx = 0;
    if (input.left) dx -= BASE_SPEED * gear.speedMul;
    if (input.right) dx += BASE_SPEED * gear.speedMul;

    if (dx !== 0) {
      this.x += dx;
      this.state = 'walk';
    } else if (this.isGrounded()) {
      this.state = 'idle';
    }

    if (overheat) {
      this.state = 'walk';
    }

    this.x = Phaser.Math.Clamp(this.x, 30, 354);
  }

  private startAttack(type: 'attack_weak' | 'attack_strong') {
    this.state = type;
    const gear = GEAR_TABLE[this.gear];
    this.stateTimer = type === 'attack_weak' ? gear.startup + gear.recovery : gear.startup + gear.recovery + 6;
    this.attackActive = false;
    this.hitbox = null;
    this.redraw();
  }

  private startShift(direction: 1 | -1, _assistMode: boolean) {
    const newGear = (this.gear + direction) as GearLevel;
    if (newGear < 1 || newGear > 5) return;
    this.shiftTarget = newGear;
    this.state = 'shift';
    this.stateTimer = SHIFT_FRAMES;
    this.shiftCycleTimer = 0;
    this.shiftPerfectWindow = false;
    this.hitbox = null;
    this.redraw();
  }

  private handleShiftInput(input: PlayerInput, assistMode: boolean) {
    const window = assistMode ? PERFECT_SHIFT_WINDOW_ASSIST : PERFECT_SHIFT_WINDOW;
    this.shiftCycleTimer += 1;
    if (this.shiftCycleTimer % PERFECT_SHIFT_CYCLE < window * 2) {
      this.shiftPerfectWindow = true;
    } else {
      this.shiftPerfectWindow = false;
    }

    if ((input.gearUp || input.gearDown) && this.shiftPerfectWindow) {
      this.stateTimer = PERFECT_SHIFT_FRAMES;
      this.perfectShiftBonus = true;
      this.perfectShiftCount += 1;
    }
  }

  completeShift() {
    if (this.shiftTarget) {
      this.gear = this.shiftTarget;
      this.shiftTarget = null;
    }
    this.state = 'idle';
    this.stateTimer = 0;
    this.redraw();
  }

  tickState() {
    if (this.invuln > 0) this.invuln -= 1;

    if (this.state === 'shift') {
      this.stateTimer -= 1;
      if (this.stateTimer <= 0) this.completeShift();
      this.redraw();
      return;
    }

    if (this.state === 'attack_weak' || this.state === 'attack_strong') {
      const gear = GEAR_TABLE[this.gear];
      const total = this.state === 'attack_weak' ? gear.startup + gear.recovery : gear.startup + gear.recovery + 6;
      const elapsed = total - this.stateTimer;

      if (elapsed === gear.startup) {
        this.attackActive = true;
        const reach = this.state === 'attack_weak' ? 20 : 28;
        this.hitbox = new Phaser.Geom.Rectangle(
          this.facing === 1 ? this.x + 12 : this.x - 12 - reach,
          this.y - 30,
          reach,
          24,
        );
      }
      if (elapsed > gear.startup + 4) {
        this.attackActive = false;
        this.hitbox = null;
      }

      this.stateTimer -= 1;
      if (this.stateTimer <= 0) {
        this.state = 'idle';
        this.attackActive = false;
        this.hitbox = null;
      }
      this.redraw();
      return;
    }

    if (this.state === 'hitstun') {
      this.stateTimer -= 1;
      if (this.stateTimer <= 0) this.state = 'idle';
      return;
    }

    if (this.state === 'knockdown') {
      this.stateTimer -= 1;
      if (this.stateTimer <= 0) this.state = 'idle';
      return;
    }
  }

  applyPhysics() {
    if (!this.isGrounded()) {
      this.vy += GRAVITY;
      this.y += this.vy;
      if (this.y >= GROUND_Y) {
        this.y = GROUND_Y;
        this.vy = 0;
        if (this.state === 'jump') this.state = 'idle';
      }
    } else {
      this.coyoteTimer = COYOTE_FRAMES;
    }
    if (!this.isGrounded() && this.coyoteTimer > 0) this.coyoteTimer -= 1;
  }

  isGrounded() {
    return this.y >= GROUND_Y - 0.5;
  }

  isVulnerable() {
    return this.state === 'shift' || (this.invuln <= 0 && this.state !== 'dead');
  }

  isShifting() {
    return this.state === 'shift';
  }

  getAttackDamage(): number {
    const gear = GEAR_TABLE[this.gear];
    const base = this.state === 'attack_strong' ? BASE_DAMAGE_STRONG : BASE_DAMAGE_WEAK;
    let dmg = base * gear.damageMul;
    if (this.perfectShiftBonus) {
      dmg *= 1.2;
      this.perfectShiftBonus = false;
    }
    return Math.round(dmg);
  }

  canGuardBreak(): boolean {
    return GEAR_TABLE[this.gear].guardBreak && this.state === 'attack_strong';
  }

  takeDamage(amount: number, isGuarded: boolean, isShiftHit: boolean): number {
    if (this.invuln > 0) return 0;

    let dmg = amount;
    if (isShiftHit) dmg = Math.round(dmg * 1.5);
    if (isGuarded) {
      dmg = Math.round(dmg * 0.2);
      this.guardGauge -= 15;
      if (this.guardGauge <= 0) {
        this.guardGauge = 0;
        isGuarded = false;
        dmg = Math.round(amount * 0.5);
      }
    }

    this.hp = Math.max(0, this.hp - dmg);
    this.state = dmg > 60 ? 'knockdown' : 'hitstun';
    this.stateTimer = dmg > 60 ? 30 : 12;
    this.invuln = 10;
    this.hitbox = null;
    this.attackActive = false;

    return dmg;
  }

  tickHeat(deltaSec: number) {
    if (this.overheatTimer > 0) {
      this.overheatTimer -= 1;
      return;
    }
    const rate = GEAR_TABLE[this.gear].heatPerSec;
    this.heat = Phaser.Math.Clamp(this.heat + rate * deltaSec, 0, 100);
    if (this.heat >= 100) {
      this.overheatTimer = OVERHEAT_DURATION;
      this.gear = 1;
      this.heat = 100;
    }
  }

  onHitLanded() {
    this.heat = Math.min(100, this.heat + HEAT_ON_HIT);
    this.superGauge = Math.min(100, this.superGauge + 8);
  }

  onDamageTaken(amount: number) {
    this.superGauge = Math.min(100, this.superGauge + amount / 20);
  }

  syncPosition() {
    this.container.setPosition(this.x, this.y);
    this.container.setScale(this.facing, 1);
  }

  destroy() {
    this.container.destroy();
  }
}
