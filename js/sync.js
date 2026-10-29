/* Cola de envío a ArcGIS Online. La ejecutan la página y el service worker (Background Sync).
 * Cada registro avanza por pasos idempotentes y guarda su progreso:
 *   1. parcela + filas de especies en una sola operación (applyEdits del servicio, todo o nada)
 *   2. cada foto como adjunto de la parcela, con keywords = nombre de la pregunta (como Survey123)
 * Si la conexión cae a mitad, el siguiente intento sigue donde se quedó. Antes de repetir un
 * alta se comprueba por GlobalID si ya llegó, para no duplicar.
 */
(function (g) {
  const CFG = g.APP_CONFIG;
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("inventario-sync") : null;
  const emit = (msg) => { try { channel && channel.postMessage(msg); } catch (e) { /* sin canal */ } };
  let running = false;

  const pageFields = () => g.FORM.PAGES.flatMap((p) => p.fields || []);
  const repeatDefs = () => g.FORM.PAGES.flatMap((p) => p.repeats || []);

  async function getSchema(session, force) {
    const key = "schema:" + session.serviceUrl;
    const cached = await DB.kvGet(key);
    if (cached && !force && Date.now() - cached.loadedAt < 6 * 3600e3) return cached;
    try {
      const s = await AGOL.loadSchema(session.serviceUrl, session.apiKey);
      await DB.kvSet(key, s);
      return s;
    } catch (e) {
      if (cached && e.kind === "network") return cached;
      throw e;
    }
  }

  const saveRec = (r) => { r.updatedAt = Date.now(); return DB.put("records", r); };
  const gidList = (ids) => ids.map((x) => "'" + x + "'").join(",");

  function resultError(res, fallback) {
    const e = res && res.error;
    const code = e && Number(e.code);
    return AGOL.makeError((e ? (e.description || e.message || fallback) : fallback) + (code ? " (código " + code + ")" : ""),
      code === 498 || code === 499 ? "auth" : "server", code);
  }

  function parentFeature(r, schema, session, mode) {
    const P = schema.point;
    const { attributes, unmatched } = AGOL.toAttributes(r.data, P, pageFields());
    if (CFG.operatorField) AGOL.setExtra(attributes, P, CFG.operatorField, session.fullName || session.user);
    if (CFG.accuracyField && r.location && r.location.acc !== null && r.location.acc !== undefined) AGOL.setExtra(attributes, P, CFG.accuracyField, r.location.manual ? null : r.location.acc);
    if (P.gidField) attributes[P.gidField] = r.globalId;
    if (mode === "update") attributes[P.oidField] = r.objectId;
    const geometry = r.location ? { x: r.location.lon, y: r.location.lat, spatialReference: { wkid: 4326 } } : undefined;
    return { feature: { attributes, geometry }, unmatched };
  }

  function rowFeature(row, def, table, parentGid, withOid) {
    const { attributes, unmatched } = AGOL.toAttributes(row, table, def.fields);
    if (table.gidField) attributes[table.gidField] = row._gid;
    if (table.childKey) attributes[table.childKey] = parentGid;
    if (withOid) attributes[table.oidField] = row._oid;
    return { feature: { attributes }, unmatched };
  }

  /* ---- Paso 1a: alta de parcela + filas ---- */
  async function createRecord(r, schema, session) {
    const token = session.apiKey;
    const P = schema.point;
    if (!P.canCreate) throw AGOL.makeError("La capa no permite crear registros (operación Crear desactivada).", "server");

    // ¿Llegó en un intento anterior cuya respuesta se perdió?
    if ((r.attempts || 0) > 0 && P.gidField) {
      const q = await AGOL.query(P.url, { where: P.gidField + "=" + gidList([r.globalId]), returnIdsOnly: true }, token);
      if (q.objectIds && q.objectIds.length) {
        r.objectId = q.objectIds[0];
        await reconcileRows(r, schema, token);
        if (repeatDefs().every((d) => (r.data[d.name] || []).every((row) => row._oid))) { r.rowsDone = true; await saveRec(r); return; }
        await saveRec(r);
      }
    }
    r.attempts = (r.attempts || 0) + 1;
    await saveRec(r);

    const unmatched = new Set();
    const parent = parentFeature(r, schema, session, "add");
    parent.unmatched.forEach((u) => unmatched.add(u));

    if (!r.objectId && schema.supportsServiceApplyEdits) {
      const edits = [{ id: P.id, adds: [parent.feature] }];
      repeatDefs().forEach((def) => {
        const T = schema.repeats[def.name];
        const rows = r.data[def.name] || [];
        if (!rows.length) return;
        if (!T) { unmatched.add(def.name + " (tabla)"); return; }
        edits.push({ id: T.id, adds: rows.map((row) => { const f = rowFeature(row, def, T, r.globalId); f.unmatched.forEach((u) => unmatched.add(def.name + "." + u)); return f.feature; }) });
      });
      const res = await AGOL.serviceApplyEdits(schema.serviceUrl, edits, token);
      const byId = {}; (res || []).forEach((x) => { byId[x.id] = x; });
      const pr = byId[P.id] && byId[P.id].addResults && byId[P.id].addResults[0];
      if (!pr || !pr.success) throw resultError(pr, "El servidor rechazó la parcela");
      r.objectId = pr.objectId;
      for (const def of repeatDefs()) {
        const T = schema.repeats[def.name]; const rows = r.data[def.name] || [];
        if (!T || !rows.length) continue;
        const ar = (byId[T.id] && byId[T.id].addResults) || [];
        rows.forEach((row, i) => { if (ar[i] && ar[i].success) row._oid = ar[i].objectId; });
        if (ar.some((x) => !x.success)) throw resultError(ar.find((x) => !x.success), "El servidor rechazó una fila de " + def.title);
      }
      r.rowsDone = true;
    } else {
      // Servicio sin applyEdits por GlobalID: parcela primero y luego filas con su parentglobalid.
      if (!r.objectId) {
        const res = await AGOL.applyEdits(P.url, { adds: [parent.feature], useGlobalIds: P.supportsGlobalIds }, token);
        const ar = res.addResults && res.addResults[0];
        if (!ar || !ar.success) throw resultError(ar, "El servidor rechazó la parcela");
        r.objectId = ar.objectId;
        if (ar.globalId) r.globalId = ar.globalId;
        await saveRec(r);
      }
      await addRowsPerTable(r, schema, token, unmatched);
      r.rowsDone = true;
    }
    r.unmatched = Array.from(unmatched);
    await saveRec(r);
  }

  async function addRowsPerTable(r, schema, token, unmatched) {
    for (const def of repeatDefs()) {
      const T = schema.repeats[def.name];
      const rows = (r.data[def.name] || []).filter((row) => !row._oid);
      if (!rows.length) continue;
      if (!T) { unmatched && unmatched.add(def.name + " (tabla)"); continue; }
      const res = await AGOL.applyEdits(T.url, { adds: rows.map((row) => rowFeature(row, def, T, r.globalId).feature), useGlobalIds: T.supportsGlobalIds }, token);
      (res.addResults || []).forEach((x, i) => { if (x.success) rows[i]._oid = x.objectId; });
      await saveRec(r);
      const bad = (res.addResults || []).find((x) => !x.success);
      if (bad) throw resultError(bad, "El servidor rechazó una fila de " + def.title);
    }
  }

  /** Marca como creadas las filas cuyo GlobalID ya existe en el servidor. */
  async function reconcileRows(r, schema, token) {
    for (const def of repeatDefs()) {
      const T = schema.repeats[def.name];
      const rows = (r.data[def.name] || []).filter((row) => !row._oid);
      if (!T || !T.gidField || !rows.length) continue;
      const q = await AGOL.query(T.url, { where: T.gidField + " IN (" + gidList(rows.map((x) => x._gid)) + ")", outFields: T.oidField + "," + T.gidField, returnGeometry: false }, token);
      (q.features || []).forEach((f) => {
        const gid = String(f.attributes[T.gidField]).toUpperCase();
        const row = rows.find((x) => x._gid.toUpperCase() === gid);
        if (row) row._oid = f.attributes[T.oidField];
      });
    }
  }

  /* ---- Paso 1b: edición de un registro del servidor ---- */
  async function updateRecord(r, schema, session) {
    const token = session.apiKey;
    const P = schema.point;
    if (!P.canUpdate) throw AGOL.makeError("La edición está desactivada en la capa (operación Actualizar).", "server");
    if ((r.attempts || 0) > 0) await reconcileRows(r, schema, token);
    r.attempts = (r.attempts || 0) + 1;
    await saveRec(r);

    const parent = parentFeature(r, schema, session, "update");
    const useG = schema.supportsServiceApplyEdits;
    if (useG) {
      const edits = [{ id: P.id, updates: [parent.feature] }];
      for (const def of repeatDefs()) {
        const T = schema.repeats[def.name];
        if (!T) continue;
        const rows = r.data[def.name] || [];
        const e = { id: T.id };
        const adds = rows.filter((x) => !x._oid).map((x) => rowFeature(x, def, T, r.globalId).feature);
        const upds = rows.filter((x) => x._oid).map((x) => rowFeature(x, def, T, r.globalId, true).feature);
        const dels = (r.deletedRows && r.deletedRows[def.name]) || [];
        if (adds.length) e.adds = adds;
        if (upds.length) e.updates = upds;
        if (dels.length) { if (!T.canDelete) throw AGOL.makeError("La tabla " + def.title + " no permite borrar filas.", "server"); e.deletes = dels.map((d) => d.gid); }
        if (e.adds || e.updates || e.deletes) edits.push(e);
      }
      const res = await AGOL.serviceApplyEdits(schema.serviceUrl, edits, token);
      const byId = {}; (res || []).forEach((x) => { byId[x.id] = x; });
      const pu = byId[P.id] && byId[P.id].updateResults && byId[P.id].updateResults[0];
      if (!pu || !pu.success) throw resultError(pu, "El servidor rechazó la edición");
      for (const def of repeatDefs()) {
        const T = schema.repeats[def.name]; if (!T || !byId[T.id]) continue;
        const newRows = (r.data[def.name] || []).filter((x) => !x._oid);
        (byId[T.id].addResults || []).forEach((x, i) => { if (x.success && newRows[i]) newRows[i]._oid = x.objectId; });
        const bad = [].concat(byId[T.id].addResults || [], byId[T.id].updateResults || [], byId[T.id].deleteResults || []).find((x) => !x.success);
        if (bad) throw resultError(bad, "El servidor rechazó una fila de " + def.title);
      }
    } else {
      const res = await AGOL.applyEdits(P.url, { updates: [parent.feature] }, token);
      const pu = res.updateResults && res.updateResults[0];
      if (!pu || !pu.success) throw resultError(pu, "El servidor rechazó la edición");
      for (const def of repeatDefs()) {
        const T = schema.repeats[def.name]; if (!T) continue;
        const upds = (r.data[def.name] || []).filter((x) => x._oid).map((x) => rowFeature(x, def, T, r.globalId, true).feature);
        const dels = ((r.deletedRows && r.deletedRows[def.name]) || []).map((d) => d.oid);
        if (dels.length && !T.canDelete) throw AGOL.makeError("La tabla " + def.title + " no permite borrar filas.", "server");
        if (upds.length || dels.length) {
          const rr = await AGOL.applyEdits(T.url, { updates: upds.length ? upds : undefined, deletes: dels.length ? dels : undefined }, token);
          const bad = [].concat(rr.updateResults || [], rr.deleteResults || []).find((x) => !x.success);
          if (bad) throw resultError(bad, "El servidor rechazó una fila de " + def.title);
        }
      }
      await addRowsPerTable(r, schema, token);
    }
    r.deletedRows = {};
    r.rowsDone = true;
    await saveRec(r);
  }

  /* ---- Paso 2: fotos ---- */
  async function uploadPhotos(r, schema, token) {
    const P = schema.point;
    const photos = (await DB.byIndex("photos", "recordId", r.localId)).filter((p) => !p.uploaded && p.blob);
    if (photos.length && !P.hasAttachments) throw AGOL.makeError("La capa no tiene los adjuntos habilitados (Ajustes de la capa › Adjuntos).", "server");
    photos.sort((a, b) => a.createdAt - b.createdAt);
    for (const ph of photos) {
      const file = (typeof File !== "undefined") ? new File([ph.blob], ph.fileName || (ph.field + ".jpg"), { type: ph.blob.type || "image/jpeg" }) : ph.blob;
      let res;
      try {
        res = await AGOL.addAttachment(P.url, r.objectId, file, ph.field, token);
      } catch (e) {
        if (e.kind !== "server") throw e;
        res = await AGOL.addAttachment(P.url, r.objectId, file, undefined, token); // capas sin keywords
      }
      const ar = res.addAttachmentResult;
      if (!ar || !ar.success) throw resultError(ar, "No se pudo subir la foto " + ph.field);
      ph.uploaded = true; ph.attachmentId = ar.objectId; ph.blob = null; // libera espacio en el móvil
      await DB.put("photos", ph);
      emit({ type: "progress", localId: r.localId });
    }
    // Fotos sustituidas al editar: se borra la antigua solo cuando la nueva ya está subida
    const dels = (r.attachDeletes || []).filter(Boolean);
    if (dels.length) {
      const res = await AGOL.deleteAttachments(P.url, r.objectId, dels, token);
      (res.deleteAttachmentResults || []).forEach((x) => { if (!x.success && x.error && x.error.code !== 404) throw resultError(x, "No se pudo borrar una foto antigua"); });
      r.attachDeletes = [];
      await saveRec(r);
    }
  }

  async function processRecord(r, schema, session) {
    r.status = "sending"; r.lastError = null; await saveRec(r);
    emit({ type: "progress", localId: r.localId });
    if (!r.rowsDone) {
      if (r.kind === "update") await updateRecord(r, schema, session);
      else await createRecord(r, schema, session);
    }
    await uploadPhotos(r, schema, session.apiKey);
    r.status = "sent"; r.sentAt = Date.now(); r.lastError = null;
    await saveRec(r);
    // Tras una edición, las copias enviadas anteriores de la misma parcela quedan obsoletas
    if (r.kind === "update") {
      const old = (await DB.byIndex("records", "project", r.projectKey)).filter((x) => x.localId !== r.localId && x.status === "sent" && String(x.globalId).toUpperCase() === String(r.globalId).toUpperCase());
      for (const x of old) await DB.deleteRecord(x.localId);
    }
    emit({ type: "sent", localId: r.localId });
  }

  async function run(opts) {
    opts = opts || {};
    const session = await AUTH.getSession();
    if (!session) return { sent: 0, pending: 0, reason: "nosession" };
    const key = AUTH.projectKey(session);
    const all = (await DB.byIndex("records", "project", key))
      .filter((r) => r.status === "pending" || r.status === "sending" || (opts.retryErrors && r.status === "error"))
      .sort((a, b) => a.createdAt - b.createdAt);
    if (!all.length) return { sent: 0, pending: 0 };
    emit({ type: "start", count: all.length });
    let schema;
    try { schema = await getSchema(session, !!opts.forceSchema); }
    catch (e) {
      if (e.kind === "auth") { await AUTH.invalidate(e.message); emit({ type: "auth", message: e.message }); }
      emit({ type: "end", error: e.message, kind: e.kind });
      if (e.kind === "network") return { sent: 0, pending: all.length, offline: true };
      if (e.kind === "auth") return { sent: 0, pending: all.length, auth: true };
      throw e;
    }
    let sent = 0;
    for (const r of all) {
      try { await processRecord(r, schema, session); sent++; }
      catch (e) {
        // Token caducado: el registro sigue pendiente y se enviará con el token nuevo
        r.status = (e.kind === "network" || e.kind === "auth") ? "pending" : "error";
        if (e.kind === "auth") { await AUTH.invalidate(e.message); emit({ type: "auth", message: e.message }); }
        r.lastError = e.message; await saveRec(r);
        emit({ type: "error", localId: r.localId, message: e.message, kind: e.kind });
        if (e.kind === "network" || e.kind === "auth") { emit({ type: "end", sent, error: e.message, kind: e.kind }); return { sent, pending: all.length - sent, offline: e.kind === "network", auth: e.kind === "auth" }; }
      }
    }
    emit({ type: "end", sent });
    return { sent, pending: all.length - sent };
  }

  /** Ejecuta la cola con exclusión mutua entre la página y el service worker. */
  async function runQueue(opts) {
    if (typeof navigator !== "undefined" && navigator.locks) {
      return navigator.locks.request("inventario-sync", { ifAvailable: true }, (lock) => lock ? run(opts) : { busy: true });
    }
    if (running) return { busy: true };
    running = true;
    try { return await run(opts); } finally { running = false; }
  }

  g.SYNC = { runQueue, getSchema };
})(self);
