// Video para los tickets de soporte: hasta 30 s. Si pesa más de 8 MB se comprime en el mismo equipo
// (se reproduce una vez sin sonido por el parlante y se graba de nuevo a ~720p y 1,6 Mbps): un video de 30 s del
// celular (~60 MB) queda en ~6 MB, cabe en el límite de 50 MB de Storage y sube rápido con señal de ruta.
// La compresión tarda lo mismo que dura el video y necesita que la pantalla siga abierta.
export const MAX_SEG = 30;
const MAX_BYTES = 50 * 1024 * 1024;
const SIN_COMPRIMIR = 8 * 1024 * 1024;
const EXT = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
const tipoBase = (t) => String(t || '').split(';')[0].trim().toLowerCase();

// Duración y tamaño del video. Algunos archivos (webm) no traen la duración: se busca adelantando al final.
export function leerVideo(archivo) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo);
    const v = document.createElement('video');
    v.preload = 'metadata'; v.muted = true; v.playsInline = true;
    const fin = (r, e) => { URL.revokeObjectURL(url); v.removeAttribute('src'); e ? mal(e) : ok(r); };
    v.onerror = () => fin(null, new Error('No se pudo leer el video. Prueba grabándolo de nuevo.'));
    v.onloadedmetadata = () => {
      const listo = () => fin({ segundos: v.duration, ancho: v.videoWidth, alto: v.videoHeight });
      if (isFinite(v.duration) && v.duration > 0) return listo();
      v.ontimeupdate = () => { v.ontimeupdate = null; listo(); };
      v.currentTime = 1e7;
    };
    v.src = url;
  });
}

const formatoGrabacion = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm']
    .find((t) => MediaRecorder.isTypeSupported?.(t)) || null;
};

// Devuelve { blob, ext, segundos } listo para subir, o un error con un mensaje claro.
export async function prepararVideo(archivo, alAvanzar = () => {}) {
  const info = await leerVideo(archivo);
  if (info.segundos > MAX_SEG + 0.9) {
    throw new Error(`El video dura ${Math.round(info.segundos)} segundos y el máximo es ${MAX_SEG}. Graba uno más corto, mostrando solo el problema.`);
  }
  const tipo = tipoBase(archivo.type);
  if (archivo.size <= SIN_COMPRIMIR && EXT[tipo]) { alAvanzar(1); return { blob: archivo, ext: EXT[tipo], segundos: info.segundos }; }
  const formato = formatoGrabacion();
  if (!formato) {
    if (archivo.size <= MAX_BYTES && EXT[tipo]) return { blob: archivo, ext: EXT[tipo], segundos: info.segundos };
    throw new Error('Este equipo no puede achicar el video y pesa más de 50 MB. Grábalo más corto o en menor calidad.');
  }
  const blob = await comprimir(archivo, info, formato, alAvanzar);
  if (blob.size >= archivo.size && archivo.size <= MAX_BYTES && EXT[tipo]) return { blob: archivo, ext: EXT[tipo], segundos: info.segundos };
  if (blob.size > MAX_BYTES) throw new Error('El video sigue pesando más de 50 MB. Grábalo más corto.');
  return { blob, ext: EXT[tipoBase(formato)], segundos: info.segundos };
}

async function comprimir(archivo, info, formato, alAvanzar) {
  const url = URL.createObjectURL(archivo);
  const v = document.createElement('video');
  v.playsInline = true; v.preload = 'auto';
  // El video se reproduce fuera de la vista (algunos navegadores no reproducen videos que no están en la página).
  Object.assign(v.style, { position: 'fixed', left: '-10px', top: '0', width: '2px', height: '2px', opacity: '0.01', pointerEvents: 'none' });
  document.body.appendChild(v);
  let ac = null;
  try {
    v.src = url;
    await new Promise((ok, mal) => { v.onloadeddata = ok; v.onerror = () => mal(new Error('No se pudo leer el video. Prueba grabándolo de nuevo.')); });
    const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(v.videoWidth * k / 2) * 2); c.height = Math.max(2, Math.round(v.videoHeight * k / 2) * 2);
    const ctx = c.getContext('2d');
    const flujo = c.captureStream(30);
    // Sonido: va a la grabación pero no al parlante (por si quien reporta explica algo hablando).
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const origen = ac.createMediaElementSource(v), destino = ac.createMediaStreamDestination();
      origen.connect(destino);
      destino.stream.getAudioTracks().forEach((t) => flujo.addTrack(t));
      await ac.resume().catch(() => {});
    } catch (_) { /* sin sonido */ }
    const rec = new MediaRecorder(flujo, { mimeType: formato, videoBitsPerSecond: 1600000, audioBitsPerSecond: 64000 });
    const partes = [];
    rec.ondataavailable = (e) => { if (e.data?.size) partes.push(e.data); };
    const parado = new Promise((ok) => { rec.onstop = ok; });
    const dur = isFinite(info.segundos) && info.segundos > 0 ? info.segundos : MAX_SEG;
    let vivo = true;
    const dibujar = () => {
      if (!vivo) return;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      alAvanzar(Math.min(0.99, v.currentTime / dur));
      requestAnimationFrame(dibujar);
    };
    rec.start(1000);
    try { await v.play(); } catch (_) { v.muted = true; await v.play(); }   // sin permiso para sonido: se graba sin audio
    dibujar();
    await Promise.race([
      new Promise((ok) => { v.onended = ok; }),
      new Promise((ok) => setTimeout(ok, (dur * 2 + 15) * 1000)),   // por si el equipo no avisa el final
    ]);
    vivo = false;
    rec.stop();
    await parado;
    flujo.getTracks().forEach((t) => t.stop());
    alAvanzar(1);
    return new Blob(partes, { type: tipoBase(formato) });
  } finally {
    v.pause(); v.removeAttribute('src'); v.load(); v.remove();
    URL.revokeObjectURL(url);
    ac?.close().catch(() => {});
  }
}
