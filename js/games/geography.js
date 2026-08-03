/* איפה בעולם? — למצוא מדינה על מפת העולם. (רמות 2-3)

   כמה סימנים מופיעים על המפה וצריך ללחוץ על הנכון. אמיתי מקבל 3
   אפשרויות, אביתר 5. טעות מדליקה את הסימן הנכון ואומרת את שמו,
   כדי שגם טעות תלמד משהו.

   המפה היא הטלה שטוחה פשוטה: x = קו אורך + 180, y = 90 - קו רוחב. */

import { Round, el, sample, pick, speak, wait } from '../kit.js';
import { countriesFor, LAND_PATHS, positionOf } from '../countries.js';
import { T } from '../text.js';

export const meta = {
  id: 'geography',
  title: 'איפה בעולם?',
  emoji: '🌍',
  blurb: 'מוצאים את המדינה על המפה',
  levels: [2, 3],
};

const SVG = 'http://www.w3.org/2000/svg';

function worldMap() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 360 180');
  svg.setAttribute('class', 'world');
  svg.setAttribute('aria-hidden', 'true');

  for (const d of LAND_PATHS) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'land');
    svg.append(path);
  }
  return svg;
}

export function mount(stage, ctx) {
  const pool = countriesFor(ctx.profile.level);
  const markers = ctx.profile.level >= 3 ? 5 : 3;
  const round = new Round(stage, ctx, { rounds: 10, pauseOk: 1500, pauseNo: 2800 });

  round.start((view, api) => {
    const answer = pick(pool);
    const others = sample(pool.filter((c) => c.he !== answer.he), markers - 1);
    const shown = [answer, ...others];

    const ask = () => speak(`איפה נמצאת ${answer.he}?`);
    ask();

    const map = el('div', { class: 'map-wrap' }, worldMap());
    let rightPin = null;

    shown.forEach((country) => {
      const at = positionOf(country);
      const pin = el('button', {
        class: 'pin',
        'aria-label': country.he,
        style: { left: `${at.left}%`, top: `${at.top}%` },
        onClick: async () => {
          if (country.he === answer.he) {
            pin.classList.add('right');
            speak(`${answer.he}! נכון`, { rate: 0.9 });
            api.ok(pin);
          } else {
            pin.classList.add('miss');
            api.no(pin);
            // Light up where it actually was, and say it.
            rightPin.classList.add('right', 'reveal');
            await wait(400);
            speak(`${answer.he} נמצאת כאן`, { rate: 0.85 });
          }
        },
      });
      if (country.he === answer.he) rightPin = pin;
      map.append(pin);
    });

    view.append(
      el('div', { class: 'prompt tight', onClick: ask },
        `איפה נמצאת ${answer.he}?`,
        el('small', { text: T.tapToHear }),
      ),
      map,
    );
  });

  return () => round.stop();
}
