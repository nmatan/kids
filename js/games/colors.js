/* צבעים — שומעים צבע, לוחצים עליו. (רמה 1) */

import { Round, el, choicesFor, COLORS, speak, pick, wait } from '../kit.js';
import { T } from '../text.js';

export const meta = {
  id: 'colors',
  title: 'צבעים',
  emoji: '🎨',
  blurb: 'לחצו על הצבע ששמעתם',
  levels: [1],
};

/* The first six read most clearly to a toddler; the rest come in later rounds. */
const EASY = COLORS.slice(0, 6);

export function mount(stage, ctx) {
  const round = new Round(stage, ctx, { rounds: 8, forgiving: true, pauseOk: 1200 });

  round.start((view, api) => {
    const pool = api.index < 4 ? EASY : COLORS;
    const answer = pick(pool);
    const options = choicesFor(answer, pool, 3, (c) => c.name);

    const ask = () => speak(`איפה הצבע ה${answer.name}?`);
    ask();

    view.append(
      el('div', { class: 'prompt', onClick: ask },
        'איפה הצבע ',
        el('span', { style: { color: answer.hex }, text: `ה${answer.name}` }),
        '?',
        el('small', { text: T.tapToHear }),
      ),
      el('div', { class: 'choices' },
        options.map((color) =>
          el('button', {
            class: 'choice',
            'aria-label': color.name,
            style: {
              background: color.hex,
              width: 'clamp(96px, 22vw, 170px)',
              height: 'clamp(96px, 22vw, 170px)',
              borderRadius: '50%',
            },
            onClick: async (e) => {
              const btn = e.currentTarget;
              if (color.name === answer.name) {
                speak(`${answer.name}! כל הכבוד`);
                api.ok(btn);
              } else {
                speak(`זה ${color.name}`);
                api.no(btn);
                await wait(1000);
                ask();
              }
            },
          }),
        ),
      ),
    );
  });

  return () => round.stop();
}
