// GEAR FIGHT — cut-out puppet rig.
//
// Animates a character from ONE idle drawing by slicing it into rigid parts
// (head/torso/arms/legs) and rotating each around its joint pivot. A mech is
// literally rigid segments turning on pins, so this reads naturally (and ties
// into the gear/rotation theme). No per-pose art required.
//
// Each part texture is the FULL source canvas with only that part visible, so
// at rest (all angles 0) the parts stack back into the exact idle. All parts
// live in a Container placed at the canvas origin; each part's image origin is
// its joint pivot, so rotating a part turns it about its joint. Facing is a
// single container scaleX flip (composes cleanly - no per-part mirroring math).

import Phaser from 'phaser';
import type { CombatFighter } from '../combat/CombatFighter';

export interface RigPart { name: string; pivot: [number, number]; }
export interface RigData {
  canvas: [number, number];
  root: [number, number];
  footAnchor: [number, number];
  parts: RigPart[];
}

// draw order back -> front
const Z_ORDER = ['legL', 'legR', 'torso', 'armL', 'head', 'armR'];

export class PuppetRig {
  private container: Phaser.GameObjects.Container;
  private imgs: Record<string, Phaser.GameObjects.Image> = {};
  private pivots: Record<string, [number, number]> = {};
  private cw: number; private ch: number;
  private footX: number; private footY: number;
  private walkT = 0;   // advances while walking
  private clock = 0;   // always-on, for idle breathing

  constructor(scene: Phaser.Scene, data: RigData, texPrefix: string, depth = 0) {
    this.cw = data.canvas[0]; this.ch = data.canvas[1];
    this.footX = data.footAnchor[0]; this.footY = data.footAnchor[1];
    for (const p of data.parts) this.pivots[p.name] = p.pivot;
    this.container = scene.add.container(0, 0).setDepth(depth).setVisible(false);
    for (const name of Z_ORDER) {
      const [jx, jy] = this.pivots[name] ?? [this.cw / 2, this.ch / 2];
      const img = scene.add.image(jx, jy, `${texPrefix}${name}`).setOrigin(jx / this.cw, jy / this.ch);
      this.imgs[name] = img;
      this.container.add(img);
    }
  }

  setVisible(v: boolean) { this.container.setVisible(v); }
  destroy() { this.container.destroy(); }

  /** Position + pose the rig for a fighter. fx/feetY are screen coords, displayH
   * the on-screen character height, facing +1/-1. */
  sync(f: CombatFighter, fx: number, feetY: number, displayH: number, facing: 1 | -1) {
    this.container.setVisible(true);
    this.clock += 1;
    const s = displayH / this.ch;
    const pose = this.poseFor(f);
    const sq = pose.squashY ?? 1;

    // whole-body placement: canvas foot anchor -> (fx, feetY), plus global shift
    this.container.setScale(s * facing, s * sq);
    this.container.setPosition(
      fx - (this.footX - (pose.dx ?? 0)) * s * facing,
      feetY - (this.footY - (pose.dy ?? 0)) * s * sq,
    );
    for (const name of Z_ORDER) this.imgs[name].rotation = pose.angles[name] ?? 0;
  }

  // ---- posing --------------------------------------------------------------

  private poseFor(f: CombatFighter): { angles: Record<string, number>; dx?: number; dy?: number; squashY?: number } {
    const A: Record<string, number> = {};
    switch (f.phase) {
      case 'walk': {
        this.walkT += 0.22;
        const p = this.walkT;
        A.legR = 0.30 * Math.sin(p);
        A.legL = 0.30 * Math.sin(p + Math.PI);
        A.armR = -0.10 * Math.sin(p);
        A.armL = -0.13 * Math.sin(p + Math.PI);
        return { angles: A, dy: Math.abs(Math.sin(p)) * 4 }; // small down-bob at strides
      }
      case 'crouch': case 'crouchblock': {
        A.legR = 0.5; A.legL = -0.5;             // spread stance
        A.head = 0.05;
        return { angles: A, squashY: 0.72 };     // squash toward planted feet = crouch
      }
      case 'jumpsquat': case 'air': {
        A.legR = -0.35; A.legL = 0.35; A.armL = -0.3; A.armR = -0.15;
        return { angles: A };
      }
      case 'block': {
        A.armR = -0.55; A.armL = -0.2; A.head = 0.04;
        return { angles: A };
      }
      case 'attack': case 'airattack': {
        const t = Math.min(1, Math.max(0, (f.phaseFrame - 1) / 5)); // ramp over startup
        const heavy = (f.move ?? '').includes('Heavy') || f.move === 'dpunch' || f.move === 'super';
        if (f.move === 'dpunch') { A.armR = -1.7 * t; A.legR = -0.3 * t; return { angles: A, dy: -20 * t }; }
        A.armR = (heavy ? -1.35 : -1.15) * t;      // straighten the front arm forward
        A.armL = 0.25 * t;
        A.head = -0.05 * t;
        return { angles: A, dx: (heavy ? 10 : 6) * t };
      }
      case 'hitstun': case 'blockstun': {
        A.head = -0.22; A.armR = 0.25; A.armL = 0.3; A.legR = -0.12;
        return { angles: A, dx: -8 };
      }
      case 'knockdown': {
        return { angles: A, squashY: 0.32 }; // flatten toward the floor
      }
      case 'dizzy': {
        const w = Math.sin(this.clock / 22) * 0.12;
        A.head = w; A.armR = w; A.armL = -w;
        return { angles: A, dx: Math.sin(this.clock / 30) * 6 };
      }
      default: { // idle - subtle breathing
        const b = Math.sin(this.clock / 42);
        A.head = 0.02 * b; A.armR = 0.03 * b; A.armL = -0.02 * b;
        return { angles: A, dy: -1.5 * b };
      }
    }
  }
}
