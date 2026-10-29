/* =====================================================================
   Cálculos internos (mismas fórmulas que el XLSForm) y comprobaciones.
     Sup         = (Radio² · π) / 10000            [ha]
     Density     = Ntrees / Sup                    [pies/ha]
     DensityTree = NPies / Sup   (por especie)     [pies/ha]
   ===================================================================== */
(function (g) {
  const num = (v) => (v === "" || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
  const round = (v, d) => v === null ? null : Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

  function sup(rec) {
    const r = num(rec.Radio);
    return r && r > 0 ? (Math.pow(r, 2) * Math.PI) / 10000 : null;
  }
  function perHa(n, s) {
    const v = num(n);
    return v === null || !s ? null : v / s;
  }

  /** Recalcula los campos calculados del registro y de sus filas. Devuelve el registro. */
  function apply(rec) {
    const s = sup(rec);
    rec.Sup = s === null ? null : round(s, 6);
    rec.Density = round(perHa(rec.Ntrees, s), 2);
    (rec.InventarioTrees || []).forEach((row) => { row.DensityTree = round(perHa(row.NPies, s), 2); });
    return rec;
  }

  /** Resumen para la pantalla de revisión y la exportación. */
  function summary(rec) {
    const trees = rec.InventarioTrees || [];
    const bushes = rec.InventarioGrass || [];
    const sumPies = trees.reduce((a, r) => a + (num(r.NPies) || 0), 0);
    const nt = num(rec.Ntrees);
    const warnings = [];
    if (nt !== null && trees.length && sumPies !== nt) {
      warnings.push(`La suma de pies por especie (${sumPies}) no coincide con el número de árboles de la parcela (${nt}).`);
    }
    if (nt !== null && rec.Sup === null) warnings.push("Sin radio de parcela no se pueden calcular las densidades.");
    const fccTotal = bushes.reduce((a, r) => a + (num(r.FCC) || 0), 0);
    if (fccTotal > 100) warnings.push(`La FCC del matorral suma ${fccTotal} %: posible solape entre especies (admisible si hay estratos superpuestos).`);
    return {
      supHa: rec.Sup, supM2: rec.Sup === null ? null : rec.Sup * 10000,
      density: rec.Density, sumPies, nSpeciesTree: trees.length, nSpeciesBush: bushes.length,
      fccTotal, warnings
    };
  }

  /** Comprobaciones de rango definidas en APP_CONFIG.ranges. */
  function rangeIssue(name, value) {
    const R = (g.APP_CONFIG.ranges || {})[name];
    const v = num(value);
    if (!R || v === null) return null;
    if ((R.min !== undefined && v < R.min) || (R.max !== undefined && v > R.max)) return { hard: !!R.hard, msg: R.msg };
    return null;
  }

  g.CALC = { apply, summary, rangeIssue, num, round };
})(self);
