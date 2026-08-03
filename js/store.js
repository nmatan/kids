/* ---------------------------------------------------------------
   store.js — progress and scores, kept in localStorage.

   Two things are stored:
     best[profileId][gameId]  best-ever stars, shown on the game shelf
     log[]                    one entry per finished game, for the
                              week / month / all-time leaderboards

   Scoring is deliberately flat: one point per game won, whatever the
   game and whatever the level. A 2-year-old finding three animals and a
   7-year-old getting twelve times-tables questions right both earn the
   same point, so a harder game buys no advantage — and the kids can
   count the board themselves.

   The daily allowance is per kid PER GAME: five plays of each game, each
   day. To collect the day's points you have to play across the shelf
   rather than grinding one favourite.

   Note there is no server and no database — this is localStorage on the
   device, so each tablet keeps its own scores.
   --------------------------------------------------------------- */

import { get } from './settings.js';

const KEY = 'kids-games:v2';
const MAX_LOG = 3000; // ~years of play; keeps localStorage small

/**
 * Every win is worth the same — one point by default. A game counts as a
 * win at one star or better; finishing with none scores nothing.
 *
 * Points are always recomputed from the stored star rating rather than
 * read back from the log, so changing pointsPerWin in settings rescales
 * past games too and the board never mixes two scoring systems.
 */
export const pointsFor = (stars) => (stars >= 1 ? get('pointsPerWin') : 0);

/** How many times a kid may finish any ONE game per day. */
export const dailyLimit = () => get('dailyLimit');

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') {
      return { best: raw.best || {}, log: raw.log || [], medals: raw.medals || [] };
    }
  } catch { /* corrupt or unreadable — start fresh */ }
  return { best: {}, log: [], medals: [] };
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

/** Local midnight — the day rolls over at their midnight, not UTC's. */
export function startOfDay(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** How many times this kid has finished this particular game today. */
export function playsToday(profileId, gameId, now = new Date()) {
  const since = startOfDay(now);
  return read().log.filter((e) => e.p === profileId && e.g === gameId && e.at >= since).length;
}

/** Plays left today on one game, 0 once its allowance is used up. */
export function remainingToday(profileId, gameId, now = new Date()) {
  return Math.max(0, dailyLimit() - playsToday(profileId, gameId, now));
}

/** Plays left today added up over a shelf — the number on the home screen. */
export function remainingAcross(profileId, gameIds, now = new Date()) {
  return gameIds.reduce((sum, id) => sum + remainingToday(profileId, id, now), 0);
}

/** Midnight on the most recent week-start day (Sunday unless configured). */
export function startOfWeek(now = new Date()) {
  const startDay = get('weekStartsOn') ?? 0;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - startDay + 7) % 7));
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
    row.points += pointsFor(entry.s);
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
    .reduce((sum, e) => sum + pointsFor(e.s), 0);
}

export function totalStars(profileId) {
  return Object.values(read().best[profileId] || {}).reduce((sum, s) => sum + s, 0);
}

export function resetAll() {
  write({ best: {}, log: [], medals: [] });
}

/* ---------------------------------------------------------------
   Medals — one per kid per day, earned by using up every game's
   daily allowance AND winning at least 80% of them. Deliberately hard
   to get by accident, and impossible to get twice in a day.

   Each medal carries the prize spun on the wheel, so the fridge-door
   list tells you what was promised as well as what was earned.
   --------------------------------------------------------------- */

export const MEDAL_RATE = 0.8;

const dayKey = (now = new Date()) => {
  const d = new Date(now);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Today's games and how many were won — the medal test. */
export function todayStats(profileId, now = new Date()) {
  const since = startOfDay(now);
  const rows = read().log.filter((e) => e.p === profileId && e.at >= since);
  const wins = rows.filter((e) => e.s >= 1).length;
  return { plays: rows.length, wins, rate: rows.length ? wins / rows.length : 0 };
}

/**
 * Award today's medal if it's been earned. Returns the medal, or null if
 * the day isn't finished, the rate is short, or one was already awarded.
 */
export function awardMedal(profileId, gameIds, now = new Date()) {
  if (!gameIds.length) return null;
  if (remainingAcross(profileId, gameIds, now) > 0) return null; // day not done

  const { plays, wins, rate } = todayStats(profileId, now);
  if (plays === 0 || rate < MEDAL_RATE) return null;

  const day = dayKey(now);
  const data = read();
  if (data.medals.some((m) => m.p === profileId && m.day === day)) return null;

  const medal = { p: profileId, day, plays, wins, prize: null };
  data.medals.push(medal);
  write(data);
  return medal;
}

/** Newest first. */
export const medalsFor = (profileId) =>
  read().medals.filter((m) => m.p === profileId).reverse();

export const medalCount = (profileId) =>
  read().medals.filter((m) => m.p === profileId).length;

/** A medal that hasn't had its wheel spun yet. */
export const pendingMedal = (profileId) =>
  read().medals.find((m) => m.p === profileId && !m.prize) || null;

export function setMedalPrize(profileId, day, prize) {
  const data = read();
  const medal = data.medals.find((m) => m.p === profileId && m.day === day);
  if (!medal) return;
  medal.prize = prize;
  write(data);
}
