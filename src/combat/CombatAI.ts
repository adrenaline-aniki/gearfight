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

  reset() { this.attackCd = 0; this.actionTimer = 0; this.wantJump = false; }

  update(self: CombatFighter, opp: CombatFighter, mode: DummyMode): CommandInput {
    if (this.attackCd > 0) this.attackCd--;
    if (this.actionTimer > 0) this.actionTimer--;

    if (mode === 'stand') return EMPTY_COMMAND;
    if (mode === 'guard') return this.guard(self, opp);
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
}
