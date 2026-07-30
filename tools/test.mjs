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
      // memory-card faces, and cycle through choices in order elsewhere.
      const seen = new Map();
      let cursor = 0;

      for (let step = 0; step < 3000 && stars === null; step++) {
        const cards = stage.querySelectorAll('.mem-card')
          .filter((n) => !n.classList.contains('done') && !n.classList.contains('up'));
        const choices = stage.querySelectorAll('.choice').filter((n) => !n.disabled);

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
      find('choice').length > 0 || find('mem-card').length > 0, 'stage was empty');
  }
}

await navigate('#/p/does-not-exist');
check('unknown profile falls back to home', find('profile').length === PROFILES.length);
await navigate(`#/p/${PROFILES[0].id}/g/does-not-exist`);
check('unknown game falls back to the shelf', find('game-card').length > 0);

await navigate('#/leaders');
check(`leaderboard lists all ${PROFILES.length} kids`,
  find('board-row').length === PROFILES.length, `got ${find('board-row').length}`);

/* ---------- 3. scoring windows ---------- */

console.log('\nScoring\n');

const store = await load('js/store.js');
const DAY = 86400000;
const [kidA, kidB, kidC] = PROFILES;
const now = new Date();

// Build the log by hand so plays can be placed in past weeks and months.
const play = (ms, p, stars) => ({ p: p.id, g: 'memory', s: stars, pts: store.pointsFor(stars), at: ms });
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).getTime();

globalThis.localStorage.setItem('kids-games:v2', JSON.stringify({
  best: {},
  log: [
    play(Date.now(), kidA, 3),                            // 30 this week
    play(Date.now(), kidB, 1), play(Date.now(), kidB, 1), // 20 this week
    play(store.startOfWeek(now) - DAY, kidC, 3),          // 30 earlier this month
    play(lastMonth, kidC, 3),                             // 30 before this month
  ],
}));

const week = store.leaderboard(PROFILES, 'week');
check('week counts only this week, ranked highest first',
  week[0].profile.id === kidA.id && week[0].points === 30
    && week[1].points === 20 && week[2].points === 0,
  week.map((r) => `${r.profile.name}=${r.points}`).join(' '));

const month = store.leaderboard(PROFILES, 'month').find((r) => r.profile.id === kidC.id);
check('month includes earlier this month but not last month', month.points === 30,
  `got ${month.points}`);

const all = store.leaderboard(PROFILES, 'all').find((r) => r.profile.id === kidC.id);
check('all time counts everything', all.points === 60, `got ${all.points}`);

check('every kid appears even with no plays', week.length === PROFILES.length);
check('the week starts on Sunday', new Date(store.startOfWeek(now)).getDay() === 0);
check('stars map to points', store.pointsFor(3) === 30 && store.pointsFor(0) === 5);

console.log(fails ? `\n[31m${fails} failure(s)[0m\n` : '\n[32mAll good.[0m\n');
process.exit(fails ? 1 : 0);
