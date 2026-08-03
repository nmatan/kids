/* לשלם בחנות — מרכיבים סכום ממטבעות ושטרות אמיתיים. (רמות 2-3)

   אמיתי (רמה 2): מטבעות בלבד, סכומים קטנים, עד 2 פריטים.
   אביתר (רמה 3): גם שטרות, סכומים גדולים, עד 3 פריטים.

   רק מטבעות ושטרות שבאמת מסתובבים היום. אגורות (10 אג׳ ו-½ ₪) לא
   נכללות בכוונה — הן גוררות שברים עשרוניים, וזה שלב הבא. */

import { Round, el, clear, pick, randInt, speak, sfx, vibrate, wait } from '../kit.js';
import { T } from '../text.js';

export const meta = {
  id: 'money',
  title: 'לשלם בחנות',
  emoji: '🛒',
  blurb: 'מרכיבים את הסכום ממטבעות ושטרות',
  levels: [2, 3],
};

/* Real circulating NIS. `size` is roughly proportional to the real thing,
   so the physical pecking order matches what's in their hand. */
const MONEY = [
  { v: 1, label: '1', kind: 'coin', cls: 'silver', w: 58 },
  { v: 2, label: '2', kind: 'coin', cls: 'silver', w: 68 },
  { v: 5, label: '5', kind: 'coin', cls: 'silver dodeca', w: 76 },
  { v: 10, label: '10', kind: 'coin', cls: 'bimetal', w: 86 },
  { v: 20, label: '20', kind: 'note n20', w: 104, h: 60 },
  { v: 50, label: '50', kind: 'note n50', w: 112, h: 64 },
  { v: 100, label: '100', kind: 'note n100', w: 120, h: 68 },
  { v: 200, label: '200', kind: 'note n200', w: 128, h: 72 },
];

const byValue = (v) => MONEY.find((m) => m.v === v);

/* Something to buy, priced roughly like the real thing. */
const SHOP = {
  cheap: [['🍎', 'תפוח'], ['🍌', 'בננה'], ['🍞', 'לחם'], ['🍬', 'סוכריה'], ['🥕', 'גזר'], ['🍭', 'סוכרייה']],
  mid: [['🧸', 'דובי'], ['📚', 'ספר'], ['⚽', 'כדור'], ['🎨', 'צבעים'], ['👕', 'חולצה'], ['🍕', 'פיצה']],
  pricey: [['🚲', 'אופניים'], ['🎸', 'גיטרה'], ['👟', 'נעליים'], ['🎧', 'אוזניות'], ['⌚', 'שעון']],
};

const shopFor = (price) => pick(price < 20 ? SHOP.cheap : price < 100 ? SHOP.mid : SHOP.pricey);

/** How an Israeli says the amount out loud. */
const shekels = (n) => (n === 1 ? 'שקל אחד' : n === 2 ? 'שני שקלים' : `${n} שקלים`);

function moneyNode(m, extra = '') {
  return el('button', {
    class: `money ${m.kind} ${m.cls || ''} ${extra}`.trim(),
    style: {
      width: `${m.w}px`,
      height: `${m.h || m.w}px`,
      fontSize: `${m.label.length > 2 ? 20 : 24}px`,
    },
  }, m.label, el('small', { text: '₪' }));
}

export function mount(stage, ctx) {
  const big = ctx.profile.level >= 3;
  const pool = big ? [1, 2, 5, 10, 20, 50, 100, 200] : [1, 2, 5, 10];
  const slots = big ? 3 : 2;
  const round = new Round(stage, ctx, { rounds: 8, pauseOk: 1700, pauseNo: 2400 });

  let lastTarget = 0;

  round.start((view, api) => {
    // Ease in: start with amounts reachable in fewer pieces than they're allowed.
    const pieces = big ? (api.index < 3 ? 2 : 3) : (api.index < 2 ? 1 : 2);

    // Build the price FROM real pieces, so it's always payable within the limit.
    let target = 0;
    do {
      target = Array.from({ length: pieces }, () => pick(pool)).reduce((a, b) => a + b, 0);
    } while (target === lastTarget);
    lastTarget = target;

    const [emoji, name] = shopFor(target);
    const chosen = [];
    let missed = false;
    let answered = false;

    const wallet = el('div', { class: 'wallet' });
    const totalEl = el('div', { class: 'pay-total' });
    const hint = el('div', { class: 'hint' });

    const sum = () => chosen.reduce((a, m) => a + m.v, 0);
    const ask = () => speak(`${name}. צריך לשלם ${shekels(target)}`);

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
      for (let i = chosen.length; i < slots; i++) wallet.append(el('div', { class: 'slot-empty' }));

      const paid = sum();
      totalEl.textContent = `${paid} ₪`;
      totalEl.classList.toggle('some', paid > 0);
      hint.textContent = chosen.length >= slots && paid < target
        ? 'אפשר ללחוץ על מטבע כדי להוריד אותו'
        : '';
    }

    function add(m, node) {
      if (answered) return;

      if (chosen.length >= slots) {
        // Full hands: nudge rather than scold.
        missed = true;
        sfx.wrong();
        node.classList.add('shake');
        setTimeout(() => node.classList.remove('shake'), 360);
        speak(`אפשר רק ${slots} פריטים`);
        return;
      }

      if (sum() + m.v > target) {
        missed = true;
        sfx.wrong();
        vibrate([10, 50, 10]);
        node.classList.add('shake');
        setTimeout(() => node.classList.remove('shake'), 360);
        speak('זה יותר מדי');
        return;
      }

      chosen.push(m);
      sfx.tap();
      paint();

      if (sum() === target) {
        answered = true;
        speak(`יופי! שילמת ${shekels(target)}`, { rate: 0.9 });
        if (missed) api.no(totalEl); else api.ok(totalEl);
      }
    }

    const tray = el('div', { class: 'tray' },
      pool.map((v) => {
        const m = byValue(v);
        const node = moneyNode(m);
        node.addEventListener('click', () => add(m, node));
        return node;
      }),
    );

    ask();
    paint();

    view.append(
      el('div', { class: 'prompt tight', onClick: ask },
        `${emoji} ${name}`,
        el('small', { text: T.tapToHear }),
      ),
      el('div', { class: 'price' }, `${target} ₪`),
      wallet,
      totalEl,
      hint,
      tray,
      el('button', {
        class: 'btn small',
        onClick: () => { if (answered) return; chosen.length = 0; sfx.tap(); paint(); },
      }, '↺ להתחיל מחדש'),
    );
  });

  return () => round.stop();
}
