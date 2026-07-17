export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;
export const FPS = 60;
export const GROUND_Y = 212;

// The new-engine match renders its world (fighters/boxes/FX) in a container scaled
// by this factor: the combat engine stays in its original ~384-wide LOGICAL space
// (so frame data / ranges / balance are untouched), while the presentation fills
// the higher-resolution canvas and the high-res rigs gain ~25% more detail.
export const LOGICAL_WORLD_W = 384;
export const WORLD_SCALE = GAME_WIDTH / LOGICAL_WORLD_W; // 1.25
// Ground line in the LOGICAL world space (screen ground = GROUND_Y; logical = this).
export const LOGICAL_GROUND_Y = Math.round(GROUND_Y / WORLD_SCALE); // ~170

// Bitmap-style font (full JP glyph coverage); sized in multiples of 10 to
// stay pixel-aligned with its native 10x10 glyph grid and avoid blurry scaling.
export const PIXEL_FONT = 'PixelMplus10';

// Startup/recovery are in 60fps ticks. Tuned for SF2-style responsiveness:
// low gears should feel like real jabs (~150-250ms total), high gears stay
// deliberately heavy/telegraphed but no longer sluggish across the board.
export const GEAR_TABLE = {
  1: { ratio: 0.33, teeth: '30:10', speedMul: 1.6, startup: 4, damageMul: 0.5, recovery: 8, guardBreak: false, heatPerSec: -20 },
  2: { ratio: 0.6, teeth: '25:15', speedMul: 1.3, startup: 5, damageMul: 0.75, recovery: 10, guardBreak: false, heatPerSec: -10 },
  3: { ratio: 1.0, teeth: '20:20', speedMul: 1.0, startup: 7, damageMul: 1.0, recovery: 14, guardBreak: false, heatPerSec: 0 },
  4: { ratio: 1.67, teeth: '15:25', speedMul: 0.8, startup: 10, damageMul: 1.5, recovery: 20, guardBreak: true, heatPerSec: 15 },
  5: { ratio: 3.0, teeth: '10:30', speedMul: 0.6, startup: 13, damageMul: 2.2, recovery: 26, guardBreak: true, heatPerSec: 30 },
} as const;

export type GearLevel = keyof typeof GEAR_TABLE;

export const SHIFT_FRAMES = 12;
export const PERFECT_SHIFT_FRAMES = 4;
export const PERFECT_SHIFT_WINDOW = 4;
export const PERFECT_SHIFT_WINDOW_ASSIST = 8;
export const PERFECT_SHIFT_CYCLE = 30;
export const INPUT_BUFFER = 8;
export const COYOTE_FRAMES = 3;
export const OVERHEAT_DURATION = 180;
export const HEAT_ON_HIT = 5;

// Extra startup padding for the strong (left-arm) attack vs. weak, on top of
// the gear's own startup+recovery.
export const STRONG_ATTACK_EXTRA_FRAMES = 4;

// Hit/block reaction durations (ticks).
export const HITSTUN_FRAMES = 14;
export const KNOCKDOWN_FRAMES = 30;
export const KNOCKDOWN_DAMAGE_THRESHOLD = 60;
export const BLOCKSTUN_FRAMES = 8;
// Short post-hit i-frames. Kept well BELOW hitstun so that a follow-up from a
// DIFFERENT attack (a combo) still connects during the back half of hitstun,
// while a single attack's multi-frame active window can't re-hit (that's
// handled by Fighter.hasHitThisAttack instead - the old long invuln was the
// only thing preventing combos, so it moved to a per-attack flag).
export const HIT_INVULN_FRAMES = 5;

// "ギアラッシュ" combo system: a weak attack that lands cleanly (not blocked)
// can cancel its recovery into the next attack, enabling a weak->weak->strong
// bread-and-butter. Strong is a hard finisher (opens no window), so chains are
// capped at COMBO_MAX_HITS. Damage is prorated per hit so a low-gear rush and a
// heavy high-gear single hit stay comparable (speed vs. power, on theme).
export const COMBO_CANCEL_WINDOW = 16;        // frames after a clean hit you may cancel recovery
export const COMBO_CANCEL_WINDOW_ASSIST = 24; // wider in assist mode
export const COMBO_MAX_HITS = 3;              // weak, weak, strong
export const COMBO_DROP_FRAMES = 26;          // idle frames before the combo count resets
export const COMBO_PRORATION = [1, 0.8, 0.6] as const; // damage scaling by hit index
// "RPM" finisher payoff: a strong that ENDS a chain hits harder the longer the
// chain was (+15% per prior hit), so a full weak->weak->strong clearly out-rewards
// mashing a single poke - the "build momentum, then hit hard" educational beat.
// A lone strong (no chain) is unaffected. Still bounded well under a heavy GL5 hit.
export const COMBO_FINISHER_RUSH = 0.15;

// Knockback distance (px) applied to the defender, away from the attacker.
export const KNOCKBACK_HIT = 6;
export const KNOCKBACK_BLOCK = 3;
export const KNOCKBACK_STRONG_BONUS = 4;
export const KNOCKBACK_KNOCKDOWN_BONUS = 4;

// Guard gauge regenerates while not actively blocking/in blockstun, so a
// single big guard-crush doesn't leave a fighter permanently guard-broken.
export const GUARD_REGEN_PER_SEC = 20;

// Super move ("necessary"): spends a full superGauge (see Fighter.onHitLanded
// etc.) on one flat-damage, unconditional-guard-break hit. Deliberately not
// scaled by GEAR_TABLE.damageMul - gear5 already hits hard on its own, and a
// gear-scaled super on top of that would spike far past a fair one-shot.
export const SUPER_STARTUP = 10;
export const SUPER_ACTIVE_FRAMES = 6;
export const SUPER_RECOVERY = 26;
export const SUPER_DAMAGE = 260;
export const SUPER_REACH = 36;
export const SUPER_HEIGHT = 32;
export const KNOCKBACK_SUPER_BONUS = 8;
export const KNOCKBACK_SPEED_SUPER_BONUS = 6;

// Throw ("投げ"): a guard-BYPASSING option (see Fighter.isThrowable() /
// BattleScene.checkHit()) so holding block forever isn't a free win. Very
// short range, fixed damage set just above KNOCKDOWN_DAMAGE_THRESHOLD so a
// connecting throw naturally knocks down through the normal takeDamage() path.
export const THROW_STARTUP = 4;
export const THROW_ACTIVE_FRAMES = 2;
export const THROW_RECOVERY = 16;
export const THROW_DAMAGE = 70;
export const THROW_RANGE = 22;
export const THROW_HEIGHT = 24;
export const KNOCKBACK_THROW_BONUS = 6;

// Paths are base-relative (no leading slash) - BootScene.preload() sets the
// loader's baseURL from Vite's `base`, so these resolve correctly whether
// the site is served from root (local/Firebase) or /gearfight/ (GitHub Pages).
export const AUDIO_URLS = {
  bgmTitle: 'music/next-gear.mp3',
  bgmBattle: 'music/next-gear-(instrumental-version).mp3',
} as const;

export const SPRITE_POSES = [
  'idle', 'walk', 'jump', 'attack_weak', 'attack_strong', 'guard',
  'shift_start', 'shift_complete', 'hitstun', 'knockdown', 'victory', 'defeat',
] as const;
export type SpritePose = (typeof SPRITE_POSES)[number];

// PNG-backed fighters, loaded from public/sprites/<id>/<pose>.png by BootScene.
export const SPRITE_FIGHTERS = ['hajime', 'wizel', 'ganrock', 'aegis', 'drift', 'theorion', 'omeganova', 'sophislegion'] as const;

// Procedurally-composed fighters (Approach A / spec §6.1 SpriteFactory), textures
// generated at runtime by graphics/SpriteFactory.ts instead of loaded from disk.
export const PROCEDURAL_FIGHTERS = ['kakashi'] as const;

export const ALL_SPRITE_FIGHTERS = [...SPRITE_FIGHTERS, ...PROCEDURAL_FIGHTERS] as const;

// Fighters with an extracted multi-frame walk cycle (public/sprites/<id>/walk_<n>.png,
// n = 0..count-1). Everyone else falls back to a single static `<id>_walk` texture
// (`walk.png` on disk, or the procedural SpriteFactory texture for kakashi).
// hajime/wizel/aegis/drift used to be in here too, but their "second" extracted
// pose was consistently a near-duplicate lunge/jump variant rather than a
// genuinely different opposite-leg stride, so ping-ponging between them read as
// a half-hearted alternation ("moonwalk") - worse than just holding the one good
// stride pose (see syncPosition()'s bob+sway, which now carries the motion for
// them instead). Ganrock's two frames are a real alternating pair and stay.
export const SPRITE_WALK_FRAME_COUNT: Partial<Record<(typeof ALL_SPRITE_FIGHTERS)[number], number>> = {
  ganrock: 2,
  wizel: 4, // genuine 4-frame AI-generated walk cycle (2026-07-12)
};
export const WALK_FRAME_INTERVAL = 6; // game ticks per walk-cycle frame (60fps / 6 = 10fps)

// Target on-screen height (px) for each fighter's idle pose; other poses scale uniformly with it.
// Per-character so boss-tier fighters (final/hidden bosses) read as visibly larger than the cast.
export const SPRITE_TARGET_HEIGHT: Record<(typeof ALL_SPRITE_FIGHTERS)[number], number> = {
  hajime: 62,
  wizel: 62,
  kakashi: 62,
  ganrock: 62,
  aegis: 62,
  drift: 62,
  theorion: 62,
  omeganova: 82,
  sophislegion: 82,
};
// Face portraits for dialogue scenes, cropped from the user-provided expression
// sheet (public/sprites/portraits/<id>/<emotion>.png) — one folder per character,
// nine emotions each (see PORTRAIT_EMOTIONS).
export const PORTRAIT_EMOTION_IDS = ['takumi', 'nogi', 'hajime', 'wizel', 'ganrock', 'drift', 'aegis', 'theorion', 'omeganova'] as const;
export const PORTRAIT_EMOTIONS = [
  'normal', 'smile', 'surprised', 'angry', 'serious', 'frustrated', 'confident', 'shy', 'eyes_closed',
] as const;

// Characters with only a single flat portrait (public/sprites/portraits/<id>.png)
// instead of a full emotion set. Currently unused — kept for future characters
// that only get a settei-sheet crop rather than a dedicated expression sheet.
export const PORTRAIT_FLAT_IDS: readonly string[] = [];

// 2026-07-11: all PNG-backed fighters' sprites are now pre-downscaled to this
// exact height at asset-prep time (quality Lanczos resampling, see
// scratchpad's batch_resize_sprites.py in that day's session - not checked
// into the repo, it's a one-shot tool) instead of being left oversized for
// Phaser to shrink at runtime via nearest-neighbor filtering, which was
// producing visibly aliased/noisy sprites (worst on theorion/omeganova,
// ~5.5x oversized). Source height now equals target height, so spriteScale
// is ~1 for all of them - kakashi is untouched (procedural SpriteFactory
// texture, not a PNG, doesn't have this problem).
export const SPRITE_IDLE_SOURCE_HEIGHT: Record<(typeof ALL_SPRITE_FIGHTERS)[number], number> = {
  hajime: 62,
  wizel: 62,
  kakashi: 150,
  ganrock: 62,
  aegis: 62,
  drift: 62,
  theorion: 62,
  omeganova: 82,
  sophislegion: 82,
};
