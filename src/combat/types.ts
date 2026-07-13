// GEAR FIGHT — combat rebuild (Phase 1), engine core.
//
// Design law (decided up front, so art can be authored to fit later instead of
// the other way round): EVERY box is defined in FACING-NORMALIZED local space -
// +x is ALWAYS "forward" (the way the fighter faces), +y is ALWAYS up, origin at
// the feet centre. A move is authored once for a right-facing fighter; the engine
// mirrors it automatically for the left-facing (2P) side. No pose/box ever needs
// a hand-made flipped variant.
//
// The engine is pure logic (no Phaser) and advances in FIXED 60fps frames, so
// frame data is exact and deterministic - the only way to build real fighting
// feel (links, frame traps, punishes) you can actually verify.

/** Axis-aligned box in facing-normalized local space (x forward, y up, feet origin). */
export interface Box {
  x: number; // forward offset of the near edge from the fighter origin
  y: number; // height of the bottom edge above the feet
  w: number;
  h: number;
}

/** Axis-aligned box in world space (feet origin at world x, ground at world y=0, y up). */
export interface WorldBox {
  xmin: number; xmax: number; ymin: number; ymax: number;
}

export interface HitProps {
  damage: number;
  /** frames the victim is locked in hitstun (can't act) on a clean hit. */
  hitstun: number;
  /** frames the victim is locked in blockstun on block. */
  blockstun: number;
  /** frames BOTH fighters freeze on contact (impact weight). */
  hitstop: number;
  /** horizontal shove applied to the victim, per frame, away from the attacker (world px/frame budget). */
  pushbackHit: number;
  pushbackBlock: number;
  /** upward launch velocity (for future juggles); 0 = grounded hit. */
  launch?: number;
  /** true = must be blocked crouching (low); false = high/mid. (Overheads handled later.) */
  low?: boolean;
  /** chip damage dealt even on block, as a fraction of damage. */
  chip?: number;
}

export type MoveId = string;

export interface MoveData {
  id: MoveId;
  name: string;
  /** frames before the hitbox appears. */
  startup: number;
  /** frames the hitbox is live. */
  active: number;
  /** frames of recovery after the active window. */
  recovery: number;
  /** the attack box, live during the active window (facing-normalized). */
  hitbox: Box;
  /** the fighter's vulnerable box(es) while performing this move (overrides the default stance hurtbox). */
  hurtboxes?: Box[];
  hit: HitProps;
  /** moves this can be cancelled into on hit/block, and from which frame the cancel window opens. */
  cancelInto?: MoveId[];
  /** must be crouching to perform (e.g. crouch normals). */
  crouch?: boolean;
  /** must be airborne to perform. */
  air?: boolean;
  /** meter cost (super). */
  meterCost?: number;
  /** super-flash / callout frames on activation. */
  superFlash?: number;
}

/** One frame of player intent, already resolved to facing-relative directions. */
export interface CommandInput {
  /** -1 = holding back (away from opponent), +1 = forward, 0 = neutral. */
  fwd: number;
  /** -1 = down, +1 = up, 0 = neutral. */
  vert: number;
  light: boolean;   // just-pressed this frame
  heavy: boolean;
  special: boolean;
  gearUp: boolean;
  gearDown: boolean;
}

export const EMPTY_COMMAND: CommandInput = {
  fwd: 0, vert: 0, light: false, heavy: false, special: false, gearUp: false, gearDown: false,
};
