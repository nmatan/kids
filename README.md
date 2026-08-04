# משחקי לימוד — Learning Games

Custom Hebrew games for אביתר, אמיתי and עברי, installable on an Android tablet.

Two apps behind one opening screen:

- **🏆 תחרות אחים** — the learning games, with points, a daily allowance,
  medals and a scoreboard the three of them compete on.
- **🐱 חתחתול** — a card game against the computer, narrated step by step.

They share one shell deliberately: one service worker, one settings screen, one
install on the tablet.

It's a plain web app — no framework, no build step, **no npm dependencies**.
That's deliberate: this project should still run in five years without a
dependency upgrade weekend. Everything is HTML, CSS and ES modules that the
browser loads directly.

On the tablet it installs as a PWA: real launcher icon, fullscreen (no browser
UI), and it works completely offline once installed.

---

## Run it on your PC

**Double-click [start-games.bat](start-games.bat).** It starts the server and
opens the browser for you. Leave the window open while you work; `Ctrl+C` or
just closing it stops the server. (Right-click → *Pin to taskbar* if you use it
often.)

From a terminal, `npm start` does the same thing without opening a browser.
Either way the app is at <http://localhost:8080>. `localhost` counts as a secure
origin, so the offline service worker and the install prompt behave exactly as
they will on the tablet.

There are no packages to install — both just run `node tools/serve.mjs`.

**Editing files doesn't need a restart.** The server sends `cache-control:
no-store` and reads from disk on every request, so a browser refresh picks up any
change to HTML, CSS or JS. Only edits to `tools/serve.mjs` itself need a
restart.

⚠️ **If a change doesn't show up, it's the service worker**, not the server —
it's cache-first, which is what makes the app work offline. In DevTools (`F12`)
→ **Application** → **Service Workers**, tick **"Update on reload"** once and
it'll stop happening. `Ctrl+Shift+R` is the one-off version.

If port 8080 is busy from an earlier run, the server says so and exits; use
`npm start -- --port 8081`, or free it with:

```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Checking nothing's broken

```
npm test
```

This mounts every game, plays each one through to its end screen, walks every
screen, and checks the day/week/month score windows — all in Node, against
a tiny fake DOM ([tools/dom-stub.mjs](tools/dom-stub.mjs)). It takes about a
minute. Run it after adding a game or editing a word list.

---

## Put it on the tablet

The app must be served over **HTTPS** for offline mode and "Install app" to
work. A plain `http://192.168.x.x` address from your PC won't do it — browsers
refuse to register a service worker there. GitHub Pages is free and gives you
HTTPS, so that's the path of least resistance.

The repo is already wired to <https://github.com/nmatan/kids>. Push, then:

**On GitHub:** Settings → Pages → Source: *Deploy from a branch* → `main` / `root`.
After a minute the app is live at **<https://nmatan.github.io/kids/>**.

**On the tablet:** open that URL in Chrome → **⋮ → Add to Home screen**
(it may say "Install app"). Chrome builds a real Android app around it, so it
gets a launcher icon and opens fullscreen with no address bar.

**To ship an update:** edit files, bump `VERSION` in [sw.js](sw.js), then
`git add -A && git commit -m "..." && git push`. The tablet picks up the new
version the next time it opens the app with a connection.

### ⚠️ Hebrew text-to-speech

Every prompt is spoken aloud, which matters most for עברי (2) — he can't read
them. That needs a **Hebrew voice installed on the tablet**:

> Settings → Accessibility → Text-to-speech output → (Google TTS) → Install
> voice data → **עברית / Hebrew**

Without it the app still works and every prompt is on screen as text, and the
home screen shows a reminder — but the little one won't get much out of it. Set
this up before handing the tablet over.

**מה זה אומר?** also needs an **English** voice for the read-aloud sentences.
That one is usually installed already; if it isn't, it's the same screen. Without
it the sentence is still shown and still highlights word by word, so the game
degrades into a reading exercise rather than breaking.

---

## Scores and competition

### The daily allowance

**3 plays of each game, per kid, per day** — 5 games x 3 = 15 games a day. Each game has its own allowance, so
cards lock one at a time — using up לוח הכפל doesn't touch מה השעה?. To collect
the day's points you have to play across the shelf rather than grinding one
favourite.

Each card shows what's left and locks at zero; the shelf and home screen show
the total still available across the whole shelf. The route is guarded too, so a
bookmark can't get around it. Resets at local midnight, and the number is
configurable in settings.

**Every kid has exactly five games a day, always** ([`GAMES_PER_KID`](js/registry.js)).
Equal shelves mean equal daily ceilings — 15 games each — which is what makes the
scoreboard a fair contest. `gamesForProfile()` enforces it whatever the settings
say: too many is trimmed, too few is padded.

**The five rotate daily.** Each level has a *pool* of age-appropriate games
(`POOL` in [js/registry.js](js/registry.js)) and the day's five are drawn from it
with a seed of kid + date. That means the shelf is stable all day — it doesn't
reshuffle between games — but different tomorrow, so there's something fresh
without anyone curating it. Over a fortnight the whole pool gets used.

### Points

**Points are the star rating.** Each game is graded 0-3 stars from the share of
questions answered right (≥90% = 3, ≥70% = 2, ≥40% = 1), and that's what's
banked. Three stars is worth three points.

This replaced a flat one-point-per-win rule, which was gameable: a kid could
rush, scrape a single star, still bank the point, and burn through the day's
allowance faster than a sibling playing properly. Now carelessness costs you
directly — one careful game beats three rushed ones.

Still small whole numbers, which was the reason for flat scoring in the first
place; the kids can add up the board themselves.

Points are recomputed from stored stars every time the board is drawn rather
than trusted from the log, so changing **נקודות לכל כוכב** in settings rescales
past games too and the board never mixes two scoring systems.

A **medal** needs 2 stars or better (`WIN_STARS` in [js/store.js](js/store.js)) —
one star is a pass, not a success, and letting it count would make the medal
reachable by scraping.

### Where any of this is stored

**There's no database and no server.** Nothing leaves the device. GitHub Pages
serves static files and has no idea anyone is playing.

Everything lives in the browser's `localStorage`, under two keys:

| key | what's in it |
|-----|--------------|
| `kids-games:v2` | best stars per kid per game, plus one log entry per finished game (`{kid, game, stars, timestamp}`) |
| `kids-games:settings:v1` | everything on the settings screen |

The log is the source of truth for everything — daily allowance, weekly board,
monthly board — all of it is that list filtered by timestamp. It's capped at the
most recent 3000 entries, which is years of play.

That means:

- **Scores survive** closing the app, rebooting, and going offline. It's on disk,
  not in memory.
- **Scores are per device.** The tablet, your phone and your PC each keep their
  own. There's no sync and no account. If you want one scoreboard, everyone plays
  on the tablet.
- **Clearing the browser's site data wipes them.** So does uninstalling the PWA
  on some Android versions.
- **Updating the app never touches them.** The service worker version controls
  cached *code*; `localStorage` is separate.

If you ever want them shared across devices, that's the point where this needs a
real backend — and it'd be the first dependency this project has.

---

## Each kid's own world

[js/themes.js](js/themes.js) — every kid gets a themed space built around what
they actually like:

| kid | theme | their space |
|-----|-------|-------------|
| אביתר | 🤸 קפוארה | green, drums and cartwheels |
| אמיתי | 🥋 ג׳ודו | blue, belts and tatami |
| עברי | ⚽ כדורים | orange, every kind of ball |

**The pictures carry the theme; the words stay plain.** An earlier version used
real capoeira and judo vocabulary — roda, dojo, axé, ippon — and it just read as
noise to a child who wants to play. Icons and colours say "this is yours"
perfectly well on their own, so the writing is ordinary encouragement.

The theme drives the shelf's colours, a faint icon backdrop, the heading, the
card styling — and the **streak effect**: every third clean answer in a row
throws that kid's icons up the screen with a themed shout. Footballs for עברי,
belts for אמיתי, drums for אביתר. A wrong answer resets the run.

To retheme someone, change `theme` in [js/profiles.js](js/profiles.js) to a key
from `THEMES`, or add a new entry. Nothing else needs touching.

---

## Medals and the prize wheel

A medal is earned by **finishing every game's daily allowance AND winning at
least 80% of them**. One per kid per day, and it can't be earned twice. Exactly
80% counts; one win short doesn't.

Earning one interrupts the usual end-of-game card with 🎖 **מגיעה לך מדליה!**,
which opens a **prize wheel** — seven segments, a four-second spin, and the
prize is announced out loud and written to the medal.

**The wheel never shows what is on it.** Every segment is a 🎁, and only the one
landed on is ever revealed. Showing the real prizes would spend all seven the
first time anyone spun; this way each medal uncovers one and the rest stay a
rumour.

The prizes are in `PRIZES` in [js/text.js](js/text.js) — swap in whatever you're
happy to promise:

> 🥤 שלוק לקינוח · 💆 מסאג׳ מאמא · 🎵 לבחור שיר לפני השינה · 🤗 חיבוק מפה-פה הגדול ·
> 🥄 כפית קטשופ · 🛏️ לנוח במיטה של אמא · 🎥 לצלם סרטון לסבתא

The wheel redraws itself for however many prizes are in the list.

🎖 **מדליות** on the home screen is the fridge door: every medal each kid has
won, with its date and the prize that came with it, so there's a record of
what's been promised. A medal spun but not yet claimed shows as 🎁 on their
profile card and as a banner on their shelf, so an interrupted spin isn't lost.

---

## 🐱 חתחתול

Cabo, at a size a seven-year-old can hold. Four face-down cards each, values
**0–9 only** — no jacks or kings — so the count at the end is one he can
actually do. Lowest total wins.

On your turn: draw from the deck or take the top discard, then either swap it
into your hand or throw it away. Instead of a turn you can call **חתחתול!**, which
gives the computer one last turn before everything is revealed.

**Every step is narrated.** Not just "your turn" but what the options are —
*"משכתם 3. אפשר להחליף אותו באחד הקלפים שלכם, או לזרוק אותו."* The child is never
looking at a board wondering what to do.

**Two deliberate simplifications**, both written up in
[js/cabo.js](js/cabo.js):

1. A card you peeked at **stays visible to you**. Real Cabo makes you remember;
   that turns it into a memory game. Keeping them visible makes it a decisions
   game — and it's also what lets the app know when a move is a mistake.
2. **No special-power cards.** They'd double the length of every explanation,
   and every explanation is spoken aloud.

### The "are you sure?" guard

If he's about to swap a card he *knows* is low for a higher one, or throw away a
card of 3 or less, it asks first — *"רגע! הקלף שלכם הוא 2, והקלף החדש הוא 7 —
גבוה יותר. בטוחים?"* He can always insist; it's teaching, not blocking.

Settings → **חתחתול** → **אזהרה על מהלך גרוע** turns it off completely.

### The reveal

Cards turn over **one at a time**, with the running total spoken as it grows —
*"שלוש... ועוד חמש, זה שמונה..."*. That's the counting practice, and it's also
what makes the ending suspenseful rather than a number appearing. A drum roll
starts it, and the deck pulses when it's running low during play.

---

## Settings

Home screen → **⚙** (top corner), behind a parent gate: a percentage question
("כמה זה 25% מ-120?"). Instant for an adult, and percentages are not taught
anywhere near 2nd grade, so it stops a curious 7-year-old without making you
stop and think. The gate is per-session, so closing the app re-locks it. It is a
speed bump, not security.

| setting | what it does |
|---------|--------------|
| פעמים ביום בכל משחק | plays of each game per kid per day |
| נקודות לכל ניצחון | points for winning a game |
| שאלות במשחק | questions per game — overrides each game's built-in count |
| משחקים לכל ילד | which five games each kid sees; **any game can go to any kid**, regardless of level |
| הקראה בקול | spoken prompts and the end-of-game cheer |
| אפקטים קוליים | beeps and chimes |
| קונפטי בסיום | the celebration burst |
| השבוע מתחיל ביום | Sunday or Monday, drives the weekly board |
| מצב בדיקה | play any game at any level without it counting — see below |
| איפוס כל הניקוד | wipes all scores (two-tap confirm) |
| החזרת הגדרות | back to defaults (two-tap confirm) |

Per-kid game selection starts as "whatever matches their level" and only becomes
an explicit list once you touch it; **↺ חזרה לרמה** puts a kid back on automatic.
The picker holds you to exactly five: a sixth chip refuses and shakes, so
swapping a game means dropping one first. The counter turns red until it is 5/5.

### Test mode

The settings screen lists every game with a button per level it supports.
Opening one plays it with an inert context: `finish()` records nothing, so no
points are banked, no daily allowance is spent, no medal can fire and nothing
reaches the leaderboard. A 🧪 banner sits on screen the whole time so there's no
doubt. It's behind the parent gate, so the kids can't use it as risk-free
practice. Useful for seeing how a game behaves — especially at a level none of
your kids are currently on.

**This is the dumping ground for future options.** To add one: a key in
`DEFAULTS` in [js/settings.js](js/settings.js), and a `row(...)` in
`settingsScreen()` in [js/app.js](js/app.js). The controls (`stepper`, `toggle`,
`segment`, `dangerButton`) are already there.

---

## Changing things

### The kids

[js/profiles.js](js/profiles.js) — one entry per kid. Bump `level` on a birthday
and their shelf changes. To hand a single game across levels instead, use the
settings screen — that overrides the level for that kid only.

| kid | age | level | starting five |
|-----|-----|-------|------------------------|
| אביתר | 7 | 3 | pool of 12, five drawn daily |
| אמיתי | 5 | 2 | pool of 8, five drawn daily |
| עברי  | 2 | 1 | pool of 5 — all five, no rotation yet |

Levels 2 and 3 have **eight** games available but only five slots, so there is a
bench to rotate from — swap them in the settings screen when a shelf goes stale.
The starting five are set in `DEFAULT_SHELF` in [js/registry.js](js/registry.js),
one game per broad area so nobody begins with three kinds of maths and no
reading. Level 3 currently benches מה השעה?, לשלם בחנות and דגלים; level 2
benches סופרים ביחד, זיכרון and איפה בעולם?.

Level 1 games run in **forgiving mode**: a wrong tap shakes that one choice but
leaves the round open, so a 2-year-old never lands on a fail screen — he just
doesn't score the point. Levels 2–3 show the right answer and move on.

### Quick content edits

Most games read from a plain list at the top of their file — no logic to touch:

- **מדינות ודגלים** → `COUNTRIES` in [js/countries.js](js/countries.js), behind
  **דגלים**. One row per country with its Hebrew name and flag; `easy: true`
  marks the ones level 2 draws from.

  > Flags are emoji. Android renders them properly, which is what matters — but
  > **Windows does not**, so on your PC you'll see `IL` instead of 🇮🇱. That's a
  > preview-only quirk; check that game on the tablet.

- **יבשות ואוקיינוסים** → `REGIONS` in [js/games/geography.js](js/games/geography.js).
  The game asks for continents and oceans rather than countries. The first
  version asked for countries and didn't work: with no borders drawn there was
  nothing to see, the markers were small, and a child tapped a dot without
  understanding what they'd picked. Real borders need a full geographic dataset.
  Continents and oceans solve it — huge, clearly-shaped, tappable, and the right
  thing to learn first anyway. Oceans are plain lat/lon boxes drawn *under* the
  land, so the part that stays visible is exactly the water.

- **משפטי נכון/לא נכון** → `STATEMENTS` in [js/games/truefalse.js](js/games/truefalse.js).
  Each row is `{ s, t, why, lv }`. They're chosen to need judgement rather than
  recall — plenty of them sound right and aren't (העטלף הוא ציפור, הקרח כבד
  ממים, החומה הסינית נראית מהחלל). `npm test` checks that neither level is
  guessable by always answering the same way.
- **משפטים באנגלית** → `SENTENCES` in [js/games/translate.js](js/games/translate.js).
  63 pairs to start with; add rows as `{ en, he, tag }`. Keep English to 4–5
  words and Hebrew to 3–5. The `tag` matters: wrong answers are drawn from the
  **same topic first**, so a distractor can't be ruled out without actually
  reading it. Any sentence's Hebrew can serve as a wrong answer for any other,
  which is why a modest bank goes a long way.
- **כסף** → `MONEY` and `SHOP` in [js/games/money.js](js/games/money.js).
  Only real circulating NIS is listed: ₪1 ₪2 ₪5 ₪10 coins and ₪20 ₪50 ₪100 ₪200
  notes. Agorot (10 אג׳ and ½ ₪) are left out on purpose — they'd force decimal
  prices, which is a later step. The coins are drawn in CSS, including the
  twelve-sided ₪5 and the bi-metallic ₪10, so there are still no image files.
- **קטעי קריאה** → `PASSAGES` in [js/games/reading.js](js/games/reading.js).
  Two-sentence passages with a comprehension question. **Nothing here is read
  aloud, deliberately** — every other game speaks its prompt, but reading it is
  the whole point of this one, and narration would turn it into a listening
  game. Only the feedback after an answer is spoken. Questions ask "why" and
  "what happened" rather than just where a word appears, and several answers
  aren't copyable from the text.

- **כמה עודף?** → [js/games/change.js](js/games/change.js). The natural sequel to
  לשלם בחנות: something costs 37₪, you hand over 50₪, build the change. It shares
  money.js's coins so a ₪5 looks the same in both. Price and payment are drawn
  until the change is buildable in 3 pieces or fewer — enforced by `npm test`.

- **מה יותר סביר?** → [js/games/chance.js](js/games/chance.js). Probability without
  fractions or percentages, the way it's actually taught at this age: two jars of
  countable balls, alternating with certainty language — **בטוח / סביר / לא סביר /
  בלתי אפשרי**, four levels rather than a blunt "possible", so there's a judgement
  to make rather than a box to tick.

  **Half the comparison rounds are traps**: one jar holds *more* balls of the
  wanted colour yet is *less* likely, because it holds more balls overall
  (3 of 8 against 2 of 3). Without those the game is just "count the most" and
  teaches nothing about ratio — with them it's the whole point. Which round is a
  trap alternates so exactly half are, but the phase flips per game so it's never
  "the third one is always the sneaky one".

  The colour asked about changes every round, so nobody learns "always tap the
  jar with the most red". Every ball stays visible to count, no jar is ever
  exactly half (that would have no right answer), and the two jars are never
  within 25 percentage points. All of it tested.

- **מילים באנגלית** → `WORDS` in [js/games/words.js](js/games/words.js). Single-word
  translation, direction flipping every round — recognising a word you can see is
  a different skill from retrieving one you can't. 80 pairs, `easy: true` marking
  the ones אמיתי gets. Each word is spoken in its own language; one utterance
  holding both comes out wrong in both.

- **מילים לכתיב** → `WORDS` in [js/games/spelling.js](js/games/spelling.js).
  Drop in this week's list from school.
- **לוחות כפל** → `TABLES` in [js/games/times.js](js/games/times.js).
  Narrow it to the ones he's actually practising.
- **אותיות ומילות דוגמה** → `LETTERS` in [js/games/letters.js](js/games/letters.js).
- **חיות, צבעים, צורות** → the shared pools at the bottom of
  [js/kit.js](js/kit.js).
- **מלל הממשק** → [js/text.js](js/text.js) holds every UI string in one place.

### Adding a game

1. Copy an existing file in [js/games/](js/games/) — [colors.js](js/games/colors.js)
   is the simplest one.
2. Give it a unique `meta.id` and set `meta.levels` to the kids who should see it.
3. Import it and add it to `GAMES` in [js/registry.js](js/registry.js).
4. Add its path to `PRECACHE` in [sw.js](sw.js) **and bump `VERSION`**.
5. Run `npm test` — it will play your new game to the end and tell you if
   anything's broken.

Most games are ~60 lines because [js/kit.js](js/kit.js) does the heavy lifting.
The `Round` class runs the question loop, progress dots, scoring, feedback and
the end screen — a game just describes one round:

```js
const round = new Round(stage, ctx, { rounds: 8, forgiving: true });

round.start((view, api) => {
  // draw one question into `view`
  // call api.ok(button) or api.no(button) when they answer
});
```

Games that aren't question-and-answer can skip `Round` entirely and drive
`ctx.setProgress` / `ctx.finish` themselves;
[memory.js](js/games/memory.js) does that.

### English games

`speak()` takes a language: `speak('where is the dog?', { lang: 'en' })` picks an
English voice while the rest of the app stays Hebrew. Add `dir="ltr"` (class
`ltr`) to anything that should read left-to-right — the maths games use it for
their equations, and [translate.js](js/games/translate.js) for its sentences.

For read-along text, `speakSentence()` in [js/kit.js](js/kit.js) reports which
word is being spoken:

```js
const cancel = speakSentence('The cat is very small.', {
  lang: 'en',
  onWord: (i) => highlight(i),   // i = word index, then -1 when finished
});
```

Desktop Chrome fires real `boundary` events and it uses them. Android's TTS
frequently doesn't, so a length-weighted timing estimate runs underneath as a
safety net and drives the highlight when no boundary event ever arrives; real
events take over the moment one shows up. Both paths are covered by `npm test`.

---

## How it's put together

```
index.html            app shell (lang="he" dir="rtl")
styles.css            all styling
sw.js                 service worker — offline caching  ⚠️ bump VERSION on changes
manifest.webmanifest  makes it installable
js/
  app.js              screens + hash router + leaderboard
  text.js             ✏️ every Hebrew UI string
  profiles.js         ✏️ the kids
  registry.js         ✏️ the list of games
  store.js            stars, points and the week/month/all-time boards
  kit.js              Round engine, speech, sounds, shared content
  games/*.js          one file per game
tools/
  serve.mjs           dev server (npm start)
  test.mjs            smoke tests (npm test)
  dom-stub.mjs        fake DOM so the tests can run in Node
  make-icons.mjs      icon generator (npm run icons)
```

**Routing** lives in the URL hash (`#/p/evyatar/g/times`), so the tablet's Back
gesture walks back through the app instead of closing it.

**Sound** is all generated at runtime — spoken prompts use the Android
text-to-speech engine (on-device, so it works offline) and the effects are
synthesised with the Web Audio API. There are no audio files and no image files;
every visual is an emoji, an SVG or CSS. That's why the whole app is a couple of
hundred KB and caches instantly.

---

## If you'd rather have a real APK

The PWA route needs no Android tooling at all, which is why it's the default.
If you later want a genuine sideloadable `.apk` — for a Fire tablet, or to use
Android's screen-pinning so they can't leave the app — the same code wraps
without changes:

```
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "משחקי לימוד" com.nmatan.kids --web-dir=.
npx cap add android
npx cap run android
```

That does require a JDK and Android Studio (~10 GB) on the PC, which isn't
currently installed.
