/* Service worker do Second Soul (PWA).
   Requisito do Android para o app ser instalável, e dá um shell offline leve.
   Não intercepta a API (outra origem) nem requisições não-GET. */
const CACHE = "secondsoul-v1";
const SHELL = ["/", "/criar", "/entrar", "/meus-acervos", "/privacidade", "/icon-192.png", "/icon-512.png", "/galaxy.webp"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // add individual: uma URL que falhe não derruba a instalação inteira
      await Promise.allSettled(SHELL.map((u) => cache.add(u)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // deixa API/terceiros passarem

  // Navegação: rede primeiro, cai para o cache (e para "/" como último recurso)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(req)) || (await caches.match("/")))
    );
    return;
  }

  // Estáticos: cache primeiro, rede como fallback (e guarda assets do Next)
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((resp) => {
          if (resp.ok && (url.pathname.startsWith("/_next/") || SHELL.includes(url.pathname))) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return resp;
        })
    )
  );
});
