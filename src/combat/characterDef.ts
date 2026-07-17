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

// ウィズル — SPEED type (ソニカ's mech): light, fast, no fireball. Its signature is
// オーバーシフト・ラッシュ, a forward blade-rush that multi-hits. Lighter per-hit
// damage and less health than the balanced default, but faster feet + a rushdown
// tool instead of keep-away. (Per 仕様書 §4.2.)
export function makeWizel(): CharacterDef {
  const def = makeDefaultCharacter('wizel', 'ウィズル');
  def.health = 900;
  def.walkSpeed = 2.0;
  def.jumpVy = 6.6;
  // lighter strikes (speed trades power for tempo)
  def.moves.standLight.hit.damage = 26;
  def.moves.standHeavy.hit.damage = 66;
  def.moves.crouchLight.hit.damage = 24;
  // fireball slot -> オーバーシフト・ラッシュ: a dashing multi-hit blade rush
  def.moves.fireball = {
    id: 'fireball', name: 'オーバーシフト・ラッシュ', startup: 8, active: 18, recovery: 22,
    // long, forward-reaching blade box so the target stays inside it through the
    // rush; modest advance so Wizel closes in without overshooting.
    hitbox: { x: 4, y: 12, w: 52, h: 30 },
    motion: '236', button: 'light',
    multiHit: { hits: 5, interval: 3 },
    advance: 2.4,
    hit: { damage: 24, hitstun: 12, blockstun: 8, hitstop: 4, pushbackHit: 0, pushbackBlock: 2, guard: 'mid', chip: 0.1 },
  };
  // dpunch slot -> ライジングエッジ: a fast, low-commitment rising BLADE slash (its
  // own move, not Hajime's アッパーシフト). Speed identity: quicker startup/recovery
  // and a shorter hop, but lighter and less launch - a nimble get-off-me, not a big
  // reversal. The rig slashes it with the back-arm blade (see PuppetRig bladeArm).
  def.moves.dpunch = {
    id: 'dpunch', name: 'ライジングエッジ', startup: 4, active: 8, recovery: 22,
    hitbox: { x: 2, y: 10, w: 26, h: 52 },
    motion: '623', button: 'heavy', startupInvuln: 8,
    hit: { damage: 70, hitstun: 20, blockstun: 14, hitstop: 9, pushbackHit: 3, pushbackBlock: 8, guard: 'mid', launch: 4.4, knockdown: true, kdFrames: 34 },
  };
  return def;
}

// ガンロック — POWER type (ゴウケン's mech): a heavy, slow bruiser. Tanky and slow
// on its feet, but every blow lands like a hammer, and its high-gear (GL4-5)
// damage multiplier + guard-break chip make it a wall of pressure. Signature is
// トルクブレイカー, a single crushing high-torque blow (no flurry - power, not
// speed). It heats fast and manages that heat badly (see the AI), so its lesson
// is the mirror of Wizel's: high torque is devastating but slow, its shifts are
// telegraphed, and holding a high gear cooks the drivetrain. (Per 仕様書 §4.2.)
export function makeGanrock(): CharacterDef {
  const def = makeDefaultCharacter('ganrock', 'ガンロック');
  def.health = 1150;
  def.walkSpeed = 1.2;
  def.jumpVy = 5.9;
  // Heavier, slower normals: the jab is a beat slower, the heavy is a wrecking
  // ball with real reach.
  def.moves.standLight = {
    id: 'standLight', name: '立ち弱', startup: 5, active: 3, recovery: 8,
    hitbox: { x: 8, y: 22, w: 24, h: 12 },
    hit: { damage: 38, hitstun: 12, blockstun: 9, hitstop: 6, pushbackHit: 3, pushbackBlock: 4, guard: 'mid' },
    cancelInto: ['standHeavy', 'crouchHeavy', 'fireball', 'dpunch', 'super'],
  };
  def.moves.standHeavy = {
    id: 'standHeavy', name: '立ち強', startup: 12, active: 4, recovery: 20,
    hitbox: { x: 8, y: 20, w: 34, h: 20 },
    hit: { damage: 115, hitstun: 24, blockstun: 15, hitstop: 12, pushbackHit: 6, pushbackBlock: 8, guard: 'mid' },
    cancelInto: ['fireball', 'super'],
  };
  def.moves.crouchLight.hit.damage = 30;
  def.moves.crouchHeavy.hit.damage = 78;
  // fireball slot -> トルクスイング: a slow, telegraphed, forward-lunging lever-
  // crank haymaker. Long wind-up (the "shift shown big" read), one enormous hit
  // that knocks down and chips hard through guard. Scales with gear like any
  // move, so at GL4-5 it is monstrous.
  def.moves.fireball = {
    id: 'fireball', name: 'トルクスイング', startup: 16, active: 4, recovery: 26,
    hitbox: { x: 6, y: 14, w: 44, h: 34 },
    motion: '236', button: 'heavy',
    advance: 2.0,
    hit: { damage: 78, hitstun: 22, blockstun: 20, hitstop: 12, pushbackHit: 6, pushbackBlock: 10, guard: 'mid', chip: 0.25, knockdown: true },
  };
  // super -> トルクブレイカー: one devastating high-torque blow (NOT a 乱舞). Big,
  // committal, guaranteed knockdown.
  def.moves.super = {
    id: 'super', name: 'トルクブレイカー', startup: 10, active: 5, recovery: 30,
    hitbox: { x: 4, y: 8, w: 46, h: 46 },
    motion: '236236', button: 'special', meterCost: 100, superFlash: 30,
    // one big blow already; keep a beefier gear bonus than ギアマックス (it IS the
    // power type) but still dampened so GL5 doesn't make it an instant 40%+.
    gearScale: 0.6,
    hit: { damage: 150, hitstun: 24, blockstun: 18, hitstop: 12, pushbackHit: 4, pushbackBlock: 10, guard: 'mid', chip: 0.2, knockdown: true, kdFrames: 46 },
  };
  // dpunch slot -> ライジングトルク: a slow, heavy rising smash (its own move, not
  // Hajime's アッパーシフト). Power identity: more startup and a longer, punishable
  // recovery, but a huge blow that launches high and knocks down hard. Whiff it and
  // you eat a full combo - commitment matched to the payoff.
  def.moves.dpunch = {
    id: 'dpunch', name: 'ライジングトルク', startup: 7, active: 8, recovery: 32,
    hitbox: { x: 2, y: 6, w: 34, h: 66 },
    motion: '623', button: 'heavy', startupInvuln: 10,
    hit: { damage: 130, hitstun: 24, blockstun: 18, hitstop: 12, pushbackHit: 4, pushbackBlock: 10, guard: 'mid', launch: 6.2, knockdown: true, kdFrames: 48 },
  };
  // Runs hot and manages it badly: its high gears heat faster than anyone's, so
  // riding GL5 overheats it quickly (a bigger, more punishable window - its
  // signature weakness).
  def.gears[4].heatPerSec = 20;
  def.gears[5].heatPerSec = 42;
  return def;
}

// アイギス — DEFENSE type (カメイ's mech): a walking wall. Highest health, slowest
// feet, sturdy normals, and a shield tackle that plows forward and knocks down.
// Plays the long game: block, soak, and punish with heavy, safe pokes.
export function makeAegis(): CharacterDef {
  const def = makeDefaultCharacter('aegis', 'アイギス');
  def.health = 1250;
  def.walkSpeed = 1.1;
  def.jumpVy = 5.7;
  def.moves.standLight.hit.damage = 32;
  def.moves.standHeavy.hit.damage = 90;
  def.moves.standHeavy.hit.blockstun = 18; // safer heavy on block (a defender's poke)
  // fireball slot -> シールドタックル: an advancing shield bash, guard-chipping and
  // knocking down. The defender's way IN (it doesn't zone; it walls up and rams).
  def.moves.fireball = {
    id: 'fireball', name: 'シールドタックル', startup: 14, active: 6, recovery: 24,
    hitbox: { x: 6, y: 14, w: 40, h: 34 }, motion: '236', button: 'heavy', advance: 2.2,
    hit: { damage: 70, hitstun: 20, blockstun: 18, hitstop: 11, pushbackHit: 6, pushbackBlock: 6, guard: 'mid', chip: 0.2, knockdown: true },
  };
  return def;
}

// ドリフト — SPEED / TRICKSTER type (リン's mech): the mirror of Wizel. Where Wizel
// glues itself to your face, Drift is a hit-and-run mixup fighter built on movement
// and SPACE CONTROL. Fastest feet, lightest health, twin-claw pokes with a little
// more reach, and its signature: オイルトラップ, a floor hazard that trips whoever
// steps on it (Drift is immune - the old "unaffected by terrain" identity). Set a
// trap, zip around, and punish when they slip.
export function makeDrift(): CharacterDef {
  const def = makeDefaultCharacter('drift', 'ドリフト');
  def.health = 860;
  def.walkSpeed = 2.2;
  def.jumpVy = 6.8;
  // claws: a touch more reach than the norm, light and quick
  def.moves.standLight.hit.damage = 26;
  def.moves.standLight.hitbox = { x: 8, y: 22, w: 26, h: 12 };
  def.moves.standHeavy.hit.damage = 64;
  def.moves.standHeavy.hitbox = { x: 8, y: 20, w: 34, h: 18 };
  // fireball slot -> オイルトラップ: place a slick on the ground just ahead. It sits
  // there (a zero-speed projectile) and TRIPS a grounded opponent who walks over it
  // (a low - crouch-blockable, jumpable). Only the opponent can trigger it, so Drift
  // walks over its own trap freely. Pure space control / okizeme, not damage.
  def.moves.fireball = {
    id: 'fireball', name: 'オイルトラップ', startup: 14, active: 2, recovery: 22,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, motion: '236', button: 'light',
    projectile: {
      speed: 0, box: { x: 22, y: 0, w: 34, h: 12 }, life: 200,
      hit: { damage: 28, hitstun: 16, blockstun: 12, hitstop: 8, pushbackHit: 2, pushbackBlock: 2, guard: 'low', knockdown: true, kdFrames: 34 },
    },
    hit: { damage: 0, hitstun: 0, blockstun: 0, hitstop: 0, pushbackHit: 0, pushbackBlock: 0 },
  };
  return def;
}

// テオリオン — TECHNICAL zoner (カイ's mech): a poised blade-knight who controls
// space with a fast crescent projectile and long, clean pokes. Balanced stats,
// slightly better reach; wants to play keep-away and whiff-punish.
export function makeTheorion(): CharacterDef {
  const def = makeDefaultCharacter('theorion', 'テオリオン');
  def.health = 1000;
  def.walkSpeed = 1.6;
  def.jumpVy = 6.3;
  def.moves.standHeavy.hitbox = { x: 8, y: 20, w: 34, h: 18 }; // blade reach
  // fireball -> 三日月ウェーブ: a fast, thin crescent projectile (zoner's tool).
  def.moves.fireball = {
    id: 'fireball', name: '三日月ウェーブ', startup: 12, active: 2, recovery: 28,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, motion: '236', button: 'light',
    projectile: {
      speed: 4.2, box: { x: 0, y: 18, w: 20, h: 22 }, life: 130,
      hit: { damage: 40, hitstun: 18, blockstun: 14, hitstop: 6, pushbackHit: 4, pushbackBlock: 2, chip: 0.25, guard: 'mid' },
    },
    hit: { damage: 0, hitstun: 0, blockstun: 0, hitstop: 0, pushbackHit: 0, pushbackBlock: 0 },
  };
  return def;
}

// オメガノヴァ — FINAL BOSS (レイ's mech): a powerful all-rounder that hits harder
// than anyone across the board, with a big slow dark projectile. Deliberately
// strong (it's the wall at the top of the ladder); the pros will tune it down.
export function makeOmeganova(): CharacterDef {
  const def = makeDefaultCharacter('omeganova', 'オメガノヴァ');
  def.health = 1200;
  def.walkSpeed = 1.35;
  def.jumpVy = 6.0;
  def.moves.standLight.hit.damage = 34;
  def.moves.standHeavy.hit.damage = 100;
  def.moves.crouchHeavy.hit.damage = 72;
  // fireball -> ダークネビュラ: a big, slow, heavy-hitting orb (boss zoning).
  def.moves.fireball = {
    id: 'fireball', name: 'ダークネビュラ', startup: 14, active: 2, recovery: 30,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, motion: '236', button: 'light',
    projectile: {
      speed: 2.4, box: { x: 0, y: 14, w: 24, h: 26 }, life: 150,
      hit: { damage: 60, hitstun: 20, blockstun: 16, hitstop: 8, pushbackHit: 4, pushbackBlock: 3, chip: 0.3, guard: 'mid' },
    },
    hit: { damage: 0, hitstun: 0, blockstun: 0, hitstop: 0, pushbackHit: 0, pushbackBlock: 0 },
  };
  return def;
}

// ソフィス・レギオン — HIDDEN BOSS (ノギ's mech): a technical ice fighter. Strong and
// precise, with a frost lance that freezes the opponent in long blockstun to open
// them up. A high-execution wall behind the final boss.
export function makeSophislegion(): CharacterDef {
  const def = makeDefaultCharacter('sophislegion', 'ソフィス・レギオン');
  def.health = 1150;
  def.walkSpeed = 1.45;
  def.jumpVy = 6.2;
  def.moves.standHeavy.hit.damage = 84;
  // fireball -> フロストランス: a medium ice projectile with heavy blockstun (freeze).
  def.moves.fireball = {
    id: 'fireball', name: 'フロストランス', startup: 13, active: 2, recovery: 28,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, motion: '236', button: 'light',
    projectile: {
      speed: 3.2, box: { x: 0, y: 16, w: 22, h: 20 }, life: 140,
      hit: { damage: 45, hitstun: 22, blockstun: 20, hitstop: 8, pushbackHit: 3, pushbackBlock: 1, chip: 0.25, guard: 'mid' },
    },
    hit: { damage: 0, hitstun: 0, blockstun: 0, hitstop: 0, pushbackHit: 0, pushbackBlock: 0 },
  };
  return def;
}
