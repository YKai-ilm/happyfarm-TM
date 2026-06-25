const CACHE = 'happyfarm-cache-v4';

self.addEventListener('install', e => { self.skipWaiting(); });

// 啟用時清掉所有舊版快取，避免一直餵到過時或壞掉的 game.js / styles.css
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const dest = req.destination;
  // HTML / JS / CSS：網路優先（有網路就抓最新程式，沒網路才用快取）
  const codeLike =
    req.mode === 'navigate' ||
    dest === 'document' ||
    dest === 'script' ||
    dest === 'style';

  if (codeLike) {
    e.respondWith(
      fetch(req)
        .then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); return r; })
        .catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
    return;
  }

  // 圖片 / 音樂等靜態素材：快取優先、背景更新
  e.respondWith(
    caches.match(req).then(m => {
      const f = fetch(req)
        .then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); return r; })
        .catch(() => m);
      return m || f;
    })
  );
});
