/** この時間ネットワークが応答しなければ、キャッシュがあればそちらを返す */
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)   // 自分のキャッシュだけ掃除する
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // 同じオリジンでも、ほかのツールのファイルには手を出さない
  if (!url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;

  const fromNetwork = fetch(request);
  event.waitUntil(
    fromNetwork
      .then((response) => {
        if (!response.ok || response.redirected) return undefined;
        const copy = response.clone();
        return caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      })
      .catch(() => undefined),
  );
  event.respondWith(networkFirst(request, fromNetwork));
});

async function networkFirst(request, fromNetwork) {
  try {
    const response = await Promise.race([fromNetwork, delay(NETWORK_TIMEOUT_MS)]);
    if (response) return response;
  } catch {
    // オフライン: 下でキャッシュを探す
  }
  const cache = await caches.open(CACHE_NAME);
  const cached = request.mode === 'navigate'
    ? (await cache.match(request, { ignoreSearch: true })) || cache.match('./')
    : await cache.match(request);
  return cached || fromNetwork;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms, null));
}
