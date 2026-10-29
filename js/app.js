/* =====================================================================
   Inventario de Campo · Lógica de la interfaz
   1. Utilidades          6. Formulario (páginas, campos, repeats)
   2. Arranque            7. Revisión y envío
   3. Sesión              8. Edición de registros del servidor
   4. Inicio / registros  9. Exportar a Excel
   5. Estado de red      10. Sesión, diagnóstico y ayuda
   ===================================================================== */
(function () {
  "use strict";
  const CFG = self.APP_CONFIG;
  const FORM = self.FORM;
  const PAGES = FORM.PAGES;
  const REVIEW = PAGES.length;               // índice de la página de revisión
  const ALL_FIELDS = PAGES.flatMap((p) => p.fields || []);
  const REPEATS = PAGES.flatMap((p) => p.repeats || []);
  const PHOTO_FIELDS = ALL_FIELDS.filter((f) => f.type === "image");

  /* ------------------------------------------------------------------
     1. Utilidades
     ------------------------------------------------------------------ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const fmt = (n, d = 0) => (n === null || n === undefined || isNaN(n)) ? "—" : Number(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtDate = (t) => t ? new Date(t).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : AGOL.guid().slice(1, -1).toLowerCase());
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } } };
  const ICON = {
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    retry: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
    cam: '<svg viewBox="0 0 24 24"><path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    img: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
    gps: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    chev: '<svg viewBox="0 0 24 24" class="chev"><path d="m9 6 6 6-6 6"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    layers: '<svg viewBox="0 0 24 24"><path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="m2 13 10 5 10-5"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>'
  };

  function toast(text, type = "info", ms = 4500) {
    const t = document.createElement("div");
    t.className = `toast toast-${type}`;
    t.textContent = text;
    const box = $("#toasts");
    while (box.children.length >= 2) box.firstElementChild.remove();
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, ms);
  }
  function busy(on, text) { $("#busy").classList.toggle("show", !!on); if (text) $("#busyText").textContent = text; }

  /** Modal: botones = [{ label, cls, onClick(close) }] */
  function openModal(title, body, buttons) {
    $("#modalTitle").textContent = title;
    const mb = $("#modalBody");
    mb.innerHTML = "";
    if (typeof body === "string") mb.innerHTML = body; else if (body) mb.appendChild(body);
    const foot = $("#modalFoot");
    foot.innerHTML = "";
    (buttons || []).forEach((b) => {
      const el = h(`<button class="btn ${b.cls || "btn-ghost"}">${b.label}</button>`);
      el.addEventListener("click", () => b.onClick ? b.onClick(closeModal) : closeModal());
      foot.appendChild(el);
    });
    $("#modal").hidden = false;
    return mb;
  }
  function closeModal() { $("#modal").hidden = true; }
  $("#btnModalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  const confirmBox = (title, text, okLabel, okCls) => new Promise((resolve) => {
    openModal(title, `<p>${text}</p>`, [
      { label: "Cancelar", onClick: (c) => { c(); resolve(false); } },
      { label: okLabel || "Aceptar", cls: okCls || "btn-primary", onClick: (c) => { c(); resolve(true); } }
    ]);
  });

  function showView(id) {
    ["vHome", "vForm", "vSettings"].forEach((v) => { $("#" + v).hidden = v !== id; });
    if (id !== "vForm") stopGps();
  }

  const choiceLabel = (list, name) => { const c = (FORM.LISTS[list] || []).find((x) => x.name === String(name)); return c ? c.label : (name === undefined || name === null ? "" : String(name)); };
  const speciesText = (list, name, other) => {
    if (!name) return "";
    if (name === "otro") return other ? other + " (otra)" : "Otra especie";
    const lab = choiceLabel(list, name);
    const common = String(name).replace(/_/g, " ");
    return lab && lab !== common ? `${common} — ${lab}` : common;
  };

  /* ------------------------------------------------------------------
     Estado (solo memoria; lo persistente va a IndexedDB)
     ------------------------------------------------------------------ */
  const state = {
    session: null, schema: null, schemaError: null,
    rec: null, page: 0,
    map: null, marker: null, accCircle: null, gpsWatch: null, gpsLast: null,
    photoUrls: {}, serverPhotoUrls: {}, serverItems: null, syncing: false, saveTimer: null
  };

  /* ------------------------------------------------------------------
     2. Arranque
     ------------------------------------------------------------------ */
  async function boot() {
    registerSW();
    await AUTH.init();
    state.session = await AUTH.getSession();
    showView("vHome");
    await renderHome();
    updateNet();
    if (state.session) { state.schema = await DB.kvGet("schema:" + state.session.serviceUrl) || null; renderEditAvailability(); loadSchema(false); trySync(); }
    const st = await AUTH.settings();
    if (!st.token) openSettings();  // primer uso: falta la clave

    window.addEventListener("online", () => { updateNet(); trySync(); });
    window.addEventListener("offline", () => updateNet());
    document.addEventListener("visibilitychange", () => { if (!document.hidden) trySync(); });
    setInterval(() => { if (navigator.onLine) trySync(); }, 60000);
    if (typeof BroadcastChannel !== "undefined") {
      new BroadcastChannel("inventario-sync").onmessage = (ev) => {
        const m = ev.data || {};
        if (m.type === "start") state.syncing = true;
        if (m.type === "end") state.syncing = false;
        if (m.type === "auth") { tokenRejected(m.message); return; }
        updateNet();
        if (!$("#vHome").hidden) renderLocalList();
      };
    }
  }

  function registerSW() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    navigator.serviceWorker.register("sw.js").catch(() => { /* sin SW: la app funciona, sin modo offline de la propia app */ });
  }
  async function requestBackgroundSync() {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.sync) await reg.sync.register("inventario-sync");
    } catch (e) { /* no disponible: se envía al volver la conexión con la app abierta */ }
  }

  /* ------------------------------------------------------------------
     3. Token (Ajustes)
     ------------------------------------------------------------------ */
  async function renderTokenBanner() {
    const st = await AUTH.settings();
    const banner = $("#tokenBanner");
    $("#projectTitle").textContent = !st.token ? "Sin clave de acceso" : st.problem ? "Clave caducada o no válida" : (st.operator || "IDAF · Forestry innovation & Development");
    if (st.token && !st.problem) { banner.hidden = true; return; }
    const pend = (await projectRecords()).filter((r) => ["pending", "sending", "error"].includes(r.status)).length;
    banner.className = "token-banner" + (st.problem ? "" : " info");
    $("#tokenBannerTitle").textContent = st.problem ? "La clave de acceso no es válida o ha caducado" : "Falta la clave de acceso";
    $("#tokenBannerText").textContent = (st.problem ? "Genera una nueva en ArcGIS Online y guárdala en Ajustes." : "Añádela en Ajustes para poder enviar.")
      + (pend ? ` Tienes ${pend} registro(s) sin enviar: se enviarán al guardar la clave.` : " Puedes seguir registrando parcelas: quedan guardadas en el móvil.");
    banner.hidden = false;
  }
  $("#btnBannerSettings").addEventListener("click", () => openSettings());

  /** ArcGIS Online rechazó la clave: aviso (una vez por incidencia). La clave se mantiene. */
  async function tokenRejected(message) {
    if (Date.now() - (state.lastRejected || 0) < 5000) return;   // página + service worker: un solo aviso
    state.lastRejected = Date.now();
    await AUTH.invalidate(message);
    const st = await AUTH.settings();
    if (st.problem && st.problem.at !== state.problemToastAt) {
      state.problemToastAt = st.problem.at;
      toast("La clave de acceso no es válida o ha caducado. Guarda una nueva en Ajustes.", "error", 9000);
    }
    renderEditAvailability();
    await renderTokenBanner();
    updateNet();
  }

  async function loadSchema(force) {
    if (!state.session) return state.schema;
    if (!navigator.onLine && state.schema) return state.schema;
    try {
      state.schema = await SYNC.getSchema(state.session, force);
      state.schemaError = null;
    } catch (e) {
      state.schemaError = e;
      if (e.kind === "auth") { await tokenRejected(e.message); }
    }
    renderEditAvailability();
    return state.schema;
  }

  /* ------------------------------------------------------------------
     4. Inicio / registros
     ------------------------------------------------------------------ */
  const projectRecords = async () => DB.byIndex("records", "project", AUTH.projectKey());
  const STATUS_TXT = { draft: "Borrador", pending: "Pendiente", sending: "Enviando", sent: "Enviado", error: "Error" };

  function canEdit() {
    const P = state.schema && state.schema.point;
    return !!(CFG.allowEdit && state.session && P && P.canUpdate && P.canQuery);
  }
  function editBlockReason() {
    const P = state.schema && state.schema.point;
    if (!CFG.allowEdit) return "La edición está desactivada en la configuración de la app.";
    if (!P) return "Conéctate una vez para comprobar si la edición está disponible.";
    if (!P.canUpdate) return "La edición de registros enviados está desactivada por el administrador.";
    if (!P.canQuery) return "La capa no permite consultar registros.";
    return "";
  }
  function renderEditAvailability() {
    const ok = canEdit();
    $("#serverSec").hidden = !ok;
    const note = $("#editNote");
    note.hidden = ok || !state.schema;
    note.textContent = ok ? "" : editBlockReason();
  }

  async function renderHome() { renderEditAvailability(); await renderTokenBanner(); await renderLocalList(); }

  async function renderLocalList() {
    const recs = (await projectRecords()).sort((a, b) => b.updatedAt - a.updatedAt);
    const c = { draft: 0, pending: 0, sent: 0, error: 0 };
    recs.forEach((r) => { c[r.status === "sending" ? "pending" : r.status] = (c[r.status === "sending" ? "pending" : r.status] || 0) + 1; });
    $("#stats").innerHTML = `
      <div class="stat ${c.pending + c.error ? "warn" : ""}"><b>${c.pending + c.error}</b><span>Sin enviar</span></div>
      <div class="stat"><b>${c.sent}</b><span>Enviados</span></div>
      <div class="stat"><b>${c.draft}</b><span>Borradores</span></div>`;
    const list = $("#localList");
    if (!recs.length) { list.innerHTML = `<div class="empty">Aún no hay parcelas en este móvil.<br>Pulsa <b>Nueva parcela</b> para empezar.</div>`; updateNet(recs); return; }
    list.innerHTML = "";
    for (const r of recs) {
      const nT = (r.data.InventarioTrees || []).length, nB = (r.data.InventarioGrass || []).length;
      const when = r.status === "sent" ? "Enviado " + fmtDate(r.sentAt) : "Modificado " + fmtDate(r.updatedAt);
      const el = h(`<div class="rec ${r.status}">
        <div class="rec-title">${esc(FORM.TITLE(r.data))}</div>
        <div class="rec-meta"><span class="badge ${r.status}">${STATUS_TXT[r.status] || r.status}</span>${r.kind === "update" ? "Edición · " : ""}${when} · ${nT} arb. · ${nB} arbust.</div>
        <div class="rec-actions"></div>
        ${r.status === "error" && r.lastError ? `<div class="rec-err">${esc(r.lastError)}</div>` : ""}
        ${r.unmatched && r.unmatched.length && r.status === "sent" ? `<div class="rec-err" style="background:var(--warn-bg);color:var(--warn)">Campos que no existen en la capa (no guardados): ${esc(r.unmatched.join(", "))}</div>` : ""}
      </div>`);
      const act = $(".rec-actions", el);
      const add = (icon, title, fn, cls) => { const b = h(`<button class="icon-btn ${cls || ""}" title="${title}">${icon}</button>`); b.addEventListener("click", fn); act.appendChild(b); };
      if (r.status === "sent") {
        add(ICON.eye, "Ver resumen", () => showSummary(r));
        if (canEdit() && r.objectId) add(ICON.edit, "Editar en el servidor", () => editServerRecord(r.objectId));
      } else if (r.status !== "sending") {
        if (r.status === "error") add(ICON.retry, "Reintentar", async () => { r.status = "pending"; r.attempts = r.attempts || 1; await DB.put("records", r); trySync(true); renderLocalList(); });
        add(ICON.edit, "Abrir", () => openRecord(r));
        add(ICON.trash, "Borrar del móvil", () => deleteLocal(r));
      }
      list.appendChild(el);
    }
    updateNet(recs);
  }

  async function deleteLocal(r) {
    const txt = r.status === "draft" ? "Se borrará el borrador y sus fotos." : "Este registro <b>no se ha enviado</b>. Si lo borras se pierde.";
    if (!(await confirmBox("Borrar registro", txt, "Borrar", "btn-danger"))) return;
    await DB.deleteRecord(r.localId);
    renderLocalList();
  }

  $("#btnNew").addEventListener("click", newRecord);
  $("#btnSyncNow").addEventListener("click", () => trySync(true, true));
  $("#btnExport").addEventListener("click", exportDialog);
  $("#btnLoadServer").addEventListener("click", loadServerList);

  /* ------------------------------------------------------------------
     5. Estado de red y envío
     ------------------------------------------------------------------ */
  async function updateNet(recs) {
    recs = Array.isArray(recs) ? recs : await projectRecords();
    const pend = recs.filter((r) => r.status === "pending" || r.status === "sending").length;
    const errs = recs.filter((r) => r.status === "error").length;
    const pill = $("#netPill");
    pill.classList.toggle("off", !navigator.onLine || pend > 0);
    pill.classList.toggle("err", errs > 0 || !state.session);
    let t;
    if (!state.session) t = "Sin clave" + (pend + errs ? ` · ${pend + errs}` : "");
    else if (!navigator.onLine) t = "Sin red" + (pend ? ` · ${pend}` : "");
    else if (state.syncing) t = "Enviando…";
    else if (errs) t = `${errs} con error`;
    else if (pend) t = `${pend} pendiente${pend > 1 ? "s" : ""}`;
    else t = "Al día";
    $("#netText").textContent = t;
  }
  $("#netPill").addEventListener("click", () => { if ($("#vForm").hidden) { renderHome(); trySync(true, true); } });

  async function trySync(retryErrors, verbose) {
    if (!state.session) { if (verbose) toast("Falta la clave de acceso: añádela en Ajustes para enviar.", "warn"); return; }
    if (!navigator.onLine) { if (verbose) toast("Sin conexión. Se enviará al recuperar cobertura.", "warn"); return; }
    state.syncing = true; updateNet();
    try {
      const r = await SYNC.runQueue({ retryErrors: !!retryErrors });
      if (r && r.sent) toast(`${r.sent} registro(s) enviado(s) a ArcGIS Online`, "ok");
      else if (verbose && r && !r.pending && !r.busy) toast("No hay registros pendientes.", "info");
      if (r && r.auth) { await tokenRejected("La clave de acceso no es válida o ha caducado."); return; }
      if (!state.schema) loadSchema(false);
    } catch (e) {
      if (verbose) toast(e.message, "error", 7000);
    } finally {
      state.syncing = false;
      if (!$("#vHome").hidden) renderLocalList(); else updateNet();
    }
  }

  /* ------------------------------------------------------------------
     6. Formulario
     ------------------------------------------------------------------ */
  function blankRecord() {
    const data = {}; REPEATS.forEach((r) => { data[r.name] = []; });
    return {
      localId: uuid(), globalId: AGOL.guid(), kind: "add", status: "draft",
      projectKey: AUTH.projectKey(), data, location: null,
      createdAt: Date.now(), updatedAt: Date.now(),
      existingPhotos: {}, attachDeletes: [], deletedRows: {}
    };
  }

  async function newRecord() {
    const rec = blankRecord();
    await DB.put("records", rec);
    openForm(rec, 0);
  }

  async function openRecord(r) {
    // Alta que ya llegó al servidor a medias (p. ej. falló una foto): cualquier cambio pasa a ser una edición.
    if (r.kind === "add" && r.objectId) {
      if (!canEdit()) {
        toast("Este registro ya está en el servidor y la edición no está disponible. Usa «Reintentar» para completar el envío.", "warn", 8000);
        return;
      }
      r.kind = "update"; r.rowsDone = false;
    }
    if (r.status === "pending" || r.status === "error") { r.status = "draft"; await DB.put("records", r); }
    openForm(r, 0);
  }

  /** Foto ya guardada en el servidor (al editar): se descarga con el token en el cuerpo del POST. */
  async function serverPhotoUrl(rec, field) {
    const ex = rec.existingPhotos && rec.existingPhotos[field];
    if (!ex || !state.session || !state.schema || !navigator.onLine) return null;
    if (state.serverPhotoUrls[field]) return state.serverPhotoUrls[field];
    try { state.serverPhotoUrls[field] = await AGOL.attachmentBlobUrl(state.schema.point.url, rec.objectId, ex.id, state.session.apiKey); }
    catch (e) { return null; }
    return state.serverPhotoUrls[field];
  }

  async function openForm(rec, page) {
    state.rec = rec;
    Object.values(state.serverPhotoUrls || {}).forEach((u) => URL.revokeObjectURL(u));
    state.serverPhotoUrls = {};
    if (rec.kind === "update") PHOTO_FIELDS.forEach((f) => serverPhotoUrl(rec, f.name));
    CALC.apply(rec.data);
    $("#formMode").textContent = rec.kind === "update" ? "Editando registro enviado" : "Nueva parcela";
    Object.values(state.photoUrls).forEach((u) => URL.revokeObjectURL(u));
    state.photoUrls = {};
    const photos = await DB.byIndex("photos", "recordId", rec.localId);
    photos.forEach((p) => { if (p.blob) state.photoUrls[p.field] = URL.createObjectURL(p.blob); });
    state.localPhotos = {}; photos.forEach((p) => { state.localPhotos[p.field] = p; });
    showView("vForm");
    goPage(page || 0);
  }

  function pageTitle(i) { return i === REVIEW ? "Revisión y envío" : PAGES[i].title; }

  function renderSteps() {
    const bad = pagesWithIssues();
    $("#steps").innerHTML = [...PAGES.map((p, i) => i), REVIEW].map((i) => {
      const cls = i === state.page ? "cur" : (bad.has(i) && i < state.page ? "bad" : (i < state.page ? "done" : ""));
      return `<li class="${cls}"><button data-goto="${i}"><span class="bar"></span><span class="lbl">${i + 1}. ${esc(i === REVIEW ? "Revisión" : PAGES[i].title.split(" ")[0])}</span></button></li>`;
    }).join("");
    $$("#steps [data-goto]").forEach((b) => b.addEventListener("click", () => goPage(Number(b.dataset.goto))));
  }

  function goPage(i) {
    stopGps();
    if (state.map) { state.map.remove(); state.map = null; }
    state.page = Math.max(0, Math.min(REVIEW, i));
    $("#pageTitle").textContent = pageTitle(state.page);
    $("#pageCount").textContent = `${state.page + 1} de ${REVIEW + 1}`;
    $("#btnPrev").disabled = state.page === 0;
    const next = $("#btnNext");
    if (state.page === REVIEW) next.innerHTML = state.rec.kind === "update" ? `Guardar` : `Enviar <svg viewBox="0 0 24 24"><path d="M4 12 20 4l-6 16-3-7z"/></svg>`;
    else next.innerHTML = `Siguiente <svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>`;
    renderSteps();
    const body = $("#formBody");
    body.innerHTML = "";
    state.calcNodes = []; state.relNodes = []; state.rowHeads = [];
    if (state.page === REVIEW) renderReview(body);
    else {
      const p = PAGES[state.page];
      if (p.hint) body.appendChild(h(`<p class="page-hint">${esc(p.hint)}</p>`));
      (p.fields || []).forEach((def) => body.appendChild(renderField(def, state.rec.data, null)));
      (p.repeats || []).forEach((rep) => body.appendChild(renderRepeat(rep)));
    }
    $("#formScroll").scrollTop = 0;
    refreshDerived();
  }

  $("#btnPrev").addEventListener("click", () => goPage(state.page - 1));
  $("#btnNext").addEventListener("click", () => state.page === REVIEW ? submitRecord() : goPage(state.page + 1));
  $("#btnCloseForm").addEventListener("click", async () => {
    await saveNow();
    state.rec = null;
    showView("vHome"); renderHome();
    toast("Borrador guardado en el móvil", "info", 2500);
  });

  function scheduleSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(saveNow, 400);
  }
  async function saveNow() {
    clearTimeout(state.saveTimer);
    if (!state.rec) return;
    state.rec.updatedAt = Date.now();
    await DB.put("records", state.rec);
    const m = $("#savedMark"); m.classList.add("show"); clearTimeout(m._t); m._t = setTimeout(() => m.classList.remove("show"), 1400);
  }

  /** Tras cualquier cambio: cálculos, relevancias y guardado. */
  function changed() { refreshDerived(); scheduleSave(); }
  function refreshDerived() {
    if (!state.rec) return;
    CALC.apply(state.rec.data);
    (state.calcNodes || []).forEach((n) => {
      const v = n.values[n.def.name];
      n.el.classList.toggle("empty", v === null || v === undefined);
      $("b", n.el).textContent = v === null || v === undefined ? "Se calcula al rellenar los datos" : fmt(v, n.def.decimals || 0);
      $("span", n.el).textContent = v === null || v === undefined ? "" : n.def.unit || "";
    });
    (state.relNodes || []).forEach((n) => { n.el.hidden = !n.def.relevant(n.values); });
    (state.rowHeads || []).forEach((fn) => fn());
  }

  /* ---------- Campos ---------- */
  function parseNum(raw, integer) {
    const s = String(raw).trim().replace(/\s/g, "").replace(",", ".");
    if (s === "") return { value: null };
    const n = Number(s);
    if (isNaN(n)) return { value: null, error: "Número no válido" };
    if (integer && !Number.isInteger(n)) return { value: Math.round(n), error: "Debe ser un número entero (se redondea)" };
    return { value: n };
  }

  function renderField(def, values, ctx) {
    const req = def.required ? '<span class="req">*</span>' : "";
    const q = h(`<div class="q" data-q="${esc(def.name)}">
      <div class="q-label">${esc(def.label)} ${req}</div>
      ${def.hint && def.type !== "calc" ? `<div class="q-hint">${esc(def.hint)}</div>` : ""}
      <div class="q-body"></div>
      <div class="q-msg" hidden></div>
    </div>`);
    const body = $(".q-body", q);
    const msg = $(".q-msg", q);
    const setMsg = (text, kind) => { msg.hidden = !text; msg.textContent = text || ""; msg.className = "q-msg " + (kind || "warn"); };
    const checkRange = (v) => { const r = CALC.rangeIssue(def.name, v); setMsg(r ? r.msg : "", r && r.hard ? "err" : "warn"); };
    const v = values[def.name];

    switch (def.type) {
      case "text": {
        const el = def.appearance === "multiline" ? h(`<textarea class="in" rows="3"></textarea>`) : h(`<input class="in" type="text" autocomplete="off">`);
        el.value = v || "";
        el.addEventListener("input", () => { values[def.name] = el.value; changed(); });
        body.appendChild(el);
        break;
      }
      case "decimal": case "integer": {
        const wrap = h(`<div class="unit-wrap"><input class="in" type="text" inputmode="${def.type === "integer" ? "numeric" : "decimal"}" autocomplete="off">${def.unit ? `<span class="unit">${esc(def.unit)}</span>` : ""}</div>`);
        const el = $("input", wrap);
        el.value = v === null || v === undefined ? "" : String(v).replace(".", ",");
        el.addEventListener("input", () => {
          const r = parseNum(el.value, def.type === "integer");
          values[def.name] = r.value;
          if (r.error) setMsg(r.error, "err"); else checkRange(r.value);
          changed();
        });
        if (v !== null && v !== undefined) checkRange(v);
        body.appendChild(wrap);
        break;
      }
      case "select_one": {
        const list = FORM.LISTS[def.list] || [];
        if (def.appearance === "minimal") {
          const isSp = /espec/.test(def.list);
          const el = h(`<select class="in"><option value="">— Selecciona —</option>${list.map((c) => `<option value="${esc(c.name)}">${esc(isSp ? speciesText(def.list, c.name) : c.label)}</option>`).join("")}</select>`);
          el.value = v || "";
          el.addEventListener("change", () => { values[def.name] = el.value || null; changed(); });
          body.appendChild(el);
        } else if (def.appearance === "likert") {
          const el = h(`<div class="likert" role="radiogroup">${list.map((c) => `<button type="button" data-v="${esc(c.name)}" class="${String(v) === c.name ? "on" : ""}"><span class="knob"></span>${esc(c.label)}</button>`).join("")}</div>`);
          $$("button", el).forEach((b) => b.addEventListener("click", () => {
            const nv = values[def.name] === b.dataset.v ? null : b.dataset.v;
            values[def.name] = nv;
            $$("button", el).forEach((x) => x.classList.toggle("on", x.dataset.v === nv));
            changed();
          }));
          body.appendChild(el);
        } else {
          const el = h(`<div class="chips" role="radiogroup">${list.map((c) => `<button type="button" class="chip ${String(v) === c.name ? "on" : ""}" data-v="${esc(c.name)}">${esc(c.label)}</button>`).join("")}</div>`);
          $$(".chip", el).forEach((b) => b.addEventListener("click", () => {
            const nv = values[def.name] === b.dataset.v ? null : b.dataset.v;
            values[def.name] = nv;
            $$(".chip", el).forEach((x) => x.classList.toggle("on", x.dataset.v === nv));
            changed();
          }));
          body.appendChild(el);
        }
        break;
      }
      case "select_multiple": {
        const list = FORM.LISTS[def.list] || [];
        const cur = new Set(Array.isArray(v) ? v : (v ? String(v).split(",") : []));
        const el = h(`<div class="chips">${list.map((c) => `<button type="button" class="chip ${cur.has(c.name) ? "on" : ""}" data-v="${esc(c.name)}"><span class="box"></span>${esc(c.label)}</button>`).join("")}</div>`);
        $$(".chip", el).forEach((b) => b.addEventListener("click", () => {
          if (cur.has(b.dataset.v)) cur.delete(b.dataset.v); else cur.add(b.dataset.v);
          b.classList.toggle("on", cur.has(b.dataset.v));
          values[def.name] = list.map((c) => c.name).filter((n) => cur.has(n));
          if (!values[def.name].length) values[def.name] = null;
          changed();
        }));
        body.appendChild(el);
        break;
      }
      case "calc": {
        const el = h(`<div class="calc"><b></b><span></span></div>`);
        body.appendChild(el);
        if (def.hint) body.appendChild(h(`<div class="q-hint" style="margin:6px 0 0">${esc(def.hint)}</div>`));
        state.calcNodes.push({ el, def, values });
        break;
      }
      case "image": body.appendChild(renderPhoto(def)); break;
      case "geopoint": body.appendChild(renderGeo(def)); break;
    }
    if (def.relevant) state.relNodes.push({ el: q, def, values });
    return q;
  }

  /* ---------- Fotos ---------- */
  function renderPhoto(def) {
    const rec = state.rec;
    const wrap = h(`<div class="photo-slot">
      <div class="photo-thumb">${ICON.cam}</div>
      <div class="photo-btns">
        <button type="button" class="btn btn-dark" data-act="cam">${ICON.cam} Hacer foto</button>
        <button type="button" class="btn btn-ghost" data-act="gal">${ICON.img} Galería</button>
        <button type="button" class="btn btn-danger btn-sm" data-act="del" hidden>${ICON.trash} Quitar foto nueva</button>
        <div class="photo-state"></div>
      </div>
      <input type="file" accept="image/*" capture="environment" hidden data-in="cam">
      <input type="file" accept="image/*" hidden data-in="gal">
    </div>`);
    const thumb = $(".photo-thumb", wrap), st = $(".photo-state", wrap), del = $('[data-act="del"]', wrap);
    function paint() {
      const local = state.photoUrls[def.name];
      const lp = state.localPhotos[def.name];
      const ex = rec.existingPhotos && rec.existingPhotos[def.name];
      thumb.classList.toggle("has", !!(local || ex || (lp && lp.uploaded)));
      if (local) { thumb.style.backgroundImage = `url("${local}")`; thumb.innerHTML = ""; st.textContent = "Foto nueva" + (ex ? " (sustituirá a la del servidor)" : ""); }
      else if (ex) {
        const su = state.serverPhotoUrls[def.name];
        thumb.style.backgroundImage = su ? `url("${su}")` : "";
        thumb.innerHTML = su ? "" : ICON.img; st.textContent = "Foto en el servidor";
        if (!su) serverPhotoUrl(rec, def.name).then((u) => { if (u && !state.photoUrls[def.name]) { thumb.style.backgroundImage = `url("${u}")`; thumb.innerHTML = ""; } });
      } else if (lp && lp.uploaded) { thumb.style.backgroundImage = ""; thumb.innerHTML = ICON.img; st.textContent = "Foto enviada"; }
      else { thumb.style.backgroundImage = ""; thumb.innerHTML = ICON.cam; st.textContent = def.required ? "Obligatoria" : ""; }
      del.hidden = !local;
      $('[data-act="cam"]', wrap).innerHTML = `${ICON.cam} ${local || ex ? "Repetir foto" : "Hacer foto"}`;
    }
    async function take(file) {
      if (!file) return;
      busy(true, "Procesando foto…");
      try {
        const blob = await PHOTOS.compress(file);
        const ph = { id: rec.localId + ":" + def.name, recordId: rec.localId, field: def.name, blob, fileName: `${def.name}_${stamp()}.jpg`, uploaded: false, createdAt: Date.now() };
        await DB.put("photos", ph);
        state.localPhotos[def.name] = ph;
        if (state.photoUrls[def.name]) URL.revokeObjectURL(state.photoUrls[def.name]);
        state.photoUrls[def.name] = URL.createObjectURL(blob);
        const ex = rec.existingPhotos && rec.existingPhotos[def.name];
        if (ex && !rec.attachDeletes.includes(ex.id)) rec.attachDeletes.push(ex.id);
        paint(); changed();
      } catch (e) { toast("No se pudo leer la foto: " + e.message, "error"); }
      finally { busy(false); }
    }
    $$("input[type=file]", wrap).forEach((inp) => inp.addEventListener("change", () => { take(inp.files[0]); inp.value = ""; }));
    $('[data-act="cam"]', wrap).addEventListener("click", () => $('[data-in="cam"]', wrap).click());
    $('[data-act="gal"]', wrap).addEventListener("click", () => $('[data-in="gal"]', wrap).click());
    del.addEventListener("click", async () => {
      await DB.del("photos", rec.localId + ":" + def.name);
      URL.revokeObjectURL(state.photoUrls[def.name]); delete state.photoUrls[def.name]; delete state.localPhotos[def.name];
      const ex = rec.existingPhotos && rec.existingPhotos[def.name];
      if (ex) rec.attachDeletes = rec.attachDeletes.filter((x) => x !== ex.id);
      paint(); changed();
    });
    paint();
    return wrap;
  }

  /* ---------- Ubicación ---------- */
  function currentBasemap() { const id = ls.get("inventario-basemap") || CFG.defaultBasemap; return BASEMAPS.find((b) => b.id === id) || BASEMAPS[0]; }

  function renderGeo() {
    const rec = state.rec;
    const wrap = h(`<div>
      <div class="geo-map"><div class="bm-ctl"><button type="button" class="bm-btn">${ICON.layers}<span></span></button><div class="bm-menu" hidden></div></div></div>
      <div class="geo-bar"><span class="geo-coords">Sin ubicación</span><span class="acc">GPS buscando…</span></div>
      <div class="geo-actions">
        <button type="button" class="btn btn-dark" data-act="gps">${ICON.gps} Usar GPS</button>
        <button type="button" class="btn btn-ghost" data-act="center">Ir al punto</button>
      </div>
      <div class="geo-tip">Toca el mapa o arrastra el marcador para colocar el punto a mano.</div>
    </div>`);
    const mapDiv = $(".geo-map", wrap);
    setTimeout(() => {
      const center = rec.location ? [rec.location.lat, rec.location.lon] : CFG.mapCenter;
      const map = L.map(mapDiv, { zoomControl: true, attributionControl: true, maxZoom: 21 }).setView(center, rec.location ? 18 : CFG.mapZoom);
      state.map = map;
      let bmLayers = [];
      const setBasemap = (bm) => {
        bmLayers.forEach((l) => map.removeLayer(l));
        bmLayers = bm.layers.map((o) => L.tileLayer(o.url, { maxZoom: 21, maxNativeZoom: o.maxNativeZoom, minZoom: o.minZoom || 0, attribution: o.attribution, ...(o.maxZoom ? { maxZoom: o.maxZoom } : {}) }).addTo(map));
        $(".bm-btn span", wrap).textContent = bm.label;
        ls.set("inventario-basemap", bm.id);
        renderBmMenu();
      };
      const menu = $(".bm-menu", wrap);
      const renderBmMenu = () => {
        const cur = currentBasemap();
        menu.innerHTML = BASEMAPS.map((b) => `<button type="button" class="bm-item ${b.id === cur.id ? "on" : ""}" data-id="${b.id}"><b>${esc(b.label)}</b><span>${esc(b.desc)}</span></button>`).join("");
        $$(".bm-item", menu).forEach((x) => x.addEventListener("click", (e) => { e.stopPropagation(); setBasemap(BASEMAPS.find((b) => b.id === x.dataset.id)); menu.hidden = true; }));
      };
      $(".bm-btn", wrap).addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
      L.DomEvent.disableClickPropagation($(".bm-ctl", wrap));
      setBasemap(currentBasemap());
      map.on("click", (e) => { menu.hidden = true; setLocation(e.latlng.lat, e.latlng.lng, null, true); });
      paintLocation();
      map.invalidateSize();
    }, 0);

    function setLocation(lat, lon, acc, manual) {
      rec.location = { lat: +lat.toFixed(7), lon: +lon.toFixed(7), acc: acc === null || acc === undefined ? null : Math.round(acc * 10) / 10, manual: !!manual, t: Date.now() };
      paintLocation(); changed();
      const q = wrap.closest(".q"); if (q) q.classList.remove("invalid");
    }
    function paintLocation() {
      const loc = rec.location, map = state.map;
      const coords = $(".geo-coords", wrap);
      if (!loc) { coords.textContent = "Sin ubicación"; }
      else coords.innerHTML = `${esc(GEO.latlonText(loc.lat, loc.lon))}<br>${esc(GEO.utmText(loc.lat, loc.lon))} · ${loc.manual ? "a mano" : "GPS ± " + fmt(loc.acc, 0) + " m"}`;
      if (!map) return;
      if (loc) {
        if (!state.marker || !map.hasLayer(state.marker)) {
          state.marker = L.marker([loc.lat, loc.lon], { draggable: true }).addTo(map);
          state.marker.on("dragend", () => { const p = state.marker.getLatLng(); setLocation(p.lat, p.lng, null, true); });
        } else state.marker.setLatLng([loc.lat, loc.lon]);
      }
    }
    function paintGps() {
      const g = state.gpsLast, accEl = $(".acc", wrap);
      if (!g) return;
      const good = g.acc <= CFG.gpsWarnAccuracy;
      accEl.className = "acc " + (good ? "good" : "bad");
      accEl.textContent = `GPS ± ${fmt(g.acc, 0)} m`;
      if (state.map) {
        if (!state.accCircle || !state.map.hasLayer(state.accCircle)) state.accCircle = L.circle([g.lat, g.lon], { radius: g.acc, color: "#77b72b", weight: 1.5, fillOpacity: .12, interactive: false }).addTo(state.map);
        else { state.accCircle.setLatLng([g.lat, g.lon]); state.accCircle.setRadius(g.acc); }
      }
      if (!rec.location && good) { setLocation(g.lat, g.lon, g.acc, false); if (state.map) state.map.setView([g.lat, g.lon], 18); }
    }
    $('[data-act="gps"]', wrap).addEventListener("click", () => {
      const g = state.gpsLast;
      if (!g) { toast("Aún no hay posición GPS. Espera unos segundos al aire libre.", "warn"); return; }
      if (g.acc > CFG.gpsWarnAccuracy) toast(`Precisión baja (± ${fmt(g.acc, 0)} m). Revisa el punto en el mapa.`, "warn");
      setLocation(g.lat, g.lon, g.acc, false);
      if (state.map) state.map.setView([g.lat, g.lon], 18);
    });
    $('[data-act="center"]', wrap).addEventListener("click", () => {
      const loc = rec.location || state.gpsLast;
      if (loc && state.map) state.map.setView([loc.lat, loc.lon], 18);
    });
    startGps(paintGps);
    return wrap;
  }

  function startGps(onFix) {
    stopGps();
    if (!navigator.geolocation) return;
    state.gpsWatch = navigator.geolocation.watchPosition((p) => {
      state.gpsLast = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, t: p.timestamp };
      onFix();
    }, (err) => {
      const acc = $(".acc"); if (acc) { acc.className = "acc bad"; acc.textContent = err.code === 1 ? "GPS sin permiso" : "GPS no disponible"; }
    }, { enableHighAccuracy: true, maximumAge: CFG.gpsMaxAge, timeout: 30000 });
  }
  function stopGps() { if (state.gpsWatch !== null && navigator.geolocation) navigator.geolocation.clearWatch(state.gpsWatch); state.gpsWatch = null; state.marker = null; state.accCircle = null; }

  /* ---------- Repeats (tablas relacionadas) ---------- */
  function rowTitle(rep, row, i) {
    if (rep.name === "InventarioTrees") {
      const sp = speciesText("list_espec_tree", row.EspecTree, row.otra_tree) || "Sin especie";
      const parts = [row.DiamNomMed ? "Ø " + choiceLabel("list_DNM", row.DiamNomMed) + " cm" : "", row.NPies !== null && row.NPies !== undefined ? row.NPies + " pies" : "", row.DensityTree !== null && row.DensityTree !== undefined ? fmt(row.DensityTree, 0) + " pies/ha" : ""].filter(Boolean);
      return { t: `${i + 1}. ${sp}`, s: parts.join(" · ") };
    }
    const sp = speciesText("list_espec_bush", row.EspecBush, row.otra_bush) || "Sin especie";
    const parts = [row.FCC !== null && row.FCC !== undefined ? "FCC " + row.FCC + " %" : "", row.HM ? "H " + fmt(row.HM, 1) + " m" : ""].filter(Boolean);
    return { t: `${i + 1}. ${sp}`, s: parts.join(" · ") };
  }

  function renderRepeat(rep) {
    const rec = state.rec;
    const rows = rec.data[rep.name] = rec.data[rep.name] || [];
    const T = state.schema && state.schema.repeats && state.schema.repeats[rep.name];
    const det = h(`<details class="rep" ${rows.length || rep.name === "InventarioTrees" ? "open" : ""}>
      <summary>${ICON.chev}<span>${esc(rep.title)}</span><span class="count"></span></summary>
      <div class="rep-body"><div class="rows"></div>
        <button type="button" class="btn btn-ghost btn-block" data-act="add">${ICON.plus} Añadir ${esc(rep.itemLabel.toLowerCase())}</button>
      </div></details>`);
    const cont = $(".rows", det);
    state.rowHeads = state.rowHeads || [];
    const paintCount = () => { $(".count", det).textContent = rows.length ? `${rows.length} registro${rows.length > 1 ? "s" : ""}` : "Ninguno"; };
    const drawRows = (openIdx) => {
      cont.innerHTML = "";
      state.calcNodes = state.calcNodes.filter((n) => !rows.includes(n.values));
      state.relNodes = state.relNodes.filter((n) => !rows.includes(n.values));
      rows.forEach((row, i) => {
        const card = h(`<div class="row-card ${i === openIdx ? "" : "collapsed"}">
          <div class="row-head"><div class="t"><b></b><span></span></div>
            <button type="button" class="icon-btn" data-act="toggle" title="Mostrar/ocultar">${i === openIdx ? ICON.up : ICON.down}</button>
            <button type="button" class="icon-btn" data-act="del" title="Quitar">${ICON.trash}</button>
          </div><div class="row-body"></div></div>`);
        const paintHead = () => { const t = rowTitle(rep, row, i); $(".t b", card).textContent = t.t; $(".t span", card).textContent = t.s || (row._oid ? "En el servidor" : "Nueva"); };
        state.rowHeads.push(paintHead);
        paintHead();
        const rb = $(".row-body", card);
        rep.fields.forEach((def) => rb.appendChild(renderField(def, row, rep)));
        $('[data-act="toggle"]', card).addEventListener("click", () => {
          const col = card.classList.toggle("collapsed");
          $('[data-act="toggle"]', card).innerHTML = col ? ICON.down : ICON.up;
        });
        $('[data-act="del"]', card).addEventListener("click", async () => {
          if (row._oid && T && !T.canDelete) { toast("El servidor no permite borrar filas ya enviadas.", "warn"); return; }
          if (!(await confirmBox("Quitar " + rep.itemLabel.toLowerCase(), `Se quitará «${esc(rowTitle(rep, row, i).t)}».`, "Quitar", "btn-danger"))) return;
          if (row._oid) { rec.deletedRows[rep.name] = rec.deletedRows[rep.name] || []; rec.deletedRows[rep.name].push({ oid: row._oid, gid: row._gid }); }
          rows.splice(i, 1);
          state.rowHeads = [];
          drawAll();
          changed();
        });
        cont.appendChild(card);
      });
      paintCount();
      refreshDerived();
    };
    det._draw = drawRows;
    $('[data-act="add"]', det).addEventListener("click", () => {
      rows.push({ _gid: AGOL.guid() });
      state.rowHeads = [];
      drawAll(rep.name, rows.length - 1);
      changed();
      setTimeout(() => { const cards = $$(".row-card", cont); const last = cards[cards.length - 1]; if (last) last.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
    });
    det.dataset.rep = rep.name;
    drawRows(rows.length === 1 ? 0 : -1);
    return det;
  }
  function drawAll(repName, openIdx) {
    $$("details.rep").forEach((d) => d._draw(d.dataset.rep === repName ? openIdx : -1));
  }

  /* ------------------------------------------------------------------
     7. Revisión y envío
     ------------------------------------------------------------------ */
  function hasPhoto(field) {
    const rec = state.rec;
    const lp = state.localPhotos && state.localPhotos[field];
    return !!((lp && (lp.blob || lp.uploaded)) || (rec.existingPhotos && rec.existingPhotos[field]));
  }
  function issues() {
    const rec = state.rec, out = [];
    PAGES.forEach((p, pi) => {
      (p.fields || []).forEach((d) => {
        if (d.required) {
          if (d.type === "geopoint" && !rec.location) out.push({ page: pi, name: d.name, msg: `${d.label}: falta` });
          else if (d.type === "image" && !hasPhoto(d.name)) out.push({ page: pi, name: d.name, msg: `${d.label}: falta` });
          else if (!["geopoint", "image"].includes(d.type) && (rec.data[d.name] === null || rec.data[d.name] === undefined || rec.data[d.name] === "")) out.push({ page: pi, name: d.name, msg: `${d.label}: falta` });
        }
        const r = CALC.rangeIssue(d.name, rec.data[d.name]);
        if (r && r.hard) out.push({ page: pi, name: d.name, msg: r.msg });
      });
      (p.repeats || []).forEach((rep) => (rec.data[rep.name] || []).forEach((row, i) => rep.fields.forEach((d) => {
        const r = CALC.rangeIssue(d.name, row[d.name]);
        if (r && r.hard) out.push({ page: pi, name: d.name, msg: `${rep.itemLabel} ${i + 1}: ${r.msg}` });
      })));
    });
    return out;
  }
  function pagesWithIssues() { return new Set(state.rec ? issues().map((x) => x.page) : []); }

  function renderReview(body) {
    const rec = state.rec, d = rec.data;
    CALC.apply(d);
    const sm = CALC.summary(d);
    const iss = issues();
    const loc = rec.location;
    const u = loc ? GEO.toUTM(loc.lat, loc.lon) : null;

    if (iss.length) {
      const box = h(`<div class="alert err"><div><b>No se puede enviar todavía:</b><ul style="margin:6px 0 0;padding-left:18px">${iss.map((x, i) => `<li><button class="link" data-i="${i}" style="padding:2px 0">${esc(x.msg)}</button></li>`).join("")}</ul></div></div>`);
      $$("[data-i]", box).forEach((b) => b.addEventListener("click", () => gotoIssue(iss[Number(b.dataset.i)])));
      body.appendChild(box);
    } else body.appendChild(h(`<div class="alert ok"><b>Listo para ${rec.kind === "update" ? "guardar los cambios" : "enviar"}.</b>&nbsp;${navigator.onLine ? "" : "Sin cobertura: quedará en el móvil y se enviará solo."}</div>`));
    sm.warnings.forEach((w) => body.appendChild(h(`<div class="alert warn">${esc(w)}</div>`)));

    body.appendChild(h(`<div class="rv"><h4>Métricas calculadas</h4><div class="metrics">
      <div class="metric"><b>${fmt(sm.supM2, 1)}</b><span>Superficie parcela (m²)</span></div>
      <div class="metric"><b>${fmt(sm.supHa, 4)}</b><span>Superficie (ha)</span></div>
      <div class="metric"><b>${fmt(d.Density, 1)}</b><span>Densidad (pies/ha)</span></div>
      <div class="metric"><b>${sm.sumPies}</b><span>Σ pies por especie</span></div>
    </div></div>`));

    const kv = (pairs) => `<dl class="kv">${pairs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v === "" || v === null || v === undefined ? "—" : esc(v)}</dd>`).join("")}</dl>`;
    const sec = (title, pi, inner) => { const el = h(`<div class="rv"><h4>${esc(title)} <button class="link" data-p="${pi}">Editar</button></h4>${inner}</div>`); $("[data-p]", el).addEventListener("click", () => goPage(pi)); return el; };
    body.appendChild(sec("Datos generales", 0, kv([
      ["Monte", d.ForestName], ["Código del rodal", d.Cod_Rodal], ["Tamaño del rodal", d.Size_Rodal === null || d.Size_Rodal === undefined ? "" : fmt(d.Size_Rodal, 2) + " ha"],
      ["Parcela", d.ID_Parcela], ["Pendiente", d.Slp_Parcela === null || d.Slp_Parcela === undefined ? "" : fmt(d.Slp_Parcela, 1) + " %"],
      ["Ubicación", loc ? `${GEO.latlonText(loc.lat, loc.lon)} · UTM ${u.zone}N ${fmt(u.x, 0)} / ${fmt(u.y, 0)}` : ""],
      ["Origen del punto", loc ? (loc.manual ? "Colocado a mano" : `GPS ± ${fmt(loc.acc, 0)} m`) : ""]
    ])));
    const thumbs = PHOTO_FIELDS.map((f) => {
      const url = state.photoUrls[f.name] || state.serverPhotoUrls[f.name] || "";
      return `<div style="${url ? `background-image:url('${url}')` : ""}"><small>${esc(f.label)}${hasPhoto(f.name) ? "" : " ✗"}</small></div>`;
    }).join("");
    body.appendChild(sec("Caracterización", 1, `<div class="thumbs" style="margin-bottom:10px">${thumbs}</div>` + kv([
      ["Afloramientos", choiceLabel("list_afloramientos", d.Afloramiento)], ["Pedregosidad", choiceLabel("list_pedregosidad", d.Pedregosidad)],
      ["Radio", d.Radio === null || d.Radio === undefined ? "" : fmt(d.Radio, 2) + " m"], ["Nº árboles", d.Ntrees], ["Observaciones", d.Observaciones]
    ])));
    const trees = d.InventarioTrees || [], bushes = d.InventarioGrass || [];
    body.appendChild(sec("Estrato arbóreo", 2, trees.length ? `<table class="tb"><tr><th>Especie</th><th>Ø (cm)</th><th class="n">H (m)</th><th class="n">Pies</th><th class="n">Pies/ha</th></tr>${trees.map((r) => `<tr><td>${esc(speciesText("list_espec_tree", r.EspecTree, r.otra_tree) || "—")}</td><td>${esc(choiceLabel("list_DNM", r.DiamNomMed))}</td><td class="n">${fmt(r.Altura, 1)}</td><td class="n">${r.NPies === null || r.NPies === undefined ? "—" : r.NPies}</td><td class="n">${fmt(r.DensityTree, 0)}</td></tr>`).join("")}</table>` : `<p class="note">Sin especies arbóreas.</p>`));
    body.appendChild(sec("Estrato arbustivo", 2, bushes.length ? `<table class="tb"><tr><th>Especie</th><th>Ø basal</th><th class="n">FCC %</th><th class="n">H (m)</th></tr>${bushes.map((r) => `<tr><td>${esc(speciesText("list_espec_bush", r.EspecBush, r.otra_bush) || "—")}</td><td>${esc([].concat(r.DiamBasalMed || []).map((x) => choiceLabel("list_DBM", x)).join(", "))}</td><td class="n">${r.FCC === null || r.FCC === undefined ? "—" : r.FCC}</td><td class="n">${fmt(r.HM, 1)}</td></tr>`).join("")}</table>` : `<p class="note">Sin especies arbustivas.</p>`));
  }

  function gotoIssue(x) {
    goPage(x.page);
    setTimeout(() => {
      const q = $(`[data-q="${x.name}"]`);
      if (q) { q.classList.add("invalid"); q.scrollIntoView({ behavior: "smooth", block: "center" }); }
    }, 80);
  }

  async function submitRecord() {
    const rec = state.rec;
    const iss = issues();
    if (iss.length) { gotoIssue(iss[0]); toast(iss[0].msg, "warn"); return; }
    if (rec.kind === "update" && !canEdit()) { toast(editBlockReason(), "error", 7000); return; }
    CALC.apply(rec.data);
    rec.status = "pending"; rec.attempts = rec.kind === "update" ? 0 : (rec.attempts || 0); rec.rowsDone = false; rec.lastError = null;
    await saveNow();
    state.rec = null;
    showView("vHome"); await renderHome();
    toast(navigator.onLine ? "Guardado. Enviando a ArcGIS Online…" : "Guardado en el móvil. Se enviará al recuperar cobertura.", "ok");
    requestBackgroundSync();
    trySync();
  }

  async function showSummary(r) {
    const d = r.data; CALC.apply(d);
    const sm = CALC.summary(d);
    const loc = r.location;
    openModal(FORM.TITLE(d), `<dl class="kv">
      <dt>Estado</dt><dd>${STATUS_TXT[r.status]} · ${fmtDate(r.sentAt || r.updatedAt)}</dd>
      <dt>Ubicación</dt><dd>${loc ? esc(GEO.latlonText(loc.lat, loc.lon)) + "<br>" + esc(GEO.utmText(loc.lat, loc.lon)) : "—"}</dd>
      <dt>Superficie</dt><dd>${fmt(sm.supM2, 1)} m² · ${fmt(sm.supHa, 4)} ha</dd>
      <dt>Densidad</dt><dd>${fmt(d.Density, 1)} pies/ha</dd>
      <dt>Especies</dt><dd>${sm.nSpeciesTree} arbóreas · ${sm.nSpeciesBush} arbustivas</dd>
      <dt>ObjectID</dt><dd>${r.objectId || "—"}</dd>
      </dl>`, [{ label: "Cerrar" }]);
  }

  /* ------------------------------------------------------------------
     8. Edición de registros del servidor
     ------------------------------------------------------------------ */
  function ownWhere(P) {
    const f = CFG.operatorField && P.byName[CFG.operatorField.toLowerCase()];
    if (CFG.onlyOwnRecords && f) return `${f.name} = '${String(state.session.fullName || state.session.user).replace(/'/g, "''")}'`;
    return "1=1";
  }

  async function loadServerList() {
    if (!navigator.onLine) { toast("Necesitas cobertura para ver los registros del servidor.", "warn"); return; }
    busy(true, "Consultando ArcGIS Online…");
    try {
      const schema = await loadSchema(true);
      if (!canEdit()) { toast(editBlockReason(), "warn"); return; }
      const P = schema.point;
      const edf = P.editFieldsInfo || {};
      const dateF = (edf.editDateField && P.byName[edf.editDateField.toLowerCase()]) ? edf.editDateField : null;
      const outF = [P.oidField, P.gidField, "ForestName", "Cod_Rodal", "ID_Parcela", dateF].filter((x) => x && (P.byName[x.toLowerCase()] || x === P.oidField)).join(",");
      const res = await AGOL.query(P.url, { where: ownWhere(P), outFields: outF, returnGeometry: false, orderByFields: (dateF || P.oidField) + " DESC", resultRecordCount: CFG.serverListLimit }, state.session.apiKey);
      state.serverItems = (res.features || []).map((f) => f.attributes);
      const local = await projectRecords();
      const list = $("#serverList");
      if (!state.serverItems.length) { list.innerHTML = `<div class="empty">No hay registros en el servidor${ownWhere(P) !== "1=1" ? " a tu nombre" : ""}.</div>`; return; }
      list.innerHTML = "";
      state.serverItems.forEach((a) => {
        const oid = a[P.oidField];
        const pend = local.find((r) => r.kind === "update" && r.objectId === oid && r.status !== "sent");
        const el = h(`<div class="rec sent"><div class="rec-title">${esc(FORM.TITLE({ ForestName: a.ForestName, Cod_Rodal: a.Cod_Rodal, ID_Parcela: a.ID_Parcela }))}</div>
          <div class="rec-meta">OID ${oid}${dateF && a[dateF] ? " · " + fmtDate(a[dateF]) : ""}${pend ? ' · <span class="badge pending">Edición en el móvil</span>' : ""}</div>
          <div class="rec-actions"><button class="icon-btn" title="Editar">${ICON.edit}</button></div></div>`);
        $("button", el).addEventListener("click", () => editServerRecord(oid));
        list.appendChild(el);
      });
    } catch (e) { toast(e.message, "error", 7000); }
    finally { busy(false); }
  }

  async function editServerRecord(oid) {
    const local = (await projectRecords()).find((r) => r.kind === "update" && r.objectId === oid && r.status !== "sent");
    if (local) { if (local.status === "sending") { toast("Esa edición se está enviando.", "info"); return; } return openRecord(local); }
    if (!navigator.onLine) { toast("Necesitas cobertura para abrir un registro del servidor.", "warn"); return; }
    busy(true, "Descargando registro…");
    try {
      const schema = await loadSchema(true);
      if (!canEdit()) { toast(editBlockReason(), "warn"); return; }
      const P = schema.point, tok = state.session.apiKey;
      const q = await AGOL.query(P.url, { objectIds: oid, outFields: "*", returnGeometry: true, outSR: 4326 }, tok);
      const f = (q.features || [])[0];
      if (!f) throw new Error("El registro ya no existe en el servidor.");
      const rec = blankRecord();
      rec.kind = "update"; rec.objectId = oid;
      rec.globalId = f.attributes[P.gidField] || rec.globalId;
      rec.data = Object.assign(rec.data, AGOL.fromAttributes(f.attributes, P, ALL_FIELDS));
      if (f.geometry) rec.location = { lat: f.geometry.y, lon: f.geometry.x, acc: null, manual: true, fromServer: true };
      for (const rep of REPEATS) {
        const T = schema.repeats[rep.name];
        if (!T || !T.childKey) continue;
        const rq = await AGOL.query(T.url, { where: `${T.childKey} = '${rec.globalId}'`, outFields: "*", returnGeometry: false, orderByFields: T.oidField }, tok);
        rec.data[rep.name] = (rq.features || []).map((x) => Object.assign({ _oid: x.attributes[T.oidField], _gid: x.attributes[T.gidField] }, AGOL.fromAttributes(x.attributes, T, rep.fields)));
      }
      if (P.hasAttachments) {
        const at = await AGOL.queryAttachments(P.url, [oid], tok);
        const infos = ((at.attachmentGroups || [])[0] || {}).attachmentInfos || [];
        PHOTO_FIELDS.forEach((pf) => {
          const m = infos.filter((i) => (i.keywords || "") === pf.name || (!i.keywords && String(i.name || "").startsWith(pf.name))).pop();
          if (m) rec.existingPhotos[pf.name] = { id: m.id, name: m.name };
        });
      }
      await DB.put("records", rec);
      openForm(rec, 0);
    } catch (e) { toast(e.message, "error", 7000); }
    finally { busy(false); }
  }

  /* ------------------------------------------------------------------
     9. Exportar a Excel
     ------------------------------------------------------------------ */
  function loadXlsx() {
    if (self.XLSX) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = "vendor/xlsx.mini.min.js"; s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar el exportador")); document.head.appendChild(s); });
  }

  async function exportDialog() {
    const recs = await projectRecords();
    const body = h(`<div>
      <p>Genera un Excel con tres hojas: <b>Parcelas</b> (con superficie y densidades calculadas), <b>Especies arbóreas</b> y <b>Especies arbustivas</b>.</p>
      <label class="chk-inline"><input type="checkbox" id="exLocal" checked> Registros de este móvil (${recs.length})</label>
      <label class="chk-inline"><input type="checkbox" id="exDrafts"> Incluir borradores</label>
      <label class="chk-inline"><input type="checkbox" id="exServer" ${navigator.onLine && state.schema && state.schema.point.canQuery ? "" : "disabled"}> Registros del servidor${CFG.onlyOwnRecords ? " (los míos)" : ""}${navigator.onLine ? "" : " · requiere cobertura"}</label>
    </div>`);
    openModal("Exportar a Excel", body, [
      { label: "Cancelar" },
      { label: "Descargar Excel", cls: "btn-primary", onClick: async (close) => {
        const opt = { local: $("#exLocal").checked, drafts: $("#exDrafts").checked, server: $("#exServer").checked };
        close();
        busy(true, "Preparando Excel…");
        try { await exportExcel(opt); } catch (e) { toast(e.message, "error", 7000); } finally { busy(false); }
      } }
    ]);
  }

  async function fetchServerRecords() {
    const schema = await loadSchema(true);
    const P = schema.point, tok = state.session.apiKey;
    const out = [];
    let offset = 0;
    for (;;) {
      const q = await AGOL.query(P.url, { where: ownWhere(P), outFields: "*", returnGeometry: true, outSR: 4326, orderByFields: P.oidField, resultOffset: offset, resultRecordCount: P.maxRecordCount }, tok);
      (q.features || []).forEach((f) => out.push({
        origin: "Servidor", status: "sent", globalId: String(f.attributes[P.gidField] || "").toUpperCase(), objectId: f.attributes[P.oidField],
        sentAt: f.attributes[(P.editFieldsInfo || {}).creationDateField] || null,
        operator: CFG.operatorField ? f.attributes[(P.byName[CFG.operatorField.toLowerCase()] || {}).name] : null,
        location: f.geometry ? { lat: f.geometry.y, lon: f.geometry.x, acc: CFG.accuracyField ? f.attributes[(P.byName[CFG.accuracyField.toLowerCase()] || {}).name] : null } : null,
        data: Object.assign({}, AGOL.fromAttributes(f.attributes, P, ALL_FIELDS), Object.fromEntries(REPEATS.map((r) => [r.name, []])))
      }));
      if (!q.exceededTransferLimit || !(q.features || []).length) break;
      offset += q.features.length;
    }
    const byGid = {}; out.forEach((r) => { byGid[r.globalId] = r; });
    for (const rep of REPEATS) {
      const T = schema.repeats[rep.name];
      if (!T || !T.childKey) continue;
      const gids = Object.keys(byGid);
      for (let i = 0; i < gids.length; i += 150) {
        const chunk = gids.slice(i, i + 150);
        const q = await AGOL.query(T.url, { where: `${T.childKey} IN (${chunk.map((g) => "'" + g + "'").join(",")})`, outFields: "*", returnGeometry: false }, tok);
        (q.features || []).forEach((f) => {
          const parent = byGid[String(f.attributes[T.childKey] || "").toUpperCase()];
          if (parent) parent.data[rep.name].push(AGOL.fromAttributes(f.attributes, T, rep.fields));
        });
      }
    }
    return out;
  }

  async function exportExcel(opt) {
    await loadXlsx();
    let list = [];
    const byGid = {};
    if (opt.local) {
      // Una fila por parcela: si hay alta y ediciones de la misma parcela, manda la más reciente.
      (await projectRecords()).filter((r) => opt.drafts || r.status !== "draft").sort((a, b) => a.updatedAt - b.updatedAt).forEach((r) => {
        const item = { origin: "Móvil", status: r.status, globalId: String(r.globalId).toUpperCase(), objectId: r.objectId, sentAt: r.sentAt || r.updatedAt, operator: state.session ? state.session.fullName : "", location: r.location, data: JSON.parse(JSON.stringify(r.data)) };
        if (r.kind === "update" && r.status !== "sent") item.status = "edición " + r.status;
        if (byGid[item.globalId]) list = list.filter((x) => x !== byGid[item.globalId]);
        list.push(item); byGid[item.globalId] = item;
      });
    }
    if (opt.server) {
      const srv = await fetchServerRecords();
      srv.forEach((s) => {
        const loc = byGid[s.globalId];
        if (loc && loc.status !== "sent") return;        // edición del móvil aún sin enviar: es más reciente
        if (loc) list = list.filter((x) => x !== loc);   // enviada: manda la del servidor
        list.push(s);
      });
    }
    if (!list.length) { toast("No hay registros que exportar.", "warn"); return; }

    const n = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
    const parcelas = [], arb = [], arbu = [];
    list.forEach((r) => {
      const d = r.data; CALC.apply(d);
      const sm = CALC.summary(d);
      const u = r.location ? GEO.toUTM(r.location.lat, r.location.lon) : null;
      parcelas.push({
        "Origen": r.origin, "Estado": STATUS_TXT[r.status] || r.status, "Fecha": r.sentAt ? new Date(r.sentAt) : null, "Operario": r.operator || "",
        "Monte": d.ForestName || "", "Código rodal": d.Cod_Rodal || "", "Tamaño rodal (ha)": n(d.Size_Rodal), "ID parcela": d.ID_Parcela || "",
        "Pendiente (%)": n(d.Slp_Parcela), "Latitud": r.location ? r.location.lat : null, "Longitud": r.location ? r.location.lon : null,
        "Huso UTM": u ? u.zone : null, "UTM X (ETRS89)": u ? Math.round(u.x * 10) / 10 : null, "UTM Y (ETRS89)": u ? Math.round(u.y * 10) / 10 : null,
        "Precisión GPS (m)": r.location && !r.location.manual ? n(r.location.acc) : null, "Punto a mano": r.location ? (r.location.manual ? "Sí" : "No") : "",
        "Afloramientos": choiceLabel("list_afloramientos", d.Afloramiento), "Pedregosidad": choiceLabel("list_pedregosidad", d.Pedregosidad),
        "Radio (m)": n(d.Radio), "Nº árboles": n(d.Ntrees), "Superficie (m²)": sm.supM2 === null ? null : Math.round(sm.supM2 * 100) / 100, "Superficie (ha)": d.Sup,
        "Densidad (pies/ha)": d.Density, "Σ pies especies": sm.sumPies, "Nº especies arbóreas": sm.nSpeciesTree, "Nº especies arbustivas": sm.nSpeciesBush,
        "FCC matorral total (%)": sm.fccTotal, "Avisos": sm.warnings.join(" | "), "Observaciones": d.Observaciones || "", "ObjectID": r.objectId || null, "GlobalID": r.globalId
      });
      const base = { "GlobalID parcela": r.globalId, "Monte": d.ForestName || "", "Código rodal": d.Cod_Rodal || "", "ID parcela": d.ID_Parcela || "" };
      (d.InventarioTrees || []).forEach((t) => arb.push(Object.assign({}, base, {
        "Especie": t.EspecTree === "otro" ? (t.otra_tree || "Otra") : String(t.EspecTree || "").replace(/_/g, " "), "Nombre científico": t.EspecTree === "otro" ? "" : choiceLabel("list_espec_tree", t.EspecTree),
        "Diámetro nominal medio (cm)": choiceLabel("list_DNM", t.DiamNomMed), "Altura (m)": n(t.Altura), "Nº pies": n(t.NPies), "Densidad especie (pies/ha)": t.DensityTree,
        "% pies parcela": sm.sumPies && n(t.NPies) !== null ? Math.round(n(t.NPies) / sm.sumPies * 1000) / 10 : null,
        "Propuesta de corta": choiceLabel("list_corta", t.Corta), "Propuesta de poda": choiceLabel("list_poda", t.Poda), "Observaciones": t.Observ_Tree || ""
      })));
      (d.InventarioGrass || []).forEach((b) => arbu.push(Object.assign({}, base, {
        "Especie": b.EspecBush === "otro" ? (b.otra_bush || "Otra") : b.EspecBush || "", "Nombre": b.EspecBush === "otro" ? "" : choiceLabel("list_espec_bush", b.EspecBush),
        "Diámetro basal medio (cm)": [].concat(b.DiamBasalMed || []).map((x) => choiceLabel("list_DBM", x)).join(", "), "FCC (%)": n(b.FCC), "Altura media (m)": n(b.HM),
        "Propuesta de roza": choiceLabel("list_roza", b.Roza), "Pies menores": choiceLabel("list_piesmenores", b.Pies_Menores), "Observaciones": b.Observ_Bush || ""
      })));
    });
    const wb = XLSX.utils.book_new();
    const add = (rows, name) => {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Sin datos": "" }], { cellDates: true });
      const keys = Object.keys(rows[0] || { x: 1 });
      ws["!cols"] = keys.map((k) => ({ wch: Math.min(40, Math.max(10, k.length + 2, ...rows.slice(0, 200).map((r) => String(r[k] === null || r[k] === undefined ? "" : r[k]).length))) }));
      XLSX.utils.book_append_sheet(wb, ws, name);
    };
    add(parcelas, "Parcelas"); add(arb, "Especies arbóreas"); add(arbu, "Especies arbustivas");
    XLSX.writeFile(wb, `Inventario_de_Campo_${stamp()}.xlsx`, { compression: true });
    toast(`Excel generado: ${parcelas.length} parcelas`, "ok");
  }

  /* ------------------------------------------------------------------
     10. Sesión, diagnóstico y ayuda
     ------------------------------------------------------------------ */
  /* ---------- Ajustes (igual que la app de instalaciones) ---------- */
  $("#btnSettings").addEventListener("click", () => openSettings());
  $("#btnSettingsBack").addEventListener("click", () => { showView("vHome"); renderHome(); updateNet(); });
  $("#btnKeyEye").addEventListener("click", () => { const i = $("#setKey"); i.type = i.type === "password" ? "text" : "password"; });
  $("#setOperator").addEventListener("change", async () => {
    await AUTH.setOperator($("#setOperator").value);
    state.session = await AUTH.getSession();
    toast("Nombre guardado", "ok", 2500);
  });
  $("#btnClearSent").addEventListener("click", async () => {
    const sent = (await projectRecords()).filter((r) => r.status === "sent");
    if (!sent.length) { toast("No hay registros enviados en el móvil.", "info"); return; }
    if (!(await confirmBox("Borrar enviados", `Se quitarán del móvil ${sent.length} registro(s) ya enviados. En ArcGIS Online no se borra nada.`, "Borrar", "btn-danger"))) return;
    for (const r of sent) await DB.deleteRecord(r.localId);
    renderStats();
  });
  $("#btnTest").addEventListener("click", testConnection);

  async function openSettings() {
    const st = await AUTH.settings();
    $("#setKey").value = st.token || "";
    $("#setKey").type = "password";
    $("#setUrl").value = st.serviceUrl;
    $("#setOperator").value = st.operator;
    showView("vSettings");
    $("#vSettings").scrollTop = 0;
    renderStats();
    if (state.schema) renderDiag(state.schema, null, true);
    else $("#diag").innerHTML = st.problem ? `<p class="ko">${esc(st.problem.reason)}</p>` : "";
  }

  async function testConnection() {
    const key = AUTH.clean($("#setKey").value);
    const url = $("#setUrl").value;
    await AUTH.saveSettings(key, url);
    $("#setUrl").value = AUTH.serviceUrl();
    state.session = await AUTH.getSession();
    state.schema = null; state.schemaError = null;
    const diag = $("#diag");
    updateNet();
    if (!key) { diag.innerHTML = `<p class="ko">Escribe la clave de acceso.</p>`; renderTokenBanner(); return; }
    if (!navigator.onLine) { diag.innerHTML = `<p class="wn">Guardada. Sin conexión: se probará al enviar.</p>`; renderTokenBanner(); return; }
    diag.innerHTML = "<p>Comprobando…</p>";
    try {
      state.schema = await SYNC.getSchema(state.session, true);
      renderDiag(state.schema, null, false);
      renderEditAvailability();
      await renderTokenBanner();
      trySync(true);
    } catch (e) {
      state.schemaError = e;
      const msg = e.kind === "auth" ? "La clave no es válida, ha caducado o no tiene acceso a esta capa. (" + e.message + ")"
        : e.kind === "network" ? "Sin conexión con ArcGIS Online." : e.message;
      diag.innerHTML = `<p class="ko">${esc(msg)}</p>`;
      if (e.kind === "auth") {
        await AUTH.invalidate(e.message); renderTokenBanner(); updateNet();
        // ¿La clave vale en ArcGIS Online aunque esta capa la rechace?
        try {
          const me = await AGOL.request("https://www.arcgis.com/sharing/rest/portals/self", { token: key }, 15000);
          if (me && (me.id || me.name)) diag.insertAdjacentHTML("beforeend", `<p class="wn">La clave sí es válida en ArcGIS Online (${esc(me.name || me.urlKey || "")}), pero esta capa la rechaza: revisa en la credencial «Acceso a elementos» y «Referentes permitidos».</p>`);
        } catch (e2) {
          if (e2.kind === "auth") diag.insertAdjacentHTML("beforeend", `<p class="wn">ArcGIS Online no reconoce esta clave en ningún servicio: está caducada, revocada o mal copiada (${key.length} caracteres).</p>`);
        }
      }
    }
  }

  function renderDiag(sc, err, cached) {
    const P = sc.point;
    const dataFields = ALL_FIELDS.filter((d) => !["image", "geopoint"].includes(d.type));
    const matched = dataFields.filter((d) => P.byName[d.name.toLowerCase()]);
    const missing = dataFields.filter((d) => !P.byName[d.name.toLowerCase()]).map((d) => d.name);
    let rowTotal = 0, rowOk = 0;
    REPEATS.forEach((rep) => { const T = sc.repeats[rep.name]; rep.fields.filter((d) => d.type !== "image").forEach((d) => { rowTotal++; if (T && T.byName[d.name.toLowerCase()]) rowOk++; else missing.push(rep.name + "." + d.name); }); });
    const yes = (b, t1, t2) => `<dd class="${b ? "ok" : "ko"}">${esc(b ? t1 || "Sí" : t2 || "No")}</dd>`;
    const tables = REPEATS.map((r) => r.title + ": " + (sc.repeats[r.name] ? "sí" : "NO")).join(" · ");
    const total = dataFields.length + rowTotal, ok = matched.length + rowOk;
    $("#diag").innerHTML = `<dl class="kv">
      <dt>Capa</dt><dd>${esc(P.name)}${cached ? " (última comprobación)" : ""}</dd>
      <dt>Geometría</dt>${yes(/Point/.test(P.geometryType || ""), "Puntos", P.geometryType)}
      <dt>Crear registros</dt>${yes(P.canCreate)}
      <dt>Editar registros</dt>${!CFG.allowEdit ? `<dd class="wn">Desactivado en la configuración de la app</dd>` : yes(P.canUpdate, "Activado (la capa permite Update)", "Desactivado en AGOL")}
      <dt>Adjuntos (fotos)</dt>${yes(P.hasAttachments, "Habilitados", "Deshabilitados: las fotos no se podrán subir")}
      <dt>Altas sin duplicados</dt>${yes(P.supportsGlobalIds && !!P.gidField, "Sí (GlobalID)", "No: un corte a mitad de envío podría duplicar")}
      <dt>Tablas de especies</dt><dd class="${REPEATS.every((r) => sc.repeats[r.name]) ? "ok" : "ko"}">${esc(tables)}</dd>
      <dt>Campos</dt><dd class="${missing.length ? "wn" : "ok"}">${ok} de ${total} campos del formulario existen en la capa</dd>
      <dt>Operario</dt><dd class="${P.byName[(CFG.operatorField || "").toLowerCase()] ? "ok" : "wn"}">${P.byName[(CFG.operatorField || "").toLowerCase()] ? "Sí" : "No existe en la capa (el nombre no se guardará)"}</dd>
    </dl>${missing.length ? `<details><summary>No existen en la capa (no se guardarán): ${missing.length}</summary><p class="diag-list">${esc(missing.join(", "))}</p></details>` : ""}`;
  }

  async function renderStats() {
    const recs = await projectRecords();
    const by = (st) => recs.filter((r) => r.status === st).length;
    const use = await DB.usage();
    const photos = await DB.all("photos");
    const pend = photos.filter((p) => !p.uploaded && p.blob);
    $("#localStats").innerHTML = `
      <dt>Borradores</dt><dd>${by("draft")}</dd>
      <dt>Por enviar</dt><dd>${by("pending") + by("sending") + by("error")}</dd>
      <dt>Enviados</dt><dd>${by("sent")}</dd>
      <dt>Fotos sin subir</dt><dd>${pend.length} (${fmt(pend.reduce((a, p) => a + p.blob.size, 0) / 1048576, 1)} MB)</dd>
      <dt>Ocupado</dt><dd>${fmt(use.bytes / 1048576, 1)} MB en fotos</dd>`;
  }

  $("#btnHelp").addEventListener("click", () => openModal("Cómo se usa", `<div class="help">
    <h4>Acceso</h4>
    <ol><li>En <b>Ajustes</b> pega una vez la <b>clave de acceso</b> que te envió el administrador y pulsa <b>Guardar y probar</b>.</li>
    <li>Cuando caduque, la app avisará: pide una nueva y vuelve a guardarla en Ajustes. Lo que tengas sin enviar no se pierde.</li>
    <li>Instala la app: menú del navegador › <b>Añadir a pantalla de inicio</b>.</li></ol>
    <h4>Registrar una parcela</h4>
    <ol><li><b>Nueva parcela</b>. Rellena las páginas con <b>Siguiente</b>; todo se guarda solo como borrador.</li>
    <li><b>Ubicación</b>: el punto se fija solo cuando el GPS baja de ±${CFG.gpsWarnAccuracy} m. Si no, toca el mapa o arrastra el marcador.</li>
    <li><b>Fotos Norte y Sur</b>: obligatorias. Se guardan como adjuntos.</li>
    <li><b>Superficie y densidades</b> se calculan solas con el radio y el número de pies.</li>
    <li>En <b>Revisión</b> comprueba las métricas y avisos, y pulsa <b>Enviar</b>.</li></ol>
    <h4>Sin cobertura</h4>
    <p>Los registros quedan en el móvil como <b>Pendientes</b> y se envían solos al recuperar conexión (en Android incluso con la app cerrada). No borres los datos del navegador con registros pendientes.</p>
    <h4>Exportar</h4>
    <p><b>Excel</b> en la pantalla de inicio descarga parcelas y especies con los cálculos.</p>
    <p class="note">${esc(CFG.appName)} · ${esc(CFG.org)}</p></div>`, [{ label: "Cerrar", cls: "btn-primary" }]));

  // Acceso para pruebas automatizadas
  self.__app = { state, goPage, trySync, loadServerList, editServerRecord, exportExcel, issues };

  boot();
})();
