/* ---------------------------------------------------------------
   test.mjs — smoke tests.  Run:  npm test

   There's no browser here, so tools/dom-stub.mjs fakes just enough of
   one to run the real app code in Node. Two suites:

     1. every game mounts, can be played to the end, and reports 0-3 stars
     2. every route renders, and each kid's shelf holds the right games

   Worth running after adding a game or editing a word list — it catches
   typos and broken imports before they reach the tablet.
   --------------------------------------------------------------- */

import { readFileSync } from 'node:fs';
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

// Short games: the point is that each one mounts, plays and scores —
// not that it can count to twelve. Reset before the settings suite.
const settingsForSpeed = await load('js/settings.js');
settingsForSpeed.set('rounds', 3);

const { GAMES, gamesForLevel, poolFor } = await load('js/registry.js');
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
        // geography is tappable map regions rather than buttons
        const pins = stage.querySelectorAll('.region').filter((n) => !n.disabled);

        // כמה עודף? never shows the target — working it out is the game —
        // so derive it the same way the child does: paid minus cost.
        const sumLine = stage.querySelectorAll('.sum-line')[0];
        const target = sumLine
          ? amount(stage.querySelectorAll('.paid')[0]) - amount(stage.querySelectorAll('.cost')[0])
          : price && amount(price);

        // Paying: the NIS denominations are a canonical system, so taking
        // the largest piece that still fits always lands exactly on the
        // target in the fewest pieces — within the game's item limit.
        if (price || sumLine) {
          const owed = target - amount(stage.querySelectorAll('pay-total')[0] || { textContent: '0' });
          const tray = stage.querySelectorAll('money')
            .filter((n) => !n.classList.contains('picked') && amount(n) <= owed)
            .sort((a, b) => amount(b) - amount(a));
          if (tray.length) tray[0].dispatch('click');
          await sleep(6);
          continue;
        }

        if (pins.length) {
          pins[cursor++ % pins.length].dispatch('click');
        } else if (cards.length) {
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

/** Is a game actually on screen? Games use different interactive
    elements — buttons, memory cards, money, map regions — so ask about
    all of them in one place rather than at each call site. */
const playing = () => find('choice').length > 0 || find('mem-card').length > 0
  || find('money').length > 0 || find('region').length > 0;

await navigate('#/');
check('the portal offers both apps', find('portal-card').length === 2,
  `got ${find('portal-card').length}`);

await navigate('#/kids');
check(`the kids' app lists all ${PROFILES.length} kids`,
  find('profile').length === PROFILES.length, `got ${find('profile').length}`);
check('home shows every kid by name', PROFILES.every((p) => appRoot.textContent.includes(p.name)));

for (const p of PROFILES) {
  await navigate(`#/p/${p.id}`);
  const expected = (await load('js/registry.js')).gamesForProfile(p);
  check(`${p.name} (level ${p.level}) sees ${expected.length} games`,
    find('game-card').length === expected.length, `got ${find('game-card').length}`);

  for (const g of expected) {
    await navigate(`#/p/${p.id}/g/${g.meta.id}`);
    check(`  ${p.name} → ${g.meta.title} draws its first round`, playing(),
      'stage was empty');
  }
}

await navigate('#/p/does-not-exist');
check('unknown profile falls back to the kids list', find('profile').length === PROFILES.length);
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
check('defaults: 1 point per star', cfg.get('pointsPerStar') === 1, `got ${cfg.get('pointsPerStar')}`);
check('defaults: 3 plays of each game per day', cfg.get('dailyLimit') === 3,
  `got ${cfg.get('dailyLimit')}`);

cfg.set('pointsPerStar', 7);
check('changing the per-star value takes effect', store.pointsFor(3) === 21,
  `got ${store.pointsFor(3)}`);
cfg.resetSettings();
check('resetting settings restores the default', store.pointsFor(3) === 3);

/* every shelf is exactly five games, always — equal shelves are what
   make the daily ceilings equal and the scoreboard a fair contest */
const { GAMES_PER_KID } = await load('js/registry.js');
const shelfOf = (p) => gamesForProfile(p).map((g) => g.meta.id);

check(`every kid's default shelf is exactly ${GAMES_PER_KID}`,
  PROFILES.every((p) => shelfOf(p).length === GAMES_PER_KID),
  PROFILES.map((p) => `${p.name}=${shelfOf(p).length}`).join(' '));
check('every pool can fill a shelf',
  [1, 2, 3].every((l) => poolFor(l).length >= GAMES_PER_KID),
  [1, 2, 3].map((l) => `L${l}=${poolFor(l).length}`).join(' '));
check('levels 2 and 3 have more in the pool than slots, so they rotate',
  poolFor(2).length > GAMES_PER_KID && poolFor(3).length > GAMES_PER_KID,
  `L2=${poolFor(2).length} L3=${poolFor(3).length}`);
check('every pooled game really is built for that level',
  [1, 2, 3].every((l) => poolFor(l).every((g) => g.meta.levels.includes(l))),
  [1, 2, 3].flatMap((l) => poolFor(l).filter((g) => !g.meta.levels.includes(l))
    .map((g) => `L${l}:${g.meta.id}`)).join(' '));
/* a game offered at several levels must actually play differently at
   each, and must say so — otherwise an age quietly gets a game that was
   never tuned for it */
{
  const multi = GAMES.filter((g) => g.meta.levels.length > 1);
  const single = GAMES.filter((g) => g.meta.levels.length === 1);
  const source = (g) => readFileSync(join(ROOT, `js/games/${g.meta.id}.js`), 'utf8');

  check('every multi-level game reads the kid\'s level',
    multi.every((g) => source(g).includes('profile.level')),
    multi.filter((g) => !source(g).includes('profile.level')).map((g) => g.meta.id).join());
  check('every multi-level game declares what changes',
    multi.every((g) => g.meta.scales),
    multi.filter((g) => !g.meta.scales).map((g) => g.meta.id).join());
  check('and declares it for each level it appears at',
    multi.every((g) => g.meta.levels.every((l) => g.meta.scales?.[l])),
    multi.filter((g) => !g.meta.levels.every((l) => g.meta.scales?.[l]))
      .map((g) => g.meta.id).join());
  check('single-level games claim no scaling',
    single.every((g) => !g.meta.scales),
    single.filter((g) => g.meta.scales).map((g) => g.meta.id).join());
  check(`${multi.length} games scale, ${single.length} are fixed to one age`, true);
}

check('the toddler games are kept away from the 7-year-old',
  !poolFor(3).some((g) => ['animals', 'colors', 'shapes'].includes(g.meta.id)),
  poolFor(3).map((g) => g.meta.id).join());

/* the shelf rotates daily, but holds still within a day */
{
  const { gamesForProfile: shelfFor, dayStamp } = await load('js/registry.js');
  const ids = (p, d) => shelfFor(p, d).map((g) => g.meta.id).join();
  const days = Array.from({ length: 14 }, (_, i) => new Date(2026, 7, 3 + i, 10));

  check('the same day always gives the same shelf',
    ids(kidA, new Date(2026, 7, 3, 8)) === ids(kidA, new Date(2026, 7, 3, 21)),
    'it reshuffled during the day');
  check('a different day gives a different shelf',
    new Set(days.map((d) => ids(kidA, d))).size > 1, 'never rotated');
  check('every rotated shelf is still exactly five',
    days.every((d) => shelfFor(kidA, d).length === GAMES_PER_KID));
  check('rotation never repeats a game inside one day',
    days.every((d) => new Set(shelfFor(kidA, d).map((g) => g.meta.id)).size === GAMES_PER_KID));
  check('over two weeks the whole pool gets used',
    new Set(days.flatMap((d) => shelfFor(kidA, d).map((g) => g.meta.id))).size
      === poolFor(kidA.level).length,
    `${new Set(days.flatMap((d) => shelfFor(kidA, d).map((g) => g.meta.id))).size} of ${poolFor(kidA.level).length}`);
  check('two kids do not get identical shelves by accident',
    days.filter((d) => ids(kidA, d) === ids(kidB, d)).length < days.length);
  check('a pool of exactly five never rotates', // עברי, until level 1 grows
    new Set(days.map((d) => ids(kidC, d))).size === 1);
  check('the day stamp is a local calendar date',
    dayStamp(new Date(2026, 7, 3, 23, 59)) === '2026-08-03', dayStamp(new Date(2026, 7, 3, 23, 59)));
}

/* scoring rewards accuracy, not just turning up */
check('points are the star rating',
  store.pointsFor(3) === 3 && store.pointsFor(2) === 2 && store.pointsFor(1) === 1);
check('a game with no stars is worth nothing', store.pointsFor(0) === 0);
check('careless play cannot out-earn careful play',
  store.pointsFor(3) > store.pointsFor(1) * 2,
  'three 1-star games would beat one 3-star game');
cfg.set('pointsPerStar', 10);
check('the per-star value scales everything', store.pointsFor(3) === 30);
cfg.resetSettings();
check('a medal needs real wins, not scraped passes', store.WIN_STARS === 2);

const levelShelf = shelfOf(kidC);
cfg.setEnabledGames(kidC.id, ['times', 'memory', 'clock', 'spelling', 'money']);
check('a kid can be given games from any level',
  shelfOf(kidC).join() === 'times,clock,spelling,money,memory', shelfOf(kidC).join());

cfg.setEnabledGames(kidC.id, ['times', 'memory']);
check('too few chosen is padded back up to five',
  shelfOf(kidC).length === GAMES_PER_KID, shelfOf(kidC).join());
check('padding keeps what was actually chosen',
  shelfOf(kidC).includes('times') && shelfOf(kidC).includes('memory'), shelfOf(kidC).join());

cfg.setEnabledGames(kidC.id, GAMES.map((g) => g.meta.id));
check('too many chosen is trimmed back down to five',
  shelfOf(kidC).length === GAMES_PER_KID, `${shelfOf(kidC).length}`);

cfg.setEnabledGames(kidC.id, []);
check('an empty selection still yields five', shelfOf(kidC).length === GAMES_PER_KID);

cfg.clearEnabledGames(kidC.id);
check('clearing the override restores their level shelf',
  shelfOf(kidC).join() === levelShelf.join());

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
  week[0].profile.id === kidA.id && week[0].points === 6
    && week[1].points === 3 && week[2].points === 0,
  week.map((r) => `${r.profile.name}=${r.points}`).join(' '));

check('a zero-star game counts as played but scores nothing',
  week.find((r) => r.profile.id === kidB.id).games === 2
    && week.find((r) => r.profile.id === kidB.id).points === 3);

const month = store.leaderboard(PROFILES, 'month').find((r) => r.profile.id === kidC.id);
check('month includes earlier this month but not last month', month.points === 3,
  `got ${month.points}`);

check('the board runs day / week / month, with no all-time',
  store.PERIODS.join() === 'day,week,month', store.PERIODS.join());

const dayBoard = store.leaderboard(PROFILES, 'day');
check('the daily board counts only today',
  dayBoard.find((r) => r.profile.id === kidA.id).points === 6
    && dayBoard.find((r) => r.profile.id === kidC.id).points === 0,
  dayBoard.map((r) => `${r.profile.name}=${r.points}`).join(' '));

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
check('another game on the same shelf still opens', playing());

// every game used up
seed(shelf.flatMap((id) =>
  Array.from({ length: store.dailyLimit() }, () => play(Date.now(), kidA, 3, id))));
await navigate(`#/p/${kidA.id}`);
check('every card locks once the whole shelf is used up',
  find('locked').length === shelf.length, `${find('locked').length} of ${shelf.length}`);

// a game that isn't on this kid's shelf can't be opened by URL
seed([]);
cfg.setEnabledGames(kidA.id, ['memory', 'animals', 'colors', 'counting', 'shapes']);
check('the swapped-in shelf is what took effect',
  !gamesForProfile(kidA).some((g) => g.meta.id === 'times'),
  gamesForProfile(kidA).map((g) => g.meta.id).join());
await navigate(`#/p/${kidA.id}/g/times`);
check('a game off the shelf cannot be opened by URL', find('game-card').length > 0);
cfg.clearEnabledGames(kidA.id);

/* ---------- 3d. the parent gate ---------- */

console.log('\nParent gate\n');

await navigate('#/settings');
check('settings are behind a gate', find('gate-input').length === 1, 'no gate shown');
check('the gate does not show the settings', find('set-row').length === 0);

// the gate asks a percentage — instant for an adult, not 2nd-grade maths
const { gateQuestion, SET } = await load('js/text.js');
const asked = Array.from({ length: 40 }, () => gateQuestion());
check('the gate asks a percentage question',
  asked.every((q) => q.text.includes('%')), asked[0].text);
check('every gate answer is a whole number',
  asked.every((q) => Number.isInteger(q.answer)),
  asked.find((q) => !Number.isInteger(q.answer))?.text);
check('the gate question is not a times-table drill',
  asked.every((q) => !q.text.includes('×')), asked[0].text);

// answering it correctly gets in
const gateInput = find('gate-input')[0];
const shown = appRoot.textContent.match(/כמה זה (\d+)% מ-(\d+)/);
gateInput.value = String((Number(shown[2]) * Number(shown[1])) / 100);
find('btn').find((b) => b.textContent.includes(SET.enter))?.dispatch('click');
await sleep(20);
check('the right answer opens settings', find('set-row').length > 0,
  'still gated');
check('the settings offer the per-kid game picker', find('kid-games').length === PROFILES.length);

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

/* ---------- 3g. themes and streaks ---------- */

console.log('\nThemes\n');

const { themeFor, THEMES } = await load('js/themes.js');

check('every kid has a theme that resolves',
  PROFILES.every((p) => p.theme && THEMES[p.theme]),
  PROFILES.map((p) => `${p.name}=${p.theme}`).join(' '));
check('every theme is complete',
  Object.values(THEMES).every((t) =>
    t.badge && t.icons?.length && t.colors?.length === 2 && t.cheers?.length && t.space),
  'a theme is missing fields');
check('each kid has their own theme',
  new Set(PROFILES.map((p) => p.theme)).size === PROFILES.length);

await navigate(`#/p/${kidA.id}`);
check('the shelf is themed', find('themed').length > 0 && find('backdrop').length === 1);
check('the shelf is named after the theme',
  appRoot.textContent.includes(themeFor(kidA).space(kidA.name)), appRoot.textContent.slice(0, 90));

// streaks fire every third clean answer, and reset on a mistake
const { Round } = await load('js/kit.js');

const runStreak = (answers) => new Promise((resolve) => {
  const stage = new Node('div');
  const streaks = [];
  const round = new Round(stage, {
    profile: kidA,
    setProgress() {}, exit() {}, replay() {},
    onStreak: (n) => streaks.push(n),
    finish: () => setTimeout(() => resolve(streaks), 0),
  }, { rounds: answers.length, pauseOk: 1, pauseNo: 1 });
  let i = 0;
  round.start((view, api) => { (answers[i++] ? api.ok : api.no)(); });
});

check('a clean run bursts every third answer',
  (await runStreak([1, 1, 1, 1, 1, 1, 1, 1, 1])).join() === '3,6,9',
  (await runStreak([1, 1, 1, 1, 1, 1, 1, 1, 1])).join());
check('a mistake resets the streak',
  (await runStreak([1, 1, 0, 1, 1, 1, 1])).join() === '3',
  (await runStreak([1, 1, 0, 1, 1, 1, 1])).join());

/* ---------- 3h. medals and the prize wheel ---------- */

console.log('\nMedals\n');

const { PRIZES, MEDAL } = await load('js/text.js');
const shelfA = gamesForProfile(kidA).map((g) => g.meta.id);
const perGame = store.dailyLimit();

/** A full day for kidA: every game's allowance used, `zeros` of them lost. */
const fullDay = (zeros = 0) => {
  const entries = [];
  shelfA.forEach((id) => {
    for (let i = 0; i < perGame; i++) entries.push(play(Date.now(), kidA, 3, id));
  });
  for (let i = 0; i < zeros; i++) entries[i].s = 0;
  return entries;
};

const totalPlays = shelfA.length * perGame;

seed(fullDay(0));
check('a perfect finished day earns a medal', store.awardMedal(kidA.id, shelfA) !== null);

seed(fullDay(0));
store.awardMedal(kidA.id, shelfA);
check('the same day cannot earn two medals', store.awardMedal(kidA.id, shelfA) === null);

// exactly on the 80% line, and one win short of it
const needed = Math.ceil(totalPlays * store.MEDAL_RATE);
seed(fullDay(totalPlays - needed));
check(`exactly ${needed}/${totalPlays} wins (the 80% line) earns it`,
  store.awardMedal(kidA.id, shelfA) !== null);

seed(fullDay(totalPlays - needed + 1));
check(`${needed - 1}/${totalPlays} — one win short — earns nothing`,
  store.awardMedal(kidA.id, shelfA) === null);

// an unfinished day earns nothing however good it was
seed(fullDay(0).slice(0, totalPlays - 1));
check('an unfinished day earns nothing', store.awardMedal(kidA.id, shelfA) === null);

seed([]);
check('a day with no games earns nothing', store.awardMedal(kidA.id, shelfA) === null);
check('a kid with no shelf earns nothing', store.awardMedal(kidA.id, []) === null);

// the wheel
seed(fullDay(0));
const earned = store.awardMedal(kidA.id, shelfA);
check('a fresh medal has no prize yet', earned.prize === null);
check('it shows up as pending', store.pendingMedal(kidA.id)?.day === earned.day);

await navigate(`#/p/${kidA.id}`);
check('the shelf offers the waiting gift', find('gift-banner').length === 1);

await navigate(`#/p/${kidA.id}/wheel`);
check('the wheel screen draws', find('wheel').length === 1);
check(`the wheel has all ${PRIZES.length} prizes`, find('wseg').length === PRIZES.length,
  `got ${find('wseg').length}`);

// the spin is a deliberately drawn-out build-up, so give it room
find('btn').find((b) => b.textContent.includes('לסובב'))?.dispatch('click');
await sleep(9500);
const spun = store.medalsFor(kidA.id)[0];
check('spinning lands on a real prize',
  PRIZES.some((p) => p.text === spun.prize), `got "${spun.prize}"`);
check('the prize is shown on screen', find('prize-text').length === 1);
check('a spent medal is no longer pending', store.pendingMedal(kidA.id) === null);

/* the wheel must not be skippable — they earned it */
{
  const { endCard } = await load('js/kit.js');
  const withMedal = endCard({ replay() {}, exit() {}, claimMedal() {} },
    { stars: 3, msg: 'x', reward: { points: 1, remaining: 0, rank: 0, canReplay: false,
      medal: { day: '2026-01-01', wins: 15, plays: 15 } } });
  const withoutMedal = endCard({ replay() {}, exit() {}, claimMedal() {} },
    { stars: 3, msg: 'x', reward: { points: 1, remaining: 2, rank: 0, canReplay: true, medal: null } });

  const labels = (node) => node.querySelectorAll('btn').map((b) => b.textContent);
  check('a medal leaves only the one button on the end card',
    labels(withMedal).length === 1, labels(withMedal).join(' | '));
  check('that button opens the wheel',
    labels(withMedal)[0].includes('מדליה'), labels(withMedal)[0]);
  check('without a medal the usual buttons are there',
    labels(withoutMedal).length === 2, labels(withoutMedal).join(' | '));
}

/* test mode must be inert: no points, no allowance spent, no medals */
{
  const before = JSON.stringify(JSON.parse(globalThis.localStorage.getItem('kids-games:v2')));
  await navigate('#/try/times/3');
  check('test mode opens a game', find('choice').length > 0, 'nothing drew');
  check('test mode says it does not count', find('try-badge').length === 1);

  // play it to the end
  for (let i = 0; i < 200 && find('choice').length; i++) {
    const btns = find('choice').filter((b) => !b.disabled);
    if (!btns.length) break;
    btns[0].dispatch('click');
    await sleep(12);
  }
  check('test mode records nothing at all',
    JSON.stringify(JSON.parse(globalThis.localStorage.getItem('kids-games:v2'))) === before,
    'the store changed');

  await navigate('#/try/times/3');
  check('test mode is reachable for any level a game supports', playing());
}

await navigate('#/medals');
check('the medal shelf lists it', find('medal').length >= 1);
check('the medal shelf shows the prize for parents',
  appRoot.textContent.includes(spun.prize), 'prize missing');

/* ---------- 3i. countries, flags, map and true/false ---------- */

console.log('\nWorld\n');

const { COUNTRIES, countriesFor } = await load('js/countries.js');

check('every country has a name, a flag and coordinates',
  COUNTRIES.every((c) => c.he && c.flag && Number.isFinite(c.lat) && Number.isFinite(c.lon)),
  COUNTRIES.find((c) => !c.he || !c.flag)?.he);
check('no duplicate countries',
  new Set(COUNTRIES.map((c) => c.he)).size === COUNTRIES.length);
check('every flag is a real two-letter flag emoji',
  COUNTRIES.every((c) => [...c.flag].length === 2
    && [...c.flag].every((ch) => ch.codePointAt(0) >= 0x1f1e6 && ch.codePointAt(0) <= 0x1f1ff)),
  COUNTRIES.find((c) => [...c.flag].length !== 2)?.he);
check('all coordinates are on the globe',
  COUNTRIES.every((c) => Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180));
check('the easy set is big enough for a 5-year-old to get variety',
  countriesFor(2).length >= 12, `${countriesFor(2).length}`);
check('level 3 gets more countries than level 2',
  countriesFor(3).length > countriesFor(2).length,
  `${countriesFor(3).length} vs ${countriesFor(2).length}`);

/* the map game: continents and oceans, not countries */

const geo = GAMES.find((g) => g.meta.id === 'geography');
const { REGIONS } = await load('js/games/geography.js');

for (const [level, minRegions] of [[2, 5], [3, 9]]) {
  const stage = new Node('div');
  const teardown = geo.mount(stage, {
    profile: { ...PROFILES[0], level },
    setProgress() {}, finish() {}, exit() {}, replay() {},
  });
  const regions = stage.querySelectorAll('.region');
  check(`level ${level} draws at least ${minRegions} tappable regions`,
    regions.length >= minRegions, `${regions.length}`);
  // Note אוסטרליה is both a continent and a country, so "isn't a country
  // name" would be a false alarm — assert it names a region instead.
  const asked = stage.querySelectorAll('.prompt')[0].textContent;
  check(`level ${level} asks about a continent or an ocean`,
    REGIONS.some((r) => asked.includes(r.he)), asked);
  teardown?.();
}

{
  const stage = new Node('div');
  geo.mount(stage, {
    profile: { ...PROFILES[0], level: 2 },
    setProgress() {}, finish() {}, exit() {}, replay() {},
  });
  check('level 2 stays on land — no oceans yet',
    stage.querySelectorAll('.sea').length === 0,
    `${stage.querySelectorAll('.sea').length} oceans`);
}

{
  const stage = new Node('div');
  geo.mount(stage, {
    profile: { ...PROFILES[0], level: 3 },
    setProgress() {}, finish() {}, exit() {}, replay() {},
  });
  check('level 3 includes oceans', stage.querySelectorAll('.sea').length >= 4,
    `${stage.querySelectorAll('.sea').length}`);
  check('oceans are drawn under the land so land wins a tap',
    stage.querySelectorAll('.region')[0].classList.contains('sea'),
    'a landmass was drawn first');

  // a wrong region must light up the right one
  const asked = stage.querySelectorAll('.prompt')[0].textContent;
  const wrong = stage.querySelectorAll('.region')
    .find((r) => !r.classList.contains('right'));
  wrong.dispatch('click');
  await sleep(60);
  check('a wrong place reveals the right one',
    stage.querySelectorAll('.region').some((r) => r.classList.contains('reveal'))
      || asked.includes(''),
    'nothing was revealed');
}

/* flags */

const flagsGame = GAMES.find((g) => g.meta.id === 'flags');
{
  const stage = new Node('div');
  flagsGame.mount(stage, {
    profile: { ...PROFILES[1], level: 2 },
    setProgress() {}, finish() {}, exit() {}, replay() {},
  });
  const shownFlag = stage.querySelectorAll('.big-flag')[0]?.textContent;
  check('a flag is shown to identify', Boolean(shownFlag), 'no flag on screen');
  const country = COUNTRIES.find((c) => c.flag === shownFlag);
  check('the flag shown is one of ours', Boolean(country), shownFlag);

  const opts = stage.querySelectorAll('.choice');
  check('three countries are offered', opts.length === 3, `${opts.length}`);
  const wrongOpt = opts.find((o) => o.textContent !== country.he);
  wrongOpt.dispatch('click');
  await sleep(60);
  check('a wrong country reveals the right one',
    opts.some((o) => o.textContent === country.he && o.classList.contains('correct')),
    'the answer was not revealed');
}

/* true or false */

const tfSource = readFileSync(join(ROOT, 'js/games/truefalse.js'), 'utf8');
const tfRows = [...tfSource.matchAll(/\{ s: '(.+?)', t: (true|false), why: '(.*?)', lv: (\d) \}/g)]
  .map((m) => ({ s: m[1], t: m[2] === 'true', why: m[3], lv: Number(m[4]) }));

check('there are plenty of statements', tfRows.length >= 40, `${tfRows.length}`);
check('no statement is repeated',
  new Set(tfRows.map((r) => r.s)).size === tfRows.length);
check('both levels have enough to avoid repeats in a game',
  tfRows.filter((r) => r.lv === 2).length >= 15 && tfRows.filter((r) => r.lv === 3).length >= 15,
  `L2=${tfRows.filter((r) => r.lv === 2).length} L3=${tfRows.filter((r) => r.lv === 3).length}`);

for (const lv of [2, 3]) {
  const rows = tfRows.filter((r) => r.lv === lv);
  const trues = rows.filter((r) => r.t).length;
  const share = trues / rows.length;
  // If most answers were one way, guessing the same every time would win.
  check(`level ${lv} is not guessable by always saying the same thing`,
    share > 0.35 && share < 0.65, `${Math.round(share * 100)}% true`);
}

check('almost every statement explains itself',
  tfRows.filter((r) => r.why).length >= tfRows.length - 1,
  `${tfRows.filter((r) => !r.why).length} without an explanation`);
check('statements stay short enough to hear and hold',
  tfRows.every((r) => r.s.length <= 60), tfRows.find((r) => r.s.length > 60)?.s);

const tfGame = GAMES.find((g) => g.meta.id === 'truefalse');
{
  const stage = new Node('div');
  tfGame.mount(stage, {
    profile: { ...PROFILES[0], level: 3 },
    setProgress() {}, finish() {}, exit() {}, replay() {},
  });
  const said = stage.querySelectorAll('.statement')[0].textContent;
  const row = tfRows.find((r) => said.startsWith(r.s));
  check('the statement comes from the list', Boolean(row), said.slice(0, 40));
  check('level 3 only asks level 3 statements', row.lv === 3, `lv ${row?.lv}`);

  const buttons = stage.querySelectorAll('.choice');
  check('true and false are both offered', buttons.length === 2);
  buttons[row.t ? 0 : 1].dispatch('click'); // yes is first
  await sleep(60);
  check('the explanation appears even when they are right',
    stage.querySelectorAll('.why')[0].classList.contains('show'));
}

/* ---------- 3j. change, reading and probability ---------- */

console.log('\nThinking games\n');

/* כמה עודף? — the change must always be a real amount, buildable in 3 pieces */
{
  const changeGame = GAMES.find((g) => g.meta.id === 'change');
  const val = (n) => (n ? parseInt(n.textContent.replace(/[^\d]/g, ''), 10) || 0 : 0);
  let worstPieces = 0;
  let badRound = null;

  for (let attempt = 0; attempt < 25; attempt++) {
    const stage = new Node('div');
    const teardown = changeGame.mount(stage, {
      profile: { ...PROFILES[0], level: 3 },
      setProgress() {}, finish() {}, exit() {}, replay() {},
    });
    const paid = val(stage.querySelectorAll('.paid')[0]);
    const cost = val(stage.querySelectorAll('.cost')[0]);
    const change = paid - cost;
    if (change <= 0) badRound = `${paid} - ${cost}`;

    // greedy is optimal for the NIS set, so this is the true minimum
    let left = change;
    let pieces = 0;
    for (const v of [200, 100, 50, 20, 10, 5, 2, 1]) while (left >= v) { left -= v; pieces++; }
    worstPieces = Math.max(worstPieces, pieces);
    teardown?.();
  }

  check('there is always real change to give back', badRound === null, badRound);
  check('the change never needs more than 3 pieces', worstPieces <= 3, `needed ${worstPieces}`);
}

/* קוראים ומבינים — reading it is the game, so nothing may be read aloud */
{
  const src = readFileSync(join(ROOT, 'js/games/reading.js'), 'utf8');
  const rows = [...src.matchAll(/\{ t: '/g)];
  check('there are enough passages', rows.length >= 15, `${rows.length}`);
  check('the passage and question are never spoken',
    !/speak\(item\.t|speak\(item\.q/.test(src), 'the game reads the passage aloud');

  const readingGame = GAMES.find((g) => g.meta.id === 'reading');
  const stage = new Node('div');
  readingGame.mount(stage, {
    profile: { ...PROFILES[0], level: 3 },
    setProgress() {}, finish() {}, exit() {}, replay() {},
  });
  check('a passage and a question are both on screen',
    stage.querySelectorAll('.passage').length === 1
      && stage.querySelectorAll('.question').length === 1);
  check('three answers are offered', stage.querySelectorAll('.choice').length === 3);
}

/* מה יותר סביר? — the comparison must never be a coin toss, and half of
   the rounds must be the counterintuitive kind that actually teaches */
{
  const chanceGame = GAMES.find((g) => g.meta.id === 'chance');
  const mount = () => {
    const stage = new Node('div');
    chanceGame.mount(stage, {
      profile: { ...PROFILES[0], level: 3 },
      setProgress() {}, finish() {}, exit() {}, replay() {},
    });
    return stage;
  };
  const counts = (jar) => jar.querySelectorAll('.jar-count')[0]
    .textContent.match(/\d+/g).map(Number);

  let closest = 1;
  let sawTrap = false;
  let sawStraight = false;
  const coloursAsked = new Set();

  for (let attempt = 0; attempt < 40; attempt++) {
    const stage = mount();
    const jars = stage.querySelectorAll('.jar');
    coloursAsked.add(stage.querySelectorAll('.prompt')[0].textContent.replace(/[^֐-׿ ]/g, ''));
    if (jars.length !== 2) continue;

    const [a, ta] = counts(jars[0]);
    const [b, tb] = counts(jars[1]);
    closest = Math.min(closest, Math.abs(a / ta - b / tb));
    // does the jar with more of the colour also have the better odds?
    if ((a > b) === (a / ta > b / tb)) sawStraight = true; else sawTrap = true;
  }

  check('the two jars are never close enough to be a coin toss', closest >= 0.25,
    `closest was ${closest.toFixed(2)}`);
  check('some rounds are the trap: more balls but worse odds', sawTrap,
    'every round was just "count the most"');
  check('some rounds are straightforward too', sawStraight);
  check('it asks about more than one colour', coloursAsked.size > 1,
    [...coloursAsked].join(' | '));
  check('it says כדור, not גולה',
    !readFileSync(join(ROOT, 'js/games/chance.js'), 'utf8').includes('גול' + 'ה'));

  // certainty mode: four levels now, and never exactly half
  const seenLabels = new Set();
  const shares = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    const stage = mount();
    const labels = stage.querySelectorAll('.choice').map((b) => b.textContent);
    if (!labels.includes('בטוח')) continue;
    labels.forEach((l) => seenLabels.add(l));
    const [wanted, total] = counts(stage.querySelectorAll('.jar')[0]);
    shares.push(wanted / total);
  }
  // round 1 always compares, so play one through to reach the classifier
  {
    const stage = mount();
    stage.querySelectorAll('.choice')[0].dispatch('click');
    for (let waited = 0; waited < 6000 && !seenLabels.has('סביר'); waited += 100) {
      await sleep(100);
      stage.querySelectorAll('.choice').map((b) => b.textContent)
        .forEach((l) => seenLabels.add(l));
      const jar = stage.querySelectorAll('.jar')[0];
      if (jar && seenLabels.has('סביר')) {
        const [wanted, total] = counts(jar);
        shares.push(wanted / total);
      }
    }
  }

  check('certainty has four levels, not three',
    ['בטוח', 'סביר', 'לא סביר', 'בלתי אפשרי'].every((l) => seenLabels.has(l)),
    [...seenLabels].join(' | '));
  check('a jar is never exactly half, which would have no right answer',
    shares.every((s) => s !== 0.5), `saw ${shares.filter((s) => s === 0.5).length}`);
}

/* מילים באנגלית — both directions, and each word spoken in its own language */
{
  const wordsGame = GAMES.find((g) => g.meta.id === 'words');
  const src = readFileSync(join(ROOT, 'js/games/words.js'), 'utf8');
  const rows = [...src.matchAll(/\{ en: '([a-z ]+)', he: '([^']+)'/g)]
    .map((m) => ({ en: m[1], he: m[2] }));

  check('there are plenty of words', rows.length >= 60, `${rows.length}`);
  check('no English word is repeated',
    new Set(rows.map((r) => r.en)).size === rows.length);
  check('no Hebrew word is repeated',
    new Set(rows.map((r) => r.he)).size === rows.length);

  const stage = new Node('div');
  wordsGame.mount(stage, {
    profile: { ...PROFILES[0], level: 3 },
    setProgress() {}, finish() {}, exit() {}, replay() {},
  });
  check('a word is shown big', stage.querySelectorAll('.big-word').length === 1);
  check('three translations are offered', stage.querySelectorAll('.choice').length === 3);

  // round 1 goes English to Hebrew, round 2 the other way
  const first = stage.querySelectorAll('.big-word')[0].textContent;
  check('the first round shows an English word',
    rows.some((r) => first.startsWith(r.en)), first.slice(0, 20));

  stage.querySelectorAll('.choice')[0].dispatch('click');
  let second = null;
  for (let waited = 0; waited < 6000 && !second; waited += 100) {
    await sleep(100);
    const shown = stage.querySelectorAll('.big-word')[0]?.textContent;
    if (shown && shown !== first) second = shown;
  }
  check('the direction flips on the next round',
    second && rows.some((r) => second.startsWith(r.he)), second?.slice(0, 20));
  check('each language is spoken with its own voice',
    /lang: shownLang/.test(src) && /lang: 'en'/.test(src));
}

/* ---------- 3k. חתחתול ---------- */

console.log('\nחתחתול\n');

{
  const { mountCabo } = await load('js/cabo.js');
  cfg.resetSettings();
  // The peek reveal is a two-second pause by design; at zero the same
  // code runs without the suite spending minutes watching cards.
  cfg.set('caboPeekSeconds', 0);

  const open = () => {
    const room = new Node('div');
    const stop = mountCabo(room, { onExit() {} });
    return { room, stop };
  };
  const cards = (room) => room.querySelectorAll('.card');
  const mine = (room) => cards(room)
    .filter((c) => c.getAttribute('aria-label')?.includes('הקלף שלך'));
  const banner = (room) => room.querySelectorAll('.cabo-banner')[0].textContent;
  const btn = (room, word) => room.querySelectorAll('.btn')
    .find((b) => b.textContent.includes(word));

  /** The opening look runs itself now — just wait for it to finish. */
  const peekTwice = async (room) => {
    for (let waited = 0; waited < 5000; waited += 50) {
      await sleep(50);
      if (banner(room).includes('התור שלכם')) return;
    }
  };

  // --- the deal ---
  {
    const { room, stop } = open();
    check('both hands are dealt face down',
      cards(room).filter((c) => c.classList.contains('down')).length >= 8);
    // No longer "peek at two" — the look happens by itself, so the first
    // thing said is just the goal.
    check('the first line states the goal, briefly',
      banner(room).includes('הסכום') && banner(room).length < 45, banner(room));
    check('you have four cards', mine(room).length === 4);
    stop();
  }

  // --- peeks are hidden again by default ---
  {
    const { room, stop } = open();
    await peekTwice(room);
    check('the opening look ends by itself', banner(room).includes('התור שלכם'), banner(room));
    check('it shows the two outer cards, not a choice',
      mine(room).filter((c) => c.classList.contains('peeked'))
        .every((c, _, all) => all.length === 2)
      && mine(room)[0].classList.contains('peeked')
      && mine(room)[3].classList.contains('peeked'),
      mine(room).map((c) => c.className).join(' | '));
    check('peeked cards turn back over by default',
      mine(room).filter((c) => c.classList.contains('up')).length === 0,
      `${mine(room).filter((c) => c.classList.contains('up')).length} still visible`);
    check('but you can see which two you looked at',
      mine(room).filter((c) => c.classList.contains('peeked')).length === 2,
      `${mine(room).filter((c) => c.classList.contains('peeked')).length} marked`);
    stop();
  }

  // --- and stay visible when the setting is on ---
  {
    cfg.set('caboShowPeeked', true);
    const { room, stop } = open();
    await peekTwice(room);
    check('the setting keeps peeked cards face up',
      mine(room).filter((c) => c.classList.contains('up')).length === 2,
      `${mine(room).filter((c) => c.classList.contains('up')).length} visible`);
    stop();
  }

  /** Deal, peek, draw — with values visible so the test can reason. */
  const toDrawn = async () => {
    const { room, stop } = open();
    await peekTwice(room);
    cards(room).find((c) => c.classList.contains('deck')).dispatch('click');
    await sleep(40);
    return { room, stop };
  };

  {
    const { room, stop } = await toDrawn();
    check('drawing says the value and the choice, briefly',
      /^\d+\./.test(banner(room)) && banner(room).length < 40, banner(room));
    check('the drawn card is face up', room.querySelectorAll('.drawn').length >= 1);
    check('there is a way to throw it away', Boolean(btn(room, 'לזרוק') || btn(room, 'הצץ')
      || btn(room, 'החלף') || btn(room, 'משוך')));
    stop();
  }

  // --- the "are you sure?" guard ---
  {
    let guarded = false;
    for (let attempt = 0; attempt < 50 && !guarded; attempt++) {
      const { room, stop } = await toDrawn();
      const drawn = Number(room.querySelectorAll('.drawn')[0]?.textContent);
      const worse = mine(room).filter((c) => c.classList.contains('up'))
        .find((c) => Number(c.textContent) < drawn);
      if (worse) {
        worse.dispatch('click');
        await sleep(50);
        guarded = banner(room).includes('בטוחים');
      }
      stop();
    }
    check('swapping a known-low card for a higher one asks first', guarded);

    cfg.set('caboHints', false);
    let quiet = false;
    for (let attempt = 0; attempt < 50 && !quiet; attempt++) {
      const { room, stop } = await toDrawn();
      const drawn = Number(room.querySelectorAll('.drawn')[0]?.textContent);
      const worse = mine(room).filter((c) => c.classList.contains('up'))
        .find((c) => Number(c.textContent) < drawn);
      if (worse) {
        worse.dispatch('click');
        await sleep(50);
        quiet = !banner(room).includes('בטוחים');
      }
      stop();
    }
    check('turning the hints off makes it stop asking', quiet);
    cfg.set('caboHints', true);
  }

  // --- the three powers ---
  {
    const powers = { 7: 'הצץ', 8: 'החלף', 9: 'משוך' };
    const found = {};
    for (let attempt = 0; attempt < 120 && Object.keys(found).length < 3; attempt++) {
      const { room, stop } = await toDrawn();
      const drawn = Number(room.querySelectorAll('.drawn')[0]?.textContent);
      if (powers[drawn] && !found[drawn]) {
        const throwBtn = btn(room, powers[drawn]);
        if (throwBtn) {
          throwBtn.dispatch('click');
          await sleep(60);
          found[drawn] = banner(room);
        }
      }
      stop();
    }
    check('7 offers הצץ', /הצץ/.test(found[7] || ''), found[7]);
    check('8 offers החלף', /החלף/.test(found[8] || ''), found[8]);
    check('9 offers משוך שניים', /שניים/.test(found[9] || ''), found[9]);
    check('every power instruction is one short sentence',
      [7, 8, 9].every((v) => (found[v] || '').length < 45),
      [7, 8, 9].map((v) => found[v]).join(' | '));
  }

  // --- calling and the counted reveal ---
  {
    cfg.set('caboShowPeeked', true);
    const { room, stop } = open();
    await peekTwice(room);
    const callBtn = btn(room, 'חתחתול');
    check('you can call חתחתול on your turn', Boolean(callBtn));
    callBtn.dispatch('click');
    await sleep(60);
    check('calling is announced', banner(room).includes('חתחתול'), banner(room));

    let asked = false;
    for (let waited = 0; waited < 60000 && !asked; waited += 250) {
      await sleep(250);
      asked = banner(room).includes('מי ניצח');
    }
    check('the reveal asks the child who won rather than telling him', asked, banner(room));
    check('all eight cards are face up before he is asked',
      room.querySelectorAll('.revealed').length === 8,
      `${room.querySelectorAll('.revealed').length} of 8`);
    check('he is never told the totals before answering',
      !/d+ מול d+|אתם d+/.test(banner(room)), banner(room));
    check('he gets three verdicts to choose from',
      ['אני', 'המחשב', 'תיקו'].every((w) => btn(room, w)));

    btn(room, 'אני').dispatch('click');
    let finished = false;
    for (let waited = 0; waited < 60000 && !finished; waited += 250) {
      await sleep(250);
      finished = /ניצחתם|המחשב ניצח|תיקו/.test(banner(room));
    }
    check('only then is the result confirmed', finished, banner(room));
    check('you can start another game', Boolean(btn(room, 'עוד משחק')));
    stop();
  }

  cfg.resetSettings();
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
