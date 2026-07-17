// GEAR FIGHT — cut-out puppet rig.
//
// Animates a character from ONE idle drawing by slicing it into rigid parts and
// rotating each about its joint pivot. A mech is literally rigid segments on
// pins, so this reads naturally (and ties into the gear/rotation theme). No
// per-pose art required.
//
// Parts are full-canvas (only their region visible) so at rest (all angles 0)
// they stack back into the exact idle. The rig is a small BONE HIERARCHY of
// nested Containers: each bone's container sits at its joint pivot and rotates
// there; children inherit the transform (so a shin follows its thigh, a forearm
// its upper arm). Facing is one root scaleX flip - a clean mirror.

import Phaser from 'phaser';
import type { CombatFighter } from '../combat/CombatFighter';

export interface RigPart { name: string; pivot: [number, number]; }
export interface RigData {
  canvas: [number, number];
  root: [number, number];
  footAnchor: [number, number];
  parts: RigPart[];
}

interface Bone { name: string; part: string; pivot: [number, number]; children?: Bone[]; }

/** Per-character posing hints. `bladeArm` = the character's weapon is the back
 * (armL) blade, so its rush slashes with armL instead of punching with armR. */
export interface RigStyle { bladeArm?: boolean; }

// The bone TREE (names + hierarchy + z-order) is the same for every humanoid
// character. Only the joint PIVOTS differ per character - those come from the
// character's rig.json (parts[].pivot, looked up by part name). z-order = array
// order (back -> front). Legs are 2-bone (thigh -> shin knee), the front arm too
// (upper -> forearm elbow). `pivot` here is only a fallback if the data lacks it.
const BONES: Bone[] = [
  { name: 'legL', part: 'legL_thigh', pivot: [192, 466], children: [{ name: 'legLShin', part: 'legL_shin', pivot: [150, 588] }] },
  { name: 'legR', part: 'legR_thigh', pivot: [316, 466], children: [{ name: 'legRShin', part: 'legR_shin', pivot: [352, 588] }] },
  { name: 'torso', part: 'torso', pivot: [260, 458] },
  { name: 'armL', part: 'armL', pivot: [168, 250] },
  { name: 'head', part: 'head', pivot: [256, 197] },
  { name: 'armR', part: 'armR_upper', pivot: [372, 258], children: [{ name: 'armRFore', part: 'armR_fore', pivot: [408, 340] }] },
];

export class PuppetRig {
  private root: Phaser.GameObjects.Container;
  private nodes: Record<string, Phaser.GameObjects.Container> = {};
  private ch: number;
  private footX: number; private footY: number;
  private pivotByPart: Record<string, [number, number]> = {};
  private style: RigStyle;
  private walkT = 0;
  private clock = 0;

  constructor(scene: Phaser.Scene, data: RigData, texPrefix: string, depth = 0, style: RigStyle = {}) {
    this.ch = data.canvas[1];
    this.footX = data.footAnchor[0]; this.footY = data.footAnchor[1];
    this.style = style;
    for (const p of data.parts) this.pivotByPart[p.name] = p.pivot;
    this.root = scene.add.container(0, 0).setDepth(depth).setVisible(false);
    for (const b of BONES) this.build(scene, b, this.root, [0, 0], texPrefix);
  }

  private pivotOf(bone: Bone): [number, number] {
    return this.pivotByPart[bone.part] ?? bone.pivot;
  }

  /** Build a bone: a container at (pivot - parentPivot) holding the part image,
   * then recurse into children. All part images use origin (0,0) offset by the
   * bone's own canvas pivot, so at rest the canvas maps 1:1. */
  private build(scene: Phaser.Scene, bone: Bone, parent: Phaser.GameObjects.Container, parentPivot: [number, number], pre: string) {
    const [px, py] = this.pivotOf(bone);
    const c = scene.add.container(px - parentPivot[0], py - parentPivot[1]);
    const img = scene.add.image(-px, -py, `${pre}${bone.part}`).setOrigin(0, 0);
    c.add(img);
    parent.add(c);
    this.nodes[bone.name] = c;
    for (const ch of bone.children ?? []) this.build(scene, ch, c, [px, py], pre);
  }

  setVisible(v: boolean) { this.root.setVisible(v); }
  destroy() { this.root.destroy(); }
  /** Move this rig's display object into a parent container (e.g. a scaled world
   * layer) so it renders in that layer's transform. */
  setParent(container: Phaser.GameObjects.Container) { container.add(this.root); }

  sync(f: CombatFighter, fx: number, feetY: number, displayH: number, facing: 1 | -1) {
    this.root.setVisible(true);
    this.clock += 1;
    const s = displayH / this.ch;
    const pose = this.poseFor(f);
    const sq = pose.squashY ?? 1;
    const rot = (pose.rot ?? 0) * facing; // whole-body tilt (e.g. knockdown), pivots at the feet
    const sx = s * facing, sy = s * sq;
    this.root.setRotation(rot);
    this.root.setScale(sx, sy);
    // place so the foot anchor (+ global dx/dy) lands at (fx, feetY) after rotation
    const ax = (this.footX - (pose.dx ?? 0)) * sx;
    const ay = (this.footY - (pose.dy ?? 0)) * sy;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    this.root.setPosition(fx - (cos * ax - sin * ay), feetY - (sin * ax + cos * ay));
    for (const name in this.nodes) this.nodes[name].rotation = pose.angles[name] ?? 0;
  }

  // ---- posing --------------------------------------------------------------

  /** Alternating leg stride (used for forward walk AND backpedal). Sets the leg
   * angles into A and returns the vertical bob. `armSwing` off preserves guard
   * arms while backpedaling. */
  private stride(A: Record<string, number>, armSwing: boolean): number {
    this.walkT += 0.22;
    const p = this.walkT;
    A.legR = 0.44 * Math.sin(p);
    A.legL = 0.44 * Math.sin(p + Math.PI);
    A.legRShin = 0.6 * Math.max(0, -Math.sin(p));           // flex knee on back-swing
    A.legLShin = 0.6 * Math.max(0, -Math.sin(p + Math.PI));
    if (armSwing) {
      A.armR = -0.10 * Math.sin(p);
      // A blade character HOLDS its weapon arm steady - swinging it as a walk
      // counterbalance made the blade "flap". Only the free (fist) arm swings.
      if (!this.style.bladeArm) A.armL = -0.13 * Math.sin(p + Math.PI);
    }
    return Math.abs(Math.sin(p)) * 4;
  }

  private poseFor(f: CombatFighter): { angles: Record<string, number>; dx?: number; dy?: number; squashY?: number; rot?: number } {
    const A: Record<string, number> = {};
    // moving on the ground while not committed to a move = walking (either way)
    const moving = f.isGrounded() && Math.abs(f.vx) > 0.15;
    switch (f.phase) {
      case 'walk': {
        return { angles: A, dy: this.stride(A, true) };
      }
      case 'crouch': case 'crouchblock': {
        // real crouch: DROP the hips (dy) and FOLD the legs to keep the feet on
        // the floor - the upper body stays full-size (no shrink/"Minimize").
        A.legR = 0.45; A.legL = -0.45; A.legRShin = 1.6; A.legLShin = 1.6;
        A.torso = 0.12; A.head = 0.1; A.armR = -0.15;
        return { angles: A, dy: 120 };
      }
      case 'jumpsquat': case 'air': {
        A.legR = -0.2; A.legL = 0.2; A.legRShin = 0.9; A.legLShin = 0.5; A.armL = -0.3; A.armR = -0.15;
        return { angles: A };
      }
      case 'block': {
        A.armR = -0.55; A.armL = -0.2; A.head = 0.04;
        // retreating (holding back) is the guard-ready phase - still step the legs
        if (moving) return { angles: A, dy: this.stride(A, false) };
        return { angles: A };
      }
      case 'attack': case 'airattack': {
        // snap to full extension fast (by ~frame 3) so the arm is fully out
        // during the brief active frames, not still ramping.
        const t = Math.min(1, f.phaseFrame / 3);
        const heavy = (f.move ?? '').includes('Heavy') || f.move === 'dpunch' || f.move === 'super';
        if (f.move === 'dpunch') {                          // rising anti-air
          if (this.style.bladeArm) {                        // Wizel: ライジングエッジ - blade whips up
            A.armL = 2.3 * t;                               // back-arm blade sweeps skyward
            A.armR = -0.3 * t; A.head = -0.08 * t; A.torso = -0.05 * t;
            A.legR = -0.3 * t; A.legRShin = 0.6 * t;
            return { angles: A, dy: -20 * t };
          }
          A.armR = -2.1 * t; A.armRFore = 0.5 * t; A.legR = -0.3 * t; A.legRShin = 0.6 * t;
          return { angles: A, dy: -20 * t };
        }
        if (f.move === 'throw') {                            // grab: both arms clutch forward
          A.armR = -0.95 * t; A.armRFore = 0.85 * t; A.armL = 0.7 * t; A.head = 0.05 * t;
          return { angles: A, dx: 8 * t };
        }
        if (f.move === 'super') {                            // ギアマックス: 乱舞 flurry
          const pump = Math.sin(f.phaseFrame * 0.85);        // fast alternating jabs
          A.armR = -1.15 - 0.25 * pump; A.armRFore = 1.1 + 0.3 * pump;
          A.armL = -0.5 + 0.7 * pump;                        // back arm alternates forward
          A.head = -0.08; A.torso = 0.14;
          return { angles: A, dx: 22 };
        }
        if (f.move === 'fireball') {
          if (this.style.bladeArm) {                         // Wizel: forward blade-rush slashes
            const slash = Math.sin(f.phaseFrame * 0.7);
            A.armL = 1.15 + 0.5 * slash;                     // back-arm blade sweeps across the front
            A.armR = -0.35; A.head = -0.06; A.torso = 0.16;
            return { angles: A, dx: 20 };
          }
          // Hajime: throw the gear-shot forward
          A.armR = -1.1 * t; A.armRFore = 1.0 * t; A.armL = 0.2 * t; A.head = -0.05 * t;
          return { angles: A, dx: 10 * t };
        }
        // straight punch: swing the upper arm up to horizontal AND open the elbow
        // (positive forearm) so the fist reaches far forward, and step the body
        // into it so the lunge reads even at small scale.
        A.armR = (heavy ? -1.3 : -1.15) * t;
        A.armRFore = (heavy ? 1.35 : 1.15) * t;
        // Blade characters keep the weapon arm planted during a fist punch (no
        // counter-swing = no "flapping" blade); everyone else swings it slightly.
        A.armL = this.style.bladeArm ? 0 : 0.28 * t;
        A.head = -0.06 * t; A.torso = 0.1 * t;
        return { angles: A, dx: (heavy ? 28 : 20) * t };
      }
      case 'hitstun': case 'blockstun': {
        // snap the head/torso back, arms fly up - a clear flinch
        A.head = -0.5; A.torso = -0.12; A.armR = 0.55; A.armRFore = -0.4;
        A.armL = 0.5; A.legR = -0.18; A.legRShin = 0.35;
        return { angles: A, dx: -14 };
      }
      case 'launched': {
        // airborne tumble after a launching hit: back arched, limbs flailing, the
        // whole body slowly spinning as it flies (the scene keeps it at its real
        // airborne height, so it reads as knocked UP from where it was hit, then
        // arcing down - distinct from the grounded knockdown lie below).
        A.head = 0.4; A.torso = -0.25;
        A.armR = 0.85; A.armRFore = -0.5; A.armL = 0.7;
        A.legR = -0.35; A.legRShin = 0.5; A.legL = 0.35; A.legLShin = 0.5;
        const spin = -Math.min(1.5, 0.35 + f.phaseFrame * 0.05);
        return { angles: A, rot: spin, dx: -4 };
      }
      case 'knockdown': {
        // actually TIP OVER onto the back (whole body rotates ~80deg about the
        // feet), legs bent up, arms sprawled - lying on the floor, not buried.
        A.legR = 0.5; A.legL = 0.75; A.legRShin = 1.0; A.legLShin = 1.0;
        A.head = 0.35; A.armL = 0.6; A.armR = 0.5;
        return { angles: A, rot: -1.35, dx: -6 };
      }
      case 'dizzy': {
        // woozy wobble: body sways, head lolls, arms hang loose (stars drawn by
        // the scene over the head)
        const w = Math.sin(this.clock / 16);
        A.head = 0.28 * w; A.torso = 0.1 * w;
        A.armR = 0.3 + 0.15 * w; A.armL = -0.3 - 0.15 * w;
        A.legR = 0.1 * w; A.legL = -0.1 * w;
        return { angles: A, dx: Math.sin(this.clock / 24) * 10 };
      }
      default: {
        const b = Math.sin(this.clock / 42);
        A.head = 0.02 * b; A.armR = 0.03 * b; A.armL = -0.02 * b;
        return { angles: A, dy: -1.5 * b };
      }
    }
  }
}
