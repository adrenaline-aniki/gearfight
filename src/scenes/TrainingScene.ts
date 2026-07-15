import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_Y, PIXEL_FONT } from '../config/constants';
import { CombatEngine, projectileWorld } from '../combat/CombatEngine';
import { CombatFighter } from '../combat/CombatFighter';
import { EMPTY_COMMAND, type CommandInput } from '../combat/types';
import { makeDefaultCharacter, cloneCharacter, type CharacterDef } from '../combat/characterDef';
import { loadCharacter } from '../combat/characterStore';
import { CombatAI, type DummyMode } from '../combat/CombatAI';

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
  private p1Press = { light: false, heavy: false, special: false, throw: false, gearUp: false, gearDown: false };
  private p2Press = { light: false, heavy: false, special: false, throw: false, gearUp: false, gearDown: false };

  // Jump fires on the RISING EDGE of "up" (newly pressed), not while held - so
  // holding up (keyboard or stick) doesn't machine-gun a jump on every landing.
  private prevUpP1 = false;
  private prevUpP2 = false;
  private jumpEdgeP1 = false;
  private jumpEdgeP2 = false;

  // touch state
  private touchHold: RawHold = { left: false, right: false, up: false, down: false };
  private touchPress = { light: false, heavy: false, special: false, throw: false, gearUp: false, gearDown: false };
  // Hold buttons are hit-tested against ALL active pointers every pointer event
  // (down/move/up), so a hold reliably RELEASES the instant no finger is on it -
  // Phaser's per-object pointerup/pointerout is unreliable for touch and left the
  // "walk right forever / stuck jumping" holds latched on.
  private holdButtons: { x: number; y: number; r: number; color: number; g: Phaser.GameObjects.Graphics; set: (v: boolean) => void }[] = [];

  // Virtual analog stick (movement): one finger, 8-way. Owned by whichever
  // pointer first lands in its zone; polled from live pointer state each frame so
  // release is reliable. Diagonals feed jumps (up-fwd), crouch-block (down-back), etc.
  private stickBaseX = 44;
  private stickBaseY = GAME_HEIGHT - 42;
  private stickRadius = 26;
  private stickPointerId: number | null = null;
  private stickBaseGfx!: Phaser.GameObjects.Graphics;
  private stickKnobGfx!: Phaser.GameObjects.Graphics;

  private testDef?: CharacterDef;
  private returnScene = 'ModeSelectScene';

  // training dummy (P2): CPU fights back, guard blocks all, stand is passive.
  private ai = new CombatAI();
  private dummyMode: DummyMode = 'cpu';
  private dummyBtn?: Phaser.GameObjects.Text;
  private p2Keyboard = false; // true = local 2P on keyboard instead of dummy

  // match system: best-of-3 rounds, 60s timer, KO / time-over judgement.
  private p1def!: CharacterDef;
  private p2def!: CharacterDef;
  private matchOn = false;
  private roundPhase: 'intro' | 'fight' | 'over' | 'matchover' = 'fight';
  private phaseTimer = 0;   // frames left in a non-fight phase
  private roundTimer = 0;   // frames left in the current round
  private fightFlash = 0;   // frames to keep showing "FIGHT!"
  private p1Wins = 0;
  private p2Wins = 0;
  private roundNum = 1;
  private matchBtn?: Phaser.GameObjects.Text;
  private centerText?: Phaser.GameObjects.Text;
  private timerText?: Phaser.GameObjects.Text;
  private pipsGfx?: Phaser.GameObjects.Graphics;

  constructor() {
    super('TrainingScene');
  }

  init(data?: { def?: CharacterDef; from?: string }) {
    this.testDef = data?.def;
    this.returnScene = data?.from ?? 'ModeSelectScene';
  }

  create() {
    this.cameras.main.setBackgroundColor('#101820');
    // P1 is the character under test (passed from the editor, else the saved
    // working character); P2 is a default sparring dummy.
    this.p1def = cloneCharacter(this.testDef ?? loadCharacter());
    this.p2def = makeDefaultCharacter('dummy', 'ダミー');
    this.engine = new CombatEngine(cloneCharacter(this.p1def), cloneCharacter(this.p2def));
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

    this.add.text(GAME_WIDTH / 2, 4, 'TRAINING — 箱表示 v3', { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#ffffff' })
      .setOrigin(0.5, 0).setResolution(2);

    // Dummy-mode toggle: CPU (fights back) -> ガード (blocks all) -> 棒立ち -> 2P.
    this.dummyBtn = this.add.text(GAME_WIDTH / 2, 16, '', {
      fontFamily: PIXEL_FONT, fontSize: '10px', color: '#fff', backgroundColor: '#2c4', padding: { x: 6, y: 1 },
    }).setOrigin(0.5, 0).setResolution(2).setInteractive({ useHandCursor: true });
    this.dummyBtn.on('pointerdown', () => this.cycleDummy());
    this.refreshDummyBtn();

    // Match controls / HUD.
    this.matchBtn = this.add.text(GAME_WIDTH - 6, 4, '試合開始 ▶', {
      fontFamily: PIXEL_FONT, fontSize: '10px', color: '#fff', backgroundColor: '#a53', padding: { x: 4, y: 1 },
    }).setOrigin(1, 0).setResolution(2).setInteractive({ useHandCursor: true });
    this.matchBtn.on('pointerdown', () => this.matchOn ? this.endMatch() : this.startMatch());
    this.pipsGfx = this.add.graphics();
    this.timerText = this.add.text(GAME_WIDTH / 2, 22, '', {
      fontFamily: PIXEL_FONT, fontSize: '20px', color: '#ffe37a', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setResolution(2);
    this.centerText = this.add.text(GAME_WIDTH / 2, 70, '', {
      fontFamily: PIXEL_FONT, fontSize: '30px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4, align: 'center',
    }).setOrigin(0.5).setResolution(2).setDepth(50);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 10,
      'スティック移動  Z弱 X強 V投げ(密着)  236波動 623昇龍  タッチ:投/波/昇/超',
      { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#556677' }).setOrigin(0.5, 1).setResolution(2);

    this.setupKeyboard();
    this.setupTouch();
    this.setupStick();

    this.input.keyboard?.on('keydown-ESC', () => this.scene.start(this.returnScene));

    // "← 戻る" button (touch): return to editor or mode select.
    this.add.text(4, 4, '← 戻る', { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#aabbcc' })
      .setResolution(2).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(this.returnScene));
  }

  private setupKeyboard() {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.keys = kb.addKeys({
      left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN',
      light: 'Z', heavy: 'X', special: 'C', throw: 'V', gearUp: 'E', gearDown: 'Q',
      // P2 (optional local sparring)
      p2Left: 'A', p2Right: 'D', p2Up: 'W', p2Down: 'S',
      p2Light: 'J', p2Heavy: 'K', p2Special: 'L', p2Throw: 'B', p2GearUp: 'O', p2GearDown: 'I',
    }) as Record<string, Phaser.Input.Keyboard.Key>;
  }

  // Minimal on-screen touch controls: a d-pad-ish left cluster and attack/gear
  // buttons on the right. Enough to feel the engine on a phone; the polished
  // car-shifter layout comes once the engine is locked.
  //
  // HOLD buttons (movement) register their circle in holdButtons and are
  // recomputed from every active pointer on each pointer event, so they release
  // cleanly. PRESS buttons (jump/attack/gear) fire a one-shot pulse on pointerdown.
  private setupTouch() {
    const drawBtn = (x: number, y: number, r: number, label: string, color: number) => {
      const g = this.add.graphics();
      g.fillStyle(color, 0.28); g.fillCircle(x, y, r);
      g.lineStyle(1, color, 0.7); g.strokeCircle(x, y, r);
      this.add.text(x, y, label, { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#ffffff' })
        .setOrigin(0.5).setResolution(2);
      return g;
    };
    const hold = (x: number, y: number, r: number, label: string, color: number, set: (v: boolean) => void) => {
      const g = drawBtn(x, y, r, label, color);
      this.holdButtons.push({ x, y, r: r + 3, color, g, set }); // +3 slop for fat fingers
    };
    const press = (x: number, y: number, r: number, label: string, color: number, fire: () => void) => {
      drawBtn(x, y, r, label, color);
      const zone = this.add.zone(x, y, (r + 3) * 2, (r + 3) * 2).setInteractive();
      zone.on('pointerdown', fire);
    };

    const by = GAME_HEIGHT - 46;
    // movement: virtual analog stick (built below in setupStick); no d-pad buttons.
    void hold;
    // attacks
    press(GAME_WIDTH - 22, by, 13, '弱', 0xffdd66, () => { this.touchPress.light = true; });
    press(GAME_WIDTH - 52, by, 13, '強', 0xff8866, () => { this.touchPress.heavy = true; });
    // specials (touch shortcut - clean motions by finger are impractical, so the
    // buttons queue the special directly on the engine fighter)
    press(GAME_WIDTH - 22, by - 28, 11, '波', 0x66ccff, () => this.engine.p1.requestSpecial('fireball'));
    press(GAME_WIDTH - 52, by - 28, 11, '昇', 0xffaa66, () => this.engine.p1.requestSpecial('dpunch'));
    press(GAME_WIDTH - 82, by - 28, 11, '超', 0xff66cc, () => this.engine.p1.requestSpecial('super'));
    // throw (also throw-tech)
    press(GAME_WIDTH - 82, by, 12, '投', 0xaa88ff, () => { this.touchPress.throw = true; });
    // gear
    press(GAME_WIDTH - 22, by - 54, 11, 'G+', 0x66ddaa, () => { this.touchPress.gearUp = true; });
    press(GAME_WIDTH - 52, by - 54, 11, 'G-', 0x66ddaa, () => { this.touchPress.gearDown = true; });
  }

  // Recompute every hold button EVERY FRAME from the live pointer state (not just
  // on pointer events - iOS Safari can drop the release event, which left the
  // "walk right forever / stuck jumping" holds latched). Polling the manager's
  // pointer array each frame means a lifted finger clears the hold within one
  // frame no matter which DOM events did or didn't fire.
  private pollHolds() {
    const mgr = this.input.manager;
    for (const b of this.holdButtons) {
      let on = false;
      for (const p of mgr.pointers) {
        if (!p.isDown) continue;
        const dx = p.x - b.x, dy = p.y - b.y;
        if (dx * dx + dy * dy <= b.r * b.r) { on = true; break; }
      }
      b.set(on);
      // visual feedback: lit while held so a "stuck" hold is obvious at a glance
      const rr = b.r - 3;
      b.g.clear();
      b.g.fillStyle(b.color, on ? 0.8 : 0.28); b.g.fillCircle(b.x, b.y, rr);
      b.g.lineStyle(1, b.color, on ? 1 : 0.7); b.g.strokeCircle(b.x, b.y, rr);
    }
  }

  // ---- training dummy mode ----------------------------------------------

  private cycleDummy() {
    // cpu -> guard -> stand -> 2P(keyboard) -> cpu
    if (this.p2Keyboard) { this.p2Keyboard = false; this.dummyMode = 'cpu'; }
    else if (this.dummyMode === 'cpu') this.dummyMode = 'guard';
    else if (this.dummyMode === 'guard') this.dummyMode = 'stand';
    else { this.p2Keyboard = true; }
    this.ai.reset();
    this.refreshDummyBtn();
  }

  private refreshDummyBtn() {
    if (!this.dummyBtn) return;
    const label = this.p2Keyboard ? '2P操作'
      : this.dummyMode === 'cpu' ? 'CPU:攻める'
      : this.dummyMode === 'guard' ? 'CPU:ガード' : 'CPU:棒立ち';
    this.dummyBtn.setText(`相手 ▶ ${label}`);
  }

  // ---- virtual analog stick (movement) ----------------------------------

  private setupStick() {
    this.stickBaseGfx = this.add.graphics();
    this.stickKnobGfx = this.add.graphics();
    // claim the stick when a finger lands in its (generous) zone
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.stickPointerId !== null) return;
      const dx = p.x - this.stickBaseX, dy = p.y - this.stickBaseY;
      const claimR = this.stickRadius * 2.0; // big catch area for the left thumb
      if (dx * dx + dy * dy <= claimR * claimR) this.stickPointerId = p.id;
    });
    this.drawStick(0, 0);
  }

  /** Poll the owning pointer each frame -> 8-way holds (reliable release). */
  private pollStick() {
    let dx = 0, dy = 0, active = false;
    if (this.stickPointerId !== null) {
      const p = this.input.manager.pointers.find((q) => q.id === this.stickPointerId);
      if (p && p.isDown) {
        active = true;
        dx = p.x - this.stickBaseX; dy = p.y - this.stickBaseY;
        const mag = Math.hypot(dx, dy);
        if (mag > this.stickRadius) { dx = (dx / mag) * this.stickRadius; dy = (dy / mag) * this.stickRadius; }
      } else {
        this.stickPointerId = null;
      }
    }
    const dead = this.stickRadius * 0.32;   // neutral zone
    const on = this.stickRadius * 0.30;     // per-axis engage threshold (allows diagonals)
    this.touchHold.left = active && dx < -on;
    this.touchHold.right = active && dx > on;
    this.touchHold.up = active && dy < -on;
    this.touchHold.down = active && dy > on;
    if (active && Math.hypot(dx, dy) < dead) {
      this.touchHold.left = this.touchHold.right = this.touchHold.up = this.touchHold.down = false;
    }
    this.drawStick(active ? dx : 0, active ? dy : 0);
  }

  private drawStick(kx: number, ky: number) {
    const b = this.stickBaseGfx; b.clear();
    b.fillStyle(0x223344, 0.35); b.fillCircle(this.stickBaseX, this.stickBaseY, this.stickRadius);
    b.lineStyle(2, 0x6688aa, 0.6); b.strokeCircle(this.stickBaseX, this.stickBaseY, this.stickRadius);
    const k = this.stickKnobGfx; k.clear();
    k.fillStyle(0x88bbee, 0.85); k.fillCircle(this.stickBaseX + kx, this.stickBaseY + ky, this.stickRadius * 0.5);
  }

  // ---- input plumbing ----------------------------------------------------

  update(_time: number, delta: number) {
    this.pollHolds();
    this.pollStick();
    this.latchPresses();

    this.accumulator += Math.min(delta, 100); // clamp huge frame gaps
    let firstSub = true;
    while (this.accumulator >= FIXED_DT) {
      this.accumulator -= FIXED_DT;
      if (this.matchOn) this.tickMatch(firstSub);
      else this.stepEngineFrame(firstSub);
      firstSub = false;
    }
    // presses are consumed after the frame's sub-steps
    this.clearPresses();
    this.draw();
  }

  /** One engine frame with live inputs (P1 human, P2 dummy/CPU/2P). */
  private stepEngineFrame(firstSub: boolean) {
    const in1 = this.buildInput(this.engine.p1, 'p1', firstSub);
    // In a match the dummy always fights (CPU) unless local-2P is on.
    const mode: DummyMode = this.matchOn ? 'cpu' : this.dummyMode;
    const in2 = this.p2Keyboard
      ? this.buildInput(this.engine.p2, 'p2', firstSub)
      : this.ai.update(this.engine.p2, this.engine.p1, mode);
    this.engine.step(in1, in2);
  }

  // ---- match manager -----------------------------------------------------

  private startMatch() {
    this.matchOn = true;
    this.p1Wins = 0; this.p2Wins = 0; this.roundNum = 1;
    this.matchBtn?.setText('試合中止 ■');
    this.beginRound();
  }

  private endMatch() {
    this.matchOn = false;
    this.centerText?.setText('');
    this.timerText?.setText('');
    this.matchBtn?.setText('試合開始 ▶');
    this.resetEngine();
  }

  private resetEngine() {
    this.engine = new CombatEngine(cloneCharacter(this.p1def), cloneCharacter(this.p2def));
    this.ai.reset();
  }

  private beginRound() {
    this.resetEngine();
    this.roundPhase = 'intro';
    this.phaseTimer = 90;                 // ~1.5s intro
    this.roundTimer = 60 * 60;            // 60-second round
    this.fightFlash = 0;
    this.centerText?.setText(`ROUND ${this.roundNum}`);
  }

  private tickMatch(firstSub: boolean) {
    if (this.roundPhase === 'fight') {
      this.stepEngineFrame(firstSub);
      if (this.fightFlash > 0 && --this.fightFlash === 0) this.centerText?.setText('');
      this.roundTimer--;
      if (this.engine.p1.dead || this.engine.p2.dead) this.endRound('ko');
      else if (this.roundTimer <= 0) this.endRound('time');
      return;
    }
    // intro / over / matchover: frozen, just count down.
    if (--this.phaseTimer <= 0) this.advancePhase();
  }

  private endRound(reason: 'ko' | 'time') {
    const h1 = this.engine.p1.health, h2 = this.engine.p2.health;
    let winner: 'p1' | 'p2' | 'draw';
    if (this.engine.p1.dead && this.engine.p2.dead) winner = 'draw';
    else if (this.engine.p1.dead) winner = 'p2';
    else if (this.engine.p2.dead) winner = 'p1';
    else winner = h1 > h2 ? 'p1' : h2 > h1 ? 'p2' : 'draw';

    if (winner === 'p1' || winner === 'draw') this.p1Wins++;
    if (winner === 'p2' || winner === 'draw') this.p2Wins++;

    const head = reason === 'ko' ? 'K.O.' : 'TIME UP';
    const sub = winner === 'draw' ? '引き分け' : winner === 'p1' ? 'あなたの勝ち' : 'CPUの勝ち';
    this.centerText?.setText(`${head}\n${sub}`);
    this.roundPhase = 'over';
    this.phaseTimer = 120; // ~2s
  }

  private advancePhase() {
    if (this.roundPhase === 'intro') {
      this.roundPhase = 'fight';
      this.fightFlash = 45;
      this.centerText?.setText('FIGHT!');
      return;
    }
    if (this.roundPhase === 'over') {
      if (this.p1Wins >= 2 || this.p2Wins >= 2) {
        const win = this.p1Wins > this.p2Wins ? 'YOU WIN!' : this.p2Wins > this.p1Wins ? 'YOU LOSE...' : 'DRAW GAME';
        this.centerText?.setText(win);
        this.roundPhase = 'matchover';
        this.phaseTimer = 200;
        return;
      }
      this.roundNum++;
      this.beginRound();
      return;
    }
    if (this.roundPhase === 'matchover') {
      this.endMatch();
    }
  }

  /** Capture just-pressed keys once per render frame (before sub-stepping). */
  private latchPresses() {
    if (!this.keys) return;
    const jd = Phaser.Input.Keyboard.JustDown;

    // rising-edge jump: up newly held this render frame (keyboard or stick)
    const upP1 = this.keys.up.isDown || this.touchHold.up;
    this.jumpEdgeP1 = upP1 && !this.prevUpP1;
    this.prevUpP1 = upP1;
    const upP2 = this.keys.p2Up.isDown;
    this.jumpEdgeP2 = upP2 && !this.prevUpP2;
    this.prevUpP2 = upP2;

    this.p1Press.light = jd(this.keys.light) || this.touchPress.light;
    this.p1Press.heavy = jd(this.keys.heavy) || this.touchPress.heavy;
    this.p1Press.special = jd(this.keys.special) || this.touchPress.special;
    this.p1Press.throw = jd(this.keys.throw) || this.touchPress.throw;
    this.p1Press.gearUp = jd(this.keys.gearUp) || this.touchPress.gearUp;
    this.p1Press.gearDown = jd(this.keys.gearDown) || this.touchPress.gearDown;

    this.p2Press.light = jd(this.keys.p2Light);
    this.p2Press.heavy = jd(this.keys.p2Heavy);
    this.p2Press.special = jd(this.keys.p2Special);
    this.p2Press.throw = jd(this.keys.p2Throw);
    this.p2Press.gearUp = jd(this.keys.p2GearUp);
    this.p2Press.gearDown = jd(this.keys.p2GearDown);
  }

  private clearPresses() {
    this.touchPress.light = this.touchPress.heavy = this.touchPress.special = false;
    this.touchPress.throw = false;
    this.touchPress.gearUp = this.touchPress.gearDown = false;
  }

  private buildInput(f: CombatFighter, who: 'p1' | 'p2', firstSub: boolean): CommandInput {
    if (!this.keys) return EMPTY_COMMAND;
    const hold: RawHold = who === 'p1'
      ? {
          left: this.keys.left.isDown || this.touchHold.left,
          right: this.keys.right.isDown || this.touchHold.right,
          up: this.keys.up.isDown || this.touchHold.up,   // stick up = jump (held)
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
    // jump only on the rising edge of up (once per press), consumed on firstSub;
    // down is a normal hold (crouch). Prevents "hold up = repeated jumps".
    const jumpEdge = who === 'p1' ? this.jumpEdgeP1 : this.jumpEdgeP2;
    const vert = (firstSub && jumpEdge) ? 1 : hold.down ? -1 : 0;

    // "just pressed" only applies on the first sub-step of a render frame; on
    // later sub-steps it's already been consumed (buffering handles leniency).
    const p = firstSub;
    return {
      fwd, vert,
      light: p && press.light,
      heavy: p && press.heavy,
      special: p && press.special,
      throw: p && press.throw,
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

    // projectiles (fireballs) - yellow squares carrying their own hitbox
    for (const proj of this.engine.projectiles) {
      this.strokeWorld(g, projectileWorld(proj), 0xffee44, 0.5, 0xffbb22);
    }

    this.drawHealth();
    this.hudP1.setText(this.describe(this.engine.p1));
    this.hudP2.setText(this.describe(this.engine.p2));
    this.drawMatchHud();
  }

  private drawMatchHud() {
    const pips = this.pipsGfx;
    if (!pips || !this.timerText) return;
    pips.clear();
    if (!this.matchOn) { this.timerText.setText(''); return; }
    // count-down timer (only during intro/fight)
    if (this.roundPhase === 'fight' || this.roundPhase === 'intro') {
      this.timerText.setText(String(Math.max(0, Math.ceil(this.roundTimer / 60))));
    } else {
      this.timerText.setText('');
    }
    // round-win pips under each health bar (best of 3)
    const pip = (x: number, filled: boolean, color: number) => {
      pips.lineStyle(1, color, 0.9); pips.strokeCircle(x, 24, 2.5);
      if (filled) { pips.fillStyle(color, 1); pips.fillCircle(x, 24, 2.5); }
    };
    pip(10, this.p1Wins >= 1, 0x66ddff); pip(18, this.p1Wins >= 2, 0x66ddff);
    pip(GAME_WIDTH - 10, this.p2Wins >= 1, 0xff9966); pip(GAME_WIDTH - 18, this.p2Wins >= 2, 0xff9966);
  }

  private drawFighter(f: CombatFighter, capsuleColor: number) {
    // Body = pushbox footprint, tinted BY STATE so the placeholder still reads
    // clearly: attacking = bright, blocking = cyan, hit/knockdown = red, else base.
    const cg = this.capsuleGfx;
    const push = f.getPushbox();
    const sx = push.xmin, sw = push.xmax - push.xmin;
    const top = GROUND_Y - push.ymax, h = push.ymax - push.ymin;
    let bodyColor = capsuleColor, alpha = 0.6;
    if (f.phase === 'attack' || f.phase === 'airattack') { bodyColor = 0xffffff; alpha = 0.85; }
    else if (f.phase === 'block' || f.phase === 'crouchblock') bodyColor = 0x33ddff;
    else if (f.phase === 'hitstun' || f.phase === 'blockstun' || f.phase === 'knockdown') bodyColor = 0xff4444;
    cg.fillStyle(bodyColor, alpha);
    cg.fillRoundedRect(sx, top, sw, h, 4);

    // head disc (reads as a character; sits above the shoulders)
    const cx = (push.xmin + push.xmax) / 2;
    cg.fillStyle(bodyColor, Math.min(1, alpha + 0.15));
    cg.fillCircle(cx + f.facing * 1.5, top + 4, 4.5);
    // eye/facing dot so the head clearly points forward
    cg.fillStyle(0x0a0f14, 0.9);
    cg.fillCircle(cx + f.facing * 3, top + 4, 1.3);

    // pushbox (faint) + hurtboxes (blue) for the training/labo view
    this.strokeWorld(this.gfx, push, 0xffcc33, 0.0, 0xffcc33, 0.35);
    for (const hurt of f.getHurtboxesWorld()) {
      this.strokeWorld(this.gfx, hurt, 0x33aaff, 0.10, 0x33aaff);
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
