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

  spawnHitSpark(x: number, y: number) {
    const spark = this.scene.add.graphics();
    spark.fillStyle(0xffffff);
    spark.fillRect(-4, -4, 8, 8);
    spark.setPosition(x, y);
    spark.setDepth(50);

    this.scene.tweens.add({
      targets: spark,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 120,
      onComplete: () => spark.destroy(),
    });
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
