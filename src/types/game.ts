import type { GearLevel } from '../config/constants';
import type { PartLoadout } from '../config/parts';

export type BattleMode = 'tutorial' | 'story' | 'free';
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
  | 'blockstun'
  | 'shift'
  | 'super'
  | 'throw'
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
  /** Protagonist-only part customization (spec §3.5); see config/parts.ts. */
  loadout?: PartLoadout;
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
  /** Played via DialogueScene after a clean player win, before returning to ModeSelectScene. */
  postWinDialogue?: DialogueLine[];
}

export interface TheoryBonusEvent {
  id: string;
  label: string;
  frames: number;
}

export type PortraitEmotion =
  | 'normal' | 'smile' | 'surprised' | 'angry' | 'serious'
  | 'frustrated' | 'confident' | 'shy' | 'eyes_closed';

export interface DialogueLine {
  speaker: string;
  text: string;
  /** Facial expression for this line's portrait (see PORTRAIT_EMOTIONS). Defaults to 'normal'. */
  emotion?: PortraitEmotion;
  /** Optional visual beat tied to this line, handled by DialogueScene. */
  effect?: 'reveal-hajime' | 'awaken-hajime';
}
