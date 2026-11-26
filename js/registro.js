// Registro técnico para los tickets de soporte. Todo se guarda en el equipo (localStorage) y viaja si un administrador
// envía un ticket; además, desde la migración 0050 los errores (solo los errores) se suben solos para verlos aunque
// nadie los reporte (js/errores-sync.js). No guarda datos de clientes: solo mensajes técnicos, direcciones de pantalla
// (#/clientes/12, sin nombres), el texto de los botones tocados y qué respondió el servidor (nombre de la consulta,
// código y tiempo). Lo escrito en buscadores y campos NO se guarda: solo que se escribió.
//  - errores: últimos 15 (48 h), con dónde fallaron, código del servidor y operación;
//  - pantallas: últimas 8 visitadas;
//  - rastro: últimas 30 acciones (24 h): toques, elecciones, consultas del servidor que fallaron o tardaron, y
//    todos los registros (ventas, entregas, cobros…);
//  - última sincronización de la cola y último resultado de impresión.
// Se importa primero en main.js, para anotar también los errores del arranque.
const K_ERR = 'coveca-errores', K_PANT = 'coveca-pantallas', K_RASTRO = 'coveca-rastro', K_SYNC = 'coveca-sync', K_IMP = 'coveca-impresion';
const DIA = 24 * 3600e3;
const leer = (k, d = []) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (_) { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* sin espacio: no se recuerda */ } };
const hashActual = () => location.hash.split('?')[0] || '#/rutas';
const nuevoId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)));
const corto = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// Quita lo que podría identificar a una persona aunque llegue en un mensaje técnico: correos, RUT, teléfonos y
// números largos, y todo lo que vaya entre comillas (los errores del servidor a veces repiten el valor enviado).
export const limpiar = (s) => String(s ?? '')
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '(correo)')
  .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g, '(RUT)')
  .replace(/(^|[^\w-])\+?\d[\d\s-]{6,}\d(?![\w-])/g, '$1(número)')   // sin "(?<": Safari < 16.4 no lo entiende
  .replace(/\$\s?\d[\d.]*/g, '($)')
  .replace(/"[^"\n]{1,200}"|'[^'\n]{1,200}'|“[^”\n]{1,200}”/g, '"…"');
// Lo que se hace dentro de los tickets no cuenta: llenaría el rastro justo antes de enviarlo.
const enTickets = () => /^#\/tickets/.test(location.hash);

// ---------------- Errores ----------------
// e puede traer (desde datos.js) code, operacion y detalle del servidor.
export function anotarError(origen, e) {
  const msg = corto(limpiar(e?.stack || e?.message || e || ''), 1200);
  if (!msg || /ResizeObserver loop/i.test(msg)) return;
  const l = leer(K_ERR).filter((x) => Date.now() - x.t < 48 * 3600e3);
  const ult = l[l.length - 1];
  if (ult && ult.m === msg) { ult.n = (ult.n || 1) + 1; ult.t = Date.now(); }
  else {
    l.push({ id: nuevoId(), t0: Date.now(), t: Date.now(), o: origen, m: msg, p: hashActual(),
      ...(e?.code ? { c: corto(e.code, 20) } : {}), ...(e?.operacion ? { op: corto(e.operacion, 60) } : {}),
      ...(e?.detalle ? { d: corto(limpiar(e.detalle), 200) } : {}) });
  }
  guardar(K_ERR, l.slice(-15));
  // Las capturas toman la pantalla donde falló (salvo que el error sea de la propia captura: se repetiría sin parar).
  if (!/captura|copiar la pantalla/i.test(msg)) window.dispatchEvent(new Event('coveca:error'));
}
export const ultimosErrores = () => leer(K_ERR).filter((x) => Date.now() - x.t < 48 * 3600e3);

// ---------------- Errores por subir ----------------
// Cada error lleva un id; se recuerda hasta qué contador (n) se subió cada uno, así solo viaja lo nuevo y el servidor
// no cuenta dos veces (guarda el mayor n por id). Los errores anteriores a esta versión reciben su id aquí.
const K_SUBIDOS = 'coveca-errores-subidos';
export function erroresPorSubir() {
  const l = ultimosErrores();
  let cambio = false;
  for (const x of l) if (!x.id) { x.id = nuevoId(); x.t0 = x.t; cambio = true; }
  if (cambio) guardar(K_ERR, [...leer(K_ERR).filter((x) => Date.now() - x.t >= 48 * 3600e3), ...l].slice(-15));
  // Solo los que quedaron guardados con su id (con el almacenamiento lleno, cada subida inventaría ids nuevos).
  const guardados = new Set(ultimosErrores().map((x) => x.id).filter(Boolean));
  const subidos = leer(K_SUBIDOS, {});
  return l.filter((x) => guardados.has(x.id) && (x.n || 1) > (subidos[x.id] || 0));
}
export function erroresSubidos(lista) {
  const vivos = new Set(ultimosErrores().map((x) => x.id));
  const subidos = Object.fromEntries(Object.entries(leer(K_SUBIDOS, {})).filter(([id]) => vivos.has(id)));
  for (const x of lista) subidos[x.id] = Math.max(subidos[x.id] || 0, x.n || 1);
  guardar(K_SUBIDOS, subidos);
}

window.addEventListener('error', (e) => anotarError('error', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => anotarError('promesa', e.reason));
const original = console.error.bind(console);
console.error = (...a) => { anotarError('consola', a.length === 1 && a[0] instanceof Error ? a[0] : a.map((x) => x?.message || x).join(' ')); original(...a); };

// ---------------- Pantallas visitadas ----------------
// La última es la actual. Los tickets no cuentan como pantalla.
export const ultimasPantallas = () => leer(K_PANT);
function anotarPantalla() {
  const h = hashActual();
  if (/^#\/tickets/.test(h)) return;
  const l = leer(K_PANT).filter((x) => x.h !== h);
  l.push({ h, t: Date.now() });
  guardar(K_PANT, l.slice(-8));
  anotarAccion('pantalla', h);
}
window.addEventListener('hashchange', anotarPantalla);

// ---------------- Rastro de acciones ----------------
// Cada entrada: { t, k: tipo, x: texto, p: pantalla }. Tipos: pantalla, toque, elige, escribe, servidor.
export function anotarAccion(k, x) {
  if (enTickets() && k !== 'servidor') return;
  const l = leer(K_RASTRO).filter((y) => Date.now() - y.t < DIA);
  l.push({ t: Date.now(), k, x: corto(limpiar(x), 160), p: hashActual() });
  guardar(K_RASTRO, l.slice(-30));
}
export const ultimoRastro = () => leer(K_RASTRO).filter((y) => Date.now() - y.t < DIA);

// Texto de lo tocado, sin datos de clientes:
//  - enlaces de la app por su dirección (#/clientes/12; en una lista el texto sería el nombre del cliente);
//  - enlaces externos solo por su tipo (llamar, WhatsApp, mapa…: la dirección lleva el teléfono o la dirección);
//  - botones por su id y su texto visible (nunca la etiqueta de accesibilidad, que a veces nombra al cliente).
const EXTERNOS = [[/^tel:/i, 'llamar'], [/^mailto:/i, 'correo'], [/wa\.me|whatsapp/i, 'WhatsApp'], [/maps|geo:/i, 'mapa']];
function descripcionToque(el) {
  if (el.tagName === 'A') {
    const href = el.getAttribute('href') || '';
    if (href.startsWith('#')) return `enlace ${corto(href.split('?')[0], 60)}`;
    return `enlace externo (${EXTERNOS.find(([re]) => re.test(href))?.[1] || 'otro'})`;
  }
  const id = el.id ? `#${el.id} ` : '';
  const txt = el.closest('.fila, li') && !el.id ? '' : corto(el.textContent, 40);
  return `${id}${txt ? `«${txt}»` : `(${corto(el.className, 30) || el.tagName.toLowerCase()})`}`.trim();
}
document.addEventListener('click', (e) => {
  const el = e.target.closest?.('a[href], button, [role="button"], label.btn, summary, .filtro');
  if (el) anotarAccion('toque', descripcionToque(el));
}, true);
document.addEventListener('change', (e) => {
  const el = e.target;
  if (!el?.tagName) return;
  const nombre = corto(el.name || el.id || el.getAttribute('aria-label') || el.type, 30);
  if (el.type === 'file') anotarAccion('elige', `${nombre}: archivo`);
  else if (el.type === 'radio' || el.type === 'checkbox') anotarAccion('elige', `${nombre}=${el.type === 'checkbox' ? el.checked : corto(el.value, 20)}`);
  else if (el.tagName === 'SELECT') anotarAccion('elige', `${nombre}${/^[\w-]{1,20}$/.test(el.value) ? `=${el.value}` : ''}`);
  else if (/^(INPUT|TEXTAREA)$/.test(el.tagName)) anotarAccion('escribe', `${nombre}${el.type === 'search' || /buscar/i.test(el.placeholder || '') ? ' (buscador)' : ''}`);
}, true);

// Respuestas del servidor (las anota datos.js): todos los registros (consultas que no son lectura) y las lecturas
// que fallaron o tardaron más de 3 s. r = { metodo, ruta, estado, ms, codigo?, mensaje? }
export function anotarServidor(r) {
  if (/registrar_errores/.test(r.ruta)) return;   // la subida de errores no es algo que hizo la persona
  const lectura = r.metodo === 'GET' || r.metodo === 'HEAD';
  if (lectura && r.estado > 0 && r.estado < 400 && r.ms < 3000) return;
  const est = r.estado ? `${r.estado}` : 'sin respuesta';
  anotarAccion('servidor', `${r.metodo} ${r.ruta} → ${est} en ${(r.ms / 1000).toFixed(1).replace('.', ',')} s${r.codigo ? ` · ${r.codigo}` : ''}${r.mensaje ? ` · ${r.mensaje}` : ''}`);
}

// ---------------- Sincronización e impresión ----------------
// Última vez que el celular intentó subir lo hecho sin señal: { t, subidos, pendientes, error }
export function anotarSync(s) { guardar(K_SYNC, { t: Date.now(), ...s }); }
export const ultimaSync = () => leer(K_SYNC, null);
// Último intento de imprimir una nota en la térmica: { t, ok, ms, error }
export function anotarImpresion(s) { guardar(K_IMP, { t: Date.now(), ...s }); }
export const ultimaImpresion = () => leer(K_IMP, null);

anotarPantalla();
