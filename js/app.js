/* ---------------------------------------------------------------
   app.js — screen shell and router.

   Routes live in the URL hash so the tablet's Back gesture walks back
   through the app instead of closing it:
     #/                 בחירת ילד
     #/leaders          טבלת המובילים
     #/p/:profileId     מדף המשחקים של הילד
     #/p/:id/g/:gameId  משחק
   --------------------------------------------------------------- */

import { PROFILES, getProfile } from './profiles.js';
import { gamesForLevel, getGame } from './registry.js';
import {
  bestStars, recordPlay, totalStars, pointsIn, leaderboard, PERIODS, remainingToday,
} from './store.js';
import { el, clear, speak, stopSpeech, sfx, setSpeechLang, hasVoice } from './kit.js';
import { T, LANG, REWARD, cheerLine } from './text.js';

setSpeechLang(LANG);

const app = document.getElementById('app');
let teardown = null;       // cleanup fn returned by the running game
let period = 'week';       // which leaderboard tab is open

const go = (hash) => { location.hash = hash; };
const starRow = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'leaders') return { screen: 'leaders' };
  if (parts[0] === 'p' && parts[1]) {
    return { screen: 'profile', profileId: parts[1], gameId: parts[2] === 'g' ? parts[3] : null };
  }
  return { screen: 'home' };
}

/* ---------- home ---------- */

function homeScreen() {
  return el('div', { class: 'screen' },
    el('div', { class: 'topbar' },
      el('div', { class: 'grow' },
        el('h1', { text: T.appName }),
        el('p', { class: 'subtitle', text: T.whoPlays }),
      ),
      el('button', {
        class: 'btn',
        onClick: () => { sfx.tap(); go('/leaders'); },
      }, '🏆 ', T.leaderboard),
    ),
    el('div', { class: 'profiles' },
      PROFILES.map((p) =>
        el('button', {
          class: 'profile',
          style: { '--c1': p.colors[0], '--c2': p.colors[1] },
          onClick: () => { sfx.tap(); speak(p.name); go(`/p/${p.id}`); },
        },
          el('div', { class: 'face', text: p.face }),
          el('div', { class: 'name', text: p.name }),
          el('div', { class: 'meta' },
            `⭐ ${totalStars(p.id)}`,
            el('span', { class: 'sep' }, '·'),
            `🏅 ${pointsIn(p.id, 'week')} ${T.pointsShort}`,
          ),
        ),
      ),
    ),
    // Hebrew prompts need a Hebrew TTS voice — tell the parent how to add one.
    hasVoice(LANG) ? null : el('p', { class: 'warn', text: T.ttsMissing }),
  );
}

/* ---------- leaderboard ---------- */

function leadersScreen() {
  const rows = leaderboard(PROFILES, period);
  const played = rows.some((r) => r.games > 0);
  const medals = ['🥇', '🥈', '🥉'];
  const label = { week: T.thisWeek, month: T.thisMonth, all: T.allTime };

  return el('div', { class: 'screen' },
    el('div', { class: 'topbar' },
      el('button', { class: 'btn round', 'aria-label': 'חזרה', onClick: () => go('/') }, T.back),
      el('div', { class: 'grow' }, el('h2', {}, `🏆 ${T.leaderboard}`)),
    ),
    el('div', { class: 'tabs' },
      PERIODS.map((p) =>
        el('button', {
          class: `tab${p === period ? ' on' : ''}`,
          onClick: () => { sfx.tap(); period = p; render(); },
        }, label[p]),
      ),
    ),
    el('div', { class: 'board' },
      rows.map((row, i) =>
        el('div', {
          class: `board-row${i === 0 && row.points > 0 ? ' leader' : ''}`,
          style: { '--c1': row.profile.colors[0], '--c2': row.profile.colors[1] },
        },
          el('div', { class: 'rank', text: row.points > 0 ? (medals[i] || `${i + 1}`) : '–' }),
          el('div', { class: 'face', text: row.profile.face }),
          el('div', { class: 'who' },
            el('div', { class: 'name', text: row.profile.name }),
            el('div', { class: 'sub', text: T.playedGames(row.games) }),
          ),
          el('div', { class: 'pts' },
            el('b', { text: String(row.points) }),
            el('span', { text: T.pointsShort }),
          ),
        ),
      ),
    ),
    played ? null : el('p', { class: 'subtitle center', text: T.noScores }),
  );
}

/* ---------- game shelf ---------- */

function shelfScreen(profile) {
  const games = gamesForLevel(profile.level);

  return el('div', { class: 'screen' },
    el('div', { class: 'topbar' },
      el('button', { class: 'btn round', 'aria-label': 'חזרה', onClick: () => go('/') }, T.back),
      el('div', { class: 'grow' }, el('h2', {}, `${profile.face} ${profile.name}`)),
      el('div', { class: 'pill' }, `🏅 ${pointsIn(profile.id, 'week')} ${T.pointsShort}`),
    ),
    el('div', { class: 'game-grid' },
      games.map((g) => {
        const left = remainingToday(profile.id, g.meta.id);
        const locked = left <= 0;
        return el('button', {
          class: `game-card${locked ? ' locked' : ''}`,
          disabled: locked,
          onClick: () => { sfx.tap(); go(`/p/${profile.id}/g/${g.meta.id}`); },
        },
          el('div', { class: 'emoji', text: locked ? '🔒' : g.meta.emoji }),
          el('div', { class: 'title', text: g.meta.title }),
          el('div', { class: 'blurb', text: locked ? REWARD.lockedHint : g.meta.blurb }),
          el('div', { class: 'stars', text: starRow(bestStars(profile.id, g.meta.id)) }),
          el('div', { class: `left-badge${left <= 2 && !locked ? ' low' : ''}` },
            locked ? REWARD.lockedTitle : REWARD.leftShort(left)),
        );
      }),
    ),
    games.length ? null : el('p', { class: 'subtitle', text: T.noGames }),
  );
}

/* ---------- playing ---------- */

function playScreen(profile, game) {
  const dots = el('div', { class: 'progress' });
  const stage = el('div', { class: 'stage' });

  const screen = el('div', { class: 'screen' },
    el('div', { class: 'topbar' },
      el('button', {
        class: 'btn round',
        'aria-label': 'חזרה',
        onClick: () => go(`/p/${profile.id}`),
      }, T.back),
      el('div', { class: 'grow' }, el('h2', { text: game.meta.title })),
      dots,
    ),
    stage,
  );

  const ctx = {
    profile,
    setProgress(results, total) {
      clear(dots);
      for (let i = 0; i < total; i++) {
        const state = i < results.length ? (results[i] ? 'hit' : 'miss') : '';
        dots.append(el('i', { class: state }));
      }
    },
    /**
     * Called by a game the moment it ends. Records the play, then hands
     * back everything the end card and the spoken cheer need — points,
     * this week's rank, and how many plays of this game are left today.
     */
    finish(stars) {
      const points = recordPlay(profile.id, game.meta.id, stars);
      const remaining = remainingToday(profile.id, game.meta.id);
      const rows = leaderboard(PROFILES, 'week');
      const rank = rows.findIndex((r) => r.profile.id === profile.id);

      return {
        points,
        remaining,
        rank,
        canReplay: remaining > 0,
        speech: cheerLine({ profile, stars, points, remaining, rows }),
      };
    },
    exit() { go(`/p/${profile.id}`); },
    replay() {
      // Belt and braces: the card hides the replay button when the
      // allowance is gone, but never let a replay slip through anyway.
      if (remainingToday(profile.id, game.meta.id) <= 0) return ctx.exit();
      teardown?.();
      clear(stage);
      clear(dots);
      teardown = game.mount(stage, ctx);
    },
  };

  // mount after the screen is in the document, so games can measure layout
  queueMicrotask(() => { teardown = game.mount(stage, ctx); });
  return screen;
}

/* ---------- render ---------- */

function render() {
  teardown?.();
  teardown = null;
  stopSpeech();
  clear(app);

  const route = parse();
  if (route.screen === 'leaders') return app.append(leadersScreen());

  const profile = route.profileId ? getProfile(route.profileId) : null;
  if (!profile) return app.append(homeScreen());

  // Out of plays for today? Bounce back to the shelf rather than starting
  // a game whose result can't be counted (also blocks a bookmarked URL).
  const game = route.gameId ? getGame(route.gameId) : null;
  const playable = game && remainingToday(profile.id, game.meta.id) > 0;
  app.append(playable ? playScreen(profile, game) : shelfScreen(profile));
}

window.addEventListener('hashchange', render);
render();

/* ---------- housekeeping ---------- */

// Browsers block audio until the first gesture; warm both engines up then.
addEventListener('pointerdown', function unlock() {
  removeEventListener('pointerdown', unlock);
  sfx.tap();
  speak(' ');
}, { once: true });

// Stop any narration if the tablet is locked or the app is backgrounded.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopSpeech();
});

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline is optional */ });
  });
}
