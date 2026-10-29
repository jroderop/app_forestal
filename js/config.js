/* =====================================================================
   Inventario de Campo · Configuración
   Edita solo este archivo (y js/form-schema.js si cambia el formulario)
   para adaptar la app a otro proyecto.
   ===================================================================== */
self.APP_CONFIG = {
  appName: "Inventario de Campo",
  shortName: "Inventario",
  org: "IDAF · Forestry innovation & Development",

  // Servicio de la app (hosted feature layer o su vista). El token que se introduce
  // en Ajustes debe tener acceso a este servicio.
  serviceUrl: "https://services-eu1.arcgis.com/Aha5baNZi8JV5BWj/arcgis/rest/services/service_d0c61872f4324dde961c3f300c9995e1/FeatureServer",
  webmapId: "9dc9a92225f64ff3bb35b21c052afc54", // solo informativo: el web map interno lee la misma capa

  // Capa de puntos y tablas de los repeats. Se localizan por nombre en el servicio;
  // si no aparecen por nombre se usan estos índices.
  pointLayerId: 0,
  repeatTables: {
    InventarioTrees: { fallbackId: 1 },
    InventarioGrass: { fallbackId: 2 }
  },

  // Campos opcionales que la app rellena si existen en la capa (si no, se ignoran).
  // Recomendado añadirlos al XLSForm como preguntas "hidden" y volver a publicar.
  operatorField: "Operario",       // nombre que el técnico escribe en Ajustes (opcional)
  accuracyField: "Precision_GPS",  // precisión del GPS en metros al fijar el punto

  // Edición de registros ya enviados. Se activa solo si:
  //   1) allowEdit = true aquí, y
  //   2) la capa (o vista) tiene la operación "Actualizar" habilitada en ArcGIS Online.
  // Para cortarla sin tocar la app basta con quitar "Actualizar" en la vista.
  allowEdit: true,
  // Con operatorField en la capa, cada técnico solo ve y edita los registros con su nombre.
  // Ojo: el nombre lo escribe el propio técnico, no es una identificación segura.
  onlyOwnRecords: true,
  serverListLimit: 200,

  // GPS
  gpsWarnAccuracy: 15,   // m. Por encima se avisa de colocar el punto a mano
  gpsMaxAge: 10000,

  // Fotos: lado mayor en píxeles y calidad JPEG
  photoMaxSide: 1920,
  photoQuality: 0.82,

  // Mapa
  mapCenter: [37.917, -4.75],
  mapZoom: 13,
  orthoSwitchZoom: 18,           // Ortofoto combinada: Esri hasta z17, PNOA desde z18
  defaultBasemap: "orto-combinada",

  // Comprobaciones de rango (avisos, no bloquean salvo "hard")
  ranges: {
    Radio:       { min: 1, max: 50, hard: false, msg: "Radio fuera de lo habitual (1–50 m)" },
    Slp_Parcela: { min: 0, max: 200, hard: false, msg: "Pendiente fuera de lo habitual (0–200 %)" },
    FCC:         { min: 0, max: 100, hard: true,  msg: "La FCC debe estar entre 0 y 100 %" },
    Altura:      { min: 0, max: 60, hard: false, msg: "Altura fuera de lo habitual (0–60 m)" },
    HM:          { min: 0, max: 15, hard: false, msg: "Altura de matorral fuera de lo habitual (0–15 m)" }
  }
};
