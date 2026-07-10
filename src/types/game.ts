import type { GearLevel } from '../config/constants';

export type BattleMode = 'tutorial' | 'story' | 'free' | 'classroom';
export type FighterId = 'hajime' | 'kakashi' | 'wizel' | 'ganrock' | 'aegis' | 'drift' | 'theorion' | 'omeganova' | 'sophislegion';
export type SpriteFighterId = 'hajime' | 'wizel' | 'kakashi' | 'ganrock' | 'aegis' | 'drift' | 'theorion' | 'omeganova' | 'sophislegion';

export type FighterState =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'crouch'
  | 'attack_weak'
  | 'attack_strong'
  | 'block'
  | 'shift'
  | 'hitstun'
  | 'knockdown'
  | 'dead';

export interface FighterConfig {
  id: FighterId;
  name: string;
  maxHp: number;
  facing: 1 | -1;
  x: number;
  gear?: GearLevel;
}

export interface PlayerInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  weak: boolean;
  strong: boolean;
  gearUp: boolean;
  gearDown: boolean;
  jump: boolean;
}

export interface BattleConfig {
  mode: BattleMode;
  player1: FighterId;
  player2: FighterId;
  roundTime: number;
  roundsToWin: number;
  tutorialStep?: number;
  assistMode?: boolean;
}

export interface TheoryBonusEvent {
  id: string;
  label: string;
  frames: number;
}

export interface DialogueLine {
  speaker: string;
  text: string;
  /** Optional visual beat tied to this line, handled by DialogueScene. */
  effect?: 'reveal-hajime' | 'awaken-hajime';
}
