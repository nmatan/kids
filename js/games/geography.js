/* איפה בעולם? — למצוא יבשות ואוקיינוסים על מפת העולם. (רמות 2-3)

   ── למה יבשות ולא מדינות ─────────────────────────────────────────
   הגרסה הראשונה ביקשה למצוא מדינות, וזה פשוט לא עבד: בלי גבולות
   מצוירים אין שום דבר לראות, הסימנים היו קטנים, והילד לחץ על נקודה
   בלי להבין מה בחר. גבולות אמיתיים דורשים מאגר גאוגרפי שלם, וזה לא
   שווה את זה כאן.

   יבשות ואוקיינוסים פותרים את הכל בבת אחת: הם ענקיים, יש להם צורה
   ברורה שאפשר ללחוץ עליה, וזה בדיוק מה שילד בגיל הזה אמור לדעת —
   קודם המפה הגדולה, אחר כך המדינות.

   הכל בהטלה שטוחה: x = קו אורך + 180, y = 90 - קו רוחב.
   האוקיינוסים מצוירים ראשונים ומתחת ליבשות, ולכן לחיצה על יבשה תמיד
   פוגעת ביבשה — מה שנשאר גלוי מהמלבן הכחול הוא בדיוק הים.

   ✏️ להוסיף אזור: שורה ל-REGIONS. lv 2 = מה שאמיתי מקבל, lv 3 = הכל. */

import { Round, el, sample, pick, speak, wait } from '../kit.js';
import { T } from '../text.js';

export const meta = {
  id: 'geography',
  title: 'איפה בעולם?',
  emoji: '🌍',
  blurb: 'מוצאים יבשות ואוקיינוסים',
  levels: [2, 3],
  scales: { 2: '5 יבשות גדולות', 3: 'כל היבשות והאוקיינוסים' },
};

/* Oceans are plain lat/lon boxes. They sit under the land, so the part
   that stays visible is the water — no need to trace real coastlines. */
const SEA = (w, e, s, n) => [[[w, n], [e, n], [e, s], [w, s]]];

const REGIONS = [
  // ---------- יבשות ----------
  { id: 'africa', he: 'אפריקה', kind: 'land', lv: 2, parts: [[
    [-17, 21], [-17, 15], [-13, 8], [-7, 4], [3, 6], [9, 4], [9, 2], [12, -5],
    [12, -17], [15, -27], [18, -34], [28, -33], [33, -26], [40, -16], [41, -2],
    [51, 12], [43, 12], [37, 22], [33, 31], [25, 32], [10, 34], [0, 36], [-6, 36], [-10, 30],
  ]] },

  { id: 'europe', he: 'אירופה', kind: 'land', lv: 2, parts: [[
    [-9, 43], [-9, 37], [-6, 36], [0, 39], [3, 42], [7, 44], [14, 45], [19, 41],
    [24, 38], [27, 41], [30, 45], [40, 48], [50, 52], [60, 55], [60, 68], [50, 68],
    [40, 68], [32, 70], [28, 71], [20, 70], [15, 68], [12, 65], [5, 62], [8, 58],
    [10, 55], [4, 52], [2, 51], [-1, 49], [-4, 48], [-2, 44],
  ], [[-5, 58], [-2, 58], [0, 54], [1, 52], [-1, 50], [-5, 50], [-6, 54], [-5, 56]],
    [[-10, 54], [-6, 55], [-6, 52], [-9, 51], [-10, 53]]] },

  { id: 'asia', he: 'אסיה', kind: 'land', lv: 2, parts: [[
    [27, 41], [36, 36], [35, 33], [34, 31], [39, 21], [45, 13], [53, 17], [57, 23],
    [60, 25], [67, 25], [72, 21], [77, 8], [81, 16], [88, 21], [94, 16], [98, 8],
    [104, 1], [109, 11], [108, 21], [113, 22], [121, 31], [122, 40], [127, 39],
    [131, 43], [135, 54], [141, 53], [155, 59], [162, 60], [170, 66], [180, 66],
    [180, 72], [160, 71], [140, 73], [120, 74], [100, 77], [80, 73], [70, 72],
    [60, 68], [60, 55], [50, 52], [40, 48], [30, 45],
  ], [[130, 31], [135, 34], [140, 36], [142, 42], [145, 44], [141, 45], [136, 37], [131, 33]],
    [[95, 5], [105, -6], [115, -8], [125, -8], [135, -4], [141, -3], [141, -9],
      [130, -9], [120, -10], [110, -8], [100, 0]]] },

  { id: 'northAmerica', he: 'אמריקה הצפונית', kind: 'land', lv: 2, parts: [[
    [-168, 66], [-155, 71], [-130, 70], [-115, 69], [-100, 69], [-85, 70], [-80, 74],
    [-65, 60], [-55, 50], [-65, 45], [-74, 40], [-81, 31], [-80, 25], [-84, 30],
    [-94, 29], [-97, 26], [-92, 18], [-88, 21], [-83, 10], [-79, 9], [-85, 13],
    [-95, 16], [-105, 20], [-114, 28], [-122, 37], [-124, 48], [-135, 57],
    [-150, 59], [-163, 58],
  ], [[-45, 60], [-20, 70], [-20, 82], [-45, 83], [-58, 82], [-55, 70], [-50, 62]]] },

  { id: 'southAmerica', he: 'אמריקה הדרומית', kind: 'land', lv: 2, parts: [[
    [-79, 9], [-72, 12], [-60, 10], [-52, 4], [-48, -1], [-35, -6], [-39, -15],
    [-48, -25], [-54, -34], [-57, -38], [-62, -40], [-65, -45], [-68, -55],
    [-75, -50], [-73, -40], [-71, -30], [-70, -18], [-77, -12], [-81, -5], [-80, 0], [-77, 7],
  ]] },

  { id: 'australia', he: 'אוסטרליה', kind: 'land', lv: 3, parts: [[
    [113, -22], [114, -34], [118, -35], [129, -32], [137, -35], [141, -38],
    [147, -38], [150, -35], [153, -28], [146, -19], [142, -11], [136, -12],
    [130, -11], [126, -14], [121, -20],
  ], [[172, -34], [178, -37], [174, -41], [170, -46], [166, -46], [172, -41]]] },

  { id: 'antarctica', he: 'אנטארקטיקה', kind: 'land', lv: 3,
    parts: [[[-180, -66], [180, -66], [180, -90], [-180, -90]]] },

  // ---------- אוקיינוסים ----------
  { id: 'atlantic', he: 'האוקיינוס האטלנטי', kind: 'sea', lv: 3,
    parts: SEA(-80, 20, -55, 65) },
  { id: 'pacific', he: 'האוקיינוס השקט', kind: 'sea', lv: 3,
    parts: [...SEA(-180, -80, -55, 62), ...SEA(120, 180, -55, 62)] },
  { id: 'indian', he: 'האוקיינוס ההודי', kind: 'sea', lv: 3,
    parts: SEA(20, 120, -55, 25) },
  { id: 'arctic', he: 'האוקיינוס הארקטי', kind: 'sea', lv: 3,
    parts: SEA(-180, 180, 66, 90) },
];

const SVG = 'http://www.w3.org/2000/svg';
const toPath = (parts) => parts
  .map((pts) => `M${pts.map(([lon, lat]) => `${lon + 180},${90 - lat}`).join('L')}Z`)
  .join('');

export function mount(stage, ctx) {
  // אמיתי gets the five big landmasses; אביתר gets oceans and the poles too.
  const pool = ctx.profile.level >= 3 ? REGIONS : REGIONS.filter((r) => r.lv <= 2);
  const round = new Round(stage, ctx, { rounds: 10, pauseOk: 1600, pauseNo: 2800 });
  let last = null;

  round.start((view, api) => {
    let answer = pick(pool);
    while (pool.length > 1 && answer === last) answer = pick(pool);
    last = answer;

    const ask = () => speak(`איפה ${answer.he}?`);
    ask();

    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 360 180');
    svg.setAttribute('class', 'world');
    const shapes = new Map();

    // Seas first so land sits on top of them and always wins a tap.
    [...pool].sort((a, b) => (a.kind === 'sea' ? -1 : 1) - (b.kind === 'sea' ? -1 : 1))
      .forEach((region) => {
        const path = document.createElementNS(SVG, 'path');
        path.setAttribute('d', toPath(region.parts));
        path.setAttribute('class', `region ${region.kind}`);
        path.addEventListener('click', async () => {
          if (region.id === answer.id) {
            path.setAttribute('class', `region ${region.kind} right`);
            speak(`${answer.he}! נכון`, { rate: 0.9 });
            api.ok(path);
          } else {
            path.setAttribute('class', `region ${region.kind} miss`);
            api.no(path);
            const correct = shapes.get(answer.id);
            correct.setAttribute('class', `region ${answer.kind} right reveal`);
            await wait(400);
            speak(`זאת ${region.he}. ${answer.he} נמצאת כאן`, { rate: 0.85 });
          }
        });
        shapes.set(region.id, path);
        svg.append(path);
      });

    view.append(
      el('div', { class: 'prompt tight', onClick: ask },
        `איפה ${answer.he}?`,
        el('small', { text: T.tapToHear }),
      ),
      el('div', { class: 'map-wrap' }, svg),
    );
  });

  return () => round.stop();
}
