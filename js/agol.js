/* REST de ArcGIS (Feature Service) y traducción formulario <-> campos de la capa.
 * Sin SDK: peticiones fetch, así funciona igual en la página y en el service worker. */
(function (g) {
  const AGOL = {};

  AGOL.makeError = (msg, kind, code) => { const e = new Error(msg); e.kind = kind; e.code = code; return e; };

  /* Igual que la app de instalaciones: SIEMPRE POST multipart con el token en el cuerpo,
   * nunca en la URL (ArcGIS Online puede rechazar tokens en la query string). */
  async function request(url, params, timeoutMs) {
    const p = Object.assign({ f: "json" }, params);
    const fd = new FormData();
    Object.entries(p).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (typeof Blob !== "undefined" && v instanceof Blob) fd.append(k, v, v.name || (k + ".jpg"));
      else fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    });
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs || 60000) : null;
    let res;
    try {
      res = await fetch(url, { method: "POST", body: fd, signal: ctl && ctl.signal });
    } catch (e) {
      throw AGOL.makeError(e && e.name === "AbortError" ? "Tiempo de espera agotado" : "Sin conexión con ArcGIS Online", "network");
    } finally { if (timer) clearTimeout(timer); }
    let data;
    try { data = await res.json(); } catch (e) { throw AGOL.makeError("Respuesta no válida del servidor (HTTP " + res.status + ")", res.status >= 500 ? "network" : "server", res.status); }
    if (data && data.error) {
      const code = Number(data.error.code);
      const det = (data.error.details || []).filter(Boolean).join(" ");
      const kind = (code === 498 || code === 499 || code === 403 || code === 401) ? "auth" : "server";
      let msg = data.error.message || "Error del servidor";
      if (kind === "auth") msg = code === 498 || code === 499
        ? "El token ha caducado o no es válido (" + code + "). Introduce el nuevo token."
        : "El token no tiene acceso a este proyecto (" + code + ").";
      const err = AGOL.makeError(msg + (det && kind !== "auth" ? " · " + det : ""), kind, code);
      err.raw = (data.error.message || "") + (det ? " · " + det : "");
      throw err;
    }
    return data;
  }
  AGOL.request = request;

  /* ------------------------- Esquema del servicio ------------------------- */
  const lc = (s) => String(s || "").toLowerCase();

  function layerSchema(info) {
    const fields = info.fields || [];
    const byName = {};
    fields.forEach((f) => { byName[lc(f.name)] = f; });
    const caps = String(info.capabilities || "").split(",").map((s) => s.trim());
    return {
      id: info.id, name: info.name, type: info.type, geometryType: info.geometryType || null,
      fields, byName,
      oidField: info.objectIdField || (fields.find((f) => f.type === "esriFieldTypeOID") || {}).name,
      gidField: info.globalIdField || (fields.find((f) => f.type === "esriFieldTypeGlobalID") || {}).name,
      hasAttachments: !!info.hasAttachments,
      caps, canCreate: caps.includes("Create"), canUpdate: caps.includes("Update"), canDelete: caps.includes("Delete"), canQuery: caps.includes("Query"),
      supportsGlobalIds: !!info.supportsApplyEditsWithGlobalIds,
      relationships: info.relationships || [],
      editFieldsInfo: info.editFieldsInfo || null,
      maxRecordCount: info.maxRecordCount || 1000
    };
  }

  AGOL.loadSchema = async function (serviceUrl, token) {
    const CFG = g.APP_CONFIG;
    const svc = await request(serviceUrl, { token }, 30000);
    const layers = svc.layers || [];
    const tables = svc.tables || [];
    const pointRef = layers.find((l) => l.id === CFG.pointLayerId) || layers.find((l) => /Point/i.test(l.geometryType || "")) || layers[0];
    if (!pointRef) throw AGOL.makeError("El servicio no tiene capas de puntos.", "server");
    const point = layerSchema(await request(serviceUrl + "/" + pointRef.id, { token }, 30000));
    point.url = serviceUrl + "/" + point.id;

    const repeats = {};
    for (const [name, opt] of Object.entries(CFG.repeatTables || {})) {
      const ref = tables.find((t) => lc(t.name) === lc(name)) || tables.find((t) => t.id === opt.fallbackId) || layers.find((t) => lc(t.name) === lc(name));
      if (!ref) { repeats[name] = null; continue; }
      const t = layerSchema(await request(serviceUrl + "/" + ref.id, { token }, 30000));
      t.url = serviceUrl + "/" + t.id;
      const rel = (t.relationships || []).find((r) => r.relatedTableId === point.id) || (t.relationships || [])[0];
      const keyField = (rel && rel.keyField && t.byName[lc(rel.keyField)]) ? t.byName[lc(rel.keyField)].name
        : (t.byName.parentglobalid || {}).name;
      const prel = (point.relationships || []).find((r) => r.relatedTableId === t.id);
      t.parentKey = (prel && prel.keyField) ? (point.byName[lc(prel.keyField)] || {}).name || point.gidField : point.gidField;
      t.childKey = keyField;
      repeats[name] = t;
    }
    return {
      serviceUrl, loadedAt: Date.now(), point, repeats,
      supportsServiceApplyEdits: point.supportsGlobalIds && Object.values(repeats).every((t) => !t || t.supportsGlobalIds)
    };
  };

  /* ---------------- Traducción de valores <-> atributos ---------------- */
  function convert(v, f, def) {
    if (v === undefined || v === null || v === "") return null;
    switch (f.type) {
      case "esriFieldTypeString": {
        let s = Array.isArray(v) ? v.join(",") : String(v);
        if (f.length && s.length > f.length) s = s.slice(0, f.length);
        return s;
      }
      case "esriFieldTypeDouble": case "esriFieldTypeSingle": {
        const n = Number(Array.isArray(v) ? v[0] : v); return isNaN(n) ? null : n;
      }
      case "esriFieldTypeInteger": case "esriFieldTypeSmallInteger": case "esriFieldTypeBigInteger": {
        const n = Number(Array.isArray(v) ? v[0] : v); return isNaN(n) ? null : Math.round(n);
      }
      case "esriFieldTypeDate": return typeof v === "number" ? v : Date.parse(v) || null;
      default: return Array.isArray(v) ? v.join(",") : v;
    }
  }
  const DATA_TYPES = new Set(["text", "decimal", "integer", "select_one", "select_multiple", "calc"]);

  /** values (por nombre de pregunta) -> atributos de la capa. Devuelve también las preguntas sin campo. */
  AGOL.toAttributes = function (values, schema, fieldDefs) {
    const attributes = {}, unmatched = [];
    fieldDefs.filter((d) => DATA_TYPES.has(d.type)).forEach((d) => {
      const f = schema.byName[lc(d.name)];
      if (!f) { unmatched.push(d.name); return; }
      if (f.editable === false) return;
      attributes[f.name] = convert(values[d.name], f, d);
    });
    return { attributes, unmatched };
  };
  AGOL.setExtra = function (attributes, schema, name, value) {
    const f = name && schema.byName[lc(name)];
    if (f && f.editable !== false) attributes[f.name] = convert(value, f);
    return !!f;
  };

  /** atributos de la capa -> values por nombre de pregunta */
  AGOL.fromAttributes = function (attrs, schema, fieldDefs) {
    const out = {};
    const lower = {}; Object.keys(attrs || {}).forEach((k) => { lower[lc(k)] = attrs[k]; });
    fieldDefs.filter((d) => DATA_TYPES.has(d.type)).forEach((d) => {
      let v = lower[lc(d.name)];
      if (v === undefined || v === null) return;
      if (d.type === "select_multiple") v = String(v).split(",").map((s) => s.trim()).filter(Boolean);
      else if (d.type === "select_one") v = String(v);
      out[d.name] = v;
    });
    return out;
  };

  /* ------------------------------ Operaciones ------------------------------ */
  AGOL.serviceApplyEdits = (serviceUrl, edits, token) =>
    request(serviceUrl + "/applyEdits", { edits, useGlobalIds: true, rollbackOnFailure: true, returnEditMoment: false, token }, 120000);

  AGOL.applyEdits = (layerUrl, edits, token) =>
    request(layerUrl + "/applyEdits", { adds: edits.adds, updates: edits.updates, deletes: edits.deletes && edits.deletes.join(","), useGlobalIds: !!edits.useGlobalIds, rollbackOnFailure: true, token }, 90000);

  AGOL.query = (layerUrl, params, token) => request(layerUrl + "/query", Object.assign({ token }, params), 60000);

  AGOL.addAttachment = (layerUrl, oid, file, keywords, token) =>
    request(layerUrl + "/" + oid + "/addAttachment", { attachment: file, keywords: keywords || undefined, token }, 180000);

  AGOL.deleteAttachments = (layerUrl, oid, ids, token) =>
    request(layerUrl + "/" + oid + "/deleteAttachments", { attachmentIds: ids.join(","), token }, 60000);

  AGOL.queryAttachments = (layerUrl, oids, token) =>
    request(layerUrl + "/queryAttachments", { objectIds: oids.join(","), returnMetadata: true, token }, 60000);

  /** Descarga un adjunto (token en el cuerpo del POST) y devuelve una URL local para mostrarlo. */
  AGOL.attachmentBlobUrl = async function (layerUrl, oid, attId, token) {
    const fd = new FormData(); fd.append("token", token);
    const res = await fetch(layerUrl + "/" + oid + "/attachments/" + attId, { method: "POST", body: fd });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || /json|text\/plain/.test(type)) throw AGOL.makeError("No se pudo descargar la foto", "server");
    return URL.createObjectURL(await res.blob());
  };

  AGOL.guid = () => {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return "{" + [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join("-").toUpperCase() + "}";
  };

  g.AGOL = AGOL;
})(self);
