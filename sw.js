const CACHE = 'copper-v1';
const ASSETS = [
  '/index.html',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon.svg',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(ks =>
      Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  // API 代理请求：网络优先，失败时用缓存
  if (url.includes('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const c = r.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, c));
          return r;
        })
        .catch(() => caches.match(e.request).then(res => res || new Response(JSON.stringify({error:'offline'}), {status:503, headers:{'Content-Type':'application/json'}})))
    );
    return;
  }
  // 静态资源：缓存优先
  e.respondWith(
    caches.match(e.request).then(c => c || fetch(e.request))
  );
});
