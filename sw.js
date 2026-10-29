/* Service worker: app sin conexión, caché de teselas y envío en segundo plano.
 * Subir VERSION cada vez que se publique un cambio para que los móviles descarguen la nueva. */
const VERSION = "inventario-v0.3.2";
const SHELL_CACHE = "inventario-shell-" + VERSION;
const TILE_CACHE = "inventario-tiles";
const TILE_LIMIT = 4000;

const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/styles.css",
  "js/config.js", "js/form-schema.js", "js/calc.js", "js/db.js", "js/auth.js", "js/agol.js", "js/sync.js",
  "js/geo.js", "js/photos.js", "js/basemaps.js", "js/app.js",
  "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css",
  "vendor/leaflet/images/marker-icon.png", "vendor/leaflet/images/marker-icon-2x.png", "vendor/leaflet/images/marker-shadow.png",
  "vendor/xlsx.mini.min.js",
  "vendor/fonts/inter-latin-400-normal.woff2", "vendor/fonts/inter-latin-500-normal.woff2",
  "vendor/fonts/inter-latin-600-normal.woff2", "vendor/fonts/inter-latin-700-normal.woff2",
  "img/logo-idaf.png", "img/logo-idaf-mark-light.png", "img/favicon.png", "img/icon-192.png", "img/icon-512.png", "img/icon-192-maskable.png", "img/icon-512-maskable.png"
];

importScripts("js/config.js", "js/form-schema.js", "js/calc.js", "js/db.js", "js/auth.js", "js/agol.js", "js/sync.js");

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("inventario-shell-") && k !== SHELL_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isTile = (u) => /server\.arcgisonline\.com\/ArcGIS\/rest\/services\/.+\/tile\//.test(u) || /www\.ign\.es\/wmts\//.test(u);
let putsSinceTrim = 0;

async function tileResponse(req) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  try {
    // Petición CORS propia: solo así la respuesta es legible y su tamaño real (no "opaca").
    const res = await fetch(req.url, { mode: "cors", credentials: "omit" });
    if (res.ok) {
      cache.put(req.url, res.clone());
      if (++putsSinceTrim > 100) { putsSinceTrim = 0; trimTiles(cache); }
    }
    return res;
  } catch (e) {
    try { return await fetch(req); } catch (e2) { return new Response("", { status: 504 }); }
  }
}
async function trimTiles(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - TILE_LIMIT; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (isTile(req.url)) { e.respondWith(tileResponse(req)); return; }
  if (url.origin !== self.location.origin) return; // ArcGIS REST: siempre a la red
  if (url.pathname.endsWith("/admin.html")) return;
  e.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); }
    catch (err) {
      if (req.mode === "navigate") return (await cache.match("index.html")) || Response.error();
      return Response.error();
    }
  })());
});

self.addEventListener("sync", (e) => {
  if (e.tag === "inventario-sync") e.waitUntil(SYNC.runQueue().catch(() => null));
});

self.addEventListener("message", (e) => {
  if (e.data === "sync") e.waitUntil(SYNC.runQueue().catch(() => null));
});
