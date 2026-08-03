/* ---------------------------------------------------------------
   registry.js — every game, who can play it, and which five each kid
   gets today.

   ➕ TO ADD A GAME:
      1. copy any file in js/games/ as a starting point
      2. import it here and add it to GAMES
      3. add its id to the POOL of every level that should get it
      4. add its path to PRECACHE in sw.js and bump the version there
      5. npm test

   ── THE RULES THIS FILE ENFORCES ─────────────────────────────────

   EXACTLY FIVE A DAY. Every kid's shelf is exactly GAMES_PER_KID
   games, always. With a per-game daily allowance, shelf size sets the
   daily points ceiling — unequal shelves would hand one kid a bigger
   maximum than another and the scoreboard would stop meaning anything.
   Whatever the settings say, gamesForProfile() returns exactly five:
   too many is trimmed, too few is padded.

   THE POOL IS BIGGER THAN THE SHELF. Each level has a pool of games
   that suit that age. The five on the shelf are drawn from it, which
   is what makes rotation possible.

   THE SHELF ROTATES DAILY. The draw is seeded from the kid's id and
   today's date, so it is stable all day (the shelf doesn't reshuffle
   between games) but different tomorrow. Nobody has to curate it.

   A GAME ON SEVERAL LEVELS MUST ADAPT. If meta.levels has more than one
   entry the game has to read ctx.profile.level and play differently, and
   must declare meta.scales — { level: 'what changes' } — which is shown
   on the settings chips and asserted by npm test. A single-level game
   declares no scales. This is what stops a game quietly being handed to
   an age it was never tuned for.

   AGE FIT IS EXPLICIT, NOT INFERRED. A game being playable at a level
   isn't the same as being worth that kid's time — אביתר can play
   חברים מהחווה but shouldn't be given it. POOL below is the judgement
   call about what each age actually gets, and it is the list to edit.
   --------------------------------------------------------------- */

import * as animals from './games/animals.js';
import * as colors from './games/colors.js';
import * as counting from './games/counting.js';
import * as shapes from './games/shapes.js';
import * as letters from './games/letters.js';
import * as addsub from './games/addsub.js';
import * as memory from './games/memory.js';
import * as times from './games/times.js';
import * as clock from './games/clock.js';
import * as spelling from './games/spelling.js';
import * as translate from './games/translate.js';
import * as money from './games/money.js';
import * as flags from './games/flags.js';
import * as geography from './games/geography.js';
import * as truefalse from './games/truefalse.js';
import { enabledGames } from './settings.js';

export const GAMES = [
  animals, colors, counting, shapes,   // toddler
  letters, addsub,                     // early school
  times, clock, spelling, translate,   // school
  money, flags, geography, truefalse,  // spread across ages
  memory,                              // all ages, scales by level
];

export const getGame = (id) => GAMES.find((g) => g.meta.id === id) || null;

/** Games technically built for a level — see POOL for what's actually given. */
export const gamesForLevel = (level) => GAMES.filter((g) => g.meta.levels.includes(level));

export const GAMES_PER_KID = 5;

/* ---------------------------------------------------------------
   ✏️ THE POOL FOR EACH AGE — the main thing to edit in this file.

   Level 1 — עברי (2): no reading, no numbers past five, spoken
     prompts only. Only five games exist at this level, so his shelf is
     fixed until there are more; rotation needs a pool bigger than five.

   Level 2 — אמיתי (5): letters and sounds, numbers to ten, money with
     two coins, the world games at their easy settings. Deliberately
     without צורות (trivial at five) and the level-3 school games.

   Level 3 — אביתר (7): school subjects and the knowledge games at full
     difficulty. Deliberately without the toddler games — he can play
     חברים מהחווה, but it teaches him nothing.

   Games that appear at more than one level adapt themselves from
   ctx.profile.level: לשלם בחנות gives 2 coins vs 3 coins and notes,
   איפה בעולם? 3 markers vs 5, זיכרון 3 vs 6 vs 8 pairs, and דגלים and
   נכון או לא? each draw from an easier or harder set.
   --------------------------------------------------------------- */
const POOL = {
  1: ['animals', 'colors', 'shapes', 'counting', 'memory'],
  2: ['letters', 'addsub', 'counting', 'money', 'memory', 'flags', 'truefalse', 'geography'],
  3: ['times', 'clock', 'spelling', 'translate', 'money', 'flags', 'geography', 'truefalse', 'memory'],
};

/** Everything a kid at this level is allowed to be given. */
export function poolFor(level) {
  const listed = (POOL[level] || []).map(getGame).filter(Boolean);
  return listed.length ? listed : gamesForLevel(level);
}

/* ---------- the daily draw ---------- */

/** FNV-1a: a small, stable string hash. Same string, same number, always. */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — a tiny seeded PRNG, so a seed always gives the same run. */
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Local date as YYYY-MM-DD — the rotation turns over at their midnight. */
export function dayStamp(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * Pick `count` items using a seed, so the same seed always picks the
 * same ones. Fisher-Yates driven by the seeded generator.
 */
function seededPick(list, count, seed) {
  const a = [...list];
  const rand = seededRandom(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, count);
}

/**
 * The five games a kid gets today.
 *
 * Drawn from their pool with a seed of (kid + date), so it holds steady
 * all day and changes overnight without anyone curating it. A per-kid
 * override in settings replaces the pool, not the count — the parent
 * chooses what's eligible, the day chooses which five.
 *
 * Returned in registry order rather than draw order, so the shelf
 * doesn't visually jump around between renders.
 */
export function gamesForProfile(profile, now = new Date()) {
  const chosen = enabledGames(profile.id);
  const pool = chosen
    ? GAMES.filter((g) => chosen.includes(g.meta.id))
    : poolFor(profile.level);

  let shelf = pool.length <= GAMES_PER_KID
    ? [...pool]
    : seededPick(pool, GAMES_PER_KID, hashString(`${profile.id}:${dayStamp(now)}`));

  // Never hand back a short shelf: pad with the games closest to their
  // level, so a half-finished settings change can't shrink someone's day.
  if (shelf.length < GAMES_PER_KID) {
    const have = new Set(shelf.map((g) => g.meta.id));
    const distance = (g) => Math.min(...g.meta.levels.map((l) => Math.abs(l - profile.level)));
    shelf.push(...GAMES
      .filter((g) => !have.has(g.meta.id))
      .sort((a, b) => distance(a) - distance(b))
      .slice(0, GAMES_PER_KID - shelf.length));
  }

  return GAMES.filter((g) => shelf.includes(g));
}
