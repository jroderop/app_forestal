/* Almacenamiento local (IndexedDB). Lo usan la página y el service worker.
 *   records : registros (borradores, pendientes de envío, enviados)
 *   photos  : fotos de cada registro (Blob) hasta que se suben como adjunto
 *   kv      : sesión (token), último acceso, esquema del servicio en caché
 */
(function (g) {
  const NAME = "inventario-campo";
  const VERSION = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("records")) {
          const s = db.createObjectStore("records", { keyPath: "localId" });
          s.createIndex("status", "status");
          s.createIndex("project", "projectKey");
        }
        if (!db.objectStoreNames.contains("photos")) {
          const p = db.createObjectStore("photos", { keyPath: "id" });
          p.createIndex("recordId", "recordId");
        }
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function tx(store, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      Promise.resolve(fn(s)).then((v) => { out = v; });
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }
  const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  const DB = {
    put: (store, val, key) => tx(store, "readwrite", (s) => req2p(key === undefined ? s.put(val) : s.put(val, key))),
    get: (store, key) => tx(store, "readonly", (s) => req2p(s.get(key))),
    del: (store, key) => tx(store, "readwrite", (s) => req2p(s.delete(key))),
    all: (store) => tx(store, "readonly", (s) => req2p(s.getAll())),
    byIndex: (store, index, value) => tx(store, "readonly", (s) => req2p(s.index(index).getAll(value))),
    kvGet: (k) => DB.get("kv", k),
    kvSet: (k, v) => DB.put("kv", v, k),
    kvDel: (k) => DB.del("kv", k),
    async deleteRecord(localId) {
      const photos = await DB.byIndex("photos", "recordId", localId);
      for (const p of photos) await DB.del("photos", p.id);
      await DB.del("records", localId);
    },
    async usage() {
      const recs = await DB.all("records");
      const photos = await DB.all("photos");
      const bytes = photos.reduce((a, p) => a + (p.blob ? p.blob.size : 0), 0);
      return { records: recs.length, photos: photos.length, bytes };
    }
  };

  g.DB = DB;
})(self);
