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
  today: 'היום',
  thisWeek: 'השבוע',
  thisMonth: 'החודש',
  noScores: 'עוד אף אחד לא שיחק. קדימה!',
  playedGames: (n) => `${n} משחקים`,
  boardTease: 'מי שמסיים את כל המשחקים של היום ומנצח ב-80% — מקבל מדליה וסיבוב בגלגל 🎁',
  boardLeader: (n) => `${n} בהובלה! 👑`,
  boardTied: 'תיקו בצמרת! 🔥',
  boardEmpty: 'המקום הראשון פנוי. מי לוקח אותו?',

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

/* ---------------------------------------------------------------
   Medals and the prize wheel.
   ✏️ PRIZES is just a list — swap in whatever you're happy to promise.
   The wheel redraws itself for however many there are.
   --------------------------------------------------------------- */

export const PRIZES = [
  { emoji: '🥤', text: 'שלוק לקינוח' },
  { emoji: '💆', text: 'מסאג׳ מאמא' },
  { emoji: '🎵', text: 'לבחור שיר לפני השינה' },
  { emoji: '🤗', text: 'חיבוק מפה-פה הגדול' },
  { emoji: '🥄', text: 'כפית קטשופ' },
  { emoji: '🛏️', text: 'לנוח במיטה של אמא' },
  { emoji: '🎥', text: 'לצלם סרטון לסבתא' },
];

/**
 * The live "how am I doing today" panel on a kid's shelf: how far through
 * the day's games they are, where they stand, and how close the medal is.
 * Positive throughout — nobody is ever told they're losing.
 */
export function hudLines({ profile, rows, done, total, wins, plays }) {
  const me = rows.findIndex((r) => r.profile.id === profile.id);
  const mine = rows[me]?.points ?? 0;
  const top = rows[0];

  let standing;
  if (!top || top.points === 0) {
    standing = 'המקום הראשון של היום פנוי. קדימה! 🚀';
  } else if (me === 0 && mine > (rows[1]?.points ?? 0)) {
    standing = `${g(profile, 'אתה מוביל', 'את מובילה')} היום! 👑`;
  } else if (mine === top.points) {
    standing = `תיקו על המקום הראשון עם ${rows.find((r) => r !== rows[me] && r.points === mine)?.profile.name || ''}! 🔥`;
  } else {
    const ahead = rows[me - 1];
    const gap = ahead.points - mine;
    standing = `עוד ${gap === 1 ? 'נקודה אחת' : `${gap} נקודות`} ${g(profile, 'ואתה עובר', 'ואת עוברת')} את ${ahead.profile.name}! 💪`;
  }

  const left = total - done;
  const rate = plays ? wins / plays : 1;
  let medal;
  if (left === 0) {
    medal = rate >= 0.8
      ? 'סיימת הכל והמדליה שלך! 🎖'
      : 'סיימת את כל המשחקים של היום. מחר מדליה חדשה מחכה! 🎖';
  } else if (rate >= 0.8) {
    medal = `עוד ${left === 1 ? 'משחק אחד' : `${left} משחקים`} ${g(profile, 'ואתה בדרך', 'ואת בדרך')} למדליה ולגלגל 🎁`;
  } else {
    medal = 'למדליה צריך לנצח ב-80% מהמשחקים. עוד אפשר להתהפך! 💪';
  }

  return { standing, medal };
}

export const MEDAL = {
  title: 'מדליות',
  earned: 'מדליית היום! 🎖',
  why: (wins, plays) => `${wins} ניצחונות מתוך ${plays} משחקים היום`,
  claim: '🎖 מגיעה לך מדליה! לפתוח מתנה',
  pending: '🎁 יש לך מתנה שמחכה!',
  spin: '🎡 לסובב את הגלגל!',
  spinning: 'מסתובב...',
  won: 'זכית ב',
  yourPrize: 'המתנה שלך',

  /* The build-up. Short lines, spaced out, so each one lands before the
     next — a spin with no suspense is just a loading bar. */
  tease: 'מאחורי אחד השערים מחכה לך מתנה. אף אחד לא יודע איזו...',
  ready: 'מוכנים? שלוש, שתיים, אחת...',
  rolling: 'מסתובב, מסתובב...',
  almost: 'רגע, זה מאט...',
  drumEnd: 'ו... זכית ב...',
  // The wheel never shows what's on it — only what you landed on.
  secret: 'בגלגל מסתתרות מתנות סודיות 🤫 מגלים רק את זו שיוצאת!',
  progress: (done, total) => `${done} מתוך ${total} משחקים היום`,
  showParents: 'להראות לאבא ואמא 📸',
  none: 'עוד אין מדליות. מסיימים את כל המשחקים של היום ומנצחים ב-80% מהם!',
  count: (n) => (n === 0 ? 'אין עדיין' : n === 1 ? 'מדליה אחת' : `${n} מדליות`),
  rule: 'איך מקבלים מדליה: לסיים את כל המשחקים של היום, ולנצח לפחות ב-80% מהם.',
};

/**
 * The parent gate. Percentages are instant mental arithmetic for an adult
 * but aren't taught until well past 2nd grade, so they stop a curious
 * 7-year-old without making a parent stop and think. Every base/percent
 * pair below divides to a whole number.
 */
const GATE_PCTS = [10, 20, 25, 50];
const GATE_BASES = [20, 40, 60, 80, 120, 200, 300];

export function gateQuestion() {
  const pct = GATE_PCTS[Math.floor(Math.random() * GATE_PCTS.length)];
  const base = GATE_BASES[Math.floor(Math.random() * GATE_BASES.length)];
  return { text: `כמה זה ${pct}% מ-${base}?`, answer: (base * pct) / 100 };
}

export const SET = {
  title: 'הגדרות',
  gate: 'רק להורים',
  gateHint: 'שאלה קצרה למבוגרים',
  gateWrong: 'לא נכון, נסו שוב',
  enter: 'כניסה',

  playSection: 'משחק',
  dailyLimit: 'פעמים ביום בכל משחק',
  dailyLimitHint: 'לכל ילד ולכל משחק בנפרד. כדי לאסוף את כל הנקודות צריך לשחק בכל המדף, לא רק במשחק האהוב',
  pointsPerStar: 'נקודות לכל כוכב',
  pointsPerStarHint: 'כל משחק מדורג 1-3 כוכבים לפי כמה תשובות היו נכונות. ככל שמשחקים טוב יותר, מרוויחים יותר',
  rounds: 'שאלות במשחק',
  roundsAuto: 'ברירת מחדל',
  roundsHint: 'עוקף את מספר השאלות המובנה בכל משחק',

  gamesSection: 'משחקים לכל ילד',
  gamesHint: 'כאן בוחרים מאיזה משחקים מגרילים. כל יום כל ילד מקבל 5 משחקים אקראיים מהמאגר שלו — ככה יש משהו חדש בלי שתצטרכו לגעת. צריך לפחות 5 במאגר; ככל שיש יותר, כך יותר מגוון.',
  poolCount: (n, min) => (n < min ? `${n} במאגר — צריך לפחות ${min}` : `${n} במאגר`),
  byLevel: 'מאגר הגיל',
  useLevel: '↺ חזרה למאגר של הגיל',
  noneChosen: 'לא נבחר אף משחק',

  feelSection: 'קול ותצוגה',
  speech: 'הקראה בקול',
  sound: 'אפקטים קוליים',
  confetti: 'קונפטי בסיום',

  boardSection: 'טבלת המובילים',
  weekStart: 'השבוע מתחיל ביום',
  sunday: 'ראשון',
  monday: 'שני',

  dangerSection: 'איפוס',
  resetScores: 'איפוס כל הניקוד',
  resetScoresHint: 'מוחק את כל הנקודות והכוכבים של כולם. אי אפשר לבטל.',
  resetSettings: 'החזרת הגדרות לברירת מחדל',
  confirm: 'בטוח? לחצו שוב',
  storageNote:
    'הכל נשמר על המכשיר הזה בלבד (localStorage) — אין שרת ואין חשבון. ' +
    'ניקוד בטאבלט לא מסתנכרן עם מכשיר אחר, ומחיקת נתוני האתר בדפדפן תמחק אותו.',
};

export const REWARD = {
  earned: (n) => (n === 1 ? '+1 נקודה' : `+${n} נקודות`),
  rank: (i) => ['🥇 מקום ראשון היום', '🥈 מקום שני היום', '🥉 מקום שלישי היום'][i]
    || `מקום ${i + 1} היום`,
  left: (n) => (n === 1 ? 'נשאר עוד אחד כזה היום' : `נשארו עוד ${n} כאלה היום`),
  lastOne: 'זה היה האחרון להיום במשחק הזה',
  lockedTitle: 'נגמר להיום',
  tomorrow: 'מחר שוב!',
  lockedHint: (limit) => `סיימת את כל המשחקים של היום. מחר יהיו עוד ${limit} בכל אחד!`,
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
  const praise = ['ניסיון יפה!', 'כל הכבוד!', 'יפה מאוד!', 'מעולה! מושלם!'][stars];
  const got = points === 0
    ? 'הפעם בלי נקודה, אבל זה נחשב מהמשחקים של היום.'
    : points === 1 ? 'קיבלת נקודה!' : `קיבלת ${points} נקודות.`;

  const me = rows.findIndex((r) => r.profile.id === profile.id);
  const mine = rows[me]?.points ?? 0;
  let standing;

  if (me === 0) {
    const next = rows[1];
    const gap = mine - (next?.points ?? 0);
    if (!next || next.points === 0) {
      standing = `${g(profile, 'אתה היחיד ששיחק', 'את היחידה ששיחקה')} היום, כל הבמה שלך!`;
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
    ? `זה היה האחרון להיום במשחק הזה, אבל יש עוד משחקים במדף. ${g(profile, 'תחזור', 'תחזרי')} אליו מחר!`
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
