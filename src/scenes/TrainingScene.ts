import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_Y, PIXEL_FONT } from '../config/constants';
import { CombatEngine } from '../combat/CombatEngine';
import { CombatFighter } from '../combat/CombatFighter';
import { EMPTY_COMMAND, type CommandInput } from '../combat/types';

// GEAR FIGHT — combat rebuild (Phase 1), presentation layer.
//
// This is deliberately a TRAINING view: it draws the engine's actual
// hit/hurt/push boxes (the "labo" view a fighting-game dev works in) over a
// placeholder capsule per fighter, so the FEEL of the new engine can be tuned
// and verified before any final sprite art exists. Sprites drop in later as a
// skin on top of these same boxes.
//
// The engine is fixed-60fps and pure logic; this scene only (a) collects input,
// (b) advances the engine on a fixed-timestep accumulator, (c) draws. World<->
// screen: worldX maps 1:1 to screenX; worldY is height-above-ground (up = +),
// so screenY = GROUND_Y - worldY.

const FIXED_DT = 1000 / 60;

interface RawHold { left: boolean; right: boolean; up: boolean; down: boolean; }

export class TrainingScene extends Phaser.Scene {
  private engine!: CombatEngine;
  private gfx!: Phaser.GameObjects.Graphics;
  private capsuleGfx!: Phaser.GameObjects.Graphics;
  private hudP1!: Phaser.GameObjects.Text;
  private hudP2!: Phaser.GameObjects.Text;
  private healthBarP1!: Phaser.GameObjects.Graphics;
  private accumulator = 0;

  // keyboard
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  // per-render-frame just-pressed latches (consumed on the next engine sub-step)
  private p1Press = { light: false, heavy: false, special: false, gearUp: false, gearDown: false };
  private p2Press = { light: false, heavy: false, special: false, gearUp: false, gearDown: false };

  // touch state
  private touchHold: RawHold = { left: false, right: false, up: false, down: false };
  private touchPress = { light: false, heavy: false, special: false, gearUp: false, gearDown: false };

  constructor() {
    super('TrainingScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#101820');
    this.engine = new CombatEngine();
    this.accumulator = 0;

    // ground line
    const ground = this.add.graphics();
    ground.lineStyle(1, 0x2a3a4a, 1);
    ground.lineBetween(0, GROUND_Y, GAME_WIDTH, GROUND_Y);
    ground.fillStyle(0x0a0f14, 1);
    ground.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);

    this.capsuleGfx = this.add.graphics();
    this.gfx = this.add.graphics();

    // health bars (simple)
    this.healthBarP1 = this.add.graphics();

    this.hudP1 = this.add.text(4, 26, '', { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#8fd6ff' }).setResolution(2);
    this.hudP2 = this.add.text(GAME_WIDTH - 4, 26, '', { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#ffb38f' })
      .setOrigin(1, 0).setResolution(2);

    this.add.text(GAME_WIDTH / 2, 4, 'TRAINING — 箱表示', { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#ffffff' })
      .setOrigin(0.5, 0).setResolution(2);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 10,
      '←→移動  ↓しゃがみ  ↑ジャンプ  Z弱  X強  Q/Eギア  ESC戻る',
      { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#556677' }).setOrigin(0.5, 1).setResolution(2);

    this.setupKeyboard();
    this.setupTouch();

    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('ModeSelectScene'));
  }

  private setupKeyboard() {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.keys = kb.addKeys({
      left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN',
      light: 'Z', heavy: 'X', special: 'C', gearUp: 'E', gearDown: 'Q',
      // P2 (optional local sparring)
      p2Left: 'A', p2Right: 'D', p2Up: 'W', p2Down: 'S',
      p2Light: 'J', p2Heavy: 'K', p2Special: 'L', p2GearUp: 'O', p2GearDown: 'I',
    }) as Record<string, Phaser.Input.Keyboard.Key>;
  }

  // Minimal on-screen touch controls: a d-pad-ish left cluster and attack/gear
  // buttons on the right. Enough to feel the engine on a phone; the polished
  // car-shifter layout comes once the engine is locked.
  private setupTouch() {
    const mk = (x: number, y: number, r: number, label: string, color: number,
                onDown: () => void, onUp?: () => void) => {
      const g = this.add.graphics();
      g.fillStyle(color, 0.28); g.fillCircle(x, y, r);
      g.lineStyle(1, color, 0.7); g.strokeCircle(x, y, r);
      const t = this.add.text(x, y, label, { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#ffffff' })
        .setOrigin(0.5).setResolution(2);
      const zone = this.add.zone(x, y, r * 2, r * 2).setCircleDropZone(r).setInteractive();
      zone.on('pointerdown', onDown);
      if (onUp) { zone.on('pointerup', onUp); zone.on('pointerout', onUp); }
      void t;
      return g;
    };
    const by = GAME_HEIGHT - 46;
    // movement
    mk(20, by, 12, '←', 0x88aacc, () => { this.touchHold.left = true; }, () => { this.touchHold.left = false; });
    mk(48, by, 12, '→', 0x88aacc, () => { this.touchHold.right = true; }, () => { this.touchHold.right = false; });
    mk(34, by - 24, 12, '↑', 0x88cc88, () => { this.touchHold.up = true; },
       () => { this.touchHold.up = false; });
    mk(34, by + 20, 12, '↓', 0x88aacc, () => { this.touchHold.down = true; }, () => { this.touchHold.down = false; });
    // attacks
    mk(GAME_WIDTH - 22, by, 13, '弱', 0xffdd66, () => { this.touchPress.light = true; });
    mk(GAME_WIDTH - 52, by, 13, '強', 0xff8866, () => { this.touchPress.heavy = true; });
    // gear
    mk(GAME_WIDTH - 22, by - 30, 11, 'G+', 0x66ddaa, () => { this.touchPress.gearUp = true; });
    mk(GAME_WIDTH - 52, by - 30, 11, 'G-', 0x66ddaa, () => { this.touchPress.gearDown = true; });
  }

  // ---- input plumbing ----------------------------------------------------

  update(_time: number, delta: number) {
    this.latchPresses();

    this.accumulator += Math.min(delta, 100); // clamp huge frame gaps
    let firstSub = true;
    while (this.accumulator >= FIXED_DT) {
      this.accumulator -= FIXED_DT;
      const in1 = this.buildInput(this.engine.p1, 'p1', firstSub);
      const in2 = this.buildInput(this.engine.p2, 'p2', firstSub);
      this.engine.step(in1, in2);
      firstSub = false;
    }
    // presses are consumed after the frame's sub-steps
    this.clearPresses();
    this.draw();
  }

  /** Capture just-pressed keys once per render frame (before sub-stepping). */
  private latchPresses() {
    if (!this.keys) return;
    const jd = Phaser.Input.Keyboard.JustDown;
    this.p1Press.light = jd(this.keys.light) || this.touchPress.light;
    this.p1Press.heavy = jd(this.keys.heavy) || this.touchPress.heavy;
    this.p1Press.special = jd(this.keys.special) || this.touchPress.special;
    this.p1Press.gearUp = jd(this.keys.gearUp) || this.touchPress.gearUp;
    this.p1Press.gearDown = jd(this.keys.gearDown) || this.touchPress.gearDown;

    this.p2Press.light = jd(this.keys.p2Light);
    this.p2Press.heavy = jd(this.keys.p2Heavy);
    this.p2Press.special = jd(this.keys.p2Special);
    this.p2Press.gearUp = jd(this.keys.p2GearUp);
    this.p2Press.gearDown = jd(this.keys.p2GearDown);
  }

  private clearPresses() {
    this.touchPress.light = this.touchPress.heavy = this.touchPress.special = false;
    this.touchPress.gearUp = this.touchPress.gearDown = false;
  }

  private buildInput(f: CombatFighter, who: 'p1' | 'p2', firstSub: boolean): CommandInput {
    if (!this.keys) return EMPTY_COMMAND;
    const hold: RawHold = who === 'p1'
      ? {
          left: this.keys.left.isDown || this.touchHold.left,
          right: this.keys.right.isDown || this.touchHold.right,
          up: this.keys.up.isDown || this.touchHold.up,
          down: this.keys.down.isDown || this.touchHold.down,
        }
      : {
          left: this.keys.p2Left.isDown,
          right: this.keys.p2Right.isDown,
          up: this.keys.p2Up.isDown,
          down: this.keys.p2Down.isDown,
        };
    const press = who === 'p1' ? this.p1Press : this.p2Press;

    // absolute x -> facing-relative forward
    const absX = hold.right ? 1 : hold.left ? -1 : 0;
    const fwd = absX * f.facing;
    const vert = hold.up ? 1 : hold.down ? -1 : 0;

    // "just pressed" only applies on the first sub-step of a render frame; on
    // later sub-steps it's already been consumed (buffering handles leniency).
    const p = firstSub;
    return {
      fwd, vert,
      light: p && press.light,
      heavy: p && press.heavy,
      special: p && press.special,
      gearUp: p && press.gearUp,
      gearDown: p && press.gearDown,
    };
  }

  // ---- rendering ---------------------------------------------------------

  private draw() {
    const g = this.gfx;
    g.clear();
    this.capsuleGfx.clear();

    this.drawFighter(this.engine.p1, 0x4488ff);
    this.drawFighter(this.engine.p2, 0xff8844);

    // hitboxes on top (red), from whichever fighter is attacking
    for (const f of [this.engine.p1, this.engine.p2]) {
      const hb = f.getHitboxWorld();
      if (hb) this.strokeWorld(g, hb, 0xff3344, 0.35, 0xff3344);
    }

    this.drawHealth();
    this.hudP1.setText(this.describe(this.engine.p1));
    this.hudP2.setText(this.describe(this.engine.p2));
  }

  private drawFighter(f: CombatFighter, capsuleColor: number) {
    // placeholder capsule = the current pushbox footprint, filled.
    const push = f.getPushbox();
    this.capsuleGfx.fillStyle(capsuleColor, 0.55);
    const sx = push.xmin, sw = push.xmax - push.xmin;
    const top = GROUND_Y - push.ymax, h = push.ymax - push.ymin;
    this.capsuleGfx.fillRoundedRect(sx, top, sw, h, 4);
    // facing tick (a nub on the front edge)
    this.capsuleGfx.fillStyle(0xffffff, 0.9);
    const frontX = f.facing === 1 ? push.xmax - 2 : push.xmin;
    this.capsuleGfx.fillRect(frontX, GROUND_Y - push.ymax + 4, 2, 4);

    // pushbox (yellow) + hurtboxes (blue)
    this.strokeWorld(this.gfx, push, 0xffcc33, 0.0, 0xffcc33, 0.5);
    for (const hurt of f.getHurtboxesWorld()) {
      this.strokeWorld(this.gfx, hurt, 0x33aaff, 0.12, 0x33aaff);
    }
  }

  private strokeWorld(g: Phaser.GameObjects.Graphics, b: { xmin: number; xmax: number; ymin: number; ymax: number },
                      lineColor: number, fillAlpha: number, fillColor: number, lineAlpha = 1) {
    const x = b.xmin, w = b.xmax - b.xmin;
    const top = GROUND_Y - b.ymax, h = b.ymax - b.ymin;
    if (fillAlpha > 0) { g.fillStyle(fillColor, fillAlpha); g.fillRect(x, top, w, h); }
    g.lineStyle(1, lineColor, lineAlpha);
    g.strokeRect(x, top, w, h);
  }

  private drawHealth() {
    const g = this.healthBarP1;
    g.clear();
    const draw = (x: number, w: number, frac: number, color: number, rightAlign: boolean) => {
      g.fillStyle(0x222833, 1); g.fillRect(x, 14, w, 6);
      g.fillStyle(color, 1);
      const fw = Math.max(0, Math.round(w * frac));
      g.fillRect(rightAlign ? x + w - fw : x, 14, fw, 6);
      g.lineStyle(1, 0x000000, 1); g.strokeRect(x, 14, w, 6);
    };
    draw(6, 150, this.engine.p1.health / 1000, 0x44dd66, false);
    draw(GAME_WIDTH - 156, 150, this.engine.p2.health / 1000, 0xdd6644, true);
  }

  private describe(f: CombatFighter): string {
    const mv = f.move ? `${f.move}:${f.phaseFrame}` : f.phase;
    return `GL${f.gear} ${mv}\nHP${f.health} SP${f.meter}`;
  }
}
