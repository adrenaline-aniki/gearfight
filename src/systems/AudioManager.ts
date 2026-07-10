import Phaser from 'phaser';
import { AUDIO_URLS } from '../config/constants';

export class AudioManager {
  private scene: Phaser.Scene;
  private unlocked = false;
  private bgm?: Phaser.Sound.BaseSound;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private webAudio(): Phaser.Sound.WebAudioSoundManager | null {
    const sound = this.scene.sound;
    return sound instanceof Phaser.Sound.WebAudioSoundManager ? sound : null;
  }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    const ctx = this.webAudio()?.context;
    if (ctx?.state === 'suspended') {
      void ctx.resume();
    }
  }

  playBgm(key: 'bgmTitle' | 'bgmBattle', loop = true) {
    this.stopBgm();
    if (!this.scene.cache.audio.exists(key)) return;
    this.bgm = this.scene.sound.add(key, { loop, volume: 0.5 });
    this.bgm.play();
  }

  stopBgm() {
    this.bgm?.stop();
    this.bgm?.destroy();
    this.bgm = undefined;
  }

  playSe(type: 'hit_weak' | 'hit_strong' | 'guard' | 'shift' | 'perfect' | 'ko' | 'select') {
    const ctx = this.webAudio()?.context;
    if (!ctx || !this.unlocked) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const presets: Record<string, { freq: number; dur: number; type: OscillatorType }> = {
      hit_weak: { freq: 220, dur: 0.05, type: 'square' },
      hit_strong: { freq: 110, dur: 0.1, type: 'sawtooth' },
      guard: { freq: 330, dur: 0.08, type: 'triangle' },
      shift: { freq: 180, dur: 0.12, type: 'square' },
      perfect: { freq: 880, dur: 0.15, type: 'sine' },
      ko: { freq: 60, dur: 0.4, type: 'sawtooth' },
      select: { freq: 520, dur: 0.06, type: 'sine' },
    };
    const p = presets[type];
    osc.type = p.type;
    osc.frequency.value = p.freq;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + p.dur);
    osc.start();
    osc.stop(ctx.currentTime + p.dur);
  }

  static preload(scene: Phaser.Scene) {
    scene.load.audio('bgmTitle', AUDIO_URLS.bgmTitle);
    scene.load.audio('bgmBattle', AUDIO_URLS.bgmBattle);
  }
}
