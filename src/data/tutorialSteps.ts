// GEAR FIGHT — new-engine tutorial script (ノギ先生 navigation).
//
// A guided, learn-by-doing tutorial: each step shows an instruction and the driver
// (TrainingScene) watches for the player to actually DO it before advancing. It
// covers the basics, then goes deep on the gear system - its effect, WHEN to shift
// up vs down, the perfect-shift reward - and finishes on command specials + assist.

export type TutGoal =
  | 'move' | 'crouchjump' | 'light3' | 'heavy' | 'block' | 'throw'
  | 'gearup5' | 'info' | 'geardown1' | 'perfectshift' | 'command' | 'done';

export interface TutorialStep {
  /** ノギ先生's narration for this step. */
  text: string;
  /** what the driver must detect before advancing. */
  goal: TutGoal;
  /** how the practice dummy behaves during this step. */
  dummy?: 'stand' | 'cpu';
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { text: 'ようこそ、ギアファイトへ。私はノギ。まずは移動だ。スティックを左右に倒して、前と後ろに動いてみよう。', goal: 'move', dummy: 'stand' },
  { text: 'いいね。スティックを下でしゃがみ、上でジャンプ。両方ためしてごらん。', goal: 'crouchjump', dummy: 'stand' },
  { text: '次は攻撃だ。弱ボタンで弱攻撃。素早い手数の技だよ。3回出してみよう。', goal: 'light3', dummy: 'stand' },
  { text: '強ボタンで強攻撃。遅いが一発が重い。1回当ててみよう。', goal: 'heavy', dummy: 'stand' },
  { text: '守りも大事だ。後ろにスティックを倒すとガード。カカシくんの攻撃を防いでみよう。', goal: 'block', dummy: 'cpu' },
  { text: 'ガードばかりの相手には投げが効く。近づいて投げボタンだ。', goal: 'throw', dummy: 'stand' },
  { text: 'さて、ここからが肝心——【ギア】だ。今はGL3。ギアを上げると"攻撃力が上がる代わりに、動きが遅くなり、発熱する"。右端のG＋ボタンでGL5まで上げてみよう。', goal: 'gearup5', dummy: 'stand' },
  { text: 'GL5は最強の火力＆"ガード割り"（高ギアはガードごと削れる）。硬い相手を崩したい時に上げるんだ。ただし遅く、被弾のリスクも上がる。［弱ボタンでつぎへ］', goal: 'info', dummy: 'stand' },
  { text: 'そして高ギアは発熱する。ゲージが満タンになると【オーバーヒート】——GL1に固定され、しばらく無防備だ。熱くなったらGL1へ下げて冷やせ。右端のG−ボタンでGL1まで下げてみよう。', goal: 'geardown1', dummy: 'stand' },
  { text: '達人の技【パーフェクトシフト】。変速した"直後"にもう一度変速すると、隙が消えて熱も一気に冷める。G＋（またはG−）を素早く2回——変速して即もう一度、で決めてみろ。番号が緑に光っている間がチャンスだ。', goal: 'perfectshift', dummy: 'stand' },
  { text: '必殺技はコマンド入力。↓＼→ と回して弱ボタンで"波動"系を撃てる。出してみよう。（難しければ選択画面でアシストONにすれば、スティック＋必殺ボタンで簡単に出せる）', goal: 'command', dummy: 'stand' },
  { text: '見事だ。あとは実戦あるのみ。覚えておけ——【崩したい時はギアを上げ、危なくなったら下げる】。それがギアファイトの心臓だ。健闘を祈る！［弱ボタンで終了］', goal: 'done', dummy: 'stand' },
];
