/* מה יותר סביר? — חשיבה הסתברותית ראשונה. (רמה 3)

   ── איך מסבירים הסתברות לילד בן 7 ────────────────────────────────
   בלי שברים ובלי אחוזים. שני כלים עם כדורים צבעוניים שאפשר לספור,
   ושתי שאלות שמכסות את מה שבאמת נלמד בגיל הזה:

   1. השוואה — מאיזה כלי יותר סביר להוציא כדור בצבע מסוים.
   2. סיווג — בטוח / סביר / לא סביר / בלתי אפשרי. זו השפה שבה מלמדים
      הסתברות ביסודי, לפני שמגיעים למספרים.

   ── שני דברים שנעשו בכוונה ───────────────────────────────────────
   מחצית מסבבי ההשוואה הם "מלכודת": בכלי אחד יש יותר כדורים בצבע
   המבוקש, אבל דווקא בכלי השני הסיכוי גדול יותר — כי שם יש פחות
   כדורים בסך הכל. בלי זה המשחק הוא ספירה בלבד; עם זה צריך להבין
   שמה שקובע הוא היחס ולא הכמות. זה כל הרעיון.

   הצבע המבוקש מתחלף בכל סבב, כדי שהילד לא ילמד "תמיד ללחוץ על
   הכלי עם הכי הרבה אדומים".

   הכדורים תמיד גלויים כדי שאפשר יהיה לספור, אף פעם לא בדיוק חצי
   (כי אז אין תשובה נכונה), והפער בין הכלים תמיד גדול מספיק. */

import { Round, el, randInt, range, shuffle, pick, speak, wait } from '../kit.js';
import { T } from '../text.js';

export const meta = {
  id: 'chance',
  title: 'מה יותר סביר?',
  emoji: '🎲',
  blurb: 'סופרים כדורים וחושבים על סיכויים',
  levels: [3],
};

/* Masculine adjectives — they agree with כדור. */
const COLORS = [
  { id: 'red', one: 'אדום', many: 'אדומים' },
  { id: 'blue', one: 'כחול', many: 'כחולים' },
  { id: 'green', one: 'ירוק', many: 'ירוקים' },
  { id: 'yellow', one: 'צהוב', many: 'צהובים' },
];

const MIN_GAP = 0.25; // a closer call isn't a fair question at seven

/**
 * Two jars worth comparing.
 *
 * `tricky` asks for the case that teaches the actual idea: one jar holds
 * MORE of the wanted colour yet is LESS likely, because it holds more
 * balls overall. Without those the game is just "count the reds".
 */
function makePair(tricky) {
  for (let i = 0; i < 600; i++) {
    const ta = randInt(3, 9);
    const tb = randInt(3, 9);
    const a = randInt(1, ta - 1);
    const b = randInt(1, tb - 1);
    if (a === b) continue;               // no "more" jar to be misled by
    if (Math.abs(a / ta - b / tb) < MIN_GAP) continue;

    const moreCountIsA = a > b;
    const betterOddsIsA = a / ta > b / tb;
    if (tricky ? moreCountIsA !== betterOddsIsA : moreCountIsA === betterOddsIsA) {
      return { a, ta, b, tb, betterOddsIsA };
    }
  }
  // Search never fails in practice, but never ship a round that can't draw.
  return tricky
    ? { a: 4, ta: 9, b: 3, tb: 4, betterOddsIsA: false }
    : { a: 4, ta: 5, b: 1, tb: 4, betterOddsIsA: true };
}

const jarEl = (want, wanted, total, label) => el('div', { class: 'jar' },
  el('div', { class: 'jar-label', text: label }),
  el('div', { class: 'marbles' },
    shuffle([
      ...range(wanted).map(() => want.id),
      ...range(total - wanted).map(() => 'other'),
    ]).map((cls) => el('i', { class: `marble ${cls === 'other' ? 'plain' : cls}` })),
  ),
  el('div', { class: 'jar-count', text: `${wanted} מתוך ${total}` }),
);

export function mount(stage, ctx) {
  const round = new Round(stage, ctx, { rounds: 8, pauseOk: 2000, pauseNo: 3200 });
  // Which comparison round is a trap alternates, so exactly half of them
  // are — but the phase flips per game, so it's never "the third one is
  // always the sneaky one".
  const phase = Math.random() < 0.5 ? 0 : 2;

  round.start((view, api) => {
    const want = pick(COLORS);            // a different colour each round
    const compare = api.index % 2 === 0;

    if (compare) {
      const tricky = (api.index + phase) % 4 === 2;
      const { a, ta, b, tb, betterOddsIsA } = makePair(tricky);
      const why = el('div', { class: 'why' });

      const question = `מאיזה כלי יותר סביר להוציא כדור ${want.one}?`;
      const ask = () => speak(question, { rate: 0.9 });
      ask();

      const explain = `בכלי א יש ${a} ${want.many} מתוך ${ta}, ובכלי ב יש ${b} מתוך ${tb}`;

      const answer = async (pickedA, btn) => {
        why.textContent = explain;
        why.classList.add('show');
        if (pickedA === betterOddsIsA) {
          speak('נכון!');
          api.ok(btn);
        } else {
          api.no(btn);
          await wait(400);
          speak(`דווקא בכלי ${betterOddsIsA ? 'א' : 'ב'}. ${explain}`, { rate: 0.86 });
        }
      };

      const btnA = el('button', { class: 'choice tf', onClick: () => answer(true, btnA) }, 'כלי א');
      const btnB = el('button', { class: 'choice tf', onClick: () => answer(false, btnB) }, 'כלי ב');

      view.append(
        el('div', { class: 'prompt tight', onClick: ask }, question,
          el('small', { text: T.tapToHear })),
        el('div', { class: 'jars' },
          jarEl(want, a, ta, 'א'),
          jarEl(want, b, tb, 'ב'),
        ),
        el('div', { class: 'choices' }, btnA, btnB),
        why,
      );
      return;
    }

    /* --- certain / likely / unlikely / impossible --- */

    const total = randInt(4, 8);
    const half = total / 2;
    const kind = randInt(0, 3);
    // Never exactly half: at 50/50 neither סביר nor לא סביר is right.
    const wanted = [
      0,
      randInt(1, Math.ceil(half) - 1),        // fewer than half → לא סביר
      randInt(Math.floor(half) + 1, total - 1), // more than half → סביר
      total,
    ][kind];
    const correct = ['בלתי אפשרי', 'לא סביר', 'סביר', 'בטוח'][kind];

    const explain = [
      `אין אף כדור ${want.one} בכלי, אז אי אפשר להוציא אחד`,
      `יש רק ${wanted} ${want.many} מתוך ${total} — פחות מחצי, אז זה לא סביר`,
      `יש ${wanted} ${want.many} מתוך ${total} — יותר מחצי, אז זה סביר`,
      `כל ${total} הכדורים בכלי ${want.many}, אז בטוח יצא ${want.one}`,
    ][kind];

    const why = el('div', { class: 'why' });
    const question = `מוציאים כדור אחד בלי להסתכל. לקבל כדור ${want.one} זה...`;
    const ask = () => speak(`${question} בטוח, סביר, לא סביר, או בלתי אפשרי?`, { rate: 0.9 });
    ask();

    let rightBtn = null;
    const buttons = ['בטוח', 'סביר', 'לא סביר', 'בלתי אפשרי'].map((label) => {
      const btn = el('button', { class: 'choice tf four', onClick: async () => {
        why.textContent = explain;
        why.classList.add('show');
        if (label === correct) {
          speak('נכון!');
          api.ok(btn);
        } else {
          api.no(btn);
          api.reveal(rightBtn);
          await wait(400);
          speak(`התשובה היא ${correct}. ${explain}`, { rate: 0.86 });
        }
      } }, label);
      if (label === correct) rightBtn = btn;
      return btn;
    });

    view.append(
      el('div', { class: 'prompt tight', onClick: ask }, question,
        el('small', { text: T.tapToHear })),
      el('div', { class: 'jars' }, jarEl(want, wanted, total, '')),
      el('div', { class: 'choices' }, buttons),
      why,
    );
  });

  return () => round.stop();
}
