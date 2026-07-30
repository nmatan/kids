/* ---------------------------------------------------------------
   store.js — progress and scores, kept in localStorage.

   Two things are stored:
     best[profileId][gameId]  best-ever stars, shown on the game shelf
     log[]                    one entry per finished game, for the
                              week / month / all-time leaderboards

   Points are awarded per FINISHED GAME based on stars, not on how many
   questions were in it. That's deliberate: a 2-year-old finding three
   animals and a 7-year-old getting twelve times-tables questions right
   both earn 30 points. The competition is about playing well at your own
   level, not about who got the harder games.
   --------------------------------------------------------------- */

const KEY = 'kids-games:v2';
const MAX_LOG = 3000; // ~years of play; keeps localStorage small

export const POINTS = { 3: 30, 2: 20, 1: 10, 0: 5 };
export const pointsFor = (stars) => POINTS[stars] ?? 0;

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') return { best: raw.best || {}, log: raw.log || [] };
  } catch { /* corrupt or unreadable — start fresh */ }
  return { best: {}, log: [] };
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* private mode or storage full — play continues, just isn't saved */ }
}

/* ---------- per-game progress ---------- */

export function bestStars(profileId, gameId) {
  return read().best[profileId]?.[gameId] ?? 0;
}

/** Record a finished game. Returns the points earned. */
export function recordPlay(profileId, gameId, stars) {
  const data = read();
  const forKid = (data.best[profileId] ||= {});
  forKid[gameId] = Math.max(forKid[gameId] || 0, stars);

  const points = pointsFor(stars);
  data.log.push({ p: profileId, g: gameId, s: stars, pts: points, at: Date.now() });
  if (data.log.length > MAX_LOG) data.log = data.log.slice(-MAX_LOG);

  write(data);
  return points;
}

/* ---------- leaderboards ---------- */

/** Midnight on the most recent Sunday — the week starts on Sunday here. */
export function startOfWeek(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

export function startOfMonth(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

export const PERIODS = ['week', 'month', 'all'];

export function periodStart(period, now = new Date()) {
  if (period === 'week') return startOfWeek(now);
  if (period === 'month') return startOfMonth(now);
  return 0;
}

/**
 * Totals per kid for a period, sorted highest first.
 * Returns one row per profile — including kids with zero, so nobody
 * disappears from the table on a quiet week.
 */
export function leaderboard(profiles, period = 'all', now = new Date()) {
  const since = periodStart(period, now);
  const { log } = read();

  const totals = new Map(profiles.map((p) => [p.id, { profile: p, points: 0, games: 0, stars: 0 }]));
  for (const entry of log) {
    if (entry.at < since) continue;
    const row = totals.get(entry.p);
    if (!row) continue; // a profile that's since been removed
    row.points += entry.pts ?? pointsFor(entry.s);
    row.stars += entry.s;
    row.games++;
  }

  return [...totals.values()].sort((a, b) => b.points - a.points || b.stars - a.stars);
}

/** One kid's points for a period — used on the profile cards. */
export function pointsIn(profileId, period = 'all', now = new Date()) {
  const since = periodStart(period, now);
  return read().log
    .filter((e) => e.p === profileId && e.at >= since)
    .reduce((sum, e) => sum + (e.pts ?? pointsFor(e.s)), 0);
}

export function totalStars(profileId) {
  return Object.values(read().best[profileId] || {}).reduce((sum, s) => sum + s, 0);
}

export function resetAll() {
  write({ best: {}, log: [] });
}
