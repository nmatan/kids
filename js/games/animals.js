/* חברים מהחווה — שומעים שם של חיה, לוחצים עליה. (רמה 1) */

import { Round, el, choicesFor, ANIMALS, speak, pick, wait } from '../kit.js';
import { T } from '../text.js';

export const meta = {
  id: 'animals',
  title: 'חברים מהחווה',
  emoji: '🐮',
  blurb: 'מצאו את החיה ששמעתם',
  levels: [1],
};

export function mount(stage, ctx) {
  const round = new Round(stage, ctx, { rounds: 8, forgiving: true, pauseOk: 1400 });

  round.start((view, api) => {
    const answer = pick(ANIMALS);
    const options = choicesFor(answer, ANIMALS, 3, (a) => a.name);

    const ask = () => speak(`איפה ה${answer.name}?`);
    ask();

    view.append(
      el('div', { class: 'prompt', onClick: ask },
        `איפה ה${answer.name}?`,
        el('small', { text: T.tapToHear }),
      ),
      el('div', { class: 'choices' },
        options.map((animal) =>
          el('button', {
            class: 'choice big',
            'aria-label': animal.name,
            onClick: async (e) => {
              const btn = e.currentTarget;
              if (animal.name === answer.name) {
                speak(`${answer.name}! ${answer.says}`, { rate: 0.85 });
                api.ok(btn);
              } else {
                speak(`זה ${animal.name}`);
                api.no(btn);
                await wait(1100);
                ask();
              }
            },
          }, animal.emoji),
        ),
      ),
    );
  });

  return () => round.stop();
}
