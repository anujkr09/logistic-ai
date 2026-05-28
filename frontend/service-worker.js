const CACHE_NAME = 'shipx-ai-logistics-v40';
const APP_SHELL = [
  './',
  './index.html',
  './app.html',
  './manifest.webmanifest?v=dynamic1',
  './assets/css/style.css?v=shipx34',
  './assets/css/animations.css?v=shipx31',
  './assets/css/responsive.css?v=shipx34',
  './assets/css/dynamic-app.css?v=dynamic3',
  './assets/css/tracking.css?v=shipx31',
  './assets/css/chatbot.css?v=shipx31',
  './assets/css/dashboard.css?v=shipx31',
  './assets/js/app.js?v=shipx33',
  './assets/js/dynamicApp.js?v=dynamic1',
  './assets/js/universalChatbot.js?v=shipx32',
  './assets/js/auth.js?v=shipx32',
  './assets/js/maps.js?v=shipx32',
  './assets/js/profile.js?v=shipx31',
  './assets/js/tracking.js?v=shipx32',
  './assets/js/dynamicServicePages.js?v=shipx32',
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
        .catch(() => caches.match('./app.html').then((cached) => cached || caches.match('./index.html')))
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
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./app.html') || caches.match('./index.html')))
  );
});
