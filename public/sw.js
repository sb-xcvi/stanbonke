/*
 * Service worker: makes the site installable and readable offline.
 * - Built assets (/build, icons, fonts) come from the cache first: their file names change on every build.
 * - Pages are fetched from the network first and cached; offline, the last cached copy is shown,
 *   or the homepage if that page was never visited.
 * Paths are resolved against the worker's scope, so this works at / and under a sub-path (GitHub Pages).
 * Bump VERSION to force every visitor onto a fresh cache.
 */
const VERSION = 'v1';
const CACHE = `signal-${VERSION}`;
const scope = new URL(self.registration.scope);
const home = new URL('./', scope).href;

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.add(home)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key.startsWith('signal-') && key !== CACHE).map((key) => caches.delete(key))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== scope.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE).then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request).then((cached) => cached || caches.match(home))),
        );
        return;
    }

    if (/\/(build|icons)\//.test(url.pathname) || url.pathname.endsWith('.svg')) {
        event.respondWith(
            caches.match(request).then((cached) => cached || fetch(request).then((response) => {
                const copy = response.clone();
                caches.open(CACHE).then((cache) => cache.put(request, copy));
                return response;
            })),
        );
    }
});
