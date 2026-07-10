import type { DialogueLine } from '../types/game';

// Story prologue: the protagonist receives their father's old fighter, Hajime-kun.
export const OPENING_DIALOGUE: DialogueLine[] = [
  { speaker: '', text: '実家の作業場。古びたガレージの片隅に、布をかぶった一体の機体が置かれている。' },
  { speaker: '父さん', text: 'おい、ちょっとこっちに来なさい。' },
  { speaker: '父さん', text: '技術科に通うんだったな。これを持っていきなさい。' },
  { speaker: '父さん', text: 'このギアフレンドは、父さんが昔使ってた「ハジメくん」というんだ。', effect: 'reveal-hajime' },
  { speaker: '父さん', text: '昔は、こういう人間の顔をしたギアフレンドが流行っていたんだよ。今ではもう珍しいがな。' },
  { speaker: '父さん', text: '型は古いが、ギアの機構自体はまだまだ現役だ。整備すれば十分戦えるはずだぞ。' },
  { speaker: '父さん', text: '父さんは昔、こいつと大会に出て、入賞したこともあるんだからな。' },
  { speaker: '主人公', text: 'え！？　父さんってそんなに強かったの？' },
  { speaker: '父さん', text: 'まぁ、昔の話だ。' },
  { speaker: '父さん', text: 'だけどな、どうしても勝てない相手がひとりだけいたんだ。' },
  { speaker: '父さん', text: '名前はもう忘れてしまったが……父さんより年下なのに、やけに頭の切れる子でな。' },
  { speaker: '父さん', text: '結局、一度も勝てないまま終わっちまったよ。情けない話だがな。' },
  { speaker: '主人公', text: '……これが、父さんの相棒だったギアフレンド……。' },
  { speaker: '父さん', text: 'これからはお前が使ってやってくれ。ハジメくんもきっと喜ぶはずだ。', effect: 'awaken-hajime' },
  { speaker: '主人公', text: 'うん……大事にするよ、父さん。よろしくな、ハジメくん。' },
];
