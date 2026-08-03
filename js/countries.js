/* ---------------------------------------------------------------
   countries.js — the country list behind דגלים and איפה בעולם.

   `lat`/`lon` are the country's rough centre, used to place it on the
   equirectangular map. `easy: true` marks the ones a 5-year-old has a
   fair chance at, so level 2 draws only from those.

   ✏️ To add a country: one row here and it shows up in both games.
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

/* ---------------------------------------------------------------
   A very simplified world, drawn as equirectangular outlines.

   The viewBox is literally the globe: x = lon + 180, y = 90 - lat,
   so a country's marker position is the same arithmetic as its
   coordinates. Shapes are deliberately coarse — they're context for
   the markers, not an atlas.
   --------------------------------------------------------------- */

const LAND = {
  northAmerica: [
    [-168, 66], [-155, 71], [-130, 70], [-115, 69], [-100, 69], [-85, 70], [-80, 74],
    [-65, 60], [-55, 50], [-65, 45], [-74, 40], [-81, 31], [-80, 25], [-84, 30],
    [-94, 29], [-97, 26], [-92, 18], [-88, 21], [-83, 10], [-79, 9], [-85, 13],
    [-95, 16], [-105, 20], [-114, 28], [-122, 37], [-124, 48], [-135, 57],
    [-150, 59], [-163, 58],
  ],
  southAmerica: [
    [-79, 9], [-72, 12], [-60, 10], [-52, 4], [-48, -1], [-35, -6], [-39, -15],
    [-48, -25], [-54, -34], [-57, -38], [-62, -40], [-65, -45], [-68, -55],
    [-75, -50], [-73, -40], [-71, -30], [-70, -18], [-77, -12], [-81, -5],
    [-80, 0], [-77, 7],
  ],
  africa: [
    [-17, 21], [-17, 15], [-13, 8], [-7, 4], [3, 6], [9, 4], [9, 2], [12, -5],
    [12, -17], [15, -27], [18, -34], [28, -33], [33, -26], [40, -16], [41, -2],
    [51, 12], [43, 12], [37, 22], [33, 31], [25, 32], [10, 34], [0, 36],
    [-6, 36], [-10, 30],
  ],
  eurasia: [
    [-9, 43], [-9, 37], [-6, 36], [0, 39], [3, 42], [7, 44], [14, 45], [19, 41],
    [24, 38], [27, 41], [36, 36], [35, 33], [34, 31], [39, 21], [45, 13],
    [53, 17], [57, 23], [60, 25], [67, 25], [72, 21], [77, 8], [81, 16],
    [88, 21], [94, 16], [98, 8], [104, 1], [109, 11], [108, 21], [113, 22],
    [121, 31], [122, 40], [127, 39], [131, 43], [135, 54], [141, 53], [155, 59],
    [162, 60], [170, 66], [180, 66], [180, 72], [160, 71], [140, 73], [120, 74],
    [100, 77], [80, 73], [70, 72], [60, 70], [50, 68], [40, 68], [32, 70],
    [28, 71], [20, 70], [15, 68], [12, 65], [5, 62], [8, 58], [10, 55], [4, 52],
    [2, 51], [-1, 49], [-4, 48], [-2, 44],
  ],
  britain: [[-5, 58], [-2, 58], [0, 54], [1, 52], [-1, 50], [-5, 50], [-6, 54], [-5, 56]],
  ireland: [[-10, 54], [-6, 55], [-6, 52], [-9, 51], [-10, 53]],
  greenland: [[-45, 60], [-20, 70], [-20, 82], [-45, 83], [-58, 82], [-55, 70], [-50, 62]],
  australia: [
    [113, -22], [114, -34], [118, -35], [129, -32], [137, -35], [141, -38],
    [147, -38], [150, -35], [153, -28], [146, -19], [142, -11], [136, -12],
    [130, -11], [126, -14], [121, -20],
  ],
  japan: [[130, 31], [135, 34], [140, 36], [142, 42], [145, 44], [141, 45], [136, 37], [131, 33]],
  indonesia: [
    [95, 5], [105, -6], [115, -8], [125, -8], [135, -4], [141, -3], [141, -9],
    [130, -9], [120, -10], [110, -8], [100, 0],
  ],
  madagascar: [[43, -12], [50, -15], [47, -25], [44, -20]],
  newZealand: [[172, -34], [178, -37], [174, -41], [170, -46], [166, -46], [172, -41]],
};

/** SVG path data for every landmass, in globe coordinates. */
export const LAND_PATHS = Object.values(LAND).map(
  (points) => `M${points.map(([lon, lat]) => `${lon + 180},${90 - lat}`).join('L')}Z`,
);

/** Where a country sits on the map, as percentages of width/height. */
export const positionOf = (country) => ({
  left: ((country.lon + 180) / 360) * 100,
  top: ((90 - country.lat) / 180) * 100,
});
