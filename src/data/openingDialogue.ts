import type { DialogueLine } from '../types/game';

// Story prologue: the protagonist receives their father's old fighter, Hajime-kun.
export const OPENING_DIALOGUE: DialogueLine[] = [
  { speaker: '', text: '実家の作業場。古びたガレージの片隅に、布をかぶった一体の機体が置かれている。' },
  { speaker: '父さん', text: 'おい、ちょっとこっちに来なさい。' },
  { speaker: '父さん', text: '技術科に通うんだったな。これを持っていきなさい。' },
  { speaker: '父さん', text: 'このギアフレンドは、父さんが昔使ってた「ハジメくん」というんだ。', emotion: 'smile', effect: 'reveal-hajime' },
  { speaker: '父さん', text: '昔は、こういう人間の顔をしたギアフレンドが流行っていたんだよ。今ではもう珍しいがな。', emotion: 'smile' },
  { speaker: '父さん', text: '型は古いが、ギアの機構自体はまだまだ現役だ。整備すれば十分戦えるはずだぞ。', emotion: 'serious' },
  { speaker: '父さん', text: '父さんは昔、こいつと大会に出て、入賞したこともあるんだからな。', emotion: 'confident' },
  { speaker: '主人公', text: 'え！？　父さんってそんなに強かったの？', emotion: 'surprised' },
  { speaker: '父さん', text: 'まぁ、昔の話だ。', emotion: 'shy' },
  { speaker: '父さん', text: 'だけどな、どうしても勝てない相手がひとりだけいたんだ。', emotion: 'serious' },
  { speaker: '父さん', text: '名前はもう忘れてしまったが……父さんより年下なのに、やけに頭の切れる子でな。', emotion: 'serious' },
  { speaker: '父さん', text: '結局、一度も勝てないまま終わっちまったよ。情けない話だがな。', emotion: 'frustrated' },
  { speaker: '主人公', text: '……これが、父さんの相棒だったギアフレンド……。', emotion: 'serious' },
  { speaker: '父さん', text: 'これからはお前が使ってやってくれ。ハジメくんもきっと喜ぶはずだ。', emotion: 'smile', effect: 'awaken-hajime' },
  { speaker: '主人公', text: 'うん……大事にするよ、父さん。よろしくな、ハジメくん。', emotion: 'smile' },
];
