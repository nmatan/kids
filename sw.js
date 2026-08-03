/* ---------------------------------------------------------------
   sw.js — service worker. This is what makes the app work offline
   once it's installed on the tablet.

   ⚠️ After adding or renaming any file, add it to PRECACHE and bump
   VERSION. The version change is what tells installed tablets to
   fetch the new code.
   --------------------------------------------------------------- */

const VERSION = 'v10';
const CACHE = `kids-games-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './js/app.js',
  './js/kit.js',
  './js/text.js',
  './js/themes.js',
  './js/countries.js',
  './js/store.js',
  './js/settings.js',
  './js/profiles.js',
  './js/registry.js',
  './js/games/animals.js',
  './js/games/colors.js',
  './js/games/counting.js',
  './js/games/shapes.js',
  './js/games/letters.js',
  './js/games/addsub.js',
  './js/games/memory.js',
  './js/games/times.js',
  './js/games/clock.js',
  './js/games/spelling.js',
  './js/games/translate.js',
  './js/games/money.js',
  './js/games/flags.js',
  './js/games/geography.js',
  './js/games/truefalse.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll is all-or-nothing; cache individually so one bad path
      // can't stop the whole app from working offline.
      .then((cache) => Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => console.warn('sw: skipped', url))),
      ))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Navigations always resolve to the app shell — the router reads the hash.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((hit) => hit || fetch(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((res) => {
        // Stash same-origin successes so newly added files work offline too.
        if (res.ok && new URL(request.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => hit);
    }),
  );
});
