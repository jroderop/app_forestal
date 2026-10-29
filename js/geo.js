/* Coordenadas: UTM ETRS89 (calculado sobre WGS84, diferencia < 1 m) y formatos de texto. */
(function (g) {
  function toUTM(lat, lon) {
    const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
    const zone = Math.floor((lon + 180) / 6) + 1;
    const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
    const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
    const phi = lat * Math.PI / 180, lam = lon * Math.PI / 180;
    const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    const T = Math.tan(phi) ** 2, C = ep2 * Math.cos(phi) ** 2, A = Math.cos(phi) * (lam - lon0);
    const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
      + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
    const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
    let y = k0 * (M + N * Math.tan(phi) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720));
    if (lat < 0) y += 10000000;
    return { zone, x, y };
  }
  const fmt = (n, d) => Number(n).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
  function utmText(lat, lon) { const u = toUTM(lat, lon); return 'UTM ' + u.zone + 'N · X ' + fmt(u.x, 0) + ' · Y ' + fmt(u.y, 0); }
  function dms(v, pos, neg) {
    const s = v < 0 ? neg : pos; v = Math.abs(v);
    const d = Math.floor(v), m = Math.floor((v - d) * 60), sec = ((v - d) * 60 - m) * 60;
    return d + '°' + String(m).padStart(2, '0') + "'" + fmt(sec, 1).padStart(4, '0') + '"' + s;
  }
  g.GEO = { toUTM, utmText, latlonText: (lat, lon) => fmt(lat, 6) + ', ' + fmt(lon, 6), dmsText: (lat, lon) => dms(lat, 'N', 'S') + ' ' + dms(lon, 'E', 'W'), fmt };
})(self);
