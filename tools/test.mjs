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

const { GAMES, gamesForLevel, defaultShelf } = await load('js/registry.js');
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
        const pins = stage.querySelectorAll('.pin').filter((n) => !n.disabled);

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

await navigate('#/');
check(`home lists all ${PROFILES.length} kids`, find('profile').length === PROFILES.length,
  `got ${find('profile').length}`);
check('home shows every kid by name', PROFILES.every((p) => appRoot.textContent.includes(p.name)));

for (const p of PROFILES) {
  await navigate(`#/p/${p.id}`);
  const expected = defaultShelf(p.level);
  check(`${p.name} (level ${p.level}) sees ${expected.length} games`,
    find('game-card').length === expected.length, `got ${find('game-card').length}`);

  for (const g of expected) {
    await navigate(`#/p/${p.id}/g/${g.meta.id}`);
    check(`  ${p.name} → ${g.meta.title} draws its first round`,
      find('choice').length > 0 || find('mem-card').length > 0
        || find('money').length > 0 || find('pin').length > 0,
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
check('defaults: 3 plays of each game per day', cfg.get('dailyLimit') === 3,
  `got ${cfg.get('dailyLimit')}`);

cfg.set('pointsPerWin', 7);
check('changing points per win takes effect', store.pointsFor(3) === 7, `got ${store.pointsFor(3)}`);
cfg.resetSettings();
check('resetting settings restores the default', store.pointsFor(3) === 1);

check('a win scores, whatever the star count',
  store.pointsFor(1) === 1 && store.pointsFor(2) === 1 && store.pointsFor(3) === 1);
check('finishing with no stars scores nothing', store.pointsFor(0) === 0);

/* every shelf is exactly five games, always — equal shelves are what
   make the daily ceilings equal and the scoreboard a fair contest */
const { GAMES_PER_KID } = await load('js/registry.js');
const shelfOf = (p) => gamesForProfile(p).map((g) => g.meta.id);

check(`every kid's default shelf is exactly ${GAMES_PER_KID}`,
  PROFILES.every((p) => shelfOf(p).length === GAMES_PER_KID),
  PROFILES.map((p) => `${p.name}=${shelfOf(p).length}`).join(' '));
check('every starting shelf is exactly five',
  [1, 2, 3].every((l) => defaultShelf(l).length === GAMES_PER_KID),
  [1, 2, 3].map((l) => `L${l}=${defaultShelf(l).length}`).join(' '));
check('levels 2 and 3 have more games than slots, to rotate through',
  gamesForLevel(2).length > GAMES_PER_KID && gamesForLevel(3).length > GAMES_PER_KID,
  `L2=${gamesForLevel(2).length} L3=${gamesForLevel(3).length}`);
check('every default shelf game really is for that level',
  [1, 2, 3].every((l) => defaultShelf(l).every((g) => g.meta.levels.includes(l))));

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
  week[0].profile.id === kidA.id && week[0].points === 3
    && week[1].points === 1 && week[2].points === 0,
  week.map((r) => `${r.profile.name}=${r.points}`).join(' '));

check('a zero-star game counts as played but scores nothing',
  week.find((r) => r.profile.id === kidB.id).games === 2
    && week.find((r) => r.profile.id === kidB.id).points === 1);

const month = store.leaderboard(PROFILES, 'month').find((r) => r.profile.id === kidC.id);
check('month includes earlier this month but not last month', month.points === 1,
  `got ${month.points}`);

check('the board runs day / week / month, with no all-time',
  store.PERIODS.join() === 'day,week,month', store.PERIODS.join());

const dayBoard = store.leaderboard(PROFILES, 'day');
check('the daily board counts only today',
  dayBoard.find((r) => r.profile.id === kidA.id).points === 3
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

await navigate('#/medals');
check('the medal shelf lists it', find('medal').length >= 1);
check('the medal shelf shows the prize for parents',
  appRoot.textContent.includes(spun.prize), 'prize missing');

/* ---------- 3i. countries, flags, map and true/false ---------- */

console.log('\nWorld\n');

const { COUNTRIES, countriesFor, LAND_PATHS, positionOf } = await load('js/countries.js');

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
check('a marker never lands outside the map',
  COUNTRIES.every((c) => {
    const at = positionOf(c);
    return at.left >= 0 && at.left <= 100 && at.top >= 0 && at.top <= 100;
  }));
check('the easy set is big enough for a 5-year-old to get variety',
  countriesFor(2).length >= 12, `${countriesFor(2).length}`);
check('level 3 gets more countries than level 2',
  countriesFor(3).length > countriesFor(2).length,
  `${countriesFor(3).length} vs ${countriesFor(2).length}`);
check('the map has landmasses to draw', LAND_PATHS.length >= 8, `${LAND_PATHS.length}`);
check('every land path is well formed',
  LAND_PATHS.every((d) => /^M[\d.,L-]+Z$/.test(d)),
  LAND_PATHS.find((d) => !/^M[\d.,L-]+Z$/.test(d))?.slice(0, 40));

// a couple of spot checks that the projection is the right way up
const israel = COUNTRIES.find((c) => c.he === 'ישראל');
const australia = COUNTRIES.find((c) => c.he === 'אוסטרליה');
const canada = COUNTRIES.find((c) => c.he === 'קנדה');
check('Australia plots below Israel', positionOf(australia).top > positionOf(israel).top);
check('Canada plots left of Israel', positionOf(canada).left < positionOf(israel).left);

/* the map game */

const geo = GAMES.find((g) => g.meta.id === 'geography');
for (const [level, pins] of [[2, 3], [3, 5]]) {
  const stage = new Node('div');
  const teardown = geo.mount(stage, {
    profile: { ...PROFILES[0], level },
    setProgress() {}, finish() {}, exit() {}, replay() {},
  });
  check(`the map offers ${pins} places to choose at level ${level}`,
    stage.querySelectorAll('.pin').length === pins,
    `${stage.querySelectorAll('.pin').length}`);
  check(`level ${level} draws the world behind them`,
    stage.querySelectorAll('.world').length === 1);
  teardown?.();
}

// a wrong tap must light up where the country actually was
{
  const stage = new Node('div');
  geo.mount(stage, {
    profile: { ...PROFILES[0], level: 3 },
    setProgress() {}, finish() {}, exit() {}, replay() {},
  });
  const asked = stage.querySelectorAll('.prompt')[0].textContent;
  const pinList = stage.querySelectorAll('.pin');
  const wrongPin = pinList.find((p) => !asked.includes(p.getAttribute('aria-label')));
  wrongPin.dispatch('click');
  await sleep(60);
  check('a wrong place reveals the right one',
    stage.querySelectorAll('.pin').some((p) => p.classList.contains('reveal')),
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
