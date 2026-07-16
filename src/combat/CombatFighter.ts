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
  | 'hitstun' | 'blockstun' | 'launched' | 'knockdown' | 'dizzy';

/** A projectile the engine should spawn (returned from CombatFighter). */
export interface ProjectileSpawn {
  x: number; y: number; facing: 1 | -1;
  spec: import('./types').ProjectileSpec;
  gearDamageMul: number;
  gearGuardBreak: boolean;
  gear: number; // firing gear: low = small+fast gear, high = big+slow+heavy
}

// Universal physics/rules (not per-character; the same for every fighter). The
// per-character numbers - walk speed, jump strength, health, gears, moves, boxes
// - all live in the CharacterDef the author edits.
const GRAVITY = 0.42;           // px/frame^2
const JUMPSQUAT = 3;            // grounded frames before leaving the ground
const JUMP_H_SPEED = 2.4;       // forward/back jump horizontal travel (px/frame)
const BACK_WALK_MUL = 0.85;     // backward walk is a touch slower than forward
const DP_LEAP_VY = 5.8;         // アッパーシフト rise velocity (~40px up = real anti-air)
const DP_LEAP_VX = 1.0;         // and a small forward drift into the opponent
// Air-launch (launching hits, e.g. a DP): the victim flies FROM the point of
// contact - keep their current height, pop them up, and carry them away
// horizontally so they arc down and land into a knockdown a good distance off.
// That makes an anti-air send them tumbling from up high (not from the floor), and
// the horizontal separation + landing knockdown breaks the DP loop ("昇竜ハメ").
const LAUNCH_CARRY = 1.7;        // horizontal drift per frame while launched (world px)
const JUGGLE_CAP = 2;            // launching hits allowed before they just drop out
const LAUNCH_JUGGLE_POP = 3.0;   // reduced re-pop when hit again mid-air (juggle scaling)

// Dizzy / stun: hits add stun; cross the threshold in a short window and you get
// dizzied (helpless for a bit = free combo). Stun decays in neutral, and a brief
// post-dizzy immunity prevents infinite dizzy loops.
const STUN_THRESHOLD = 90;      // stun points that trigger a dizzy
const STUN_DECAY = 0.5;         // stun bled off per frame while not being hit
const DIZZY_FRAMES = 150;       // base dizzy duration (~2.5s)
const DIZZY_MASH_REDUCE = 5;    // frames knocked off dizzy per mashed input
const POST_DIZZY_IMMUNE = 150;  // frames after a dizzy where stun barely builds
const REVERSAL_WINDOW = 14;     // final getup frames where a special buffers as a reversal
// Thermal model (the "動力の限界" educational beat, and a real resource layer):
// attacking/holding a high gear heats the drivetrain; hit HEAT_MAX and it
// OVERHEATS - forced down to gear 1, can't up-shift, and left briefly exposed.
const HEAT_MAX = 100;
const OVERHEAT_DURATION = 150; // frames stuck overheated while it cools back down
const HEAT_ON_HIT = 6;         // extra heat from throwing an attack at all
const MAX_METER = 100;
const KNOCKDOWN_FRAMES = 26;
const WAKEUP_INVULN = 6;
const GEAR_SHIFT_LOCK = 8;      // frames you can't act right after a shift (the risk window)
// Perfect Shift ("double-clutch"): tap the gear button AGAIN within this window
// right after shifting to cancel the shift-lock and cool the drivetrain - the
// execution-reward that ties the gear theme to skill (and is touch-friendly: a
// quick double-tap of G+/G-).
const CLUTCH_WINDOW = 7;
const PERFECT_SHIFT_COOL = 35; // heat bled off by a perfect shift
const GROUND_Y = 0;             // feet baseline in this local world; scene offsets it
const BUTTON_BUFFER = 4;        // frames an attack press stays live (input leniency)
const THROW_TECH_BUFFER = 8;    // frames a throw press stays live (also the tech window)
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
  /** a perfect shift (double-clutch) landed this frame */
  perfectShift?: boolean;
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
  heat = 0;              // 0..HEAT_MAX; high gear heats, low gear cools
  overheatTimer = 0;     // >0 = overheated: forced to low gear, can't up-shift
  private clutchTimer = 0; // >0 = perfect-shift window is open (double-tap to clutch)
  perfectShiftFx = 0;    // >0 = a perfect shift just landed (for the callout)

  phase: FighterPhase = 'idle';
  phaseFrame = 0;    // frames spent in the current phase/move

  move: string | null = null;
  moveHasHit = false; // one hit per move activation
  moveHitCount = 0;            // hits landed so far (multi-hit / 乱舞)
  private moveLastHitFrame = -99;

  /** Engine asks this when its hitbox touches a hurtbox: may the strike land now?
   * (registers it). Single-hit moves land once; multi-hit moves land every
   * `interval` frames up to `hits`. */
  tryRegisterHit(): boolean {
    const mh = this.move ? this.def.moves[this.move].multiHit : undefined;
    if (mh) {
      if (this.moveHitCount >= mh.hits) return false;
      if (this.phaseFrame - this.moveLastHitFrame < mh.interval) return false;
      this.moveLastHitFrame = this.phaseFrame;
      this.moveHitCount++;
      if (this.moveHitCount >= mh.hits) this.moveHasHit = true; // final hit locks cancels
      return true;
    }
    if (this.moveHasHit) return false;
    this.moveHasHit = true;
    return true;
  }

  shiftLock = 0;     // >0 = locked from acting (post-shift vulnerability)
  invuln = 0;
  juggleCount = 0;   // launching hits landed in the current airborne string (juggle cap)
  private jumpDir = 0; // facing-relative horizontal jump direction, captured at takeoff

  stun = 0;                    // dizzy meter; >= STUN_THRESHOLD -> dizzied
  dizzyTimer = 0;              // frames remaining while dizzied
  private dizzyImmune = 0;     // post-dizzy grace where stun barely builds
  private pendingDizzy = false; // dizzy triggers when the current hitstun ends
  private pendingReversal: string | null = null; // special readied during knockdown, fires on wakeup

  // Attack-button buffers: a press stays "live" for BUTTON_BUFFER frames so a
  // slightly-early input (e.g. cancelling into heavy before recovery starts)
  // still fires instead of being dropped on the exact frame.
  private bufLight = 0;
  private bufHeavy = 0;
  private bufSpecial = 0;
  private bufThrow = 0;

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
    this.tickHeat();

    // Auto-face the opponent whenever free to turn. Crucially this ALSO happens
    // in the air (plain jump, not mid-attack), so jumping across the opponent
    // flips your facing at the axis - that's what makes crossups / めくり work:
    // your jump-attack hitbox follows to the far side and the defender must
    // block the other way. Facing locks the instant an attack starts.
    const canTurn = this.phase !== 'attack' && this.phase !== 'airattack' &&
      this.phase !== 'jumpsquat' && this.phase !== 'hitstun' &&
      this.phase !== 'blockstun' && this.phase !== 'launched' &&
      this.phase !== 'knockdown' && this.phase !== 'dizzy';
    if (canTurn) this.facing = opponentX >= this.x ? 1 : -1;

    // Perfect Shift (double-clutch): a second gear tap inside the window that
    // opened on the last shift cancels the shift-lock and cools the drivetrain.
    // Checked BEFORE the normal shift (using last frame's window) so the initial
    // tap can't double-trigger it.
    if (this.perfectShiftFx > 0) this.perfectShiftFx--;
    if (this.clutchTimer > 0) {
      if (input.gearUp || input.gearDown) {
        this.shiftLock = 0;
        this.heat = Math.max(0, this.heat - PERFECT_SHIFT_COOL);
        this.clutchTimer = 0;
        this.perfectShiftFx = 8;
        result.perfectShift = true;
      } else {
        this.clutchTimer--;
      }
    }

    // Gear shifting is always allowed except during hitstun/knockdown/attack;
    // it's the risk-vs-reward core, so it deliberately locks you briefly.
    if (this.shiftLock === 0 && this.canShift() && !result.perfectShift) {
      // Can't up-shift while overheated - the drivetrain is cooked and forced low.
      if (input.gearUp && this.gear < 5 && this.overheatTimer === 0) {
        this.gear++;
        this.shiftLock = GEAR_SHIFT_LOCK;
        this.clutchTimer = CLUTCH_WINDOW;
        result.shifted = true;
      } else if (input.gearDown && this.gear > 1) {
        this.gear--;
        this.shiftLock = GEAR_SHIFT_LOCK;
        this.clutchTimer = CLUTCH_WINDOW;
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
      case 'launched':
        this.stepLaunched();
        break;
      case 'knockdown':
        this.stepKnockdown();
        break;
      case 'dizzy':
        this.stepDizzy(input);
        break;
    }

    // stun bookkeeping: bleed off in neutral, tick post-dizzy immunity.
    if (this.dizzyImmune > 0) this.dizzyImmune--;
    if (this.phase !== 'hitstun' && this.phase !== 'dizzy' && this.stun > 0) {
      this.stun = Math.max(0, this.stun - STUN_DECAY);
    }

    this.applyGravity();
    this.phaseFrame++;
    return result;
  }

  private tickButtonBuffers(input: CommandInput) {
    this.bufLight = input.light ? BUTTON_BUFFER : Math.max(0, this.bufLight - 1);
    this.bufHeavy = input.heavy ? BUTTON_BUFFER : Math.max(0, this.bufHeavy - 1);
    this.bufSpecial = input.special ? BUTTON_BUFFER : Math.max(0, this.bufSpecial - 1);
    this.bufThrow = input.throw ? THROW_TECH_BUFFER : Math.max(0, this.bufThrow - 1);
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

  /** Thermal model: high gear heats, low gear cools; overheat forces low gear. */
  private tickHeat() {
    if (this.overheatTimer > 0) {
      this.overheatTimer--;
      this.heat = Math.max(0, this.heat - HEAT_MAX / OVERHEAT_DURATION);
      return;
    }
    this.heat = Math.min(HEAT_MAX, Math.max(0, this.heat + this.gearSpec.heatPerSec / 60));
    if (this.heat >= HEAT_MAX) {
      this.overheatTimer = OVERHEAT_DURATION;
      this.gear = 1;               // forced downshift - the drivetrain is cooked
      this.shiftLock = 0;
    }
  }

  get overheated(): boolean {
    return this.overheatTimer > 0;
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
    // Holding back: WALK BACKWARD while guard-ready (there's no block button in
    // SF/SNK - retreating and blocking are the same action, and a hit only
    // becomes blockstun if it actually connects). Down+back = crouch-block (low,
    // stationary).
    if (input.fwd < 0) {
      if (input.vert < 0) { this.vx = 0; this.setPhase('crouchblock'); return; }
      this.vx = -this.facing * this.def.walkSpeed * this.gearSpec.walkMul * BACK_WALK_MUL;
      this.x += this.vx;
      this.setPhase('block');
      return;
    }
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

    // Throw: grounded, close-range, unblockable. Highest priority of the
    // ground options so it beats a normal when you tap throw. (Whiff/range is
    // resolved by the engine; here we just commit to the attempt.)
    if (this.bufThrow > 0 && !airborne && !cancelling) { this.bufThrow = 0; return 'throw'; }

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

    // アッパーシフト (dpunch): carry the leap's forward drift (the up/forward
    // velocity is set in startMove; gravity handles the vertical arc).
    if (this.move === 'dpunch') this.x += this.vx;

    // Dashing/rushing attacks advance forward during the active window.
    if (m.advance && this.phaseFrame >= su && this.phaseFrame < su + m.active) {
      this.x += m.advance * this.facing;
    }

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
    // Keep holding back to keep retreating/guarding; down+back = low block.
    if (input.fwd < 0) {
      if (input.vert < 0) { this.vx = 0; this.setPhase('crouchblock'); }
      else {
        this.vx = -this.facing * this.def.walkSpeed * this.gearSpec.walkMul * BACK_WALK_MUL;
        this.x += this.vx;
        this.setPhase('block');
      }
    } else if (input.vert < 0) {
      this.setPhase('crouch');
    } else {
      this.setPhase('idle');
    }
  }

  private stepStun() {
    // stun duration set on hit via .stunFrames
    if (this.phaseFrame >= this.stunFrames - 1) {
      if (this.phase === 'hitstun' && this.pendingDizzy) this.enterDizzy();
      else this.setPhase('idle');
    }
  }

  /** Airborne after a launching hit: drift horizontally while gravity (applyGravity)
   * carries the arc. Can't act; landing converts this into a grounded knockdown. */
  private stepLaunched() {
    this.x += this.vx;
    this.vx *= 0.98; // slight air drag so the carry eases out
  }

  /** Touchdown from a launch -> a short grounded knockdown (with the usual wakeup
   * i-frames). The airtime already gave the attacker their okizeme window. */
  private enterKnockdownFromLaunch() {
    this.stunFrames = KNOCKDOWN_FRAMES;
    this.phase = 'knockdown';
    this.phaseFrame = 0;
    this.pendingDizzy = false;
    this.pendingReversal = null;
  }

  private enterDizzy() {
    this.pendingDizzy = false;
    this.stun = 0;
    this.dizzyTimer = DIZZY_FRAMES;
    this.vx = 0;
    this.phase = 'dizzy';
    this.phaseFrame = 0;
  }

  private stepDizzy(input: CommandInput) {
    // mash any input to shake it off faster
    const mashing = input.light || input.heavy || input.special || input.throw ||
      input.fwd !== 0 || input.vert !== 0;
    this.dizzyTimer -= mashing ? DIZZY_MASH_REDUCE : 1;
    if (this.dizzyTimer <= 0) {
      this.dizzyImmune = POST_DIZZY_IMMUNE;
      this.setPhase('idle');
    }
  }

  private stepKnockdown() {
    // Reversal window: a special/super readied during the back half of getup is
    // remembered and fires the instant you wake up - the okizeme "reversal" that
    // beats an opponent trying to meaty you. (DP's own startupInvuln + the wakeup
    // i-frames make it a true invincible get-off-me.)
    const kd = this.stunFrames || KNOCKDOWN_FRAMES; // per-hit knockdown duration
    if (this.phaseFrame >= kd - REVERSAL_WINDOW) {
      const rev = this.detectReversalInput();
      if (rev) this.pendingReversal = rev;
    }
    if (this.phaseFrame >= kd - 1) {
      this.invuln = WAKEUP_INVULN;
      if (this.pendingReversal) {
        const id = this.pendingReversal;
        this.pendingReversal = null;
        this.startMove(id);
      } else {
        this.setPhase('idle');
      }
    }
  }

  /** Which special/super the player has readied (motion + button), if any. */
  private detectReversalInput(): string | null {
    if (this.bufSpecial > 0 && this.hasSpecial('super') && this.matchMotion('236236') &&
        this.canAffordSpecial(this.def.moves['super'])) return 'super';
    if (this.bufHeavy > 0 && this.hasSpecial('dpunch') && this.matchMotion('623')) return 'dpunch';
    if (this.bufLight > 0 && this.hasSpecial('fireball') && this.matchMotion('236')) return 'fireball';
    return null;
  }

  stunFrames = 0;

  // ---- move / phase helpers ---------------------------------------------

  private startMove(id: string) {
    const m = this.def.moves[id];
    if (m.meterCost) this.meter = Math.max(0, this.meter - m.meterCost);
    // swinging a move adds heat, scaled by gear (high gear runs hot)
    this.heat = Math.min(HEAT_MAX, this.heat + HEAT_ON_HIT * this.gearSpec.damageMul);
    this.move = id;
    this.moveHasHit = false;
    this.moveHasSpawnedProjectile = false;
    this.moveHitCount = 0;
    this.moveLastHitFrame = -99;
    this.vx = 0;
    this.enterPhase('attack');
    // アッパーシフト leaps up+forward the instant it starts (applyGravity this same
    // frame carries it up). Set here, not in stepAttack, because a move started
    // from neutral doesn't get its first stepAttack until the NEXT frame. Gear-
    // linked: a higher gear cranks a taller leap (more anti-air reach, but slower
    // to recover as it falls further).
    if (id === 'dpunch') {
      this.vy = DP_LEAP_VY * (0.85 + this.gear * 0.06); // gear1 ~0.91x .. gear5 ~1.15x
      this.vx = this.facing * DP_LEAP_VX;
    }
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
        } else if (this.phase === 'launched') {
          this.enterKnockdownFromLaunch();
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
    if (m.projectile || m.grab) return false; // projectile/grab don't swing a melee box
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
      gear: this.gear,
    };
  }

  currentHit(): HitProps | null {
    if (!this.move) return null;
    return this.def.moves[this.move].hit;
  }

  /** Damage of the current move after gear scaling. A move may DAMPEN how much
   * gear affects it (gearScale < 1) so a super doesn't double-dip the GL5 mul. */
  scaledDamage(): number {
    if (!this.move) return 0;
    const m = this.def.moves[this.move];
    const scale = m.gearScale ?? 1;
    const mul = 1 + (this.gearSpec.damageMul - 1) * scale;
    return Math.round(m.hit.damage * mul);
  }

  // ---- throws ------------------------------------------------------------

  /** Is a grab attempt live this frame? */
  isGrabActive(): boolean {
    if (this.phase !== 'attack' || !this.move || this.moveHasHit) return false;
    const m = this.def.moves[this.move];
    if (!m.grab) return false;
    return this.phaseFrame >= m.startup && this.phaseFrame < m.startup + m.active;
  }

  grabRange(): number {
    return this.move ? this.def.moves[this.move].grab?.range ?? 0 : 0;
  }

  /** Can this fighter be grabbed right now? Only grounded, non-invulnerable,
   * "free-ish" states - not airborne, mid-attack, or already reeling. */
  isThrowable(): boolean {
    if (!this.isGrounded() || this.invuln > 0) return false;
    return this.phase === 'idle' || this.phase === 'walk' || this.phase === 'crouch' ||
           this.phase === 'block' || this.phase === 'crouchblock' || this.phase === 'dizzy';
  }

  /** Did this fighter input throw within the tech window? (throw-break) */
  wantsThrowTech(): boolean {
    return this.bufThrow > 0;
  }

  /** Is this fighter currently performing a throw (any frame of it)? */
  isThrowing(): boolean {
    return this.phase === 'attack' && !!this.move && !!this.def.moves[this.move].grab;
  }

  /** Apply a completed throw to this fighter (the victim). */
  applyThrown(damage: number, attackerFacing: 1 | -1) {
    this.health = Math.max(0, this.health - damage);
    this.move = null;
    this.moveHasHit = false;
    this.x += attackerFacing * 8; // tossed away
    this.stunFrames = KNOCKDOWN_FRAMES;
    this.phase = 'knockdown';
    this.phaseFrame = 0;
    this.pendingReversal = null;
  }

  /** Both fighters recover from a teched throw (pushed apart, no knockdown). */
  applyThrowTechRecover(pushDir: 1 | -1) {
    this.move = null;
    this.moveHasHit = false;
    this.x += pushDir * 10;
    this.stunFrames = 6;
    this.phase = 'blockstun'; // brief neutral-ish recovery
    this.phaseFrame = 0;
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

    // stun buildup (barely accrues during post-dizzy immunity).
    const stunAdd = hit.stun ?? Math.round(damage * 0.5);
    this.stun += this.dizzyImmune > 0 ? Math.round(stunAdd * 0.25) : stunAdd;

    // Launching hit (a DP): fly FROM the point of contact. Keep the current height
    // (anti-air = tumble from up high; grounded = a small pop), pop upward, and
    // drift away horizontally, arcing down into a knockdown on landing. Juggle-
    // capped so it can't loop, and the horizontal carry + landing knockdown break
    // the "昇竜ハメ" (repeat-DP) - they don't sit at a fixed spot anymore.
    const launch = hit.launch ?? 0;
    if (launch > 0 && this.health > 0) {
      // A fresh launch (from the ground OR from a jump) pops fully from the current
      // height; a RE-launch while already tumbling is diminished and juggle-capped.
      const rejuggle = this.phase === 'launched';
      this.juggleCount = rejuggle ? this.juggleCount + 1 : 1;
      const capped = this.juggleCount > JUGGLE_CAP;
      const pop = capped ? 0 : rejuggle ? Math.min(launch, LAUNCH_JUGGLE_POP) : launch;
      if (pop > 0) this.vy = pop;             // fresh pop from wherever they were hit
      else if (this.vy > 0) this.vy = 0;      // capped mid-rise -> kill the climb, drop them out
      this.vx = attackerFacing * LAUNCH_CARRY;
      this.phase = 'launched';
      this.phaseFrame = 0;
      this.pendingDizzy = false;
      this.pendingReversal = null;
      return { blocked: false, damage };
    }

    const hardKnockdown = this.health <= 0 || hit.knockdown;
    if (hardKnockdown) {
      this.stunFrames = hit.kdFrames ?? KNOCKDOWN_FRAMES;
      this.phase = 'knockdown';
      this.phaseFrame = 0;
      this.pendingDizzy = false; // knockdown doesn't dizzy
      this.pendingReversal = null;
    } else {
      this.stunFrames = hit.hitstun;
      this.phase = 'hitstun';
      this.phaseFrame = 0;
      // a hit that pushes past the threshold dizzies you when this hitstun ends
      if (this.health > 0 && this.stun >= STUN_THRESHOLD && this.dizzyImmune === 0) {
        this.pendingDizzy = true;
      }
    }
    return { blocked: false, damage };
  }

  addMeter(n: number) {
    this.meter = Math.min(MAX_METER, this.meter + n);
  }
}
