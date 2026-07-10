import type { Fighter } from '../entities/Fighter';
import type { PlayerInput } from '../types/game';
import { EMPTY_INPUT } from '../systems/InputManager';

export type AIProfile = 'kakashi' | 'sonica' | 'none';

export class AIController {
  private profile: AIProfile;
  private comboCount = 0;
  private gapTimer = 0;
  private thinkTimer = 0;
  private stage = 0;

  constructor(profile: AIProfile) {
    this.profile = profile;
  }

  update(fighter: Fighter, opponent: Fighter): PlayerInput {
    if (this.profile === 'none') return { ...EMPTY_INPUT };

    this.thinkTimer -= 1;
    if (this.thinkTimer > 0) return { ...EMPTY_INPUT };

    if (this.profile === 'kakashi') return this.kakashiAI(fighter);
    return this.sonicaAI(fighter, opponent);
  }

  private kakashiAI(fighter: Fighter): PlayerInput {
    const input = { ...EMPTY_INPUT };
    const step = this.stage;

    if (step === 0) return input;

    if (step === 1) {
      input.right = fighter.x < 300;
      input.left = fighter.x > 300;
      this.thinkTimer = 10;
      return input;
    }

    input.left = true;
    this.thinkTimer = 15;
    return input;
  }

  setKakashiStage(stage: number) {
    this.stage = stage;
  }

  private sonicaAI(fighter: Fighter, opponent: Fighter): PlayerInput {
    const input = { ...EMPTY_INPUT };
    const dist = Math.abs(fighter.x - opponent.x);

    if (this.gapTimer > 0) {
      this.gapTimer -= 1;
      return input;
    }

    fighter.gear = dist > 80 ? 1 : 2;

    if (dist > 60) {
      input.right = fighter.x < opponent.x;
      input.left = fighter.x > opponent.x;
      this.thinkTimer = 4;
      return input;
    }

    if (this.comboCount < 3) {
      input.weak = true;
      this.comboCount += 1;
      this.thinkTimer = 8;
      if (this.comboCount >= 3) {
        this.gapTimer = 12;
        this.comboCount = 0;
      }
      return input;
    }

    this.thinkTimer = 6;
    return input;
  }

  escalateIfLosing(fighter: Fighter, opponent: Fighter) {
    if (fighter.hp < opponent.hp * 0.7) {
      this.stage = Math.min(2, this.stage + 1);
    }
  }
}
