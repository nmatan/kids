/* ---------------------------------------------------------------
   profiles.js — ONE KID PER ENTRY.  ✏️ Edit this file freely.

   Bump `level` on a birthday and that kid's game shelf changes.

   `theme` points at an entry in js/themes.js — that's what personalises
   their shelf, the streak effects and the cheers.

   `gender` ('m' / 'f') only drives Hebrew verb forms in the spoken
   encouragement ("אתה מוביל" / "את מובילה"). Change it and the wording
   follows — nothing else depends on it.

   רמה 1 — גיל 2-4:  בלי קריאה, הוראות בקול, בלי הפסדים
   רמה 2 — גיל 5-7:  אותיות וצלילים, מספרים עד 10
   רמה 3 — גיל 8-11: לוח הכפל, שעון, כתיב
   --------------------------------------------------------------- */

export const PROFILES = [
  {
    id: 'evyatar',
    name: 'אביתר',
    face: '🦊',
    age: 7,
    gender: 'm',
    level: 3,
    theme: 'capoeira',
    colors: ['#2fa84f', '#0f5c2b'],
  },
  {
    id: 'amitai',
    name: 'אמיתי',
    face: '🐨',
    age: 5,
    gender: 'm',
    level: 2,
    theme: 'judo',
    colors: ['#3f7ee0', '#123a7a'],
  },
  {
    id: 'ivri',
    name: 'עברי',
    face: '🐥',
    age: 2,
    gender: 'm',
    level: 1,
    theme: 'balls',
    colors: ['#ff9f1c', '#d24e00'],
  },
];

export const getProfile = (id) => PROFILES.find((p) => p.id === id) || null;
