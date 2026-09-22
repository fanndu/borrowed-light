const CACHE = "borrowed-light-1.0.0-42b0c10a3719";
const FILES = [
  "./",
  "./index.html",
  "./src/app.js",
  "./src/styles.css",
  "./src/audio.js",
  "./src/board.js",
  "./src/engine.js",
  "./src/levels.js",
  "./src/storage.js",
  "./assets/icon.svg",
  "./manifest.webmanifest",
];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith("borrowed-light-") && n !== CACHE)
            .map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== location.origin
  )
    return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        return await fetch(event.request);
      } catch (error) {
        if (event.request.mode === "navigate")
          return (await cache.match("./index.html")) || Response.error();
        throw error;
      }
    }),
  );
});
