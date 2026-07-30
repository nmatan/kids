/* לוח הכפל — תרגול כפל. (רמה 3)
   ✏️ אפשר לצמצם את TABLES ללוחות שהוא לומד השבוע בבית הספר. */

import { Round, el, shuffle, randInt, speak } from '../kit.js';
import { T } from '../text.js';

export const meta = {
  id: 'times',
  title: 'לוח הכפל',
  emoji: '✖️',
  blurb: 'תרגול כפל',
  levels: [3],
};

const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10];

export function mount(stage, ctx) {
  const round = new Round(stage, ctx, { rounds: 12, pauseOk: 700, pauseNo: 1600 });

  round.start((view, api) => {
    const a = TABLES[randInt(0, TABLES.length - 1)];
    const b = randInt(2, 10);
    const answer = a * b;

    // Distractors are the classic near-misses: off-by-one-row, and a
    // transposed-digit trap. Far-off numbers would be too easy to rule out.
    const candidates = new Set([
      a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, answer + 10, answer - 10,
    ]);
    candidates.delete(answer);
    const wrongs = shuffle([...candidates].filter((n) => n > 0)).slice(0, 3);
    const options = shuffle([answer, ...wrongs]);

    const ask = () => speak(`${a} כפול ${b}`);

    let rightBtn = null;
    const buttons = options.map((n) => {
      const btn = el('button', { class: 'choice', onClick: () => {
        if (n === answer) {
          api.ok(btn);
        } else {
          api.no(btn);
          api.reveal(rightBtn);
          speak(`${a} כפול ${b} שווה ${answer}`, { rate: 0.85 });
        }
      } }, String(n));
      if (n === answer) rightBtn = btn;
      return btn;
    });

    view.append(
      el('div', { class: 'prompt ltr', onClick: ask },
        `${a} × ${b} = ?`,
        el('small', { class: 'rtl', text: T.tapToHear }),
      ),
      el('div', { class: 'choices' }, buttons),
    );
  });

  return () => round.stop();
}
