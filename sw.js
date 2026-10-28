const CACHE_NAME = "meu-bolso-shell-v11";
const SCOPE_URL = self.registration.scope;
const APP_FILES = [
  new URL("index.html", SCOPE_URL).href,
  new URL("styles.css", SCOPE_URL).href,
  new URL("firebase-config.js", SCOPE_URL).href,
  new URL("app-v2.js", SCOPE_URL).href,
  new URL("manifest.json", SCOPE_URL).href,
  new URL("icon.svg", SCOPE_URL).href
];
const FIREBASE_FILES = [
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-compat.js"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_FILES);
    // Cache dos SDKs melhora a chance de abrir a aplicação sem rede após a primeira visita.
    await Promise.all(FIREBASE_FILES.map(async url => {
      try {
        const response = await fetch(url, { mode: "cors" });
        if (response && response.ok) await cache.put(url, response);
      } catch (_) { /* A instalação do app shell não depende da rede externa. */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("meu-bolso-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok && url.origin === self.location.origin) cache.put(request, response.clone());
        return response;
      } catch (_) {
        return cache.match(new URL("index.html", SCOPE_URL).href);
      }
    })());
  } else if (FIREBASE_FILES.includes(request.url)) {
    event.respondWith((async () => {
      const cached = await caches.match(request.url);
      if (cached) return cached;
      return fetch(request);
    })());
  }
});