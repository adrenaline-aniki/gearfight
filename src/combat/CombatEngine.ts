// GEAR FIGHT — combat rebuild (Phase 1), the resolver.
//
// Steps both fighters one fixed frame, then resolves: pushbox separation,
// hit detection (attacker hitbox vs. defender hurtbox, one hit per move
// activation), damage/stun/pushback, and shared hitstop. Pure logic.

import { CombatFighter } from './CombatFighter';
import type { CommandInput, HitProps, WorldBox } from './types';
import { EMPTY_COMMAND } from './types';
import type { CharacterDef } from './characterDef';
import { makeDefaultCharacter } from './characterDef';

export interface HitEvent {
  attacker: CombatFighter;
  defender: CombatFighter;
  blocked: boolean;
  damage: number;
  guardBreak: boolean;
  projectile?: boolean;
}

/** A live projectile in flight. Owner is 1 or 2 (which fighter fired it). */
export interface Projectile {
  owner: 1 | 2;
  x: number; y: number;       // origin (feet-baseline) + box is relative
  facing: 1 | -1;
  box: { x: number; y: number; w: number; h: number };
  hit: HitProps;
  damage: number;
  guardBreak: boolean;
  speed: number;
  life: number;
}

// Playfield bounds in the engine's local world (x). The scene maps these to
// screen. Fighters can't walk past the walls or through each other.
const STAGE_MIN = 20;
const STAGE_MAX = 364;

export class CombatEngine {
  p1: CombatFighter;
  p2: CombatFighter;
  hitstop = 0;
  frame = 0;
  lastHits: HitEvent[] = [];
  projectiles: Projectile[] = [];

  constructor(
    def1: CharacterDef = makeDefaultCharacter('p1'),
    def2: CharacterDef = makeDefaultCharacter('p2'),
    p1Start = 130,
    p2Start = 254,
  ) {
    this.p1 = new CombatFighter(p1Start, 1, def1);
    this.p2 = new CombatFighter(p2Start, -1, def2);
  }

  /** Advance one fixed frame with each side's already-facing-resolved input. */
  step(in1: CommandInput = EMPTY_COMMAND, in2: CommandInput = EMPTY_COMMAND) {
    this.lastHits = [];

    // Hitstop freezes action (but not the clock) — the impact-weight pause.
    if (this.hitstop > 0) {
      this.hitstop--;
      this.frame++;
      return;
    }

    this.p1.step(in1, this.p2.x);
    this.p2.step(in2, this.p1.x);

    this.separate();
    this.resolveHits();
    this.spawnProjectiles();
    this.stepProjectiles();
    this.clampStage();

    this.frame++;
  }

  // ---- projectiles -------------------------------------------------------

  private spawnProjectiles() {
    for (const [f, owner] of [[this.p1, 1], [this.p2, 2]] as const) {
      // One projectile per owner on screen at a time (classic fireball rule).
      if (this.projectiles.some((p) => p.owner === owner)) continue;
      const s = f.takeProjectileSpawn();
      if (!s) continue;
      this.projectiles.push({
        owner, x: s.x, y: s.y, facing: s.facing,
        box: { ...s.spec.box }, hit: s.spec.hit,
        damage: Math.round(s.spec.hit.damage * s.gearDamageMul),
        guardBreak: s.gearGuardBreak, speed: s.spec.speed, life: s.spec.life,
      });
    }
  }

  private stepProjectiles() {
    const survivors: Projectile[] = [];
    for (const p of this.projectiles) {
      p.x += p.speed * p.facing;
      p.life--;
      const defender = p.owner === 1 ? this.p2 : this.p1;
      const pbox = projectileWorld(p);
      let consumed = false;
      if (!defender.invulnActive()) {
        for (const hurt of defender.getHurtboxesWorld()) {
          if (overlap(pbox, hurt)) {
            const res = defender.applyHit(p.hit, p.damage, p.facing, p.guardBreak);
            this.hitstop = p.hit.hitstop;
            (p.owner === 1 ? this.p1 : this.p2).addMeter(res.blocked ? 3 : 6);
            defender.addMeter(res.blocked ? 2 : 4);
            this.lastHits.push({
              attacker: p.owner === 1 ? this.p1 : this.p2, defender,
              blocked: res.blocked, damage: res.damage, guardBreak: p.guardBreak, projectile: true,
            });
            consumed = true;
            break;
          }
        }
      }
      if (!consumed && p.life > 0 && p.x > 0 && p.x < 384) survivors.push(p);
    }
    this.projectiles = survivors;
  }

  /** Keep the two pushboxes from overlapping by splitting the overlap. */
  private separate() {
    const a = this.p1.getPushbox();
    const b = this.p2.getPushbox();
    const overlapX = Math.min(a.xmax, b.xmax) - Math.max(a.xmin, b.xmin);
    const overlapY = Math.min(a.ymax, b.ymax) - Math.max(a.ymin, b.ymin);
    if (overlapX > 0 && overlapY > 0) {
      const push = overlapX / 2;
      if (this.p1.x <= this.p2.x) {
        this.p1.x -= push;
        this.p2.x += push;
      } else {
        this.p1.x += push;
        this.p2.x -= push;
      }
    }
  }

  private resolveHits() {
    this.tryHit(this.p1, this.p2);
    this.tryHit(this.p2, this.p1);
  }

  private tryHit(attacker: CombatFighter, defender: CombatFighter) {
    if (attacker.moveHasHit) return;
    const hb = attacker.getHitboxWorld();
    if (!hb) return;
    if (defender.invulnActive()) return;

    const hurts = defender.getHurtboxesWorld();
    let contact = false;
    for (const hurt of hurts) {
      if (overlap(hb, hurt)) { contact = true; break; }
    }
    if (!contact) return;

    attacker.moveHasHit = true;
    const hit = attacker.currentHit()!;
    const dmg = attacker.scaledDamage();
    const guardBreak = attacker.gearSpec.guardBreak;
    const res = defender.applyHit(hit, dmg, attacker.facing, guardBreak);

    // shared hitstop
    this.hitstop = hit.hitstop;
    attacker.addMeter(res.blocked ? 4 : 8);
    defender.addMeter(res.blocked ? 2 : 5);
    // hitting builds heat (gear thermodynamics carry over from the old system)
    attacker.heat = Math.min(100, attacker.heat + (res.blocked ? 2 : 5));

    this.lastHits.push({ attacker, defender, blocked: res.blocked, damage: res.damage, guardBreak });
  }

  private clampStage() {
    for (const f of [this.p1, this.p2]) {
      if (f.x < STAGE_MIN) f.x = STAGE_MIN;
      if (f.x > STAGE_MAX) f.x = STAGE_MAX;
    }
  }
}

function overlap(a: WorldBox, b: WorldBox): boolean {
  return a.xmin < b.xmax && a.xmax > b.xmin && a.ymin < b.ymax && a.ymax > b.ymin;
}

/** World-space box of a projectile (facing-normalized box -> world). */
export function projectileWorld(p: Projectile): WorldBox {
  const near = p.x + p.box.x * p.facing;
  const far = p.x + (p.box.x + p.box.w) * p.facing;
  return {
    xmin: Math.min(near, far), xmax: Math.max(near, far),
    ymin: p.y + p.box.y, ymax: p.y + p.box.y + p.box.h,
  };
}
