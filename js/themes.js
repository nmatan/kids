/* ---------------------------------------------------------------
   themes.js — each kid's own world.

   A theme decides what their shelf looks like, what flies across the
   screen on a hot streak, and what gets shouted when it does.

   ✏️ To retheme a kid: change `theme` in js/profiles.js to one of the
   keys here, or add a new entry below. Nothing else needs touching.
   --------------------------------------------------------------- */

export const THEMES = {
  capoeira: {
    name: 'קפוארה',
    badge: '🤸',
    space: (n) => `הרודה של ${n}`,
    icons: ['🤸', '🥁', '🪘', '🎶', '🌴', '🟢'],
    colors: ['#2fa84f', '#0f5c2b'],
    glow: '#ffd23f',
    cheers: ['אשֶׁה!', 'ז׳ינגה!', 'איזו רודה!', 'ממש קפוארה!'],
  },

  judo: {
    name: 'ג׳ודו',
    badge: '🥋',
    space: (n) => `הדוג׳ו של ${n}`,
    icons: ['🥋', '🤼', '🎌', '⚪', '⚫', '🔵'],
    colors: ['#3f7ee0', '#123a7a'],
    glow: '#a8d4ff',
    cheers: ['איפון!', 'יפה, ג׳ודוקה!', 'הָג׳ימֵה!', 'חגורה שחורה!'],
  },

  balls: {
    name: 'כדורים',
    badge: '⚽',
    space: (n) => `המגרש של ${n}`,
    icons: ['⚽', '🏀', '🏐', '🎾', '⚾', '🏈'],
    colors: ['#ff9f1c', '#d24e00'],
    glow: '#ffe08a',
    cheers: ['גול!', 'סל!', 'איזה כדור!', 'שלוש נקודות!'],
  },
};

export const themeFor = (profile) => THEMES[profile?.theme] || THEMES.balls;
