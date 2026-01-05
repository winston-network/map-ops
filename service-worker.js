const CACHE_NAME = 'offline-map-v1';
const TILE_CACHE_NAME = 'map-tiles-v1';

const STATIC_ASSETS = ['/', '/index.html', '/css/styles.css', '/js/app.js', '/js/map.js', '/js/data.js', '/manifest.json'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.filter(n => n !== CACHE_NAME && n !== TILE_CACHE_NAME).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.hostname.includes('tile') || url.hostname.includes('carto')) {
        event.respondWith(caches.open(TILE_CACHE_NAME).then(cache => cache.match(event.request).then(r => r || fetch(event.request).then(res => { if (res.ok) cache.put(event.request, res.clone()); return res; }).catch(() => new Response(null, { status: 204 })))));
    } else {
        event.respondWith(caches.match(event.request).then(r => r || fetch(event.request)));
    }
});
