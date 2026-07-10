import type { DialogueLine } from '../types/game';

// Final chapter: the protagonist doesn't recognize his estranged childhood
// rival Rei behind OmegaNova until partway through the pre-battle exchange.
export const FINAL_CHAPTER_INTRO: DialogueLine[] = [
  { speaker: '', text: 'ギアポリス杯・決勝の舞台。会場の空気が張り詰めている。' },
  { speaker: '', text: '対戦相手は、黒く禍々しいギアフレンド「オメガノヴァ」を従えた一人の青年。' },
  { speaker: '謎の青年', text: '……揃ったか。さっさと始めよう。', emotion: 'serious' },
  { speaker: '主人公', text: '（この人……どこかで見たことがある気がする……）', emotion: 'serious' },
  { speaker: '主人公', text: 'あの、前にどこかで会ったこと、なかったか……？' },
  { speaker: '謎の青年', text: '関係ない。オレはただ、勝つためにここにいる。', emotion: 'angry' },
  { speaker: '主人公', text: 'その声、その言い方……まさか……レイ！？', emotion: 'surprised' },
  { speaker: 'レイ', text: '……久しぶりだな。', emotion: 'serious' },
  { speaker: '主人公', text: '本当にレイなのか？　昔、一緒にロボットを作って戦わせてた……', emotion: 'surprised' },
  { speaker: 'レイ', text: '昔の話だ。今のオレは、勝つことしか考えていない。', emotion: 'angry' },
  { speaker: 'レイ', text: '行くぞ。手加減はしない。', emotion: 'angry' },
];

export const FINAL_CHAPTER_VICTORY: DialogueLine[] = [
  { speaker: '', text: 'オメガノヴァが膝をつき、機能を停止する。' },
  { speaker: 'レイ', text: '……負けた、のか。', emotion: 'shy' },
  { speaker: 'レイ', text: 'おかしいな……昔は、負けても悔しいだけだったのに。', emotion: 'frustrated' },
  { speaker: 'レイ', text: '今は、なぜか……少しだけ、清々しい。', emotion: 'smile' },
  { speaker: '主人公', text: 'レイ……', emotion: 'serious' },
  { speaker: 'レイ', text: 'わかったよ。オレが負けたのは、ギアフレンドの性能じゃない。', emotion: 'serious' },
  { speaker: 'レイ', text: '勝つことばかり考えて、楽しむ心を忘れていたからだ。', emotion: 'frustrated' },
  { speaker: 'レイ', text: 'お前と戦って、思い出した。昔は、ただ純粋にロボットを動かすのが楽しかったんだよな。', emotion: 'smile' },
  { speaker: '主人公', text: 'うん。おれも同じだよ。', emotion: 'smile' },
  { speaker: 'レイ', text: '……もう一度、楽しんでいいのかな。', emotion: 'shy' },
  { speaker: '主人公', text: '当たり前だろ。おれたち、まだライバルなんだから。', emotion: 'confident' },
  { speaker: 'レイ', text: '……そうだな。', emotion: 'smile' },
];
