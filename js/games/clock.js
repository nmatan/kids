/* מה השעה? — קריאת שעון מחוגים. (רמה 3)
   הקושי עולה תוך כדי: שעות עגולות ← וחצי ← רבעים ← קפיצות של 5 דקות. */

import { Round, el, shuffle, randInt, pick, speak } from '../kit.js';
import { NUM } from '../text.js';

export const meta = {
  id: 'clock',
  title: 'מה השעה?',
  emoji: '🕓',
  blurb: 'קוראים את מחוגי השעון',
  levels: [3],
};

const SVG = 'http://www.w3.org/2000/svg';

const svgEl = (tag, attrs) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

/** Draw an analog clock face showing h:m. */
function clockFace(h, m) {
  const size = 300, c = size / 2;
  const svg = svgEl('svg', {
    viewBox: `0 0 ${size} ${size}`,
    width: 'min(62vw, 42vh, 320px)',
    height: 'min(62vw, 42vh, 320px)',
  });

  svg.append(
    svgEl('circle', { cx: c, cy: c, r: 138, fill: '#fdfcff', stroke: '#7c5cff', 'stroke-width': 10 }),
  );

  for (let i = 1; i <= 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const label = svgEl('text', {
      x: c + Math.cos(angle) * 108,
      y: c + Math.sin(angle) * 108,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': 26,
      'font-weight': 800,
      fill: '#2a1d55',
      'font-family': 'system-ui, sans-serif',
    });
    label.textContent = String(i);
    svg.append(label);

    // minute ticks
    const t = (i / 12) * Math.PI * 2 - Math.PI / 2;
    svg.append(svgEl('line', {
      x1: c + Math.cos(t) * 130, y1: c + Math.sin(t) * 130,
      x2: c + Math.cos(t) * 138, y2: c + Math.sin(t) * 138,
      stroke: '#2a1d55', 'stroke-width': 4, 'stroke-linecap': 'round',
    }));
  }

  const hand = (angle, len, width, color) => svgEl('line', {
    x1: c, y1: c,
    x2: c + Math.cos(angle - Math.PI / 2) * len,
    y2: c + Math.sin(angle - Math.PI / 2) * len,
    stroke: color, 'stroke-width': width, 'stroke-linecap': 'round',
  });

  // Hour hand drifts with the minutes, exactly like a real clock.
  svg.append(hand(((h % 12) + m / 60) / 12 * Math.PI * 2, 68, 13, '#2a1d55'));
  svg.append(hand((m / 60) * Math.PI * 2, 104, 8, '#ff5c6c'));
  svg.append(svgEl('circle', { cx: c, cy: c, r: 9, fill: '#2a1d55' }));

  return svg;
}

const fmt = (h, m) => `${h}:${String(m).padStart(2, '0')}`;

/* איך אומרים את השעה בעברית.
   עד וחצי:  "שלוש ורבע".  אחרי וחצי:  "רבע לארבע". */
const PAST = {
  0: '', 5: 'וחמישה', 10: 'ועשרה', 15: 'ורבע',
  20: 'ועשרים', 25: 'ועשרים וחמישה', 30: 'וחצי',
};
const TO = {
  35: 'עשרים וחמישה', 40: 'עשרים', 45: 'רבע', 50: 'עשרה', 55: 'חמישה',
};

function spoken(h, m) {
  const hour = NUM[h];
  if (m <= 30) return `${hour} ${PAST[m] ?? `ו${m}`}`.trim();
  const next = NUM[h === 12 ? 1 : h + 1];
  return `${TO[m] ?? String(60 - m)} ל${next}`;
}

export function mount(stage, ctx) {
  const round = new Round(stage, ctx, { rounds: 10, pauseOk: 900, pauseNo: 1900 });

  round.start((view, api) => {
    // Ramp: whole hours, then halves, then quarters, then five-minute steps.
    const minutePool =
      api.index < 3 ? [0] :
      api.index < 5 ? [0, 30] :
      api.index < 7 ? [0, 15, 30, 45] :
                      [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

    const h = randInt(1, 12);
    const m = pick(minutePool);
    const answer = fmt(h, m);

    // Wrong options are believable misreadings: hands swapped, hour off by one.
    const decoys = new Set([
      fmt(h === 12 ? 1 : h + 1, m),
      fmt(h === 1 ? 12 : h - 1, m),
      fmt(h, (m + 30) % 60),
      fmt(h, m === 0 ? 15 : 0),
      fmt(Math.max(1, Math.round(m / 5) || 12), h * 5 % 60), // hands read backwards
    ]);
    decoys.delete(answer);
    const options = shuffle([answer, ...shuffle([...decoys]).slice(0, 3)]);

    const ask = () => speak('מה השעה?');
    ask();

    let rightBtn = null;
    const buttons = options.map((t) => {
      const btn = el('button', { class: 'choice', onClick: () => {
        if (t === answer) {
          speak(spoken(h, m), { rate: 0.85 });
          api.ok(btn);
        } else {
          api.no(btn);
          api.reveal(rightBtn);
          speak(`השעה היא ${spoken(h, m)}`, { rate: 0.85 });
        }
      } }, t);
      if (t === answer) rightBtn = btn;
      return btn;
    });

    view.append(
      el('div', { class: 'prompt', onClick: ask, style: { fontSize: 'clamp(22px, 4vw, 36px)' } },
        'מה השעה?',
      ),
      clockFace(h, m),
      el('div', { class: 'choices' }, buttons),
    );
  });

  return () => round.stop();
}
