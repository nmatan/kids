/* אותיות — מזהים אות, ואז מוצאים באיזו אות מתחילה מילה. (רמה 2) */

import { Round, el, choicesFor, speak, pick, wait } from '../kit.js';
import { T } from '../text.js';

export const meta = {
  id: 'letters',
  title: 'אותיות',
  emoji: '🔤',
  blurb: 'האותיות והצלילים שלהן',
  levels: [2],
};

/* כל האלף-בית, עם שם האות ומילה אחת ברורה שמתחילה בה.
   ✏️ אפשר להחליף את מילות הדוגמה במילים שהם לומדים בגן/בבית ספר. */
const LETTERS = [
  { l: 'א', name: 'אָלֶף', word: 'אריה', emoji: '🦁' },
  { l: 'ב', name: 'בֵּית', word: 'בית', emoji: '🏠' },
  { l: 'ג', name: 'גִימֶל', word: 'גמל', emoji: '🐫' },
  { l: 'ד', name: 'דָלֶת', word: 'דג', emoji: '🐟' },
  { l: 'ה', name: 'הֵא', word: 'הר', emoji: '⛰️' },
  { l: 'ו', name: 'וָו', word: 'ורד', emoji: '🌹' },
  { l: 'ז', name: 'זַיִן', word: 'זברה', emoji: '🦓' },
  { l: 'ח', name: 'חֵית', word: 'חתול', emoji: '🐱' },
  { l: 'ט', name: 'טֵית', word: 'טווס', emoji: '🦚' },
  { l: 'י', name: 'יוֹד', word: 'ילד', emoji: '🧒' },
  { l: 'כ', name: 'כַּף', word: 'כלב', emoji: '🐶' },
  { l: 'ל', name: 'לָמֶד', word: 'לימון', emoji: '🍋' },
  { l: 'מ', name: 'מֵם', word: 'מים', emoji: '💧' },
  { l: 'נ', name: 'נוּן', word: 'נעל', emoji: '👟' },
  { l: 'ס', name: 'סָמֶך', word: 'סוס', emoji: '🐴' },
  { l: 'ע', name: 'עַיִן', word: 'עץ', emoji: '🌳' },
  { l: 'פ', name: 'פֵּא', word: 'פיל', emoji: '🐘' },
  { l: 'צ', name: 'צָדִי', word: 'ציפור', emoji: '🐦' },
  { l: 'ק', name: 'קוֹף', word: 'קוף', emoji: '🐵' },
  { l: 'ר', name: 'רֵישׁ', word: 'רכבת', emoji: '🚂' },
  { l: 'ש', name: 'שִׁין', word: 'שמש', emoji: '☀️' },
  { l: 'ת', name: 'תָו', word: 'תות', emoji: '🍓' },
];

export function mount(stage, ctx) {
  const round = new Round(stage, ctx, { rounds: 10, pauseOk: 1300, pauseNo: 1600 });

  round.start((view, api) => {
    const answer = pick(LETTERS);
    const options = choicesFor(answer, LETTERS, 3, (x) => x.l);
    // חצי ראשון: לזהות את האות. חצי שני: באיזו אות מתחילה המילה.
    const soundMode = api.index >= 5;

    const ask = () =>
      soundMode
        ? speak(`באיזו אות מתחילה המילה ${answer.word}?`)
        : speak(`מצאו את האות ${answer.name}`);
    ask();

    let rightBtn = null;
    const buttons = options.map((opt) => {
      const btn = el('button', { class: 'choice big', onClick: async () => {
        if (opt.l === answer.l) {
          speak(`${answer.name}. ${answer.word}`, { rate: 0.8 });
          api.ok(btn);
        } else {
          api.no(btn);
          api.reveal(rightBtn);
          await wait(300);
          speak(`זאת ${answer.name}, כמו ${answer.word}`, { rate: 0.85 });
        }
      } }, opt.l);
      if (opt.l === answer.l) rightBtn = btn;
      return btn;
    });

    view.append(
      el('div', { class: 'prompt', onClick: ask },
        soundMode
          ? `${answer.emoji} באיזו אות מתחילה המילה "${answer.word}"?`
          : `מצאו את האות ${answer.name}`,
        el('small', { text: T.tapToHear }),
      ),
      el('div', { class: 'choices' }, buttons),
    );
  });

  return () => round.stop();
}
