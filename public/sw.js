/**
 * 🛰️ IMERGENE NEURAL SERVICE WORKER: NETWORK-FIRST
 * Prioritizes latest server code. Updates cache in background.
 */

const CACHE_NAME = 'imergene-v4.1'; // 🟢 Increment this ONLY if you want to clear old caches entirely
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo192.png',
    '/logo512.png'
];

// 🟢 INSTALL: Pre-cache core assets and skip waiting
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip API calls & external links
    if (!url.origin.includes(self.location.origin) || url.pathname.includes('/api/')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // 🟢 FIX: Check for 206 Partial Content
                // We cannot cache partial responses. 
                // Also check if the response is valid (status 200).
                if (!response || response.status !== 200 || response.type === 'opaque') {
                    return response; 
                }

                // If the network request is a full, successful response (200), cache it
                const clonedResponse = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, clonedResponse);
                });

                return response;
            })
            .catch(() => {
                // If network is down, provide the cached version
                return caches.match(event.request);
            })
    );
});

// 🟢 ACTIVATE: Clean up old versions and take control immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            clients.claim(), // ⚡ Take control of open tabs immediately
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cache) => {
                        if (cache !== CACHE_NAME) {
                            console.log('Neural Sync: Purging legacy cache', cache);
                            return caches.delete(cache);
                        }
                    })
                );
            })
        ])
    );
});

// 🟢 FETCH: Network-First Strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip API calls & external links (API should always be live data)
    if (!url.origin.includes(self.location.origin) || url.pathname.includes('/api/')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // If the network request works, clone it and update the cache
                const clonedResponse = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, clonedResponse);
                });
                return response;
            })
            .catch(() => {
                // If network is down, provide the cached version
                return caches.match(event.request);
            })
    );
});