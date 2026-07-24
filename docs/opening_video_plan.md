# NEXT GEAR — オープニング映像 制作プラン

主題歌「NEXT GEAR」（ボーカル版5:12／インスト版4:46、Suno製）を使った、TV版アニメOPサイズ（約85〜90秒）の映像を作るための計画。Claude Codeは画像・動画そのものは生成できないため、**このドキュメントは外部のAI動画生成ツール（Kling / Pika / Runway等）に投入するためのシナリオ・カット割り・カットごとの生成プロンプト集**という位置づけ。

## 前提・スコープ
- **尺**：TV OP標準の85〜90秒。主題歌フル(5:12)をそのまま使うのは長すぎるため、**サビ＋Aメロ or Bメロを中心にした短縮編集**が必要（音源側の編集は別途、音楽編集ソフトかAI動画ツールの音声トリムで対応）。
- **手法**：1カット4〜8秒程度のクリップをAIツールで個別生成し、動画編集ソフト（CapCut等）で主題歌に合わせて繋ぐ。実写的な作り込みは狙わず、**既存の設定原画・表情シート・メカデザインシートを画像入力（image-to-video）にして一貫性を保つ**のが前提。
- **参照素材**：
  - `public/sprites/character_settei_v1.png` / 表情差分シート（`public/sprites/portraits/<id>/*.png`）— 人物の顔・表情
  - 今回共有いただいたメカ・章構成シート（各キャラのギアフレンドのフルボディデザイン、ハジメくんの成長段階）
  - `docs/仕様書.md` §4（世界観・キャラクター）— 性格・口癖・関係性の言語設定
- **最終形**：完成した動画ファイルを`public/video/opening.mp4`等に配置し、`TitleScene`からスキップ可能な形で再生する（実装は動画ができてから別タスク）。

## 全体構成（王道ロボアニメOPの型）
王道パターン（静→動→サビの爆発→対比→集合絵）に、本作のテーマ「理（リクツ）で勝つ」を要所に混ぜる。

| # | 尺目安 | パート | 内容 |
|---|---|---|---|
| 1 | 0:00-0:06 | コールドオープン | 灰色の旧型素体ハジメくん、暗い工房。歯車が単体でゆっくり回る |
| 2 | 0:06-0:14 | Aメロ導入 | ノギ先生との出会い。「メカニックの本質は『理』を理解することだよ」の口上とともにロゴ出現 |
| 3 | 0:14-0:30 | ライバル montage | ソニカ→ゴウケン→リン→カメイ→カイの順に、各人物カット→各ギアフレンドの決めポーズカットを交互に高速montage |
| 4 | 0:30-0:42 | 成長シーケンス（サビ前） | ハジメくんが章クリアごとにパーツを換装していく変身montage（灰色→赤腕→黒腕→緑脚→紺盾→金の最終形態） |
| 5 | 0:42-0:58 | サビ①：戦闘ハイライト | フル装備ハジメくんの戦闘カット複数（パンチ、ギアシフトの発光、パーフェクトシフトの閃光） |
| 6 | 0:58-1:08 | 対比・翳り | 謎の青年（レイ）のシルエット→赤い瞳のアップ→「まさか…レイ！？」の表情 |
| 7 | 1:08-1:20 | サビ②：オメガノヴァ登場 | 黒/赤/金の最終ボス、翼状ブレードの禍々しい全身カット |
| 8 | 1:20-1:28 | 集合絵 | 主要キャラ全員（人物＋ギアフレンド）が横並びで見得を切る一枚絵カット |
| 9 | 1:28-1:32(-1:35) | ロゴ締め | タイトルロゴ「GEAR FIGHT」がフラッシュ、歯車が噛み合って静止 |

## カットごとの生成プロンプト

各プロンプトは image-to-video 対応ツール向け。`[REF: ...]`は入力画像として使う参照素材を示す。共通のネガティブ指定・スタイル指定は最後にまとめて記載。

### Cut 1（0:00-0:06）コールドオープン
```
[REF: ハジメくんの旧型機（成長段階シートの"スタート時（素体）"カット）]
A dim, quiet mechanic workshop at dawn. A worn-down GRAY basic-frame robot
(Hajime-kun, unpainted, scuffed) stands motionless, head slightly lowered.
A single small gear on a workbench beside it slowly, deliberately rotates -
the only movement in the frame. Soft blue rim light from an unseen window.
Camera: slow push-in, no cuts. Mood: quiet anticipation, not sad.
```

### Cut 2（0:06-0:14）ノギ先生との出会い
```
[REF: ノギ先生の表情シート「通常」「笑顔」]
Nogi-sensei (messy brown hair, glasses, white lab coat) turns toward camera
with a warm, knowing smile, adjusting his glasses. Behind him, blueprints and
gear diagrams pinned on a wall flutter slightly. He gestures upward as if
explaining something important. Camera: slight low angle, static with subtle
handheld sway. End on his confident smile.
```

### Cut 3〜7（0:14-0:30）ライバル montage：5人分、各カット1.5〜2秒×2（人物→メカ）
共通テンプレート（`{{NAME}}`等を差し替え）：
```
[REF: {{PILOT_PORTRAIT}}（表情シート「自信」または「真剣」）]
{{PILOT_NAME}}, {{PILOT_APPEARANCE}}, turns and looks directly at camera with
a confident smirk, {{PILOT_GESTURE}}. Dynamic diagonal composition, quick
whip-pan entry. Anime key-visual energy, not photorealistic.
```
```
[REF: {{MECH_FULL_BODY}}（メカ・章構成シートの当該キャラ）]
{{MECH_NAME}}, {{MECH_APPEARANCE}}, strikes a dynamic action pose, {{MECH_ACTION}},
with a burst of speed-lines / spark particles matching its element. Camera:
fast push-in ending on a freeze-frame-style hold. Matches its pilot's silhouette
energy from the previous cut.
```

| 差し替え値 | ソニカ／ウィズル | ゴウケン／ガンロック | リン／ドリフト | カメイ／アイギス | カイ／テオリオン |
|---|---|---|---|---|---|
| PILOT_APPEARANCE | オレンジ髪ポニーテール、ピンクのヘッドバンド、ヘッドセット | 黒髪逆立ち、赤いバンダナ | 茶髪、サファリ帽とゴーグル | 黒髪、眼鏡、寡黙な佇まい | 銀髪、鋭い目つき |
| PILOT_GESTURE | サムズアップしながらウインク | 腕を組んで不敵に笑う | 帽子のつばに手をかけて笑顔 | 眼鏡を指で押し上げる | 静かに腕組み |
| MECH_APPEARANCE | 赤×白、鋭利なV字アンテナ、細身のブレード腕 | 黒鉄色、巨大な拳と肩、発光する目 | 白×緑、俊敏なシルエット | 白×紺、左腕に大盾 | 白×紺×金、優美な騎士型 |
| MECH_ACTION | 高速の連続ジャブ | 拳を大きく振りかぶる | 跳躍して弧を描く蹴り | 盾を構えて踏み込む | ギアシフトの残光をまとい抜刀動作 |

### Cut 8（0:30-0:42）ハジメくんの成長montage
```
[REF: 成長段階シート（スタート時→第1章クリア後→…→第5章クリア後の6段階すべて）]
A rapid transformation montage: the gray basic-frame robot Hajime-kun is
struck by light from above, and in a series of quick mechanical snap-on
transitions (armor panels sliding into place with a metallic CLACK), gains
red speed-arms, then black power-arms, then green terrain-legs, then a navy
chest-plate and shield, finally golden wing-like final armor. Each transition
is a hard cut on a beat, camera holding a consistent 3/4 front angle so the
silhouette progression reads clearly. End on the fully-armored gold-accented
final form flexing into a battle stance.
```

### Cut 9（0:42-0:58）サビ①：戦闘ハイライト
```
[REF: ハジメくん最終形態（成長シート最終段階）+ 仕様書のギア/パーフェクトシフト演出]
Fully-armored Hajime-kun in mid-battle: a flurry of punches with motion blur,
a gear-shift moment where his chest gear glows and flashes gold ("perfect
shift"), then a powerful haymaker punch toward camera with a shockwave burst.
Fast cutting rhythm, dramatic low-angle hero shots, lens flare on the gear
flash. High energy, matches a musical chorus hit.
```

### Cut 10（0:58-1:08）レイ（謎の青年）の対比カット
```
[REF: 設定原画のオメガノヴァパイロット部分があれば使用。無ければ「白黒ツートン髪・赤目・黒ジャケットの青年」で新規生成]
A young man with two-tone black-and-white hair and cold RED eyes stands in
silhouette against a harsh backlight, face mostly in shadow. Slow zoom into
his eyes as they narrow slightly - the only motion. Cut to a brief flash of
Hajime-kun's shocked expression (wide eyes, mouth slightly open, as if
recognizing someone). Muted, tense color grading - blues and blacks, no warm
tones (contrast against the warm rival montage in cuts 3-7).
```

### Cut 11（1:08-1:20）サビ②：オメガノヴァ登場
```
[REF: 章構成シートのオメガノヴァ（最終章カード）]
OmegaNova, a black-red-and-gold mech with numerous blade-like wing protrusions,
rises into frame from below with an ominous mechanical unfurling of its wings,
red eye-lights igniting one by one. Camera: dramatic low-angle, slow rotation
around the mech as smoke/embers drift past. Imposing, villainous, the most
threatening silhouette in the piece.
```

### Cut 12（1:20-1:28）集合絵
```
[REF: 表情シート全員＋メカ・章構成シート全員]
A single dynamic group composition: Hajime-kun (final form) at the front-center
in a heroic stance, with Wizel, Ganrock, Drift, Aegis, and Theorion arranged
around him in a wide V-formation, each striking their signature pose. Warm
golden-hour lighting unifies the palette. Camera holds static - this is the
"key visual" freeze-frame moment of the OP.
```

### Cut 13（1:28-1:32）ロゴ締め
```
[REF: 既存のタイトルロゴテキスト「GEAR FIGHT」があれば使用]
A large mechanical gear rotates into frame and CLICKS into place, interlocking
with a second gear - the meshing motion triggers a flash of white light that
resolves into the "GEAR FIGHT" logo, bold pixel/mechanical typography, centered.
Brief lens flare, then hold on the logo.
```

## 共通スタイル指定（全カット末尾に追加）
```
STYLE: modern anime opening-sequence quality, clean cel-shaded characters with
dynamic lighting, cinematic camera moves, consistent character design matching
the reference sheet exactly (hair, colors, outfit details, mech proportions).
NEGATIVE: photorealistic, 3D render look, off-model face/proportions, extra
limbs, text/watermark artifacts, inconsistent color palette between cuts.
```

## 次のステップ
1. Kling AIまたはPikaの無料枠で、まず**Cut 1（コールドオープン）とCut 3（ソニカ/ウィズル montageの片方）を1本ずつ試作**し、設定原画との絵柄一致度を確認する
2. 相性が良ければ、Cut一覧を上から順に生成
3. 全カットが揃ったら動画編集ソフトで主題歌NEXT GEARに合わせてタイミング調整・繋ぎ
4. 完成した動画ファイルを`public/video/`に配置し、`TitleScene`にスキップ可能な再生ロジックを実装（別タスク、`tasks.md`に追記予定）
