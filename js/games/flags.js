/* דגלים — מזהים דגלים של מדינות מרכזיות. (רמות 2-3)

   טעות תמיד מראה את התשובה הנכונה ואומרת אותה בקול — המטרה היא
   ללמוד את הדגל, לא להיענש על הניחוש.

   ✏️ המדינות מגיעות מ-js/countries.js, משותף עם "איפה בעולם?". */

import { Round, el, choicesFor, pick, speak, wait } from '../kit.js';
import { countriesFor } from '../countries.js';
import { T } from '../text.js';

export const meta = {
  id: 'flags',
  title: 'דגלים',
  emoji: '🚩',
  blurb: 'של איזו מדינה הדגל?',
  levels: [2, 3],
};

export function mount(stage, ctx) {
  const pool = countriesFor(ctx.profile.level);
  const round = new Round(stage, ctx, { rounds: 10, pauseOk: 1300, pauseNo: 2600 });

  round.start((view, api) => {
    const answer = pick(pool);
    const options = choicesFor(answer, pool, 3, (c) => c.he);
    // Second half flips it: given the country, find its flag.
    const findFlag = ctx.profile.level >= 3 && api.index >= 5;

    const ask = () => speak(findFlag ? `איפה הדגל של ${answer.he}?` : 'של איזו מדינה הדגל הזה?');
    ask();

    let rightBtn = null;

    /** Wrong answers reveal the right one and name it out loud. */
    const wrong = async (btn) => {
      api.no(btn);
      api.reveal(rightBtn);
      await wait(400);
      speak(`זה הדגל של ${answer.he}`, { rate: 0.85 });
    };

    if (findFlag) {
      const buttons = options.map((c) => {
        const btn = el('button', { class: 'choice flag-choice', 'aria-label': c.he, onClick: () => {
          if (c.he === answer.he) { speak(`${answer.he}! נכון`); api.ok(btn); } else wrong(btn);
        } }, c.flag);
        if (c.he === answer.he) rightBtn = btn;
        return btn;
      });

      view.append(
        el('div', { class: 'prompt', onClick: ask },
          `איפה הדגל של ${answer.he}?`,
          el('small', { text: T.tapToHear }),
        ),
        el('div', { class: 'choices' }, buttons),
      );
      return;
    }

    const buttons = options.map((c) => {
      const btn = el('button', { class: 'choice country-choice', onClick: () => {
        if (c.he === answer.he) { speak(`${answer.he}! נכון`); api.ok(btn); } else wrong(btn);
      } }, c.he);
      if (c.he === answer.he) rightBtn = btn;
      return btn;
    });

    view.append(
      el('div', { class: 'prompt tight', onClick: ask },
        'של איזו מדינה הדגל הזה?',
        el('small', { text: T.tapToHear }),
      ),
      el('div', { class: 'big-flag', text: answer.flag }),
      el('div', { class: 'choices column' }, buttons),
    );
  });

  return () => round.stop();
}
