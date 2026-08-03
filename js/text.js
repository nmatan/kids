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

/* ---------------------------------------------------------------
   Daily allowance + the spoken cheer at the end of a game.
   --------------------------------------------------------------- */

/** Masculine / feminine picker, driven by the profile's `gender`. */
const g = (p, mas, fem) => (p?.gender === 'f' ? fem : mas);

export const REWARD = {
  earned: (n) => `+${n} נקודות`,
  rank: (i) => ['🥇 מקום ראשון השבוע', '🥈 מקום שני השבוע', '🥉 מקום שלישי השבוע'][i]
    || `מקום ${i + 1} השבוע`,
  left: (n) => (n === 1 ? 'נשאר עוד משחק אחד היום' : `נשארו עוד ${n} משחקים היום`),
  lastOne: 'זה היה האחרון להיום',
  lockedTitle: 'נגמר להיום',
  lockedHint: 'מחר יהיו עוד 10',
  leftShort: (n) => `נשארו ${n} היום`,
};

/**
 * The congratulation spoken after a finished game: how they did, what
 * they earned, how many plays are left today, and where they stand this
 * week. Competitive and a bit cheeky, never mean — nobody is told they're
 * losing, only how close the next place is.
 *
 * @param rows leaderboard() output for the week, already including this play
 */
export function cheerLine({ profile, stars, points, remaining, rows }) {
  const praise = ['ניסיון יפה!', 'כל הכבוד!', 'יפה מאוד!', 'וואו, מושלם!'][stars];
  const got = `${g(profile, 'קיבלת', 'קיבלת')} ${points} נקודות.`;

  const me = rows.findIndex((r) => r.profile.id === profile.id);
  const mine = rows[me]?.points ?? 0;
  let standing;

  if (me === 0) {
    const next = rows[1];
    const gap = mine - (next?.points ?? 0);
    if (!next || next.points === 0) {
      standing = `${g(profile, 'אתה היחיד ששיחק', 'את היחידה ששיחקה')} השבוע, כל הבמה שלך!`;
    } else if (gap === 0) {
      standing = `${g(profile, 'אתה', 'את')} ו${next.profile.name} בדיוק תיקו! מי ${g(profile, 'ייקח', 'תיקח')} את ההובלה?`;
    } else if (gap <= 20) {
      standing = `${g(profile, 'אתה', 'את')} ${g(profile, 'ראשון', 'ראשונה')}, אבל ${next.profile.name} נושף לך בעורף, רק ${gap} נקודות מאחורה!`;
    } else {
      standing = `${g(profile, 'אתה', 'את')} ${g(profile, 'ראשון', 'ראשונה')} עם ${gap} נקודות יתרון על ${next.profile.name}. ${g(profile, 'תמשיך', 'תמשיכי')} ככה!`;
    }
  } else {
    const ahead = rows[me - 1];
    const gap = ahead.points - mine;
    if (gap === 0) {
      standing = `${g(profile, 'אתה', 'את')} ו${ahead.profile.name} תיקו! עוד משחק אחד ${g(profile, 'ואתה עוקף', 'ואת עוקפת')}.`;
    } else if (gap <= 30) {
      standing = `${ahead.profile.name} רק ${gap} נקודות ${g(profile, 'לפניך', 'לפנייך')}. עוד משחק טוב ${g(profile, 'ואתה עוקף', 'ואת עוקפת')} ${g(ahead.profile, 'אותו', 'אותה')}!`;
    } else {
      standing = `${ahead.profile.name} ${g(ahead.profile, 'מוביל', 'מובילה')} ב-${gap} נקודות. יש ${g(profile, 'לך', 'לך')} עוד זמן היום לצמצם!`;
    }
  }

  const left = remaining === 0
    ? `זה היה האחרון להיום במשחק הזה. ${g(profile, 'תחזור', 'תחזרי')} מחר לעוד עשרה!`
    : remaining === 1
      ? 'נשאר לך עוד משחק אחד כזה היום.'
      : `נשארו לך עוד ${remaining} משחקים כאלה היום.`;

  return `${praise} ${got} ${standing} ${left}`;
}

/** Counting numbers as kids say them (feminine forms). */
export const NUM = [
  'אפס', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש',
  'שבע', 'שמונה', 'תשע', 'עשר', 'אחת עשרה', 'שתים עשרה',
];

/** Say a number out loud — words for small ones, digits above 12. */
export const num = (n) => (n >= 0 && n < NUM.length ? NUM[n] : String(n));

/** Hebrew has no neutral "the" problem: ה just prefixes the noun. */
export const the = (noun) => `ה${noun}`;
