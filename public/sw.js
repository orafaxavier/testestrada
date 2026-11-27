/* Service worker: o app abre mesmo sem sinal (ônibus, avião, camarim).
   Rede primeiro; sem rede, usa a última cópia. Dados do Supabase não passam por aqui. */
var CACHE = 'strada-v1';
var SHELL = ['/', '/index.html', '/app.js', '/boot.js', '/config.js', '/seed-state.json', '/vendor/supabase.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-180.png', '/icons/favicon.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  var same = url.origin === self.location.origin, fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !fonts) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) { return hit || (req.mode === 'navigate' ? caches.match('/index.html') : undefined); });
  }));
});
