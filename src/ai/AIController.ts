import type { Fighter } from '../entities/Fighter';
import type { PlayerInput } from '../types/game';
import { EMPTY_INPUT } from '../systems/InputManager';

export type AIProfile = 'kakashi' | 'sonica' | 'none';

// How close the opponent needs to be for a committed-to-attack read to bother
// blocking - roughly the reach of a strong attack's hitbox plus some margin.
const BLOCK_RANGE = 80;

export class AIController {
  private profile: AIProfile;
  private comboCount = 0;
  private gapTimer = 0;
  private thinkTimer = 0;
  private stage = 0;

  // Guard reaction state: decided once per incoming attack (not every frame),
  // with a short delay before the guard actually goes up so it reads as a
  // reaction rather than a psychic block.
  private blockDecided = false;
  private blockCommitted = false;
  private blockReactionFrames = 0;

  constructor(profile: AIProfile) {
    this.profile = profile;
  }

  update(fighter: Fighter, opponent: Fighter): PlayerInput {
    if (this.profile === 'none') return { ...EMPTY_INPUT };

    // Blocking is a reflex, not a "thought" - it bypasses the thinkTimer
    // cooldown that paces normal decisions, so the guard input can be held
    // every frame for as long as the read attack is still active.
    if (this.profile !== 'kakashi') {
      const blockInput = this.tryBlock(fighter, opponent);
      if (blockInput) return blockInput;
    }

    this.thinkTimer -= 1;
    if (this.thinkTimer > 0) return { ...EMPTY_INPUT };

    if (this.profile === 'kakashi') return this.kakashiAI(fighter);
    return this.sonicaAI(fighter, opponent);
  }

  private tryBlock(fighter: Fighter, opponent: Fighter): PlayerInput | null {
    const opponentAttacking = opponent.state === 'attack_weak' || opponent.state === 'attack_strong';
    if (!opponentAttacking) {
      this.blockDecided = false;
      this.blockCommitted = false;
      return null;
    }

    const dist = Math.abs(fighter.x - opponent.x);
    if (!this.blockDecided) {
      this.blockDecided = true;
      // Higher escalation stage = more attentive defense, but never a sure thing.
      const blockChance = 0.4 + this.stage * 0.15;
      this.blockCommitted = dist <= BLOCK_RANGE && Math.random() < blockChance;
      this.blockReactionFrames = 3 + Math.floor(Math.random() * 5);
    }

    if (!this.blockCommitted || dist > BLOCK_RANGE) return null;
    if (this.blockReactionFrames > 0) {
      this.blockReactionFrames -= 1;
      return null;
    }

    const input = { ...EMPTY_INPUT };
    input.left = fighter.facing === 1;
    input.right = fighter.facing === -1;
    return input;
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

    // Cash in the super the moment it's ready and the opponent is in range -
    // both attack buttons at once, same as the human input (see Fighter.processInput).
    if (fighter.superGauge >= 100 && dist <= 70) {
      input.weak = true;
      input.strong = true;
      this.thinkTimer = 24;
      return input;
    }

    // Manage heat like a real player would: back off a gear before overheating
    // instead of grinding at GL4-5 forever.
    if (fighter.heat > 70 && fighter.gear > 2) {
      input.gearDown = true;
      this.thinkTimer = 4;
      return input;
    }

    // Occasionally commit to a higher gear at a safe distance for a heavier
    // punish. This goes through the real shift minigame (input.gearUp), not a
    // direct gear assignment, so the CPU is briefly vulnerable mid-shift just
    // like a player. The cap rises with the escalation stage, so the CPU only
    // reaches for GL4-5 (and the heat/guard-break risk that comes with them)
    // once it's already fighting back from a deficit.
    const gearCap = 3 + this.stage;
    if (dist > 90 && fighter.gear < gearCap && Math.random() < 0.02 + this.stage * 0.015) {
      input.gearUp = true;
      this.thinkTimer = 4;
      return input;
    }

    if (dist > 60) {
      input.right = fighter.x < opponent.x;
      input.left = fighter.x > opponent.x;
      // Rare jump-in for movement variety - purely cosmetic, no dedicated
      // anti-air/overhead mechanic exists to make this a real mixup (yet).
      if (dist < 150 && Math.random() < 0.03) input.jump = true;
      this.thinkTimer = 4;
      return input;
    }

    // Point-blank and the human is turtling: throw instead of feeding another
    // strike into their guard. This is the actual answer to "just hold block" -
    // gives blocking a real cost and rewards the player for recognizing it.
    if (dist <= 26 && (opponent.state === 'block' || opponent.state === 'blockstun') && Math.random() < 0.3 + this.stage * 0.15) {
      input.weak = true;
      input.gearDown = true;
      this.thinkTimer = 10;
      return input;
    }

    if (this.comboCount < 3) {
      // Weak pokes lead the string; the CPU only reaches for the slower,
      // riskier strong finisher some of the time, more often as it escalates.
      const goStrong = this.comboCount === 2 && Math.random() < 0.2 + this.stage * 0.15;
      if (goStrong) input.strong = true; else input.weak = true;
      this.comboCount += 1;
      this.thinkTimer = goStrong ? 10 : 8;
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
