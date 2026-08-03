/* ---------------------------------------------------------------
   profiles.js — ONE KID PER ENTRY.  ✏️ Edit this file freely.

   Bump `level` on a birthday and that kid's game shelf changes.

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
    colors: ['#7c5cff', '#4130a8'],
  },
  {
    id: 'amitai',
    name: 'אמיתי',
    face: '🐨',
    age: 5,
    gender: 'm',
    level: 2,
    colors: ['#00b4d8', '#0353a4'],
  },
  {
    id: 'ivri',
    name: 'עברי',
    face: '🐥',
    age: 2,
    gender: 'm',
    level: 1,
    colors: ['#ff9f1c', '#e05c02'],
  },
];

export const getProfile = (id) => PROFILES.find((p) => p.id === id) || null;
