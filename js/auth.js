/* =====================================================================
   Acceso por token (igual que la app de instalaciones).
   - El servicio es fijo: APP_CONFIG.serviceUrl.
   - El token (API key completa creada en ArcGIS Online) se introduce UNA vez en Ajustes.
   - Cuando ArcGIS Online lo rechaza (caducado o revocado), la app lo borra, avisa y
     pide uno nuevo en Ajustes. Los registros pendientes se conservan y se envían
     con el token nuevo.
   ===================================================================== */
(function (g) {
  const CFG = g.APP_CONFIG;
  const clean = (t) => String(t || "").trim().replace(/\s+/g, "").replace(/\xa0/g, "");
  const serviceUrl = () => String(CFG.serviceUrl || "").trim().replace(/\/+$/, "");

  /** Única comprobación local: que haya algo. El formato lo decide ArcGIS Online
   *  (las API keys llevan puntos, p. ej. «..», y no se filtran por formato). */
  function formatProblem(token) {
    return token ? null : "Pega el token.";
  }

  /** Comprueba el token contra el servicio (requiere conexión). Lanza error con detalle. */
  async function checkToken(raw) {
    const token = clean(raw);
    const p = formatProblem(token);
    if (p) throw AGOL.makeError(p, "format");
    let info;
    try {
      info = await AGOL.request(serviceUrl(), { token }, 20000);
    } catch (e) {
      if (e.kind === "network") throw AGOL.makeError("Sin conexión con ArcGIS Online. Guarda el token cuando tengas cobertura.", "network");
      const msg = (e.code === 498 || e.code === 499)
        ? "ArcGIS Online no acepta el token (no válido o caducado)."
        : "El token no tiene acceso al servicio de la app.";
      const err = AGOL.makeError(msg, "auth", e.code);
      err.details = [`Código ${e.code || "?"} · ${e.raw || e.message}`];
      throw err;
    }
    if (!info || !Array.isArray(info.layers)) throw AGOL.makeError("La URL configurada no es un Feature Service.", "server");
    return token;
  }

  async function saveToken(raw) {
    let token;
    try { token = await checkToken(raw); }
    catch (e) {
      // Sin cobertura (como en la app de instalaciones): se guarda igual y se comprobará al enviar.
      if (e.kind !== "network") throw e;
      token = clean(raw);
      await DB.kvSet("token", { token, savedAt: Date.now(), unverified: true });
      await DB.kvDel("tokenProblem");
      return token;
    }
    await DB.kvSet("token", { token, savedAt: Date.now() });
    await DB.kvDel("tokenProblem");
    return token;
  }

  async function settings() {
    const t = await DB.kvGet("token");
    return {
      token: t ? t.token : null, tail: t ? t.token.slice(-6) : null, savedAt: t ? t.savedAt : null,
      operator: (await DB.kvGet("operator")) || "",
      problem: (await DB.kvGet("tokenProblem")) || null
    };
  }
  const setOperator = (name) => DB.kvSet("operator", String(name || "").trim());

  /** Lo que usan el envío y las consultas. null si aún no hay token. */
  async function getSession() {
    const s = await settings();
    if (!s.token) return null;
    return { serviceUrl: serviceUrl(), apiKey: s.token, fullName: s.operator, user: s.operator, project: CFG.projectName || CFG.appName, tokenTail: s.tail, startedAt: s.savedAt };
  }

  /** ArcGIS Online rechazó el token: se borra y se guarda el motivo para el aviso. */
  async function invalidate(reason) {
    if (!(await DB.kvGet("token"))) return;
    await DB.kvDel("token");
    await DB.kvSet("tokenProblem", { reason: reason || "El token ha caducado o ya no es válido.", at: Date.now() });
  }
  async function clearToken() { await DB.kvDel("token"); await DB.kvDel("tokenProblem"); }

  // Los registros cuelgan del servicio, no del token: sobreviven a la renovación.
  const projectKey = () => serviceUrl();

  g.AUTH = { clean, formatProblem, checkToken, saveToken, settings, setOperator, getSession, invalidate, clearToken, projectKey, serviceUrl };
})(self);
