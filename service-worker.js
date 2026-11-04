const CACHE_NAME = "sqd-pro-lite-v1";
const APP_SHELL = [
  "./", "./index.html", "./css/style.css", "./js/app.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("sqd-pro-lite-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy)); return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok && (url.pathname.endsWith(".css") || url.pathname.endsWith(".js") || url.pathname.endsWith(".png") || url.pathname.endsWith(".webmanifest"))) {
      const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});
