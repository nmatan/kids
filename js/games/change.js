/* כמה עודף? — קונים משהו, משלמים בשטר גדול, ומרכיבים את העודף. (רמה 3)

   ההמשך הטבעי של "לשלם בחנות": שם מרכיבים סכום, כאן צריך קודם לחשב
   כמה חסר ואז להרכיב אותו. זה חיסור אמיתי עם מספרים לא עגולים, אבל
   בהקשר שילד מכיר מהחיים — הקופאית מחזירה עודף.

   המחיר והתשלום נבחרים כך שהעודף תמיד ניתן להרכבה בעד 3 פריטים.
   מטבעות ושטרות משותפים עם money.js, כדי שאותו ₪5 ייראה אותו דבר. */

import { Round, el, clear, pick, randInt, speak, sfx, vibrate } from '../kit.js';
import { MONEY, byValue, shekels, moneyNode } from './money.js';
import { T } from '../text.js';

export const meta = {
  id: 'change',
  title: 'כמה עודף?',
  emoji: '💵',
  blurb: 'מחשבים כמה כסף מקבלים בחזרה',
  levels: [3],
};

const PIECES = [1, 2, 5, 10, 20, 50, 100, 200];
const NOTES = [20, 50, 100, 200]; // what you'd realistically hand over
const SLOTS = 3;

const SHOP = [
  ['🍕', 'פיצה'], ['📚', 'ספר'], ['⚽', 'כדור'], ['🧸', 'דובי'], ['👕', 'חולצה'],
  ['🎨', 'צבעים'], ['👟', 'נעליים'], ['🎧', 'אוזניות'], ['🚲', 'אופניים'],
  ['🍰', 'עוגה'], ['✏️', 'קלמר'], ['🎸', 'גיטרה'],
];

/** Fewest NIS pieces that make `n` — greedy is optimal for this set. */
function pieceCount(n) {
  let left = n;
  let count = 0;
  for (const v of [...PIECES].sort((a, b) => b - a)) {
    while (left >= v) { left -= v; count++; }
  }
  return count;
}

export function mount(stage, ctx) {
  const round = new Round(stage, ctx, { rounds: 8, pauseOk: 1800, pauseNo: 2600 });
  let lastChange = 0;

  round.start((view, api) => {
    // Keep drawing until the change is something he can actually build:
    // payable in SLOTS pieces or fewer, and not a repeat of last time.
    let price = 0;
    let paid = 0;
    let change = 0;
    do {
      paid = pick(NOTES);
      price = randInt(Math.max(1, Math.floor(paid / 2)), paid - 1);
      change = paid - price;
    } while (change === lastChange || change === 0 || pieceCount(change) > SLOTS);
    lastChange = change;

    const [emoji, name] = pick(SHOP);
    const chosen = [];
    let missed = false;
    let answered = false;

    const wallet = el('div', { class: 'wallet' });
    const totalEl = el('div', { class: 'pay-total' });

    const sum = () => chosen.reduce((a, m) => a + m.v, 0);
    const ask = () => speak(
      `${name} עולה ${shekels(price)}. שילמו ב-${shekels(paid)}. כמה עודף?`,
      { rate: 0.9 },
    );

    function paint() {
      clear(wallet);
      chosen.forEach((m, i) => {
        const node = moneyNode(m, 'picked');
        node.addEventListener('click', () => {
          if (answered) return;
          chosen.splice(i, 1);
          sfx.tap();
          paint();
        });
        wallet.append(node);
      });
      for (let i = chosen.length; i < SLOTS; i++) wallet.append(el('div', { class: 'slot-empty' }));
      totalEl.textContent = `${sum()} ₪`;
      totalEl.classList.toggle('some', sum() > 0);
    }

    function add(m, node) {
      if (answered) return;
      const shake = () => {
        node.classList.add('shake');
        setTimeout(() => node.classList.remove('shake'), 360);
      };

      if (chosen.length >= SLOTS) { missed = true; sfx.wrong(); shake(); return; }

      // Same rule as לשלם בחנות: overshooting is refused, not accepted,
      // so the running total only ever climbs toward the answer.
      if (sum() + m.v > change) {
        missed = true;
        sfx.wrong();
        vibrate([10, 50, 10]);
        shake();
        speak('זה יותר מדי עודף');
        return;
      }

      chosen.push(m);
      sfx.tap();
      paint();

      if (sum() === change) {
        answered = true;
        speak(`נכון! ${shekels(paid)} פחות ${shekels(price)} זה ${shekels(change)}`, { rate: 0.88 });
        if (missed) api.no(totalEl); else api.ok(totalEl);
      }
    }

    ask();
    paint();

    view.append(
      el('div', { class: 'prompt tight', onClick: ask },
        `${emoji} ${name}`,
        el('small', { text: T.tapToHear }),
      ),
      el('div', { class: 'sum-line ltr' },
        el('span', { class: 'paid' }, `${paid} ₪`),
        el('span', { class: 'minus' }, '−'),
        el('span', { class: 'cost' }, `${price} ₪`),
        el('span', { class: 'minus' }, '='),
        el('span', { class: 'unknown' }, '?'),
      ),
      wallet,
      totalEl,
      el('div', { class: 'tray' },
        PIECES.map((v) => {
          const m = byValue(v);
          const node = moneyNode(m);
          node.addEventListener('click', () => add(m, node));
          return node;
        }),
      ),
      el('button', {
        class: 'btn small',
        onClick: () => { if (answered) return; chosen.length = 0; sfx.tap(); paint(); },
      }, '↺ להתחיל מחדש'),
    );
  });

  return () => round.stop();
}
