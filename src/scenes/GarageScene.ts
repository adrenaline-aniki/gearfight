import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT } from '../config/constants';
import { ARM_PARTS, HEAD_PARTS, LEG_PARTS, resolveMechType, type ArmPartId, type HeadPartId, type LegPartId, type PartLoadout } from '../config/parts';
import { AudioManager } from '../systems/AudioManager';
import { SaveManager } from '../systems/SaveManager';

const ARM_IDS = Object.keys(ARM_PARTS) as ArmPartId[];
const LEG_IDS = Object.keys(LEG_PARTS) as LegPartId[];
const HEAD_IDS = Object.keys(HEAD_PARTS) as HeadPartId[];

const TYPE_LABEL: Record<string, string> = {
  speed: '速度型', power: 'パワー型', defense: '防御型', balanced: 'バランス型',
};

// Spec §3.5 garage: swap Hajime's four part slots and preview the resulting
// stats. No visual/sprite change (decided scope - parts are stats-only), so
// this screen is entirely about the numbers, not an appearance preview.
export class GarageScene extends Phaser.Scene {
  private audio!: AudioManager;
  private loadout!: PartLoadout;
  private previewText!: Phaser.GameObjects.Text;
  private nameTexts: Partial<Record<keyof PartLoadout, Phaser.GameObjects.Text>> = {};

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

    this.buildSlotRow(40, '頭', 'head', HEAD_IDS, (id) => HEAD_PARTS[id as HeadPartId].name);
    this.buildSlotRow(66, '右腕', 'armRight', ARM_IDS, (id) => ARM_PARTS[id as ArmPartId].name);
    this.buildSlotRow(92, '左腕', 'armLeft', ARM_IDS, (id) => ARM_PARTS[id as ArmPartId].name);
    this.buildSlotRow(118, '脚', 'legs', LEG_IDS, (id) => LEG_PARTS[id as LegPartId].name);

    this.add.rectangle(GAME_WIDTH / 2, 165, GAME_WIDTH - 16, 62, 0x0d0d1a, 0.9).setStrokeStyle(1, 0x4a4a6e);
    this.previewText = this.add.text(16, 140, '', {
      fontSize: '10px', color: '#fff', fontFamily: PIXEL_FONT, lineSpacing: 6,
    });
    this.updatePreview();

    const back = this.add.text(8, GAME_HEIGHT - 14, '← モード選択', {
      fontSize: '10px', color: '#aaa', fontFamily: PIXEL_FONT,
    }).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('ModeSelectScene'));
  }

  private buildSlotRow<K extends keyof PartLoadout>(
    y: number, label: string, slot: K, ids: PartLoadout[K][], nameFor: (id: PartLoadout[K]) => string,
  ) {
    this.add.text(16, y, label, { fontSize: '10px', color: '#aaaacc', fontFamily: PIXEL_FONT }).setOrigin(0, 0.5);

    const nameText = this.add.text(GAME_WIDTH / 2, y, nameFor(this.loadout[slot]), {
      fontSize: '10px', color: '#ffdd44', fontFamily: PIXEL_FONT,
    }).setOrigin(0.5);
    this.nameTexts[slot] = nameText;

    const cycle = (dir: 1 | -1) => {
      const idx = ids.indexOf(this.loadout[slot]);
      const next = ids[(idx + dir + ids.length) % ids.length];
      this.loadout[slot] = next;
      nameText.setText(nameFor(next));
      this.updatePreview();
      SaveManager.save({ loadout: this.loadout });
      this.audio.playSe('select');
    };

    const prev = this.add.text(80, y, '◀', { fontSize: '10px', color: '#88ddff', fontFamily: PIXEL_FONT })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    prev.on('pointerdown', () => cycle(-1));

    const next = this.add.text(GAME_WIDTH - 80, y, '▶', { fontSize: '10px', color: '#88ddff', fontFamily: PIXEL_FONT })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    next.on('pointerdown', () => cycle(1));
  }

  private updatePreview() {
    const type = resolveMechType(this.loadout.armRight, this.loadout.armLeft);
    const head = HEAD_PARTS[this.loadout.head];
    const legs = LEG_PARTS[this.loadout.legs];
    const armR = ARM_PARTS[this.loadout.armRight];
    const armL = ARM_PARTS[this.loadout.armLeft];

    this.previewText.setText([
      `タイプ: ${TYPE_LABEL[type]}　HP: ${1000 + head.hpBonus}　移動: ×${legs.speedMul}`,
      `右腕(弱攻撃) 得意GL${armR.favoredGear.join('-')}　左腕(強攻撃) 得意GL${armL.favoredGear.join('-')}`,
      '速度→パワー→防御→速度の三すくみ。同タイプの腕2本で属性が決まる',
    ].join('\n'));
  }
}
