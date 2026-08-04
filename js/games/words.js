/* מילים באנגלית — תרגום מילים בודדות, לשני הכיוונים. (רמות 2-3)

   ההשלמה ל"מה זה אומר?": שם משפט שלם וכאן מילה אחת, וזה הרבה יותר
   קל להתחיל איתו. הכיוון מתחלף כל סבב — פעם אנגלית לעברית ופעם
   הפוך — כי לזהות מילה שרואים זה לא אותו דבר כמו לשלוף אותה.

   המילה תמיד גם נכתבת וגם נאמרת, כל אחת בשפה שלה: מילה אנגלית
   נאמרת בקול אנגלי ומילה עברית בקול עברי. ערבוב של שתי שפות
   במשפט אחד יוצא לא מובן בשתיהן.

   ✏️ להוסיף מילה: שורה ל-WORDS. easy: true = גם אמיתי מקבל אותה. */

import { Round, el, choicesFor, pick, speak, wait } from '../kit.js';
import { T } from '../text.js';

export const meta = {
  id: 'words',
  title: 'מילים באנגלית',
  emoji: '🗣️',
  blurb: 'תרגום מילים לשני הכיוונים',
  levels: [2, 3],
  scales: { 2: 'מילים בסיסיות בלבד', 3: 'כל המילים, כולל מופשטות' },
};

const WORDS = [
  // --- הבסיס: גם אמיתי ---
  { en: 'dog', he: 'כלב', easy: true }, { en: 'cat', he: 'חתול', easy: true },
  { en: 'bird', he: 'ציפור', easy: true }, { en: 'fish', he: 'דג', easy: true },
  { en: 'horse', he: 'סוס', easy: true }, { en: 'cow', he: 'פרה', easy: true },
  { en: 'sun', he: 'שמש', easy: true }, { en: 'moon', he: 'ירח', easy: true },
  { en: 'water', he: 'מים', easy: true }, { en: 'bread', he: 'לחם', easy: true },
  { en: 'milk', he: 'חלב', easy: true }, { en: 'apple', he: 'תפוח', easy: true },
  { en: 'house', he: 'בית', easy: true }, { en: 'book', he: 'ספר', easy: true },
  { en: 'car', he: 'מכונית', easy: true }, { en: 'ball', he: 'כדור', easy: true },
  { en: 'tree', he: 'עץ', easy: true }, { en: 'flower', he: 'פרח', easy: true },
  { en: 'red', he: 'אדום', easy: true }, { en: 'blue', he: 'כחול', easy: true },
  { en: 'green', he: 'ירוק', easy: true }, { en: 'yellow', he: 'צהוב', easy: true },
  { en: 'big', he: 'גדול', easy: true }, { en: 'small', he: 'קטן', easy: true },
  { en: 'hot', he: 'חם', easy: true }, { en: 'cold', he: 'קר', easy: true },
  { en: 'mother', he: 'אמא', easy: true }, { en: 'father', he: 'אבא', easy: true },
  { en: 'boy', he: 'ילד', easy: true }, { en: 'girl', he: 'ילדה', easy: true },
  { en: 'hand', he: 'יד', easy: true }, { en: 'eye', he: 'עין', easy: true },
  { en: 'head', he: 'ראש', easy: true }, { en: 'door', he: 'דלת', easy: true },
  { en: 'window', he: 'חלון', easy: true }, { en: 'table', he: 'שולחן', easy: true },
  { en: 'chair', he: 'כיסא', easy: true }, { en: 'friend', he: 'חבר', easy: true },
  { en: 'happy', he: 'שמח', easy: true }, { en: 'night', he: 'לילה', easy: true },
  { en: 'day', he: 'יום', easy: true }, { en: 'school', he: 'בית ספר', easy: true },

  // --- לאביתר ---
  { en: 'bridge', he: 'גשר' }, { en: 'mountain', he: 'הר' },
  { en: 'river', he: 'נהר' }, { en: 'forest', he: 'יער' },
  { en: 'island', he: 'אי' }, { en: 'beach', he: 'חוף' },
  { en: 'kitchen', he: 'מטבח' }, { en: 'garden', he: 'גינה' },
  { en: 'bottle', he: 'בקבוק' }, { en: 'key', he: 'מפתח' },
  { en: 'clock', he: 'שעון' }, { en: 'money', he: 'כסף' },
  { en: 'letter', he: 'מכתב' }, { en: 'picture', he: 'תמונה' },
  { en: 'story', he: 'סיפור' }, { en: 'question', he: 'שאלה' },
  { en: 'answer', he: 'תשובה' }, { en: 'teacher', he: 'מורה' },
  { en: 'doctor', he: 'רופא' }, { en: 'village', he: 'כפר' },
  { en: 'market', he: 'שוק' }, { en: 'cloud', he: 'ענן' },
  { en: 'rain', he: 'גשם' }, { en: 'snow', he: 'שלג' },
  { en: 'wind', he: 'רוח' }, { en: 'shoe', he: 'נעל' },
  { en: 'shirt', he: 'חולצה' }, { en: 'brave', he: 'אמיץ' },
  { en: 'strong', he: 'חזק' }, { en: 'quiet', he: 'שקט' },
  { en: 'heavy', he: 'כבד' }, { en: 'empty', he: 'ריק' },
  { en: 'full', he: 'מלא' }, { en: 'early', he: 'מוקדם' },
  { en: 'late', he: 'מאוחר' }, { en: 'together', he: 'ביחד' },
  { en: 'always', he: 'תמיד' }, { en: 'again', he: 'שוב' },
];

export function mount(stage, ctx) {
  const pool = ctx.profile.level >= 3 ? WORDS : WORDS.filter((w) => w.easy);
  const round = new Round(stage, ctx, { rounds: 10, pauseOk: 1400, pauseNo: 2400 });
  let last = null;

  round.start((view, api) => {
    let word = pick(pool);
    while (pool.length > 1 && word === last) word = pick(pool);
    last = word;

    // Swap direction every round: recognising a word you can see is a
    // different skill from retrieving one you can't.
    const toHebrew = api.index % 2 === 0;
    const shown = toHebrew ? word.en : word.he;
    const shownLang = toHebrew ? 'en' : 'he';
    const options = choicesFor(word, pool, 3, (w) => w.en);

    const ask = () => speak(shown, { lang: shownLang, rate: 0.8 });
    ask();

    let rightBtn = null;
    const buttons = options.map((opt) => {
      const label = toHebrew ? opt.he : opt.en;
      const btn = el('button', {
        class: `choice word-choice ${toHebrew ? '' : 'ltr'}`.trim(),
        onClick: async () => {
          if (opt.en === word.en) {
            speak(toHebrew ? word.he : word.en, { lang: toHebrew ? 'he' : 'en' });
            api.ok(btn);
          } else {
            api.no(btn);
            api.reveal(rightBtn);
            await wait(400);
            // Say the answer in its own language only — one utterance
            // holding both languages comes out wrong in both.
            if (toHebrew) speak(`התשובה הנכונה: ${word.he}`, { rate: 0.85 });
            else speak(word.en, { lang: 'en', rate: 0.75 });
          }
        },
      }, label);
      if (opt.en === word.en) rightBtn = btn;
      return btn;
    });

    view.append(
      el('div', { class: 'prompt tight' },
        toHebrew ? 'מה זה אומר בעברית?' : 'איך אומרים את זה באנגלית?',
      ),
      el('div', {
        class: `big-word ${shownLang === 'en' ? 'ltr' : ''}`.trim(),
        onClick: ask,
      }, shown, el('small', { class: 'rtl', text: T.tapToHear })),
      el('div', { class: 'choices column' }, buttons),
    );
  });

  return () => round.stop();
}
