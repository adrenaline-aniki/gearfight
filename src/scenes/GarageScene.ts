import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT } from '../config/constants';
import {
  ARM_PARTS, HEAD_PARTS, LEG_PARTS, resolveMechType,
  type ArmPartId, type ArmType, type HeadPartId, type LegPartId, type MechType, type PartLoadout,
} from '../config/parts';
import { AudioManager } from '../systems/AudioManager';
import { SaveManager } from '../systems/SaveManager';

const ARM_IDS = Object.keys(ARM_PARTS) as ArmPartId[];
const LEG_IDS = Object.keys(LEG_PARTS) as LegPartId[];
const HEAD_IDS = Object.keys(HEAD_PARTS) as HeadPartId[];

const TYPE_LABEL: Record<MechType, string> = {
  speed: '速度型', power: 'パワー型', defense: '防御型', balanced: 'バランス型',
};
const TYPE_COLOR: Record<ArmType, number> = { speed: 0x66ccff, power: 0xff8844, defense: 0x6699ff };
const MAX_HP_SCALE = 1200; // armor-head ceiling, for the HP bar's full width
const MIN_SPEED_MUL = 0.7;
const MAX_SPEED_MUL = 1.3;

// Spec §3.5 garage: swap Hajime's four part slots and preview the resulting
// stats. No sprite/appearance change in battle (decided scope - parts are
// stats-only), but this screen itself should read at a glance, not like a
// spreadsheet: color-coded types, a type-triangle diagram, and stat bars.
export class GarageScene extends Phaser.Scene {
  private audio!: AudioManager;
  private loadout!: PartLoadout;
  private nameTexts: Partial<Record<keyof PartLoadout, Phaser.GameObjects.Text>> = {};
  private typeDots: Partial<Record<'armRight' | 'armLeft', Phaser.GameObjects.Arc>> = {};
  private preview!: Phaser.GameObjects.Image;
  private typeLabel!: Phaser.GameObjects.Text;
  private triangleNodes: Phaser.GameObjects.Text[] = [];
  private hpBar!: Phaser.GameObjects.Graphics;
  private spdBar!: Phaser.GameObjects.Graphics;
  private hpValueText!: Phaser.GameObjects.Text;
  private spdValueText!: Phaser.GameObjects.Text;
  private descriptionText!: Phaser.GameObjects.Text;

  constructor() {
    super('GarageScene');
  }

  create() {
    this.audio = new AudioManager(this);
    this.audio.unlock();
    this.loadout = { ...SaveManager.load().loadout };

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1a2e);
    this.add.text(GAME_WIDTH / 2, 13, 'ガレージ（パーツ換装）', {
      fontSize: '20px', color: '#fff', fontFamily: PIXEL_FONT, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.buildSlotRow(34, '頭', 'head', HEAD_IDS, (id) => HEAD_PARTS[id as HeadPartId].name, (id) => HEAD_PARTS[id as HeadPartId].description);
    this.buildSlotRow(56, '右腕', 'armRight', ARM_IDS, (id) => ARM_PARTS[id as ArmPartId].name, (id) => ARM_PARTS[id as ArmPartId].description);
    this.buildSlotRow(78, '左腕', 'armLeft', ARM_IDS, (id) => ARM_PARTS[id as ArmPartId].name, (id) => ARM_PARTS[id as ArmPartId].description);
    this.buildSlotRow(100, '脚', 'legs', LEG_IDS, (id) => LEG_PARTS[id as LegPartId].name, (id) => LEG_PARTS[id as LegPartId].description);

    this.add.rectangle(GAME_WIDTH / 2, 157, GAME_WIDTH - 16, 90, 0x0d0d1a, 0.9).setStrokeStyle(1, 0x4a4a6e);

    // Fighter preview, tinted by current type - a menu-only affordance, the
    // actual battle sprite never changes (see CLAUDE.md for why).
    this.preview = this.add.image(50, 194, 'hajime_idle').setOrigin(0.5, 1).setScale(0.32);
    this.typeLabel = this.add.text(50, 118, '', {
      fontSize: '10px', color: '#fff', fontFamily: PIXEL_FONT, fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    // Type triangle: speed -> power -> defense -> speed, per spec §3.5.
    const cx = 190;
    const cy = 152;
    const nodeGeom: { type: ArmType; x: number; y: number }[] = [
      { type: 'speed', x: cx, y: cy - 24 },
      { type: 'power', x: cx + 26, y: cy + 14 },
      { type: 'defense', x: cx - 26, y: cy + 14 },
    ];
    const arrowGfx = this.add.graphics();
    arrowGfx.lineStyle(1, 0x666688, 1);
    for (let i = 0; i < 3; i++) {
      const a = nodeGeom[i];
      const b = nodeGeom[(i + 1) % 3];
      arrowGfx.lineBetween(a.x, a.y, b.x, b.y);
    }
    this.triangleNodes = nodeGeom.map(({ type, x, y }) => this.add.text(x, y, TYPE_LABEL[type].slice(0, -1), {
      fontSize: '10px', color: '#ffffff', fontFamily: PIXEL_FONT,
      backgroundColor: '#222244', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setData('type', type));

    // Stat bars.
    this.add.text(272, 122, 'HP', { fontSize: '10px', color: '#aaaacc', fontFamily: PIXEL_FONT }).setOrigin(0, 0.5);
    this.hpBar = this.add.graphics();
    this.hpValueText = this.add.text(374, 122, '', { fontSize: '10px', color: '#fff', fontFamily: PIXEL_FONT }).setOrigin(1, 0.5);

    this.add.text(272, 140, '移動', { fontSize: '10px', color: '#aaaacc', fontFamily: PIXEL_FONT }).setOrigin(0, 0.5);
    this.spdBar = this.add.graphics();
    this.spdValueText = this.add.text(374, 140, '', { fontSize: '10px', color: '#fff', fontFamily: PIXEL_FONT }).setOrigin(1, 0.5);

    // Part description: dynamic, shows whichever part was most recently
    // cycled (see buildSlotRow's cycle()) so pros/cons are visible right
    // after you change something, full-width so longer text still fits in 2 lines.
    this.descriptionText = this.add.text(90, 176, '', {
      fontSize: '10px', color: '#88ff88', fontFamily: PIXEL_FONT,
      wordWrap: { width: 278, useAdvancedWrap: true }, lineSpacing: 2,
    });

    this.updatePreview();
    this.descriptionText.setText(ARM_PARTS[this.loadout.armRight].description);

    const back = this.add.text(8, GAME_HEIGHT - 10, '← モード選択', {
      fontSize: '10px', color: '#aaa', fontFamily: PIXEL_FONT,
    }).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('ModeSelectScene'));
  }

  private buildSlotRow<K extends keyof PartLoadout>(
    y: number, label: string, slot: K, ids: PartLoadout[K][],
    nameFor: (id: PartLoadout[K]) => string, descriptionFor: (id: PartLoadout[K]) => string,
  ) {
    this.add.text(14, y, label, { fontSize: '10px', color: '#aaaacc', fontFamily: PIXEL_FONT }).setOrigin(0, 0.5);

    const nameText = this.add.text(GAME_WIDTH / 2 - 6, y, nameFor(this.loadout[slot]), {
      fontSize: '10px', color: '#ffdd44', fontFamily: PIXEL_FONT,
    }).setOrigin(0.5);
    this.nameTexts[slot] = nameText;

    if (slot === 'armRight' || slot === 'armLeft') {
      const armSlot = slot as 'armRight' | 'armLeft';
      const dot = this.add.circle(nameText.x + nameText.width / 2 + 12, y, 4, TYPE_COLOR[ARM_PARTS[this.loadout[armSlot]].type]);
      this.typeDots[armSlot] = dot;
    }

    const cycle = (dir: 1 | -1) => {
      const idx = ids.indexOf(this.loadout[slot]);
      const next = ids[(idx + dir + ids.length) % ids.length];
      this.loadout[slot] = next;
      nameText.setText(nameFor(next));
      const dot = this.typeDots[slot as 'armRight' | 'armLeft'];
      if (dot) dot.setPosition(nameText.x + nameText.width / 2 + 12, y).setFillStyle(TYPE_COLOR[ARM_PARTS[next as ArmPartId].type]);
      this.updatePreview();
      this.descriptionText.setText(descriptionFor(next));
      SaveManager.save({ loadout: this.loadout });
      this.audio.playSe('select');
    };

    // Tapping the part's name itself (not just the arrows) also surfaces its
    // description - lets you check pros/cons of the currently-equipped part
    // without needing to cycle away from it first.
    nameText.setInteractive({ useHandCursor: true });
    nameText.on('pointerdown', () => this.descriptionText.setText(descriptionFor(this.loadout[slot])));

    const prev = this.add.text(76, y, '◀', { fontSize: '10px', color: '#88ddff', fontFamily: PIXEL_FONT })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    prev.on('pointerdown', () => cycle(-1));

    const next = this.add.text(GAME_WIDTH - 40, y, '▶', { fontSize: '10px', color: '#88ddff', fontFamily: PIXEL_FONT })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    next.on('pointerdown', () => cycle(1));
  }

  private updatePreview() {
    const type = resolveMechType(this.loadout.armRight, this.loadout.armLeft);
    const head = HEAD_PARTS[this.loadout.head];
    const legs = LEG_PARTS[this.loadout.legs];
    const maxHp = 1000 + head.hpBonus;

    const tintByType: Record<MechType, number> = { ...TYPE_COLOR, balanced: 0xcccccc };
    this.preview.setTint(tintByType[type]);
    this.typeLabel.setText(TYPE_LABEL[type]).setColor(`#${tintByType[type].toString(16).padStart(6, '0')}`);

    this.triangleNodes.forEach((node) => {
      const isCurrent = type === node.getData('type');
      node.setStyle({ backgroundColor: isCurrent ? '#ffdd44' : '#222244' });
      node.setColor(isCurrent ? '#000000' : '#888899');
    });

    this.drawBar(this.hpBar, 272, 128, 102, 6, maxHp / MAX_HP_SCALE, 0x44dd88);
    this.hpValueText.setText(`${maxHp}`);
    this.drawBar(this.spdBar, 272, 146, 102, 6, (legs.speedMul - MIN_SPEED_MUL) / (MAX_SPEED_MUL - MIN_SPEED_MUL), 0x66ccff);
    this.spdValueText.setText(`×${legs.speedMul}`);
  }

  private drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, color: number) {
    g.clear();
    g.fillStyle(0x333344);
    g.fillRect(x, y, w, h);
    g.fillStyle(color);
    g.fillRect(x, y, w * Phaser.Math.Clamp(frac, 0, 1), h);
  }
}
