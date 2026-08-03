/* ---------------------------------------------------------------
   countries.js — the country list behind דגלים.

   `easy: true` marks the ones a 5-year-old has a fair chance at, so
   level 2 draws only from those. `lat`/`lon` are kept for any future
   game that wants to put a country on a map.

   ✏️ To add a country: one row here.
   --------------------------------------------------------------- */

export const COUNTRIES = [
  // --- the ones they'll actually have heard of ---
  { he: 'ישראל', flag: '🇮🇱', lat: 31.5, lon: 34.8, easy: true },
  { he: 'ארצות הברית', flag: '🇺🇸', lat: 39, lon: -98, easy: true },
  { he: 'צרפת', flag: '🇫🇷', lat: 47, lon: 2, easy: true },
  { he: 'איטליה', flag: '🇮🇹', lat: 42.5, lon: 12.5, easy: true },
  { he: 'גרמניה', flag: '🇩🇪', lat: 51, lon: 10, easy: true },
  { he: 'ספרד', flag: '🇪🇸', lat: 40, lon: -4, easy: true },
  { he: 'בריטניה', flag: '🇬🇧', lat: 54, lon: -2, easy: true },
  { he: 'יוון', flag: '🇬🇷', lat: 39, lon: 22, easy: true },
  { he: 'מצרים', flag: '🇪🇬', lat: 27, lon: 30, easy: true },
  { he: 'טורקיה', flag: '🇹🇷', lat: 39, lon: 35, easy: true },
  { he: 'רוסיה', flag: '🇷🇺', lat: 60, lon: 90, easy: true },
  { he: 'סין', flag: '🇨🇳', lat: 35, lon: 105, easy: true },
  { he: 'יפן', flag: '🇯🇵', lat: 36, lon: 138, easy: true },
  { he: 'הודו', flag: '🇮🇳', lat: 22, lon: 79, easy: true },
  { he: 'ברזיל', flag: '🇧🇷', lat: -10, lon: -52, easy: true },
  { he: 'קנדה', flag: '🇨🇦', lat: 58, lon: -105, easy: true },
  { he: 'אוסטרליה', flag: '🇦🇺', lat: -25, lon: 134, easy: true },
  { he: 'ארגנטינה', flag: '🇦🇷', lat: -34, lon: -64, easy: true },

  // --- for אביתר ---
  { he: 'מקסיקו', flag: '🇲🇽', lat: 23, lon: -102 },
  { he: 'פורטוגל', flag: '🇵🇹', lat: 39.5, lon: -8 },
  { he: 'הולנד', flag: '🇳🇱', lat: 52, lon: 5.5 },
  { he: 'שווייץ', flag: '🇨🇭', lat: 47, lon: 8 },
  { he: 'שוודיה', flag: '🇸🇪', lat: 62, lon: 15 },
  { he: 'נורווגיה', flag: '🇳🇴', lat: 62, lon: 9 },
  { he: 'פולין', flag: '🇵🇱', lat: 52, lon: 19 },
  { he: 'אוקראינה', flag: '🇺🇦', lat: 49, lon: 32 },
  { he: 'אירלנד', flag: '🇮🇪', lat: 53, lon: -8 },
  { he: 'דרום אפריקה', flag: '🇿🇦', lat: -29, lon: 24 },
  { he: 'ניגריה', flag: '🇳🇬', lat: 9, lon: 8 },
  { he: 'קניה', flag: '🇰🇪', lat: 0, lon: 38 },
  { he: 'מרוקו', flag: '🇲🇦', lat: 32, lon: -6 },
  { he: 'ערב הסעודית', flag: '🇸🇦', lat: 24, lon: 45 },
  { he: 'איראן', flag: '🇮🇷', lat: 32, lon: 53 },
  { he: 'תאילנד', flag: '🇹🇭', lat: 15, lon: 101 },
  { he: 'דרום קוריאה', flag: '🇰🇷', lat: 36, lon: 128 },
  { he: 'אינדונזיה', flag: '🇮🇩', lat: -2, lon: 118 },
  { he: 'צ׳ילה', flag: '🇨🇱', lat: -33, lon: -71 },
  { he: 'פרו', flag: '🇵🇪', lat: -10, lon: -76 },
];

export const countriesFor = (level) =>
  (level >= 3 ? COUNTRIES : COUNTRIES.filter((c) => c.easy));

/* The map used to live here, for a country-finding game that didn't
   work — see the note at the top of js/games/geography.js. Geography is
   continents and oceans now, and owns its own shapes. This file is just
   the country list behind דגלים. */
