import { sentir } from './sentir.js';
// Utilidades de interfaz: escape de HTML, formato CLP, navegación, avisos.
export const clp = (n) => (n == null || n === '' ? '—' : (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
export const pct = (x) => (x == null || !isFinite(x) ? '—' : (x * 100).toFixed(1).replace('.', ',') + ' %');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Texto para buscar sin importar acentos ni mayúsculas (María = maria).
export const normal = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
export const ir = (ruta) => { location.hash = ruta; };
export const fecha = (d) => (d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '—');
export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Fechas en hora de Chile (la app se usa en Chile aunque el equipo tenga otra zona horaria). Días como "AAAA-MM-DD".
export const ZONA = 'America/Santiago';
export const diaChile = (f) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date(f));
// Ciclo de visita (igual que visitado_hasta en la base, migración 0048): último día de Chile ('AAAA-MM-DD') en que un
// cliente sigue "Visitado" por una compra o visita del día `dia`. Semanal: hasta el domingo; quincenal: 9 días; otras: sus días.
export function visitadoHasta(dia, frec) {
  if (!dia) return null;
  const d = new Date(`${String(dia).slice(0, 10)}T00:00:00Z`);
  const n = frec === 7 ? 7 - (d.getUTCDay() || 7) : frec === 14 ? 8 : Math.max(Number(frec) || 1, 1) - 1;
  return new Date(d.getTime() + n * 864e5).toISOString().slice(0, 10);
}
export const hoyChile = () => diaChile(new Date());
// "15-10" (día y mes)
export const diaMes = (f) => { const d = diaChile(f); return `${d.slice(8, 10)}-${d.slice(5, 7)}`; };
// Fecha y hora completas en hora de Chile: "15-10-2026, 14:05"
export const fechaHora = (f) => new Date(f).toLocaleString('es-CL', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-');
export const horaChile = (f) => new Date(f).toLocaleTimeString('es-CL', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' });
export const sumarDias = (dia, n) => { const d = new Date(dia + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// "Jueves 15-10-2026"
export const etiquetaDia = (dia) => {
  const d = new Date(dia + 'T12:00:00Z');
  return `${DIAS[((d.getUTCDay() + 6) % 7) + 1]} ${dia.slice(8, 10)}-${dia.slice(5, 7)}-${dia.slice(0, 4)}`;
};

// Formas de pago para mostrar. "pendiente" = el pago se decide al entregar.
export const FORMAS_PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', credito: 'Crédito' };
export const PAGO_TXT = { ...FORMAS_PAGO, pendiente: 'Pago al entregar' };

// "1 cliente", "3 clientes" (plural = singular + s, salvo que se indique otro).
export const plural = (n, uno, varios = uno + 's') => `${n} ${n === 1 ? uno : varios}`;

// Margen sobre precio de venta (regla COVECA).
export const margen = (costo, precio) => (precio > 0 ? (precio - costo) / precio : null);
export const precioConMargen = (costo, m) => (m < 1 ? Math.round(costo / (1 - m)) : null);

const ICONOS = {
  rutas: '<path d="M9 20l-5.4-2.7A1 1 0 0 1 3 16.4V4.6a1 1 0 0 1 1.4-.9L9 6m0 14 6-3m-6 3V6m6 11 4.6 2.3a1 1 0 0 0 1.4-.9V7.6a1 1 0 0 0-.6-.9L15 4m0 13V4m0 0L9 6"/>',
  clientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  inventario: '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3.3 7.6 12 12.5l8.7-4.9M12 22V12.5"/>',
  proveedores: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12.5V20h14v-7.5"/><path d="M10 20v-4.5h4V20"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  atras: '<path d="M15 18l-6-6 6-6"/>',
  dinero: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  soporte: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01"/>',
  medalla: '<circle cx="12" cy="15" r="6"/><path d="M8.2 10.4 5 3h4l3 6 3-6h4l-3.2 7.4"/><path d="m12 12.5.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z"/>',
  reportes: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/>',
  impresora: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/>',
  descargar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  alerta: '<circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16.5v.5"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  cuadricula: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
  camara: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  derecha: '<path d="M9 18l6-6-6-6"/>',
  arriba: '<path d="M18 15l-6-6-6 6"/>',
  cerrar: '<path d="M18 6 6 18M6 6l12 12"/>',
  expandir: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  catalogo: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v18H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M13 3h5.5A1.5 1.5 0 0 1 20 4.5v15a1.5 1.5 0 0 1-1.5 1.5H13z"/><path d="M7 8h1M7 12h1M16 8h1M16 12h1"/>',
  chispa: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  basura: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6M10 11v6M14 11v6"/>',
  abajo: '<path d="M6 9l6 6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  nota: '<path d="M6 2h9l4 4v15l-2-1-2 1-2-1-2 1-2-1-2 1V3a1 1 0 0 1 1-1z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
  caja: '<path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  moneda: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2A2.8 2.4 0 0 0 12 8c-1.6 0-2.8.9-2.8 2s1.2 1.7 2.8 2 2.8.9 2.8 2-1.2 2-2.8 2a2.8 2.4 0 0 1-2.8-1.2M12 6.5v1.5M12 16v1.5"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  escanear: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8M10 8v8M13 8v8M17 8v8"/>',
  tienda: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8M10 21v-5h4v5"/>',
  camion: '<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  puerta: '<path d="M3 21h18"/><path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M14 12h.01"/>',
  copiar: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  telefono: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  mapa: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  nube: '<path d="M17.5 19H8a5 5 0 1 1 1.6-9.7A6 6 0 0 1 21 11.5 3.8 3.8 0 0 1 17.5 19z"/>',
  'sin-cargar': '<path d="M17.5 19H8a5 5 0 1 1 1.6-9.7A6 6 0 0 1 21 11.5 3.8 3.8 0 0 1 17.5 19z"/><path d="M3 3l18 18"/>',   // foto guardada que no cargó (ticket N° 15)
  sinNube: '<path d="m2 2 20 20M5.8 5.8A5 5 0 0 0 8 19h9.5c.5 0 1-.1 1.4-.3M21 15.2A3.8 3.8 0 0 0 17.5 11 6 6 0 0 0 10 6.3"/>',
};
export const icono = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n] || ''}</svg>`;

// Barra superior: título grande (y texto chico arriba), flecha "Volver" opcional y botones a la derecha.
// En escritorio la lista de al lado escribe su barra en otro lugar (ver mostrarDividida en main.js).
let destinoBarra = null;
export const desviarBarra = (el) => { destinoBarra = el; };
// Las pantallas principales (sin flecha atrás) llevan el engranaje de Ajustes a la derecha (solo celular; en PC está
// en el menú lateral) y recuerdan la sección para que la flecha de Ajustes vuelva a ella.
const AJUSTES = { href: '#/ajustes', icono: 'ajustes', etiqueta: 'Ajustes', clase: 'solo-celular' };
const btnBarra = (x) => `<a class="barra-btn ${x.clase || ''}" href="${x.href}" aria-label="${esc(x.etiqueta)}">${icono(x.icono)}</a>`;
export function barra({ titulo, sub = '', atras = null, accion = null }) {
  const b = destinoBarra || $('#barra');
  const der = accion ? [accion] : [];
  if (!atras) {
    der.push(AJUSTES);
    const aqui = location.hash.split('?')[0] || '#/rutas';
    if (aqui !== '#/ajustes') try { sessionStorage.setItem('coveca-ajustes-volver', aqui); } catch (_) {}
  }
  b.classList.toggle('con-atras', !!atras);
  b.innerHTML = `
    ${atras ? `<a class="barra-btn" href="${atras}" aria-label="Volver">${icono('atras')}</a>` : ''}
    <div class="barra-titulo"><h1>${esc(titulo)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
    ${der.length ? `<div class="barra-der">${der.map(btnBarra).join('')}</div>` : ''}`;
}

// Estado de visita del ciclo: "Visitado", "Visitado · sin pedido" (llegó pero no hubo nota), "Visitado · cotización"
// (se le hizo una cotización, sin nota) o "Por visitar".
export function chipVisita(c, sufijo = '') {
  if (c.visita_sin_pedido && c.visita_cotizacion) return `<span class="chip visita-sin">${icono('nota', 'ico-s')} Visitado · cotización</span>`;
  if (c.visita_sin_pedido) return `<span class="chip visita-sin">${icono('puerta', 'ico-s')} Visitado · sin pedido</span>`;
  return c.atendido ? `<span class="chip ok">${icono('check', 'ico-s')} Visitado${sufijo}</span>` : `<span class="chip">Por visitar${sufijo}</span>`;
}

// Cliente creado desde una cotización con solo nombre y teléfono (migración 0052): falta completar su ficha.
export const chipFaltan = (c) => (c.datos_pendientes ? `<span class="chip alerta">${icono('alerta', 'ico-s')} Faltan datos</span>` : '');

// accion = { texto, fn } agrega un botón (p. ej. "Deshacer") y deja el aviso más tiempo en pantalla.
export function aviso(texto, tipo = 'ok', accion = null) {
  const t = document.createElement('div');
  t.className = `aviso ${tipo}`;
  if (tipo === 'error') sentir('atencion');   // vibración larga: algo que revisar
  t.setAttribute('role', 'status');
  t.innerHTML = `${icono(tipo === 'error' ? 'alerta' : 'check', 'ico-s aviso-ico')}<span>${esc(texto)}</span>${accion ? `<button type="button" class="aviso-accion">${esc(accion.texto)}</button>` : ''}`;
  document.body.appendChild(t);
  const ms = accion ? 6000 : 2600;
  const fuera = setTimeout(() => t.classList.add('fuera'), ms);
  const quitar = setTimeout(() => t.remove(), ms + 400);
  if (accion) t.querySelector('.aviso-accion').addEventListener('click', () => {
    clearTimeout(fuera); clearTimeout(quitar); t.remove(); accion.fn();
  });
}

// Pantallas vacías ilustradas: el dibujo se elige por el tema del título y flota apenas.
const TRAZO = 'stroke="var(--azul)" stroke-width="2.5"';
const DIBUJOS = {
  mapa: `<path d="M20 24l26-10 32 10 26-10v56l-26 10-32-10-26 10z" fill="var(--superficie)" ${TRAZO} stroke-linejoin="round"/><path d="M46 14v56M78 24v56" ${TRAZO}/><path d="M62 30s-12 10-12 18a12 12 0 0024 0c0-8-12-18-12-18z" fill="var(--rojo)"/><circle cx="62" cy="47" r="4" fill="var(--papel)"/>`,
  caja: `<path d="M26 38l36-14 36 14v34L62 86 26 72z" fill="var(--azul-suave)" ${TRAZO} stroke-linejoin="round"/><path d="M26 38l36 14 36-14M62 52v34" fill="none" ${TRAZO}/><path d="M26 38l-10-12 36-12 10 10M98 38l10-12-36-12-10 10" fill="var(--superficie)" ${TRAZO} stroke-linejoin="round"/>`,
  monedas: `<ellipse cx="62" cy="70" rx="30" ry="9" fill="var(--nivel-2-suave)" stroke="var(--nivel-2)" stroke-width="2.5"/><path d="M32 58v12c0 5 13 9 30 9s30-4 30-9V58" fill="var(--oro)" stroke="var(--nivel-2)" stroke-width="2.5"/><ellipse cx="62" cy="58" rx="30" ry="9" fill="var(--nivel-2-suave)" stroke="var(--nivel-2)" stroke-width="2.5"/><circle cx="96" cy="26" r="13" fill="var(--verde-relleno)"/><path d="M90 26l4 4 8-8" fill="none" stroke="var(--papel)" stroke-width="3" stroke-linecap="round"/>`,
  lupa: `<circle cx="54" cy="42" r="22" fill="var(--azul-suave)" ${TRAZO}/><path d="M70 58l20 20" stroke="var(--azul)" stroke-width="6" stroke-linecap="round"/><path d="M46 42h16" ${TRAZO} stroke-linecap="round"/>`,
  recibo: `<path d="M38 12h48v66l-6-4-6 4-6-4-6 4-6-4-6 4-6-4-6 4z" fill="var(--superficie)" ${TRAZO} stroke-linejoin="round"/><circle cx="50" cy="26" r="6" fill="var(--rojo)"/><path d="M62 24h16M62 29h10M46 42h32M46 50h32M46 58h18" ${TRAZO} stroke-linecap="round"/>`,
};
function dibujoPara(t) {
  const x = t.toLowerCase();
  if (/búsqueda|filtro/.test(x)) return 'lupa';
  if (/debe|cobrar|cobrado/.test(x)) return 'monedas';
  if (/cliente|ruta|recorrido/.test(x)) return 'mapa';
  if (/producto|stock|proveedor|pedirle/.test(x)) return 'caja';
  return 'recibo';
}
export function vacio(titulo, texto = '', accion = '') {
  return `<div class="vacio"><svg class="vacio-dib" viewBox="0 0 124 92" aria-hidden="true">${DIBUJOS[dibujoPara(titulo)]}</svg>
    <p class="vacio-t">${esc(titulo)}</p>${texto ? `<p>${esc(texto)}</p>` : ''}${accion}</div>`;
}

// Lee un formulario a objeto (números donde corresponde).
export function leerForm(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'number' || el.dataset.num !== undefined) o[el.name] = el.value === '' ? null : Number(el.value);
    else o[el.name] = el.value.trim() === '' ? null : el.value.trim();
  }
  return o;
}

// Preferencias de este equipo (texto en localStorage). Sin almacenamiento (modo privado) se usa el valor por defecto.
export const leerAjuste = (k, def = null) => { try { return localStorage.getItem(k) ?? def; } catch (_) { return def; } };
export const guardarAjuste = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* no se recordará */ } };

// Foto de cliente o producto guardada en el servidor. data-foto la marca para fotos-guardadas.js: si no carga, usa la
// copia del celular (clientes y productos activos) o muestra "Foto guardada · sin cargar" (ticket N° 15). Usar siempre esta en vez de un <img> suelto.
export const imgFoto = (url, cls) => `<img class="${cls}" src="${esc(url)}" data-foto="${esc(url)}" alt="" loading="lazy">`;

// Botones para agregar foto: cámara y galería (los dos llevan un input .foto-in que la pantalla escucha).
export const botonesFotoHtml = (cls = '') => `<div class="foto-acciones ${cls}">
  <label class="btn sec">${icono('camara')} Tomar foto<input class="foto-in" type="file" accept="image/*" capture="environment" hidden></label>
  <label class="btn sec">${icono('cuadricula')} Galería<input class="foto-in" type="file" accept="image/*" hidden></label>
</div>`;

// Selector Lista / Íconos (recuerda la elección por pantalla).
const vistaGuardada = (clave, def = 'iconos') => leerAjuste('vista-' + clave, def);
const guardarVistaElegida = (clave, x) => guardarAjuste('vista-' + clave, x);
export const selectorVista = () => `<div class="segmento" role="radiogroup" aria-label="Forma de ver">
  <button type="button" data-v="lista" role="radio" aria-label="Lista">${icono('lista')}</button>
  <button type="button" data-v="iconos" role="radio" aria-label="Íconos">${icono('cuadricula')}</button></div>`;
export function activarSelector(raiz, clave, alCambiar) {
  let actual = vistaGuardada(clave);
  const marcar = () => raiz.querySelectorAll('.segmento button').forEach((b) => b.setAttribute('aria-checked', b.dataset.v === actual));
  raiz.querySelectorAll('.segmento button').forEach((b) => b.addEventListener('click', () => {
    actual = b.dataset.v; guardarVistaElegida(clave, actual); marcar(); alCambiar(actual);
  }));
  marcar();
  return () => actual;
}

// Foto a pantalla completa (documentos de compra, fachada del cliente, producto). Toca afuera, × o Esc para cerrar.
export function verFoto(url, titulo = 'Foto') {
  const capa = document.createElement('div');
  capa.className = 'visor-foto'; capa.setAttribute('role', 'dialog'); capa.setAttribute('aria-label', titulo);
  capa.innerHTML = `<button type="button" class="visor-cerrar" aria-label="Cerrar">${icono('cerrar')}</button><img src="${esc(url)}" alt="${esc(titulo)}">`;
  const cerrar = () => { capa.remove(); document.removeEventListener('keydown', tecla); window.covecaCerrarVisor = null; };
  const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
  capa.addEventListener('click', (e) => { if (e.target === capa || e.target.closest('.visor-cerrar')) cerrar(); });
  document.addEventListener('keydown', tecla);
  document.body.appendChild(capa);
  window.covecaCerrarVisor = cerrar;   // el botón atrás de Android cierra el visor
  capa.querySelector('.visor-cerrar').focus();
}

// ---------------- Saludo al cliente (ticket N° 14) ----------------
// Nombre para saludar al cliente en los mensajes de WhatsApp, a partir de "Persona de contacto" (texto libre).
// "Luis Pérez" → "Luis"; "Luis (dueño)" y "Luis / Ana" → "Luis"; "Sra. Marta" → "Sra. Marta" (el trato se conserva);
// "María José" → "María José" (nombres compuestos comunes); "Encargado: Luis" → "Luis"; "LUIS" → "Luis".
// Devuelve '' si no queda un nombre de persona: vacío, con números o @, con forma de empresa o que empieza como un
// negocio ("Almacén Don Pepe"). Cada mensaje decide qué hacer sin nombre. Única regla: no repetirla en otro lado.
const TRATOS = new Set(['sr', 'sra', 'srta', 'sres', 'don', 'dona', 'dna', 'dn', 'senor', 'senora', 'senorita', 'dr', 'dra', 'tia', 'tio']);
const SALTAR = new Set(['encargado', 'encargada', 'dueno', 'duena', 'administrador', 'administradora', 'jefe', 'jefa', 'contacto',
  'atiende', 'la', 'el', 'los', 'las', 'del', 'de', 'con', 'para']);
const NEGOCIOS = new Set(['almacen', 'minimarket', 'minimercado', 'mini', 'market', 'botilleria', 'comercial', 'comercializadora',
  'distribuidora', 'supermercado', 'super', 'kiosco', 'quiosco', 'bazar', 'local', 'negocio', 'panaderia', 'ferreteria', 'tienda',
  'empresa', 'sociedad', 'inversiones', 'restaurant', 'restaurante', 'bodega', 'libreria', 'carniceria', 'verduleria']);
// Segundos nombres que van con María, José, Juan, Ana o Luis ("María José", "Juan Pablo"): se saluda con los dos.
const PRIMEROS = new Set(['maria', 'jose', 'juan', 'ana', 'luis']);
const SEGUNDOS = new Set(['jose', 'jesus', 'paz', 'elena', 'pablo', 'ignacio', 'ignacia', 'miguel', 'antonio', 'antonia', 'luis', 'luisa',
  'carlos', 'francisco', 'francisca', 'fernanda', 'teresa', 'isabel', 'angel', 'angelica', 'eugenia', 'pia', 'cristina', 'belen', 'paula',
  'ines', 'javiera', 'carolina', 'constanza', 'gracia', 'manuel', 'andres', 'esteban', 'alberto', 'enrique', 'eduardo', 'gabriel', 'gabriela',
  'jose', 'soledad', 'trinidad', 'victoria', 'valentina', 'magdalena', 'loreto', 'olga', 'rosa', 'rafael', 'ramon', 'tomas', 'cecilia']);
// Nombre con forma de razón social (SpA, S.p.A., Ltda., S.A., EIRL): no se usa para saludar.
export const pareceEmpresa = (s) => /(^|[\s.,])(s\.?\s?p\.?\s?a|ltda|limitada|e\.?\s?i\.?\s?r\.?\s?l|s\.\s?a)(?=$|[\s.,])|\ssa\.?$/.test(normal(s));
export function nombreSaludo(contacto) {
  const texto = String(contacto ?? '');
  if (/[\d@]/.test(texto)) return '';
  const parte = texto.replace(/\([^)]*\)?/g, ' ').split(/[/,;]|\s+y\s+|\s+-\s+/i)[0]
    .replace(/^[^:]*:\s*/, (m) => (m.trim().length < texto.trim().length ? '' : m))   // "Encargado: Luis" → "Luis"
    .replace(/\b(\p{L}{1,5}\.)(?=\p{L})/gu, '$1 ').replace(/\s+/g, ' ').trim();          // "Sra.Marta" → "Sra. Marta"
  if (!parte || pareceEmpresa(parte)) return '';
  let palabras = parte.split(' ').map((w) => w.replace(/^[^\p{L}]+|[^\p{L}.]+$/gu, '')).filter(Boolean);
  const clave = (w) => normal(w).replace(/\.+$/, '');
  if (!palabras.length || NEGOCIOS.has(clave(palabras[0]))) return '';
  while (palabras.length && SALTAR.has(clave(palabras[0]))) palabras = palabras.slice(1);
  const may = (w) => w.charAt(0).toLocaleUpperCase('es-CL') + w.slice(1).toLocaleLowerCase('es-CL');
  const esNombre = (w) => !!w && /\p{L}{2}/u.test(w) && !TRATOS.has(clave(w)) && !SALTAR.has(clave(w));
  const sinPunto = (w) => w?.replace(/\.+$/, '');
  let trato = '';
  if (palabras.length && TRATOS.has(clave(palabras[0]))) { trato = may(palabras[0]); palabras = palabras.slice(1); }
  const [a, b] = [sinPunto(palabras[0]), sinPunto(palabras[1])];
  if (!esNombre(a) || NEGOCIOS.has(clave(a))) return '';
  const nombre = PRIMEROS.has(clave(a)) && esNombre(b) && SEGUNDOS.has(clave(b)) ? `${may(a)} ${may(b)}` : may(a);
  return trato ? `${trato} ${nombre}` : nombre;
}
