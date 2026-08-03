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
  animals, colors, counting,          // level 1
  letters, addsub,                    // level 2
  times, clock, spelling, translate,  // level 3
  money,                              // levels 2-3
  memory,                             // all levels
];

export const gamesForLevel = (level) => GAMES.filter((g) => g.meta.levels.includes(level));

export const getGame = (id) => GAMES.find((g) => g.meta.id === id) || null;

/**
 * The shelf a kid actually sees. Settings can override it per kid (any
 * game can be given to any kid there); with no override they get the
 * games matching their level.
 */
export function gamesForProfile(profile) {
  const chosen = enabledGames(profile.id);
  if (chosen) return GAMES.filter((g) => chosen.includes(g.meta.id));
  return gamesForLevel(profile.level);
}
