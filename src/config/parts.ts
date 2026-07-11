import type { FighterId } from '../types/game';
import type { GearLevel } from './constants';

// Spec §3.5 "パーツカスタマイズ" — stats-only per the decision recorded in
// CLAUDE.md: parts change performance (GL affinity, type matchup, speed),
// never the battle sprite. The fiction is that you're swapping the arm's
// internal mechanism / a data chip, not anything visible from outside.

export type ArmType = 'speed' | 'power' | 'defense';
export type MechType = ArmType | 'balanced';

export interface ArmPart {
  id: string;
  name: string;
  type: ArmType;
  mechanism: 'slider-crank' | 'lever-crank' | 'cam-oscillating';
  favoredGear: GearLevel[];
  damageMul: number; // bonus applied when attacking while at a favored GL
}

export const ARM_PARTS = {
  slider: {
    id: 'slider', name: 'スライダアーム', type: 'speed', mechanism: 'slider-crank',
    favoredGear: [1, 2], damageMul: 1.15,
  },
  gunlock: {
    id: 'gunlock', name: 'ガンロックアーム', type: 'power', mechanism: 'lever-crank',
    favoredGear: [4, 5], damageMul: 1.15,
  },
  aegis: {
    id: 'aegis', name: 'イージスアーム', type: 'defense', mechanism: 'cam-oscillating',
    favoredGear: [3, 4], damageMul: 1.1,
  },
} as const satisfies Record<string, ArmPart>;

export type ArmPartId = keyof typeof ARM_PARTS;

export interface LegPart {
  id: string;
  name: string;
  drive: 'belt' | 'crawler' | 'chain-ice' | 'chain-sand';
  speedMul: number;
  staggerResist: boolean;
  slipRisk: boolean; // loses grip on ice/oil terrain (not modeled yet, reserved for §3.5 terrain stages)
}

export const LEG_PARTS = {
  wheel: { id: 'wheel', name: 'ホイールレッグ', drive: 'belt', speedMul: 1.25, staggerResist: false, slipRisk: true },
  crawler: { id: 'crawler', name: 'クローラーレッグ', drive: 'crawler', speedMul: 0.85, staggerResist: true, slipRisk: false },
  spike: { id: 'spike', name: 'スパイクレッグ', drive: 'chain-ice', speedMul: 1.0, staggerResist: false, slipRisk: false },
  wide: { id: 'wide', name: 'ワイドレッグ', drive: 'chain-sand', speedMul: 1.0, staggerResist: false, slipRisk: false },
} as const satisfies Record<string, LegPart>;

export type LegPartId = keyof typeof LEG_PARTS;

export interface HeadPart {
  id: string;
  name: string;
  hpBonus: number;
  scouter: boolean; // reveals opponent's GL/heat in the HUD (not wired up yet)
}

export const HEAD_PARTS = {
  sensor: { id: 'sensor', name: 'センサーヘッド', hpBonus: 0, scouter: true },
  armor: { id: 'armor', name: 'アーマーヘッド', hpBonus: 100, scouter: false },
} as const satisfies Record<string, HeadPart>;

export type HeadPartId = keyof typeof HEAD_PARTS;

export interface PartLoadout {
  head: HeadPartId;
  armRight: ArmPartId; // governs weak attacks
  armLeft: ArmPartId; // governs strong attacks
  legs: LegPartId;
}

// Hajime starts as spec's "無装飾の灰色素体" - no fixed type yet, represented
// by a deliberately mismatched arm pair (resolveMechType below returns
// 'balanced' whenever the two arms differ).
export const DEFAULT_LOADOUT: PartLoadout = {
  head: 'sensor', armRight: 'slider', armLeft: 'aegis', legs: 'wheel',
};

export function resolveMechType(armRight: ArmPartId, armLeft: ArmPartId): MechType {
  const right = ARM_PARTS[armRight].type;
  const left = ARM_PARTS[armLeft].type;
  return right === left ? right : 'balanced';
}

// Speed -> Power -> Defense -> Speed (spec §3.5, Pokemon-style, +-20%).
const BEATS: Record<ArmType, ArmType> = { speed: 'power', power: 'defense', defense: 'speed' };

export function typeMatchupMultiplier(attacker: MechType, defender: MechType): number {
  if (attacker === 'balanced' || defender === 'balanced') return 1;
  if (BEATS[attacker] === defender) return 1.2;
  if (BEATS[defender] === attacker) return 0.8;
  return 1;
}

// Flavor name shown on the super-move callout - numbers are identical across
// types (kept flat/simple, see BattleScene.checkHit()), only the name changes.
export const SUPER_MOVE_NAME: Record<MechType, string> = {
  speed: 'オーバーシフトダッシュ',
  power: 'トルクブレイカー',
  defense: 'リジッドカウンター',
  balanced: 'ギアマックス',
};

// Story-cast mechs read their type from their established character concept
// (settei sheet chapter themes) rather than an equippable loadout - only the
// protagonist customizes parts per spec §3.5's "ロックマン方式" acquisition.
export const FIGHTER_INNATE_TYPE: Record<FighterId, MechType> = {
  hajime: 'balanced',
  kakashi: 'balanced',
  wizel: 'speed',
  ganrock: 'power',
  aegis: 'defense',
  drift: 'balanced',
  theorion: 'balanced',
  omeganova: 'balanced',
  sophislegion: 'balanced',
};
