/* מה יותר סביר? — חשיבה הסתברותית ראשונה. (רמה 3)

   ── איך מסבירים הסתברות לילד בן 7 ────────────────────────────────
   בלי שברים ובלי אחוזים. שני כלים עם גולות צבעוניות שאפשר לספור,
   ושתי שאלות שמכסות את מה שבאמת נלמד בגיל הזה:

   1. השוואה — מאיזה כלי סביר יותר להוציא גולה אדומה? הילד סופר
      ומשווה. הכלים תמיד שונים מספיק כדי שלא יהיה ויכוח.
   2. ודאות — בטוח / אפשרי / בלתי אפשרי. זו השפה שבה מלמדים
      הסתברות בבית ספר יסודי, לפני שמגיעים למספרים.

   הכלים תמיד מצוירים עם כל הגולות גלויות, כי הרעיון הוא לספור
   ולהסיק — לא לנחש. אחרי כל תשובה מוסבר למה. */

import { Round, el, randInt, range, shuffle, speak, wait } from '../kit.js';
import { T } from '../text.js';

export const meta = {
  id: 'chance',
  title: 'מה יותר סביר?',
  emoji: '🎲',
  blurb: 'סופרים גולות וחושבים על סיכויים',
  levels: [3],
};

const TARGET = { name: 'אדומה', cls: 'red' };
const OTHER = { cls: 'blue' };

const jarEl = (reds, blues, label) => el('div', { class: 'jar' },
  el('div', { class: 'jar-label', text: label }),
  el('div', { class: 'marbles' },
    shuffle([
      ...range(reds).map(() => TARGET.cls),
      ...range(blues).map(() => OTHER.cls),
    ]).map((cls) => el('i', { class: `marble ${cls}` })),
  ),
  el('div', { class: 'jar-count', text: `${reds} מתוך ${reds + blues}` }),
);

export function mount(stage, ctx) {
  const round = new Round(stage, ctx, { rounds: 8, pauseOk: 2000, pauseNo: 3000 });

  round.start((view, api) => {
    // Alternate the two ideas so a game covers both.
    const compare = api.index % 2 === 0;

    if (compare) {
      /* --- which jar is more likely to give a red one? --- */
      let a; let b; let ta; let tb;
      do {
        ta = randInt(4, 8); tb = randInt(4, 8);
        a = randInt(1, ta - 1); b = randInt(1, tb - 1);
        // Keep a wide gap: a close call isn't a fair question at seven,
        // and an equal one has no right answer at all.
      } while (Math.abs(a / ta - b / tb) < 0.25);

      const aBetter = a / ta > b / tb;
      const jarA = jarEl(a, ta - a, 'א');
      const jarB = jarEl(b, tb - b, 'ב');
      const why = el('div', { class: 'why' });

      const ask = () => speak('מאיזה כלי יותר סביר להוציא גולה אדומה?', { rate: 0.9 });
      ask();

      const answer = async (pickedA, btn) => {
        const right = pickedA === aBetter;
        why.textContent = `בכלי א יש ${a} אדומות מתוך ${ta}, ובכלי ב יש ${b} מתוך ${tb}`;
        why.classList.add('show');
        if (right) { speak('נכון!'); api.ok(btn); }
        else {
          api.no(btn);
          await wait(400);
          speak(`דווקא בכלי ${aBetter ? 'א' : 'ב'} יותר סביר. ${why.textContent}`, { rate: 0.86 });
        }
      };

      const btnA = el('button', { class: 'choice tf', onClick: () => answer(true, btnA) }, 'כלי א');
      const btnB = el('button', { class: 'choice tf', onClick: () => answer(false, btnB) }, 'כלי ב');

      view.append(
        el('div', { class: 'prompt tight', onClick: ask },
          'מאיזה כלי יותר סביר להוציא גולה אדומה?',
          el('small', { text: T.tapToHear }),
        ),
        el('div', { class: 'jars' }, jarA, jarB),
        el('div', { class: 'choices' }, btnA, btnB),
        why,
      );
      return;
    }

    /* --- certain, possible, or impossible? --- */
    const total = randInt(4, 7);
    const kind = randInt(0, 2); // 0 none, 1 some, 2 all
    const reds = kind === 0 ? 0 : kind === 2 ? total : randInt(1, total - 1);
    const correct = kind === 0 ? 'בלתי אפשרי' : kind === 2 ? 'בטוח' : 'אפשרי';

    const why = el('div', { class: 'why' });
    const ask = () => speak('אם מוציאים גולה אחת בלי להסתכל — לקבל אדומה זה בטוח, אפשרי, או בלתי אפשרי?', { rate: 0.9 });
    ask();

    let rightBtn = null;
    const buttons = ['בטוח', 'אפשרי', 'בלתי אפשרי'].map((label) => {
      const btn = el('button', { class: 'choice tf', onClick: async () => {
        why.textContent = reds === 0
          ? 'אין אף גולה אדומה בכלי, אז אי אפשר להוציא אחת'
          : reds === total
            ? 'כל הגולות בכלי אדומות, אז בטוח תצא אדומה'
            : `יש ${reds} אדומות מתוך ${total}, אז אפשר אבל לא בטוח`;
        why.classList.add('show');
        if (label === correct) { speak('נכון!'); api.ok(btn); }
        else {
          api.no(btn);
          api.reveal(rightBtn);
          await wait(400);
          speak(`התשובה היא ${correct}. ${why.textContent}`, { rate: 0.86 });
        }
      } }, label);
      if (label === correct) rightBtn = btn;
      return btn;
    });

    view.append(
      el('div', { class: 'prompt tight', onClick: ask },
        'מוציאים גולה אחת בלי להסתכל. לקבל אדומה זה...',
        el('small', { text: T.tapToHear }),
      ),
      el('div', { class: 'jars' }, jarEl(reds, total - reds, '')),
      el('div', { class: 'choices' }, buttons),
      why,
    );
  });

  return () => round.stop();
}
