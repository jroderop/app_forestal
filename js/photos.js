/* Fotos: reduce tamaño (lado mayor CFG.photoMaxSide) y respeta la orientación de la cámara.
 * Nota: el JPEG resultante no conserva los metadatos EXIF (incluida la posición GPS de la foto). */
(function (g) {
  async function compress(file) {
    const CFG = g.APP_CONFIG;
    const max = CFG.photoMaxSide || 1920, q = CFG.photoQuality || 0.82;
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { return file; } // formato no decodificable (p. ej. HEIC en algunos navegadores): se envía tal cual
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close && bmp.close();
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', q));
    return blob && blob.size < file.size ? blob : file;
  }
  g.PHOTOS = { compress };
})(self);
