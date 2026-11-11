/* global self, caches, fetch, URL */
// Service worker léger : pages publiques consultables hors connexion, ressources du build en cache.
// Les espaces connectés et l'API ne sont jamais mis en cache.
const VERSION = 'kodav-v1';
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const OFFLINE = '/offline.html';
const PRIVATE =
  /^\/(admin|espace-client|technicien|connexion|inscription|mot-de-passe-oublie|reinitialiser-mot-de-passe|verifier-email|devis\/reponse)(\/|$)/;
const MAX_PAGES = 60;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.addAll(['/', OFFLINE]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

/** Réseau d'abord (contenu à jour), cache si la connexion tombe. */
async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      void trim(PAGES, MAX_PAGES);
    }
    return response;
  } catch {
    return (await cache.match(request)) ?? (await cache.match(OFFLINE));
  }
}

/** Fichiers du build : leur nom change à chaque version, le cache suffit. */
async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (PRIVATE.test(url.pathname)) return;

  if (request.mode === 'navigate' || url.pathname.endsWith('.data')) {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
  }
});
