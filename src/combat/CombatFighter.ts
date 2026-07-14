// GEAR FIGHT — combat rebuild (Phase 1), fighter state machine.
//
// Pure logic (no Phaser). One fixed 60fps frame per step(). Everything the
// renderer needs (state, move, frame, boxes) is readable off the instance.
//
// Facing-normalized law: internal move boxes are authored right-facing; this
// class converts them to world space applying `facing`, so the presentation
// layer never mirrors anything by hand.

import type { CommandInput, WorldBox, HitProps, Box } from './types';
import type { CharacterDef } from './characterDef';

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
  | 'attack' | 'airattack' | 'block' | 'crouchblock'
  | 'hitstun' | 'blockstun' | 'knockdown';

/** A projectile the engine should spawn (returned from CombatFighter). */
export interface ProjectileSpawn {
  x: number; y: number; facing: 1 | -1;
  spec: import('./types').ProjectileSpec;
  gearDamageMul: number;
  gearGuardBreak: boolean;
}

// Universal physics/rules (not per-character; the same for every fighter). The
// per-character numbers - walk speed, jump strength, health, gears, moves, boxes
// - all live in the CharacterDef the author edits.
const GRAVITY = 0.42;           // px/frame^2
const JUMPSQUAT = 3;            // grounded frames before leaving the ground
const JUMP_H_SPEED = 2.4;       // forward/back jump horizontal travel (px/frame)
const MAX_METER = 100;
const KNOCKDOWN_FRAMES = 26;
const WAKEUP_INVULN = 6;
const GEAR_SHIFT_LOCK = 8;      // frames you can't act right after a shift (the risk window)
const GROUND_Y = 0;             // feet baseline in this local world; scene offsets it
const BUTTON_BUFFER = 4;        // frames an attack press stays live (input leniency)
const MOTION_WINDOW = 16;       // frames of directional history kept for motion inputs

/** facing-relative (fwd,vert) -> numpad digit (6 = forward, 2 = down, etc). */
function numpad(fwd: number, vert: number): number {
  const col = fwd > 0 ? 1 : fwd < 0 ? -1 : 0; // forward = right column
  const row = vert > 0 ? 1 : vert < 0 ? -1 : 0; // up = top row
  if (row === 1) return col === -1 ? 7 : col === 0 ? 8 : 9;
  if (row === 0) return col === -1 ? 4 : col === 0 ? 5 : 6;
  return col === -1 ? 1 : col === 0 ? 2 : 3;
}

/** A held diagonal counts for either cardinal it contains, so 236 is lenient
 * (e.g. a 3 read while sweeping through satisfies both the 2 and the 6 legs). */
function dirMatches(actual: number, want: number): boolean {
  if (actual === want) return true;
  if (want === 2) return actual === 1 || actual === 3;   // down accepts down-diagonals
  if (want === 6) return actual === 3 || actual === 9;    // forward accepts fwd-diagonals
  if (want === 4) return actual === 1 || actual === 7;    // back accepts back-diagonals
  return false;
}

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

  health: number;
  meter = 0;
  gear = 1;
  heat = 0;

  phase: FighterPhase = 'idle';
  phaseFrame = 0;    // frames spent in the current phase/move

  move: string | null = null;
  moveHasHit = false; // one hit per move activation

  shiftLock = 0;     // >0 = locked from acting (post-shift vulnerability)
  invuln = 0;
  private jumpDir = 0; // facing-relative horizontal jump direction, captured at takeoff

  // Attack-button buffers: a press stays "live" for BUTTON_BUFFER frames so a
  // slightly-early input (e.g. cancelling into heavy before recovery starts)
  // still fires instead of being dropped on the exact frame.
  private bufLight = 0;
  private bufHeavy = 0;
  private bufSpecial = 0;

  // Directional history (facing-relative numpad, newest last) for motion-input
  // special-move detection (236 fireball, 623 dragon punch, 236236 super).
  private dirHistory: number[] = [];
  moveHasSpawnedProjectile = false;
  // Touch shortcut: the scene can queue a special directly (a "必殺" button),
  // bypassing the motion, since clean 236/623 by finger is impractical.
  private queuedSpecial: string | null = null;

  readonly def: CharacterDef;

  constructor(x: number, facing: 1 | -1, def: CharacterDef) {
    this.x = x;
    this.facing = facing;
    this.def = def;
    this.health = def.health;
  }

  get gearSpec(): GearSpec {
    return this.def.gears[this.gear];
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
      this.phase === 'block' ||
      this.phase === 'crouchblock'
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

    // Auto-face the opponent whenever free to turn. Crucially this ALSO happens
    // in the air (plain jump, not mid-attack), so jumping across the opponent
    // flips your facing at the axis - that's what makes crossups / めくり work:
    // your jump-attack hitbox follows to the far side and the defender must
    // block the other way. Facing locks the instant an attack starts.
    const canTurn = this.phase !== 'attack' && this.phase !== 'airattack' &&
      this.phase !== 'jumpsquat' && this.phase !== 'hitstun' &&
      this.phase !== 'blockstun' && this.phase !== 'knockdown';
    if (canTurn) this.facing = opponentX >= this.x ? 1 : -1;

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
         this.phase === 'crouch' || this.phase === 'block' || this.phase === 'crouchblock')) {
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
      case 'airattack':
        this.stepAirAttack(input);
        break;
      case 'block':
      case 'crouchblock':
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
    // record facing-relative numpad direction
    const np = numpad(input.fwd, input.vert);
    if (this.dirHistory[this.dirHistory.length - 1] !== np) this.dirHistory.push(np);
    else this.dirHistory.push(np); // still push so timing/window stays frame-accurate
    if (this.dirHistory.length > MOTION_WINDOW) this.dirHistory.shift();
  }

  /** Was `motion` performed within the recent input window? Ordered-subsequence
   * match (lenient, like real fighters) with the final direction seen recently. */
  private matchMotion(motion: string): boolean {
    const seq = motion.split('').map((c) => +c);
    const hist = this.dirHistory;
    let si = 0;
    let lastMatchIdx = -1;
    for (let i = 0; i < hist.length && si < seq.length; i++) {
      if (dirMatches(hist[i], seq[si])) { si++; lastMatchIdx = i; }
    }
    if (si < seq.length) return false;
    // the motion must have completed near "now" (within the last few frames).
    return hist.length - 1 - lastMatchIdx <= 3;
  }

  /** Touch shortcut entry point: queue a special to fire when next actionable. */
  requestSpecial(id: string) {
    this.queuedSpecial = id;
  }

  private canShift(): boolean {
    return this.phase === 'idle' || this.phase === 'walk' ||
           this.phase === 'crouch' || this.phase === 'block' || this.phase === 'crouchblock';
  }

  private stepNeutral(input: CommandInput) {
    // Attacks take priority (buffered + motion inputs resolved here).
    const move = this.resolveAttackInput(input, false);
    if (move) { this.startMove(move); return; }
    // Jump (up). Capture forward/neutral/back so it becomes a diagonal arc.
    if (input.vert > 0) {
      this.jumpDir = input.fwd > 0 ? 1 : input.fwd < 0 ? -1 : 0;
      this.enterPhase('jumpsquat'); this.vx = 0; return;
    }
    // Guard: holding back = block. Down+back = crouch (low) block.
    if (input.fwd < 0) { this.setPhase(input.vert < 0 ? 'crouchblock' : 'block'); this.vx = 0; return; }
    // Crouch.
    if (input.vert < 0) { this.setPhase('crouch'); this.vx = 0; return; }
    // Walk.
    if (input.fwd !== 0) {
      const dir = input.fwd > 0 ? this.facing : -this.facing;
      this.vx = dir * this.def.walkSpeed * this.gearSpec.walkMul;
      this.x += this.vx;
      this.setPhase('walk');
    } else {
      this.vx = 0;
      this.setPhase('idle');
    }
  }

  /** Decide which move (if any) the current buffered attack inputs request.
   * Specials (motion or touch-queued) take priority over normals. Consumes the
   * buffer it uses. `cancelling` = we're mid-move looking for a cancel target. */
  private resolveAttackInput(input: CommandInput, cancelling: boolean): string | null {
    const airborne = this.phase === 'air' || this.phase === 'airattack';

    // Touch-queued special (scene shortcut): honoured on the ground only.
    if (this.queuedSpecial && !airborne) {
      const id = this.queuedSpecial;
      const m = this.def.moves[id];
      if (m && this.canAffordSpecial(m)) { this.queuedSpecial = null; return id; }
      this.queuedSpecial = null;
    }

    // Motion specials, strongest first: super (236236) > dpunch (623) > fireball (236).
    if (!airborne) {
      if (this.bufSpecial > 0 && this.hasSpecial('super') && this.matchMotion('236236') &&
          this.canAffordSpecial(this.def.moves['super'])) { this.bufSpecial = 0; return 'super'; }
      if (this.bufHeavy > 0 && this.hasSpecial('dpunch') && this.matchMotion('623')) { this.bufHeavy = 0; return 'dpunch'; }
      if (this.bufLight > 0 && this.hasSpecial('fireball') && this.matchMotion('236')) { this.bufLight = 0; return 'fireball'; }
    }

    // Normals.
    if (this.bufHeavy > 0) {
      this.bufHeavy = 0;
      return airborne ? 'jumpHeavy' : (input.vert < 0 ? 'crouchHeavy' : 'standHeavy');
    }
    if (this.bufLight > 0) {
      this.bufLight = 0;
      return airborne ? 'jumpLight' : (input.vert < 0 ? 'crouchLight' : 'standLight');
    }
    void cancelling;
    return null;
  }

  private hasSpecial(id: string): boolean {
    return !!this.def.moves[id];
  }
  private canAffordSpecial(m: import('./types').MoveData): boolean {
    return !m.meterCost || this.meter >= m.meterCost;
  }

  private stepJumpsquat(_input: CommandInput) {
    if (this.phaseFrame >= JUMPSQUAT - 1) {
      this.vy = this.def.jumpVy;
      // Fixed air momentum from the direction held at takeoff (classic no-air-
      // control). jumpDir is facing-relative; * facing makes it world-space.
      this.vx = this.jumpDir * this.facing * JUMP_H_SPEED;
      this.enterPhase('air');
    }
  }

  private stepAir(input: CommandInput) {
    this.x += this.vx;
    // one air normal per jump; starting it keeps the arc (no vx/vy reset).
    const move = this.resolveAttackInput(input, false);
    if (move) { this.startAirMove(move); return; }
    // landing handled in applyGravity()
  }

  private stepAttack(input: CommandInput) {
    const m = this.def.moves[this.move!];
    const su = this.scaledStartup(m.startup);
    const rec = this.scaledRecovery(m.recovery);
    const total = su + m.active + rec;

    // Cancel: once this move has connected (hit or block), its recovery can be
    // cancelled into an allowed target (normal xx normal, normal xx special xx
    // super). Window opens the moment it lands and stays open through recovery.
    if (this.moveHasHit && m.cancelInto && this.phaseFrame >= su) {
      const next = this.resolveAttackInput(input, true);
      if (next && m.cancelInto.includes(next) && next !== this.move) {
        this.startMove(next); return;
      }
    }

    if (this.phaseFrame >= total - 1) {
      this.endMove();
    }
  }

  private stepAirAttack(_input: CommandInput) {
    this.x += this.vx; // keep air momentum
    const m = this.def.moves[this.move!];
    const total = m.startup + m.active + m.recovery;
    // If the air move fully finishes while still airborne, return to plain air
    // (can't act again this jump); landing is handled in applyGravity().
    if (this.phaseFrame >= total - 1 && !this.isGrounded()) {
      this.move = null;
      this.setPhase('air');
    }
  }

  private stepBlock(input: CommandInput) {
    // Hold back to keep guarding; down+back = low block, back = high block.
    if (input.fwd < 0) {
      this.vx = 0;
      this.setPhase(input.vert < 0 ? 'crouchblock' : 'block');
    } else if (input.vert < 0) {
      this.setPhase('crouch');
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
    const m = this.def.moves[id];
    if (m.meterCost) this.meter = Math.max(0, this.meter - m.meterCost);
    this.move = id;
    this.moveHasHit = false;
    this.moveHasSpawnedProjectile = false;
    this.vx = 0;
    this.enterPhase('attack');
  }

  /** Air normal: keeps the jump arc (does NOT reset vx/vy). */
  private startAirMove(id: string) {
    this.move = id;
    this.moveHasHit = false;
    this.moveHasSpawnedProjectile = false;
    this.enterPhase('airattack');
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
        this.vx = 0;
        if (this.phase === 'air' || this.phase === 'airattack') {
          this.move = null;
          this.setPhase('idle');
        }
      }
    }
  }

  // ---- attack timing queries (for the engine's hit resolver) -------------

  /** Is the current move's hitbox live this frame? (Projectile moves have no
   * melee hitbox - the projectile carries the hit, so they report false here.) */
  isAttackActive(): boolean {
    if (this.phase !== 'attack' && this.phase !== 'airattack') return false;
    if (!this.move) return false;
    const m = this.def.moves[this.move];
    if (m.projectile) return false;
    const su = this.phase === 'attack' ? this.scaledStartup(m.startup) : m.startup;
    return this.phaseFrame >= su && this.phaseFrame < su + m.active;
  }

  /** Invulnerable to strikes this frame (wakeup i-frames or a move's startupInvuln). */
  invulnActive(): boolean {
    if (this.invuln > 0) return true;
    if ((this.phase === 'attack' || this.phase === 'airattack') && this.move) {
      const m = this.def.moves[this.move];
      if (m.startupInvuln && this.phaseFrame < m.startupInvuln) return true;
    }
    return false;
  }

  /** If the current move should launch a projectile this frame, returns the
   * spawn (once per activation); else null. Engine calls this each frame. */
  takeProjectileSpawn(): ProjectileSpawn | null {
    if (this.phase !== 'attack' || !this.move || this.moveHasSpawnedProjectile) return null;
    const m = this.def.moves[this.move];
    if (!m.projectile) return null;
    const su = this.scaledStartup(m.startup);
    if (this.phaseFrame < su) return null;
    this.moveHasSpawnedProjectile = true;
    return {
      x: this.x, y: this.y, facing: this.facing, spec: m.projectile,
      gearDamageMul: this.gearSpec.damageMul, gearGuardBreak: this.gearSpec.guardBreak,
    };
  }

  currentHit(): HitProps | null {
    if (!this.move) return null;
    return this.def.moves[this.move].hit;
  }

  /** Damage of the current move after gear scaling. */
  scaledDamage(): number {
    if (!this.move) return 0;
    return Math.round(this.def.moves[this.move].hit.damage * this.gearSpec.damageMul);
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
    return this.toWorld(this.def.moves[this.move].hitbox);
  }

  private isCrouchHeight(): boolean {
    return this.phase === 'crouch' || this.phase === 'crouchblock';
  }

  getHurtboxesWorld(): WorldBox[] {
    if (this.phase === 'knockdown') return [];
    if (this.move) {
      const m = this.def.moves[this.move];
      if (m.hurtboxes) return m.hurtboxes.map((b) => this.toWorld(b));
    }
    const base = this.isCrouchHeight() ? this.def.crouchHurtbox : this.def.standHurtbox;
    return [this.toWorld(base)];
  }

  getPushbox(): WorldBox {
    const base = this.isCrouchHeight() ? this.def.crouchPushbox : this.def.pushbox;
    return this.toWorld(base);
  }

  isBlocking(): boolean {
    return this.phase === 'block' || this.phase === 'crouchblock';
  }

  // ---- taking a hit ------------------------------------------------------

  applyHit(hit: HitProps, damage: number, attackerFacing: 1 | -1, guardBreak: boolean) {
    const guard = hit.guard ?? 'mid';
    const stand = this.phase === 'block';
    const crouch = this.phase === 'crouchblock';
    // High (overheads / jump-ins) must be stand-blocked; low must be crouch-
    // blocked; mid blocks either way. You can't block while airborne.
    const guarded =
      (guard === 'mid' && (stand || crouch)) ||
      (guard === 'high' && stand) ||
      (guard === 'low' && crouch);

    if (guarded) {
      this.stunFrames = hit.blockstun;
      this.phase = 'blockstun';
      this.phaseFrame = 0;
      // chip: the move's own chip, plus a small guard-break bleed from high gears.
      let chipFrac = hit.chip ?? 0;
      if (guardBreak) chipFrac = Math.max(chipFrac, 0.1);
      const chip = Math.round(damage * chipFrac);
      this.health = Math.max(0, this.health - chip);
      this.x += attackerFacing * hit.pushbackBlock;
      return { blocked: true, damage: chip };
    }

    // clean hit
    this.health = Math.max(0, this.health - damage);
    this.x += attackerFacing * hit.pushbackHit;
    this.move = null;
    this.moveHasHit = false;
    const hardKnockdown = this.health <= 0 || hit.knockdown || (hit.launch ?? 0) > 0;
    if (hardKnockdown) {
      if (hit.launch) this.vy = hit.launch; // small pop for feel
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
