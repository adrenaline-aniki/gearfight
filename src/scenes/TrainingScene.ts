import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_Y, PIXEL_FONT } from '../config/constants';
import { CombatEngine, projectileWorld } from '../combat/CombatEngine';
import { CombatFighter } from '../combat/CombatFighter';
import { EMPTY_COMMAND, type CommandInput } from '../combat/types';
import { makeWizel, cloneCharacter, type CharacterDef } from '../combat/characterDef';
import { loadCharacter } from '../combat/characterStore';
import { CombatAI, type DummyMode } from '../combat/CombatAI';
import { PuppetRig, type RigData } from '../graphics/PuppetRig';

// characters that have a puppet-rig; index 0 = P1, index 1 = P2 in this view.
const RIG_CHARS = ['hajime', 'wizel'] as const;

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
  // Gear coaching panel (P1): a lit 5-notch ladder + the current gear's concrete
  // trade-off (damage x / speed x / guard-break) + a context line telling you WHEN
  // to shift. Makes "why/when do I change gear" legible instead of invisible.
  private gearPanelGfx!: Phaser.GameObjects.Graphics;
  private gearLabelText!: Phaser.GameObjects.Text;
  private gearCoachText!: Phaser.GameObjects.Text;
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
  private stickBaseGfx!: Phaser.GameObjects.Graphics;
  private stickKnobGfx!: Phaser.GameObjects.Graphics;
  // Floating origin: the point where the thumb first lands becomes "neutral", and
  // direction is measured RELATIVE to it - so a thumb that rests off-centre no
  // longer reads a false direction ("up crouches", "keeps walking forward").
  private stickTouchId: number | null = null;
  private stickOriginX = 0;
  private stickOriginY = 0;

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
  private perfectText?: Phaser.GameObjects.Text; // "PERFECT SHIFT!" callout
  private perfectShown = 0;                       // render frames left to show it
  // impact juice (spark particles + KO/perfect-shift edge detection)
  private hitFx: { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number; grav: number }[] = [];
  private koFlashed = false;
  private prevPerf: [number, number] = [0, 0];
  private prevMove: [string | null, string | null] = [null, null]; // super-activation edge
  private superText?: Phaser.GameObjects.Text;
  private superShown = 0;
  // sprite-skin layer: one image per fighter slot. If a pose texture exists the
  // fighter is drawn as that sprite; otherwise we fall back to the gear-mech.
  private skinImgs: Phaser.GameObjects.Image[] = [];
  // cut-out puppet rigs (one per fighter slot) for characters that have rig art
  private rigs: (PuppetRig | undefined)[] = [];

  constructor() {
    super('TrainingScene');
  }

  preload() {
    // Own loader (separate from BootScene) - set the gh-pages base and pull the
    // optional skin manifest, then queue whatever pose PNGs it lists. Missing
    // files just mean the mech fallback stays; nothing here is required.
    this.load.setBaseURL(import.meta.env.BASE_URL);
    this.load.json('skinManifest', 'sprites/skin/manifest.json');
    this.load.once('filecomplete-json-skinManifest', () => {
      const m = this.cache.json.get('skinManifest') as Record<string, Record<string, string>> | undefined;
      if (!m) return;
      for (const [id, poses] of Object.entries(m)) {
        for (const [pose, file] of Object.entries(poses)) {
          this.load.image(`skin_${id}_${pose}`, file);
        }
      }
    });
    // Puppet-rig parts per character (cut-out animation from one idle drawing).
    for (const id of RIG_CHARS) {
      this.load.json(`${id}Rig`, `sprites/skin/${id}/rig/rig.json`);
      this.load.once(`filecomplete-json-${id}Rig`, () => {
        const rd = this.cache.json.get(`${id}Rig`) as RigData | undefined;
        for (const part of rd?.parts ?? []) {
          this.load.image(`rig_${id}_${part.name}`, `sprites/skin/${id}/rig/${part.name}.png`);
        }
      });
    }
    // HD cel-shaded art reads better smoothly downscaled than nearest-neighbor
    // (which is meant for the pixel UI). Apply LINEAR to skin + rig textures.
    this.load.on('filecomplete', (key: string) => {
      if ((key.startsWith('skin_') || key.startsWith('rig_')) && this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    });
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
    this.p2def = makeWizel(); // P2 = Wizel (speed type), matching its rig
    this.engine = new CombatEngine(cloneCharacter(this.p1def), cloneCharacter(this.p2def));
    this.accumulator = 0;

    // ground line
    const ground = this.add.graphics();
    ground.lineStyle(1, 0x2a3a4a, 1);
    ground.lineBetween(0, GROUND_Y, GAME_WIDTH, GROUND_Y);
    ground.fillStyle(0x0a0f14, 1);
    ground.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);

    this.capsuleGfx = this.add.graphics();
    // skin sprites sit above the mech layer but below the hitbox/particle overlay
    this.skinImgs = [
      this.add.image(0, 0, '__DEFAULT').setVisible(false),
      this.add.image(0, 0, '__DEFAULT').setVisible(false),
    ];
    // Build a puppet rig per slot from that slot's character (created here so it
    // renders under the hitbox overlay). Falls back to the mech if art is absent.
    this.rigs = RIG_CHARS.map((id) => {
      const rd = this.cache.json.get(`${id}Rig`) as RigData | undefined;
      if (!rd || !this.textures.exists(`rig_${id}_torso`)) return undefined;
      return new PuppetRig(this, rd, `rig_${id}_`, 0, { bladeArm: id === 'wizel' });
    });
    this.gfx = this.add.graphics();

    // health bars (simple)
    this.healthBarP1 = this.add.graphics();

    // Gear coaching panel sits just under P1's health/heat cluster (top-left).
    this.gearPanelGfx = this.add.graphics();
    this.gearLabelText = this.add.text(6, 39, '', { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#cfe8ff' }).setResolution(2);
    this.gearCoachText = this.add.text(6, 50, '', { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#ffe37a' })
      .setResolution(2).setWordWrapWidth(300, true);

    // debug HUD (below the coaching panel so they don't overlap)
    this.hudP1 = this.add.text(4, 62, '', { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#8fd6ff' }).setResolution(2);
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

    // "PERFECT SHIFT!" execution-reward callout (double-clutch gear tap).
    this.perfectText = this.add.text(GAME_WIDTH / 2, 48, 'PERFECT SHIFT!', {
      fontFamily: PIXEL_FONT, fontSize: '20px', color: '#7affc8', fontStyle: 'bold',
      stroke: '#0a3a28', strokeThickness: 4,
    }).setOrigin(0.5).setResolution(2).setDepth(60).setVisible(false);

    // "GEAR MAX!!" super callout.
    this.superText = this.add.text(GAME_WIDTH / 2, 64, 'GEAR MAX!!', {
      fontFamily: PIXEL_FONT, fontSize: '30px', color: '#ffe14a', fontStyle: 'bold',
      stroke: '#5a3a00', strokeThickness: 5,
    }).setOrigin(0.5).setResolution(2).setDepth(62).setVisible(false);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 10,
      'スティック=移動/ジャンプ/しゃがみ ｜ 弱 強 投 ｜ 波 昇 超=必殺 ｜ G+/G-=ギア（2回押し＝パーフェクト）',
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

    // Capture the arrow keys + space so the browser's default scroll doesn't run.
    kb.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');

    // HELD directions are tracked with our OWN window listeners keyed by
    // event.code, NOT Phaser's key.isDown. In some browsers Phaser's held state
    // failed to clear on keyup (one tap of Right = walk forever). Capture-phase
    // listeners fire before anything can swallow the event, so keyup always
    // registers here and a released key can never stick.
    const kd = (e: KeyboardEvent) => { this.heldCodes.add(e.code); };
    const ku = (e: KeyboardEvent) => { this.heldCodes.delete(e.code); };
    const reset = () => { this.heldCodes.clear(); kb.resetKeys(); };
    window.addEventListener('keydown', kd, true);
    window.addEventListener('keyup', ku, true);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);
    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', kd, true);
      window.removeEventListener('keyup', ku, true);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset);
    });
  }

  // set of currently-held key codes (our own, reliable held-key state)
  private heldCodes = new Set<string>();

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

  // Live map of raw browser touches (identifier -> game-space x/y). Rebuilt from
  // the authoritative event.touches on EVERY touch event, so a dropped touchend
  // (an iOS multitouch reality) self-heals on the next touch instead of leaving a
  // phantom "stuck" pointer that freezes a direction (the "hold" bugs).
  private stickTouches = new Map<number, { x: number; y: number }>();

  private setupStick() {
    this.stickBaseGfx = this.add.graphics();
    this.stickKnobGfx = this.add.graphics();
    this.drawStick(false, 0, 0);

    const canvas = this.game.canvas;
    const rebuild = (e: TouchEvent) => {
      this.stickTouches.clear();
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        const gx = ((t.clientX - rect.left) / rect.width) * GAME_WIDTH;
        const gy = ((t.clientY - rect.top) / rect.height) * GAME_HEIGHT;
        this.stickTouches.set(t.identifier, { x: gx, y: gy });
      }
    };
    for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      canvas.addEventListener(ev, rebuild as EventListener, { passive: true });
    }
    // clean up when this scene shuts down so listeners don't stack across restarts
    this.events.once('shutdown', () => {
      for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
        canvas.removeEventListener(ev, rebuild as EventListener);
      }
    });
  }

  /** The stick follows whichever down pointer is in the lower-left control zone
   * (attack/special buttons all live on the RIGHT, so they never interfere).
   * This needs no per-pointer identity tracking - which was unreliable (Phaser's
   * pointer.id is a reused pool slot, and pointerId can be null) and caused a
   * second finger to hijack the stick, sticking the last direction (e.g. stuck
   * crouch). No finger in the zone -> instant neutral. */
  private pollStick() {
    // belt-and-suspenders: if the browser reports nothing down anywhere, drop any
    // stragglers (covers a fully-dropped final touchend that left a phantom).
    if (this.stickTouches.size > 0 && !this.input.manager.pointers.some((p) => p.isDown)) {
      this.stickTouches.clear();
    }

    // Resolve the touch that controls the stick. Keep the one we already own; if
    // it's gone, claim a fresh touch that landed in the lower-left and set the
    // floating origin to WHERE it landed.
    let cur: { x: number; y: number } | null = null;
    if (this.stickTouchId !== null) {
      const t = this.stickTouches.get(this.stickTouchId);
      if (t) cur = t; else this.stickTouchId = null;
    }
    if (!cur) {
      for (const [id, t] of this.stickTouches) {
        if (t.x < GAME_WIDTH * 0.45 && t.y > GAME_HEIGHT * 0.4) {
          this.stickTouchId = id; this.stickOriginX = t.x; this.stickOriginY = t.y; cur = t; break;
        }
      }
    }
    // desktop fallback: mouse held in the lower-left, origin = press point (approx base)
    if (!cur) {
      const m = this.input.mousePointer;
      if (m && m.isDown && m.x < GAME_WIDTH * 0.45 && m.y > GAME_HEIGHT * 0.4) {
        if (this.stickTouchId !== -1) { this.stickTouchId = -1; this.stickOriginX = m.x; this.stickOriginY = m.y; }
        cur = { x: m.x, y: m.y };
      } else if (this.stickTouchId === -1) {
        this.stickTouchId = null;
      }
    }

    let dx = 0, dy = 0;
    const active = cur !== null;
    if (cur) {
      dx = cur.x - this.stickOriginX; dy = cur.y - this.stickOriginY;
      const mag = Math.hypot(dx, dy);
      if (mag > this.stickRadius) { dx = (dx / mag) * this.stickRadius; dy = (dy / mag) * this.stickRadius; }
    }
    const dead = this.stickRadius * 0.30;   // neutral zone (relative to floating origin)
    const on = this.stickRadius * 0.28;     // per-axis engage threshold (allows diagonals)
    const engaged = active && Math.hypot(dx, dy) >= dead;
    this.touchHold.left = engaged && dx < -on;
    this.touchHold.right = engaged && dx > on;
    this.touchHold.up = engaged && dy < -on;
    this.touchHold.down = engaged && dy > on;
    this.drawStick(active, dx, dy);
  }

  private drawStick(active: boolean, kx: number, ky: number) {
    // Base is drawn at the floating origin while engaged, else at its resting spot.
    const bx = active ? this.stickOriginX : this.stickBaseX;
    const by = active ? this.stickOriginY : this.stickBaseY;
    const b = this.stickBaseGfx; b.clear();
    b.fillStyle(0x223344, 0.35); b.fillCircle(bx, by, this.stickRadius);
    b.lineStyle(2, 0x6688aa, 0.6); b.strokeCircle(bx, by, this.stickRadius);
    const k = this.stickKnobGfx; k.clear();
    k.fillStyle(0x88bbee, 0.85); k.fillCircle(bx + kx, by + ky, this.stickRadius * 0.5);
  }

  // ---- input plumbing ----------------------------------------------------

  private loggedError = false;

  update(_time: number, delta: number) {
    // A game must never HARD-FREEZE from one input: if any single frame throws
    // (an unexpected state combo), log it once and keep the loop alive instead of
    // letting the exception kill requestAnimationFrame. Recovers to neutral.
    try {
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
    } catch (err) {
      this.accumulator = 0;
      this.clearPresses();
      if (!this.loggedError) {
        this.loggedError = true;
        console.error('[TrainingScene] frame error (recovered):', err);
      }
    }
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
    this.consumeHits();
  }

  /** Turn this frame's engine events into impact juice: hit sparks, gear-break
   * gold flashes, screen shake weighted by damage, a KO flash, and a green
   * sparkle on a landed Perfect Shift. Presentation only. */
  private consumeHits() {
    const cam = this.cameras.main;
    for (const h of this.engine.lastHits) {
      const cx = h.projectile ? h.defender.x : (h.attacker.x + h.defender.x) / 2;
      const cy = GROUND_Y - 26;
      if (h.teched) { this.spawnBurst(cx, GROUND_Y - 24, 0x99ddff, 8, 1.4); cam.shake(90, 0.004); continue; }
      if (h.thrown) { this.spawnBurst(cx, GROUND_Y - 20, 0xffcc66, 14, 2.2); cam.shake(160, 0.010); continue; }
      if (h.blocked) { this.spawnBurst(cx, cy, 0x66ccff, 7, 1.2); cam.shake(70, 0.003); continue; }
      const heavy = h.damage >= 70 || h.guardBreak;
      this.spawnBurst(cx, cy, h.guardBreak ? 0xffee66 : 0xffffff, heavy ? 18 : 11, heavy ? 2.6 : 1.8);
      cam.shake(heavy ? 170 : 100, heavy ? 0.011 : 0.006);
      if (h.damage >= 150) cam.flash(120, 255, 255, 255, false);
    }
    // KO flash (once per knockout)
    const someoneDead = this.engine.p1.dead || this.engine.p2.dead;
    if (someoneDead && !this.koFlashed) { this.koFlashed = true; cam.flash(220, 255, 255, 255, false); cam.shake(300, 0.014); }
    if (!someoneDead) this.koFlashed = false;
    // Perfect Shift sparkle (rising edge of perfectShiftFx)
    const fs = [this.engine.p1, this.engine.p2] as const;
    for (let i = 0; i < 2; i++) {
      if (fs[i].perfectShiftFx > 0 && this.prevPerf[i] === 0) {
        this.spawnBurst(fs[i].x, GROUND_Y - 30, 0x7affc8, 12, 2.0);
        cam.flash(90, 40, 255, 160, false);
      }
      this.prevPerf[i] = fs[i].perfectShiftFx;
      // ギアマックス activation (rising edge of the super move): gold flash + burst + callout
      if (fs[i].move === 'super' && this.prevMove[i] !== 'super') {
        cam.flash(200, 255, 225, 90, false);
        cam.shake(160, 0.008);
        this.spawnBurst(fs[i].x, GROUND_Y - 28, 0xffe14a, 22, 2.6);
        this.superShown = 40;
      }
      this.prevMove[i] = fs[i].move;
    }
  }

  /** Radial spark burst: `count` shards flung out from (x,y), fading + falling. */
  private spawnBurst(x: number, y: number, color: number, count: number, speed: number) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const sp = speed * (0.5 + Math.random());
      const max = 12 + Math.floor(Math.random() * 10);
      this.hitFx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, life: max, max, color, size: 1.4 + Math.random() * 1.8, grav: 0.14 });
    }
    if (this.hitFx.length > 300) this.hitFx.splice(0, this.hitFx.length - 300);
  }

  private drawHitFx() {
    const g = this.gfx;
    const survivors: typeof this.hitFx = [];
    for (const p of this.hitFx) {
      p.life--;
      p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.vx *= 0.9;
      const a = Math.max(0, p.life / p.max);
      const s = p.size * (0.4 + 0.6 * a);
      g.fillStyle(p.color, a);
      g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      if (p.life > 0) survivors.push(p);
    }
    this.hitFx = survivors;
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
    this.hitFx.length = 0;
    this.koFlashed = false;
    this.prevPerf = [0, 0];
    this.prevMove = [null, null];
    this.superShown = 0;
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
    const upP1 = this.heldCodes.has('ArrowUp') || this.touchHold.up;
    this.jumpEdgeP1 = upP1 && !this.prevUpP1;
    this.prevUpP1 = upP1;
    const upP2 = this.heldCodes.has('KeyW');
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
    // Held directions come from our own reliable key-code set (see setupKeyboard),
    // OR-ed with the touch stick for P1.
    const h = this.heldCodes;
    const hold: RawHold = who === 'p1'
      ? {
          left: h.has('ArrowLeft') || this.touchHold.left,
          right: h.has('ArrowRight') || this.touchHold.right,
          up: h.has('ArrowUp') || this.touchHold.up,   // stick up = jump (held)
          down: h.has('ArrowDown') || this.touchHold.down,
        }
      : {
          left: h.has('KeyA'),
          right: h.has('KeyD'),
          up: h.has('KeyW'),
          down: h.has('KeyS'),
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

    // P1 = Hajime, P2 = Wizel (RIG_CHARS). Falls back to the mech per fighter if
    // that character's rig art didn't load.
    this.drawFighter(this.engine.p1, 0x4488ff, 0, RIG_CHARS[0]);
    this.drawFighter(this.engine.p2, 0xff8844, 1, RIG_CHARS[1]);

    // hitboxes on top (red), from whichever fighter is attacking
    for (const f of [this.engine.p1, this.engine.p2]) {
      const hb = f.getHitboxWorld();
      if (hb) this.strokeWorld(g, hb, 0xff3344, 0.35, 0xff3344);
    }

    // gear-shot projectiles: a spinning gear (bigger at higher gear)
    for (const proj of this.engine.projectiles) {
      const wb = projectileWorld(proj);
      const px = (wb.xmin + wb.xmax) / 2, r = (wb.xmax - wb.xmin) / 2 + 1;
      TrainingScene.drawGear(g, px, GROUND_Y - (wb.ymin + wb.ymax) / 2, r, proj.spin, 0xffdd33);
      g.fillStyle(0xfff4b0, 0.9); g.fillCircle(px, GROUND_Y - (wb.ymin + wb.ymax) / 2, r * 0.28);
    }

    this.drawHitFx();
    this.drawHealth();
    this.drawGearPanel();
    this.hudP1.setText(this.describe(this.engine.p1));
    this.hudP2.setText(this.describe(this.engine.p2));
    this.drawMatchHud();
    this.drawPerfectShift();
  }

  /** Flash "PERFECT SHIFT!" when either fighter lands a double-clutch. The engine
   * sets perfectShiftFx=8 on the frame it happens; we hold the callout ~28 render
   * frames so it reads even at a glance, pulsing its alpha. */
  private drawPerfectShift() {
    const t = this.perfectText;
    if (!t) return;
    if (this.engine.p1.perfectShiftFx > 0 || this.engine.p2.perfectShiftFx > 0) {
      this.perfectShown = 28;
    }
    if (this.perfectShown > 0) {
      this.perfectShown--;
      t.setVisible(true);
      t.setAlpha(0.55 + 0.45 * Math.abs(Math.sin(this.perfectShown * 0.5)));
    } else if (t.visible) {
      t.setVisible(false);
    }

    // "GEAR MAX!!" super callout (grows in, then holds/pulses)
    const st = this.superText;
    if (st) {
      if (this.superShown > 0) {
        this.superShown--;
        st.setVisible(true);
        const grow = Math.min(1, (40 - this.superShown) / 6);
        st.setScale(0.6 + 0.5 * grow);
        st.setAlpha(Math.min(1, this.superShown / 8));
      } else if (st.visible) {
        st.setVisible(false);
      }
    }
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

  /** Map an engine phase/move to a skin pose id (the sprite-sheet slot name). */
  private skinPose(f: CombatFighter): string {
    switch (f.phase) {
      case 'attack': case 'airattack': {
        const m = f.move ?? '';
        if (m === 'throw') return 'throw';
        if (m === 'fireball') return 'fireball';
        if (m === 'dpunch') return 'dpunch';
        if (m === 'super') return 'super';
        return m.includes('Heavy') ? 'attackHeavy' : 'attackLight';
      }
      case 'walk': return 'walk';
      case 'crouch': case 'crouchblock': return 'crouch';
      case 'jumpsquat': case 'air': return 'jump';
      case 'block': return 'block';
      case 'hitstun': case 'blockstun': return 'hitstun';
      case 'launched': return 'hitstun';
      case 'knockdown': return 'knockdown';
      case 'dizzy': return 'dizzy';
      default: return 'idle';
    }
  }

  /** Draw the fighter as a skin sprite if a matching pose texture is loaded.
   * Returns true if it drew a sprite (so the mech fallback is skipped). */
  private drawSkin(f: CombatFighter, slot: number, skinId: string, cx: number, feetY: number, figH: number): boolean {
    const img = this.skinImgs[slot];
    if (!img) return false;
    const pose = this.skinPose(f);
    const exact = `skin_${skinId}_${pose}`;
    const idle = `skin_${skinId}_idle`;
    const key = this.textures.exists(exact) ? exact : this.textures.exists(idle) ? idle : null;
    if (!key) { img.setVisible(false); return false; }
    const src = this.textures.get(key).getSourceImage() as { height: number };
    const targetH = figH * 1.2; // sprites read a touch taller than the hurtbox
    img.setTexture(key);
    img.setOrigin(0.5, 1);              // feet-anchored
    img.setScale(src.height ? targetH / src.height : 1);
    img.setFlipX(f.facing < 0);         // authored right-facing; flip for P2 side
    img.setPosition(cx, feetY);
    img.setVisible(true);
    return true;
  }

  private drawFighter(f: CombatFighter, capsuleColor: number, slot = 0, skinId = '') {
    const push = f.getPushbox();
    const cx = (push.xmin + push.xmax) / 2;
    const fw = push.xmax - push.xmin;
    const feetY = GROUND_Y - push.ymin; // screen y of feet (up = -y in this space)
    const figH = push.ymax - push.ymin;
    const dir = f.facing;

    // Puppet rig takes precedence (animated cut-out from the idle drawing).
    // Each slot's rig is already the right character (see RIG_CHARS).
    if (skinId && this.rigs[slot]) {
      this.skinImgs[slot]?.setVisible(false);
      // Use a CONSTANT display height (standing size). figH shrinks when crouching
      // (shorter pushbox) - scaling by it made the character shrink; the crouch is
      // a POSE, not a smaller character.
      this.rigs[slot]!.sync(f, cx, feetY, 54, f.facing);
      if (f.phase === 'dizzy') this.drawDizzyStars(cx, feetY - 60);
      this.drawBoxes(f, push);
      return;
    }
    this.rigs[slot]?.setVisible(false);

    // Otherwise a static sprite skin; if it drew, we're done (still show boxes).
    if (skinId && this.drawSkin(f, slot, skinId, cx, feetY, figH)) {
      this.drawBoxes(f, push);
      return;
    }
    if (this.skinImgs[slot]) this.skinImgs[slot].setVisible(false);

    // A readable GEAR-MECH figure (placeholder art, no external sprite yet):
    // segmented legs/torso/arm drawn over the pushbox footprint, a chest gear
    // that spins faster in higher gears, and an arm that extends on attacks.
    // Purely visual - the hitboxes/hurtboxes below are unchanged.
    const cg = this.capsuleGfx;

    // state accent color (the "energy" read); chassis stays the player color.
    const chassis = capsuleColor;
    let accent = capsuleColor, flash = false;
    if (f.phase === 'dizzy') accent = 0xffdd33;
    else if (f.phase === 'attack' || f.phase === 'airattack') { accent = 0xffffff; flash = true; }
    else if (f.phase === 'block' || f.phase === 'crouchblock') accent = 0x33ddff;
    else if (f.phase === 'hitstun' || f.phase === 'blockstun' || f.phase === 'knockdown') accent = 0xff4444;

    // point at `up` fraction of figure height above the feet, `fwd` px forward.
    const P = (up: number, fwd = 0) => ({ x: cx + fwd * dir, y: feetY - up * figH });

    // knocked down = a prone chassis on the floor (reads clearly as "downed").
    if (f.phase === 'knockdown') {
      cg.fillStyle(accent, 0.9);
      cg.fillRoundedRect(cx - fw * 0.9, feetY - 5, fw * 1.8, 5, 2.5);
      cg.fillStyle(TrainingScene.shade(chassis, 0.1), 1);
      cg.fillCircle(cx - dir * fw * 0.7, feetY - 3, figH * 0.1);
      this.drawBoxes(f, push);
      return;
    }

    // ---- legs (back leg darker; front leg strides while walking) ----
    const hip = P(0.44);
    let stride = fw * 0.15;
    if (f.phase === 'walk') stride = fw * 0.15 + Math.sin(this.time.now / 90) * fw * 0.4;
    else if (f.phase === 'crouch' || f.phase === 'crouchblock') stride = fw * 0.6;
    cg.lineStyle(3.2, TrainingScene.shade(chassis, -0.35), 1);
    cg.lineBetween(hip.x, hip.y, cx - stride * 0.5, feetY);
    cg.lineStyle(3.6, chassis, 1);
    cg.lineBetween(hip.x, hip.y, cx + stride * 0.5, feetY);
    cg.fillStyle(TrainingScene.shade(chassis, -0.35), 1); cg.fillCircle(cx - stride * 0.5, feetY, 1.8);
    cg.fillStyle(chassis, 1); cg.fillCircle(cx + stride * 0.5, feetY, 2);

    // ---- torso (thick capsule = the chassis) ----
    const torsoBot = P(0.42), torsoTop = P(0.80);
    cg.lineStyle(Math.max(6, fw * 0.9), chassis, 0.95);
    cg.lineBetween(torsoBot.x, torsoBot.y, torsoTop.x, torsoTop.y);

    // ---- chest gear: spins faster in higher gears (the theme, front & center) ----
    const chest = P(0.6, fw * 0.05);
    const spin = this.time.now / (640 - f.gear * 95) * (dir);
    TrainingScene.drawGear(cg, chest.x, chest.y, Math.max(3, fw * 0.34), spin, accent);

    // ---- head + forward visor eye ----
    const head = P(0.93, fw * 0.1);
    const hr = Math.max(3, figH * 0.11);
    cg.fillStyle(TrainingScene.shade(chassis, 0.12), 1); cg.fillCircle(head.x, head.y, hr);
    cg.fillStyle(flash ? 0x0a0f14 : accent, 1); cg.fillCircle(head.x + dir * hr * 0.4, head.y, hr * 0.45);

    // ---- arm: extends toward the live hitbox on attack, guards on block ----
    const shoulder = P(0.78, fw * 0.12);
    let hand: { x: number; y: number };
    if (f.phase === 'attack' || f.phase === 'airattack') {
      const hb = f.getHitboxWorld();
      const reach = hb ? (dir > 0 ? hb.xmax - cx : cx - hb.xmin) : fw * 1.6;
      const armUp = f.move === 'crouchHeavy' ? 0.12
        : f.move === 'dpunch' ? 1.0
        : f.move === 'jumpLight' || f.move === 'jumpHeavy' ? 0.5
        : f.move === 'standHeavy' || f.move === 'super' ? 0.66 : 0.58;
      hand = { x: cx + dir * Math.max(fw * 1.1, reach * 0.95), y: feetY - armUp * figH };
    } else if (f.phase === 'block' || f.phase === 'crouchblock') {
      hand = P(0.6, fw * 0.75); // forearm up, in front = guard
    } else {
      hand = P(0.5, fw * 0.5);
    }
    cg.lineStyle(3, flash ? 0xffffff : TrainingScene.shade(accent, -0.05), 1);
    cg.lineBetween(shoulder.x, shoulder.y, hand.x, hand.y);
    cg.fillStyle(accent, 1); cg.fillCircle(hand.x, hand.y, 2.4);

    // dizzy: orbiting "stars" over the head
    if (f.phase === 'dizzy') {
      const t = this.time.now / 200;
      for (let i = 0; i < 3; i++) {
        const a = t + (i * Math.PI * 2) / 3;
        cg.fillStyle(0xffee66, 0.95);
        cg.fillCircle(head.x + Math.cos(a) * 7, head.y - hr - 2 + Math.sin(a) * 2.2, 1.6);
      }
    }

    this.drawBoxes(f, push);
  }

  /** Orbiting stars over a dizzied fighter's head (rig path skips the mech's
   * built-in ones, so redraw them here). Uses capsuleGfx (cleared each frame). */
  private drawDizzyStars(cx: number, topY: number) {
    const cg = this.capsuleGfx;
    const t = this.time.now / 200;
    for (let i = 0; i < 3; i++) {
      const a = t + (i * Math.PI * 2) / 3;
      cg.fillStyle(0xffee66, 0.95);
      cg.fillCircle(cx + Math.cos(a) * 8, topY + Math.sin(a) * 2.4, 1.8);
    }
  }

  /** Debug/labo overlay: faint pushbox + blue hurtboxes (kept separate so the
   * knockdown early-return can still show them). */
  private drawBoxes(f: CombatFighter, push: { xmin: number; xmax: number; ymin: number; ymax: number }) {
    this.strokeWorld(this.gfx, push, 0xffcc33, 0.0, 0xffcc33, 0.35);
    for (const hurt of f.getHurtboxesWorld()) {
      this.strokeWorld(this.gfx, hurt, 0x33aaff, 0.10, 0x33aaff);
    }
  }

  /** Lighten (amt>0) or darken (amt<0) a 0xRRGGBB color toward white/black. */
  private static shade(color: number, amt: number): number {
    const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
    const mix = (c: number) => amt >= 0
      ? Math.round(c + (255 - c) * amt)
      : Math.round(c * (1 + amt));
    return (mix(r) << 16) | (mix(g) << 8) | mix(b);
  }

  /** A small toothed gear (hub + N radial teeth), rotated by `ang`. */
  private static drawGear(cg: Phaser.GameObjects.Graphics, x: number, y: number, r: number, ang: number, color: number) {
    cg.lineStyle(1.4, color, 0.9);
    cg.strokeCircle(x, y, r * 0.62);
    const teeth = 8;
    for (let i = 0; i < teeth; i++) {
      const a = ang + (i * Math.PI * 2) / teeth;
      cg.lineBetween(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    cg.fillStyle(color, 0.9); cg.fillCircle(x, y, r * 0.24);
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

    // thin STUN meter under each health bar (fills toward a dizzy).
    const stun = (x: number, w: number, frac: number, rightAlign: boolean) => {
      g.fillStyle(0x1a1e26, 1); g.fillRect(x, 21, w, 2);
      g.fillStyle(0xffcc33, 1);
      const fw = Math.max(0, Math.min(w, Math.round(w * frac)));
      g.fillRect(rightAlign ? x + w - fw : x, 21, fw, 2);
    };
    stun(6, 150, this.engine.p1.stun / 90, false);
    stun(GAME_WIDTH - 156, 150, this.engine.p2.stun / 90, true);

    // HEAT meter (thin, below the stun bar) - red as it nears overheat.
    const heat = (x: number, w: number, f: CombatFighter, rightAlign: boolean) => {
      g.fillStyle(0x1a1e26, 1); g.fillRect(x, 23, w, 1);
      g.fillStyle(f.overheated ? 0xff3322 : 0xff8833, 1);
      const fw = Math.max(0, Math.min(w, Math.round(w * (f.heat / 100))));
      g.fillRect(rightAlign ? x + w - fw : x, 23, fw, 1);
    };
    heat(6, 150, this.engine.p1, false);
    heat(GAME_WIDTH - 156, 150, this.engine.p2, true);
  }

  /** The gear coaching panel for P1: a lit 5-notch ladder coloured cool->hot, the
   * current gear's concrete numbers, and a context line answering "when/why shift".
   * This is the teaching layer for the gear system - the whole point of the game. */
  private drawGearPanel() {
    const f = this.engine.p1;
    const g = this.gearPanelGfx;
    g.clear();
    const x0 = 6, y0 = 30, segW = 10, segH = 6, gap = 2;
    const gearColor = (n: number) =>
      n <= 1 ? 0x66ddaa : n === 2 ? 0x88dd66 : n === 3 ? 0xdddd66 : n === 4 ? 0xffaa44 : 0xff5533;
    for (let n = 1; n <= 5; n++) {
      const x = x0 + (n - 1) * (segW + gap);
      const lit = n === f.gear && !f.overheated;
      const col = f.overheated ? 0x884433 : gearColor(n);
      g.fillStyle(col, lit ? 1 : 0.2); g.fillRect(x, y0, segW, segH);
      g.lineStyle(1, col, lit ? 1 : 0.4); g.strokeRect(x, y0, segW, segH);
    }

    // current gear's trade-off, in plain numbers.
    const spec = f.gearSpec;
    const label = f.overheated
      ? 'オーバーヒート！ ギア操作不能…冷めるのを待つ'
      : `GL${f.gear}  攻撃×${spec.damageMul}  速度×${spec.walkMul}${spec.guardBreak ? '  ガード割り' : ''}`;
    this.gearLabelText.setText(label);

    // context-sensitive coaching: heat -> cool down; want to break guard -> gear up;
    // low gear -> you're fast but light. Teaches the timing, not just the buttons.
    let coach: string;
    if (f.overheated) coach = 'クールダウン中。空くまで我慢';
    else if (f.heat >= 72) coach = '発熱！ G- で下げて冷却';
    else if (f.gear >= 4) coach = '高火力・ガード割り。畳みかけろ';
    else if (f.gear <= 2) coach = '速いが軽い。崩すなら G+ で高ギア';
    else coach = 'G+/G- で変速（変速中は無防備）';
    this.gearCoachText.setText(coach);
  }

  private describe(f: CombatFighter): string {
    const mv = f.move ? `${f.move}:${f.phaseFrame}` : f.phase;
    const gl = f.overheated ? 'OVERHEAT!' : `GL${f.gear}`;
    return `${gl} ${mv}\nHP${f.health} HEAT${Math.round(f.heat)}`;
  }
}
