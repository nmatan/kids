/* צורות — שומעים שם של צורה ולוחצים עליה. (רמה 1)
   הצורות מצוירות ב-CSS ומקבלות צבע אקראי בכל סיבוב, כדי שהצבע
   לא יהפוך לרמז והילד באמת יסתכל על הצורה. */

import { Round, el, choicesFor, speak, pick, shuffle, wait } from '../kit.js';
import { T } from '../text.js';

export const meta = {
  id: 'shapes',
  title: 'צורות',
  emoji: '🔷',
  blurb: 'מוצאים את הצורה ששמעתם',
  levels: [1],
};

const SHAPES = [
  { name: 'עיגול', cls: 'circle' },
  { name: 'ריבוע', cls: 'square' },
  { name: 'משולש', cls: 'triangle' },
  { name: 'כוכב', cls: 'star' },
  { name: 'מעוין', cls: 'diamond' },
  { name: 'מלבן', cls: 'rect' },
];

const HUES = ['#ff4d4d', '#3d8bff', '#ffd23f', '#37d67a', '#ff9f1c', '#a06bff', '#ff7ac4'];

export function mount(stage, ctx) {
  const round = new Round(stage, ctx, { rounds: 8, forgiving: true, pauseOk: 1200 });

  round.start((view, api) => {
    const answer = pick(SHAPES);
    const options = choicesFor(answer, SHAPES, 3, (s) => s.name);
    const colors = shuffle(HUES).slice(0, options.length);

    const ask = () => speak(`איפה ה${answer.name}?`);
    ask();

    view.append(
      el('div', { class: 'prompt', onClick: ask },
        `איפה ה${answer.name}?`,
        el('small', { text: T.tapToHear }),
      ),
      el('div', { class: 'choices' },
        options.map((shape, i) =>
          el('button', {
            class: 'choice shape-btn',
            'aria-label': shape.name,
            onClick: async (e) => {
              const btn = e.currentTarget;
              if (shape.name === answer.name) {
                speak(`${answer.name}! כל הכבוד`);
                api.ok(btn);
              } else {
                speak(`זה ${shape.name}`);
                api.no(btn);
                await wait(1000);
                ask();
              }
            },
          }, el('i', { class: `shape ${shape.cls}`, style: { background: colors[i] } })),
        ),
      ),
    );
  });

  return () => round.stop();
}
