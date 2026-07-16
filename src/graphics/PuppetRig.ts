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

// z-order = array order (back -> front). Legs are 2-bone (thigh -> shin knee).
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
  private walkT = 0;
  private clock = 0;

  constructor(scene: Phaser.Scene, data: RigData, texPrefix: string, depth = 0) {
    this.ch = data.canvas[1];
    this.footX = data.footAnchor[0]; this.footY = data.footAnchor[1];
    this.root = scene.add.container(0, 0).setDepth(depth).setVisible(false);
    for (const b of BONES) this.build(scene, b, this.root, [0, 0], texPrefix);
  }

  /** Build a bone: a container at (pivot - parentPivot) holding the part image,
   * then recurse into children. All part images use origin (0,0) offset by the
   * bone's own canvas pivot, so at rest the canvas maps 1:1. */
  private build(scene: Phaser.Scene, bone: Bone, parent: Phaser.GameObjects.Container, parentPivot: [number, number], pre: string) {
    const [px, py] = bone.pivot;
    const c = scene.add.container(px - parentPivot[0], py - parentPivot[1]);
    const img = scene.add.image(-px, -py, `${pre}${bone.part}`).setOrigin(0, 0);
    c.add(img);
    parent.add(c);
    this.nodes[bone.name] = c;
    for (const ch of bone.children ?? []) this.build(scene, ch, c, bone.pivot, pre);
  }

  setVisible(v: boolean) { this.root.setVisible(v); }
  destroy() { this.root.destroy(); }

  sync(f: CombatFighter, fx: number, feetY: number, displayH: number, facing: 1 | -1) {
    this.root.setVisible(true);
    this.clock += 1;
    const s = displayH / this.ch;
    const pose = this.poseFor(f);
    const sq = pose.squashY ?? 1;
    this.root.setScale(s * facing, s * sq);
    this.root.setPosition(
      fx - (this.footX - (pose.dx ?? 0)) * s * facing,
      feetY - (this.footY - (pose.dy ?? 0)) * s * sq,
    );
    for (const name in this.nodes) this.nodes[name].rotation = pose.angles[name] ?? 0;
  }

  // ---- posing --------------------------------------------------------------

  private poseFor(f: CombatFighter): { angles: Record<string, number>; dx?: number; dy?: number; squashY?: number } {
    const A: Record<string, number> = {};
    switch (f.phase) {
      case 'walk': {
        this.walkT += 0.22;
        const p = this.walkT;
        A.legR = 0.44 * Math.sin(p);
        A.legL = 0.44 * Math.sin(p + Math.PI);
        A.legRShin = 0.6 * Math.max(0, -Math.sin(p));           // flex knee on back-swing
        A.legLShin = 0.6 * Math.max(0, -Math.sin(p + Math.PI));
        A.armR = -0.10 * Math.sin(p);
        A.armL = -0.13 * Math.sin(p + Math.PI);
        return { angles: A, dy: Math.abs(Math.sin(p)) * 4 };
      }
      case 'crouch': case 'crouchblock': {
        A.legR = 0.35; A.legL = -0.35; A.legRShin = 0.9; A.legLShin = 0.9; // deep knee bend
        A.head = 0.05;
        return { angles: A, squashY: 0.82 };
      }
      case 'jumpsquat': case 'air': {
        A.legR = -0.2; A.legL = 0.2; A.legRShin = 0.9; A.legLShin = 0.5; A.armL = -0.3; A.armR = -0.15;
        return { angles: A };
      }
      case 'block': {
        A.armR = -0.55; A.armL = -0.2; A.head = 0.04;
        return { angles: A };
      }
      case 'attack': case 'airattack': {
        const t = Math.min(1, Math.max(0, (f.phaseFrame - 1) / 5));
        const heavy = (f.move ?? '').includes('Heavy') || f.move === 'dpunch' || f.move === 'super';
        if (f.move === 'dpunch') {                          // rising uppercut
          A.armR = -2.1 * t; A.armRFore = 0.5 * t; A.legR = -0.3 * t; A.legRShin = 0.6 * t;
          return { angles: A, dy: -20 * t };
        }
        // straight punch: swing the upper arm up to horizontal AND open the elbow
        // (positive forearm) so the fist reaches far forward.
        A.armR = (heavy ? -1.25 : -1.1) * t;
        A.armRFore = (heavy ? 1.25 : 1.05) * t;
        A.armL = 0.25 * t; A.head = -0.05 * t;
        return { angles: A, dx: (heavy ? 18 : 13) * t };
      }
      case 'hitstun': case 'blockstun': {
        A.head = -0.22; A.armR = 0.25; A.armL = 0.3; A.legR = -0.12; A.legRShin = 0.25;
        return { angles: A, dx: -8 };
      }
      case 'knockdown': {
        return { angles: A, squashY: 0.32 };
      }
      case 'dizzy': {
        const w = Math.sin(this.clock / 22) * 0.12;
        A.head = w; A.armR = w; A.armL = -w;
        return { angles: A, dx: Math.sin(this.clock / 30) * 6 };
      }
      default: {
        const b = Math.sin(this.clock / 42);
        A.head = 0.02 * b; A.armR = 0.03 * b; A.armL = -0.02 * b;
        return { angles: A, dy: -1.5 * b };
      }
    }
  }
}
