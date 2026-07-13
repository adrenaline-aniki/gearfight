// GEAR FIGHT — combat rebuild (Phase 1), fighter state machine.
//
// Pure logic (no Phaser). One fixed 60fps frame per step(). Everything the
// renderer needs (state, move, frame, boxes) is readable off the instance.
//
// Facing-normalized law: internal move boxes are authored right-facing; this
// class converts them to world space applying `facing`, so the presentation
// layer never mirrors anything by hand.

import type { CommandInput, WorldBox, HitProps, Box } from './types';
import { MOVES, STAND_HURTBOX, CROUCH_HURTBOX, PUSHBOX, PUSHBOX_CROUCH } from './moves';

// Local gear table for the rebuild. Gear is the one systemic knob: low gear =
// fast + weak + cool, high gear = slow + strong + guard-breaking + hot. Unlike
// the old table this does NOT carry startup/recovery (those live per-move now);
// gear only scales walk speed, damage, and the startup/recovery MULTIPLIER, so
// one move table covers all five gears.
export interface GearSpec {
  ratio: number;
  teeth: string;
  walkMul: number;    // multiplies base walk speed
  frameMul: number;   // multiplies move startup+recovery (>1 = slower)
  damageMul: number;
  guardBreak: boolean;
  heatPerSec: number;
}
export const COMBAT_GEARS: Record<number, GearSpec> = {
  1: { ratio: 0.33, teeth: '30:10', walkMul: 1.6, frameMul: 0.8, damageMul: 0.6, guardBreak: false, heatPerSec: -20 },
  2: { ratio: 0.6,  teeth: '25:15', walkMul: 1.3, frameMul: 0.9, damageMul: 0.8, guardBreak: false, heatPerSec: -10 },
  3: { ratio: 1.0,  teeth: '20:20', walkMul: 1.0, frameMul: 1.0, damageMul: 1.0, guardBreak: false, heatPerSec: 0 },
  4: { ratio: 1.67, teeth: '15:25', walkMul: 0.85, frameMul: 1.2, damageMul: 1.5, guardBreak: true,  heatPerSec: 15 },
  5: { ratio: 3.0,  teeth: '10:30', walkMul: 0.7, frameMul: 1.35, damageMul: 2.2, guardBreak: true,  heatPerSec: 30 },
};

export type FighterPhase =
  | 'idle' | 'walk' | 'crouch' | 'jumpsquat' | 'air'
  | 'attack' | 'block' | 'hitstun' | 'blockstun' | 'knockdown';

// Tunables (world px, 60fps frames). Kept here so the whole engine is one place.
const WALK_SPEED = 1.5;         // base px/frame at gear3
const JUMP_VY = 6.2;            // initial up velocity
const GRAVITY = 0.42;           // px/frame^2
const JUMPSQUAT = 3;            // grounded frames before leaving the ground
const MAX_HEALTH = 1000;
const MAX_METER = 100;
const KNOCKDOWN_FRAMES = 26;
const WAKEUP_INVULN = 6;
const GEAR_SHIFT_LOCK = 8;      // frames you can't act right after a shift (the risk window)
const GROUND_Y = 0;             // feet baseline in this local world; scene offsets it
const BUTTON_BUFFER = 4;        // frames an attack press stays live (input leniency)

export interface StepResult {
  /** a shift just completed this frame (for perfect-shift FX / heat) */
  shifted?: boolean;
}

let _uid = 0;

export class CombatFighter {
  readonly uid = _uid++;
  x: number;
  y = GROUND_Y;      // feet height above ground baseline (0 = standing on floor)
  vx = 0;
  vy = 0;
  facing: 1 | -1;

  health = MAX_HEALTH;
  meter = 0;
  gear = 1;
  heat = 0;

  phase: FighterPhase = 'idle';
  phaseFrame = 0;    // frames spent in the current phase/move

  move: string | null = null;
  moveHasHit = false; // one hit per move activation

  shiftLock = 0;     // >0 = locked from acting (post-shift vulnerability)
  invuln = 0;

  // Attack-button buffers: a press stays "live" for BUTTON_BUFFER frames so a
  // slightly-early input (e.g. cancelling into heavy before recovery starts)
  // still fires instead of being dropped on the exact frame.
  private bufLight = 0;
  private bufHeavy = 0;
  private bufSpecial = 0;

  constructor(x: number, facing: 1 | -1) {
    this.x = x;
    this.facing = facing;
  }

  get gearSpec(): GearSpec {
    return COMBAT_GEARS[this.gear];
  }

  get dead(): boolean {
    return this.health <= 0;
  }

  isGrounded(): boolean {
    return this.y <= GROUND_Y + 0.001;
  }

  isActionable(): boolean {
    if (this.dead) return false;
    if (this.shiftLock > 0) return false;
    return (
      this.phase === 'idle' ||
      this.phase === 'walk' ||
      this.phase === 'crouch' ||
      this.phase === 'block'
    );
  }

  /** Effective startup/recovery for the current move, scaled by gear. */
  private scaledStartup(base: number): number {
    return Math.max(1, Math.round(base * this.gearSpec.frameMul));
  }
  private scaledRecovery(base: number): number {
    return Math.max(1, Math.round(base * this.gearSpec.frameMul));
  }

  // ---- input -> action ---------------------------------------------------

  /** Advance one frame. opponentX is used to auto-face when neutral. */
  step(input: CommandInput, opponentX: number): StepResult {
    const result: StepResult = {};

    if (this.dead) {
      this.applyGravity();
      return result;
    }

    if (this.invuln > 0) this.invuln--;
    if (this.shiftLock > 0) this.shiftLock--;
    this.tickButtonBuffers(input);

    // Auto-face the opponent only when free to turn (grounded & actionable-ish).
    if (this.isGrounded() && this.phase !== 'attack' && this.phase !== 'hitstun' &&
        this.phase !== 'blockstun' && this.phase !== 'knockdown') {
      this.facing = opponentX >= this.x ? 1 : -1;
    }

    // Gear shifting is always allowed except during hitstun/knockdown/attack;
    // it's the risk-vs-reward core, so it deliberately locks you briefly.
    if (this.shiftLock === 0 && this.canShift()) {
      if (input.gearUp && this.gear < 5) {
        this.gear++;
        this.shiftLock = GEAR_SHIFT_LOCK;
        result.shifted = true;
      } else if (input.gearDown && this.gear > 1) {
        this.gear--;
        this.shiftLock = GEAR_SHIFT_LOCK;
        result.shifted = true;
      }
    }

    // Post-shift lock freezes ALL action (the risk you take for shifting): you
    // stand exposed and can't attack, block, or even move for GEAR_SHIFT_LOCK
    // frames. Only stun/air/attack phases in progress keep resolving.
    if (this.shiftLock > 0 &&
        (this.phase === 'idle' || this.phase === 'walk' ||
         this.phase === 'crouch' || this.phase === 'block')) {
      this.vx = 0;
      this.setPhase('idle');
      this.applyGravity();
      this.phaseFrame++;
      return result;
    }

    switch (this.phase) {
      case 'idle':
      case 'walk':
      case 'crouch':
        this.stepNeutral(input);
        break;
      case 'jumpsquat':
        this.stepJumpsquat(input);
        break;
      case 'air':
        this.stepAir(input);
        break;
      case 'attack':
        this.stepAttack(input);
        break;
      case 'block':
        this.stepBlock(input);
        break;
      case 'hitstun':
      case 'blockstun':
        this.stepStun();
        break;
      case 'knockdown':
        this.stepKnockdown();
        break;
    }

    this.applyGravity();
    this.phaseFrame++;
    return result;
  }

  private tickButtonBuffers(input: CommandInput) {
    this.bufLight = input.light ? BUTTON_BUFFER : Math.max(0, this.bufLight - 1);
    this.bufHeavy = input.heavy ? BUTTON_BUFFER : Math.max(0, this.bufHeavy - 1);
    this.bufSpecial = input.special ? BUTTON_BUFFER : Math.max(0, this.bufSpecial - 1);
  }

  private canShift(): boolean {
    return this.phase === 'idle' || this.phase === 'walk' ||
           this.phase === 'crouch' || this.phase === 'block';
  }

  private stepNeutral(input: CommandInput) {
    // Attacks take priority (buffered so a press a few frames early still fires).
    if (this.bufHeavy > 0) { this.bufHeavy = 0; this.startMove('heavy'); return; }
    if (this.bufLight > 0) {
      this.bufLight = 0;
      this.startMove(input.vert < 0 ? 'crouchLight' : 'light');
      return;
    }
    // Jump.
    if (input.vert > 0) { this.enterPhase('jumpsquat'); this.vx = 0; return; }
    // Block (holding back). Can't turn-block into a crouch here; crouch-block later.
    if (input.fwd < 0) { this.enterPhase('block'); this.vx = 0; return; }
    // Crouch.
    if (input.vert < 0) { this.setPhase('crouch'); this.vx = 0; return; }
    // Walk.
    if (input.fwd !== 0) {
      const dir = input.fwd > 0 ? this.facing : -this.facing;
      this.vx = dir * WALK_SPEED * this.gearSpec.walkMul;
      this.x += this.vx;
      this.setPhase('walk');
    } else {
      this.vx = 0;
      this.setPhase('idle');
    }
  }

  private stepJumpsquat(input: CommandInput) {
    if (this.phaseFrame >= JUMPSQUAT - 1) {
      this.vy = JUMP_VY;
      // preserve any held horizontal direction as air momentum
      const h = input.fwd > 0 ? this.facing : input.fwd < 0 ? -this.facing : 0;
      this.vx = h * WALK_SPEED * 0.9;
      this.enterPhase('air');
    }
  }

  private stepAir(_input: CommandInput) {
    this.x += this.vx;
    // landing handled in applyGravity()
  }

  private stepAttack(input: CommandInput) {
    const m = MOVES[this.move!];
    const su = this.scaledStartup(m.startup);
    const rec = this.scaledRecovery(m.recovery);
    const total = su + m.active + rec;

    // Cancel: once this move has connected (hit or block), its recovery can be
    // cancelled into an allowed follow-up (light xx heavy). The window opens the
    // moment it lands and stays open through recovery. Heavy is a hard finisher
    // (no cancelInto), so chains cap naturally.
    if (this.moveHasHit && m.cancelInto && this.phaseFrame >= su) {
      if (this.bufHeavy > 0 && m.cancelInto.includes('heavy')) {
        this.bufHeavy = 0; this.startMove('heavy'); return;
      }
      if (this.bufLight > 0 && m.cancelInto.includes('light')) {
        this.bufLight = 0;
        this.startMove(input.vert < 0 ? 'crouchLight' : 'light');
        return;
      }
    }

    if (this.phaseFrame >= total - 1) {
      this.endMove();
    }
  }

  private stepBlock(input: CommandInput) {
    if (input.fwd < 0) {
      // keep blocking
      this.vx = 0;
    } else {
      this.setPhase('idle');
    }
  }

  private stepStun() {
    // stun duration set on hit via .stunFrames
    if (this.phaseFrame >= this.stunFrames - 1) {
      this.setPhase('idle');
    }
  }

  private stepKnockdown() {
    if (this.phaseFrame >= KNOCKDOWN_FRAMES - 1) {
      this.invuln = WAKEUP_INVULN;
      this.setPhase('idle');
    }
  }

  stunFrames = 0;

  // ---- move / phase helpers ---------------------------------------------

  private startMove(id: string) {
    const m = MOVES[id];
    if (m.crouch && !(this.phase === 'crouch')) {
      // crouch normals still fire from neutral-with-down; allow it
    }
    this.move = id;
    this.moveHasHit = false;
    this.vx = 0;
    this.enterPhase('attack');
  }

  private endMove() {
    this.move = null;
    this.moveHasHit = false;
    this.setPhase('idle');
  }

  /** Change phase and RESET the frame counter (new action). */
  private enterPhase(p: FighterPhase) {
    this.phase = p;
    this.phaseFrame = 0;
  }

  /** Change phase WITHOUT churning the frame counter on idle<->walk. */
  private setPhase(p: FighterPhase) {
    if (this.phase !== p) {
      this.phase = p;
      this.phaseFrame = 0;
    }
  }

  private applyGravity() {
    if (!this.isGrounded() || this.vy > 0) {
      this.vy -= GRAVITY;
      this.y += this.vy;
      if (this.y <= GROUND_Y) {
        this.y = GROUND_Y;
        this.vy = 0;
        if (this.phase === 'air') this.setPhase('idle');
      }
    }
  }

  // ---- attack timing queries (for the engine's hit resolver) -------------

  /** Is the current move's hitbox live this frame? */
  isAttackActive(): boolean {
    if (this.phase !== 'attack' || !this.move) return false;
    const m = MOVES[this.move];
    const su = this.scaledStartup(m.startup);
    return this.phaseFrame >= su && this.phaseFrame < su + m.active;
  }

  currentHit(): HitProps | null {
    if (!this.move) return null;
    return MOVES[this.move].hit;
  }

  /** Damage of the current move after gear scaling. */
  scaledDamage(): number {
    if (!this.move) return 0;
    return Math.round(MOVES[this.move].hit.damage * this.gearSpec.damageMul);
  }

  // ---- boxes (world space) ----------------------------------------------

  private toWorld(b: Box): WorldBox {
    // facing-normalized -> world: forward is +x*facing.
    const near = this.x + b.x * this.facing;
    const far = this.x + (b.x + b.w) * this.facing;
    return {
      xmin: Math.min(near, far),
      xmax: Math.max(near, far),
      ymin: this.y + b.y,
      ymax: this.y + b.y + b.h,
    };
  }

  getHitboxWorld(): WorldBox | null {
    if (!this.isAttackActive() || !this.move) return null;
    return this.toWorld(MOVES[this.move].hitbox);
  }

  getHurtboxesWorld(): WorldBox[] {
    if (this.phase === 'knockdown') return [];
    if (this.move) {
      const m = MOVES[this.move];
      if (m.hurtboxes) return m.hurtboxes.map((b) => this.toWorld(b));
    }
    const base = this.phase === 'crouch' ? CROUCH_HURTBOX : STAND_HURTBOX;
    return [this.toWorld(base)];
  }

  getPushbox(): WorldBox {
    const base = this.phase === 'crouch' ? PUSHBOX_CROUCH : PUSHBOX;
    return this.toWorld(base);
  }

  isBlocking(): boolean {
    return this.phase === 'block';
  }

  // ---- taking a hit ------------------------------------------------------

  applyHit(hit: HitProps, damage: number, attackerFacing: 1 | -1, guardBreak: boolean) {
    const blocking = this.isBlocking() && this.invuln === 0;
    // Low must be blocked crouching — we only have standing block in this slice,
    // so a low vs standing block still blocks (crouch-block comes next pass).
    if (blocking && !guardBreak) {
      this.stunFrames = hit.blockstun;
      this.setPhase('blockstun');
      this.phase = 'blockstun';
      this.phaseFrame = 0;
      const chip = hit.chip ? Math.round(damage * hit.chip) : 0;
      this.health = Math.max(0, this.health - chip);
      this.x += attackerFacing * hit.pushbackBlock;
      return { blocked: true, damage: chip };
    }
    // clean hit
    this.health = Math.max(0, this.health - damage);
    this.x += attackerFacing * hit.pushbackHit;
    this.move = null;
    this.moveHasHit = false;
    if (this.health <= 0 || (hit.launch && hit.launch > 0)) {
      this.stunFrames = KNOCKDOWN_FRAMES;
      this.phase = 'knockdown';
      this.phaseFrame = 0;
    } else {
      this.stunFrames = hit.hitstun;
      this.phase = 'hitstun';
      this.phaseFrame = 0;
    }
    return { blocked: false, damage };
  }

  addMeter(n: number) {
    this.meter = Math.min(MAX_METER, this.meter + n);
  }
}
