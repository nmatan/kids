/* סופרים ביחד — סופרים את הדברים ולוחצים על המספר. (רמות 1-2)
   הקטנים יכולים ללחוץ על כל פריט ולשמוע אותו נספר בקול. */

import { Round, el, shuffle, range, randInt, FUN_EMOJI, speak, pick, sfx } from '../kit.js';
import { T, num } from '../text.js';

export const meta = {
  id: 'counting',
  title: 'סופרים ביחד',
  emoji: '🔢',
  blurb: 'כמה יש כאן?',
  levels: [1, 2],
};

export function mount(stage, ctx) {
  const little = ctx.profile.level <= 1;
  const max = little ? 5 : 10;
  const round = new Round(stage, ctx, { rounds: little ? 8 : 10, forgiving: little });

  round.start((view, api) => {
    const count = randInt(1, max);
    const emoji = pick(FUN_EMOJI);

    // Answer choices: the true count plus near neighbours, so it stays a
    // counting exercise rather than a guess between wildly different numbers.
    const near = range(max, 1).filter((n) => n !== count && Math.abs(n - count) <= 3);
    const options = shuffle([count, ...shuffle(near).slice(0, 2)]);

    let counted = 0;
    const ask = () => speak('כמה יש?');
    ask();

    const things = el('div', { class: 'dots' },
      range(count).map(() =>
        el('span', {
          onClick: (e) => {
            // Tap-to-count: says "אחת, שתיים, שלוש…" as they poke each one.
            if (e.currentTarget.dataset.done) return;
            e.currentTarget.dataset.done = '1';
            e.currentTarget.style.opacity = '0.45';
            speak(num(++counted), { interrupt: false, rate: 0.85 });
            sfx.tap();
          },
        }, emoji),
      ),
    );

    let rightBtn = null;
    const buttons = options.map((n) => {
      const btn = el('button', {
        class: 'choice big',
        onClick: () => {
          if (n === count) {
            speak(`${num(count)}! נכון מאוד`);
            api.ok(btn);
          } else {
            speak('בואו נספור שוב');
            api.no(btn);
            api.reveal(rightBtn);
          }
        },
      }, String(n));
      if (n === count) rightBtn = btn;
      return btn;
    });

    view.append(
      el('div', { class: 'prompt', onClick: ask },
        'כמה יש?',
        el('small', { text: little ? T.tapToCount : T.tapToHear }),
      ),
      things,
      el('div', { class: 'choices' }, buttons),
    );
  });

  return () => round.stop();
}
