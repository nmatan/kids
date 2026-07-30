/* חיבור וחיסור — תרגילים עד 10, עם ציורים לספירה. (רמה 2) */

import { Round, el, shuffle, randInt, range, speak, pick, FUN_EMOJI } from '../kit.js';
import { T, num } from '../text.js';

export const meta = {
  id: 'addsub',
  title: 'חיבור וחיסור',
  emoji: '➕',
  blurb: 'ועוד ופחות עד 10',
  levels: [2],
};

export function mount(stage, ctx) {
  const round = new Round(stage, ctx, { rounds: 10, pauseOk: 1000 });

  round.start((view, api) => {
    const plus = api.index % 2 === 0; // alternate + and - so both get practice
    const emoji = pick(FUN_EMOJI);

    let a, b, answer;
    if (plus) {
      a = randInt(1, 5);
      b = randInt(1, 10 - a);
      answer = a + b;
    } else {
      a = randInt(2, 10);
      b = randInt(1, a);
      answer = a - b;
    }

    const wrongs = shuffle(range(11).filter((n) => n !== answer && Math.abs(n - answer) <= 3));
    const options = shuffle([answer, ...wrongs.slice(0, 2)]);

    const sum = `${num(a)} ${plus ? 'ועוד' : 'פחות'} ${num(b)}`;
    const ask = () => speak(`${sum}. כמה זה?`);
    ask();

    // Visual aid: `a` solid things, then the ones being added or removed.
    const picture = el('div', { class: 'dots' },
      range(a).map(() => el('span', {}, emoji)),
      el('span', { style: { opacity: '0.55' } }, plus ? '➕' : '➖'),
      range(b).map(() =>
        el('span', { style: plus ? {} : { opacity: '0.3', filter: 'grayscale(1)' } }, emoji),
      ),
    );

    let rightBtn = null;
    const buttons = options.map((n) => {
      const btn = el('button', { class: 'choice big', onClick: () => {
        if (n === answer) {
          speak(`${sum} שווה ${num(answer)}`, { rate: 0.85 });
          api.ok(btn);
        } else {
          api.no(btn);
          api.reveal(rightBtn);
          speak(`${sum} שווה ${num(answer)}`, { rate: 0.85 });
        }
      } }, String(n));
      if (n === answer) rightBtn = btn;
      return btn;
    });

    view.append(
      // Equations stay left-to-right — that's how maths is written in Israel too.
      el('div', { class: 'prompt ltr', onClick: ask },
        `${a} ${plus ? '+' : '−'} ${b} = ?`,
        el('small', { class: 'rtl', text: T.tapToHear }),
      ),
      picture,
      el('div', { class: 'choices' }, buttons),
    );
  });

  return () => round.stop();
}
