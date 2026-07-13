import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_Y, PIXEL_FONT } from '../config/constants';
import type { CharacterDef } from '../combat/characterDef';
import { loadCharacter, saveCharacter } from '../combat/characterStore';
import type { Box, MoveData } from '../combat/types';

// GEAR FIGHT — the "2D fighting-game maker" editor.
//
// Author a character's moves visually: pick a move, scrub its frames, drag its
// hitbox, tune startup/active/recovery/damage with steppers, then Save and Test
// it live. Everything edits the CharacterDef data the engine already runs, so a
// change here is a change the actual fight uses. No code required.
//
// World<->screen matches TrainingScene: screenX = worldX, screenY = GROUND_Y - worldY.

const EDIT_MOVES = ['light', 'heavy', 'crouchLight'] as const;
const MOVE_LABEL: Record<string, string> = { light: '弱', heavy: '強', crouchLight: 'しゃがみ弱' };

const FIGHTER_X = 96; // where the previewed fighter stands (world x)

export class EditorScene extends Phaser.Scene {
  private def!: CharacterDef;
  private moveId: string = 'light';
  private frame = 1; // 1..total, scrub position

  private boxGfx!: Phaser.GameObjects.Graphics;
  private timelineGfx!: Phaser.GameObjects.Graphics;
  private propTexts: Phaser.GameObjects.Text[] = [];
  private tabTexts: Record<string, Phaser.GameObjects.Text> = {};
  private toast!: Phaser.GameObjects.Text;

  // hitbox drag state
  private dragging = false;
  private dragDX = 0;
  private dragDY = 0;

  // timeline geometry
  private tlX = 8; private tlY = 150; private tlW = 220; private tlH = 12;

  constructor() {
    super('EditorScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d1420');
    this.def = loadCharacter();
    this.moveId = 'light';
    this.frame = 1;

    this.add.text(GAME_WIDTH / 2, 3, `格ツク エディタ — ${this.def.name}`, {
      fontFamily: PIXEL_FONT, fontSize: '10px', color: '#66ffcc',
    }).setOrigin(0.5, 0).setResolution(2);

    // ground
    const g = this.add.graphics();
    g.lineStyle(1, 0x2a3a4a, 1); g.lineBetween(0, GROUND_Y, 240, GROUND_Y);

    this.boxGfx = this.add.graphics();
    this.timelineGfx = this.add.graphics();

    this.buildTabs();
    this.buildProps();
    this.ensureFrameLabel();
    this.buildButtons();
    this.buildTimelineInput();
    this.buildHitboxDrag();

    this.toast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 4, '', {
      fontFamily: PIXEL_FONT, fontSize: '10px', color: '#ffe08a',
    }).setOrigin(0.5, 1).setResolution(2).setDepth(100);

    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('ModeSelectScene'));

    this.redraw();
  }

  private curMove(): MoveData {
    return this.def.moves[this.moveId];
  }
  private total(): number {
    const m = this.curMove();
    return m.startup + m.active + m.recovery;
  }

  // ---- move tabs ---------------------------------------------------------

  private buildTabs() {
    let x = 8;
    for (const id of EDIT_MOVES) {
      const t = this.add.text(x, 16, MOVE_LABEL[id] ?? id, {
        fontFamily: PIXEL_FONT, fontSize: '10px', color: '#ffffff',
        backgroundColor: '#223', padding: { x: 4, y: 2 },
      }).setResolution(2).setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => { this.moveId = id; this.frame = 1; this.refreshTabs(); this.redraw(); });
      this.tabTexts[id] = t;
      x += t.width + 4;
    }
    this.refreshTabs();
  }
  private refreshTabs() {
    for (const id of EDIT_MOVES) {
      this.tabTexts[id].setBackgroundColor(id === this.moveId ? '#3a6' : '#223');
    }
  }

  // ---- property steppers -------------------------------------------------

  private buildProps() {
    const px = 250;
    let y = 30;
    const row = (label: string, get: () => number, set: (v: number) => void, step = 1, min = 0, max = 999) => {
      this.add.text(px, y, label, { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#9fb3c8' }).setResolution(2);
      const minus = this.add.text(px + 66, y, '−', {
        fontFamily: PIXEL_FONT, fontSize: '10px', color: '#fff', backgroundColor: '#334', padding: { x: 4, y: 1 },
      }).setResolution(2).setInteractive({ useHandCursor: true });
      const val = this.add.text(px + 84, y, '0', { fontFamily: PIXEL_FONT, fontSize: '10px', color: '#ffe08a' }).setResolution(2);
      const plus = this.add.text(px + 110, y, '＋', {
        fontFamily: PIXEL_FONT, fontSize: '10px', color: '#fff', backgroundColor: '#334', padding: { x: 4, y: 1 },
      }).setResolution(2).setInteractive({ useHandCursor: true });
      const apply = (d: number) => {
        const nv = Phaser.Math.Clamp(get() + d, min, max);
        set(nv); val.setText(String(get())); this.redraw();
      };
      minus.on('pointerdown', () => apply(-step));
      plus.on('pointerdown', () => apply(step));
      // remember val text to refresh on move switch
      (val as Phaser.GameObjects.Text & { _get?: () => number })._get = get;
      this.propTexts.push(val);
      y += 15;
    };

    row('発生', () => this.curMove().startup, (v) => { this.curMove().startup = v; }, 1, 1, 60);
    row('持続', () => this.curMove().active, (v) => { this.curMove().active = v; }, 1, 1, 30);
    row('硬直', () => this.curMove().recovery, (v) => { this.curMove().recovery = v; }, 1, 1, 60);
    row('威力', () => this.curMove().hit.damage, (v) => { this.curMove().hit.damage = v; }, 5, 0, 500);
    row('のけ反', () => this.curMove().hit.hitstun, (v) => { this.curMove().hit.hitstun = v; }, 1, 0, 60);
    row('ガード', () => this.curMove().hit.blockstun, (v) => { this.curMove().hit.blockstun = v; }, 1, 0, 60);
    row('箱X', () => this.curMove().hitbox.x, (v) => { this.curMove().hitbox.x = v; }, 1, -20, 80);
    row('箱Y', () => this.curMove().hitbox.y, (v) => { this.curMove().hitbox.y = v; }, 1, 0, 70);
    row('箱幅', () => this.curMove().hitbox.w, (v) => { this.curMove().hitbox.w = v; }, 1, 2, 80);
    row('箱高', () => this.curMove().hitbox.h, (v) => { this.curMove().hitbox.h = v; }, 1, 2, 60);
  }

  private refreshProps() {
    for (const t of this.propTexts) {
      const get = (t as Phaser.GameObjects.Text & { _get?: () => number })._get;
      if (get) t.setText(String(get()));
    }
  }

  // ---- action buttons ----------------------------------------------------

  private buildButtons() {
    const mk = (x: number, label: string, color: string, fn: () => void) => {
      const t = this.add.text(x, 182, label, {
        fontFamily: PIXEL_FONT, fontSize: '10px', color: '#fff', backgroundColor: color, padding: { x: 6, y: 3 },
      }).setResolution(2).setInteractive({ useHandCursor: true });
      t.on('pointerdown', fn);
      return t;
    };
    mk(8, '保存', '#2a6', () => { saveCharacter(this.def); this.showToast('保存しました'); });
    mk(52, 'テスト ▶', '#26a', () => { saveCharacter(this.def); this.scene.start('TrainingScene', { def: this.def, from: 'EditorScene' }); });
    mk(140, '書出し', '#555', () => this.exportJson());
    mk(190, '読込', '#555', () => this.importJson());
    this.add.text(8, GAME_HEIGHT - 16, 'ESC/戻る: モード選択  ｜ タイムラインをドラッグでコマ送り、赤い箱をドラッグで移動', {
      fontFamily: PIXEL_FONT, fontSize: '10px', color: '#48566a',
    }).setResolution(2);
  }

  private exportJson() {
    const json = JSON.stringify(this.def);
    // Prefer clipboard; fall back to a prompt the user can copy from.
    const done = () => this.showToast('JSONをコピーしました');
    try {
      navigator.clipboard?.writeText(json).then(done).catch(() => window.prompt('コピーしてください', json));
    } catch {
      window.prompt('コピーしてください', json);
    }
  }
  private importJson() {
    const text = window.prompt('キャラJSONを貼り付け');
    if (!text) return;
    try {
      const def = JSON.parse(text) as CharacterDef;
      if (!def.moves || !def.gears) throw new Error('bad');
      this.def = def; saveCharacter(def);
      this.moveId = 'light'; this.frame = 1;
      this.refreshTabs(); this.refreshProps(); this.redraw();
      this.showToast('読み込みました');
    } catch {
      this.showToast('JSONが不正です');
    }
  }

  private showToast(msg: string) {
    this.toast.setText(msg);
    this.tweens.killTweensOf(this.toast);
    this.toast.setAlpha(1);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1200, duration: 600 });
  }

  // ---- timeline scrubbing ------------------------------------------------

  private buildTimelineInput() {
    const zone = this.add.zone(this.tlX, this.tlY - 6, this.tlW, this.tlH + 16).setOrigin(0, 0).setInteractive();
    const scrub = (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const t = Phaser.Math.Clamp((p.x - this.tlX) / this.tlW, 0, 1);
      this.frame = Math.max(1, Math.round(t * (this.total() - 1)) + 1);
      this.redraw();
    };
    zone.on('pointerdown', scrub);
    zone.on('pointermove', scrub);
  }

  // ---- hitbox drag -------------------------------------------------------

  private buildHitboxDrag() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const r = this.hitboxScreenRect();
      if (!r) return;
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        this.dragging = true;
        this.dragDX = p.x - r.x;
        this.dragDY = p.y - r.y;
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      const m = this.curMove();
      // new top-left screen -> world box coords (facing = +1)
      const nx = p.x - this.dragDX;       // screen left
      const ntop = p.y - this.dragDY;     // screen top
      m.hitbox.x = Math.round(nx - FIGHTER_X);
      m.hitbox.y = Math.round(GROUND_Y - (ntop + m.hitbox.h));
      m.hitbox.y = Phaser.Math.Clamp(m.hitbox.y, 0, 70);
      this.refreshProps();
      // keep scrub inside the active window so the box stays visible while dragging
      if (!this.isActiveFrame()) this.frame = m.startup + 1;
      this.redraw();
    });
    this.input.on('pointerup', () => { this.dragging = false; });
  }

  private isActiveFrame(): boolean {
    const m = this.curMove();
    return this.frame > m.startup && this.frame <= m.startup + m.active;
  }

  /** Screen rect of the hitbox at the current frame, or null if not active. */
  private hitboxScreenRect(): { x: number; y: number; w: number; h: number } | null {
    if (!this.isActiveFrame()) return null;
    return this.boxToScreen(this.curMove().hitbox);
  }

  private boxToScreen(b: Box): { x: number; y: number; w: number; h: number } {
    // facing = +1: forward is +x. near edge = FIGHTER_X + b.x.
    const x = FIGHTER_X + b.x;
    const top = GROUND_Y - (b.y + b.h);
    return { x, y: top, w: b.w, h: b.h };
  }

  // ---- rendering ---------------------------------------------------------

  private redraw() {
    this.refreshProps();
    this.drawPreview();
    this.drawTimeline();
  }

  private drawPreview() {
    const g = this.boxGfx;
    g.clear();
    // fighter body (pushbox) + hurtbox
    const push = this.def.pushbox;
    const pr = this.boxToScreen(push);
    g.fillStyle(0x4488ff, 0.5); g.fillRoundedRect(pr.x, pr.y, pr.w, pr.h, 4);
    const hurt = this.boxToScreen(this.def.standHurtbox);
    g.lineStyle(1, 0x33aaff, 1); g.strokeRect(hurt.x, hurt.y, hurt.w, hurt.h);

    // hitbox, only during the active window
    if (this.isActiveFrame()) {
      const hr = this.boxToScreen(this.curMove().hitbox);
      g.fillStyle(0xff3344, 0.32); g.fillRect(hr.x, hr.y, hr.w, hr.h);
      g.lineStyle(1, 0xff5566, 1); g.strokeRect(hr.x, hr.y, hr.w, hr.h);
      // drag handle hint
      g.fillStyle(0xffffff, 0.9); g.fillCircle(hr.x + hr.w, hr.y, 2);
    }
  }

  private drawTimeline() {
    const g = this.timelineGfx;
    g.clear();
    const m = this.curMove();
    const total = this.total();
    const bandW = (n: number) => (n / total) * this.tlW;
    let x = this.tlX;
    const band = (n: number, color: number) => { g.fillStyle(color, 1); g.fillRect(x, this.tlY, bandW(n), this.tlH); x += bandW(n); };
    band(m.startup, 0x3a4a6a);   // startup - blue-grey
    band(m.active, 0xcc3344);    // active - red
    band(m.recovery, 0x555b66);  // recovery - grey
    g.lineStyle(1, 0x000000, 1); g.strokeRect(this.tlX, this.tlY, this.tlW, this.tlH);
    // playhead
    const hx = this.tlX + ((this.frame - 1) / Math.max(1, total - 1)) * this.tlW;
    g.fillStyle(0xffffff, 1); g.fillRect(hx - 1, this.tlY - 4, 2, this.tlH + 8);
    // labels
    this.frameLabel?.setText(`F ${this.frame}/${total}  発生${m.startup} 持続${m.active} 硬直${m.recovery}  [${this.isActiveFrame() ? '攻撃判定' : this.frame <= m.startup ? '発生前' : '硬直'}]`);
  }

  private frameLabel?: Phaser.GameObjects.Text;

  // lazily create the frame label under the timeline
  private ensureFrameLabel() {
    if (!this.frameLabel) {
      this.frameLabel = this.add.text(this.tlX, this.tlY + 16, '', {
        fontFamily: PIXEL_FONT, fontSize: '10px', color: '#c8d4e0',
      }).setResolution(2);
    }
  }
}
