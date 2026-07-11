import Phaser from 'phaser';
import { GROUND_Y } from '../config/constants';
import type { FighterConfig, FighterId, FighterState } from '../types/game';
import {
  BLOCKSTUN_FRAMES,
  COYOTE_FRAMES,
  GEAR_TABLE,
  GUARD_REGEN_PER_SEC,
  HEAT_ON_HIT,
  HITSTUN_FRAMES,
  HIT_INVULN_FRAMES,
  INPUT_BUFFER,
  KNOCKDOWN_DAMAGE_THRESHOLD,
  KNOCKDOWN_FRAMES,
  OVERHEAT_DURATION,
  PERFECT_SHIFT_CYCLE,
  PERFECT_SHIFT_FRAMES,
  PERFECT_SHIFT_WINDOW,
  PERFECT_SHIFT_WINDOW_ASSIST,
  SHIFT_FRAMES,
  SPRITE_IDLE_SOURCE_HEIGHT,
  SPRITE_TARGET_HEIGHT,
  SPRITE_WALK_FRAME_COUNT,
  STRONG_ATTACK_EXTRA_FRAMES,
  SUPER_ACTIVE_FRAMES,
  SUPER_DAMAGE,
  SUPER_HEIGHT,
  SUPER_REACH,
  SUPER_RECOVERY,
  SUPER_STARTUP,
  WALK_FRAME_INTERVAL,
  type GearLevel,
} from '../config/constants';
import { ARM_PARTS, FIGHTER_INNATE_TYPE, HEAD_PARTS, LEG_PARTS, resolveMechType, type MechType, type PartLoadout } from '../config/parts';
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
  private walkFrames: string[];
  private walkFrameIndex = 0;
  private walkFrameTimer = 0;
  private walkFrameDir: 1 | -1 = 1;

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

  // One-shot flag: BattleScene reads and clears this the frame a super
  // activates, to fire the callout popup/flash/SE exactly once per use.
  superJustActivated = false;

  isPlayer = false;
  isAI = false;
  private loadout?: PartLoadout;

  constructor(scene: Phaser.Scene, config: FighterConfig) {
    this.id = config.id;
    const walkFrameCount = SPRITE_WALK_FRAME_COUNT[this.id] ?? 1;
    this.walkFrames = walkFrameCount > 1
      ? Array.from({ length: walkFrameCount }, (_, i) => `${this.id}_walk_${i}`)
      : [`${this.id}_walk`];
    this.name = config.name;
    this.x = config.x;
    this.y = GROUND_Y;
    this.facing = config.facing;
    this.loadout = config.loadout;
    const hpBonus = this.loadout ? HEAD_PARTS[this.loadout.head].hpBonus : 0;
    this.maxHp = config.maxHp + hpBonus;
    this.hp = this.maxHp;
    if (config.gear) this.gear = config.gear;

    this.spriteScale = SPRITE_TARGET_HEIGHT[this.id] / SPRITE_IDLE_SOURCE_HEIGHT[this.id];
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
      case 'super': return 'attack_strong';
      case 'block': return 'guard';
      case 'blockstun': return 'guard';
      case 'shift': return this.stateTimer <= 4 ? 'shift_complete' : 'shift_start';
      case 'hitstun': return 'hitstun';
      case 'knockdown': return 'knockdown';
      case 'dead': return 'defeat';
      default: return 'idle';
    }
  }

  private nextWalkFrameTexture(): string {
    if (this.walkFrames.length <= 1) return this.walkFrames[0];

    this.walkFrameTimer += 1;
    if (this.walkFrameTimer >= WALK_FRAME_INTERVAL) {
      this.walkFrameTimer = 0;
      this.walkFrameIndex += this.walkFrameDir;
      const last = this.walkFrames.length - 1;
      if (this.walkFrameIndex >= last) { this.walkFrameIndex = last; this.walkFrameDir = -1; }
      else if (this.walkFrameIndex <= 0) { this.walkFrameIndex = 0; this.walkFrameDir = 1; }
    }
    return this.walkFrames[this.walkFrameIndex];
  }

  private redrawSprite() {
    const sprite = this.sprite;
    const pose = this.poseForState();

    let textureKey: string;
    if (pose === 'walk') {
      textureKey = this.nextWalkFrameTexture();
    } else {
      this.walkFrameIndex = 0;
      this.walkFrameTimer = 0;
      this.walkFrameDir = 1;
      textureKey = `${this.id}_${pose}`;
    }

    if (textureKey !== this.currentPose) {
      sprite.setTexture(textureKey);
      this.currentPose = textureKey;
    }

    if (this.state === 'super') {
      sprite.setTint(0xffee44);
    } else if (this.overheatTimer > 0) {
      sprite.setTint(0xff8888);
    } else if (this.perfectShiftBonus) {
      sprite.setTint(0xffff88);
    } else {
      sprite.clearTint();
    }
  }

  updateFacing(opponentX: number) {
    if (
      this.state === 'shift' || this.state === 'hitstun' || this.state === 'knockdown'
      || this.state === 'blockstun' || this.state === 'super'
    ) return;
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

  private hasBuffered(type: string): boolean {
    return this.inputBuffer.some((b) => b.type === type && b.frames > 0);
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

    if (
      this.state === 'hitstun' || this.state === 'knockdown' || this.state === 'dead'
      || this.state === 'blockstun' || this.state === 'attack_weak' || this.state === 'attack_strong'
      || this.state === 'super'
    ) return;

    const blocking = (this.facing === 1 && input.left) || (this.facing === -1 && input.right);
    if (blocking) {
      this.state = 'block';
      this.hitbox = null;
      this.redraw();
      return;
    }

    // Super ("necessary"): both attack buttons within the input-buffer window,
    // spent only once the gauge is full. Checked ahead of the single-button
    // branches below so a near-simultaneous press reads as the super, not a jab.
    if (this.superGauge >= 100 && this.hasBuffered('weak') && this.hasBuffered('strong')) {
      this.consumeBuffered('weak');
      this.consumeBuffered('strong');
      this.startSuper();
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
    const legSpeedMul = this.loadout ? LEG_PARTS[this.loadout.legs].speedMul : 1;
    const speed = BASE_SPEED * gear.speedMul * legSpeedMul;
    let dx = 0;
    if (input.left) dx -= speed;
    if (input.right) dx += speed;

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
    this.stateTimer = type === 'attack_weak' ? gear.startup + gear.recovery : gear.startup + gear.recovery + STRONG_ATTACK_EXTRA_FRAMES;
    this.attackActive = false;
    this.hitbox = null;
    this.redraw();
  }

  private startSuper() {
    this.state = 'super';
    this.stateTimer = SUPER_STARTUP + SUPER_ACTIVE_FRAMES + SUPER_RECOVERY;
    this.attackActive = false;
    this.hitbox = null;
    this.superGauge = 0;
    this.superJustActivated = true;
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
      const total = this.state === 'attack_weak' ? gear.startup + gear.recovery : gear.startup + gear.recovery + STRONG_ATTACK_EXTRA_FRAMES;
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

    if (this.state === 'super') {
      const total = SUPER_STARTUP + SUPER_ACTIVE_FRAMES + SUPER_RECOVERY;
      const elapsed = total - this.stateTimer;

      if (elapsed === SUPER_STARTUP) {
        this.attackActive = true;
        this.hitbox = new Phaser.Geom.Rectangle(
          this.facing === 1 ? this.x + 10 : this.x - 10 - SUPER_REACH,
          this.y - 34,
          SUPER_REACH,
          SUPER_HEIGHT,
        );
      }
      if (elapsed > SUPER_STARTUP + SUPER_ACTIVE_FRAMES) {
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

    if (this.state === 'hitstun' || this.state === 'blockstun') {
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
    // Weak attacks lead with the right arm, strong attacks with the left -
    // matches spec §3.5 (arms independently determine attack type/GL affinity).
    if (this.loadout) {
      const armId = this.state === 'attack_strong' ? this.loadout.armLeft : this.loadout.armRight;
      const arm = ARM_PARTS[armId];
      if ((arm.favoredGear as readonly GearLevel[]).includes(this.gear)) dmg *= arm.damageMul;
    }
    return Math.round(dmg);
  }

  // Flat, not gear-scaled - see the constant's comment in config/constants.ts.
  getSuperDamage(): number {
    return SUPER_DAMAGE;
  }

  // Speed/Power/Defense archetype for the type-matchup triangle (spec §3.5).
  // The protagonist's type comes from whichever arms are equipped; everyone
  // else's is fixed to their established character concept.
  getMechType(): MechType {
    return this.loadout
      ? resolveMechType(this.loadout.armRight, this.loadout.armLeft)
      : FIGHTER_INNATE_TYPE[this.id];
  }

  canGuardBreak(): boolean {
    return this.state === 'super' || (GEAR_TABLE[this.gear].guardBreak && this.state === 'attack_strong');
  }

  takeDamage(amount: number, isGuarded: boolean, isShiftHit: boolean): number {
    if (this.invuln > 0) return 0;

    let dmg = amount;
    if (isShiftHit) dmg = Math.round(dmg * 1.5);

    let guardHeld = isGuarded;
    if (isGuarded) {
      dmg = Math.round(dmg * 0.2);
      this.guardGauge -= 15;
      if (this.guardGauge <= 0) {
        this.guardGauge = 0;
        guardHeld = false;
        dmg = Math.round(amount * 0.5);
      }
    }

    this.hp = Math.max(0, this.hp - dmg);

    if (guardHeld) {
      // A clean block: short, actionable flinch - not the same disabling
      // stun as getting hit clean, so blocking a string doesn't lock you out.
      this.state = 'blockstun';
      this.stateTimer = BLOCKSTUN_FRAMES;
    } else {
      this.state = dmg > KNOCKDOWN_DAMAGE_THRESHOLD ? 'knockdown' : 'hitstun';
      this.stateTimer = dmg > KNOCKDOWN_DAMAGE_THRESHOLD ? KNOCKDOWN_FRAMES : HITSTUN_FRAMES;
    }
    this.invuln = HIT_INVULN_FRAMES;
    this.hitbox = null;
    this.attackActive = false;

    return dmg;
  }

  // Slide away from the attacker on hit/block, clamped to the stage bounds -
  // gives attacks physical weight instead of characters standing still while trading.
  applyKnockback(dx: number) {
    this.x = Phaser.Math.Clamp(this.x + dx, 30, 354);
  }

  // Guard gauge regenerates while not actively guarding, so one big guard
  // crush doesn't leave a fighter permanently unable to block for the round.
  tickGuard(deltaSec: number) {
    if (this.state !== 'block' && this.state !== 'blockstun') {
      this.guardGauge = Phaser.Math.Clamp(this.guardGauge + GUARD_REGEN_PER_SEC * deltaSec, 0, 100);
    }
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
