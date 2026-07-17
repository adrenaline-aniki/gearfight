// GEAR FIGHT — training-dummy / CPU brain for the rebuilt engine.
//
// Produces one facing-relative CommandInput per frame given the two fighters, so
// the player has something to hit, block, anti-air and punish. Deliberately
// simple and readable (cooldown + a little randomness), not a tournament AI - it
// exists so the FEEL of the engine can be judged, not to win.
//
// Specials are triggered via fighter.requestSpecial() (the same touch shortcut),
// since feeding a clean motion frame-by-frame from code is needless work.

import type { CommandInput } from './types';
import { EMPTY_COMMAND } from './types';
import type { CombatFighter } from './CombatFighter';

export type DummyMode = 'cpu' | 'guard' | 'stand';

// The distance at which Wizel's light jab can ACTUALLY connect: its hitbox reaches
// ~30px forward and the target's body adds ~9px, so ~38px is the real hit range.
// The AI must be inside THIS to press - not merely "sort of close" - or it stands
// at the edge whiffing jabs into the air (the reported bug).
const WIZEL_JAB_REACH = 38;

// Style-based personalities for the roster's non-bespoke fighters. A `turtle`
// holds ground and blocks then punishes with its special; a `zone` keeps its
// preferred distance and lobs projectiles, retreating when crowded; a `trick`
// plays mid-range hit-and-run and lays traps; a `rush` takes the initiative and
// closes in. The pros tune the numbers; the shapes give each fighter a game plan.
type AIStyle = 'turtle' | 'zone' | 'trick' | 'rush';
interface AIProfile {
  style: AIStyle;
  attackRange: number; // the distance its pokes actually connect at
  space: number;       // the distance it wants to sit at (zoners far, rushers close)
  gearTarget: number;  // the gear it drifts toward
  block: number;       // chance to block a committed poke up close
  antiAir: number;     // chance to DP an incoming jump-in
  zone: number;        // chance to throw its fireball-slot special from range
  usesSuper: boolean;
}
const AI_PROFILES: Record<string, AIProfile> = {
  // アイギス: a wall. Blocks a lot, holds its ground, and punishes with シールドタックル.
  aegis: { style: 'turtle', attackRange: 46, space: 40, gearTarget: 3, block: 0.62, antiAir: 0.15, zone: 0.28, usesSuper: true },
  // ドリフト: mid-range hit-and-run; lays オイルトラップ then darts around it.
  drift: { style: 'trick', attackRange: 40, space: 68, gearTarget: 2, block: 0.35, antiAir: 0.18, zone: 0.5, usesSuper: true },
  // テオリオン: keep-away zoner; sits far and throws 三日月ウェーブ, retreats when crowded.
  theorion: { style: 'zone', attackRange: 42, space: 100, gearTarget: 3, block: 0.4, antiAir: 0.3, zone: 0.7, usesSuper: true },
  // オメガノヴァ: the boss - takes the initiative, closes in, mixes in ダークネビュラ.
  omeganova: { style: 'rush', attackRange: 46, space: 46, gearTarget: 4, block: 0.42, antiAir: 0.28, zone: 0.3, usesSuper: true },
  // ソフィス・レギオン: technical zoner - フロストランス pressure, then approaches.
  sophislegion: { style: 'zone', attackRange: 44, space: 84, gearTarget: 3, block: 0.46, antiAir: 0.26, zone: 0.55, usesSuper: true },
};

export class CombatAI {
  private attackCd = 0;
  private actionTimer = 0;
  private wantJump = false;
  private reversaling = false;
  private comboStep = 0;   // Wizel: hits landed in the current rush string
  private pauseTimer = 0;  // Wizel: the guaranteed opening after a 3-hit string
  private retreatTimer = 0; // trickster: frames to back off after a hit-and-run poke

  reset() { this.attackCd = 0; this.actionTimer = 0; this.wantJump = false; this.reversaling = false; this.comboStep = 0; this.pauseTimer = 0; this.retreatTimer = 0; }

  update(self: CombatFighter, opp: CombatFighter, mode: DummyMode): CommandInput {
    if (this.attackCd > 0) this.attackCd--;
    if (this.actionTimer > 0) this.actionTimer--;

    // Wakeup reversal: sometimes DP out of knockdown to punish a meaty. Decides
    // once per knockdown and scripts a 623+heavy that lands just before getup.
    if (self.phase === 'knockdown' && (mode === 'cpu' || mode === 'guard')) {
      if (self.phaseFrame === 1) this.reversaling = Math.random() < 0.4;
      if (this.reversaling) {
        const pf = self.phaseFrame;
        if (pf === 21) return { ...EMPTY_COMMAND, fwd: 1 };                       // 6
        if (pf === 22) return { ...EMPTY_COMMAND, vert: -1 };                     // 2
        if (pf === 23) return { ...EMPTY_COMMAND, vert: -1, fwd: 1, heavy: true }; // 3 + heavy
      }
      return EMPTY_COMMAND;
    }
    if (self.phase !== 'knockdown') this.reversaling = false;

    if (mode === 'stand') return EMPTY_COMMAND;
    if (mode === 'guard') return this.guard(self, opp);
    // Per-character personality. ウィズル and ガンロック have bespoke brains (a low-gear
    // rush and a high-gear overheater); the rest are driven by a shared style-based
    // brain so a turtle turtles, a zoner zones, a trickster hits and runs, etc.
    if (self.def.id === 'wizel') return this.wizelCpu(self, opp);
    if (self.def.id === 'ganrock') return this.ganrockCpu(self, opp);
    const prof = AI_PROFILES[self.def.id];
    if (prof) return this.profiledCpu(self, opp, prof);
    return this.cpu(self, opp);
  }

  /** Block everything: hold back, and crouch-block when the incoming is a low. */
  private guard(_self: CombatFighter, opp: CombatFighter): CommandInput {
    const c: CommandInput = { ...EMPTY_COMMAND, fwd: -1 };
    if (opp.move) {
      const g = opp.def.moves[opp.move]?.hit.guard;
      if (g === 'low') c.vert = -1;       // crouch-block lows
    }
    return c;
  }

  private cpu(self: CombatFighter, opp: CombatFighter): CommandInput {
    const c: CommandInput = { ...EMPTY_COMMAND };
    const dist = Math.abs(opp.x - self.x);
    const oppAttacking = opp.phase === 'attack' || opp.phase === 'airattack';

    // Anti-air: opponent airborne and closing -> occasionally reversal DP.
    if (!opp.isGrounded() && dist < 52 && self.isGrounded() && this.attackCd === 0 && Math.random() < 0.2) {
      self.requestSpecial('dpunch');
      this.attackCd = 40;
      return c;
    }

    // Defend: when the opponent commits an attack up close, sometimes block it
    // (hold back, low-block if it's a low) instead of getting hit.
    if (oppAttacking && dist < 58 && Math.random() < 0.5) {
      c.fwd = -1;
      const g = opp.move ? opp.def.moves[opp.move]?.hit.guard : undefined;
      if (g === 'low') c.vert = -1;
      return c;
    }

    // Far: approach, occasionally lob a fireball to make the player respect space.
    if (dist > 62) {
      if (this.attackCd === 0 && Math.random() < 0.02) {
        self.requestSpecial('fireball');
        this.attackCd = 70;
        return c;
      }
      // occasional jump-in from mid-far
      if (this.actionTimer === 0 && Math.random() < 0.03) { this.wantJump = true; this.actionTimer = 30; }
      c.fwd = 1;
      if (this.wantJump) { c.vert = 1; this.wantJump = false; }
      return c;
    }

    // Mid: keep pressing forward into poke range.
    if (dist > 40) { c.fwd = 1; return c; }

    // Point-blank: sometimes go for a throw (beats their guard).
    if (dist < 26 && this.attackCd === 0 && Math.random() < 0.25) {
      c.throw = true;
      this.attackCd = 22;
      return c;
    }
    // Close: poke. Alternate lows and mids; sometimes a heavy.
    if (this.attackCd === 0) {
      const r = Math.random();
      if (r < 0.35) { c.vert = -1; c.light = true; }      // crouch light (low)
      else if (r < 0.8) { c.light = true; }               // stand light
      else { c.heavy = true; }                            // stand heavy
      this.attackCd = 16 + Math.floor(Math.random() * 14);
      return c;
    }
    // between pokes, occasionally hold back to bait / block
    if (Math.random() < 0.3) c.fwd = -1;
    return c;
  }

  // ウィズル — SPEED type, per 仕様書 §4.2: stays in GL1-2 and pressures with fast
  // light strings, but ALWAYS opens up for ~14 frames after a 3-hit string. That
  // guaranteed gap is the lesson: a low gear is fast but its rush has a fixed
  // recovery you can learn to punish. Deliberately not a wall - it teaches tempo.
  private wizelCpu(self: CombatFighter, opp: CombatFighter): CommandInput {
    const c: CommandInput = { ...EMPTY_COMMAND };
    const dist = Math.abs(opp.x - self.x);
    const oppAttacking = opp.phase === 'attack' || opp.phase === 'airattack';

    // The guaranteed opening: after a 3-hit string just stand there, wide open,
    // so the player can find the punish. This IS the teaching moment - checked
    // FIRST so nothing (not even a down-shift) covers the gap.
    if (this.pauseTimer > 0) { this.pauseTimer--; return c; }

    // Speed mech: hold the low gears. If we ever end up above GL2, drop back.
    if (self.gear > 2 && self.shiftLock === 0) { c.gearDown = true; return c; }

    // Anti-air: still swat obvious jump-ins (a rushdown character isn't helpless).
    if (!opp.isGrounded() && dist < 52 && self.isGrounded() && this.attackCd === 0 && Math.random() < 0.2) {
      self.requestSpecial('dpunch');
      this.attackCd = 40;
      return c;
    }
    // Occasionally respect a committed poke instead of trading into it.
    if (oppAttacking && dist < 52 && Math.random() < 0.35) {
      c.fwd = -1;
      const g = opp.move ? opp.def.moves[opp.move]?.hit.guard : undefined;
      if (g === 'low') c.vert = -1;
      return c;
    }

    // Out of range: close the gap fast (that's the whole speed-type identity),
    // sometimes with the dashing blade rush from just outside poke range. The gate
    // is the REAL jab reach - so Wizel keeps walking in until it can actually hit,
    // instead of parking just outside and mashing air.
    if (dist > WIZEL_JAB_REACH) {
      if (dist < 90 && this.attackCd === 0 && Math.random() < 0.05) {
        self.requestSpecial('fireball');        // オーバーシフト・ラッシュ
        this.attackCd = 40;
        this.comboStep = 0;
        return c;
      }
      c.fwd = 1;
      return c;
    }

    // In range: hammer light. Three quick jabs, then the mandatory opening -
    // pauseTimer alone governs the gap (it's checked at the top and blocks every
    // action), so it reads as a full ~20-frame "stand still and get punished".
    if (this.attackCd === 0) {
      c.light = true;
      this.attackCd = 11;                        // tight rhythm between jabs
      this.comboStep++;
      if (this.comboStep >= 3) { this.comboStep = 0; this.attackCd = 0; this.pauseTimer = 20; }
      return c;
    }
    return c;
  }

  // ガンロック — POWER type, per 仕様書 §4.2: fights mainly in GL4-5, "shows its
  // shift big" (the shift-lock IS a telegraphed opening), and manages heat badly
  // so it rides GL5 straight into an overheat. Its lesson is the mirror of
  // Wizel's: high torque hits like a truck but is slow, its gear shifts are a
  // punishable window, and holding a high gear cooks the drivetrain (forced to
  // GL1 for a long, wide-open stretch). Punish the shift and the overheat.
  private ganrockCpu(self: CombatFighter, opp: CombatFighter): CommandInput {
    const c: CommandInput = { ...EMPTY_COMMAND };
    const dist = Math.abs(opp.x - self.x);
    const oppAttacking = opp.phase === 'attack' || opp.phase === 'airattack';

    // Overheated: the drivetrain is cooked and stuck in GL1 - its big weakness.
    // It can't power up, so it just plods forward and defends, weak and wide
    // open. This is the window the player is taught to punish.
    if (self.overheated) {
      if (oppAttacking && dist < 60) {
        c.fwd = -1;
        const g = opp.move ? opp.def.moves[opp.move]?.hit.guard : undefined;
        if (g === 'low') c.vert = -1;
        return c;
      }
      if (dist > 44) { c.fwd = 1; return c; }
      // occasional weak poke, but mostly it's just eating pressure
      if (this.attackCd === 0 && Math.random() < 0.4) { c.light = true; this.attackCd = 18; return c; }
      return c;
    }

    // Wants GL4-5. Shifts UP toward high gear whenever it's below GL4 and not
    // point-blank - DELIBERATELY in the open (the 8f shift-lock is the telegraph
    // the player learns to dash in on). Bad heat management: it NEVER down-shifts
    // to cool, so swinging at GL5 rockets it into overheat.
    if (self.gear < 5 && self.shiftLock === 0 && dist > 30 && this.attackCd === 0 && Math.random() < 0.25) {
      c.gearUp = true;
      return c;
    }

    // Anti-air: slower and less reliable than the all-rounder (it's a heavyweight).
    if (!opp.isGrounded() && dist < 50 && self.isGrounded() && this.attackCd === 0 && Math.random() < 0.12) {
      self.requestSpecial('dpunch');
      this.attackCd = 44;
      return c;
    }
    // Sometimes just plant and block a committed poke.
    if (oppAttacking && dist < 58 && Math.random() < 0.45) {
      c.fwd = -1;
      const g = opp.move ? opp.def.moves[opp.move]?.hit.guard : undefined;
      if (g === 'low') c.vert = -1;
      return c;
    }

    // Far: trudge forward; from just outside range, occasionally commit to the
    // slow, telegraphed トルクスイング (its signature power lunge).
    if (dist > 52) {
      if (dist < 96 && this.attackCd === 0 && Math.random() < 0.05) {
        self.requestSpecial('fireball');       // トルクスイング
        this.attackCd = 46;
        return c;
      }
      c.fwd = 1;
      return c;
    }

    // Point-blank: a heavyweight loves the throw when they're cornered guarding.
    if (dist < 28 && this.attackCd === 0 && Math.random() < 0.28) {
      c.throw = true;
      this.attackCd = 24;
      return c;
    }

    // In range: heavy, deliberate pokes - lead with the wrecking-ball heavy, mix
    // in a jab or the lunge. Slow rhythm (it's a power type, not a rushdown).
    if (this.attackCd === 0) {
      const r = Math.random();
      if (r < 0.5) { c.heavy = true; this.attackCd = 26; }          // 立ち強 wrecking ball
      else if (r < 0.8) { c.light = true; this.attackCd = 16; }     // jab
      else { self.requestSpecial('fireball'); this.attackCd = 40; } // トルクスイング up close
      return c;
    }
    return c;
  }

  // Shared style-based brain for the roster's non-bespoke fighters (see AI_PROFILES).
  // Movement is decided every frame from distance (no jitter), and each style has a
  // distinct game plan: turtle / zone / trick / rush.
  private profiledCpu(self: CombatFighter, opp: CombatFighter, p: AIProfile): CommandInput {
    const c: CommandInput = { ...EMPTY_COMMAND };
    const dist = Math.abs(opp.x - self.x);
    const oppAtt = opp.phase === 'attack' || opp.phase === 'airattack';
    if (this.retreatTimer > 0) this.retreatTimer--;

    // Gear management: cool down when hot, else drift toward the profile's gear.
    if (self.shiftLock === 0 && !self.overheated && dist > 36 && this.attackCd === 0) {
      if (self.heat > 75 && self.gear > 1) { c.gearDown = true; return c; }
      if (self.gear < p.gearTarget && Math.random() < 0.15) { c.gearUp = true; return c; }
      if (self.gear > p.gearTarget && Math.random() < 0.15) { c.gearDown = true; return c; }
    }
    // Anti-air an incoming jump-in.
    if (!opp.isGrounded() && dist < 54 && self.isGrounded() && this.attackCd === 0 && Math.random() < p.antiAir) {
      self.requestSpecial('dpunch'); this.attackCd = 42; return c;
    }
    // Block a committed poke up close (low-block a low).
    if (oppAtt && dist < 58 && Math.random() < p.block) {
      c.fwd = -1;
      const g = opp.move ? opp.def.moves[opp.move]?.hit.guard : undefined;
      if (g === 'low') c.vert = -1;
      return c;
    }
    // Cash in a full meter when in range.
    if (p.usesSuper && self.meter >= 100 && dist <= Math.max(52, p.attackRange + 6) && this.attackCd === 0 && Math.random() < 0.5) {
      self.requestSpecial('super'); this.attackCd = 44; return c;
    }

    const inRange = dist <= p.attackRange;
    switch (p.style) {
      case 'zone': {
        // A zoner keeps distance and lobs projectiles - BUT it must not run into the
        // wall forever (that stalls the match). When cornered it commits: fight its
        // way out / switch sides, so a keep-away game always resolves.
        const cornered = (self.facing === 1 && self.x < 55) || (self.facing === -1 && self.x > 329);
        if (dist < p.space - 10 && !cornered) {
          if (inRange && this.attackCd === 0 && Math.random() < 0.35) { c.light = true; this.attackCd = 16; return c; }
          c.fwd = -1; return c;
        }
        if (this.attackCd === 0 && Math.random() < p.zone) { self.requestSpecial('fireball'); this.attackCd = 50; return c; }
        if (cornered) {
          // no room to run: poke if we can, else walk toward the opponent to escape.
          if (inRange && this.attackCd === 0 && Math.random() < 0.5) { c.light = true; this.attackCd = 16; return c; }
          c.fwd = 1; return c;
        }
        if (dist > p.space + 20) c.fwd = 1; // too far even to zone comfortably
        return c;
      }
      case 'trick': {
        // lay a trap from mid range, poke, then hit-and-run away.
        if (this.retreatTimer > 0) { c.fwd = -1; return c; }
        if (dist >= p.attackRange && dist <= p.space && this.attackCd === 0 && Math.random() < p.zone * 0.5) {
          self.requestSpecial('fireball'); this.attackCd = 55; return c; // オイルトラップ
        }
        if (!inRange) { c.fwd = 1; return c; }
        if (this.attackCd === 0) {
          const r = Math.random();
          if (r < 0.4) { c.vert = -1; c.light = true; } else if (r < 0.85) { c.light = true; } else { c.heavy = true; }
          this.attackCd = 14 + Math.floor(Math.random() * 8);
          this.retreatTimer = 10 + Math.floor(Math.random() * 10);
          return c;
        }
        return c;
      }
      case 'turtle': {
        // hold ground, creep in, block-bait, punish with sturdy heavies / the special.
        if (!inRange) {
          if (dist < p.attackRange + 22 && this.attackCd === 0 && Math.random() < p.zone) { self.requestSpecial('fireball'); this.attackCd = 50; return c; }
          c.fwd = Math.random() < 0.7 ? 1 : -1;
          return c;
        }
        if (this.attackCd === 0 && Math.random() < 0.7) {
          const r = Math.random();
          if (r < 0.55) { c.heavy = true; this.attackCd = 22; }
          else if (r < 0.85) { c.light = true; this.attackCd = 16; }
          else { self.requestSpecial('fireball'); this.attackCd = 48; }
          return c;
        }
        if (Math.random() < 0.4) c.fwd = -1;
        return c;
      }
      case 'rush':
      default: {
        // take the initiative; occasionally zone en route; throw on a cornered guard.
        if (!inRange) {
          if (dist < p.space + 40 && this.attackCd === 0 && Math.random() < p.zone * 0.25) { self.requestSpecial('fireball'); this.attackCd = 55; return c; }
          c.fwd = 1; return c;
        }
        if (dist < 26 && this.attackCd === 0 && Math.random() < 0.2) { c.throw = true; this.attackCd = 22; return c; }
        if (this.attackCd === 0 && Math.random() < 0.85) {
          const r = Math.random();
          if (r < 0.3) { c.vert = -1; c.light = true; } else if (r < 0.7) { c.light = true; } else { c.heavy = true; }
          this.attackCd = 14 + Math.floor(Math.random() * 10);
          return c;
        }
        return c;
      }
    }
  }
}
