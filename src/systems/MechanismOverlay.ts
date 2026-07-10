import Phaser from 'phaser';

// Spec §2.1-B: attacks visualize the real link/cam mechanism that converts the
// motor's rotation into the arm's motion, briefly overlaid as a wireframe
// diagram on hit — reciprocating slider-crank for jabs, oscillating
// lever-crank for haymakers, matching the textbook's 運動の変換 unit.
export type MechanismType = 'slider-crank' | 'lever-crank';

const DURATION_MS = 420;
const SPIN_TURNS = 1.5; // crank rotations over the overlay's lifetime
const LINE_COLOR = 0x66ffee;
const FILL_COLOR = 0x0a2a28;

function drawSliderCrank(g: Phaser.GameObjects.Graphics, angle: number) {
  const crankCenter = { x: -16, y: 0 };
  const r = 9;
  const railY = 0;
  const armAmplitude = 14;

  const pin = {
    x: crankCenter.x + r * Math.cos(angle),
    y: crankCenter.y + r * Math.sin(angle),
  };
  const slider = { x: crankCenter.x + r + 4 + armAmplitude * (1 + Math.cos(angle)), y: railY };

  g.lineStyle(1, LINE_COLOR, 0.35);
  g.lineBetween(crankCenter.x + r + 4, railY, crankCenter.x + r + 4 + armAmplitude * 2 + 8, railY);

  g.lineStyle(1.5, LINE_COLOR, 1);
  g.strokeCircle(crankCenter.x, crankCenter.y, r);
  g.lineBetween(crankCenter.x, crankCenter.y, pin.x, pin.y);
  g.lineBetween(pin.x, pin.y, slider.x, slider.y);

  g.fillStyle(LINE_COLOR, 1);
  g.fillCircle(crankCenter.x, crankCenter.y, 1.5);
  g.fillCircle(pin.x, pin.y, 1.5);

  g.fillStyle(FILL_COLOR, 0.9);
  g.fillRect(slider.x - 4, slider.y - 4, 8, 8);
  g.lineStyle(1.2, LINE_COLOR, 1);
  g.strokeRect(slider.x - 4, slider.y - 4, 8, 8);
}

function drawLeverCrank(g: Phaser.GameObjects.Graphics, angle: number) {
  const crankCenter = { x: -16, y: 4 };
  const r = 8;
  const pivot = { x: 12, y: 4 };
  const followerLen = 16;

  const pin = {
    x: crankCenter.x + r * Math.cos(angle),
    y: crankCenter.y + r * Math.sin(angle),
  };

  // Follower swings side to side in sync with the crank's rotation, rather
  // than spinning all the way around — the oscillating half of the pair.
  const swing = -0.5 + 0.5 * Math.sin(angle);
  const followerTip = {
    x: pivot.x + followerLen * Math.cos(Math.PI + swing),
    y: pivot.y + followerLen * Math.sin(Math.PI + swing),
  };

  g.lineStyle(1.5, LINE_COLOR, 1);
  g.strokeCircle(crankCenter.x, crankCenter.y, r);
  g.lineBetween(crankCenter.x, crankCenter.y, pin.x, pin.y);
  g.lineBetween(pin.x, pin.y, followerTip.x, followerTip.y);
  g.lineBetween(pivot.x, pivot.y, followerTip.x, followerTip.y);

  g.fillStyle(LINE_COLOR, 1);
  g.fillCircle(crankCenter.x, crankCenter.y, 1.5);
  g.fillCircle(pin.x, pin.y, 1.5);
  g.fillCircle(pivot.x, pivot.y, 1.5);
  g.fillCircle(followerTip.x, followerTip.y, 1.5);
}

export function spawnMechanismOverlay(
  scene: Phaser.Scene,
  x: number,
  y: number,
  type: MechanismType,
  facing: 1 | -1,
) {
  const g = scene.add.graphics();
  g.setPosition(x, y);
  g.setScale(facing, 1);
  g.setDepth(60);
  g.setAlpha(0);

  const draw = type === 'slider-crank' ? drawSliderCrank : drawLeverCrank;
  const state = { t: 0 };

  scene.tweens.add({
    targets: state,
    t: 1,
    duration: DURATION_MS,
    onUpdate: () => {
      const angle = state.t * SPIN_TURNS * Math.PI * 2;
      g.clear();
      draw(g, angle);
      // fade in quickly, hold, then fade out — keeps the diagram readable
      // without lingering past the moment it's illustrating.
      g.setAlpha(state.t < 0.15 ? state.t / 0.15 : state.t > 0.7 ? (1 - state.t) / 0.3 : 1);
    },
    onComplete: () => g.destroy(),
  });
}
