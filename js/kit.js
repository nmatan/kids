/* ---------------------------------------------------------------
   kit.js — shared helpers every game uses.
   Keep game files short by putting anything reusable in here.
   --------------------------------------------------------------- */

import { T, REWARD, MEDAL } from './text.js';
import { get } from './settings.js';

/* ---------- random ---------- */

export const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const range = (n, from = 0) => Array.from({ length: n }, (_, i) => i + from);

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick `n` distinct items from `arr`. */
export function sample(arr, n) {
  return shuffle(arr).slice(0, n);
}

/**
 * Build a choice list: the answer plus distractors drawn from `pool`,
 * shuffled. Distractors never equal the answer.
 */
export function choicesFor(answer, pool, count = 3, key = (x) => x) {
  const others = sample(pool.filter((x) => key(x) !== key(answer)), count - 1);
  return shuffle([answer, ...others]);
}

/* ---------- tiny DOM helper ---------- */

export function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    // Custom properties (--c1) need setProperty; Object.assign silently drops them.
    else if (k === 'style') {
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith('--')) node.style.setProperty(prop, val);
        else node.style[prop] = val;
      }
    }
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };

/* ---------- speech ---------- */
/* Android ships an on-device TTS engine, so this keeps working offline.
   Voices load asynchronously, hence the lazy lookup + retry. */

const HAS_TTS = typeof window !== 'undefined' && 'speechSynthesis' in window;

let defaultLang = 'he';
const voiceCache = new Map(); // lang -> SpeechSynthesisVoice | null

function voiceFor(lang) {
  if (voiceCache.has(lang)) return voiceCache.get(lang);
  if (!HAS_TTS) return null;
  const all = speechSynthesis.getVoices();
  if (!all.length) return null; // not loaded yet — try again next time
  const match =
    all.find((v) => v.lang.toLowerCase().startsWith(lang) && v.localService) ||
    all.find((v) => v.lang.toLowerCase().startsWith(lang)) ||
    null;
  voiceCache.set(lang, match);
  return match;
}

if (HAS_TTS) speechSynthesis.addEventListener('voiceschanged', () => voiceCache.clear());

/** Language used when speak() isn't given one. */
export function setSpeechLang(lang) {
  defaultLang = String(lang || 'he').toLowerCase().slice(0, 2);
}

/** True if the device has a voice for this language installed. */
export const hasVoice = (lang = defaultLang) => Boolean(voiceFor(lang));

/**
 * Speak `text` out loud. Silently does nothing if TTS is unavailable —
 * every prompt is on screen as text too, so nothing is lost.
 */
export function speak(text, { rate = 0.9, pitch = 1.1, interrupt = true, lang } = {}) {
  if (!HAS_TTS || !text || !get('speech')) return;
  try {
    if (interrupt) speechSynthesis.cancel();
    const code = (lang || defaultLang).toLowerCase().slice(0, 2);
    const voice = voiceFor(code);
    const u = new SpeechSynthesisUtterance(String(text));
    u.rate = rate;
    u.pitch = pitch;
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : code;
    speechSynthesis.speak(u);
  } catch { /* TTS is a nice-to-have, never fatal */ }
}

export const stopSpeech = () => { try { speechSynthesis.cancel(); } catch {} };

/**
 * Resolve once the voice has finished talking, or after `max` ms.
 *
 * Games await this before moving on, so an answer being read out is never
 * chopped off mid-word by the next round starting.
 */
export function waitForSpeech(max = 5000) {
  if (!HAS_TTS || !get('speech')) return Promise.resolve();
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      let talking = false;
      try { talking = speechSynthesis.speaking || speechSynthesis.pending; } catch {}
      if (!talking || Date.now() - started > max) return resolve();
      setTimeout(tick, 120);
    };
    tick();
  });
}

/**
 * Speak a sentence and report which word is currently being said, so the
 * UI can highlight along with the voice.
 *
 * Each word is spoken as its own utterance and highlighted from that
 * utterance's `onstart`, so the highlight is exactly on the word being
 * said. The obvious alternative — one utterance plus `boundary` events —
 * drifts badly, because Android's TTS mostly doesn't fire them and the
 * fallback can only ever be a guess at the timing.
 *
 * The cost is a small gap between words. For a 4-5 word sentence a child
 * is learning to read, that is a fair trade for being in time.
 *
 * onWord(i) gets the word index, then -1 when the sentence is finished.
 * Returns a cancel function.
 */
export function speakSentence(text, { lang, rate = 0.8, onWord, onDone } = {}) {
  const muted = !get('speech');
  const words = String(text).trim().split(/\s+/);

  let done = false;
  let timers = [];

  const clearAll = () => { timers.forEach(clearTimeout); timers = []; };
  const finish = () => { if (done) return; done = true; clearAll(); onWord?.(-1); onDone?.(); };
  const cancel = () => { if (done) return; done = true; clearAll(); stopSpeech(); };

  // Only used when there's no voice at all: walk the highlight on a timer
  // so the read-along still works silently. ~62ms per character at rate 1.
  const estimate = () => {
    const weights = words.map((w) => w.length + 2);
    const total = weights.reduce((a, b) => a + b, 0);
    const ms = (total * 62) / rate;
    let acc = 0;
    words.forEach((_, i) => {
      const at = acc;
      timers.push(setTimeout(() => { if (!done) onWord?.(i); }, at));
      acc += (weights[i] / total) * ms;
    });
    timers.push(setTimeout(finish, acc + 400));
  };

  if (!HAS_TTS || muted) { onWord?.(0); estimate(); return cancel; }

  try {
    speechSynthesis.cancel();
    const code = (lang || defaultLang).toLowerCase().slice(0, 2);
    const voice = voiceFor(code);

    words.forEach((word, i) => {
      const u = new SpeechSynthesisUtterance(word);
      if (voice) u.voice = voice;
      u.lang = voice ? voice.lang : code;
      u.rate = rate;
      u.onstart = () => { if (!done) onWord?.(i); };
      if (i === words.length - 1) {
        u.onend = () => timers.push(setTimeout(finish, 260));
        u.onerror = finish;
      }
      speechSynthesis.speak(u);
    });

    onWord?.(0);
    // If the engine never reports back, don't leave a word lit forever.
    timers.push(setTimeout(finish, (text.length * 150) / rate + 3000));
  } catch {
    onWord?.(0);
    estimate();
  }

  return cancel;
}

/* ---------- sound effects (generated, no audio files) ---------- */

let ac = null;
const audio = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());

function tone(freq, start, dur, { type = 'sine', gain = 0.18 } = {}) {
  if (!get('sound')) return;
  try {
    const ctx = audio();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + start;
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch { /* audio blocked before first gesture — ignore */ }
}

export const sfx = {
  tap:     () => tone(520, 0, 0.07, { type: 'triangle', gain: 0.08 }),
  correct: () => { tone(660, 0, 0.13); tone(880, 0.1, 0.2); },
  wrong:   () => tone(180, 0, 0.22, { type: 'sawtooth', gain: 0.09 }),
  win:     () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3)),

  /* --- the prize wheel --- */

  /** Tension riser: keeps climbing for `secs`, so the spin feels loaded. */
  rise: (secs = 1.2) => {
    const steps = Math.round(secs / 0.08);
    for (let i = 0; i < steps; i++) {
      tone(260 + i * (520 / steps), i * 0.08, 0.12, { type: 'triangle', gain: 0.06 });
    }
  },

  /** Drum roll under the spinning wheel — thickens as it slows. */
  roll: (secs = 5) => {
    for (let t = 0, gap = 0.055; t < secs; t += gap) {
      tone(70 + Math.random() * 40, t, 0.06, { type: 'square', gain: 0.05 });
      gap = 0.055 + (t / secs) * 0.07; // beats spread out as the wheel slows
    }
  },

  /** Big finish for the reveal. */
  fanfare: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.4, { gain: 0.2 }));
    tone(1319, 0.5, 0.7, { gain: 0.22 });
    tone(784, 0.5, 0.7, { gain: 0.14 });
  },
};

export const vibrate = (ms = 18) => { try { navigator.vibrate?.(ms); } catch {} };

/* ---------- confetti ---------- */

export function celebrate(count = 60) {
  if (!get('confetti')) return;
  const layer = el('div', { class: 'confetti' });
  const colors = ['#ffd23f', '#37d67a', '#7c5cff', '#ff5c6c', '#4cc9f0', '#f72585'];
  for (let i = 0; i < count; i++) {
    layer.append(el('b', {
      style: {
        left: `${Math.random() * 100}%`,
        top: `${-12 - Math.random() * 20}vh`,
        background: pick(colors),
        animationDuration: `${1.6 + Math.random() * 1.6}s`,
        animationDelay: `${Math.random() * 0.5}s`,
      },
    }));
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 4200);
}

/**
 * Throw a handful of themed icons up the screen — capoeira drums, judo
 * belts, footballs. Used for streaks and for the wheel.
 */
export function burst(icons, count = 16) {
  if (!get('confetti') || !icons?.length) return;
  const layer = el('div', { class: 'burst' });
  for (let i = 0; i < count; i++) {
    layer.append(el('b', {
      style: {
        left: `${6 + Math.random() * 88}%`,
        fontSize: `${26 + Math.random() * 30}px`,
        animationDuration: `${1.1 + Math.random() * 0.9}s`,
        animationDelay: `${Math.random() * 0.35}s`,
      },
    }, pick(icons)));
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 2800);
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The shared "you finished" card. Games that skip Round use it too.
 *
 * `reward` is whatever ctx.finish() returned — points, weekly rank and
 * plays left today. Call ctx.finish() BEFORE building the card so those
 * numbers already include the game just played.
 */
export function endCard(ctx, { stars, msg, score = '🎉', reward = null }) {
  return el('div', { class: 'result' },
    el('div', { class: 'score', text: score }),
    el('div', { class: 'stars-big', text: '★'.repeat(stars) + '☆'.repeat(3 - stars) }),
    el('div', { class: 'msg', text: msg }),
    reward ? el('div', { class: 'reward' },
      el('div', { class: 'earned', text: REWARD.earned(reward.points) }),
      el('div', { class: 'rank-line', text: REWARD.rank(reward.rank) }),
      el('div', { class: `left-line${reward.remaining <= 2 ? ' low' : ''}`,
        text: reward.remaining === 0 ? REWARD.lastOne : REWARD.left(reward.remaining) }),
    ) : null,
    // A medal outranks everything. It's the ONLY button on the card —
    // they earned the wheel, and a stray tap on "סיימתי" shouldn't lose it.
    reward?.medal
      ? el('div', { class: 'choices' },
        el('button', { class: 'btn primary medal-btn', onClick: () => ctx.claimMedal() },
          MEDAL.claim))
      : el('div', { class: 'choices' },
        // No replay button once the day's allowance for this game is gone.
        reward && !reward.canReplay
          ? null
          : el('button', { class: 'btn primary', onClick: () => ctx.replay() }, T.again),
        el('button', { class: 'btn', onClick: () => ctx.exit() }, T.done),
      ),
  );
}

/* ---------------------------------------------------------------
   Round — the engine behind most games.

   A game supplies a `build(stage, api)` function that draws one round.
   It calls api.ok() / api.no() to report the outcome. Round handles the
   progress dots, feedback timing, scoring and the end screen.
   --------------------------------------------------------------- */

export class Round {
  /**
   * @param {HTMLElement} stage  where the round is drawn
   * @param {object} ctx         host context ({ profile, finish, setProgress })
   * @param {object} opts        { rounds, pauseOk, pauseNo, forgiving }
   *
   * `forgiving` (level-1 games): a wrong tap shakes and disables that one
   * choice but the round stays open until they find the right answer, so a
   * toddler never gets stuck on a fail screen. They just don't score the point.
   */
  constructor(stage, ctx, opts = {}) {
    this.stage = stage;
    this.ctx = ctx;
    this.total = get('rounds') || opts.rounds || 8;
    this.pauseOk = opts.pauseOk ?? 800;
    this.pauseNo = opts.pauseNo ?? 900;
    this.forgiving = opts.forgiving ?? false;
    this.index = 0;
    this.score = 0;
    this.streak = 0;   // consecutive clean answers, for the themed effects
    this.results = [];
    this.dead = false;
  }

  /** Start the loop. `build` is called once per round. */
  start(build) {
    this.build = build;
    this.#next();
  }

  stop() { this.dead = true; stopSpeech(); }

  #next() {
    if (this.dead) return;
    if (this.index >= this.total) return this.#end();
    this.ctx.setProgress(this.results, this.total);
    clear(this.stage);

    let answered = false;
    let missed = false;

    const settle = async (won, node) => {
      if (answered || this.dead) return;

      // Forgiving mode: a wrong tap costs the point but not the round.
      if (!won && this.forgiving) {
        missed = true;
        sfx.wrong();
        vibrate([12, 60, 12]);
        if (node) { node.classList.add('wrong'); node.disabled = true; }
        return;
      }

      answered = true;
      const credit = won && !missed;
      if (credit) {
        this.streak++;
        // every third in a row earns a themed burst
        if (this.streak % 3 === 0) this.ctx.onStreak?.(this.streak);
      } else {
        this.streak = 0;
      }
      if (won) {
        if (credit) this.score++;
        sfx.correct();
        vibrate(16);
        node?.classList.add('correct');
      } else {
        sfx.wrong();
        vibrate([12, 60, 12]);
        node?.classList.add('wrong');
      }
      this.results.push(credit);
      this.ctx.setProgress(this.results, this.total);
      this.stage.querySelectorAll('.choice').forEach((b) => (b.disabled = true));
      await wait(won ? this.pauseOk : this.pauseNo);
      // Never start the next question while the answer is still being read
      // out — the next prompt would cancel it mid-word.
      await waitForSpeech();
      if (this.dead) return;
      this.index++;
      this.#next();
    };

    this.build(this.stage, {
      ok: (node) => settle(true, node),
      no: (node) => settle(false, node),
      /** Show the right answer after a wrong tap. No-op in forgiving mode,
          where the point is to let them keep hunting for it themselves. */
      reveal: (node) => { if (!this.forgiving) node?.classList.add('correct'); },
      index: this.index,
      total: this.total,
      speak,
    });
  }

  #end() {
    clear(this.stage);
    const pct = this.total ? this.score / this.total : 0;
    const stars = pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : pct >= 0.4 ? 1 : 0;
    const msg = [T.tryAgain, T.goodTry, T.greatJob, T.perfect][stars];

    // Record first: the card shows points, rank and plays-left, and those
    // have to already include the game that just ended.
    const reward = this.ctx.finish(stars);

    celebrate(stars >= 2 ? 90 : 45);
    sfx.win();
    this.stage.append(endCard(this.ctx, {
      stars, msg, score: `${this.score}/${this.total}`, reward,
    }));
    speak(reward?.speech || msg, { rate: 0.95 });
  }
}

/* ---------- shared content pools ---------- */

export const ANIMALS = [
  { emoji: '🐶', name: 'כלב', says: 'הב הב' },
  { emoji: '🐱', name: 'חתול', says: 'מיאו' },
  { emoji: '🐮', name: 'פרה', says: 'מוּ' },
  { emoji: '🐸', name: 'צפרדע', says: 'קוואק קוואק' },
  { emoji: '🦆', name: 'ברווז', says: 'גע גע' },
  { emoji: '🐴', name: 'סוס', says: 'יהה' },
  { emoji: '🐑', name: 'כבשה', says: 'מעע' },
  { emoji: '🦁', name: 'אריה', says: 'רררר' },
  { emoji: '🐘', name: 'פיל', says: 'טרוווו' },
  { emoji: '🐵', name: 'קוף', says: 'אוו אוו אה אה' },
  { emoji: '🐝', name: 'דבורה', says: 'זזזזז' },
  { emoji: '🐓', name: 'תרנגול', says: 'קוקוריקו' },
  { emoji: '🦉', name: 'ינשוף', says: 'הו הו' },
  { emoji: '🐭', name: 'עכבר', says: 'ציק ציק' },
  { emoji: '🐟', name: 'דג', says: 'בּול בּול' },
];

/* Adjectives are all masculine so they agree with "הצבע". */
export const COLORS = [
  { name: 'אדום', hex: '#ff4d4d' },
  { name: 'כחול', hex: '#3d8bff' },
  { name: 'צהוב', hex: '#ffd23f' },
  { name: 'ירוק', hex: '#37d67a' },
  { name: 'כתום', hex: '#ff9f1c' },
  { name: 'סגול', hex: '#a06bff' },
  { name: 'ורוד', hex: '#ff7ac4' },
  { name: 'חום', hex: '#a4713d' },
  { name: 'שחור', hex: '#2b2b3a' },
  { name: 'לבן', hex: '#f2f2f7' },
];

export const SHAPES = [
  { name: 'עיגול', emoji: '⭕' },
  { name: 'ריבוע', emoji: '🟦' },
  { name: 'משולש', emoji: '🔺' },
  { name: 'כוכב', emoji: '⭐' },
  { name: 'לב', emoji: '❤️' },
  { name: 'מעוין', emoji: '🔷' },
];

export const FUN_EMOJI = [
  '🍎', '🍌', '🚗', '⚽', '🌸', '🐟', '🎈', '🍪', '🌙', '🚀',
  '🦋', '🍇', '🐠', '🎸', '🍕', '🐧', '🌈', '🦖', '🚂', '🧸',
];
