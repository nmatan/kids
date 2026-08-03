# משחקי לימוד — Learning Games

Custom Hebrew learning games for אביתר, אמיתי and עברי, installable on an
Android tablet.

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
screen, and checks the week/month/all-time score windows — all in Node, against
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

Finishing any game earns points:

| Result | Points |
|--------|--------|
| ★★★    | 30 |
| ★★☆    | 20 |
| ★☆☆    | 10 |
| finished | 5 |

**Points come from stars, not from how many questions a game had.** That's on
purpose: עברי finding three animals and אביתר getting twelve times-tables
questions right both earn 30. The competition is about playing well at your own
level, not about who got the harder games — otherwise the 7-year-old wins every
week by default and the 2-year-old stops caring.

### The daily allowance

Each kid gets **10 plays of each game per day** (`DAILY_LIMIT` in
[js/store.js](js/store.js)). Every game card shows how many are left; at zero it
locks with 🔒 **נגמר להיום**, and the URL is guarded too so a bookmark can't get
around it. It resets at local midnight.

This is what stops one kid grinding a single easy game all afternoon — to
maximise points you have to play across the whole shelf.

> ⚠️ **The allowance is per game, so the shelf sizes matter.** אביתר has 5 games
> and the other two have 4, which means he can bank 50 plays a day against their
> 40. If that starts showing up as a permanent lead, the fix is either to give
> everyone the same number of games, or to switch `DAILY_LIMIT` to a per-kid
> daily total instead of a per-game one.

### The reward moment

Finishing a game fires confetti, a `+30 נקודות` badge that pops in, the weekly
rank, and the plays left today — plus a spoken Hebrew line that combines all of
it with where they stand:

> וואו, מושלם! קיבלת 30 נקודות. אתה ראשון, אבל אמיתי נושף לך בעורף, רק 10 נקודות מאחורה! נשארו לך עוד 4 משחקים כאלה היום.

The wording lives in `cheerLine()` in [js/text.js](js/text.js) and adapts to the
situation: a comfortable lead gets the margin, a narrow one gets told who's
breathing down their neck, a chaser gets the exact gap to overtake, and the last
play of the day says come back tomorrow. It never tells a kid they're losing —
only how close the next place is.

Verb forms follow each profile's `gender`, so adding a daughter later is a
one-character change per profile.

🏆 **טבלת המובילים** on the home screen ranks the three of them by
**השבוע / החודש / כל הזמן**. The week starts on Sunday. Everyone always
appears in the table, even on a week they haven't played, so nobody vanishes
from the board.

Scores live in `localStorage` under `kids-games:v2` — they're per-tablet, and
clearing the browser's site data resets them.

---

## Changing things

### The kids

[js/profiles.js](js/profiles.js) — one entry per kid. Bump `level` on a birthday
and their shelf changes.

| kid | age | level | what's on their shelf |
|-----|-----|-------|------------------------|
| אביתר | 7 | 3 | לוח הכפל · מה השעה? · מרכיבים מילה · מה זה אומר? · זיכרון |
| אמיתי | 5 | 2 | סופרים ביחד · אותיות · חיבור וחיסור · זיכרון |
| עברי  | 2 | 1 | חברים מהחווה · צבעים · סופרים ביחד · זיכרון |

Level 1 games run in **forgiving mode**: a wrong tap shakes that one choice but
leaves the round open, so a 2-year-old never lands on a fail screen — he just
doesn't score the point. Levels 2–3 show the right answer and move on.

### Quick content edits

Most games read from a plain list at the top of their file — no logic to touch:

- **משפטים באנגלית** → `SENTENCES` in [js/games/translate.js](js/games/translate.js).
  63 pairs to start with; add rows as `{ en, he, tag }`. Keep English to 4–5
  words and Hebrew to 3–5. The `tag` matters: wrong answers are drawn from the
  **same topic first**, so a distractor can't be ruled out without actually
  reading it. Any sentence's Hebrew can serve as a wrong answer for any other,
  which is why a modest bank goes a long way.
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
