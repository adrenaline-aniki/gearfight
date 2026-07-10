import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, GROUND_Y, PIXEL_FONT } from '../config/constants';
import { DEFAULT_LOADOUT, typeMatchupMultiplier } from '../config/parts';
import { AIController } from '../ai/AIController';
import { Fighter } from '../entities/Fighter';
import { AudioManager } from '../systems/AudioManager';
import { GameFeel } from '../systems/GameFeel';
import { InputManager } from '../systems/InputManager';
import { spawnMechanismOverlay } from '../systems/MechanismOverlay';
import { SaveManager } from '../systems/SaveManager';
import { BattleHUD } from '../ui/BattleHUD';
import { TouchControls } from '../ui/TouchControls';
import type { BattleConfig, TheoryBonusEvent } from '../types/game';

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
  }

  create() {
    this.drawStage();
    this.audio = new AudioManager(this);
    this.audio.unlock();
    this.audio.playBgm('bgmBattle');

    this.p1 = new Fighter(this, {
      id: this.config.player1,
      name: this.getName(this.config.player1),
      maxHp: 1000,
      facing: 1,
      x: 100,
      loadout: this.config.player1 === 'hajime' ? DEFAULT_LOADOUT : undefined,
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
    this.p2.isAI = this.config.mode !== 'classroom';

    this.inputMgr = new InputManager(this);
    this.gameFeel = new GameFeel(this, this.cameras.main);
    this.hud = new BattleHUD(this);

    const aiProfile = this.config.player2 === 'kakashi' ? 'kakashi' : this.config.mode === 'classroom' ? 'none' : 'sonica';
    this.ai = new AIController(aiProfile);
    if (this.config.mode === 'tutorial') {
      this.ai.setKakashiStage(this.tutorialStep === 1 ? 0 : this.tutorialStep === 2 ? 1 : 2);
    }

    if (this.config.mode === 'classroom') {
      this.touch = new TouchControls(this, this.inputMgr, 'both');
    } else {
      this.touch = new TouchControls(this, this.inputMgr, 'left');
    }

    this.showRoundAnnounce();
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
      : this.config.mode === 'classroom' ? '教室モード 1本勝負' : 'ROUND 1';
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
    if (this.config.mode !== 'classroom') this.p2.updateFacing(this.p1.x);

    this.p1.processInput(p1Input, this.assistMode);
    this.p2.processInput(p2Input, this.assistMode);

    this.p1.tickState();
    this.p2.tickState();
    this.p1.applyPhysics();
    this.p2.applyPhysics();
    this.p1.redraw();
    this.p2.redraw();

    const deltaSec = (delta / 1000) * this.gameFeel.getTimeScale();
    this.p1.tickHeat(deltaSec);
    this.p2.tickHeat(deltaSec);

    this.resolveCombat();
    this.gameFeel.update();

    this.roundTimer -= deltaSec;
    if (this.roundTimer <= 0) this.endRound('timeup');

    this.hud.update(this.p1, this.p2, this.roundTimer, this.theoryCount, this.getHint());
    this.syncVisuals();

    if (this.p1.hp <= 0) this.endRound('p2');
    else if (this.p2.hp <= 0) this.endRound('p1');

    this.checkTutorialProgress();
  }

  private resolveCombat() {
    this.checkHit(this.p1, this.p2);
    this.checkHit(this.p2, this.p1);
  }

  private checkHit(attacker: Fighter, defender: Fighter) {
    if (!attacker.attackActive || !attacker.hitbox) return;
    if (!defender.isVulnerable()) return;

    const body = new Phaser.Geom.Rectangle(defender.x - 14, defender.y - 40, 28, 40);
    if (!Phaser.Geom.Intersects.RectangleToRectangle(attacker.hitbox, body)) return;

    const isGuarded = defender.state === 'block';
    const isShiftHit = defender.isShifting();
    const matchup = typeMatchupMultiplier(attacker.getMechType(), defender.getMechType());
    const dmg = defender.takeDamage(Math.round(attacker.getAttackDamage() * matchup), isGuarded, isShiftHit);

    if (dmg > 0) {
      attacker.onHitLanded();
      defender.onDamageTaken(dmg);

      const isStrong = attacker.state === 'attack_strong';
      this.gameFeel.applyHitstop(isStrong ? 8 : 4);
      this.gameFeel.applyShake(isStrong ? 4 : 2, isStrong ? 8 : 4);
      this.gameFeel.spawnHitSpark(defender.x, defender.y - 20);
      spawnMechanismOverlay(this, attacker.x, attacker.y - 30, isStrong ? 'lever-crank' : 'slider-crank', attacker.facing);
      this.audio.playSe(isGuarded ? 'guard' : isStrong ? 'hit_strong' : 'hit_weak');

      if (isShiftHit) this.addTheoryBonus('shift_gap', 'シフト中は無防備！');
      if (attacker.canGuardBreak() && isGuarded) this.addTheoryBonus('guard_break', 'GL4以上でガードブレイク！');
      if (defender.overheatTimer > 0) this.addTheoryBonus('overheat', 'オーバーヒート中の追撃！');
      if (matchup > 1) this.addTheoryBonus('type_advantage', 'タイプ相性で追加ダメージ！');

      if (this.config.mode === 'tutorial' && attacker === this.p1) {
        this.tutorialHits += 1;
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
    };
    return hints[this.tutorialStep] ?? '';
  }

  private checkTutorialProgress() {
    if (this.config.mode !== 'tutorial' || this.roundOver) return;

    if (this.tutorialStep === 1 && this.tutorialHits >= 10) {
      this.advanceTutorial(2);
    } else if (this.tutorialStep === 2 && this.p1.perfectShiftCount >= 1) {
      this.advanceTutorial(3);
    } else if (this.tutorialStep === 3 && this.theoryEvents.some((e) => e.id === 'guard_break')) {
      this.completeTutorial();
    }
  }

  private advanceTutorial(step: number) {
    this.tutorialStep = step;
    this.tutorialHits = 0;
    this.ai.setKakashiStage(step === 2 ? 1 : 2);
    this.p2.hp = this.p2.maxHp;
    this.p1.hp = this.p1.maxHp;
    this.showRoundAnnounce();
  }

  private completeTutorial() {
    SaveManager.save({ tutorialComplete: true });
    this.showResult('チュートリアルクリア！\nメカニック免許（仮）獲得！');
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

    if (winner === 'p1' && this.config.mode === 'classroom') {
      this.promptClassroomName();
      return;
    }

    this.gameFeel.applySlowMo(30);
    this.audio.playSe('ko');
    this.showResult(result, winner === 'p1');
  }

  private promptClassroomName() {
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setDepth(200);
    const label = this.add.text(GAME_WIDTH / 2, 80, '勝者の名前を入力', { fontSize: '10px', color: '#fff', fontFamily: PIXEL_FONT }).setOrigin(0.5).setDepth(201);
    const name = this.add.text(GAME_WIDTH / 2, 100, 'プレイヤー1', { fontSize: '10px', color: '#ffdd44', fontFamily: PIXEL_FONT, backgroundColor: '#333', padding: { x: 8, y: 4 } }).setOrigin(0.5).setDepth(201).setInteractive();

    const confirm = this.add.text(GAME_WIDTH / 2, 130, '決定', { fontSize: '10px', color: '#fff', fontFamily: PIXEL_FONT, backgroundColor: '#2c3e6e', padding: { x: 10, y: 4 } }).setOrigin(0.5).setDepth(201).setInteractive();

    confirm.on('pointerdown', () => {
      SaveManager.addClassroomWin('プレイヤー1');
      overlay.destroy();
      label.destroy();
      name.destroy();
      confirm.destroy();
      this.showResult('1P WIN!\nランキングに記録しました');
    });
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
