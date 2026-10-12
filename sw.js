/* Service Worker — מטמון קליפה (app shell). נתוני הסגל/כוחות תמיד מהרשת. */
const CACHE = 'koved-shell-v43';
const SHELL = ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
// הודעת רענון מהדף — מחיל מיד את הגרסה החדשה
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // תמיד רשת עבור ה-API (נתונים חיים, לא ממטמנים)
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/.netlify/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{}', { headers: { 'content-type': 'application/json' } })));
    return;
  }
  if (e.request.method !== 'GET') return;
  // קליפה: network-first עם נפילה למטמון (עדכונים + עבודה offline)
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((m) => m || caches.match('index.html')))
  );
});
