/* Service worker de Órbita: caché "app shell" para funcionar sin conexión (RNF-01). */
const CACHE = 'orbita-v9';
const ARCHIVOS = ['./', './index.html', './css/styles.css', './manifest.webmanifest',
  './js/app.js', './js/llm.js', './js/markdown.js', './js/voice.js', './js/orbits.js', './js/room.js', './js/profile.js', './js/demo.js', './js/prep.js',
  './vendor/markdown-it/markdown-it.umd.min.js',
  './data/simulated.js', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => /^orbita-v\d+$/.test(k) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // las llamadas al LLM no se cachean
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
