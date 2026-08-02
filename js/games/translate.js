/* מה זה אומר? — שומעים משפט באנגלית ובוחרים את התרגום הנכון. (רמה 3)

   שני יעדים בו-זמנית: הבנת אנגלית פשוטה, וקריאה בעברית — ולכן
   המשפט האנגלי גם נקרא בקול וגם מסומן מילה-מילה, והתשובות הן
   משפטים שלמים בעברית שצריך לקרוא עד הסוף.

   ✏️ להוסיף משפטים: פשוט להוסיף שורות ל-SENTENCES למטה.
      en — 4-5 מילים, אוצר מילים של כיתה ב׳
      he — 3-5 מילים
      tag — נושא. המסיחים נבחרים קודם כל מאותו נושא, כדי שלא
            יהיה אפשר לפסול אותם בלי באמת לקרוא. */

import { Round, el, shuffle, sample, pick, speak, speakSentence, wait } from '../kit.js';
import { T } from '../text.js';

export const meta = {
  id: 'translate',
  title: 'מה זה אומר?',
  emoji: '💬',
  blurb: 'שומעים באנגלית, בוחרים תרגום',
  levels: [3],
};

const SENTENCES = [
  // ---- animals ----
  { en: 'The cat is very small.', he: 'החתול מאוד קטן.', tag: 'animals' },
  { en: 'My dog likes to run.', he: 'הכלב שלי אוהב לרוץ.', tag: 'animals' },
  { en: 'The bird sings every morning.', he: 'הציפור שרה כל בוקר.', tag: 'animals' },
  { en: 'A big lion is sleeping.', he: 'אריה גדול ישן.', tag: 'animals' },
  { en: 'The fish swims in water.', he: 'הדג שוחה במים.', tag: 'animals' },
  { en: 'My cat drinks the milk.', he: 'החתול שלי שותה את החלב.', tag: 'animals' },
  { en: 'The horse runs very fast.', he: 'הסוס רץ מהר מאוד.', tag: 'animals' },
  { en: 'Little birds fly in the sky.', he: 'ציפורים קטנות עפות בשמיים.', tag: 'animals' },
  { en: 'The elephant is very big.', he: 'הפיל מאוד גדול.', tag: 'animals' },
  { en: 'A rabbit eats a carrot.', he: 'ארנב אוכל גזר.', tag: 'animals' },

  // ---- family ----
  { en: 'My mother is very kind.', he: 'אמא שלי מאוד טובה.', tag: 'family' },
  { en: 'My father reads a book.', he: 'אבא שלי קורא ספר.', tag: 'family' },
  { en: 'My sister is seven years old.', he: 'אחותי בת שבע.', tag: 'family' },
  { en: 'My brother plays with me.', he: 'אחי משחק איתי.', tag: 'family' },
  { en: 'Grandma makes a sweet cake.', he: 'סבתא מכינה עוגה מתוקה.', tag: 'family' },
  { en: 'We eat dinner together.', he: 'אנחנו אוכלים ארוחת ערב ביחד.', tag: 'family' },
  { en: 'My family goes to the park.', he: 'המשפחה שלי הולכת לפארק.', tag: 'family' },
  { en: 'Grandpa tells a funny story.', he: 'סבא מספר סיפור מצחיק.', tag: 'family' },

  // ---- food ----
  { en: 'I eat an apple.', he: 'אני אוכל תפוח.', tag: 'food' },
  { en: 'The bread is very fresh.', he: 'הלחם מאוד טרי.', tag: 'food' },
  { en: 'She drinks cold water.', he: 'היא שותה מים קרים.', tag: 'food' },
  { en: 'The cake is very sweet.', he: 'העוגה מאוד מתוקה.', tag: 'food' },
  { en: 'I like to eat pizza.', he: 'אני אוהב לאכול פיצה.', tag: 'food' },
  { en: 'The soup is too hot.', he: 'המרק חם מדי.', tag: 'food' },
  { en: 'He eats a red apple.', he: 'הוא אוכל תפוח אדום.', tag: 'food' },
  { en: 'We buy milk and bread.', he: 'אנחנו קונים חלב ולחם.', tag: 'food' },

  // ---- school ----
  { en: 'I go to school.', he: 'אני הולך לבית ספר.', tag: 'school' },
  { en: 'The teacher is very nice.', he: 'המורה מאוד נחמדה.', tag: 'school' },
  { en: 'I read a new book.', he: 'אני קורא ספר חדש.', tag: 'school' },
  { en: 'My friend sits near me.', he: 'החבר שלי יושב לידי.', tag: 'school' },
  { en: 'We write in the notebook.', he: 'אנחנו כותבים במחברת.', tag: 'school' },
  { en: 'The lesson starts at eight.', he: 'השיעור מתחיל בשמונה.', tag: 'school' },
  { en: 'I like my new teacher.', he: 'אני אוהב את המורה החדשה.', tag: 'school' },

  // ---- play ----
  { en: 'The children play outside.', he: 'הילדים משחקים בחוץ.', tag: 'play' },
  { en: 'He kicks the big ball.', he: 'הוא בועט בכדור הגדול.', tag: 'play' },
  { en: 'We ride our bikes.', he: 'אנחנו רוכבים על האופניים.', tag: 'play' },
  { en: 'She jumps very high.', he: 'היא קופצת מאוד גבוה.', tag: 'play' },
  { en: 'They run in the park.', he: 'הם רצים בפארק.', tag: 'play' },
  { en: 'I play with my friends.', he: 'אני משחק עם החברים שלי.', tag: 'play' },
  { en: 'The boy climbs a tree.', he: 'הילד מטפס על עץ.', tag: 'play' },

  // ---- home ----
  { en: 'My room is very clean.', he: 'החדר שלי מאוד נקי.', tag: 'home' },
  { en: 'The red door is open.', he: 'הדלת האדומה פתוחה.', tag: 'home' },
  { en: 'I sleep in my bed.', he: 'אני ישן במיטה שלי.', tag: 'home' },
  { en: 'The window is very big.', he: 'החלון מאוד גדול.', tag: 'home' },
  { en: 'We sit at the table.', he: 'אנחנו יושבים ליד השולחן.', tag: 'home' },
  { en: 'The house has a garden.', he: 'לבית יש גינה.', tag: 'home' },

  // ---- nature ----
  { en: 'The sun is very hot.', he: 'השמש מאוד חמה.', tag: 'nature' },
  { en: 'It rains all day.', he: 'יורד גשם כל היום.', tag: 'nature' },
  { en: 'The sky is very blue.', he: 'השמים מאוד כחולים.', tag: 'nature' },
  { en: 'The tree is very tall.', he: 'העץ מאוד גבוה.', tag: 'nature' },
  { en: 'A cold wind blows.', he: 'רוח קרה נושבת.', tag: 'nature' },
  { en: 'The moon shines at night.', he: 'הירח זורח בלילה.', tag: 'nature' },
  { en: 'Flowers grow in the garden.', he: 'פרחים גדלים בגינה.', tag: 'nature' },

  // ---- feelings ----
  { en: 'I am very happy today.', he: 'אני מאוד שמח היום.', tag: 'feelings' },
  { en: 'He is very tired.', he: 'הוא מאוד עייף.', tag: 'feelings' },
  { en: 'My hands are cold.', he: 'הידיים שלי קרות.', tag: 'feelings' },
  { en: 'She has long hair.', he: 'יש לה שיער ארוך.', tag: 'feelings' },
  { en: 'I am not afraid.', he: 'אני לא מפחד.', tag: 'feelings' },

  // ---- things ----
  { en: 'The car is very fast.', he: 'המכונית מאוד מהירה.', tag: 'things' },
  { en: 'My shoes are new.', he: 'הנעליים שלי חדשות.', tag: 'things' },
  { en: 'The new ball is red.', he: 'הכדור החדש אדום.', tag: 'things' },
  { en: 'I have a small bag.', he: 'יש לי תיק קטן.', tag: 'things' },
  { en: 'The train is very long.', he: 'הרכבת מאוד ארוכה.', tag: 'things' },
];

export function mount(stage, ctx) {
  const round = new Round(stage, ctx, { rounds: 10, pauseOk: 1600, pauseNo: 2600 });
  let stopAudio = null;

  round.start((view, api) => {
    const answer = pick(SENTENCES);

    // Wrong answers are just other sentences' translations, so the bank
    // does double duty. Same-topic ones come first: a distractor from a
    // totally different subject can be ruled out without really reading it.
    const sameTag = SENTENCES.filter((s) => s.tag === answer.tag && s.he !== answer.he);
    const otherTag = SENTENCES.filter((s) => s.tag !== answer.tag);
    const wrongs = [...sample(sameTag, 2), ...sample(otherTag, 2)].slice(0, 2);
    const options = shuffle([answer, ...wrongs]);

    const wordEls = answer.en.split(/\s+/).map((w) => el('span', { class: 'word' }, w));
    const sentence = el('div', { class: 'sentence', dir: 'ltr' }, wordEls);

    const play = () => {
      stopAudio?.();
      stopAudio = speakSentence(answer.en, {
        lang: 'en',
        rate: 0.75,
        onWord: (i) => wordEls.forEach((w, k) => w.classList.toggle('on', k === i)),
      });
    };
    play();

    let rightBtn = null;
    const buttons = options.map((s) => {
      const btn = el('button', { class: 'choice sentence-choice', onClick: async () => {
        stopAudio?.();
        wordEls.forEach((w) => w.classList.remove('on'));

        if (s.he === answer.he) {
          speak(answer.he, { rate: 0.85 });
          api.ok(btn);
        } else {
          api.no(btn);
          api.reveal(rightBtn);
          await wait(500);
          speak(answer.he, { rate: 0.8 }); // hear the right one before moving on
        }
      } }, s.he);
      if (s.he === answer.he) rightBtn = btn;
      return btn;
    });

    view.append(
      el('div', { class: 'prompt tight' },
        T.whatDidYouHear,
        el('small', { text: T.pickTranslation }),
      ),
      sentence,
      el('button', { class: 'btn', onClick: play }, T.hearAgain),
      el('div', { class: 'choices column' }, buttons),
    );
  });

  return () => { round.stop(); stopAudio?.(); };
}
