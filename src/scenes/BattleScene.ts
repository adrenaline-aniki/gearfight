import Phaser from 'phaser';
import {
  GAME_HEIGHT, GAME_WIDTH, GROUND_Y, PIXEL_FONT,
  KNOCKBACK_BLOCK, KNOCKBACK_HIT, KNOCKBACK_KNOCKDOWN_BONUS, KNOCKBACK_STRONG_BONUS,
  KNOCKBACK_SUPER_BONUS, KNOCKBACK_SPEED_SUPER_BONUS, KNOCKBACK_THROW_BONUS,
} from '../config/constants';
import { SUPER_MOVE_NAME, typeMatchupMultiplier } from '../config/parts';
import { AIController } from '../ai/AIController';
import { Fighter } from '../entities/Fighter';
import { AudioManager } from '../systems/AudioManager';
import { GameFeel } from '../systems/GameFeel';
import { InputManager } from '../systems/InputManager';
import { spawnMechanismOverlay } from '../systems/MechanismOverlay';
import { SaveManager } from '../systems/SaveManager';
import { BattleHUD } from '../ui/BattleHUD';
import { TouchControls } from '../ui/TouchControls';
import { loadFighterSprites, setLoaderBase } from '../systems/AssetPaths';
import { SPRITE_FIGHTERS } from '../config/constants';
import {
  TUTORIAL_INTRO, TUTORIAL_STEP2_INTRO, TUTORIAL_STEP3_INTRO, TUTORIAL_STEP4_INTRO, TUTORIAL_OUTRO,
} from '../data/tutorialDialogue';
import type { BattleConfig, DialogueLine, TheoryBonusEvent, SpriteFighterId } from '../types/game';

export class BattleScene extends Phaser.Scene {
  private config!: BattleConfig;
  private p1!: Fighter;
  private p2!: Fighter;
  private inputMgr!: InputManager;
  private hud!: BattleHUD;
  private gameFeel!: GameFeel;
  private audio!: AudioManager;
  private ai!: AIController;
  private touch?: TouchControls;

  private roundTimer = 0;
  private theoryCount = 0;
  private theoryEvents: TheoryBonusEvent[] = [];
  private roundOver = false;
  private tutorialHits = 0;
  private tutorialStep = 1;
  private tutorialSuperLanded = false;
  private assistMode = true;

  constructor() {
    super('BattleScene');
  }

  init(data: BattleConfig) {
    this.config = data;
    this.assistMode = data.assistMode ?? true;
    this.tutorialStep = data.tutorialStep ?? 1;
    this.roundTimer = data.roundTime;
    this.theoryCount = 0;
    this.theoryEvents = [];
    this.roundOver = false;
    this.tutorialHits = 0;
    this.tutorialSuperLanded = false;
  }

  preload() {
    setLoaderBase(this);
    if ((SPRITE_FIGHTERS as readonly string[]).includes(this.config.player1)) {
      loadFighterSprites(this, this.config.player1 as SpriteFighterId);
    }
    if ((SPRITE_FIGHTERS as readonly string[]).includes(this.config.player2)) {
      loadFighterSprites(this, this.config.player2 as SpriteFighterId);
    }
  }

  create() {
    this.drawStage();
    this.audio = new AudioManager(this);
    this.audio.unlock();

    // Battle BGM (~7MB) loads in the background instead of delaying the
    // fight from starting - see TitleScene's create() for the same pattern.
    AudioManager.preloadBattle(this);
    if (this.load.list.size > 0) {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        if (this.scene.isActive()) this.audio.playBgm('bgmBattle');
      });
      this.load.start();
    } else {
      this.audio.playBgm('bgmBattle');
    }

    this.p1 = new Fighter(this, {
      id: this.config.player1,
      name: this.getName(this.config.player1),
      maxHp: 1000,
      facing: 1,
      x: 100,
      loadout: this.config.player1 === 'hajime' ? SaveManager.load().loadout : undefined,
    });
    this.p1.isPlayer = true;

    this.p2 = new Fighter(this, {
      id: this.config.player2,
      name: this.getName(this.config.player2),
      maxHp: 1000,
      facing: -1,
      x: 280,
      gear: this.config.player2 === 'wizel' ? 1 : 3,
    });
    this.p2.isAI = true;

    this.inputMgr = new InputManager(this);
    this.gameFeel = new GameFeel(this, this.cameras.main);
    this.hud = new BattleHUD(this);

    const aiProfile = this.config.player2 === 'kakashi' ? 'kakashi' : 'sonica';
    this.ai = new AIController(aiProfile);
    if (this.config.mode === 'tutorial') {
      // Stage 0 (kakashi stands still) for steps 1 and 4 - both are about
      // landing a specific attack cleanly, not about kakashi's movement.
      const kakashiStage = this.tutorialStep === 2 ? 1 : this.tutorialStep === 3 ? 2 : 0;
      this.ai.setKakashiStage(kakashiStage);
      // Super move step: the gauge fills naturally from landing/taking hits
      // in earlier steps, but guarantee it's ready here rather than leave
      // whether it's actually full up to how the earlier steps went.
      if (this.tutorialStep === 4) this.p1.superGauge = 100;
    }

    this.touch = new TouchControls(this, this.inputMgr);

    this.showRoundAnnounce();

    if (this.config.showTutorialIntro) {
      this.scene.pause();
      this.scene.launch('DialogueScene', { lines: TUTORIAL_INTRO, overlay: true, resumeScene: 'BattleScene' });
      // Scenes render in their main.ts registration order regardless of
      // launch order, and DialogueScene is registered before BattleScene -
      // without this the paused battle would draw right over the overlay.
      this.scene.bringToTop('DialogueScene');
    }
  }

  private drawStage() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2c3e50, 0x2c3e50, 0x1a252f, 0x1a252f);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fillStyle(0x555555);
    bg.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
    bg.lineStyle(1, 0x888888);
    bg.lineBetween(0, GROUND_Y, GAME_WIDTH, GROUND_Y);
    bg.lineStyle(1, 0x444444, 0.5);
    bg.lineBetween(GAME_WIDTH / 2, 0, GAME_WIDTH / 2, GAME_HEIGHT);
  }

  private getName(id: string): string {
    const names: Record<string, string> = { hajime: 'ハジメ', kakashi: 'カカシくん', wizel: 'ウィズル', ganrock: 'ガンロック', aegis: 'アイギス', drift: 'ドリフト', theorion: 'テオリオン', omeganova: 'オメガノヴァ', sophislegion: 'ソフィス・レギオン' };
    return names[id] ?? id;
  }

  private showRoundAnnounce() {
    const label = this.config.mode === 'tutorial'
      ? `チュートリアル Step ${this.tutorialStep}`
      : 'ROUND 1';
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, label, {
      fontSize: '20px', color: '#fff', fontFamily: PIXEL_FONT, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(150);

    this.time.delayedCall(1200, () => text.destroy());
  }

  update(_time: number, delta: number) {
    if (this.roundOver) return;

    this.gameFeel.tickSlowMo();
    if (this.gameFeel.shouldSkipLogic()) {
      this.syncVisuals();
      return;
    }

    this.inputMgr.update();
    const p1Input = this.inputMgr.getP1();
    let p2Input = this.inputMgr.getP2();

    if (this.p2.isAI) {
      p2Input = this.ai.update(this.p2, this.p1);
      this.ai.escalateIfLosing(this.p2, this.p1);
    }

    this.p1.tickBuffer();
    this.p2.tickBuffer();

    this.p1.updateFacing(this.p2.x);
    this.p2.updateFacing(this.p1.x);

    this.p1.processInput(p1Input, this.assistMode);
    this.p2.processInput(p2Input, this.assistMode);

    this.p1.tickState();
    this.p2.tickState();
    if (this.p1.superJustActivated) { this.p1.superJustActivated = false; this.onSuperActivated(this.p1); }
    if (this.p2.superJustActivated) { this.p2.superJustActivated = false; this.onSuperActivated(this.p2); }
    this.p1.applyPhysics();
    this.p2.applyPhysics();
    this.p1.redraw();
    this.p2.redraw();

    const deltaSec = (delta / 1000) * this.gameFeel.getTimeScale();
    this.p1.tickHeat(deltaSec);
    this.p2.tickHeat(deltaSec);
    this.p1.tickGuard(deltaSec);
    this.p2.tickGuard(deltaSec);

    this.resolveCombat();
    this.gameFeel.update();

    this.roundTimer -= deltaSec;
    if (this.roundTimer <= 0) this.endRound('timeup');

    this.hud.update(this.p1, this.p2, this.roundTimer, this.theoryCount, this.getHint());
    this.touch?.updateGear(this.p1.gear);
    this.syncVisuals();

    if (this.p1.hp <= 0) this.endRound('p2');
    else if (this.p2.hp <= 0) this.endRound('p1');

    this.checkTutorialProgress();
  }

  private resolveCombat() {
    this.checkHit(this.p1, this.p2);
    this.checkHit(this.p2, this.p1);
  }

  private onSuperActivated(fighter: Fighter) {
    this.hud.showSuperPopup(SUPER_MOVE_NAME[fighter.getMechType()]);
    this.audio.playSe('super');
    this.cameras.main.flash(150, 255, 220, 100);
  }

  private checkHit(attacker: Fighter, defender: Fighter) {
    if (!attacker.attackActive || !attacker.hitbox) return;
    // A single move connects only once, even though its hitbox stays active for
    // several frames - this (not a long defender invuln) is what stops multi-hits,
    // which is what frees the short invuln up to allow combos between moves.
    if (attacker.hasHitThisAttack) return;

    const isThrow = attacker.state === 'throw';
    if (isThrow ? !defender.isThrowable() : !defender.isVulnerable()) return;

    const body = new Phaser.Geom.Rectangle(defender.x - 14, defender.y - 40, 28, 40);
    if (!Phaser.Geom.Intersects.RectangleToRectangle(attacker.hitbox, body)) return;
    attacker.hasHitThisAttack = true;

    const isSuper = attacker.state === 'super';
    const wasGuarding = defender.state === 'block' || defender.state === 'blockstun';
    // Throws bypass guard entirely - that's the whole point of adding them
    // (holding block forever stops being a free win). blockstun counts as still
    // guarding so a fast follow-up during the block flinch is blocked (chip),
    // not treated as a clean hit - otherwise a blockstring would break guard for
    // free and even start a bogus combo on a defender who never stopped blocking.
    const isGuarded = !isThrow && (defender.state === 'block' || defender.state === 'blockstun');
    const isShiftHit = defender.isShifting();
    // Supers crush guard unconditionally instead of just chipping through it -
    // reuses the existing guard-break math in Fighter.takeDamage() by zeroing
    // the gauge right before the hit resolves.
    if (isSuper && isGuarded) defender.guardGauge = 0;
    const matchup = isThrow ? 1 : typeMatchupMultiplier(attacker.getMechType(), defender.getMechType());
    const rawDamage = isThrow ? attacker.getThrowDamage() : isSuper ? attacker.getSuperDamage() : attacker.getAttackDamage();
    const dmg = defender.takeDamage(Math.round(rawDamage * matchup), isGuarded, isShiftHit);

    if (dmg > 0) {
      attacker.onHitLanded();
      defender.onDamageTaken(dmg);

      // ギアラッシュ combo bookkeeping: only clean normal hits (not guarded,
      // super, or throw) advance the chain and open the cancel window. A blocked
      // normal breaks the attacker's chain (blockstrings aren't a combo here).
      const isNormal = !isSuper && !isThrow;
      if (isNormal && !isGuarded) {
        attacker.onAttackConnected(this.assistMode);
        if (attacker.comboHits >= 2) this.hud.showCombo(attacker.comboHits);
      } else if (isNormal && isGuarded) {
        attacker.comboHits = 0;
        attacker.cancelWindow = 0;
      }

      const isStrong = attacker.state === 'attack_strong' || isSuper;

      let knockback = defender.state === 'blockstun'
        ? KNOCKBACK_BLOCK
        : defender.state === 'knockdown'
          ? KNOCKBACK_HIT + KNOCKBACK_KNOCKDOWN_BONUS
          : KNOCKBACK_HIT;
      if (isStrong) knockback += KNOCKBACK_STRONG_BONUS;
      if (isSuper) knockback += KNOCKBACK_SUPER_BONUS;
      if (isThrow) knockback += KNOCKBACK_THROW_BONUS;
      // Speed-type super trait (see Fighter.getSuperStartup() for the sibling
      // power/defense traits): the payoff for its bare-bones damage is a
      // rush-down shove instead of a bigger number.
      if (isSuper && attacker.getMechType() === 'speed') knockback += KNOCKBACK_SPEED_SUPER_BONUS;
      defender.applyKnockback(attacker.facing * knockback);

      // Meatier hitstop than before (weak 4->7, strong 8->11) to sell impact,
      // with a couple extra frames deeper into a combo so each successive hit
      // lands harder - the escalating "pause" is a big part of the rush feel.
      const comboPunch = Math.min(attacker.comboHits, 3);
      this.gameFeel.applyHitstop((isSuper ? 16 : isThrow ? 8 : isStrong ? 11 : 7) + comboPunch);
      this.gameFeel.applyShake(isSuper ? 7 : isThrow ? 3 : isStrong ? 4 : 2, isSuper ? 16 : isThrow ? 6 : isStrong ? 8 : 4);
      this.gameFeel.spawnHitSpark(defender.x, defender.y - 20, isStrong);
      spawnMechanismOverlay(
        this, attacker.x, attacker.y - 30,
        isThrow ? 'clamp' : isStrong ? 'lever-crank' : 'slider-crank',
        attacker.facing,
      );
      this.audio.playSe(isThrow ? 'throw' : isGuarded ? 'guard' : isStrong ? 'hit_strong' : 'hit_weak');

      if (isShiftHit) this.addTheoryBonus('shift_gap', 'シフト中は無防備！');
      if (attacker.canGuardBreak() && isGuarded) this.addTheoryBonus('guard_break', 'GL4以上でガードブレイク！');
      if (isThrow && wasGuarding) this.addTheoryBonus('throw_break', 'ガードは投げには無力！');
      if (defender.overheatTimer > 0) this.addTheoryBonus('overheat', 'オーバーヒート中の追撃！');
      if (matchup > 1) this.addTheoryBonus('type_advantage', 'タイプ相性で追加ダメージ！');

      if (this.config.mode === 'tutorial' && attacker === this.p1) {
        this.tutorialHits += 1;
        if (isSuper) this.tutorialSuperLanded = true;
      }
    }
  }

  private addTheoryBonus(id: string, label: string) {
    if (this.theoryEvents.some((e) => e.id === id)) return;
    this.theoryCount += 1;
    const event: TheoryBonusEvent = { id, label, frames: 60 };
    this.theoryEvents.push(event);
    this.hud.showTheoryBonus(event);
    this.p1.superGauge = Math.min(100, this.p1.superGauge + 25);
  }

  private getHint(): string {
    if (this.config.mode !== 'tutorial') return '';
    const hints: Record<number, string> = {
      1: '←→移動  Z:弱攻撃  X:強攻撃  Space:ジャンプ  カカシに10発当てよう',
      2: 'Q/E:ギアDOWN/UP  光る瞬間にもう一度押すとパーフェクトシフト！',
      3: 'GL4以上(Eを2回)に上げて X:強攻撃でガードブレイク！',
      4: 'ゲージMAX時にZ+X同時押しで必殺技！ カカシに1発当てよう',
    };
    return hints[this.tutorialStep] ?? '';
  }

  private checkTutorialProgress() {
    if (this.config.mode !== 'tutorial' || this.roundOver) return;

    if (this.tutorialStep === 1 && this.tutorialHits >= 10) {
      this.advanceTutorial(2, TUTORIAL_STEP2_INTRO);
    } else if (this.tutorialStep === 2 && this.p1.perfectShiftCount >= 1) {
      this.advanceTutorial(3, TUTORIAL_STEP3_INTRO);
    } else if (this.tutorialStep === 3 && this.theoryEvents.some((e) => e.id === 'guard_break')) {
      this.advanceTutorial(4, TUTORIAL_STEP4_INTRO);
    } else if (this.tutorialStep === 4 && this.tutorialSuperLanded) {
      this.completeTutorial();
    }
  }

  // Nogi-sensei narrates what's coming next via DialogueScene overlaid on
  // top of the (paused, but still visible) battle screen - these lines
  // reference specific HUD elements (heat bar, guard gauge, etc.), which a
  // separate black-background scene would hide right when they're relevant -
  // then restarts this same BattleScene at the next tutorialStep (see
  // init()/create()'s stage/gauge setup for that step): a fresh Fighter pair
  // each time, so hp resets for free instead of needing to do it here like
  // the old in-place version.
  private advanceTutorial(step: number, introLines: DialogueLine[]) {
    this.roundOver = true;
    this.scene.pause();
    this.scene.launch('DialogueScene', {
      lines: introLines,
      overlay: true,
      nextScene: 'BattleScene',
      // showTutorialIntro must not carry forward - this.config still has it
      // set from this same scene's own launch, and nextData otherwise spreads
      // it straight into the next step's config, re-triggering the step-1 intro.
      nextData: { ...this.config, tutorialStep: step, showTutorialIntro: false },
    });
    // See the identical bringToTop() note above create() - registration
    // order, not launch order, decides render order.
    this.scene.bringToTop('DialogueScene');
  }

  private completeTutorial() {
    this.roundOver = true;
    SaveManager.save({ tutorialComplete: true });
    this.config.postWinDialogue = TUTORIAL_OUTRO;
    this.showResult('チュートリアルクリア！\nメカニック免許（仮）獲得！', true);
  }

  private endRound(winner: 'p1' | 'p2' | 'timeup') {
    if (this.roundOver) return;
    this.roundOver = true;

    let result = '';
    if (winner === 'timeup') {
      const p1pct = this.p1.hp / this.p1.maxHp;
      const p2pct = this.p2.hp / this.p2.maxHp;
      if (p1pct > p2pct) result = '1P WIN (HP残量)';
      else if (p2pct > p1pct) result = '2P WIN (HP残量)';
      else result = this.theoryCount > 0 ? '1P WIN (THEORY BONUS)' : 'DRAW';
    } else {
      result = winner === 'p1' ? `${this.p1.name} WIN!` : `${this.p2.name} WIN!`;
    }

    // Strike the win/lose poses (these were never shown before - the victory
    // sprite in particular had no in-game trigger at all). update() halts on
    // roundOver, so pose + redraw once here to freeze the final tableau.
    this.poseRoundEnd(winner);

    this.gameFeel.applySlowMo(30);
    this.audio.playSe('ko');
    this.showResult(result, winner === 'p1');
  }

  private poseRoundEnd(winner: 'p1' | 'p2' | 'timeup') {
    const w = winner === 'p1' ? this.p1 : winner === 'p2' ? this.p2 : null;
    const l = winner === 'p1' ? this.p2 : winner === 'p2' ? this.p1 : null;
    if (w) { w.state = 'victory'; w.redraw(); w.syncPosition(); }
    if (l) { l.state = 'dead'; l.redraw(); l.syncPosition(); } // 'dead' maps to the defeat pose
  }

  private showResult(text: string, playerWon = false) {
    this.audio.stopBgm();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setDepth(180);
    this.add.text(GAME_WIDTH / 2, 70, text, {
      fontSize: '20px', color: '#fff', fontFamily: PIXEL_FONT, fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(181);

    const theoryDetail = this.theoryEvents.length > 0
      ? `\n理論家ポイント: ${this.theoryEvents.map((e) => e.label).join(' / ')}`
      : '';
    this.add.text(GAME_WIDTH / 2, 110, `パーフェクトシフト: ${this.p1.perfectShiftCount}回${theoryDetail}`, {
      fontSize: '10px', color: '#aaa', fontFamily: PIXEL_FONT, align: 'center', wordWrap: { width: 340 },
    }).setOrigin(0.5).setDepth(181);

    const retry = this.add.text(GAME_WIDTH / 2, 150, 'もう一度たたかう', {
      fontSize: '10px', color: '#ffdd44', fontFamily: PIXEL_FONT, backgroundColor: '#333', padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setDepth(181).setInteractive();

    const postWinDialogue = playerWon ? this.config.postWinDialogue : undefined;
    const menu = this.add.text(GAME_WIDTH / 2, 175, postWinDialogue ? 'つづける ▶' : 'モード選択へ', {
      fontSize: '10px', color: '#aaa', fontFamily: PIXEL_FONT,
    }).setOrigin(0.5).setDepth(181).setInteractive();

    retry.on('pointerdown', () => this.scene.restart(this.config));
    menu.on('pointerdown', () => {
      if (postWinDialogue) {
        this.scene.start('DialogueScene', { lines: postWinDialogue, nextScene: 'ModeSelectScene' });
      } else {
        this.scene.start('ModeSelectScene');
      }
    });
  }

  private syncVisuals() {
    this.p1.syncPosition();
    this.p2.syncPosition();
  }

  shutdown() {
    this.hud?.destroy();
    this.touch?.destroy();
    this.p1?.destroy();
    this.p2?.destroy();
    this.audio?.stopBgm();
  }
}
