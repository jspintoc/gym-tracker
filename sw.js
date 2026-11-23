// Change this version every time you publish changes to the app files
const CACHE_NAME = "gym-tracker-v3";

// Files the app needs to work offline
const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

// 1. Install: save a copy of every app file
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES))
  );
});
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES))
  );
});

// 2. Activate: delete caches from older versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
    .then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
    .then(() => self.clients.claim())
  );
});

// 3. Fetch: answer from the cache first, fall back to the network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});