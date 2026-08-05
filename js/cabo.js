/* ---------------------------------------------------------------
   cabo.js — חתחתול נגד המחשב.

   ── החוקים כאן ───────────────────────────────────────────────────
   לכל שחקן 4 קלפים הפוכים, ערכים 0 עד 9 בלבד — כדי שהספירה בסוף
   תהיה ספירה שילד בן 7 באמת יכול לעשות. מנצח הסכום הנמוך.

   בתור: מושכים מהחפיסה או לוקחים מהערמה, ואז מחליפים באחד הקלפים
   שלכם או זורקים. במקום תור אפשר להכריז "חתחתול!" — ואז ליריב תור
   אחרון אחד, וחושפים.

   ── קלפי כוח ─────────────────────────────────────────────────────
   הכוח מופעל כשזורקים את הקלף, לא כשמחליפים בו. זה החוק המקורי והוא
   גם הגיוני: 7, 8 ו-9 הם קלפים גרועים להחזיק, אז ההחלטה היא אמיתית —
   לזרוק ולהרוויח כוח, או להחליף כי יש לכם משהו גרוע עוד יותר.

     7  הצץ         — מציצים באחד הקלפים שלכם
     8  החלף        — מחליפים קלף שלכם בקלף של המחשב, בלי לראות
     9  משוך שניים  — מושכים שניים ובוחרים איזה לשמור

   כוח לא משרשר: קלף שהגיע מ"משוך שניים" ונזרק לא מפעיל כוח נוסף,
   אחרת תור אחד יכול להימשך לנצח.

   ── זיכרון ───────────────────────────------------------------
   כברירת מחדל קלף שהצצתם בו נחשף לרגע וחוזר להיות הפוך — צריך לזכור,
   וזה עיקר המשחק. מסומנת עליו נקודה קטנה כדי שתדעו *באיזה* הצצתם,
   בדיוק כמו שיודעים סביב שולחן אמיתי. אפשר להשאיר אותם גלויים
   בהגדרות (caboShowPeeked) לילד צעיר יותר.

   בכל מקרה המשחק זוכר מה הילד ראה, וזה מה שמאפשר את שאלת האישור
   לפני מהלך גרוע (caboHints).
   --------------------------------------------------------------- */

import {
  el, clear, shuffle, range, speak, stopSpeech, waitForSpeech, sfx,
  celebrate, burst, wait, randInt,
} from './kit.js';
import { get } from './settings.js';
import { CABO } from './text.js';

const HAND = 4;
const LOW_ENOUGH = 3;   // a card this low is worth keeping
const AI_CALLS_AT = 8;  // the computer calls once its known total is this good
/** How long a peeked card stays visible, in seconds. A setting because
    a younger child genuinely needs longer to take it in. */
const flashMs = () => Math.max(0, get('caboPeekSeconds')) * 1000;

/** Which values carry a power when thrown away. */
const POWERS = { 7: 'peek', 8: 'swap', 9: 'draw2' };

/** 0-9, four of each. Small numbers so the final count is countable. */
const newDeck = () => shuffle(range(10).flatMap((v) => [v, v, v, v]));

export function mountCabo(root, { onExit }) {
  let state = null;
  let busy = false;   // blocks taps while something is animating or talking
  let dead = false;

  const banner = el('div', { class: 'cabo-banner' });
  const table = el('div', { class: 'cabo-table' });
  const controls = el('div', { class: 'cabo-controls' });

  /** One short instruction, shown and spoken. */
  function narrate(text, opts = {}) {
    banner.textContent = text;
    speak(text, { rate: 0.95, ...opts });
  }

  /**
   * Narrate and wait for the voice to actually finish. Every step in a
   * sequence uses this — the next speak() cancels the current one, so a
   * fixed pause that happens to be shorter chops the sentence in half.
   */
  async function say(text, opts) {
    narrate(text, opts);
    await waitForSpeech(6000);
  }

  function deal() {
    const deck = newDeck();
    state = {
      deck,
      discard: [deck.pop()],
      you: range(HAND).map(() => ({ v: deck.pop(), seen: false })),
      cpu: range(HAND).map(() => ({ v: deck.pop(), aiSeen: false })),
      drawn: null,
      phase: 'peek',
      called: null,
      lastTurn: false,
      power: null,        // 'peek' | 'swap-mine' | 'swap-cpu' | 'draw2'
      twoCards: null,     // the pair offered by משוך שניים
      swapMine: null,     // your card chosen for החלף
      noChain: false,     // a card from משוך שניים can't trigger another power
      flash: null,        // { side, i } — a card being shown briefly
    };
    state.cpu[0].aiSeen = true;
    state.cpu[1].aiSeen = true;
  }

  /** Show one or more cards briefly, then turn them back over. */
  async function flash(side, indexes) {
    state.flash = { side, list: [].concat(indexes) };
    render();
    await wait(flashMs());
    if (dead) return;
    state.flash = null;
    render();
  }

  const isFlashing = (side, i) =>
    state.flash?.side === side && state.flash.list.includes(i);

  /* ---------- drawing the table ---------- */

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

    const idle = !busy;
    const yourTurn = state.phase === 'your-turn' && idle;
    const choosing = state.phase === 'drawn' && idle;
    const keepPeeked = get('caboShowPeeked');

    // --- computer's hand ---
    table.append(
      el('div', { class: 'cabo-side' },
        el('div', { class: 'cabo-who' }, `🤖 ${CABO.computer}`),
        el('div', { class: 'hand' },
          state.cpu.map((c, i) => cardEl(c.v, {
            faceUp: Boolean(c.revealed) || isFlashing('cpu', i),
            cls: c.revealed ? 'revealed' : '',
            // only tappable while picking a target for החלף
            onClick: state.power === 'swap-cpu' && idle ? () => powerSwapCpu(i) : null,
            label: `${CABO.computer} ${i + 1}`,
          })),
        ),
      ),
    );

    // --- deck, card in hand, discard ---
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

        // משוך שניים offers a choice of two
        state.twoCards
          ? el('div', { class: 'pile two-up' },
            el('div', { class: 'hand' },
              state.twoCards.map((v, i) => cardEl(v, {
                faceUp: true,
                cls: 'drawn',
                onClick: idle ? () => keepOneOfTwo(i) : null,
                label: `${v}`,
              })),
            ),
            el('span', { class: 'pile-label' }, CABO.inHand))
          : state.drawn !== null
            ? el('div', { class: 'pile' },
              cardEl(state.drawn, { faceUp: true, cls: 'drawn' }),
              el('span', { class: 'pile-label' },
                POWERS[state.drawn] && !state.noChain
                  ? `${CABO.inHand} · ${CABO.powers[state.drawn]}`
                  : CABO.inHand))
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
            faceUp: Boolean(c.revealed) || isFlashing('you', i) || (c.seen && keepPeeked),
            // A dot marks which ones you've looked at, even when the value
            // is hidden — around a real table you'd know that much too.
            cls: `${c.seen && !keepPeeked ? 'peeked' : ''} ${c.revealed ? 'revealed' : ''}`.trim(),
            onClick: choosing ? () => trySwap(i)
                : state.power === 'peek' && idle ? () => powerPeek(i)
                  : state.power === 'swap-mine' && idle ? () => powerSwapMine(i) : null,
            label: `${CABO.yourCard} ${i + 1}`,
          })),
        ),
        el('div', { class: 'cabo-who' }, `🧒 ${CABO.you}`),
      ),
    );

    // --- buttons ---
    if (choosing) {
      controls.append(
        el('button', { class: 'btn primary', onClick: () => tryDiscard() },
          POWERS[state.drawn] && !state.noChain
            ? `🗑 ${CABO.powers[state.drawn]}`
            : CABO.throwAway),
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

  /* ---------- the opening look ---------- */

  /**
   * The Israeli way: you don't choose which to look at — it's always the
   * two outside cards, and both at once. Nothing to tap, so the game
   * starts itself.
   */
  async function openingLook() {
    busy = true;
    const outer = [0, HAND - 1];
    await say(CABO.intro);
    if (dead) return;

    outer.forEach((i) => { state.you[i].seen = true; });
    sfx.rise(0.6);
    narrate(CABO.lookAtThese);
    await flash('you', outer);
    if (dead) return;

    busy = false;
    state.phase = 'your-turn';
    await say(CABO.peekDone);
    if (dead) return;
    render();
  }

  /* ---------- your turn ---------- */

  function drawFrom(where) {
    if (busy) return;
    state.noChain = false;
    state.drawn = where === 'deck' ? state.deck.pop() : state.discard.pop();
    state.phase = 'drawn';
    sfx.tap();
    if (state.drawn <= 2) sfx.rise(0.5);
    narrate(CABO.drew(state.drawn));
    render();
  }

  /** Would this swap obviously make things worse, going on what he saw? */
  const badSwap = (i) => state.you[i].seen && state.drawn > state.you[i].v;

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
    state.discard.push(state.you[i].v);
    state.you[i] = { v: state.drawn, seen: true }; // you saw what you put there
    state.drawn = null;
    sfx.correct();
    narrate(CABO.swapped);
    endYourTurn();
  }

  async function tryDiscard() {
    if (busy) return;
    const power = state.noChain ? null : POWERS[state.drawn];

    // Only warn about throwing away a good card when there's no power to
    // gain by doing it — otherwise the "mistake" is the whole point.
    if (!power && state.drawn <= LOW_ENOUGH) {
      busy = true;
      const ok = await confirmIfSilly(CABO.sureThrow(state.drawn));
      busy = false;
      if (!ok) { narrate(CABO.chooseCard); render(); return; }
    }

    state.discard.push(state.drawn);
    state.drawn = null;
    sfx.tap();

    if (power === 'peek') { state.power = 'peek'; narrate(CABO.powerPeek); return render(); }
    if (power === 'swap') { state.power = 'swap-mine'; narrate(CABO.powerSwap); return render(); }
    if (power === 'draw2') return drawTwo();

    narrate(CABO.threwAway);
    endYourTurn();
  }

  /* ---------- the powers ---------- */

  async function powerPeek(i) {
    busy = true;
    state.power = null;
    state.you[i].seen = true;
    sfx.correct();
    narrate(CABO.peeked(state.you[i].v));
    await flash('you', i);
    if (dead) return;
    busy = false;
    endYourTurn();
  }

  function powerSwapMine(i) {
    state.swapMine = i;
    state.power = 'swap-cpu';
    sfx.tap();
    narrate(CABO.powerSwapCpu);
    render();
  }

  function powerSwapCpu(j) {
    const mine = state.swapMine;
    const tmp = state.you[mine];
    // A blind trade: you no longer know your own card, and the computer
    // no longer knows the one it got.
    state.you[mine] = { v: state.cpu[j].v, seen: false };
    state.cpu[j] = { v: tmp.v, aiSeen: false };
    state.power = null;
    state.swapMine = null;
    sfx.correct();
    narrate(CABO.swappedWithCpu);
    endYourTurn();
  }

  function drawTwo() {
    state.twoCards = [state.deck.pop(), state.deck.pop()].filter((v) => v !== undefined);
    if (state.twoCards.length === 0) { state.twoCards = null; return endYourTurn(); }
    narrate(CABO.powerDrawTwo);
    render();
  }

  function keepOneOfTwo(i) {
    const kept = state.twoCards[i];
    const dropped = state.twoCards[1 - i];
    if (dropped !== undefined) state.discard.push(dropped);
    state.twoCards = null;
    state.drawn = kept;
    state.noChain = true;   // no power chaining
    state.phase = 'drawn';
    sfx.tap();
    narrate(CABO.drew(kept));
    render();
  }

  /* ---------- turn handover ---------- */

  async function endYourTurn() {
    state.power = null;
    render();
    await wait(1000);
    if (dead) return;
    if (state.called === 'you' && state.lastTurn) return reveal();
    if (state.called === 'cpu' && state.lastTurn) return reveal();
    if (state.called === 'you') state.lastTurn = true;
    computerTurn();
  }

  /* ---------- the computer ---------- */

  const cpuWorstKnown = () => state.cpu
    .map((c, i) => ({ ...c, i }))
    .filter((c) => c.aiSeen)
    .sort((a, b) => b.v - a.v)[0] || null;

  const cpuKnownTotal = () => state.cpu
    .reduce((sum, c) => sum + (c.aiSeen ? c.v : 5), 0);

  async function computerTurn() {
    busy = true;
    state.phase = 'cpu-turn';
    narrate(CABO.cpuThinking);
    render();
    await wait(1300);
    if (dead) return;

    if (!state.called && cpuKnownTotal() <= AI_CALLS_AT && state.deck.length < 30) {
      busy = false;
      return callCabo('cpu');
    }
    if (state.deck.length === 0) { busy = false; return reveal(); }

    const top = state.discard.at(-1);
    const worst = cpuWorstKnown();
    const takeDiscard = worst && top < worst.v - 1;
    const card = takeDiscard ? state.discard.pop() : state.deck.pop();
    narrate(takeDiscard ? CABO.cpuTookDiscard : CABO.cpuDrew);
    await wait(1200);
    if (dead) return;

    const swapTarget = worst && card < worst.v ? worst.i
      : card <= 3 ? state.cpu.findIndex((c) => !c.aiSeen)
        : -1;

    if (swapTarget >= 0) {
      state.discard.push(state.cpu[swapTarget].v);
      state.cpu[swapTarget] = { v: card, aiSeen: true };
      narrate(CABO.cpuSwapped);
    } else {
      state.discard.push(card);
      // The computer uses the powers too, simply.
      const power = POWERS[card];
      if (power === 'peek') {
        const hidden = state.cpu.findIndex((c) => !c.aiSeen);
        if (hidden >= 0) state.cpu[hidden].aiSeen = true;
        narrate(CABO.cpuPeeked);
      } else if (power === 'swap' && worst) {
        const j = randInt(0, HAND - 1);
        const mine = state.you[j];
        state.you[j] = { v: state.cpu[worst.i].v, seen: false };
        state.cpu[worst.i] = { v: mine.v, aiSeen: false };
        narrate(CABO.cpuSwappedWithYou);
      } else if (power === 'draw2' && state.deck.length >= 2) {
        const [x, y] = [state.deck.pop(), state.deck.pop()];
        const keep = Math.min(x, y);
        state.discard.push(Math.max(x, y));
        narrate(CABO.cpuDrewTwo);
        if (worst && keep < worst.v) {
          state.discard.push(state.cpu[worst.i].v);
          state.cpu[worst.i] = { v: keep, aiSeen: true };
        } else {
          state.discard.push(keep);
        }
      } else {
        narrate(CABO.cpuThrew);
      }
    }

    render();
    await wait(1200);
    if (dead) return;
    busy = false;

    if (state.called === 'cpu' && state.lastTurn) return reveal();
    if (state.called === 'you' && state.lastTurn) return reveal();
    if (state.called === 'cpu') state.lastTurn = true;
    if (state.deck.length === 0) return reveal();

    state.phase = 'your-turn';
    narrate(state.called === 'cpu' ? CABO.lastTurn : CABO.yourTurn);
    render();
  }

  /* ---------- calling ---------- */

  async function callCabo(who) {
    state.called = who;
    state.lastTurn = true;
    sfx.fanfare();
    narrate(who === 'you' ? CABO.youCalled : CABO.cpuCalled);
    render();
    await wait(2000);
    if (dead) return;

    if (who === 'you') {
      computerTurn();
    } else {
      state.phase = 'your-turn';
      narrate(CABO.lastTurn);
      render();
    }
  }

  /* ---------- the reveal ---------- */

  /**
   * Flip everything over, then hand the maths to the child.
   *
   * The app deliberately does NOT read the totals out. Counting the cards
   * and working out who won is the whole point of the ending — announcing
   * "you have 14" would do the one useful bit for him. So it flips, asks,
   * and only confirms once he has committed to an answer.
   */
  async function reveal() {
    state.phase = 'reveal';
    busy = true;
    state.flash = null;
    clear(controls);
    render();

    await say(CABO.revealNow);
    if (dead) return;
    sfx.roll(2.2);

    // One card at a time, alternating sides — that's where the tension is.
    const order = [];
    for (let i = 0; i < HAND; i++) order.push(['you', i], ['cpu', i]);
    for (const [side, i] of order) {
      if (dead) return;
      state[side][i].revealed = true;
      sfx.correct();
      render();
      await wait(650);
    }

    const yourTotal = state.you.reduce((sum, card) => sum + card.v, 0);
    const cpuTotal = state.cpu.reduce((sum, card) => sum + card.v, 0);
    const truth = yourTotal < cpuTotal ? 'you' : cpuTotal < yourTotal ? 'cpu' : 'tie';

    await wait(400);
    if (dead) return;
    busy = false;
    await say(CABO.whoWon);
    if (dead) return;

    /** His verdict, then ours. */
    const answer = async (guess) => {
      clear(controls);
      const right = guess === truth;
      sfx[right ? 'correct' : 'wrong']();

      const sums = CABO.totals(yourTotal, cpuTotal);
      banner.textContent = sums;
      await say((right ? CABO.countedRight : CABO.countedWrong) + ' ' + sums);
      if (dead) return;

      if (truth === 'you') { celebrate(140); burst(['🐱', '🎉', '⭐', '🏆'], 26); sfx.fanfare(); }
      else if (truth === 'tie') sfx.win();

      await say(truth === 'tie' ? CABO.tie(yourTotal)
        : truth === 'you' ? CABO.youWon(yourTotal, cpuTotal)
          : CABO.cpuWon(cpuTotal, yourTotal));
      if (dead) return;

      state.phase = 'over';
      render();
    };

    clear(controls);
    controls.append(
      el('button', { class: 'btn primary', onClick: () => answer('you') }, CABO.guessMe),
      el('button', { class: 'btn', onClick: () => answer('cpu') }, CABO.guessCpu),
      el('button', { class: 'btn', onClick: () => answer('tie') }, CABO.guessTie),
    );
  }

  /* ---------- go ---------- */

  function start() {
    deal();
    busy = true;
    render();
    openingLook();
  }

  root.append(banner, table, controls);
  start();

  return () => { dead = true; stopSpeech(); };
}
