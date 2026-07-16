// GEAR FIGHT — combat rebuild, authentic move table (frame data).
//
// All boxes are facing-normalized (see types.ts): authored for a right-facing
// fighter, +x forward, +y up, feet origin. The engine mirrors them for 2P.
//
// The set is modelled on SF/SNK footsies: fast pokes you can chain/cancel, a
// slow committal heavy, a LOW crouch jab, a LOW sweep that knocks down, air
// normals that hit as overheads, and two signature specials driven by motion
// input - a fireball (projectile, keep-away/pressure) and a dragon punch
// (invulnerable rising anti-air, huge on whiff). Gear scales all of it.

import type { MoveData } from './types';

// Baseline stance hurtboxes (feet at origin, y up).
export const STAND_HURTBOX = { x: -9, y: 0, w: 18, h: 46 } as const;
export const CROUCH_HURTBOX = { x: -9, y: 0, w: 18, h: 30 } as const;

// Pushboxes (solid body used to keep fighters from overlapping).
export const PUSHBOX = { x: -10, y: 0, w: 20, h: 46 } as const;
export const PUSHBOX_CROUCH = { x: -10, y: 0, w: 20, h: 30 } as const;

export const MOVES: Record<string, MoveData> = {
  // ---- GROUNDED NORMALS -------------------------------------------------
  // Stand light: fast mid poke, chains and specials-cancels. +2 / -1.
  standLight: {
    id: 'standLight', name: '立ち弱', startup: 4, active: 3, recovery: 7,
    hitbox: { x: 8, y: 22, w: 22, h: 12 },
    hit: { damage: 30, hitstun: 12, blockstun: 9, hitstop: 6, pushbackHit: 3, pushbackBlock: 4, guard: 'mid' },
    cancelInto: ['standHeavy', 'crouchHeavy', 'fireball', 'dpunch', 'super'],
  },
  // Stand heavy: slow, committal, big reward; special/super cancel only.
  standHeavy: {
    id: 'standHeavy', name: '立ち強', startup: 9, active: 4, recovery: 16,
    hitbox: { x: 8, y: 20, w: 30, h: 18 },
    // hitstun raised so a landed heavy is ~+4 (rewards the hit: links into a
    // light, or special-cancel into a combo). Still -6 on block = a real
    // commitment you get punished for whiffing/pressing on defence.
    hit: { damage: 80, hitstun: 23, blockstun: 14, hitstop: 10, pushbackHit: 5, pushbackBlock: 6, guard: 'mid' },
    cancelInto: ['standLight', 'crouchLight', 'fireball', 'dpunch', 'super'],
  },
  // Crouch light: LOW, fast, chains into sweep / stand heavy / specials.
  crouchLight: {
    id: 'crouchLight', name: 'しゃがみ弱', startup: 5, active: 3, recovery: 8,
    hitbox: { x: 8, y: 6, w: 22, h: 10 }, hurtboxes: [{ x: -9, y: 0, w: 18, h: 30 }],
    hit: { damage: 28, hitstun: 12, blockstun: 9, hitstop: 6, pushbackHit: 3, pushbackBlock: 4, guard: 'low' },
    crouch: true, cancelInto: ['crouchHeavy', 'standHeavy', 'fireball', 'dpunch', 'super'],
  },
  // Crouch heavy = sweep: LOW, knocks down, no cancel, punishable on block.
  crouchHeavy: {
    id: 'crouchHeavy', name: '足払い', startup: 8, active: 4, recovery: 20,
    hitbox: { x: 8, y: 4, w: 34, h: 10 }, hurtboxes: [{ x: -9, y: 0, w: 18, h: 30 }],
    hit: { damage: 60, hitstun: 16, blockstun: 12, hitstop: 10, pushbackHit: 4, pushbackBlock: 6, guard: 'low', knockdown: true },
    crouch: true,
  },

  // ---- AIR NORMALS (jump attacks hit as OVERHEADS) ----------------------
  jumpLight: {
    id: 'jumpLight', name: 'ジャンプ弱', startup: 4, active: 8, recovery: 4,
    hitbox: { x: 4, y: 10, w: 22, h: 16 },
    hit: { damage: 30, hitstun: 14, blockstun: 10, hitstop: 6, pushbackHit: 2, pushbackBlock: 3, guard: 'high' },
    air: true,
  },
  jumpHeavy: {
    id: 'jumpHeavy', name: 'ジャンプ強', startup: 7, active: 6, recovery: 6,
    hitbox: { x: 4, y: 8, w: 28, h: 22 },
    hit: { damage: 70, hitstun: 18, blockstun: 12, hitstop: 9, pushbackHit: 3, pushbackBlock: 4, guard: 'high' },
    air: true,
  },

  // ---- THROW (unblockable, close-range; techable) -----------------------
  throw: {
    id: 'throw', name: '投げ', startup: 3, active: 2, recovery: 18,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, // unused: grab below drives it
    grab: { range: 40, techWindow: 8 },
    hit: {
      damage: 90, hitstun: 0, blockstun: 0, hitstop: 10,
      pushbackHit: 0, pushbackBlock: 0, knockdown: true,
    },
  },

  // ---- SPECIALS ---------------------------------------------------------
  // Fireball (236 + light): keep-away / pressure. Spawns a slow projectile;
  // long recovery so throwing one up close is risky. Chip on block.
  fireball: {
    id: 'fireball', name: 'ギアショット', startup: 12, active: 2, recovery: 30,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, // unused: projectile below drives the hit
    motion: '236', button: 'light',
    projectile: {
      speed: 3.0, box: { x: 0, y: 16, w: 16, h: 16 },
      hit: { damage: 45, hitstun: 18, blockstun: 14, hitstop: 6, pushbackHit: 4, pushbackBlock: 2, chip: 0.25, guard: 'mid' },
      life: 120,
    },
    hit: { damage: 0, hitstun: 0, blockstun: 0, hitstop: 0, pushbackHit: 0, pushbackBlock: 0 },
  },
  // Dragon punch (623 + heavy): invincible rising anti-air, launches, but a
  // huge whiff punish (long recovery, and it leaves the air vulnerable).
  dpunch: {
    id: 'dpunch', name: 'アッパーシフト', startup: 4, active: 8, recovery: 28,
    // tall column covering the anti-air space (the fighter also LEAPS up, so the
    // box rises with it - see CombatFighter dpunch leap).
    hitbox: { x: 2, y: 8, w: 30, h: 60 },
    motion: '623', button: 'heavy', startupInvuln: 10,
    // long hard-knockdown so landing this invincible reversal REWARDS you with
    // okizeme (was -10 on hit; now the DP user recovers first). Still -20 on block.
    hit: { damage: 100, hitstun: 22, blockstun: 16, hitstop: 10, pushbackHit: 3, pushbackBlock: 8, guard: 'mid', launch: 5, knockdown: true, kdFrames: 42 },
  },

  // ---- SUPER (236236 + special, spends full meter) ----------------------
  // ギアマックス: a 乱舞 - all gears engage for a rapid flurry of gear-driven
  // strikes. 7 hits over the active window; each hit is light (~30) so the total
  // (~210) matches a big super, and the victim stays locked in the flurry.
  super: {
    id: 'super', name: 'ギアマックス', startup: 8, active: 24, recovery: 28,
    hitbox: { x: 4, y: 10, w: 42, h: 38 },
    motion: '236236', button: 'special', meterCost: 100, superFlash: 30,
    multiHit: { hits: 7, interval: 3 },
    hit: { damage: 30, hitstun: 10, blockstun: 8, hitstop: 5, pushbackHit: 1, pushbackBlock: 2, guard: 'mid', chip: 0.15 },
  },
};

export type KnownMoveId = keyof typeof MOVES;
