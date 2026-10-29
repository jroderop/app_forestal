/* =====================================================================
   Acceso a ArcGIS Online: igual que la app de instalaciones v0.1.2.
   - Ajustes › «Clave de acceso (API key)» + «Servicio de entidades» → «Guardar y probar».
   - Ambos se guardan SIEMPRE en el dispositivo (también sin cobertura) y después se prueban.
   - El token va siempre en el cuerpo de un POST, nunca en la URL.
   - Si ArcGIS Online rechaza la clave (caducada), se avisa en el inicio y los registros quedan
     pendientes; al guardar una clave nueva se envían.
   ===================================================================== */
(function (g) {
  const CFG = g.APP_CONFIG;
  const trimUrl = (u) => String(u || "").trim().replace(/\/+$/, "").replace(/\?.*$/, "");
  const clean = (t) => String(t || "").trim();
  let svcCache = trimUrl(CFG.serviceUrl);

  /** Carga la URL del servicio guardada en Ajustes (o la de config.js). */
  async function init() {
    const u = await DB.kvGet("serviceUrl");
    svcCache = trimUrl(u || CFG.serviceUrl);
    return svcCache;
  }
  const serviceUrl = () => svcCache;

  /** Guarda clave y servicio sin comprobar (como «Guardar y probar» de la app de instalaciones). */
  async function saveSettings(key, url) {
    const k = clean(key);
    const u = trimUrl(url) || trimUrl(CFG.serviceUrl);
    if (k) await DB.kvSet("token", { token: k, savedAt: Date.now() });
    else await DB.kvDel("token");
    await DB.kvSet("serviceUrl", u);
    await DB.kvDel("tokenProblem");
    svcCache = u;
  }

  async function settings() {
    const t = await DB.kvGet("token");
    return {
      token: t ? t.token : null, tail: t ? t.token.slice(-6) : null, savedAt: t ? t.savedAt : null,
      serviceUrl: serviceUrl(),
      operator: (await DB.kvGet("operator")) || "",
      problem: (await DB.kvGet("tokenProblem")) || null
    };
  }
  const setOperator = (name) => DB.kvSet("operator", String(name || "").trim());

  /** Lo que usan el envío y las consultas. null si aún no hay clave. */
  async function getSession() {
    const t = await DB.kvGet("token");
    if (!t) return null;
    const url = trimUrl((await DB.kvGet("serviceUrl")) || CFG.serviceUrl);
    const op = (await DB.kvGet("operator")) || "";
    return { serviceUrl: url, apiKey: t.token, fullName: op, user: op, project: CFG.appName, tokenTail: t.token.slice(-6), startedAt: t.savedAt };
  }

  /** ArcGIS Online rechazó la clave: se avisa (la clave se mantiene, como en la app de instalaciones). */
  async function invalidate(reason) {
    if (!(await DB.kvGet("token"))) return false;
    const had = await DB.kvGet("tokenProblem");
    await DB.kvSet("tokenProblem", { reason: reason || "La clave de acceso no es válida o ha caducado.", at: Date.now() });
    return !had;   // true = aviso nuevo
  }
  const clearProblem = () => DB.kvDel("tokenProblem");

  // Los registros cuelgan del servicio, no de la clave: sobreviven a la renovación.
  const projectKey = (s) => (s && s.serviceUrl) || serviceUrl();

  g.AUTH = { init, serviceUrl, saveSettings, settings, setOperator, getSession, invalidate, clearProblem, projectKey, clean, trimUrl };
})(self);
