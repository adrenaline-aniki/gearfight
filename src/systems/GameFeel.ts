import Phaser from 'phaser';

export class GameFeel {
  hitstopFrames = 0;
  shakeFrames = 0;
  shakeIntensity = 0;
  slowMoFrames = 0;

  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera) {
    this.scene = scene;
    this.camera = camera;
  }

  applyHitstop(frames: number) {
    this.hitstopFrames = Math.max(this.hitstopFrames, frames);
  }

  applyShake(intensity: number, frames: number) {
    this.shakeIntensity = intensity;
    this.shakeFrames = Math.max(this.shakeFrames, frames);
  }

  applySlowMo(frames: number) {
    this.slowMoFrames = Math.max(this.slowMoFrames, frames);
  }

  spawnHitSpark(x: number, y: number, strong = false) {
    // A bright flash plus a small radial burst of shards, instead of one square -
    // reads as an actual impact. Strong/combo hits get more, faster shards.
    const flash = this.scene.add.graphics();
    flash.fillStyle(strong ? 0xffee88 : 0xffffff);
    flash.fillCircle(0, 0, strong ? 9 : 6);
    flash.setPosition(x, y).setDepth(50);
    this.scene.tweens.add({
      targets: flash, alpha: 0, scaleX: 2.2, scaleY: 2.2, duration: 130,
      onComplete: () => flash.destroy(),
    });

    const shardCount = strong ? 7 : 5;
    const spread = strong ? 34 : 24;
    for (let i = 0; i < shardCount; i++) {
      const shard = this.scene.add.graphics();
      shard.fillStyle(strong ? 0xffcc44 : 0xffffff);
      shard.fillRect(-1.5, -1.5, 3, 3);
      shard.setPosition(x, y).setDepth(51);
      const angle = (Math.PI * 2 * i) / shardCount + Math.random() * 0.5;
      const dist = spread * (0.6 + Math.random() * 0.4);
      this.scene.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 160 + Math.random() * 80,
        ease: 'Quad.Out',
        onComplete: () => shard.destroy(),
      });
    }
  }

  update() {
    if (this.shakeFrames > 0) {
      const offset = (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.setScroll(offset, 0);
      this.shakeFrames -= 1;
      if (this.shakeFrames <= 0) this.camera.setScroll(0, 0);
    }
  }

  shouldSkipLogic(): boolean {
    if (this.hitstopFrames > 0) {
      this.hitstopFrames -= 1;
      return true;
    }
    return false;
  }

  getTimeScale(): number {
    return this.slowMoFrames > 0 ? 0.3 : 1;
  }

  tickSlowMo() {
    if (this.slowMoFrames > 0) this.slowMoFrames -= 1;
  }
}
