/* ---------------------------------------------------------------
   registry.js — the list of every game in the app.

   ➕ TO ADD A GAME:
      1. copy any file in js/games/ as a starting point
      2. import it here
      3. add it to GAMES below
      4. add its path to PRECACHE in sw.js and bump the version there
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
import { enabledGames } from './settings.js';

export const GAMES = [
  animals, colors, counting, shapes,  // level 1
  letters, addsub,                    // level 2
  times, clock, spelling, translate,  // level 3
  money,                              // levels 2-3
  memory,                             // levels 1-2
];

export const gamesForLevel = (level) => GAMES.filter((g) => g.meta.levels.includes(level));

export const getGame = (id) => GAMES.find((g) => g.meta.id === id) || null;

/**
 * Every kid has exactly this many games — always, whatever the settings
 * say. Equal shelves mean equal daily ceilings, which is what makes the
 * scoreboard a fair contest. Each level's default list is already 5.
 */
export const GAMES_PER_KID = 5;

/** How far a game's levels sit from this kid's, for sensible padding. */
const distance = (game, level) =>
  Math.min(...game.meta.levels.map((l) => Math.abs(l - level)));

/**
 * The shelf a kid actually sees: their chosen games (or their level's
 * default), forced to exactly GAMES_PER_KID. Too many gets trimmed; too
 * few gets padded with the closest games to their level, so a half-made
 * settings change can never leave someone with a short shelf.
 */
export function gamesForProfile(profile) {
  const chosen = enabledGames(profile.id);
  const base = chosen
    ? GAMES.filter((g) => chosen.includes(g.meta.id))
    : gamesForLevel(profile.level);

  const shelf = base.slice(0, GAMES_PER_KID);
  if (shelf.length < GAMES_PER_KID) {
    const have = new Set(shelf.map((g) => g.meta.id));
    const fill = GAMES.filter((g) => !have.has(g.meta.id))
      .sort((a, b) => distance(a, profile.level) - distance(b, profile.level));
    shelf.push(...fill.slice(0, GAMES_PER_KID - shelf.length));
  }
  return shelf;
}
