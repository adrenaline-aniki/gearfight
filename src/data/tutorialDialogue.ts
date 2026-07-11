import type { DialogueLine } from '../types/game';

// Nogi-sensei walks the player through the whole tutorial: screen/HUD
// reading, core rules (gears/heat/perfect shift, guard/guard-break), and
// finally the super move - each intro plays via DialogueScene right before
// the BattleScene step it sets up (see BattleScene.advanceTutorial()).
export const TUTORIAL_INTRO: DialogueLine[] = [
  { speaker: 'ノギ先生', text: 'はじめまして。技術科のノギです。今日はこの「ギアフレンド」の基本操作を教えますね。', emotion: 'smile' },
  { speaker: 'ノギ先生', text: 'まずは画面の見方から。左上に自分と相手のHPバーが出ています。0になったら負けですよ。', emotion: 'normal' },
  { speaker: 'ノギ先生', text: 'その下の「GL」は今のギアレベル、続く数字は歯数の比です。歯数比が大きいほど、力は強いが動きは遅くなります。', emotion: 'serious' },
  { speaker: 'ノギ先生', text: 'さらに下の3本の細いバーが、左からヒート（過熱）・必殺ゲージ・ガードゲージです。追って説明していきますね。', emotion: 'normal' },
  { speaker: 'ノギ先生', text: '操作はシンプル。←→で移動、Zで弱攻撃、Xで強攻撃、Spaceでジャンプです。', emotion: 'confident' },
  { speaker: '主人公', text: 'よし、まずは動かしてみるよ。', emotion: 'confident' },
  { speaker: 'ノギ先生', text: 'では、そこのカカシくんに弱攻撃・強攻撃を織り交ぜて10発当ててみてください。攻撃の感触を覚えましょう。', emotion: 'smile' },
];

export const TUTORIAL_STEP2_INTRO: DialogueLine[] = [
  { speaker: 'ノギ先生', text: 'いい感じです。次はこのゲームの心臓部、「ギア」の仕組みを教えます。', emotion: 'smile' },
  { speaker: 'ノギ先生', text: 'Qでギアダウン、Eでギアアップ。GL1は歯数比が小さく速いが弱い、GL5は歯数比が大きく強いが遅い……歯車の基本ですね。', emotion: 'serious' },
  { speaker: 'ノギ先生', text: '高いギアで動き続けると、ヒートバー（左のバー）が満タンになってオーバーヒート。強制的にGL1に落とされてしまいます。', emotion: 'normal' },
  { speaker: 'ノギ先生', text: 'そして重要なのが「パーフェクトシフト」。シフト中、HUDの丸が光る一瞬にもう一度Q/Eを押すと、隙なく変速できます。', emotion: 'confident' },
  { speaker: '主人公', text: 'タイミングが命ってことか。', emotion: 'serious' },
  { speaker: 'ノギ先生', text: 'その通り！ では実際にギアチェンジして、パーフェクトシフトを1回決めてみましょう。', emotion: 'smile' },
];

export const TUTORIAL_STEP3_INTRO: DialogueLine[] = [
  { speaker: 'ノギ先生', text: '次は「ガード」です。相手の攻撃方向と逆（後ろ）を入力し続けると防御できます。', emotion: 'normal' },
  { speaker: 'ノギ先生', text: 'ただし、ガードし続けると画面下のガードゲージが削れていきます。0になるとガードクラッシュ、大きな隙が生まれますよ。', emotion: 'serious' },
  { speaker: 'ノギ先生', text: '逆に、こちらから攻める時はGL4以上の強攻撃で、相手のガードごと粉砕できます。「ガードブレイク」です。', emotion: 'confident' },
  { speaker: '主人公', text: 'ガードしてれば安全ってわけじゃないんだね。', emotion: 'surprised' },
  { speaker: 'ノギ先生', text: 'そうです。では、ギアをGL4以上に上げてから強攻撃で、1回ガードブレイクを決めてみましょう。', emotion: 'smile' },
];

export const TUTORIAL_STEP4_INTRO: DialogueLine[] = [
  { speaker: 'ノギ先生', text: '最後に、とっておきを教えます。画面上の必殺ゲージ（中央のバー）は、攻撃を当てたり、逆に喰らったりすると溜まっていきます。', emotion: 'normal' },
  { speaker: 'ノギ先生', text: 'ゲージが満タンになると点滅します。その状態でZ+Xを同時押しすると、必殺技が発動しますよ。', emotion: 'confident' },
  { speaker: 'ノギ先生', text: '必殺技はガードを完全に無視して大ダメージを与えられる、最後の切り札です。', emotion: 'serious' },
  { speaker: 'ノギ先生', text: 'ちょうどゲージが満タンになっていますね。さっそく、カカシくんに必殺技を1発当ててみましょう！', emotion: 'smile' },
];

export const TUTORIAL_OUTRO: DialogueLine[] = [
  { speaker: 'ノギ先生', text: '見事です！ 画面の見方、移動と攻撃、ギアとヒート、ガードとガードブレイク、そして必殺技……基本は全部身につきましたね。', emotion: 'smile' },
  { speaker: 'ノギ先生', text: 'あとは実戦あるのみ。モード選択からストーリーやフリー対戦で、いろんな相手と戦ってみてください。', emotion: 'confident' },
  { speaker: '主人公', text: 'ありがとう、ノギ先生！ ハジメくんと一緒に頑張るよ。', emotion: 'confident' },
  { speaker: 'ノギ先生', text: 'メカニック免許（仮）を授与します。健闘を祈っていますよ。', emotion: 'smile' },
];
