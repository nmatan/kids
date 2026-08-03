/* ---------------------------------------------------------------
   themes.js — each kid's own world.

   A theme decides what their shelf looks like and what flies across the
   screen on a hot streak.

   The words stay plain on purpose. Insider vocabulary (roda, dojo, axé)
   means nothing to a child who just wants to play — the pictures carry
   the theme, the writing carries the encouragement.

   ✏️ To retheme a kid: change `theme` in js/profiles.js to one of the
   keys here, or add a new entry below. Nothing else needs touching.
   --------------------------------------------------------------- */

export const THEMES = {
  capoeira: {
    name: 'קפוארה',
    badge: '🤸',
    space: (n) => `המשחקים של ${n}`,
    icons: ['🤸', '🥁', '🪘', '🎶', '🌴', '🟢'],
    colors: ['#2fa84f', '#0f5c2b'],
    glow: '#ffd23f',
    cheers: ['יופי!', 'אלוף!', 'ממשיכים ככה!', 'קפוארה!'],
  },

  judo: {
    name: 'ג׳ודו',
    badge: '🥋',
    space: (n) => `המשחקים של ${n}`,
    icons: ['🥋', '🤼', '🎌', '⚪', '⚫', '🔵'],
    colors: ['#3f7ee0', '#123a7a'],
    glow: '#a8d4ff',
    cheers: ['יופי!', 'אלוף!', 'ממשיכים ככה!', 'ג׳ודו!'],
  },

  balls: {
    name: 'כדורים',
    badge: '⚽',
    space: (n) => `המשחקים של ${n}`,
    icons: ['⚽', '🏀', '🏐', '🎾', '⚾', '🏈'],
    colors: ['#ff9f1c', '#d24e00'],
    glow: '#ffe08a',
    cheers: ['יופי!', 'אלוף!', 'ממשיכים ככה!', 'גול!'],
  },
};

export const themeFor = (profile) => THEMES[profile?.theme] || THEMES.balls;
