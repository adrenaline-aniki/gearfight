// GEAR FIGHT — combat rebuild (Phase 1), move table (frame data).
//
// All boxes are facing-normalized (see types.ts): authored for a right-facing
// fighter, +x forward, +y up, feet origin. The engine mirrors them for 2P.
//
// Frame-data philosophy (traced from SF-style feel, then bent onto the gear
// theme): a LIGHT is a fast, safe-ish poke you can cancel into a HEAVY; a HEAVY
// is slow, high-reward, and does NOT cancel (it's the finisher). "On block" and
// "on hit" advantage come straight out of (recovery+active) vs. blockstun/hitstun
// so links and frame traps are exact and testable.
//
// Gear does NOT live here: the same move is scaled by the fighter's current gear
// (speed/damage) at resolve time (see CombatFighter). That keeps gear as the one
// knob the player learns, instead of five separate move tables.

import type { MoveData } from './types';

// Baseline stance hurtbox (standing) - a fighter is this tall/wide when not
// doing anything that overrides it. Feet at origin, so y starts at 0.
export const STAND_HURTBOX = { x: -9, y: 0, w: 18, h: 46 } as const;
export const CROUCH_HURTBOX = { x: -9, y: 0, w: 18, h: 30 } as const;

// Pushbox (the solid body used to keep fighters from overlapping). Symmetric
// around the feet origin; never mirrored asymmetrically.
export const PUSHBOX = { x: -10, y: 0, w: 20, h: 46 } as const;
export const PUSHBOX_CROUCH = { x: -10, y: 0, w: 20, h: 30 } as const;

export const MOVES: Record<string, MoveData> = {
  // --- LIGHT: 4f startup, +2 on hit / -1 on block. Cancels into heavy. ---
  light: {
    id: 'light',
    name: 'ライトギア',
    startup: 4,
    active: 3,
    recovery: 7,
    // arm extends forward at mid height.
    hitbox: { x: 8, y: 22, w: 22, h: 12 },
    hit: {
      damage: 30,
      hitstun: 12,   // active(3)+recovery(7)=10 after first-active-frame hit -> +2
      blockstun: 9,  // -> -1 on block
      hitstop: 6,
      pushbackHit: 3,
      pushbackBlock: 4,
    },
    cancelInto: ['heavy'],
  },

  // --- HEAVY: 9f startup, big reward, minus on block, no cancel (finisher). ---
  heavy: {
    id: 'heavy',
    name: 'ヘビーギア',
    startup: 9,
    active: 4,
    recovery: 16,
    hitbox: { x: 8, y: 20, w: 30, h: 18 },
    hit: {
      damage: 80,
      hitstun: 18,
      blockstun: 14,
      hitstop: 10,
      pushbackHit: 5,
      pushbackBlock: 6,
      launch: 0,
    },
  },

  // --- CROUCH LIGHT: low, must be blocked crouching. Cancels into heavy. ---
  crouchLight: {
    id: 'crouchLight',
    name: 'ローギア',
    startup: 5,
    active: 3,
    recovery: 8,
    hitbox: { x: 8, y: 6, w: 22, h: 10 },
    hurtboxes: [{ x: -9, y: 0, w: 18, h: 30 }],
    hit: {
      damage: 28,
      hitstun: 12,
      blockstun: 9,
      hitstop: 6,
      pushbackHit: 3,
      pushbackBlock: 4,
      low: true,
    },
    crouch: true,
    cancelInto: ['heavy'],
  },
};

export type KnownMoveId = keyof typeof MOVES;
