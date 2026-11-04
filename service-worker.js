/* Opcional: PWA com shell offline, mas SEM cache dos dados financeiros ou APIs do Supabase. */
const SHELL_CACHE = 'sqd-shell-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.addAll(['./index.html'])));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==SHELL_CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  if(event.request.mode!=='navigate' || event.request.method!=='GET')return;
  event.respondWith(fetch(event.request).catch(()=>caches.match('./index.html')));
});
