# スプライトシート生成AI用プロンプト集（アプローチB）

## なぜ書き直すか（既存 sprite1〜8.png の実際の欠陥）

実装作業で判明した、既存参考画像がそのまま使えない具体的な理由：

1. **背景が本当の透明ではない** — 白背景（sprite1, 3-8）または市松模様を焼き込んだ背景（sprite2）で、どちらも「アルファチャンネル」ではなく単なるRGBピクセル。キャラの白い装甲パーツと背景色が同じ値になり、自動切り抜きで装甲に穴が開く／脚の間の隙間が塗り潰される、という事故が起きた。
2. **キャラごとにサイズ・余白が不揃い** — ポーズによってバウンディングボックスの大きさがバラバラ（エフェクトの尾を含む/含まないなど）で、均一グリッドとして機械的に切り出せない。
3. **日本語ラベルが同一キャンバス上、キャラのすぐ近くに焼き込まれている** — 切り抜き時にラベルの帯（濃紺の見出しボックスなど）が混入する事故が起きた。
4. **ヒットエフェクト（衝撃波・スパーク）の位置がキャラの拳・脚の実際の着弾点とズレている**ポーズがある。
5. **モーションが不足**：しゃがみ歩き、踏み込み、着地の中間フレーム、起き上がりの中割りなど、アニメーション用の複数フレームがなく静止1枚のみ。

→ 以下のプロンプトは、これらすべてを潰す指示を明示的に含めています。

---

## 共通プロンプト・テンプレート（英語・生成AI入力用）

`{{ }}` の部分だけキャラごとに差し替えて使用してください。

```
16-bit pixel art character reference sheet, SNES/Genesis-era fighting game sprite style, for {{CHARACTER_NAME}} ({{CHARACTER_ARCHETYPE}}).

CANVAS & LAYOUT (critical, must follow exactly):
- Output on a SOLID FLAT #00FF00 pure green chroma-key background. No gradient, no checkerboard, no drop shadow, no texture on the background — solid single color only.
- Arrange every pose in a strict uniform grid. Each grid cell is exactly {{CELL_SIZE_PX}}px square (e.g. 128x128px), with the character's feet always resting on the same horizontal baseline pixel row across every cell, and the character horizontally centered in the cell.
- Do NOT draw any text, captions, labels, section headers, borders, panel boxes, UI chrome, watermarks, or move-name callouts anywhere in the image. Sprites only.
- Keep the character's overall pixel scale IDENTICAL across every single cell (same head-to-foot height in pixels every time) — do not zoom in/out between poses.
- Character always faces screen-right (profile or 3/4 view facing right) in every pose, consistently, so it can be mirrored programmatically for facing left.

REQUIRED POSES (one row each, left-to-right = animation frame order, 2-4 frames per pose):
1. Idle (breathing/bobbing loop, 2 frames)
2. Walk cycle (2-3 frames)
3. Dash/run (2 frames, motion blur trail only extending behind the character, not overlapping the silhouette)
4. Jump rise (1 frame) + Jump fall (1 frame)
5. Crouch (1 frame)
6. Guard/block stance (1 frame, arms/shield raised toward screen-right)
7. Light attack (2 frames: windup, extended strike) — impact effect, if shown, MUST be centered exactly at the fist/foot/weapon tip, touching the strike limb, not floating apart from it
8. Heavy attack (2 frames: windup, extended strike) — same impact-alignment rule
9. Hit reaction / flinch (1 frame, leaning back)
10. Knockback (1 frame, further off-balance)
11. Knockdown (1 frame, lying on the ground)
12. Get-up (1 frame, rising from ground)
13. Victory pose (1 frame)
14. Defeat/collapsed pose (1 frame)

STYLE:
- Clean pixel-art with hard, non-anti-aliased or minimally anti-aliased edges (this will be auto-cropped, soft blurry edges cause halo artifacts).
- Consistent {{PALETTE_DESCRIPTION}} color palette across all poses.
- {{SILHOUETTE_DESCRIPTION}}
- No lighting/shading style change between poses (flat game-sprite lighting, not painterly).

NEGATIVE PROMPT:
text, watermark, caption, label, UI frame, border, panel, gradient background, checkerboard background, drop shadow on ground, blurry edges, inconsistent scale, off-model, extra limbs, cropped character, character touching cell edge.
```

---

## 記入例1：カカシくん（チュートリアル用の練習機）

仕様書 §4.2「（チュートリアル）ノギ先生＋練習機カカシ」より。木目調の素体・的マーク付き、动作は「動かない→歩くだけ→ガードするだけ」の3段階のみでよく、攻撃・超必は不要。

**v1からの変更点（v2で画風統一）**：v1（`kakashi_v1.png`、未採用）はフラットな塗り＋太い輪郭線で生成され、他キャラ（ハジメ・ウィズル等、グラデーションのある塗り込み・メタリックハイライト調で仕上がっている）と並べると浮いて見えた。原因は旧プロンプトの「No lighting/shading style change between poses」という指示が、他キャラのプロンプトにある `painterly` 系の記述と食い違い、AIがより単純なフラットシェーディングに倒れたためと推測される。下記プロンプトはSTYLE節を他キャラと同じ「painterly rendering, soft gradient shading, metallic highlight」路線に書き換え済み。生成後は `kakashi_v2.png` として配置すること。

```
16-bit pixel art character reference sheet, SNES/Genesis-era fighting game sprite style, for Kakashi-kun (a simple wooden training-dummy robot used as a tutorial punching bag).

CANVAS & LAYOUT (critical, must follow exactly):
- Output on a SOLID FLAT #00FF00 pure green chroma-key background. No gradient, no checkerboard, no drop shadow, no texture on the background — solid single color only.
- Arrange every pose in a strict uniform grid. Each grid cell is exactly 96x96px, with the character's feet always resting on the same horizontal baseline pixel row across every cell, and the character horizontally centered in the cell.
- Do NOT draw any text, captions, labels, section headers, borders, panel boxes, UI chrome, watermarks, or move-name callouts anywhere in the image. Sprites only.
- Keep the character's overall pixel scale IDENTICAL across every single cell.
- Character always faces screen-right in every pose.

REQUIRED POSES (this character only needs a reduced set — no attacks, no super moves):
1. Idle (static, 1 frame — a plain standing wooden post-bot, arms at sides)
2. Walk cycle (2 frames, simple leg-shuffle)
3. Guard/block stance (1 frame, wooden arms crossed in front like a shield)
4. Hit reaction / flinch (1 frame, wobbling backward)
5. Knockdown (1 frame, toppled over on its side)

STYLE:
- Body made of visibly wood-grained plank segments (torso, arms, legs as jointed wooden blocks), bolted together with visible rivets.
- A simple round red-and-white archery target mark painted on the chest, used as the "aim here" cue.
- Plain circular wooden head, no face or a single painted-on dot for an eye, minimal detail — this is a dumb training dummy, not a character.
- Palette: mid-brown wood body (#8b6914 tone), lighter tan wood highlights (#cd853f tone), red/white target rings on the chest, black bolt/rivet details.
- Painterly rendering to match the rest of the cast: soft gradient shading across each wood plank (darker toward the edges, warm highlight along the center), a subtle metallic sheen/specular highlight on every rivet and bolt head, gentle ambient-occlusion shadow where limb segments join the torso. Do NOT render this as flat single-tone fills with hard black outlines — every other fighter in this set uses soft painted shading, and this character must match that same rendering treatment, only simplified in silhouette/detail (not in shading technique).
- Consistent lighting direction and shading intensity across every pose (same painterly treatment each frame, not flatter or rounder in some poses than others).

NEGATIVE PROMPT:
text, watermark, caption, label, UI frame, border, panel, gradient background, checkerboard background, drop shadow on ground, blurry edges, inconsistent scale, off-model, face, personality, weapon, extra limbs, cropped character, character touching cell edge, flat single-tone fill, thick hard black outline, cel-shaded/cartoon outline style, sticker style.
```

---

## 記入例2：ハジメくん（主人公・バランス型）— 完全版プロンプト

仕様書§4.1「主人公：技術科の新入生」＋既存 `sprite1.png` の頭身・カラーリング（紺＋明るい青の装甲、銀/白の関節、オレンジのアクセント、茶色の跳ねた髪、丸いチェストジェム、ボクシンググローブ状の拳）を踏襲しつつ、レイアウト規則を完全に満たすよう明示した、そのまま画像生成AIに貼り付けられる完成プロンプトです。

```
16-bit pixel art character reference sheet, SNES/Genesis-era fighting game sprite style, for Hajime-kun (a balanced-type protagonist battle mech piloted by a 17-year-old mechanic student; the mech itself is the on-screen fighter).

CANVAS & LAYOUT (critical, must follow exactly):
- Output on a SOLID FLAT #00FF00 pure green chroma-key background. No gradient, no checkerboard pattern, no drop shadow, no floor line, no texture of any kind on the background — one single flat color only, corner to corner.
- Arrange every pose in a strict uniform grid, one pose per cell, left-to-right / top-to-bottom in the order listed below. Each grid cell is exactly 128x128px. The character's feet must rest on the exact same horizontal pixel row in every single cell, and the character must be horizontally centered in its cell.
- Do NOT draw any text, captions, Japanese or English labels, section headers, move names, input notation, borders, panel boxes, UI chrome, or watermarks anywhere in the image. Sprites only, nothing else.
- Keep the character's overall pixel scale IDENTICAL across every cell — same head-to-foot height every time, no zooming in or out between poses.
- This is a true side-view 2D fighting-game sprite (like classic Street Fighter / Mega Man Battle Network sprites), NOT a front-facing mascot, icon, or portrait. In EVERY pose, the character's HEAD and EYES must be turned to face the exact same screen-right direction as the body, as if staring down an opponent standing off-screen to the right. The character must never make eye contact with the viewer and must never have a front-on/camera-facing head, even in idle or victory poses.
- Attacks must use real martial-arts body mechanics: the hips and shoulders rotate into the strike, weight shifts onto the front foot, the non-striking arm pulls back for counterbalance. Do not draw an attack as a static standing figure with only the arm extended — the whole torso must lean and twist into the motion.
- Leave at least 8px of clear background margin around the character within each cell — nothing may touch or cross the cell edge.

REQUIRED POSES (2-4 animation frames per pose as noted, one row per pose):
1. Idle stance (2 frames, subtle breathing/bobbing loop, both fists raised in a light guard)
2. Walk cycle (3 frames, forward-leaning determined stride)
3. Dash/run (2 frames; a speed-line motion blur trail may extend behind the character only, never overlapping or replacing the character's own silhouette)
4. Jump rise (1 frame, legs tucked, rising) and Jump fall (1 frame, legs extended, descending) — 2 frames total
5. Crouch (1 frame, low guarded stance)
6. Guard/block stance (1 frame, both forearms raised defensively toward screen-right)
7. Light punch attack (2 frames: windup with fist pulled back, then full extension toward screen-right) — if a small hit-spark/impact effect is shown, it MUST be centered exactly on the fist's leading knuckle at full extension, touching the glove, never floating apart from it
8. Heavy kick attack (2 frames: windup, full extension) — same rule: any impact/swoosh effect must originate exactly at the foot, aligned with the strike, not offset
9. Hit reaction / flinch (1 frame, head snapped back, arms loosening)
10. Knockback (1 frame, further off-balance, one foot leaving the ground)
11. Knockdown (1 frame, fallen flat on the back)
12. Get-up (1 frame, pushing up from the ground on one arm)
13. Victory pose (1 frame, confident fist-pump, small sparkle accents allowed near the character but not touching the cell edge)
14. Defeat/collapsed pose (1 frame, kneeling or slumped forward)

STYLE:
- Clean pixel art with crisp, mostly hard edges (minimal anti-aliasing) — this sheet will be auto-cropped per cell, so soft blurry edges cause visible halo artifacts against game backgrounds.
- Palette: navy blue and bright cobalt-blue segmented body armor, silver/white metallic joints and boxing-glove-style fists, warm orange glowing accent gems (one round gem centered on the chest, smaller gems at shoulders/knees), warm brown spiky windswept hair visible around an open-face navy-blue helmet.
- Silhouette: medium-build humanoid mech, balanced proportions (not bulky, not slender), rounded helmet with a hair tuft poking out the top and sides, youthful energetic face with small round eyes, compact rounded shoulder pauldrons, boxing-glove-shaped hands, sturdy blocky boots.
- Flat, consistent game-sprite lighting across every pose — no painterly rendering, no per-pose lighting changes.

NEGATIVE PROMPT:
text, watermark, caption, label, move name, input notation, UI frame, border, panel, gradient background, checkerboard background, drop shadow on ground, floor line, blurry soft edges, inconsistent scale between poses, off-model face, extra limbs, cropped character, character touching or crossing the cell edge, effect floating apart from the striking limb, character looking at viewer, front-facing gaze, direct eye contact with camera, mascot pose, icon/portrait style, static arm-only attack without body rotation, stiff pose with no weight shift.
```

### 生成がうまくいかないときの対処（実際に1回目で見つかった問題）

1回目の生成で「体は右を向いているのに顔だけ正面（カメラ目線）」「攻撃が腕だけ伸びて棒立ち」という問題が出た。原因は、画像生成AIが「キャラクター設定画」というと反射的に正面向きマスコット構図に寄せてしまう癖があるため。上記プロンプトは、それを潰す文言（側面向きの格闘ゲームスプライトであることの明記、顔の向きの強制、攻撃時の体重移動の指示、ネガティブプロンプトへの追加）を反映済み。

それでも直らない場合の追加の手：
- **ポーズ数を減らして小分けに生成する**（例：「idle/walk/dash/jump」だけの1枚、「攻撃系」だけの1枚、「被弾・ダウン・起き上がり」だけの1枚）。14ポーズを1枚に詰め込むと指示が薄まりやすい。
- 上記プロンプトの先頭に `side view profile fighting stance, head turned right, NOT looking at camera` を強調のため一度繰り返して書く。
- 生成結果のうち顔の向きだけがおかしい場合は、その1コマだけを画像生成AIのinpaint機能で「顔を右向きに」再生成する方法もある。

---

## 他キャラへの展開（テーブル形式・仕様書§4.2準拠）

| キャラ | ARCHETYPE | PALETTE | SILHOUETTE補足 |
|---|---|---|---|
| ウィズル（ソニカ） | speed-type, agile jab fighter | red + white, cyan eye visor | 細身・鋭利なブレード状の肩・脚パーツ |
| ガンロック（ゴウケン） | power-type, heavy brawler | dark gunmetal grey + orange eye | 巨大な拳と肩、低身重心 |
| ドリフト（リン） | terrain specialist | white + green, cyan eye | 脚部にスパイク/無限軌道の切り替え意匠 |
| アイギス（カメイ） | defense specialist | navy + white, gold trim | 大盾を左腕に常時装備 |
| テオリオン（カイ） | balanced strategist | white/navy/gold, cyan eye | 均整の取れた騎士型、翼状ディテール小 |
| オメガノヴァ（最終ボス） | destruction incarnate | black/red/gold, red eyes | 多数の翼状ブレード、威圧的シルエット |
| ソフィス・レギオン（ノギ先生・裏ボス） | legendary hidden boss | black/purple/gold | 尖った装甲、紫のオーラ |

各行の値を共通テンプレートの `{{ }}` に代入するだけで、そのキャラ用プロンプトが作れます。以下、6キャラ分の完全版プロンプトです（ハジメくんで直った目線・攻撃の体重移動の指示は全て反映済み）。

---

## 記入例3：ガンロック（ゴウケン・重撃パワー型）

```
16-bit pixel art character reference sheet, SNES/Genesis-era fighting game sprite style, for Ganrock (a heavy power-type brawler mech piloted by a quiet, disciplined senior craftsman).

CANVAS & LAYOUT (critical, must follow exactly):
- Output on a SOLID FLAT #00FF00 pure green chroma-key background. No gradient, no checkerboard pattern, no drop shadow, no floor line, no texture of any kind on the background — one single flat color only, corner to corner.
- Arrange every pose in a strict uniform grid, one pose per cell, left-to-right / top-to-bottom in the order listed below. Each grid cell is exactly 140x140px. The character's feet must rest on the exact same horizontal pixel row in every single cell, and the character must be horizontally centered in its cell.
- Do NOT draw any text, captions, Japanese or English labels, section headers, move names, input notation, borders, panel boxes, UI chrome, or watermarks anywhere in the image. Sprites only, nothing else.
- Keep the character's overall pixel scale IDENTICAL across every cell — same head-to-foot height every time, no zooming in or out between poses.
- This is a true side-view 2D fighting-game sprite (like classic Street Fighter / Mega Man Battle Network sprites), NOT a front-facing mascot, icon, or portrait. In EVERY pose, the character's HEAD and EYE must be turned to face the exact same screen-right direction as the body, as if staring down an opponent standing off-screen to the right. The character must never make eye contact with the viewer and must never have a front-on/camera-facing head, even in idle or victory poses.
- Attacks must use real martial-arts body mechanics: the hips and shoulders rotate into the strike, weight shifts onto the front foot, the non-striking arm pulls back for counterbalance. Do not draw an attack as a static standing figure with only the arm extended — the whole torso must lean and twist into the motion.
- Leave at least 8px of clear background margin around the character within each cell — nothing may touch or cross the cell edge.

REQUIRED POSES (2-4 animation frames per pose as noted, one row per pose):
1. Idle stance (2 frames, heavy grounded stance, subtle shoulder bob)
2. Walk cycle (3 frames, slow heavy stomping stride)
3. Dash/run (2 frames, a short heavy charge rather than a fast dash; motion blur trail extends behind the character only)
4. Jump rise (1 frame) and Jump fall (1 frame) — 2 frames total, jumps are short and heavy
5. Crouch (1 frame, low guarded stance)
6. Guard/block stance (1 frame, both massive forearms raised defensively toward screen-right)
7. Light punch attack (2 frames: windup with fist pulled back, then full extension toward screen-right) — if a small hit-spark/impact effect is shown, it MUST be centered exactly on the fist's leading knuckle at full extension, touching the fist, never floating apart from it
8. Heavy haymaker punch (2 frames: big windup with body coiled back, then a huge full-body lunging punch) — same rule: any impact/burst effect must originate exactly at the fist, aligned with the strike
9. Hit reaction / flinch (1 frame, head snapped back)
10. Knockback (1 frame, staggering off-balance)
11. Knockdown (1 frame, fallen flat on the back)
12. Get-up (1 frame, pushing up from the ground on one arm)
13. Victory pose (1 frame, arms crossed proudly or a slow single fist raise)
14. Defeat/collapsed pose (1 frame, kneeling, head down)

STYLE:
- Clean pixel art with crisp, mostly hard edges (minimal anti-aliasing) — this sheet will be auto-cropped per cell, so soft blurry edges cause visible halo artifacts.
- Palette: dark gunmetal-grey and black heavy segmented plating, a single glowing orange eye visor, dull iron/rivet details, no bright colors.
- Silhouette: massive bulky build, oversized fists and shoulder blocks, short thick legs, low center of gravity, permanently hunched-forward heavyweight-boxer stance. No visible hair or face — fully enclosed helmet with just the glowing eye.
- Flat, consistent game-sprite lighting across every pose — no painterly rendering, no per-pose lighting changes.

NEGATIVE PROMPT:
text, watermark, caption, label, move name, input notation, UI frame, border, panel, gradient background, checkerboard background, drop shadow on ground, floor line, blurry soft edges, inconsistent scale between poses, off-model, extra limbs, cropped character, character touching or crossing the cell edge, effect floating apart from the striking limb, character looking at viewer, front-facing gaze, direct eye contact with camera, mascot pose, icon/portrait style, static arm-only attack without body rotation, stiff pose with no weight shift, slender or agile build.
```

---

## 記入例4：ドリフト（リン・地形使い）

```
16-bit pixel art character reference sheet, SNES/Genesis-era fighting game sprite style, for Drift (a terrain-specialist mech with adaptable legs, piloted by an adventurous young explorer).

CANVAS & LAYOUT (critical, must follow exactly):
- Output on a SOLID FLAT #00FF00 pure green chroma-key background. No gradient, no checkerboard pattern, no drop shadow, no floor line, no texture of any kind on the background — one single flat color only, corner to corner.
- Arrange every pose in a strict uniform grid, one pose per cell, left-to-right / top-to-bottom in the order listed below. Each grid cell is exactly 128x128px. The character's feet must rest on the exact same horizontal pixel row in every single cell, and the character must be horizontally centered in its cell.
- Do NOT draw any text, captions, Japanese or English labels, section headers, move names, input notation, borders, panel boxes, UI chrome, or watermarks anywhere in the image. Sprites only, nothing else.
- Keep the character's overall pixel scale IDENTICAL across every cell — same head-to-foot height every time, no zooming in or out between poses.
- This is a true side-view 2D fighting-game sprite (like classic Street Fighter / Mega Man Battle Network sprites), NOT a front-facing mascot, icon, or portrait. In EVERY pose, the character's HEAD and EYE must be turned to face the exact same screen-right direction as the body, as if staring down an opponent standing off-screen to the right. The character must never make eye contact with the viewer and must never have a front-on/camera-facing head, even in idle or victory poses.
- Attacks must use real martial-arts body mechanics: the hips and shoulders rotate into the strike, weight shifts onto the front foot, the non-striking arm pulls back for counterbalance. Do not draw an attack as a static standing figure with only the arm extended — the whole torso must lean and twist into the motion.
- Leave at least 8px of clear background margin around the character within each cell — nothing may touch or cross the cell edge.

REQUIRED POSES (2-4 animation frames per pose as noted, one row per pose):
1. Idle stance (2 frames, light bouncy ready stance)
2. Walk cycle (3 frames, agile confident stride)
3. Dash/run (2 frames, low fast sprint with a motion blur trail extending behind the character only)
4. Jump rise (1 frame) and Jump fall (1 frame) — 2 frames total, high acrobatic jump
5. Crouch (1 frame, low guarded stance)
6. Guard/block stance (1 frame, forearms raised defensively toward screen-right)
7. Light punch attack (2 frames: windup, then full extension toward screen-right) — if a small hit-spark/impact effect is shown, it MUST be centered exactly on the fist's leading knuckle at full extension, touching it, never floating apart from it
8. Heavy kick attack (2 frames: windup, full extension) — same rule: any impact/swoosh effect must originate exactly at the foot, aligned with the strike
9. Hit reaction / flinch (1 frame, leaning back)
10. Knockback (1 frame, further off-balance)
11. Knockdown (1 frame, fallen flat on the back)
12. Get-up (1 frame, pushing up from the ground)
13. Victory pose (1 frame, a playful peace-sign or confident stance)
14. Defeat/collapsed pose (1 frame, kneeling forward)

STYLE:
- Clean pixel art with crisp, mostly hard edges (minimal anti-aliasing) — this sheet will be auto-cropped per cell, so soft blurry edges cause visible halo artifacts.
- Palette: white and forest-green segmented armor plating, a single glowing cyan eye visor, dark grey joints.
- Silhouette: medium agile build, spiky angular fin-like details on the head and shoulders, legs styled with chunky visible tread/spike detailing on the boots (like all-terrain footwear), light and nimble explorer posture.
- Flat, consistent game-sprite lighting across every pose — no painterly rendering, no per-pose lighting changes.

NEGATIVE PROMPT:
text, watermark, caption, label, move name, input notation, UI frame, border, panel, gradient background, checkerboard background, drop shadow on ground, floor line, blurry soft edges, inconsistent scale between poses, off-model, extra limbs, cropped character, character touching or crossing the cell edge, effect floating apart from the striking limb, character looking at viewer, front-facing gaze, direct eye contact with camera, mascot pose, icon/portrait style, static arm-only attack without body rotation, stiff pose with no weight shift.
```

---

## 記入例5：アイギス（カメイ・守りの達人）

盾を左腕に常時装備している点に注意（ガード・攻撃とも盾が映り込む）。

```
16-bit pixel art character reference sheet, SNES/Genesis-era fighting game sprite style, for Aegis (a defense-specialist mech piloted by a calm veteran guardian).

CANVAS & LAYOUT (critical, must follow exactly):
- Output on a SOLID FLAT #00FF00 pure green chroma-key background. No gradient, no checkerboard pattern, no drop shadow, no floor line, no texture of any kind on the background — one single flat color only, corner to corner.
- Arrange every pose in a strict uniform grid, one pose per cell, left-to-right / top-to-bottom in the order listed below. Each grid cell is exactly 140x140px. The character's feet must rest on the exact same horizontal pixel row in every single cell, and the character must be horizontally centered in its cell.
- Do NOT draw any text, captions, Japanese or English labels, section headers, move names, input notation, borders, panel boxes, UI chrome, or watermarks anywhere in the image. Sprites only, nothing else.
- Keep the character's overall pixel scale IDENTICAL across every cell — same head-to-foot height every time, no zooming in or out between poses.
- This is a true side-view 2D fighting-game sprite (like classic Street Fighter / Mega Man Battle Network sprites), NOT a front-facing mascot, icon, or portrait. In EVERY pose, the character's HEAD and EYE must be turned to face the exact same screen-right direction as the body, as if staring down an opponent standing off-screen to the right. The character must never make eye contact with the viewer and must never have a front-on/camera-facing head, even in idle or victory poses.
- The character ALWAYS carries a large round shield strapped to its LEFT forearm (the arm closer to the viewer / away from the opponent) in every single pose without exception, including attacks, victory, and defeat. Only the RIGHT arm (the one closer to the opponent) is free to punch.
- Attacks must use real martial-arts body mechanics: the hips and shoulders rotate into the strike, weight shifts onto the front foot. Do not draw an attack as a static standing figure with only the arm extended.
- Leave at least 8px of clear background margin around the character within each cell — nothing may touch or cross the cell edge.

REQUIRED POSES (2-4 animation frames per pose as noted, one row per pose):
1. Idle stance (2 frames, patient watchful stance, shield held ready)
2. Walk cycle (3 frames, steady deliberate stride, shield stays raised)
3. Dash/run (2 frames, a short shuffle-step rather than a fast dash; motion blur trail extends behind the character only)
4. Jump rise (1 frame) and Jump fall (1 frame) — 2 frames total
5. Crouch (1 frame, hunkered down behind the shield)
6. Guard/block stance (1 frame, shield raised prominently to fully cover the front of the body toward screen-right)
7. Light punch attack (2 frames: windup, then full extension toward screen-right with the free right fist) — if a small hit-spark/impact effect is shown, it MUST be centered exactly on the fist's leading knuckle at full extension
8. Shield bash heavy attack (2 frames: windup, then thrusting the shield forward toward screen-right) — same rule: any impact/burst effect must originate exactly at the shield's leading edge
9. Hit reaction / flinch (1 frame, absorbing the hit behind the shield)
10. Knockback (1 frame, staggering off-balance, shield still raised)
11. Knockdown (1 frame, fallen flat on the back, shield fallen to the side)
12. Get-up (1 frame, pushing up from the ground, reaching for the shield)
13. Victory pose (1 frame, shield lowered, standing tall)
14. Defeat/collapsed pose (1 frame, kneeling, shield propped against the ground)

STYLE:
- Clean pixel art with crisp, mostly hard edges (minimal anti-aliasing) — this sheet will be auto-cropped per cell, so soft blurry edges cause visible halo artifacts.
- Palette: navy-blue and white segmented plating with gold trim accents, a single glowing cyan eye. The shield is white with a navy/gold cross-and-star emblem.
- Silhouette: sturdy medium-heavy build, wide stable stance, the large round shield dominates the left side of the silhouette in every pose.
- Flat, consistent game-sprite lighting across every pose — no painterly rendering, no per-pose lighting changes.

NEGATIVE PROMPT:
text, watermark, caption, label, move name, input notation, UI frame, border, panel, gradient background, checkerboard background, drop shadow on ground, floor line, blurry soft edges, inconsistent scale between poses, off-model, extra limbs, cropped character, character touching or crossing the cell edge, effect floating apart from the striking limb, character looking at viewer, front-facing gaze, direct eye contact with camera, mascot pose, icon/portrait style, static arm-only attack without body rotation, stiff pose with no weight shift, missing shield, shield on the wrong arm.
```

---

## 記入例6：テオリオン（カイ・理論の探求者）

```
16-bit pixel art character reference sheet, SNES/Genesis-era fighting game sprite style, for Theorion (a balanced strategist knight-type mech piloted by the dojo's top disciple).

CANVAS & LAYOUT (critical, must follow exactly):
- Output on a SOLID FLAT #00FF00 pure green chroma-key background. No gradient, no checkerboard pattern, no drop shadow, no floor line, no texture of any kind on the background — one single flat color only, corner to corner.
- Arrange every pose in a strict uniform grid, one pose per cell, left-to-right / top-to-bottom in the order listed below. Each grid cell is exactly 128x128px. The character's feet must rest on the exact same horizontal pixel row in every single cell, and the character must be horizontally centered in its cell.
- Do NOT draw any text, captions, Japanese or English labels, section headers, move names, input notation, borders, panel boxes, UI chrome, or watermarks anywhere in the image. Sprites only, nothing else.
- Keep the character's overall pixel scale IDENTICAL across every cell — same head-to-foot height every time, no zooming in or out between poses.
- This is a true side-view 2D fighting-game sprite (like classic Street Fighter / Mega Man Battle Network sprites), NOT a front-facing mascot, icon, or portrait. In EVERY pose, the character's HEAD and EYE must be turned to face the exact same screen-right direction as the body, as if staring down an opponent standing off-screen to the right. The character must never make eye contact with the viewer and must never have a front-on/camera-facing head, even in idle or victory poses.
- Attacks must use real martial-arts body mechanics: the hips and shoulders rotate into the strike, weight shifts onto the front foot, the non-striking arm pulls back for counterbalance. Do not draw an attack as a static standing figure with only the arm extended — the whole torso must lean and twist into the motion.
- Leave at least 8px of clear background margin around the character within each cell — nothing may touch or cross the cell edge.

REQUIRED POSES (2-4 animation frames per pose as noted, one row per pose):
1. Idle stance (2 frames, elegant balanced ready stance)
2. Walk cycle (3 frames, refined confident stride)
3. Dash/run (2 frames, smooth fast dash with a motion blur trail extending behind the character only)
4. Jump rise (1 frame) and Jump fall (1 frame) — 2 frames total
5. Crouch (1 frame, low guarded stance)
6. Guard/block stance (1 frame, forearms raised defensively toward screen-right)
7. Light punch attack (2 frames: windup, then full extension toward screen-right) — if a small hit-spark/impact effect is shown, it MUST be centered exactly on the fist's leading knuckle at full extension, never floating apart from it
8. Heavy kick attack (2 frames: windup, full extension) — same rule: any impact/swoosh effect must originate exactly at the foot, aligned with the strike
9. Hit reaction / flinch (1 frame, leaning back)
10. Knockback (1 frame, further off-balance)
11. Knockdown (1 frame, fallen flat on the back)
12. Get-up (1 frame, pushing up from the ground)
13. Victory pose (1 frame, a composed one-knee bow or a calm raised fist)
14. Defeat/collapsed pose (1 frame, kneeling, head down)

STYLE:
- Clean pixel art with crisp, mostly hard edges (minimal anti-aliasing) — this sheet will be auto-cropped per cell, so soft blurry edges cause visible halo artifacts.
- Palette: white, navy-blue, and gold segmented plating, a single glowing cyan eye.
- Silhouette: elegant knight-like proportions, symmetrical and refined, small decorative wing-shaped fins at the shoulder blades, slim armored boots. Overall the most "balanced/textbook-perfect" looking of all the characters.
- Flat, consistent game-sprite lighting across every pose — no painterly rendering, no per-pose lighting changes.

NEGATIVE PROMPT:
text, watermark, caption, label, move name, input notation, UI frame, border, panel, gradient background, checkerboard background, drop shadow on ground, floor line, blurry soft edges, inconsistent scale between poses, off-model, extra limbs, cropped character, character touching or crossing the cell edge, effect floating apart from the striking limb, character looking at viewer, front-facing gaze, direct eye contact with camera, mascot pose, icon/portrait style, static arm-only attack without body rotation, stiff pose with no weight shift.
```

---

## 記入例7：オメガノヴァ（最終ボス）

```
16-bit pixel art character reference sheet, SNES/Genesis-era fighting game sprite style, for OmegaNova (the ultimate destructive final-boss mech, a fusion of every combat style).

CANVAS & LAYOUT (critical, must follow exactly):
- Output on a SOLID FLAT #00FF00 pure green chroma-key background. No gradient, no checkerboard pattern, no drop shadow, no floor line, no texture of any kind on the background — one single flat color only, corner to corner.
- Arrange every pose in a strict uniform grid, one pose per cell, left-to-right / top-to-bottom in the order listed below. Each grid cell is exactly 160x160px (this character is larger and wider than a normal fighter, with blade protrusions — make sure nothing gets cropped). The character's feet must rest on the exact same horizontal pixel row in every single cell, and the character must be horizontally centered in its cell.
- Do NOT draw any text, captions, Japanese or English labels, section headers, move names, input notation, borders, panel boxes, UI chrome, or watermarks anywhere in the image. Sprites only, nothing else.
- Keep the character's overall pixel scale IDENTICAL across every cell — same head-to-foot height every time, no zooming in or out between poses.
- This is a true side-view 2D fighting-game sprite (like classic Street Fighter / Mega Man Battle Network sprites), NOT a front-facing mascot, icon, or portrait. In EVERY pose, the character's HEAD and EYES must be turned to face the exact same screen-right direction as the body, as if staring down an opponent standing off-screen to the right. The character must never make eye contact with the viewer and must never have a front-on/camera-facing head, even in idle or victory poses.
- Attacks must use real martial-arts body mechanics: the hips and shoulders rotate into the strike, weight shifts onto the front foot. Do not draw an attack as a static standing figure with only the arm extended — the whole torso must lean and twist into the motion.
- Leave at least 10px of clear background margin around the character (including the wing-blades) within each cell — nothing may touch or cross the cell edge.

REQUIRED POSES (2-4 animation frames per pose as noted, one row per pose):
1. Idle stance (2 frames, menacing still stance, wing-blades subtly shifting)
2. Walk cycle (3 frames, slow deliberate predatory stride)
3. Dash/run (2 frames, fast aggressive lunge with a motion blur trail extending behind the character only)
4. Jump rise (1 frame) and Jump fall (1 frame) — 2 frames total
5. Crouch (1 frame, low aggressive stance)
6. Guard/block stance (1 frame, wing-blades angled forward defensively toward screen-right)
7. Light punch attack (2 frames: windup, then full extension toward screen-right) — if a small hit-spark/impact effect is shown, it MUST be centered exactly on the fist's leading knuckle at full extension, never floating apart from it
8. Heavy blade-slash attack (2 frames: windup, then a sweeping wing-blade strike toward screen-right) — same rule: any impact/burst effect must originate exactly at the blade tip, aligned with the strike
9. Hit reaction / flinch (1 frame, recoiling)
10. Knockback (1 frame, staggering off-balance)
11. Knockdown (1 frame, fallen flat on the back, wing-blades splayed)
12. Get-up (1 frame, rising menacingly from the ground)
13. Victory pose (1 frame, imposing arms-spread triumphant stance, wing-blades fanned out)
14. Defeat/collapsed pose (1 frame, slumped forward, wing-blades drooping)

STYLE:
- Clean pixel art with crisp, mostly hard edges (minimal anti-aliasing) — this sheet will be auto-cropped per cell, so soft blurry edges cause visible halo artifacts.
- Palette: black and deep crimson-red segmented plating with gold trim accents, multiple glowing red eye-lights (not just one).
- Silhouette: imposing tall build, numerous blade-like wing protrusions radiating outward from the back and shoulders, sharp jagged intimidating outline, clearly the most threatening-looking character of the whole cast.
- Flat, consistent game-sprite lighting across every pose — no painterly rendering, no per-pose lighting changes.

NEGATIVE PROMPT:
text, watermark, caption, label, move name, input notation, UI frame, border, panel, gradient background, checkerboard background, drop shadow on ground, floor line, blurry soft edges, inconsistent scale between poses, off-model, extra limbs, cropped character, character touching or crossing the cell edge, effect floating apart from the striking limb, character looking at viewer, front-facing gaze, direct eye contact with camera, mascot pose, icon/portrait style, static arm-only attack without body rotation, stiff pose with no weight shift, friendly or cute expression.
```

---

## 記入例8：ソフィス・レギオン（ノギ先生・隠しボス）

```
16-bit pixel art character reference sheet, SNES/Genesis-era fighting game sprite style, for Sophis Legion (the legendary hidden-boss mech of a retired champion mentor who is said to never fight at full power).

CANVAS & LAYOUT (critical, must follow exactly):
- Output on a SOLID FLAT #00FF00 pure green chroma-key background. No gradient, no checkerboard pattern, no drop shadow, no floor line, no texture of any kind on the background — one single flat color only, corner to corner.
- Arrange every pose in a strict uniform grid, one pose per cell, left-to-right / top-to-bottom in the order listed below. Each grid cell is exactly 150x150px. The character's feet must rest on the exact same horizontal pixel row in every single cell, and the character must be horizontally centered in its cell.
- Do NOT draw any text, captions, Japanese or English labels, section headers, move names, input notation, borders, panel boxes, UI chrome, or watermarks anywhere in the image. Sprites only, nothing else.
- Keep the character's overall pixel scale IDENTICAL across every cell — same head-to-foot height every time, no zooming in or out between poses.
- This is a true side-view 2D fighting-game sprite (like classic Street Fighter / Mega Man Battle Network sprites), NOT a front-facing mascot, icon, or portrait. In EVERY pose, the character's HEAD and EYES must be turned to face the exact same screen-right direction as the body, as if staring down an opponent standing off-screen to the right. The character must never make eye contact with the viewer and must never have a front-on/camera-facing head, even in idle or victory poses.
- Attacks must use real martial-arts body mechanics: the hips and shoulders rotate into the strike, weight shifts onto the front foot. Do not draw an attack as a static standing figure with only the arm extended — the whole torso must lean and twist into the motion.
- A faint semi-transparent purple energy aura/particle glow may surround the character subtly in every pose, consistently, without obscuring the silhouette or touching the cell edge.
- Leave at least 8px of clear background margin around the character within each cell — nothing may touch or cross the cell edge.

REQUIRED POSES (2-4 animation frames per pose as noted, one row per pose):
1. Idle stance (2 frames, effortlessly calm and composed stance)
2. Walk cycle (3 frames, unhurried confident stride)
3. Dash/run (2 frames, an instantaneous-looking blur dash with a motion blur trail extending behind the character only)
4. Jump rise (1 frame) and Jump fall (1 frame) — 2 frames total
5. Crouch (1 frame, low guarded stance)
6. Guard/block stance (1 frame, forearms raised defensively toward screen-right)
7. Light punch attack (2 frames: windup, then full extension toward screen-right) — if a small hit-spark/impact effect is shown, it MUST be centered exactly on the fist's leading knuckle at full extension, never floating apart from it
8. Heavy kick attack (2 frames: windup, full extension) — same rule: any impact/swoosh effect must originate exactly at the foot, aligned with the strike
9. Hit reaction / flinch (1 frame, barely reacting, composed even when hit)
10. Knockback (1 frame, further off-balance)
11. Knockdown (1 frame, fallen flat on the back)
12. Get-up (1 frame, rising smoothly from the ground)
13. Victory pose (1 frame, a quiet dignified bow or a single calm raised hand)
14. Defeat/collapsed pose (1 frame, kneeling with head bowed)

STYLE:
- Clean pixel art with crisp, mostly hard edges (minimal anti-aliasing) — this sheet will be auto-cropped per cell, so soft blurry edges cause visible halo artifacts.
- Palette: black and dark purple segmented plating with gold trim accents, glowing violet eye-lights, faint purple particle glow.
- Silhouette: sharp spiked ornate armor, regal knight-like proportions similar in build to Theorion but darker, more angular, and more ornate — visibly the most legendary/powerful-looking character in the cast.
- Flat, consistent game-sprite lighting across every pose — no painterly rendering, no per-pose lighting changes.

NEGATIVE PROMPT:
text, watermark, caption, label, move name, input notation, UI frame, border, panel, gradient background, checkerboard background, drop shadow on ground, floor line, blurry soft edges, inconsistent scale between poses, off-model, extra limbs, cropped character, character touching or crossing the cell edge, effect floating apart from the striking limb, character looking at viewer, front-facing gaze, direct eye contact with camera, mascot pose, icon/portrait style, static arm-only attack without body rotation, stiff pose with no weight shift.
```

---

## 記入例9：ウィズル（ソニカ・速度型ジャブファイター）— 完全版プロンプト（差し替え用）

既存 `sprite2.png` 由来のウィズルは動いているが、ハジメくん同様に目線・攻撃の自然さを揃えるため差し替え版。細身・鋭利なブレード状の肩/脚パーツ、赤+白、シアンの単眼という既存デザインを踏襲。

```
16-bit pixel art character reference sheet, SNES/Genesis-era fighting game sprite style, for Wizel (a speed-type agile jab-fighter mech piloted by an impatient, energetic underclassman).

CANVAS & LAYOUT (critical, must follow exactly):
- Output on a SOLID FLAT #00FF00 pure green chroma-key background. No gradient, no checkerboard pattern, no drop shadow, no floor line, no texture of any kind on the background — one single flat color only, corner to corner.
- Arrange every pose in a strict uniform grid, one pose per cell, left-to-right / top-to-bottom in the order listed below. Each grid cell is exactly 128x128px. The character's feet must rest on the exact same horizontal pixel row in every single cell, and the character must be horizontally centered in its cell.
- Do NOT draw any text, captions, Japanese or English labels, section headers, move names, input notation, borders, panel boxes, UI chrome, or watermarks anywhere in the image. Sprites only, nothing else.
- Keep the character's overall pixel scale IDENTICAL across every cell — same head-to-foot height every time, no zooming in or out between poses.
- This is a true side-view 2D fighting-game sprite (like classic Street Fighter / Mega Man Battle Network sprites), NOT a front-facing mascot, icon, or portrait. In EVERY pose, the character's HEAD and EYE must be turned to face the exact same screen-right direction as the body, as if staring down an opponent standing off-screen to the right. The character must never make eye contact with the viewer and must never have a front-on/camera-facing head, even in idle or victory poses.
- Attacks must use real martial-arts body mechanics: the hips and shoulders rotate into the strike, weight shifts onto the front foot, the non-striking arm pulls back for counterbalance. Do not draw an attack as a static standing figure with only the arm extended — the whole torso must lean and twist into the motion. This character's attacks should read as fast, sharp jabs rather than heavy haymakers.
- Leave at least 8px of clear background margin around the character within each cell — nothing may touch or cross the cell edge.

REQUIRED POSES (2-4 animation frames per pose as noted, one row per pose):
1. Idle stance (2 frames, restless jittery ready stance, light on the feet)
2. Walk cycle (3 frames, quick brisk stride)
3. Dash/run (2 frames, a very fast low sprint with a long motion blur trail extending behind the character only, never overlapping the silhouette)
4. Jump rise (1 frame) and Jump fall (1 frame) — 2 frames total, a light quick hop
5. Crouch (1 frame, low guarded stance)
6. Guard/block stance (1 frame, forearms raised defensively toward screen-right)
7. Light jab attack (2 frames: quick windup with fist barely pulled back, then a fast snapping extension toward screen-right) — if a small hit-spark/impact effect is shown, it MUST be centered exactly on the fist's leading knuckle at full extension, touching the fist, never floating apart from it
8. Heavy spinning kick attack (2 frames: windup with a slight body coil, then a full extension kick toward screen-right) — same rule: any impact/swoosh effect must originate exactly at the foot, aligned with the strike
9. Hit reaction / flinch (1 frame, leaning back sharply)
10. Knockback (1 frame, further off-balance, tumbling)
11. Knockdown (1 frame, fallen flat on the back)
12. Get-up (1 frame, springing back up quickly from the ground)
13. Victory pose (1 frame, a cocky confident finger-point or a fast double fist-pump)
14. Defeat/collapsed pose (1 frame, sitting slumped forward, exhausted)

STYLE:
- Clean pixel art with crisp, mostly hard edges (minimal anti-aliasing) — this sheet will be auto-cropped per cell, so soft blurry edges cause visible halo artifacts.
- Palette: red and white segmented armor plating, a single glowing cyan eye visor, dark grey/black joints.
- Silhouette: slender lightweight build, sharp angular blade-like protrusions on the shoulders and lower legs, a spiky crest on the head, overall the leanest and most aerodynamic-looking character in the cast.
- Flat, consistent game-sprite lighting across every pose — no painterly rendering, no per-pose lighting changes.

NEGATIVE PROMPT:
text, watermark, caption, label, move name, input notation, UI frame, border, panel, gradient background, checkerboard background, drop shadow on ground, floor line, blurry soft edges, inconsistent scale between poses, off-model, extra limbs, cropped character, character touching or crossing the cell edge, effect floating apart from the striking limb, character looking at viewer, front-facing gaze, direct eye contact with camera, mascot pose, icon/portrait style, static arm-only attack without body rotation, stiff pose with no weight shift, bulky or heavy build.
```

---

## 生成後のチェックリスト（人間 or 私が確認する項目）

- [ ] 背景が本当に単色（#00FF00等）か。チェッカー柄や白グラデーションになっていないか
- [ ] 各セルでキャラの足の接地線・全体スケールが揃っているか
- [ ] テキストラベルが画像内に一切ないか
- [ ] 攻撃ポーズで、エフェクトが拳/脚の先端に正しく重なっているか
- [ ] 必要ポーズが全て揃っているか（上記「REQUIRED POSES」表）
