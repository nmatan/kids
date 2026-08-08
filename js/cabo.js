/* ---------------------------------------------------------------
   cabo.js — חתחתול נגד המחשב.

   ── החוקים ───────────────────────────────────────────────────────
   לכל שחקן 4 קלפים הפוכים, ערכים 0 עד 9. מנצח הסכום הנמוך.
   בהתחלה מציצים בשני הקלפים החיצוניים — ולוחצים "סיימתי" כשמוכנים,
   בלי שעון שרץ.

   בתור: מושכים מהחפיסה או מהערמה, ואז אחת משתיים —
     • לוחצים על קלף שלכם  → מחליפים
     • לוחצים "לזרוק"       → הקלף לערמה, התור נגמר
   ל-7, 8 ו-9 יש כוח, ואז מופיע כפתור *נוסף* "לזרוק ו…". הכפתור
   הרגיל תמיד קיים, כך שכוח אף פעם לא קורה במפתיע.

   ── באגים שהיו כאן, ולמה הקוד בנוי ככה עכשיו ────────────────────
   1. הערמה יכולה להתרוקן — מותר לקחת ממנה את הקלף האחרון. כל מקום
      שקורא את ראש הערמה חייב לטפל בריק, אחרת מצויר קלף עם undefined.
   2. כפתור אחד ששימש גם לזריקה וגם להפעלת כוח בלבל: הילד רצה לזרוק
      וקיבל "משוך שניים". היום אלה שני כפתורים נפרדים.
   3. clearTurnState() מנקה כל שארית של כוח בתחילת ובסוף כל תור.
      בלי זה מצב ממהלך קודם צץ בתור הבא.
   4. כל משפט מסתיים לפני שהבא מתחיל (say). השהיה קבועה קטעה משפטים
      ארוכים באמצע — במיוחד את התיאור של מה שהמחשב עשה.
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

/** Values that carry a power when thrown away. */
const POWERS = { 7: 'peek', 8: 'swap', 9: 'two' };

const newDeck = () => shuffle(range(10).flatMap((v) => [v, v, v, v]));
const peekMs = () => Math.max(0, get('caboPeekSeconds')) * 1000;

export function mountCabo(root, { onExit }) {
  let s = null;
  let busy = false;
  let dead = false;

  const banner = el('div', { class: 'cabo-banner' });
  const table = el('div', { class: 'cabo-table' });
  const hint = el('div', { class: 'cabo-hint' });
  const controls = el('div', { class: 'cabo-controls' });

  function narrate(text) {
    banner.textContent = text;
    speak(text, { rate: 0.95 });
  }

  /** Narrate and wait for the voice to finish — never talk over yourself. */
  async function say(text) {
    narrate(text);
    await waitForSpeech(6000);
  }

  function deal() {
    const deck = newDeck();
    s = {
      deck,
      discard: [deck.pop()],
      you: range(HAND).map(() => ({ v: deck.pop(), seen: false })),
      cpu: range(HAND).map(() => ({ v: deck.pop(), aiSeen: false })),
      held: null,       // the card in your hand mid-turn
      fromTwo: false,   // came from משוך שניים, so carries no power
      twoUp: null,      // the pair offered by משוך שניים
      swapFrom: null,   // your card chosen for החלף
      phase: 'look',
      called: null,
      lastTurn: false,
      flashing: null,   // indexes of your cards shown briefly
    };
    s.cpu[0].aiSeen = true;
    s.cpu[1].aiSeen = true;
  }

  /** Wipe anything left over from a power so it can't leak into a turn. */
  function clearTurnState() {
    s.held = null;
    s.twoUp = null;
    s.swapFrom = null;
    s.fromTwo = false;
    s.flashing = null;
  }

  /* ---------- drawing the table ---------- */

  const card = (value, { faceUp, cls = '', onClick, label }) => {
    const node = el('button', {
      class: `card ${faceUp ? 'up' : 'down'} ${cls}`.trim(),
      disabled: !onClick,
      'aria-label': label || (faceUp ? String(value) : 'קלף הפוך'),
    }, faceUp ? String(value) : '🐱');
    if (onClick) node.addEventListener('click', onClick);
    return node;
  };

  /** An empty slot — the discard pile really can be taken down to nothing. */
  const emptySlot = (label) => el('div', { class: 'card empty', 'aria-label': label });

  function render() {
    if (dead) return;
    clear(table);
    clear(controls);
    hint.textContent = '';

    const idle = !busy;
    const p = s.phase;
    const showPeeked = get('caboShowPeeked');
    const top = s.discard.length ? s.discard[s.discard.length - 1] : null;

    /* --- computer --- */
    table.append(el('div', { class: 'cabo-side' },
      el('div', { class: 'cabo-who' }, `🤖 ${CABO.computer}`),
      el('div', { class: 'hand' },
        s.cpu.map((c, i) => card(c.v, {
          faceUp: Boolean(c.revealed),
          cls: c.revealed ? 'revealed' : '',
          onClick: p === 'swapB' && idle ? () => swapWithCpu(i) : null,
          label: `${CABO.computer} ${i + 1}`,
        })),
      ),
    ));

    /* --- deck · held · discard --- */
    const middle = el('div', { class: 'cabo-middle' });

    middle.append(el('div', { class: 'pile' },
      card(null, {
        faceUp: false,
        cls: `deck${s.deck.length < 6 ? ' low' : ''}`,
        onClick: p === 'draw' && idle && s.deck.length ? () => draw('deck') : null,
        label: CABO.deck,
      }),
      el('span', { class: 'pile-label' }, `${CABO.deck} (${s.deck.length})`),
    ));

    if (p === 'twoUp' && s.twoUp) {
      middle.append(el('div', { class: 'pile two-up' },
        el('div', { class: 'hand' },
          s.twoUp.map((v, i) => card(v, {
            faceUp: true,
            cls: 'drawn',
            onClick: idle ? () => keepOne(i) : null,
            label: String(v),
          })),
        ),
        el('span', { class: 'pile-label' }, CABO.pickOne),
      ));
    } else if (s.held !== null) {
      middle.append(el('div', { class: 'pile' },
        card(s.held, { faceUp: true, cls: 'drawn' }),
        el('span', { class: 'pile-label' }, CABO.inHand),
      ));
    }

    middle.append(el('div', { class: 'pile' },
      top === null
        ? emptySlot(CABO.discard)
        : card(top, {
          faceUp: true,
          cls: 'discard',
          onClick: p === 'draw' && idle ? () => draw('discard') : null,
          label: CABO.discard,
        }),
      el('span', { class: 'pile-label' }, CABO.discard),
    ));
    table.append(middle);

    /* --- you --- */
    table.append(el('div', { class: 'cabo-side' },
      el('div', { class: 'hand' },
        s.you.map((c, i) => card(c.v, {
          faceUp: Boolean(c.revealed) || Boolean(s.flashing?.includes(i))
            || (c.seen && showPeeked),
          cls: `${c.seen && !showPeeked && !c.revealed ? 'peeked' : ''} ${c.revealed ? 'revealed' : ''}`.trim(),
          onClick: !idle ? null
            : p === 'choose' ? () => trySwap(i)
              : p === 'peek' ? () => usePeek(i)
                : p === 'swapA' ? () => chooseMine(i) : null,
          label: `${CABO.yourCard} ${i + 1}`,
        })),
      ),
      el('div', { class: 'cabo-who' }, `🧒 ${CABO.you}`),
    ));

    /* --- what to do now --- */
    if (!idle) return;

    if (p === 'look') {
      controls.append(el('button', {
        class: 'btn primary', onClick: () => doneLooking(),
      }, CABO.doneLooking));
    } else if (p === 'draw') {
      hint.textContent = CABO.drawHint;
      if (!s.called) {
        controls.append(el('button', {
          class: 'btn cabo-call', onClick: () => callCabo('you'),
        }, CABO.call));
      }
    } else if (p === 'choose') {
      hint.textContent = CABO.swapHint;
      // Plain discard is ALWAYS available. A power is a separate, extra
      // button, so it can never fire when he only meant to throw away.
      controls.append(el('button', { class: 'btn', onClick: () => throwAway(false) },
        CABO.throwAway));
      const power = s.fromTwo ? null : POWERS[s.held];
      if (power) {
        controls.append(el('button', {
          class: 'btn primary power-btn', onClick: () => throwAway(true),
        }, CABO.usePower(CABO.powerVerb[s.held])));
      }
    } else if (p === 'peek') {
      hint.textContent = CABO.powerPeek;
    } else if (p === 'swapA') {
      hint.textContent = CABO.powerSwap;
    } else if (p === 'swapB') {
      hint.textContent = CABO.powerSwapCpu;
    } else if (p === 'twoUp') {
      hint.textContent = CABO.powerDrawTwo;
    } else if (p === 'over') {
      controls.append(
        el('button', { class: 'btn primary', onClick: () => start() }, CABO.again),
        el('button', { class: 'btn', onClick: onExit }, CABO.leave),
      );
    }
  }

  /* ---------- the opening look ---------- */

  async function openingLook() {
    busy = true;
    render();
    await say(CABO.intro);
    if (dead) return;

    // The two outer cards, both at once — no choosing, as it's played here.
    [0, HAND - 1].forEach((i) => { s.you[i].seen = true; });
    s.flashing = [0, HAND - 1];
    sfx.rise(0.6);
    busy = false;
    render();
    await say(CABO.lookAtThese);
  }

  /** He decides when he has finished looking. No timer racing him. */
  async function doneLooking() {
    if (busy || s.phase !== 'look') return;
    busy = true;
    sfx.tap();
    s.flashing = null;
    s.phase = 'draw';
    busy = false;
    render();
    await say(CABO.yourTurn);
  }

  /* ---------- your turn ---------- */

  function draw(where) {
    if (busy || s.phase !== 'draw') return;
    if (where === 'discard' && !s.discard.length) return;
    if (where === 'deck' && !s.deck.length) return;

    s.fromTwo = false;
    s.held = where === 'deck' ? s.deck.pop() : s.discard.pop();
    s.phase = 'choose';
    sfx.tap();
    if (s.held <= 2) sfx.rise(0.5);
    narrate(CABO.drew(s.held));
    render();
  }

  const badSwap = (i) => s.you[i].seen && s.held > s.you[i].v;

  function ask(question) {
    return new Promise((resolve) => {
      clear(controls);
      hint.textContent = '';
      banner.textContent = question;
      speak(question, { rate: 0.95 });
      controls.append(
        el('button', { class: 'btn', onClick: () => resolve(true) }, CABO.yesSure),
        el('button', { class: 'btn primary', onClick: () => resolve(false) }, CABO.noBack),
      );
    });
  }

  async function trySwap(i) {
    if (busy || s.phase !== 'choose') return;
    if (get('caboHints') && badSwap(i)) {
      busy = true;
      const go = await ask(CABO.sureSwap(s.you[i].v, s.held));
      busy = false;
      if (!go) { narrate(CABO.pickAnother); return render(); }
    }
    s.discard.push(s.you[i].v);
    s.you[i] = { v: s.held, seen: true };
    clearTurnState();
    sfx.correct();
    render();
    await say(CABO.swapped);
    if (dead) return;
    endTurn();
  }

  /** usePower false = plain discard. Never the same button. */
  async function throwAway(usePower) {
    if (busy || s.phase !== 'choose') return;
    const power = usePower && !s.fromTwo ? POWERS[s.held] : null;

    // Only warn about binning a good card when nothing is gained by it.
    if (!power && get('caboHints') && s.held <= LOW_ENOUGH) {
      busy = true;
      const go = await ask(CABO.sureThrow(s.held));
      busy = false;
      if (!go) { narrate(CABO.chooseCard); return render(); }
    }

    const held = s.held;
    s.discard.push(held);
    clearTurnState();
    sfx.tap();

    if (power === 'peek') { s.phase = 'peek'; render(); return say(CABO.powerPeek); }
    if (power === 'swap') { s.phase = 'swapA'; render(); return say(CABO.powerSwap); }
    if (power === 'two') return drawTwo();

    render();
    await say(CABO.threwAway(held));
    if (dead) return;
    endTurn();
  }

  /* ---------- powers ---------- */

  async function usePeek(i) {
    if (busy || s.phase !== 'peek') return;
    busy = true;
    s.you[i].seen = true;
    s.flashing = [i];
    sfx.correct();
    render();
    await say(CABO.peeked(s.you[i].v));
    if (dead) return;
    await wait(peekMs());
    if (dead) return;
    s.flashing = null;
    busy = false;
    endTurn();
  }

  async function chooseMine(i) {
    if (busy || s.phase !== 'swapA') return;
    s.swapFrom = i;
    s.phase = 'swapB';
    sfx.tap();
    render();
    await say(CABO.powerSwapCpu);
  }

  async function swapWithCpu(j) {
    if (busy || s.phase !== 'swapB' || s.swapFrom === null) return;
    busy = true;
    const mine = s.you[s.swapFrom];
    // Blind trade: neither side knows what it just received.
    s.you[s.swapFrom] = { v: s.cpu[j].v, seen: false };
    s.cpu[j] = { v: mine.v, aiSeen: false };
    clearTurnState();
    sfx.correct();
    render();
    await say(CABO.swappedWithCpu);
    if (dead) return;
    busy = false;
    endTurn();
  }

  function drawTwo() {
    const two = [];
    while (two.length < 2 && s.deck.length) two.push(s.deck.pop());
    if (!two.length) return endTurn();
    s.twoUp = two;
    s.phase = 'twoUp';
    render();
    return say(CABO.powerDrawTwo);
  }

  function keepOne(i) {
    if (busy || s.phase !== 'twoUp' || !s.twoUp) return;
    const kept = s.twoUp[i];
    s.twoUp.forEach((v, k) => { if (k !== i) s.discard.push(v); });
    s.twoUp = null;
    s.held = kept;
    s.fromTwo = true;   // a kept card carries no power, or turns could loop
    s.phase = 'choose';
    sfx.tap();
    narrate(CABO.drew(kept));
    render();
  }

  /* ---------- turn handover ---------- */

  async function endTurn() {
    clearTurnState();
    render();
    await wait(500);
    if (dead) return;
    if (s.called && s.lastTurn) return reveal();
    if (!s.deck.length) return reveal();
    cpuTurn();
  }

  /* ---------- the computer ---------- */

  const cpuWorst = () => s.cpu.map((c, i) => ({ ...c, i }))
    .filter((c) => c.aiSeen).sort((a, b) => b.v - a.v)[0] || null;
  const cpuTotal = () => s.cpu.reduce((sum, c) => sum + (c.aiSeen ? c.v : 5), 0);

  async function cpuTurn() {
    busy = true;
    s.phase = 'cpu';
    clearTurnState();
    render();
    await say(CABO.cpuThinking);
    if (dead) return;

    if (!s.called && cpuTotal() <= AI_CALLS_AT && s.deck.length < 30) {
      busy = false;
      return callCabo('cpu');
    }
    if (!s.deck.length) { busy = false; return reveal(); }

    const worst = cpuWorst();
    const top = s.discard.length ? s.discard[s.discard.length - 1] : null;
    const takeDiscard = worst && top !== null && top < worst.v - 1;
    const got = takeDiscard ? s.discard.pop() : s.deck.pop();

    await say(takeDiscard ? CABO.cpuTookDiscard(got) : CABO.cpuDrew);
    if (dead) return;

    const target = worst && got < worst.v ? worst.i
      : got <= 3 ? s.cpu.findIndex((c) => !c.aiSeen) : -1;

    if (target >= 0) {
      s.discard.push(s.cpu[target].v);
      s.cpu[target] = { v: got, aiSeen: true };
      render();
      await say(CABO.cpuSwapped);
    } else {
      s.discard.push(got);
      const power = POWERS[got];
      if (power === 'peek') {
        const hidden = s.cpu.findIndex((c) => !c.aiSeen);
        if (hidden >= 0) s.cpu[hidden].aiSeen = true;
        render();
        await say(CABO.cpuPeeked);
      } else if (power === 'swap' && worst) {
        const j = randInt(0, HAND - 1);
        const mine = s.you[j];
        s.you[j] = { v: s.cpu[worst.i].v, seen: false };
        s.cpu[worst.i] = { v: mine.v, aiSeen: false };
        render();
        await say(CABO.cpuSwappedWithYou);
      } else if (power === 'two' && s.deck.length >= 2) {
        const [x, y] = [s.deck.pop(), s.deck.pop()];
        const keep = Math.min(x, y);
        s.discard.push(Math.max(x, y));
        await say(CABO.cpuDrewTwo);
        if (dead) return;
        if (worst && keep < worst.v) {
          s.discard.push(s.cpu[worst.i].v);
          s.cpu[worst.i] = { v: keep, aiSeen: true };
        } else s.discard.push(keep);
        render();
      } else {
        render();
        await say(CABO.cpuThrew(got));
      }
    }
    if (dead) return;

    busy = false;
    if (s.called && s.lastTurn) return reveal();
    if (!s.deck.length) return reveal();

    s.phase = 'draw';
    render();
    await say(s.called === 'cpu' ? CABO.lastTurn : CABO.yourTurn);
  }

  /* ---------- calling ---------- */

  async function callCabo(who) {
    s.called = who;
    busy = true;
    sfx.fanfare();
    render();
    await say(who === 'you' ? CABO.youCalled : CABO.cpuCalled);
    if (dead) return;
    // The other side gets exactly one more turn, then everything is shown.
    s.lastTurn = true;
    busy = false;

    if (who === 'you') return cpuTurn();
    s.phase = 'draw';
    render();
    await say(CABO.lastTurn);
  }

  /* ---------- the reveal ---------- */

  async function reveal() {
    s.phase = 'reveal';
    busy = true;
    clearTurnState();
    clear(controls);
    render();

    await say(CABO.revealNow);
    if (dead) return;
    sfx.roll(2.2);

    for (let i = 0; i < HAND; i++) {
      for (const side of ['you', 'cpu']) {
        if (dead) return;
        s[side][i].revealed = true;
        sfx.correct();
        render();
        await wait(650);
      }
    }

    const mine = s.you.reduce((sum, c) => sum + c.v, 0);
    const theirs = s.cpu.reduce((sum, c) => sum + c.v, 0);
    const truth = mine < theirs ? 'you' : theirs < mine ? 'cpu' : 'tie';

    await wait(400);
    if (dead) return;
    busy = false;
    s.phase = 'verdict';
    await say(CABO.whoWon);
    if (dead) return;

    const answer = async (guess) => {
      clear(controls);
      const right = guess === truth;
      sfx[right ? 'correct' : 'wrong']();
      await say(`${right ? CABO.countedRight : CABO.countedWrong} ${CABO.totals(mine, theirs)}`);
      if (dead) return;

      if (truth === 'you') { celebrate(140); burst(['🐱', '🎉', '⭐', '🏆'], 26); sfx.fanfare(); }
      else if (truth === 'tie') sfx.win();

      await say(truth === 'tie' ? CABO.tie(mine)
        : truth === 'you' ? CABO.youWon(mine, theirs) : CABO.cpuWon(theirs, mine));
      if (dead) return;
      s.phase = 'over';
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
    busy = false;
    openingLook();
  }

  root.append(banner, table, hint, controls);
  start();

  return () => { dead = true; stopSpeech(); };
}
