// GEAR FIGHT — the "2D fighting-game maker" data model.
//
// A CharacterDef is EVERYTHING an author edits to make a fighter: its stats, its
// boxes, its gear table, and its moves (each move being frame data + a hitbox).
// It is plain JSON-serializable data - no code, no Phaser - so it can be created
// in an in-browser editor, saved to localStorage, exported/imported as a file,
// and fed straight into the engine. The engine (CombatFighter) reads a def and
// never hardcodes a character again.
//
// This is the pivot from "a game with hardcoded characters" to "a tool that
// runs any character you author."

import type { Box, MoveData } from './types';
import type { GearSpec } from './CombatFighter';
import { MOVES, STAND_HURTBOX, CROUCH_HURTBOX, PUSHBOX, PUSHBOX_CROUCH } from './moves';
import { COMBAT_GEARS } from './CombatFighter';

export interface CharacterDef {
  id: string;
  name: string;
  /** starting/most health. */
  health: number;
  /** base walk speed (world px/frame) at gear 3; gears scale it. */
  walkSpeed: number;
  /** initial jump velocity (px/frame). */
  jumpVy: number;
  /** standing / crouching vulnerable boxes (facing-normalized, feet origin). */
  standHurtbox: Box;
  crouchHurtbox: Box;
  /** solid body boxes used for push separation. */
  pushbox: Box;
  crouchPushbox: Box;
  /** the five gear specs (speed/damage/frame multipliers etc). */
  gears: Record<number, GearSpec>;
  /** the move table, keyed by move id (light/heavy/crouchLight/... plus any the author adds). */
  moves: Record<string, MoveData>;
}

// A deep clone so callers can freely mutate a def (the editor does) without
// scribbling on shared source objects.
export function cloneCharacter(def: CharacterDef): CharacterDef {
  return JSON.parse(JSON.stringify(def)) as CharacterDef;
}

// The built-in default fighter, assembled from the hand-tuned Phase-1 values.
// New characters start as a clone of this and get edited from there.
export function makeDefaultCharacter(id = 'proto', name = 'プロト'): CharacterDef {
  return {
    id,
    name,
    health: 1000,
    walkSpeed: 1.5,
    jumpVy: 6.2,
    standHurtbox: { ...STAND_HURTBOX },
    crouchHurtbox: { ...CROUCH_HURTBOX },
    pushbox: { ...PUSHBOX },
    crouchPushbox: { ...PUSHBOX_CROUCH },
    gears: cloneGears(COMBAT_GEARS),
    moves: JSON.parse(JSON.stringify(MOVES)) as Record<string, MoveData>,
  };
}

function cloneGears(g: Record<number, GearSpec>): Record<number, GearSpec> {
  const out: Record<number, GearSpec> = {};
  for (const k of Object.keys(g)) out[+k] = { ...g[+k] };
  return out;
}
