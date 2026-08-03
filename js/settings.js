/* ---------------------------------------------------------------
   settings.js — everything configurable, in one place.

   Edited from the ⚙ settings screen (home → gear, behind a parent gate)
   and stored in localStorage. This is the dumping ground for future
   options: add a key to DEFAULTS, add a row to the settings screen in
   app.js, and it's live.

   Deliberately imports nothing — store.js, kit.js and registry.js all
   read from here, so a dependency in the other direction would cycle.
   --------------------------------------------------------------- */

const KEY = 'kids-games:settings:v1';

export const DEFAULTS = {
  /** Games a kid may finish per DAY, across their whole shelf.
      Per-kid rather than per-game, so shelf size can't buy points. */
  dailyLimit: 5,

  /** Points for winning a game. Every win is worth the same, so the
      kids can count the scoreboard themselves. */
  pointsPerWin: 1,

  /** Questions per game. 0 = whatever each game asks for by default. */
  rounds: 0,

  speech: true,    // spoken prompts and the end-of-game cheer
  sound: true,     // beeps and chimes
  confetti: true,  // the celebration burst

  /** 0 = Sunday (Israeli week), 1 = Monday. Drives the weekly board. */
  weekStartsOn: 0,

  /** profileId -> [gameId]. Absent means "whatever matches their level". */
  games: {},
};

/* Read fresh every time: no cache to go stale when another screen writes. */
function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') return { ...DEFAULTS, ...raw };
  } catch { /* corrupt — fall back to defaults */ }
  return { ...DEFAULTS };
}

export const all = () => read();

export const get = (key) => read()[key];

export function set(key, value) {
  const next = read();
  next[key] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* storage full or blocked — the change just won't stick */ }
}

export function resetSettings() {
  try { localStorage.removeItem(KEY); } catch {}
}

/* ---------- which games each kid can see ---------- */

/** The kid's chosen game ids, or null to mean "use their level". */
export const enabledGames = (profileId) => read().games[profileId] ?? null;

export function setEnabledGames(profileId, ids) {
  set('games', { ...read().games, [profileId]: [...ids] });
}

/** Drop the override so the kid goes back to their level's default shelf. */
export function clearEnabledGames(profileId) {
  const games = { ...read().games };
  delete games[profileId];
  set('games', games);
}
