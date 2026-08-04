/* ---------------------------------------------------------------
   cabo.js — חתחתול נגד המחשב.

   ── החוקים כאן ───────────────────────────────────────────────────
   לכל שחקן 4 קלפים הפוכים. הקלפים הם 0 עד 9 בלבד — לא ג׳וקרים ולא
   מלכים — כדי שהספירה בסוף תהיה ספירה שילד בן 7 באמת יכול לעשות.
   מנצח מי שסכום הקלפים שלו נמוך יותר.

   בתור: מושכים קלף מהחפיסה או לוקחים את הקלף העליון מהערמה, ואז
   או מחליפים אותו באחד מארבעת הקלפים שלכם (הקלף שהוחלף נזרק לערמה)
   או זורקים אותו. במקום תור אפשר להכריז "חתחתול!" — ואז ליריב יש
   תור אחד אחרון, וחושפים.

   ── שתי הקלות מכוונות לילדים ─────────────────────────────────────
   1. בחתחתול האמיתי צריך לזכור מה הצצתם בו. כאן קלף שהצצתם בו נשאר
      גלוי לכם. זה הופך את המשחק ממשחק זיכרון למשחק החלטות — וזה גם
      מה שמאפשר לנו לדעת מתי הילד עומד לעשות טעות ולשאול אותו.
   2. אין קלפים עם כוחות מיוחדים. הם מסבכים את ההסבר, וההסבר נאמר
      בקול בכל צעד.

   ── האזהרה על מהלך גרוע ──────────────────────────────────────────
   אם הילד עומד להחליף קלף שהוא *יודע* שהוא נמוך בקלף גבוה יותר, או
   לזרוק קלף נמוך מאוד, נשאלת שאלת אישור. זה לימוד, לא חסימה — הוא
   תמיד יכול להתעקש. אפשר לכבות את זה בהגדרות (caboHints).
   --------------------------------------------------------------- */

import { el, clear, shuffle, range, speak, stopSpeech, sfx, celebrate, burst, wait, randInt } from './kit.js';
import { get } from './settings.js';
import { CABO } from './text.js';

const HAND = 4;
const LOW_ENOUGH = 3;   // a card this low is worth keeping
const AI_CALLS_AT = 8;  // the computer calls once its known total is this good

/** 0-9, four of each. Small numbers so the final count is countable. */
const newDeck = () => shuffle(range(10).flatMap((v) => [v, v, v, v]));

export function mountCabo(root, { onExit }) {
  let state = null;
  let busy = false;   // blocks taps while something is animating or talking
  let dead = false;

  const banner = el('div', { class: 'cabo-banner' });
  const table = el('div', { class: 'cabo-table' });
  const controls = el('div', { class: 'cabo-controls' });

  /** Say a step out loud and show it, so the child always knows what's next. */
  function narrate(text, opts = {}) {
    banner.textContent = text;
    speak(text, { rate: 0.92, ...opts });
  }

  function deal() {
    const deck = newDeck();
    state = {
      deck,
      discard: [deck.pop()],
      you: range(HAND).map(() => ({ v: deck.pop(), seen: false })),
      cpu: range(HAND).map(() => ({ v: deck.pop(), aiSeen: false })),
      drawn: null,        // the card in hand mid-turn
      drawnFrom: null,
      phase: 'peek',      // peek → your turn → cpu turn → reveal
      peeksLeft: 2,
      called: null,       // who called חתחתול
      lastTurn: false,    // the one final turn after a call
      turn: 'you',
    };
    // The computer starts knowing two of its own, exactly like the player.
    state.cpu[0].aiSeen = true;
    state.cpu[1].aiSeen = true;
  }

  /* ---------- drawing ---------- */

  const cardEl = (value, { faceUp, cls = '', onClick, label }) => {
    const node = el('button', {
      class: `card ${faceUp ? 'up' : 'down'} ${cls}`.trim(),
      disabled: !onClick,
      'aria-label': label || (faceUp ? String(value) : 'קלף הפוך'),
    }, faceUp ? String(value) : '🐱');
    if (onClick) node.addEventListener('click', onClick);
    return node;
  };

  function render() {
    if (dead) return;
    clear(table);
    clear(controls);

    const canPeek = state.phase === 'peek';
    const yourTurn = state.phase === 'your-turn' && !busy;
    const choosing = state.phase === 'drawn' && !busy;

    // --- computer's hand ---
    table.append(
      el('div', { class: 'cabo-side' },
        el('div', { class: 'cabo-who' }, `🤖 ${CABO.computer}`),
        el('div', { class: 'hand' },
          state.cpu.map((c, i) => cardEl(c.v, {
            // `revealed` alone, not the phase: once a card is turned over it
            // stays over, including after the game ends.
            faceUp: Boolean(c.revealed),
            cls: c.revealed ? 'revealed' : '',
            label: `${CABO.computer} ${i + 1}`,
          })),
        ),
      ),
    );

    // --- deck and discard ---
    table.append(
      el('div', { class: 'cabo-middle' },
        el('div', { class: 'pile' },
          cardEl(null, {
            faceUp: false,
            cls: `deck${state.deck.length < 6 ? ' low' : ''}`,
            onClick: yourTurn ? () => drawFrom('deck') : null,
            label: CABO.deck,
          }),
          el('span', { class: 'pile-label' }, `${CABO.deck} (${state.deck.length})`),
        ),
        state.drawn !== null
          ? el('div', { class: 'pile drawn-pile' },
            cardEl(state.drawn, { faceUp: true, cls: 'drawn' }),
            el('span', { class: 'pile-label' }, CABO.inHand))
          : null,
        el('div', { class: 'pile' },
          cardEl(state.discard.at(-1), {
            faceUp: true,
            cls: 'discard',
            onClick: yourTurn ? () => drawFrom('discard') : null,
            label: CABO.discard,
          }),
          el('span', { class: 'pile-label' }, CABO.discard),
        ),
      ),
    );

    // --- your hand ---
    table.append(
      el('div', { class: 'cabo-side' },
        el('div', { class: 'hand' },
          state.you.map((c, i) => cardEl(c.v, {
            // A card you've peeked at stays visible — see the note up top.
            faceUp: c.seen || Boolean(c.revealed),
            cls: `${c.seen ? 'seen' : ''} ${c.revealed ? 'revealed' : ''}`.trim(),
            onClick: canPeek && !c.seen ? () => peek(i)
              : choosing ? () => trySwap(i) : null,
            label: `${CABO.yourCard} ${i + 1}`,
          })),
        ),
        el('div', { class: 'cabo-who' }, `🧒 ${CABO.you}`),
      ),
    );

    // --- buttons ---
    if (state.phase === 'drawn' && !busy) {
      controls.append(
        el('button', { class: 'btn primary', onClick: () => tryDiscard() }, CABO.throwAway),
      );
    }
    if (yourTurn && !state.called) {
      controls.append(
        el('button', { class: 'btn cabo-call', onClick: () => callCabo('you') }, CABO.call),
      );
    }
    if (state.phase === 'over') {
      controls.append(
        el('button', { class: 'btn primary', onClick: () => start() }, CABO.again),
        el('button', { class: 'btn', onClick: onExit }, CABO.leave),
      );
    }
  }

  /* ---------- the opening peek ---------- */

  function peek(i) {
    if (state.peeksLeft <= 0) return;
    state.you[i].seen = true;
    state.peeksLeft--;
    sfx.tap();
    if (state.peeksLeft > 0) {
      narrate(CABO.peekOneMore);
    } else {
      state.phase = 'your-turn';
      narrate(CABO.peekDone);
    }
    render();
  }

  /* ---------- your turn ---------- */

  function drawFrom(where) {
    if (busy) return;
    state.drawnFrom = where;
    state.drawn = where === 'deck' ? state.deck.pop() : state.discard.pop();
    state.phase = 'drawn';
    sfx.tap();
    // A really good card deserves a noise that says so.
    if (state.drawn <= 2) sfx.rise(0.5);
    narrate(CABO.drew(state.drawn));
    render();
  }

  /** Would swapping card `i` for the drawn card obviously make things worse? */
  function badSwap(i) {
    const mine = state.you[i];
    return mine.seen && state.drawn > mine.v;
  }

  async function confirmIfSilly(question) {
    if (!get('caboHints')) return true;
    return new Promise((resolve) => {
      clear(controls);
      banner.textContent = question;
      speak(question, { rate: 0.95 });
      controls.append(
        el('button', { class: 'btn', onClick: () => resolve(true) }, CABO.yesSure),
        el('button', { class: 'btn primary', onClick: () => resolve(false) }, CABO.noBack),
      );
    });
  }

  async function trySwap(i) {
    if (busy) return;
    if (badSwap(i)) {
      busy = true;
      const ok = await confirmIfSilly(CABO.sureSwap(state.you[i].v, state.drawn));
      busy = false;
      if (!ok) { narrate(CABO.pickAnother); render(); return; }
    }
    doSwap(i);
  }

  function doSwap(i) {
    state.discard.push(state.you[i].v);
    state.you[i] = { v: state.drawn, seen: true }; // you saw what you put there
    state.drawn = null;
    sfx.correct();
    narrate(CABO.swapped);
    endYourTurn();
  }

  async function tryDiscard() {
    if (busy) return;
    if (state.drawn <= LOW_ENOUGH) {
      busy = true;
      const ok = await confirmIfSilly(CABO.sureThrow(state.drawn));
      busy = false;
      if (!ok) { narrate(CABO.chooseCard); render(); return; }
    }
    state.discard.push(state.drawn);
    state.drawn = null;
    sfx.tap();
    narrate(CABO.threwAway);
    endYourTurn();
  }

  async function endYourTurn() {
    render();
    await wait(1100);
    if (dead) return;
    if (state.called === 'you' || (state.called === 'cpu' && state.lastTurn)) return reveal();
    if (state.called === 'you') state.lastTurn = true;
    computerTurn();
  }

  /* ---------- the computer ---------- */

  /** Its own worst card that it knows about. */
  const cpuWorstKnown = () => state.cpu
    .map((c, i) => ({ ...c, i }))
    .filter((c) => c.aiSeen)
    .sort((a, b) => b.v - a.v)[0] || null;

  const cpuKnownTotal = () => state.cpu
    .reduce((sum, c) => sum + (c.aiSeen ? c.v : 5), 0); // unseen counts as average

  async function computerTurn() {
    busy = true;
    state.phase = 'cpu-turn';
    narrate(CABO.cpuThinking);
    render();
    await wait(1400);
    if (dead) return;

    // Call it if its hand looks good enough and nobody has yet.
    if (!state.called && cpuKnownTotal() <= AI_CALLS_AT && state.deck.length < 30) {
      busy = false;
      return callCabo('cpu');
    }

    const top = state.discard.at(-1);
    const worst = cpuWorstKnown();
    // Take the discard only if it clearly improves a card it knows about.
    const takeDiscard = worst && top < worst.v - 1;
    const card = takeDiscard ? state.discard.pop() : state.deck.pop();
    narrate(takeDiscard ? CABO.cpuTookDiscard : CABO.cpuDrew);
    await wait(1300);
    if (dead) return;

    const target = worst && card < worst.v
      ? worst
      : state.cpu.find((c) => !c.aiSeen) && card <= 3
        ? { i: state.cpu.findIndex((c) => !c.aiSeen) }
        : null;

    if (target) {
      state.discard.push(state.cpu[target.i].v);
      state.cpu[target.i] = { v: card, aiSeen: true };
      narrate(CABO.cpuSwapped);
    } else {
      state.discard.push(card);
      narrate(CABO.cpuThrew);
    }

    render();
    await wait(1200);
    if (dead) return;

    busy = false;
    if (state.called === 'cpu' || (state.called === 'you' && state.lastTurn)) return reveal();
    if (state.called === 'cpu') state.lastTurn = true;
    if (state.deck.length === 0) return reveal();

    state.phase = 'your-turn';
    narrate(CABO.yourTurn);
    render();
  }

  /* ---------- calling ---------- */

  async function callCabo(who) {
    state.called = who;
    sfx.fanfare();
    narrate(who === 'you' ? CABO.youCalled : CABO.cpuCalled, { rate: 0.95 });
    render();
    await wait(2200);
    if (dead) return;

    // The other player gets exactly one more turn.
    if (who === 'you') {
      state.lastTurn = true;
      computerTurn();
    } else {
      state.lastTurn = true;
      state.phase = 'your-turn';
      narrate(CABO.lastTurn);
      render();
    }
  }

  /* ---------- the reveal ---------- */

  async function reveal() {
    state.phase = 'reveal';
    busy = true;
    clear(controls);
    render();

    narrate(CABO.revealNow, { rate: 0.95 });
    sfx.roll(2.5);
    await wait(2600);
    if (dead) return;

    /** Turn one hand over a card at a time, counting out loud as we go. */
    async function countHand(hand, whoLabel) {
      let total = 0;
      narrate(CABO.counting(whoLabel));
      await wait(1200);
      for (let i = 0; i < hand.length; i++) {
        if (dead) return 0;
        hand[i].revealed = true;
        total += hand[i].v;
        sfx.correct();
        render();
        // Say the card, then the running total — this is the counting bit.
        banner.textContent = `${hand[i].v}  →  ${CABO.runningTotal(total)}`;
        speak(i === 0 ? `${hand[i].v}` : `ועוד ${hand[i].v}, זה ${total}`, { rate: 0.9 });
        await wait(1900);
      }
      return total;
    }

    const yourTotal = await countHand(state.you, CABO.you);
    if (dead) return;
    await wait(700);
    const cpuTotal = await countHand(state.cpu, CABO.computer);
    if (dead) return;

    await wait(600);
    const youWin = yourTotal < cpuTotal;
    const tie = yourTotal === cpuTotal;

    banner.textContent = `${CABO.you}: ${yourTotal}  ·  ${CABO.computer}: ${cpuTotal}`;
    await wait(1400);
    if (dead) return;

    if (youWin) { celebrate(140); burst(['🐱', '🎉', '⭐', '🏆'], 26); sfx.fanfare(); }
    else if (tie) sfx.win();
    else sfx.wrong();

    narrate(tie ? CABO.tie(yourTotal) : youWin
      ? CABO.youWon(yourTotal, cpuTotal)
      : CABO.cpuWon(cpuTotal, yourTotal), { rate: 0.92 });

    state.phase = 'over';
    busy = false;
    render();
  }

  /* ---------- go ---------- */

  function start() {
    deal();
    busy = false;
    render();
    narrate(CABO.intro);
  }

  root.append(banner, table, controls);
  start();

  return () => { dead = true; stopSpeech(); };
}
