/* מרכיבים מילה — שומעים מילה ולוחצים על האותיות לפי הסדר. (רמה 3)
   ✏️ WORDS זו סתם רשימה — אפשר להחליף במילים של השבוע מבית הספר. */

import { Round, el, shuffle, pick, speak, sfx, vibrate, wait } from '../kit.js';
import { T } from '../text.js';

export const meta = {
  id: 'spelling',
  title: 'מרכיבים מילה',
  emoji: '✏️',
  blurb: 'שומעים מילה ובונים אותה',
  levels: [3],
};

/* מילים קצרות ומוחשיות, בלי ניקוד. אותיות סופיות (ם ן ץ ך ף)
   יוצאות מהמילה מעצמן — וזה בדיוק מה שכדאי שיתרגלו. */
const WORDS = [
  ['בית', '🏠'], ['כלב', '🐶'], ['חתול', '🐱'], ['שמש', '☀️'], ['ילד', '🧒'],
  ['ספר', '📖'], ['עץ', '🌳'], ['פרח', '🌸'], ['דג', '🐟'], ['סוס', '🐴'],
  ['מים', '💧'], ['לחם', '🍞'], ['תפוח', '🍎'], ['בננה', '🍌'], ['אוטו', '🚗'],
  ['כדור', '⚽'], ['כיסא', '🪑'], ['דלת', '🚪'], ['חלון', '🪟'], ['ירח', '🌙'],
  ['כוכב', '⭐'], ['גשם', '🌧️'], ['פיל', '🐘'], ['ארנב', '🐰'], ['ציפור', '🐦'],
  ['נעל', '👟'], ['כובע', '🎩'], ['עוגה', '🍰'], ['פרפר', '🦋'], ['גלידה', '🍦'],
  ['רכבת', '🚂'], ['מטוס', '✈️'], ['בלון', '🎈'], ['ענן', '☁️'], ['צב', '🐢'],
  ['תות', '🍓'], ['גזר', '🥕'], ['נמלה', '🐜'], ['חולצה', '👕'], ['שולחן', '🪑'],
];

/** אותיות מסיחות, כדי ששורת האריחים לא תהיה בדיוק המילה. */
const FILLER = 'אבגדהוזחטיכלמנסעפצקרשת';

export function mount(stage, ctx) {
  const round = new Round(stage, ctx, { rounds: 8, pauseOk: 1100, pauseNo: 1600 });

  round.start((view, api) => {
    const [word, emoji] = pick(WORDS);
    const letters = [...word];
    const extras = shuffle([...FILLER].filter((c) => !letters.includes(c))).slice(0, 3);
    const tiles = shuffle([...letters, ...extras]);

    let placed = 0;
    let missed = false;

    const ask = () => speak(word, { rate: 0.7 });
    ask();

    // dir=rtl on the row means slot 0 is the RIGHTMOST — Hebrew reading order.
    const slots = el('div', { class: 'slots' },
      letters.map(() => el('span', { class: 'slot' })),
    );

    const tileRow = el('div', { class: 'choices' });

    tiles.forEach((letter) => {
      const tile = el('button', { class: 'choice tile', onClick: async () => {
        if (placed >= letters.length) return;

        if (letter === letters[placed]) {
          slots.children[placed].textContent = letter;
          slots.children[placed].classList.add('filled');
          placed++;
          tile.disabled = true;
          tile.classList.add('used');
          sfx.tap();

          if (placed === letters.length) {
            if (missed) {
              speak(`${word}. כמעט!`, { rate: 0.8 });
              api.no();
            } else {
              speak(`${word}. מעולה!`, { rate: 0.8 });
              api.ok();
            }
          }
        } else {
          missed = true;
          sfx.wrong();
          vibrate([10, 50, 10]);
          tile.classList.add('shake');
          await wait(360);
          tile.classList.remove('shake');
        }
      } }, letter);
      tileRow.append(tile);
    });

    view.append(
      el('div', { class: 'prompt', onClick: ask, style: { fontSize: 'clamp(28px, 7vw, 64px)' } },
        emoji,
        el('small', { text: T.tapToHear }),
      ),
      slots,
      tileRow,
    );
  });

  return () => round.stop();
}
