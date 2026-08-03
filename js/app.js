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
import {
  GAMES, GAMES_PER_KID, gamesForProfile, defaultShelf, getGame,
} from './registry.js';
import {
  bestStars, recordPlay, totalStars, pointsIn, leaderboard, PERIODS,
  remainingToday, remainingAcross, dailyLimit, resetAll,
  awardMedal, pendingMedal, setMedalPrize, medalsFor, medalCount, todayStats,
} from './store.js';
import {
  el, clear, speak, stopSpeech, sfx, setSpeechLang, hasVoice, randInt, pick,
  burst, celebrate,
} from './kit.js';
import * as settings from './settings.js';
import {
  T, SET, LANG, REWARD, MEDAL, PRIZES, cheerLine, hudLines, gateQuestion,
} from './text.js';
import { themeFor } from './themes.js';

setSpeechLang(LANG);

const app = document.getElementById('app');
let teardown = null;      // cleanup fn returned by the running game
let period = 'day';       // which leaderboard tab is open
let unlocked = false;     // parent gate, deliberately not persisted

const go = (hash) => { location.hash = hash; };
const starRow = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

/** Theme colours + glow, applied to a screen root. */
const themeVars = (theme) => ({
  '--c1': theme.colors[0],
  '--c2': theme.colors[1],
  '--glow': theme.glow,
});

/** Faint themed icons scattered behind a kid's space. Decorative only. */
function backdrop(theme) {
  const layer = el('div', { class: 'backdrop', 'aria-hidden': 'true' });
  for (let i = 0; i < 14; i++) {
    layer.append(el('span', {
      style: {
        left: `${Math.random() * 96}%`,
        top: `${Math.random() * 96}%`,
        fontSize: `${34 + Math.random() * 46}px`,
        transform: `rotate(${-30 + Math.random() * 60}deg)`,
      },
    }, pick(theme.icons)));
  }
  return layer;
}

function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'leaders') return { screen: 'leaders' };
  if (parts[0] === 'settings') return { screen: 'settings' };
  if (parts[0] === 'medals') return { screen: 'medals' };
  if (parts[0] === 'p' && parts[1]) {
    return {
      screen: 'profile',
      profileId: parts[1],
      gameId: parts[2] === 'g' ? parts[3] : null,
      wheel: parts[2] === 'wheel',
    };
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
        class: 'btn',
        onClick: () => { sfx.tap(); go('/medals'); },
      }, '🎖 ', MEDAL.title),
      el('button', {
        class: 'btn round subtle',
        'aria-label': SET.title,
        onClick: () => { sfx.tap(); go('/settings'); },
      }, '⚙'),
    ),
    el('div', { class: 'profiles' },
      PROFILES.map((p) => {
        const theme = themeFor(p);
        const gift = pendingMedal(p.id);
        return el('button', {
          class: 'profile',
          style: themeVars(theme),
          onClick: () => { sfx.tap(); speak(p.name); go(`/p/${p.id}`); },
        },
          el('div', { class: 'theme-badge', text: theme.badge }),
          gift ? el('div', { class: 'gift-dot', text: '🎁' }) : null,
          el('div', { class: 'face', text: p.face }),
          el('div', { class: 'name', text: p.name }),
          el('div', { class: 'theme-name', text: theme.space(p.name) }),
          el('div', { class: 'meta' },
            `🎖 ${medalCount(p.id)}`,
            el('span', { class: 'sep' }, '·'),
            `🏅 ${pointsIn(p.id, 'week')} ${T.pointsShort}`,
            el('span', { class: 'sep' }, '·'),
            `🎮 ${remainingAcross(p.id, gamesForProfile(p).map((g) => g.meta.id))}`,
          ),
        );
      }),
    ),
    hasVoice(LANG) ? null : el('p', { class: 'warn', text: T.ttsMissing }),
  );
}

/* ---------- leaderboard ---------- */

function leadersScreen() {
  const rows = leaderboard(PROFILES, period);
  const played = rows.some((r) => r.games > 0);
  const medals = ['🥇', '🥈', '🥉'];
  const label = { day: T.today, week: T.thisWeek, month: T.thisMonth };
  const top = rows[0];
  const tied = played && rows[1] && rows[1].points === top.points;

  // Podium order: 2nd, 1st, 3rd — the leader stands in the middle.
  const podium = [rows[1], rows[0], rows[2]].filter(Boolean);
  const best = Math.max(1, top?.points ?? 1);

  // Arriving should feel like an event, not a spreadsheet.
  if (played) {
    setTimeout(() => {
      celebrate(70);
      burst(themeFor(top.profile).icons, 14);
      sfx.win();
    }, 120);
  }

  return el('div', { class: 'screen board-screen' },
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

    el('div', { class: 'headline' },
      !played ? T.boardEmpty : tied ? T.boardTied : T.boardLeader(top.profile.name)),

    el('div', { class: 'podium' },
      podium.map((row) => {
        const place = rows.indexOf(row);
        const theme = themeFor(row.profile);
        const height = 34 + (row.points / best) * 66; // relative, never zero-height
        return el('div', { class: `pod place-${place}`, style: themeVars(theme) },
          el('div', { class: 'pod-crown', text: place === 0 && row.points > 0 ? '👑' : '' }),
          el('div', { class: 'pod-face', text: row.profile.face }),
          el('div', { class: 'pod-pts' }, String(row.points)),
          el('div', {
            class: 'pod-stand',
            style: { '--h': `${row.points > 0 ? height : 26}%` },
          },
            el('span', { class: 'pod-medal', text: row.points > 0 ? medals[place] : '·' }),
            el('span', { class: 'pod-name', text: row.profile.name }),
          ),
        );
      }),
    ),

    el('div', { class: 'board' },
      rows.map((row, i) => {
        const gap = i === 0 ? 0 : rows[i - 1].points - row.points;
        return el('div', {
          class: `board-row${i === 0 && row.points > 0 ? ' leader' : ''}`,
          style: { '--c1': row.profile.colors[0], '--c2': row.profile.colors[1] },
        },
          el('div', { class: 'rank', text: row.points > 0 ? (medals[i] || `${i + 1}`) : '–' }),
          el('div', { class: 'face', text: row.profile.face }),
          el('div', { class: 'who' },
            el('div', { class: 'name', text: row.profile.name }),
            el('div', { class: 'bar' },
              el('i', { style: { width: `${(row.points / best) * 100}%` } })),
            el('div', { class: 'sub' },
              i === 0 || gap === 0
                ? T.playedGames(row.games)
                : `${T.playedGames(row.games)} · עוד ${gap} ${gap === 1 ? 'נקודה' : 'נקודות'} להשוות`),
          ),
          el('div', { class: 'pts' },
            el('b', { text: String(row.points) }),
            el('span', { text: T.pointsShort }),
          ),
        );
      }),
    ),

    el('p', { class: 'board-tease', text: T.boardTease }),
    played ? null : el('p', { class: 'subtitle center', text: T.noScores }),
  );
}

/* ---------- settings ---------- */

/** Keeps a 7-year-old out. Not security — just past the curious. */
function gateScreen() {
  let q = gateQuestion();

  const question = el('div', { class: 'prompt', text: q.text });
  const input = el('input', {
    class: 'gate-input', type: 'number', inputmode: 'numeric', autocomplete: 'off',
  });
  const error = el('div', { class: 'gate-error' });

  const submit = () => {
    if (Number(input.value) === q.answer) {
      unlocked = true;
      render();
      return;
    }
    error.textContent = SET.gateWrong;
    input.value = '';
    q = gateQuestion();
    question.textContent = q.text;
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
  const active = new Set(chosen ?? defaultShelf(profile.level).map((g) => g.meta.id));

  const counter = el('span', { class: 'chip-count' });
  const chips = el('div', { class: 'chips' });

  const paint = () => {
    counter.textContent = SET.chosenCount(active.size, GAMES_PER_KID);
    counter.classList.toggle('bad', active.size !== GAMES_PER_KID);
  };

  GAMES.forEach((g) => {
    const chip = el('button', { class: `chip${active.has(g.meta.id) ? ' on' : ''}` },
      `${g.meta.emoji} ${g.meta.title}`,
    );
    chip.addEventListener('click', () => {
      if (active.has(g.meta.id)) {
        active.delete(g.meta.id);
      } else if (active.size >= GAMES_PER_KID) {
        // Shelves stay equal, so a swap has to be a swap.
        sfx.wrong();
        chip.classList.add('shake');
        setTimeout(() => chip.classList.remove('shake'), 360);
        return;
      } else {
        active.add(g.meta.id);
      }
      chip.classList.toggle('on', active.has(g.meta.id));
      settings.setEnabledGames(profile.id, [...active]);
      sfx.tap();
      paint();
    });
    chips.append(chip);
  });

  paint();

  return el('div', { class: 'kid-games' },
    el('div', { class: 'kid-head' },
      el('span', { class: 'face', text: profile.face }),
      el('span', { class: 'name', text: profile.name }),
      counter,
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

/* ---------- the daily progress panel ---------- */

/**
 * Shown on a kid's shelf between games: how far through today they are,
 * where they stand against the others right now, and how close the medal
 * (and its secret wheel) is. All framed forwards — never "you're losing".
 */
function dailyHud(profile, games) {
  const ids = games.map((g) => g.meta.id);
  const total = ids.length * dailyLimit();
  const done = total - remainingAcross(profile.id, ids);
  const { wins, plays } = todayStats(profile.id);
  const rows = leaderboard(PROFILES, 'day');
  const { standing, medal } = hudLines({ profile, rows, done, total, wins, plays });
  const pct = total ? (done / total) * 100 : 0;

  return el('div', { class: 'hud' },
    el('div', { class: 'hud-top' },
      el('span', { class: 'hud-count', text: MEDAL.progress(done, total) }),
      el('div', { class: 'grow' }),
      // Live mini-standings: everyone's dot, biggest = leading
      el('div', { class: 'hud-kids' },
        rows.map((r) => el('span', {
          class: `hud-kid${r.profile.id === profile.id ? ' me' : ''}`,
          title: r.profile.name,
        }, `${r.profile.face}${r.points}`)),
      ),
    ),
    el('div', { class: 'hud-bar' }, el('i', { style: { width: `${pct}%` } })),
    el('div', { class: 'hud-line', text: standing }),
    el('div', { class: 'hud-line gold', text: medal }),
  );
}

/* ---------- game shelf ---------- */

function shelfScreen(profile) {
  const games = gamesForProfile(profile);
  const theme = themeFor(profile);
  const total = remainingAcross(profile.id, games.map((g) => g.meta.id));
  const allUsedUp = games.length > 0 && total === 0;
  const gift = pendingMedal(profile.id);
  const { wins, plays } = todayStats(profile.id);

  return el('div', { class: 'screen themed', style: themeVars(theme) },
    backdrop(theme),
    el('div', { class: 'topbar' },
      el('button', { class: 'btn round', 'aria-label': 'חזרה', onClick: () => go('/') }, T.back),
      el('div', { class: 'grow' },
        el('h2', {}, `${theme.badge} ${theme.space(profile.name)}`),
      ),
      el('div', { class: 'pill' }, `🏅 ${pointsIn(profile.id, 'week')} ${T.pointsShort}`),
      el('div', { class: `pill${total <= 3 ? ' low' : ''}` }, `🎮 ${total}`),
    ),
    gift
      ? el('button', {
        class: 'btn primary gift-banner',
        onClick: () => { sfx.tap(); go(`/p/${profile.id}/wheel`); },
      }, MEDAL.pending)
      : null,
    games.length ? dailyHud(profile, games) : null,
    allUsedUp && !gift
      ? el('p', { class: 'warn center', text: REWARD.lockedHint(dailyLimit()) })
      : null,
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
  const theme = themeFor(profile);

  const screen = el('div', { class: 'screen themed', style: themeVars(theme) },
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
      const rows = leaderboard(PROFILES, 'day');
      const rank = rows.findIndex((r) => r.profile.id === profile.id);
      // Checked after recording: a medal can only ever be the last play.
      const medal = awardMedal(profile.id, gamesForProfile(profile).map((g) => g.meta.id));

      return {
        points,
        remaining,
        rank,
        medal,
        canReplay: remaining > 0,
        speech: medal
          ? `${MEDAL.earned} ${MEDAL.why(medal.wins, medal.plays)}. יש לך מתנה!`
          : cheerLine({ profile, stars, points, remaining, rows }),
      };
    },

    /** A streak of clean answers — throw their own theme across the screen. */
    onStreak(streak) {
      burst(theme.icons, 10 + streak * 2);
      speak(pick(theme.cheers), { rate: 1 });
    },

    claimMedal() { go(`/p/${profile.id}/wheel`); },
    exit() {
      // An unspun medal always wins over going back — they earned it,
      // and it must not be possible to tap past it by accident.
      if (pendingMedal(profile.id)) return go(`/p/${profile.id}/wheel`);
      go(`/p/${profile.id}`);
    },
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

/* ---------- the prize wheel ---------- */

const SEG = 360 / PRIZES.length;

function wheelScreen(profile) {
  const medal = pendingMedal(profile.id);
  if (!medal) return medalsScreen(); // nothing to spin — don't let them farm it

  const theme = themeFor(profile);
  setTimeout(() => speak(MEDAL.tease, { rate: 0.92 }), 500);
  const colors = ['#ff6b6b', '#ffd23f', '#37d67a', '#4cc9f0', '#7c5cff', '#f72585', '#ff9f1c'];

  const wheel = el('div', {
    class: 'wheel',
    style: {
      background: `conic-gradient(${PRIZES
        .map((_, i) => `${colors[i % colors.length]} ${i * SEG}deg ${(i + 1) * SEG}deg`)
        .join(',')})`,
    },
  },
    // Every segment shows the same mystery mark. Showing the real prizes
    // would give away all seven the first time they ever spin — half the
    // thrill is not knowing what else was on there.
    PRIZES.map((_, i) => {
      const angle = (i + 0.5) * SEG;
      return el('span', { class: 'wseg', style: { transform: `rotate(${angle}deg)` } },
        el('i', { class: 'wico', style: { transform: `rotate(${-angle}deg)` } }, '🎁'));
    }),
  );

  const result = el('div', { class: 'prize' });
  const status = el('div', { class: 'wheel-status' });
  const spinBtn = el('button', { class: 'btn primary big-btn' }, MEDAL.spin);

  const SPIN_MS = 5600;

  spinBtn.addEventListener('click', () => {
    if (spinBtn.disabled) return;
    spinBtn.disabled = true;
    spinBtn.remove();

    const i = randInt(0, PRIZES.length - 1);
    const prize = PRIZES[i];

    // --- the build-up. Narration is spaced so no line cuts the last one.
    status.textContent = MEDAL.ready;
    speak(MEDAL.ready, { rate: 0.95 });
    sfx.rise(1.2);

    setTimeout(() => {
      // Segment i is centred at (i+0.5)*SEG clockwise from the top pointer,
      // so spinning by -that (plus whole turns) parks it under the pointer.
      wheel.classList.add('spinning');
      wheel.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.72, 0.09, 1)`;
      wheel.style.transform = `rotate(${360 * 8 - (i + 0.5) * SEG}deg)`;
      sfx.roll(SPIN_MS / 1000);
      status.textContent = MEDAL.rolling;
      speak(MEDAL.rolling, { rate: 1 });
    }, 1500);

    // it visibly slows near the end — say so, so they lean in
    setTimeout(() => {
      status.textContent = MEDAL.almost;
      speak(MEDAL.almost, { rate: 0.95 });
    }, 1500 + SPIN_MS - 1900);

    setTimeout(() => {
      status.textContent = '';
      wheel.classList.remove('spinning');
      wheel.classList.add('landed');
      speak(MEDAL.drumEnd, { rate: 0.9 });
      sfx.fanfare();
    }, 1500 + SPIN_MS);

    // ...and only then is the prize itself revealed
    setTimeout(() => {
      setMedalPrize(profile.id, medal.day, prize.text);
      clear(result);
      result.append(
        el('div', { class: 'prize-emoji', text: prize.emoji }),
        el('div', { class: 'prize-text', text: prize.text }),
      );
      celebrate(140);
      burst(theme.icons, 28);
      speak(`${MEDAL.won}${prize.text}!`, { rate: 0.88 });
    }, 1500 + SPIN_MS + 1400);
  });

  return el('div', { class: 'screen themed wheel-screen', style: themeVars(theme) },
    backdrop(theme),
    el('div', { class: 'topbar' },
      el('button', {
        class: 'btn round', 'aria-label': 'חזרה', onClick: () => go(`/p/${profile.id}`),
      }, T.back),
      el('div', { class: 'grow' }, el('h2', {}, `🎖 ${MEDAL.earned}`)),
    ),
    el('div', { class: 'stage' },
      el('p', { class: 'subtitle', text: MEDAL.why(medal.wins, medal.plays) }),
      el('p', { class: 'secret-note', text: MEDAL.secret }),
      el('div', { class: 'wheel-wrap' },
        el('div', { class: 'wheel-pin' }, '▼'),
        wheel,
      ),
      status,
      result,
      spinBtn,
      el('button', {
        class: 'btn', onClick: () => go('/medals'),
      }, MEDAL.showParents),
    ),
  );
}

/* ---------- the medal shelf ---------- */

function medalsScreen() {
  return el('div', { class: 'screen' },
    el('div', { class: 'topbar' },
      el('button', { class: 'btn round', 'aria-label': 'חזרה', onClick: () => go('/') }, T.back),
      el('div', { class: 'grow' }, el('h2', {}, `🎖 ${MEDAL.title}`)),
    ),
    el('p', { class: 'set-hint pad', text: MEDAL.rule }),
    PROFILES.map((p) => {
      const theme = themeFor(p);
      const medals = medalsFor(p.id);
      return el('div', { class: 'medal-block', style: themeVars(theme) },
        el('div', { class: 'kid-head' },
          el('span', { class: 'face', text: p.face }),
          el('span', { class: 'name', text: p.name }),
          el('div', { class: 'grow' }),
          el('span', { class: 'pill' }, `🎖 ${MEDAL.count(medals.length)}`),
        ),
        medals.length
          ? el('div', { class: 'medal-list' },
            medals.slice(0, 12).map((m) =>
              el('div', { class: 'medal' },
                el('div', { class: 'medal-face', text: '🎖' }),
                el('div', { class: 'medal-day', text: m.day }),
                el('div', { class: 'medal-prize', text: m.prize || '🎁' }),
              ),
            ),
          )
          : el('p', { class: 'set-hint', text: MEDAL.none }),
      );
    }),
  );
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
  if (route.screen === 'medals') return app.append(medalsScreen());

  const profile = route.profileId ? getProfile(route.profileId) : null;
  if (!profile) return app.append(homeScreen());
  if (route.wheel) return app.append(wheelScreen(profile));

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
