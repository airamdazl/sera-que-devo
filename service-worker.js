/* Será Que Devo? BI 2.0 — PWA shell UX06 v1, atualização segura. */
/* Não armazenar respostas do Supabase, dados financeiros ou tokens de autenticação. */
const CACHE_NAME = 'sqd-pwa-public-shell-beta2-ux11-market01';
const PUBLIC_SHELL = [
  './index.html', './bi20.js', './market-ocr.js', './bi20.css', './bi20-polish.js', './bi20-polish.css', './bi20-ux02.css', './bi20-ux04.js', './bi20-ux04.css', './public-config.js', './manifest.webmanifest', './icon-192.png',
  './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PUBLIC_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key =>
        (key === 'sqd-shell-v1' || (key.startsWith('sqd-pwa-public-shell-') || key.startsWith('sqd-pwa-public-shell-beta2-')))
        && key !== CACHE_NAME
      ).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request).catch(() => caches.match('./index.html'))
  );
});
