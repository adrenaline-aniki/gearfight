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

export class CombatAI {
  private attackCd = 0;
  private actionTimer = 0;
  private wantJump = false;
  private reversaling = false;
  private comboStep = 0;   // Wizel: hits landed in the current rush string
  private pauseTimer = 0;  // Wizel: the guaranteed opening after a 3-hit string

  reset() { this.attackCd = 0; this.actionTimer = 0; this.wantJump = false; this.reversaling = false; this.comboStep = 0; this.pauseTimer = 0; }

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
    // Per-character personality: ウィズル rushes with GL1-2 light strings and a
    // readable opening; everyone else uses the neutral all-rounder brain.
    if (self.def.id === 'wizel') return this.wizelCpu(self, opp);
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
    // sometimes with the dashing blade rush from just outside poke range.
    if (dist > 44) {
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
}
