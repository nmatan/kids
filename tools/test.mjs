/* ---------------------------------------------------------------
   test.mjs — smoke tests.  Run:  npm test

   There's no browser here, so tools/dom-stub.mjs fakes just enough of
   one to run the real app code in Node. Two suites:

     1. every game mounts, can be played to the end, and reports 0-3 stars
     2. every route renders, and each kid's shelf holds the right games

   Worth running after adding a game or editing a word list — it catches
   typos and broken imports before they reach the tablet.
   --------------------------------------------------------------- */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeDom, Node } from './dom-stub.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => import(new URL(p, pathToFileURL(join(ROOT, '/'))).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let fails = 0;
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? '[32mok[0m   ' : '[31mFAIL[0m '} ${name}${ok ? '' : ' — ' + extra}`);
  if (!ok) fails++;
};

makeDom();

const { GAMES, gamesForLevel } = await load('js/registry.js');
const { PROFILES } = await load('js/profiles.js');

/* ---------- 1. play every game ---------- */

console.log('\nGames\n');

for (const game of GAMES) {
  for (const profile of PROFILES) {
    if (!game.meta.levels.includes(profile.level)) continue;

    const label = `${game.meta.title} @ level ${profile.level}`;
    const stage = new Node('div');
    let stars = null;

    const ctx = {
      profile,
      setProgress: () => {},
      finish: (s) => { stars = s; },
      exit: () => {},
      replay: () => {},
    };

    try {
      const teardown = game.mount(stage, ctx);

      // Play deliberately so a winnable game always gets won: remember
      // memory-card faces, pay greedily, and cycle through choices in
      // order everywhere else.
      const seen = new Map();
      let cursor = 0;
      const amount = (n) => parseInt(n.textContent.replace(/[^\d]/g, ''), 10) || 0;

      for (let step = 0; step < 3000 && stars === null; step++) {
        const cards = stage.querySelectorAll('.mem-card')
          .filter((n) => !n.classList.contains('done') && !n.classList.contains('up'));
        const choices = stage.querySelectorAll('.choice').filter((n) => !n.disabled);
        const price = stage.querySelectorAll('.price')[0];

        // Paying: the NIS denominations are a canonical system, so taking
        // the largest piece that still fits always lands exactly on the
        // price in the fewest pieces — within the game's item limit.
        if (price) {
          const owed = amount(price) - amount(stage.querySelectorAll('pay-total')[0] || { textContent: '0' });
          const tray = stage.querySelectorAll('money')
            .filter((n) => !n.classList.contains('picked') && amount(n) <= owed)
            .sort((a, b) => amount(b) - amount(a));
          if (tray.length) tray[0].dispatch('click');
          await sleep(6);
          continue;
        }

        if (cards.length) {
          const known = cards.find((c) => seen.has(c.textContent) && seen.get(c.textContent) !== c);
          if (known) {
            seen.get(known.textContent).dispatch('click');
            known.dispatch('click');
          } else {
            const card = cards[cursor++ % cards.length];
            seen.set(card.textContent, card);
            card.dispatch('click');
          }
        } else if (choices.length) {
          choices[cursor++ % choices.length].dispatch('click');
        }
        await sleep(6);
      }

      check(label, Number.isInteger(stars) && stars >= 0 && stars <= 3,
        stars === null ? 'never reached an end screen' : `bad star value ${stars}`);
      teardown?.();
    } catch (err) {
      check(label, false, err.stack.split('\n').slice(0, 2).join(' | '));
    }
  }
}

/* ---------- 2. walk every route ---------- */

console.log('\nScreens\n');

const appRoot = new Node('div');
globalThis.document.getElementById = (id) => (id === 'app' ? appRoot : null);

const winListeners = {};
globalThis.addEventListener = (t, fn) => { (winListeners[t] ||= []).push(fn); };
globalThis.removeEventListener = () => {};
globalThis.location = { hash: '' };

const navigate = async (hash) => {
  globalThis.location.hash = hash;
  (winListeners.hashchange || []).forEach((fn) => fn());
  await sleep(10);
};

await load('js/app.js');
const find = (cls) => appRoot.querySelectorAll('.' + cls);

await navigate('#/');
check(`home lists all ${PROFILES.length} kids`, find('profile').length === PROFILES.length,
  `got ${find('profile').length}`);
check('home shows every kid by name', PROFILES.every((p) => appRoot.textContent.includes(p.name)));

for (const p of PROFILES) {
  await navigate(`#/p/${p.id}`);
  const expected = gamesForLevel(p.level);
  check(`${p.name} (level ${p.level}) sees ${expected.length} games`,
    find('game-card').length === expected.length, `got ${find('game-card').length}`);

  for (const g of expected) {
    await navigate(`#/p/${p.id}/g/${g.meta.id}`);
    check(`  ${p.name} → ${g.meta.title} draws its first round`,
      find('choice').length > 0 || find('mem-card').length > 0 || find('money').length > 0,
      'stage was empty');
  }
}

await navigate('#/p/does-not-exist');
check('unknown profile falls back to home', find('profile').length === PROFILES.length);
await navigate(`#/p/${PROFILES[0].id}/g/does-not-exist`);
check('unknown game falls back to the shelf', find('game-card').length > 0);

await navigate('#/leaders');
check(`leaderboard lists all ${PROFILES.length} kids`,
  find('board-row').length === PROFILES.length, `got ${find('board-row').length}`);

/* ---------- 3. settings ---------- */

console.log('\nSettings\n');

const store = await load('js/store.js');
const cfg = await load('js/settings.js');
const { cheerLine } = await load('js/text.js');
const { gamesForProfile } = await load('js/registry.js');

const DAY = 86400000;
const [kidA, kidB, kidC] = PROFILES;
const now = new Date();

cfg.resetSettings();
check('defaults: 1 point per win', cfg.get('pointsPerWin') === 1, `got ${cfg.get('pointsPerWin')}`);
check('defaults: 5 plays of each game per day', cfg.get('dailyLimit') === 5, `got ${cfg.get('dailyLimit')}`);

cfg.set('pointsPerWin', 7);
check('changing points per win takes effect', store.pointsFor(3) === 7, `got ${store.pointsFor(3)}`);
cfg.resetSettings();
check('resetting settings restores the default', store.pointsFor(3) === 1);

check('a win scores, whatever the star count',
  store.pointsFor(1) === 1 && store.pointsFor(2) === 1 && store.pointsFor(3) === 1);
check('finishing with no stars scores nothing', store.pointsFor(0) === 0);

// per-kid game selection overrides the level default
const levelShelf = gamesForProfile(kidC).map((g) => g.meta.id);
cfg.setEnabledGames(kidC.id, ['times', 'memory']);
check('a kid can be given games from any level',
  gamesForProfile(kidC).map((g) => g.meta.id).join() === 'times,memory',
  gamesForProfile(kidC).map((g) => g.meta.id).join());
cfg.clearEnabledGames(kidC.id);
check('clearing the override restores their level shelf',
  gamesForProfile(kidC).map((g) => g.meta.id).join() === levelShelf.join());

check('the week start day is configurable', (() => {
  cfg.set('weekStartsOn', 1);
  const monday = new Date(store.startOfWeek(now)).getDay() === 1;
  cfg.set('weekStartsOn', 0);
  const sunday = new Date(store.startOfWeek(now)).getDay() === 0;
  return monday && sunday;
})());

/* ---------- 3b. scoring windows ---------- */

console.log('\nScoring\n');

const play = (ms, p, stars, g = 'memory') => ({ p: p.id, g, s: stars, at: ms });
const seed = (entries) => globalThis.localStorage.setItem('kids-games:v2',
  JSON.stringify({ best: {}, log: entries }));

const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).getTime();

seed([
  play(Date.now(), kidA, 3), play(Date.now(), kidA, 2), play(Date.now(), kidA, 1), // 3 pts
  play(Date.now(), kidB, 3),                                                       // 1 pt
  play(Date.now(), kidB, 0),                                                       // no pt
  play(store.startOfWeek(now) - DAY, kidC, 3),   // earlier this month
  play(lastMonth, kidC, 3),                      // before this month
]);

const week = store.leaderboard(PROFILES, 'week');
check('week counts only this week, ranked highest first',
  week[0].profile.id === kidA.id && week[0].points === 3
    && week[1].points === 1 && week[2].points === 0,
  week.map((r) => `${r.profile.name}=${r.points}`).join(' '));

check('a zero-star game counts as played but scores nothing',
  week.find((r) => r.profile.id === kidB.id).games === 2
    && week.find((r) => r.profile.id === kidB.id).points === 1);

const month = store.leaderboard(PROFILES, 'month').find((r) => r.profile.id === kidC.id);
check('month includes earlier this month but not last month', month.points === 1,
  `got ${month.points}`);

const all = store.leaderboard(PROFILES, 'all').find((r) => r.profile.id === kidC.id);
check('all time counts everything', all.points === 2, `got ${all.points}`);

check('every kid appears even with no plays', week.length === PROFILES.length);

/* ---------- 3c. daily allowance (per kid, per game) ---------- */

console.log('\nDaily limit\n');

const limit = store.dailyLimit();
const shelf = gamesForProfile(kidA).map((g) => g.meta.id);
const [gameOne, gameTwo] = shelf;

seed([]);
check(`a fresh day allows ${limit} plays of each game`,
  store.remainingToday(kidA.id, gameOne) === limit);

seed(Array.from({ length: 3 }, () => play(Date.now(), kidA, 3, gameOne)));
check('each play uses one of that game up',
  store.remainingToday(kidA.id, gameOne) === limit - 3,
  `got ${store.remainingToday(kidA.id, gameOne)}`);
check('a different game keeps its own full allowance',
  store.remainingToday(kidA.id, gameTwo) === limit);
check('one kid using theirs up does not affect another',
  store.remainingToday(kidB.id, gameOne) === limit);

seed(Array.from({ length: limit + 3 }, () => play(Date.now(), kidA, 3, gameOne)));
check('it never goes negative', store.remainingToday(kidA.id, gameOne) === 0);

seed(Array.from({ length: limit }, () => play(store.startOfDay(now) - 1000, kidA, 3, gameOne)));
check('the allowance resets at midnight',
  store.remainingToday(kidA.id, gameOne) === limit,
  `got ${store.remainingToday(kidA.id, gameOne)}`);

seed([]);
check('the shelf total is the per-game allowance times the shelf',
  store.remainingAcross(kidA.id, shelf) === limit * shelf.length,
  `got ${store.remainingAcross(kidA.id, shelf)}`);

cfg.set('dailyLimit', 2);
seed([]);
check('changing the limit in settings takes effect',
  store.remainingToday(kidA.id, gameOne) === 2);
cfg.resetSettings();

// ...and the UI reflects it, one card at a time
seed(Array.from({ length: store.dailyLimit() }, () => play(Date.now(), kidA, 3, gameOne)));
await navigate(`#/p/${kidA.id}`);
check('only the used-up game locks', find('locked').length === 1,
  `${find('locked').length} locked of ${shelf.length}`);
await navigate(`#/p/${kidA.id}/g/${gameOne}`);
check('opening a used-up game bounces to the shelf',
  find('game-card').length > 0 && find('choice').length === 0);
await navigate(`#/p/${kidA.id}/g/${gameTwo}`);
check('another game on the same shelf still opens',
  find('choice').length > 0 || find('mem-card').length > 0);

// every game used up
seed(shelf.flatMap((id) =>
  Array.from({ length: store.dailyLimit() }, () => play(Date.now(), kidA, 3, id))));
await navigate(`#/p/${kidA.id}`);
check('every card locks once the whole shelf is used up',
  find('locked').length === shelf.length, `${find('locked').length} of ${shelf.length}`);

// a game that isn't on this kid's shelf can't be opened by URL
seed([]);
cfg.setEnabledGames(kidA.id, ['memory']);
await navigate(`#/p/${kidA.id}/g/times`);
check('a game off the shelf cannot be opened by URL', find('game-card').length > 0);
cfg.clearEnabledGames(kidA.id);

/* ---------- 3d. the parent gate ---------- */

console.log('\nParent gate\n');

await navigate('#/settings');
check('settings are behind a gate', find('gate-input').length === 1, 'no gate shown');
check('the gate does not show the settings', find('set-row').length === 0);

/* ---------- 3e. the spoken cheer ---------- */

console.log('\nCheer\n');

const board = (...pts) => PROFILES.map((p, i) => ({ profile: p, points: pts[i], games: 1, stars: 1 }))
  .sort((a, b) => b.points - a.points);

const leading = cheerLine({
  profile: kidA, stars: 3, points: 1, remaining: 3, rows: board(12, 4, 2),
});
check('leader is told their margin', leading.includes('8') && leading.includes(kidB.name), leading);

const chased = cheerLine({
  profile: kidA, stars: 3, points: 1, remaining: 3, rows: board(12, 11, 2),
});
check('a narrow lead sounds urgent', chased.includes('נושף'), chased);

const chasing = cheerLine({
  profile: kidB, stars: 2, points: 1, remaining: 3, rows: board(12, 10, 2),
});
check('the runner-up is told the gap to catch',
  chasing.includes('2') && chasing.includes(kidA.name), chasing);

const lastPlay = cheerLine({
  profile: kidA, stars: 3, points: 1, remaining: 0, rows: board(12, 4, 2),
});
check('the last game of the day says come back tomorrow', lastPlay.includes('מחר'), lastPlay);
check('a normal game says how many are left',
  leading.includes('3') && !leading.includes('מחר'), leading);
check('one point is phrased in the singular', leading.includes('נקודה'), leading);
check('every cheer stays short enough to listen to',
  [leading, chased, chasing, lastPlay].every((s) => s.length < 260));


/* ---------- 3f. paying in a shop ---------- */

console.log('\nPaying\n');

const moneyGame = GAMES.find((g) => g.meta.id === 'money');
const val = (n) => (n ? parseInt(n.textContent.replace(/[^\d]/g, ''), 10) || 0 : 0);

for (const [level, slots, notesExpected] of [[2, 2, false], [3, 3, true]]) {
  const stage = new Node('div');
  let stars = null;
  const teardown = moneyGame.mount(stage, {
    profile: { ...PROFILES[0], level },
    setProgress() {}, finish: (s) => { stars = s; }, exit() {}, replay() {},
  });

  let overshot = false;
  let sawNote = false;
  let sawCoin = false;
  let mostPieces = 0;
  let piecesThisRound = 0;
  let lastPrice = null;
  let unpayable = null;
  let emptySlots = null;

  for (let step = 0; step < 3000 && stars === null; step++) {
    const priceEl = stage.querySelectorAll('price')[0];
    if (!priceEl) break;
    const price = val(priceEl);

    if (price !== lastPrice) { // consecutive prices never repeat, so this is a new round
      mostPieces = Math.max(mostPieces, piecesThisRound);
      piecesThisRound = 0;
      lastPrice = price;
      if (emptySlots === null) emptySlots = stage.querySelectorAll('slot-empty').length;
    }

    const paid = val(stage.querySelectorAll('pay-total')[0]);
    if (paid > price) overshot = true;

    const tray = stage.querySelectorAll('money').filter((n) => !n.classList.contains('picked'));
    tray.forEach((n) => {
      if (n.classList.contains('note')) sawNote = true;
      if (n.classList.contains('coin')) sawCoin = true;
    });

    const fits = tray.filter((n) => val(n) <= price - paid).sort((a, b) => val(b) - val(a));
    if (!fits.length) {
      // paid === price means the round is won and is just waiting to advance
      if (paid < price) { unpayable = `${price} (paid ${paid})`; break; }
      await sleep(20);
      continue;
    }
    fits[0].dispatch('click');
    piecesThisRound++;
    await sleep(6);
  }
  mostPieces = Math.max(mostPieces, piecesThisRound);
  teardown?.();

  check(`level ${level}: every price is payable`, unpayable === null, `stuck at ${unpayable}`);
  check(`level ${level}: never needs more than ${slots} pieces`, mostPieces <= slots,
    `used ${mostPieces}`);
  check(`level ${level}: starts with ${slots} empty slots`, emptySlots === slots,
    `got ${emptySlots}`);
  check(`level ${level}: ${notesExpected ? 'has notes' : 'coins only, no notes'}`,
    sawNote === notesExpected && sawCoin, `notes=${sawNote} coins=${sawCoin}`);
  check(`level ${level}: the amount paid never passes the price`, !overshot);
}

// overshooting is refused rather than accepted
{
  const stage = new Node('div');
  moneyGame.mount(stage, {
    profile: { ...PROFILES[0], level: 2 },
    setProgress() {}, finish() {}, exit() {}, replay() {},
  });
  const price = val(stage.querySelectorAll('price')[0]);
  const tooBig = stage.querySelectorAll('money')
    .filter((n) => !n.classList.contains('picked') && val(n) > price);
  if (tooBig.length) {
    tooBig[0].dispatch('click');
    await sleep(10);
    check('a piece bigger than the price is refused',
      val(stage.querySelectorAll('pay-total')[0]) === 0,
      `wallet took it: ${val(stage.querySelectorAll('pay-total')[0])}`);
  } else {
    check('a piece bigger than the price is refused', true); // price was the largest piece
  }
}

/* ---------- 4. read-along highlighting ---------- */

console.log('\nRead-along\n');

const { speakSentence } = await load('js/kit.js');

// Node has no speechSynthesis, so this exercises the estimated-timing
// fallback — the same path Android takes when it withholds boundary events.
const seen = [];
const sentence = 'Little birds fly in the sky.';
const wordCount = sentence.split(/\s+/).length;

const finished = await new Promise((resolve) => {
  const bail = setTimeout(() => resolve(false), 8000);
  speakSentence(sentence, {
    lang: 'en',
    onWord: (i) => seen.push(i),
    onDone: () => { clearTimeout(bail); resolve(true); },
  });
});

check('the read-along finishes', finished, 'onDone never fired');
check(`highlights all ${wordCount} words`,
  [...new Set(seen.filter((i) => i >= 0))].length === wordCount, `saw ${JSON.stringify(seen)}`);
check('highlights them in order',
  seen.filter((i) => i >= 0).every((v, i, a) => i === 0 || v >= a[i - 1]), JSON.stringify(seen));
check('clears the highlight at the end', seen[seen.length - 1] === -1, JSON.stringify(seen));

const cancelled = [];
const cancel = speakSentence(sentence, { lang: 'en', onWord: (i) => cancelled.push(i) });
cancel();
const afterCancel = cancelled.length;
await sleep(1200);
check('cancelling stops the highlight', cancelled.length === afterCancel,
  `kept going: ${JSON.stringify(cancelled)}`);

console.log(fails ? `\n[31m${fails} failure(s)[0m\n` : '\n[32mAll good.[0m\n');
process.exit(fails ? 1 : 0);
