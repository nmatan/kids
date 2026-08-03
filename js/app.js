/* ---------------------------------------------------------------
   app.js — screen shell and router.

   Routes live in the URL hash so the tablet's Back gesture walks back
   through the app instead of closing it:
     #/                 בחירת ילד
     #/leaders          טבלת המובילים
     #/settings         הגדרות (מאחורי שאלה להורים)
     #/p/:profileId     מדף המשחקים של הילד
     #/p/:id/g/:gameId  משחק
   --------------------------------------------------------------- */

import { PROFILES, getProfile } from './profiles.js';
import { GAMES, gamesForProfile, gamesForLevel, getGame } from './registry.js';
import {
  bestStars, recordPlay, totalStars, pointsIn, leaderboard, PERIODS,
  remainingToday, remainingAcross, dailyLimit, resetAll,
} from './store.js';
import {
  el, clear, speak, stopSpeech, sfx, setSpeechLang, hasVoice, randInt,
} from './kit.js';
import * as settings from './settings.js';
import { T, SET, LANG, REWARD, cheerLine } from './text.js';

setSpeechLang(LANG);

const app = document.getElementById('app');
let teardown = null;      // cleanup fn returned by the running game
let period = 'week';      // which leaderboard tab is open
let unlocked = false;     // parent gate, deliberately not persisted

const go = (hash) => { location.hash = hash; };
const starRow = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'leaders') return { screen: 'leaders' };
  if (parts[0] === 'settings') return { screen: 'settings' };
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
      el('button', {
        class: 'btn round subtle',
        'aria-label': SET.title,
        onClick: () => { sfx.tap(); go('/settings'); },
      }, '⚙'),
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
            el('span', { class: 'sep' }, '·'),
            `🎮 ${remainingAcross(p.id, gamesForProfile(p).map((g) => g.meta.id))}`,
          ),
        ),
      ),
    ),
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

/* ---------- settings ---------- */

/** Keeps a 7-year-old out. Not security — just past the curious. */
function gateScreen() {
  let a = randInt(12, 29);
  let b = randInt(12, 29);

  const question = el('div', { class: 'prompt ltr', text: `${a} × ${b} = ?` });
  const input = el('input', {
    class: 'gate-input', type: 'number', inputmode: 'numeric', autocomplete: 'off',
  });
  const error = el('div', { class: 'gate-error' });

  const submit = () => {
    if (Number(input.value) === a * b) {
      unlocked = true;
      render();
      return;
    }
    error.textContent = SET.gateWrong;
    input.value = '';
    a = randInt(12, 29);
    b = randInt(12, 29);
    question.textContent = `${a} × ${b} = ?`;
  };

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  return el('div', { class: 'screen' },
    el('div', { class: 'topbar' },
      el('button', { class: 'btn round', 'aria-label': 'חזרה', onClick: () => go('/') }, T.back),
      el('div', { class: 'grow' }, el('h2', {}, `🔒 ${SET.gate}`)),
    ),
    el('div', { class: 'stage' },
      el('p', { class: 'subtitle', text: SET.gateHint }),
      question,
      input,
      error,
      el('button', { class: 'btn primary', onClick: submit }, SET.enter),
    ),
  );
}

/* --- small setting controls; each writes through and updates itself --- */

function row(label, hint, control) {
  return el('div', { class: 'set-row' },
    el('div', { class: 'set-label' },
      el('div', { text: label }),
      hint ? el('div', { class: 'set-hint', text: hint }) : null,
    ),
    control,
  );
}

function stepper(key, { min, max }) {
  const value = el('b', { class: 'set-value', text: String(settings.get(key)) });
  const step = (by) => {
    const next = Math.min(max, Math.max(min, settings.get(key) + by));
    settings.set(key, next);
    value.textContent = String(next);
    sfx.tap();
  };
  return el('div', { class: 'stepper' },
    el('button', { class: 'btn round', onClick: () => step(-1) }, '−'),
    value,
    el('button', { class: 'btn round', onClick: () => step(1) }, '+'),
  );
}

function toggle(key) {
  const node = el('button', { class: `switch${settings.get(key) ? ' on' : ''}` }, el('i'));
  node.addEventListener('click', () => {
    const next = !settings.get(key);
    settings.set(key, next);
    node.classList.toggle('on', next);
    sfx.tap();
  });
  return node;
}

function segment(key, options) {
  const node = el('div', { class: 'segment' });
  const buttons = options.map((opt) => {
    const b = el('button', {
      class: `seg${settings.get(key) === opt.value ? ' on' : ''}`,
      onClick: () => {
        settings.set(key, opt.value);
        buttons.forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        sfx.tap();
      },
    }, opt.label);
    return b;
  });
  buttons.forEach((b) => node.append(b));
  return node;
}

/** Two-click confirm, so nothing destructive happens on one stray tap. */
function dangerButton(label, onConfirm) {
  let armed = false;
  const b = el('button', { class: 'btn danger' }, label);
  b.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      b.textContent = SET.confirm;
      b.classList.add('armed');
      setTimeout(() => {
        if (!armed) return;
        armed = false;
        b.textContent = label;
        b.classList.remove('armed');
      }, 4000);
      return;
    }
    onConfirm();
  });
  return b;
}

function gamesForKidBlock(profile) {
  const chosen = settings.enabledGames(profile.id);
  const active = new Set((chosen ?? gamesForLevel(profile.level).map((g) => g.meta.id)));

  const chips = el('div', { class: 'chips' });
  GAMES.forEach((g) => {
    const on = active.has(g.meta.id);
    const chip = el('button', { class: `chip${on ? ' on' : ''}` },
      `${g.meta.emoji} ${g.meta.title}`,
    );
    chip.addEventListener('click', () => {
      if (active.has(g.meta.id)) active.delete(g.meta.id);
      else active.add(g.meta.id);
      chip.classList.toggle('on', active.has(g.meta.id));
      settings.setEnabledGames(profile.id, [...active]);
      sfx.tap();
    });
    chips.append(chip);
  });

  return el('div', { class: 'kid-games' },
    el('div', { class: 'kid-head' },
      el('span', { class: 'face', text: profile.face }),
      el('span', { class: 'name', text: profile.name }),
      el('span', { class: 'set-hint', text: chosen ? '' : SET.byLevel }),
      el('div', { class: 'grow' }),
      el('button', {
        class: 'btn small',
        onClick: () => { settings.clearEnabledGames(profile.id); sfx.tap(); render(); },
      }, SET.useLevel),
    ),
    chips,
  );
}

function settingsScreen() {
  if (!unlocked) return gateScreen();

  return el('div', { class: 'screen settings' },
    el('div', { class: 'topbar' },
      el('button', { class: 'btn round', 'aria-label': 'חזרה', onClick: () => go('/') }, T.back),
      el('div', { class: 'grow' }, el('h2', {}, `⚙ ${SET.title}`)),
    ),

    el('h3', { class: 'set-section', text: SET.playSection }),
    row(SET.dailyLimit, SET.dailyLimitHint, stepper('dailyLimit', { min: 1, max: 50 })),
    row(SET.pointsPerWin, SET.pointsPerWinHint, stepper('pointsPerWin', { min: 1, max: 100 })),
    row(SET.rounds, SET.roundsHint, segment('rounds', [
      { label: SET.roundsAuto, value: 0 },
      { label: '5', value: 5 },
      { label: '8', value: 8 },
      { label: '10', value: 10 },
      { label: '12', value: 12 },
    ])),

    el('h3', { class: 'set-section', text: SET.gamesSection }),
    el('p', { class: 'set-hint pad', text: SET.gamesHint }),
    PROFILES.map((p) => gamesForKidBlock(p)),

    el('h3', { class: 'set-section', text: SET.feelSection }),
    row(SET.speech, null, toggle('speech')),
    row(SET.sound, null, toggle('sound')),
    row(SET.confetti, null, toggle('confetti')),

    el('h3', { class: 'set-section', text: SET.boardSection }),
    row(SET.weekStart, null, segment('weekStartsOn', [
      { label: SET.sunday, value: 0 },
      { label: SET.monday, value: 1 },
    ])),

    el('h3', { class: 'set-section', text: SET.dangerSection }),
    row(SET.resetScores, SET.resetScoresHint,
      dangerButton(SET.resetScores, () => { resetAll(); render(); })),
    row(SET.resetSettings, null,
      dangerButton(SET.resetSettings, () => { settings.resetSettings(); render(); })),

    el('p', { class: 'set-hint pad storage', text: SET.storageNote }),
  );
}

/* ---------- game shelf ---------- */

function shelfScreen(profile) {
  const games = gamesForProfile(profile);
  const total = remainingAcross(profile.id, games.map((g) => g.meta.id));
  const allUsedUp = games.length > 0 && total === 0;

  return el('div', { class: 'screen' },
    el('div', { class: 'topbar' },
      el('button', { class: 'btn round', 'aria-label': 'חזרה', onClick: () => go('/') }, T.back),
      el('div', { class: 'grow' }, el('h2', {}, `${profile.face} ${profile.name}`)),
      el('div', { class: 'pill' }, `🏅 ${pointsIn(profile.id, 'week')} ${T.pointsShort}`),
      el('div', { class: `pill${total <= 3 ? ' low' : ''}` }, `🎮 ${total}`),
    ),
    allUsedUp ? el('p', { class: 'warn center', text: REWARD.lockedHint(dailyLimit()) }) : null,
    el('div', { class: 'game-grid' },
      games.map((g) => {
        // Each game has its own allowance, so cards lock one at a time.
        const left = remainingToday(profile.id, g.meta.id);
        const locked = left <= 0;
        return el('button', {
          class: `game-card${locked ? ' locked' : ''}`,
          disabled: locked,
          onClick: () => { sfx.tap(); go(`/p/${profile.id}/g/${g.meta.id}`); },
        },
          el('div', { class: 'emoji', text: locked ? '🔒' : g.meta.emoji }),
          el('div', { class: 'title', text: g.meta.title }),
          el('div', { class: 'blurb', text: locked ? REWARD.tomorrow : g.meta.blurb }),
          el('div', { class: 'stars', text: starRow(bestStars(profile.id, g.meta.id)) }),
          el('div', { class: `left-badge${left <= 2 && !locked ? ' low' : ''}` },
            locked ? REWARD.lockedTitle : REWARD.leftShort(left)),
        );
      }),
    ),
    games.length ? null : el('p', { class: 'subtitle center', text: T.noGames }),
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
     * this week's rank, and how many games are left today.
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
      // Belt and braces: the card hides the replay button when the day's
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
  if (route.screen === 'settings') return app.append(settingsScreen());

  const profile = route.profileId ? getProfile(route.profileId) : null;
  if (!profile) return app.append(homeScreen());

  // Out of games for today, or a game that isn't on this kid's shelf?
  // Fall back to the shelf rather than starting something that can't count.
  const game = route.gameId ? getGame(route.gameId) : null;
  const onShelf = game && gamesForProfile(profile).some((g) => g.meta.id === game.meta.id);
  const playable = onShelf && remainingToday(profile.id, game.meta.id) > 0;
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
