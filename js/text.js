/* ---------------------------------------------------------------
   text.js — every Hebrew string in the app lives here.

   Games are free to use their own language (English games will come
   later — speak() takes a `lang` option), but the shell, the scoring
   and all the level 1-3 games speak Hebrew.
   --------------------------------------------------------------- */

export const LANG = 'he';

export const T = {
  appName: 'משחקי לימוד',
  whoPlays: 'מי משחק?',
  back: '→',
  stars: 'כוכבים',
  points: 'נקודות',
  pointsShort: 'נק׳',

  leaderboard: 'טבלת המובילים',
  thisWeek: 'השבוע',
  thisMonth: 'החודש',
  allTime: 'כל הזמן',
  noScores: 'עוד אף אחד לא שיחק. קדימה!',
  playedGames: (n) => `${n} משחקים`,

  again: '↻ עוד פעם',
  done: 'סיימתי',
  tapToHear: 'לחצו כדי לשמוע שוב 🔊',
  hearAgain: '🔊 שמעו שוב',
  whatDidYouHear: 'מה שמעתם?',
  pickTranslation: 'בחרו את התרגום הנכון',
  tapToCount: 'לחצו על כל אחד כדי לספור 👆',
  noGames: 'אין עדיין משחקים לרמה הזאת.',

  perfect: 'מושלם!',
  greatJob: 'כל הכבוד!',
  goodTry: 'יפה מאוד!',
  tryAgain: 'נסו שוב!',

  ttsMissing:
    'כדי לשמוע את ההוראות בעברית צריך להתקין קול עברי במכשיר: ' +
    'הגדרות ← נגישות ← טקסט לדיבור ← שפה: עברית',
};

/** Counting numbers as kids say them (feminine forms). */
export const NUM = [
  'אפס', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש',
  'שבע', 'שמונה', 'תשע', 'עשר', 'אחת עשרה', 'שתים עשרה',
];

/** Say a number out loud — words for small ones, digits above 12. */
export const num = (n) => (n >= 0 && n < NUM.length ? NUM[n] : String(n));

/** Hebrew has no neutral "the" problem: ה just prefixes the noun. */
export const the = (noun) => `ה${noun}`;
