// Capturas automáticas de las últimas pantallas, para adjuntarlas a un ticket de soporte (pedido del 21-10-2026).
//  - Solo con un administrador conectado (solo ellos envían tickets).
//  - Una captura por pantalla abierta, cuando la pantalla quedó quieta (1,5 s sin cambios y con el celular libre);
//    nunca mientras se imprime, se cobra, la pantalla está animando o hay una ventana encima (novedades, recorrido,
//    menú "Más", visor de fotos, actualización). También una al cambiar de paso dentro de una pantalla (p. ej. Revisar
//    pedido, evento coveca:paso) y otra cuando la app anota un error.
//  - No se capturan Ajustes, los tickets ni el ingreso.
//  - Se guardan SOLO en este equipo (IndexedDB, no en localStorage, que es chico): las últimas 6 y de las últimas
//    24 h (decisión del 21-10-2026). Al llegar la 7.ª se borra la más antigua. Nada se sube hasta que se
//    envía un ticket, que lleva las 6 (se pueden quitar).
//  - ~80 KB cada una (JPEG de 540 px de ancho). Solo en la app Android: se copia la pantalla ya dibujada (PixelCopy,
//    fuera del hilo de la pantalla) y se comprime en segundo plano, así que no se nota.
//  - En la web (PC, iPhone) NO se toman: dibujar la página con modern-screenshot trababa la pantalla 1 a 3 s en un
//    celular de gama media (medido el 21-10-2026). Ese camino queda solo para las pruebas automáticas
//    (localStorage coveca-capturas-prueba = 1), que no tienen app Android.
import * as datos from './datos.js';
import { esApp, Compartir } from './nativo.js';

export const MAX_GUARDADAS = 6;
const MAX_EDAD = 24 * 3600e3, ANCHO = 540, MAX_BYTES = 85000, QUIETO = 1500;
const NO_CAPTURAR = /^#\/(ajustes|soporte|login)$|^#\/tickets/;
const OCUPADO = '.imp-capa, .cobro-capa, .vista.animando, .act-capa, .nv-ventana, .at-ventana, .ac-ventana, .tour, .mas-capa, .visor-foto, .catalogo';

// ---------------- Almacén en el equipo (IndexedDB) ----------------
let bd = null;
function abrir() {
  if (bd) return bd;
  bd = new Promise((ok, mal) => {
    const r = indexedDB.open('coveca-capturas', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('c', { keyPath: 'id' });
    r.onsuccess = () => { r.result.onclose = () => { bd = null; }; ok(r.result); };
    r.onerror = () => mal(r.error);
  });
  bd.catch(() => { bd = null; });
  return bd;
}
async function operar(modo, fn) {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const tx = db.transaction('c', modo), st = tx.objectStore('c');
    let res;
    Promise.resolve(fn(st)).then((r) => { res = r; });
    tx.oncomplete = () => ok(res);
    tx.onerror = () => mal(tx.error);
    tx.onabort = () => mal(tx.error || new Error('Se canceló el guardado de la captura.'));
  });
}
const todas = () => operar('readonly', (st) => new Promise((ok) => { const r = st.getAll(); r.onsuccess = () => ok(r.result || []); }));

// Deja solo las últimas 10 de las últimas 24 h.
async function podar() {
  const l = (await todas()).sort((a, b) => a.t - b.t);
  const sobran = l.filter((x, i) => Date.now() - x.t > MAX_EDAD || i < l.length - MAX_GUARDADAS);
  if (sobran.length) await operar('readwrite', (st) => sobran.forEach((x) => st.delete(x.id)));
}

/** Capturas guardadas por el usuario conectado (más nuevas primero): [{ id, t, h, blob }]. Las de otro usuario
 *  (sesión vencida sin cerrar, cambio de usuario) se borran: nunca se adjuntan a un ticket ajeno. */
export async function capturasGuardadas() {
  try {
    await podar();
    const yo = datos.usuario()?.id || null, l = await todas();
    const ajenas = l.filter((c) => c.usuario !== yo);
    if (ajenas.length) await operar('readwrite', (st) => ajenas.forEach((c) => st.delete(c.id)));
    return l.filter((c) => c.usuario === yo).sort((a, b) => b.t - a.t);
  } catch (_) { return []; }
}
export async function borrarCapturas() { try { await operar('readwrite', (st) => st.clear()); } catch (_) { /* nada */ } }

// ---------------- Tomar la captura ----------------
async function capturarWeb() {
  const { domToJpeg } = await import('../vendor/modern-screenshot.esm.js');
  const k = Math.min(1, ANCHO / innerWidth);
  let url = null;
  for (const calidad of [0.7, 0.55, 0.4]) {
    url = await domToJpeg(document.body, {
      width: innerWidth, height: innerHeight, scale: k, quality: calidad, backgroundColor: getComputedStyle(document.body).backgroundColor,
      font: false, timeout: 3000, filter: (n) => !n.classList?.contains('aviso'),   // los avisos flotantes no
    });
    if ((url.length - 23) * 0.75 <= MAX_BYTES) break;
  }
  return (await fetch(url)).blob();
}
async function capturarApp() {
  const r = await Compartir.captura({ ancho: ANCHO, maxBytes: MAX_BYTES });
  const bin = atob(r.base64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}

const pruebas = () => { try { return localStorage.getItem('coveca-capturas-prueba') === '1'; } catch (_) { return false; } };
const activas = () => datos.esAdmin() && 'indexedDB' in window && (esApp ? !navigator.webdriver : pruebas());
const hash = () => location.hash.split('?')[0] || '#/rutas';

let reloj = null, enCurso = false, ultima = { h: null, t: 0 }, fallo = 0, ultimoError = null;
// Para los datos del ticket: cuántas hay, de cuándo es la última y si alguna falló (así un problema no queda en supuestos).
export async function estadoCapturas() {
  if (!esApp && !pruebas()) return { activas: false, motivo: 'solo en la app Android' };
  const l = await capturasGuardadas();
  return { activas: activas(), guardadas: l.length, ultima_hace: l[0] ? `${Math.round((Date.now() - l[0].t) / 60000)} min` : null,
    ultimo_error: ultimoError, fallo_hace: fallo ? `${Math.round((Date.now() - fallo) / 60000)} min` : null };
}
/** Programa una captura de la pantalla actual cuando quede quieta. motivo: 'pantalla' | 'error' */
let revisadas = false;
export function programarCaptura(motivo = 'pantalla', paso = '') {
  if (motivo === 'error' && (enCurso || Date.now() - fallo < 60000)) return;   // nunca un ciclo de capturas fallidas
  if (!activas()) {
    // Usuario sin permiso de administrador (o se lo quitaron): no deben quedar capturas en el equipo.
    if (!revisadas && datos.usuario() && !datos.esAdmin()) { revisadas = true; borrarCapturas(); }
    return;
  }
  clearTimeout(reloj);
  const h = hash(), clave = paso ? `${h} · ${paso}` : h;   // un paso dentro de la pantalla cuenta como otra pantalla
  reloj = setTimeout(() => {
    const quieto = () => {
      if (hash() !== h || NO_CAPTURAR.test(h) || document.hidden) return;
      if (document.querySelector(OCUPADO)) { reloj = setTimeout(quieto, QUIETO); return; }   // se reintenta cuando se libere
      // Misma pantalla capturada hace menos de 10 s (p. ej. un error justo al abrirla): no se repite.
      if (ultima.h === clave && Date.now() - ultima.t < 10000 && motivo !== 'error') return;
      const tomar = () => tomarCaptura(h, clave, motivo).catch((e) => { ultimoError = String(e?.message || e).slice(0, 160); });
      if ('requestIdleCallback' in window) requestIdleCallback(tomar, { timeout: 2000 }); else tomar();
    };
    quieto();
  }, QUIETO);
}

async function tomarCaptura(h, clave, motivo) {
  // Se revisa otra vez justo antes: mientras se esperaba, pudo abrirse la impresión o el cobro.
  if (enCurso || hash() !== h || document.querySelector(OCUPADO)) return;
  enCurso = true;
  const t0 = performance.now();
  try {
    const blob = esApp && Compartir?.captura ? await capturarApp() : await capturarWeb();
    if (!blob?.size || hash() !== h) return;
    ultima = { h: clave, t: Date.now() };
    await operar('readwrite', (st) => st.put({ id: crypto.randomUUID(), t: Date.now(), h: clave, motivo, blob, ms: Math.round(performance.now() - t0), usuario: datos.usuario()?.id || null }));
    await podar();
  } catch (e) { fallo = Date.now(); throw e; } finally { enCurso = false; }
}

// main.js avisa cuando una pantalla terminó de cargar; registro.js, cuando se anota un error.
window.addEventListener('coveca:pantalla', () => programarCaptura('pantalla'));
// Un paso dentro de la misma pantalla (p. ej. "Revisar pedido"): detail = nombre del paso.
window.addEventListener('coveca:paso', (e) => programarCaptura('pantalla', String(e.detail || '').slice(0, 40)));
window.addEventListener('coveca:error', () => programarCaptura('error'));
// Al cerrar sesión no deben quedar capturas de otro usuario.
window.addEventListener('coveca:salir', () => borrarCapturas());
