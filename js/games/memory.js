/* Memory Match — flip two cards, find the pairs. (all levels)
   Doesn't use Round: it isn't a question-and-answer game. */

import { el, clear, shuffle, sample, speak, sfx, vibrate, celebrate, wait, endCard, FUN_EMOJI, ANIMALS } from '../kit.js';
import { T } from '../text.js';

export const meta = {
  id: 'memory',
  title: 'זיכרון',
  emoji: '🧠',
  blurb: 'מצאו את הזוגות',
  levels: [1, 2, 3],
  scales: { 1: '3 זוגות', 2: '6 זוגות', 3: '8 זוגות' },
};

const PAIRS_BY_LEVEL = { 1: 3, 2: 6, 3: 8 };

export function mount(stage, ctx) {
  let dead = false;
  const pairCount = PAIRS_BY_LEVEL[ctx.profile.level] ?? 6;
  // Dedupe: two identical faces in the deck would make four "matching" cards.
  const pool = [...new Set([...FUN_EMOJI, ...ANIMALS.map((a) => a.emoji)])];
  const faces = sample(pool, pairCount);

  const deck = shuffle(faces.flatMap((face, i) => [
    { id: `${i}a`, face }, { id: `${i}b`, face },
  ]));

  let flipped = [];   // currently face-up, unmatched
  let matched = 0;
  let moves = 0;
  let busy = false;

  const grid = el('div', { class: 'mem-grid', style: {
    // Keep the grid roughly square whatever the pair count.
    gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(deck.length))}, 1fr)`,
  } });

  const status = el('div', { class: 'hint' });
  const paint = () => {
    status.textContent = `${matched} מתוך ${pairCount} זוגות · ${moves} ניסיונות`;
    ctx.setProgress(Array(matched).fill(true), pairCount);
  };

  function makeCard(card) {
    const node = el('button', { class: 'mem-card', 'aria-label': 'card' },
      el('span', { class: 'mem-face', text: card.face }),
      el('span', { class: 'mem-back', text: '★' }),
    );

    node.addEventListener('click', async () => {
      if (busy || dead) return;
      if (node.classList.contains('up') || node.classList.contains('done')) return;

      node.classList.add('up');
      sfx.tap();
      flipped.push({ card, node });
      if (flipped.length < 2) return;

      busy = true;
      moves++;
      const [x, y] = flipped;

      if (x.card.face === y.card.face) {
        await wait(380);
        if (dead) return;
        x.node.classList.add('done');
        y.node.classList.add('done');
        matched++;
        sfx.correct();
        vibrate(16);
        paint();
        if (matched === pairCount) return finish();
      } else {
        await wait(900);
        if (dead) return;
        x.node.classList.remove('up');
        y.node.classList.remove('up');
        sfx.wrong();
      }
      flipped = [];
      busy = false;
      paint();
    });

    return node;
  }

  async function finish() {
    // A perfect game takes `pairCount` tries; allow generous slack per level.
    const slack = ctx.profile.level <= 1 ? 2.4 : 1.9;
    const stars = moves <= pairCount * 1.35 ? 3 : moves <= pairCount * slack ? 2 : 1;

    celebrate(stars >= 2 ? 90 : 45);
    sfx.win();
    await wait(600);
    if (dead) return;

    const reward = ctx.finish(stars); // record before drawing the card
    clear(stage);
    stage.append(endCard(ctx, {
      stars,
      msg: `כל ${pairCount} הזוגות ב-${moves} ניסיונות!`,
      reward,
    }));
    speak(reward?.speech || 'מצאתם את כולם!', { rate: 0.95 });
  }

  deck.forEach((card) => grid.append(makeCard(card)));
  stage.append(grid, status);
  paint();
  speak('מצאו את הזוגות');

  return () => { dead = true; };
}
