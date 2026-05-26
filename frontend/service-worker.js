const CACHE_NAME = 'shipx-ai-logistics-dynamic-v1';
const APP_SHELL = [
  './',
  './app.html',
  './manifest.webmanifest?v=dynamic1',
  './assets/css/style.css?v=shipx30',
  './assets/css/tracking.css?v=shipx30',
  './assets/css/chatbot.css?v=shipx30',
  './assets/css/dashboard.css?v=shipx30',
  './assets/css/dynamic-app.css?v=dynamic1',
  './assets/js/dynamicApp.js?v=dynamic1',
  './assets/img/app-icon-192.png',
  './assets/img/app-icon-512.png',
  './assets/img/download.png',
  './assets/img/images.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE_NAME || /fedx|fedex/i.test(key))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const acceptsHtml = event.request.headers.get('accept')?.includes('text/html');
  const isNavigation = event.request.mode === 'navigate' || acceptsHtml;

  if (isNavigation) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match('./app.html'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'reload' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./app.html')))
  );
});
