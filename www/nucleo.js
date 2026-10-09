// Núcleo de la app: plataforma, utilidades y navegación.
export const cap = window.Capacitor;
export const esApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const plugin = (n) => (esApp ? ((cap.Plugins && cap.Plugins[n]) || cap.registerPlugin(n)) : null);
export const Printer = plugin('BtPrinter');
export const Compartir = plugin('Compartir');

export const NEGOCIO = {
  nombre: 'COVECA',
  eslogan: 'Su comercializadora de confianza',
  telefono: '+56 9 7587 0827',
  leyenda: 'Este documento no representa una factura, solo es una nota de venta y guía de despacho.',
};

export const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
export const leer = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };

// Formato chileno
export const clp = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const miles = (n) => (n < 0 ? '-' : '') + Math.abs(Math.round(n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const fecha = (d) => (d ? new Date(d + (String(d).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Margen sobre precio de venta (regla COVECA): precio = costo / (1 - margen)
export const margen = (costo, precio) => (precio > 0 ? (precio - costo) / precio : null);
export const precioConMargen = (costo, m) => (m < 1 ? Math.round(costo / (1 - m)) : null);
export const pct = (m) => (m == null ? '—' : (m * 100).toFixed(1).replace('.', ',') + ' %');

// Escapar texto para insertarlo en HTML
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Íconos (trazos simples, heredan el color del texto)
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICONOS = {
  rutas: svg('<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>'),
  clientes: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14a6.5 6.5 0 0 1 3.5 6"/>'),
  inventario: svg('<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>'),
  mas: svg('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'),
  volver: svg('<path d="M15 5l-7 7 7 7"/>'),
  chevron: svg('<path d="M9 5l7 7-7 7"/>'),
  buscar: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'),
  editar: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  mas_simple: svg('<path d="M12 5v14M5 12h14"/>'),
  menos: svg('<path d="M5 12h14"/>'),
  telefono: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
  mapa: svg('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  correo: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>'),
  whatsapp: svg('<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  impresora: svg('<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
  salir: svg('<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  sinSenal: svg('<path d="M2 8.5a15 15 0 0 1 6-3.3M22 8.5a15 15 0 0 0-8.5-3.9M5 12a10 10 0 0 1 4.5-2.4M19 12a10 10 0 0 0-3-1.8M8.5 15.5a5 5 0 0 1 4.5-1.2M12 19h.01M3 3l18 18"/>'),
};

// ---------- Navegación por "#/ruta" ----------
const rutas = [];
export function ruta(patron, fn) {
  const nombres = [];
  const re = new RegExp('^' + patron.replace(/:(\w+)/g, (_, n) => { nombres.push(n); return '([^/]+)'; }) + '$');
  rutas.push({ re, nombres, fn });
}
export const ir = (hash) => { location.hash = hash; };
export const volver = (porDefecto) => { if (history.length > 1) history.back(); else ir(porDefecto); };

export async function resolver() {
  const hash = location.hash.slice(1) || '/rutas';
  for (const r of rutas) {
    const m = hash.match(r.re);
    if (m) {
      const params = Object.fromEntries(r.nombres.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
      await r.fn(params);
      return;
    }
  }
  ir('/rutas');
}

// ---------- Estructura de pantalla ----------
/**
 * Dibuja una pantalla.
 * @param {object} o  { titulo, subtitulo, atras (hash), accion: {icono, etiqueta, href}, cuerpo (html), pie (html), tab }
 */
export function pantalla(o) {
  const cab = document.getElementById('cabecera');
  cab.innerHTML = `
    ${o.atras ? `<a class="cab-boton" href="#${o.atras}" aria-label="Volver">${ICONOS.volver}</a>` : '<span class="cab-espacio"></span>'}
    <div class="cab-titulos">
      <h1>${esc(o.titulo)}</h1>
      ${o.subtitulo ? `<p>${esc(o.subtitulo)}</p>` : ''}
    </div>
    <span class="cab-red" hidden>${ICONOS.sinSenal}<span>Sin conexión</span></span>
    ${o.accion ? `<a class="cab-boton" href="#${o.accion.href}" aria-label="${esc(o.accion.etiqueta)}">${ICONOS[o.accion.icono]}</a>` : ''}`;
  const main = document.getElementById('vista');
  main.innerHTML = o.cuerpo || '';
  main.scrollTop = 0;
  const pie = document.getElementById('pie-accion');
  pie.innerHTML = o.pie || '';
  pie.hidden = !o.pie;
  document.body.dataset.tab = o.tab || '';
  document.getElementById('navegacion').hidden = !o.tab;
  actualizarRed();
}

export function actualizarRed() {
  const chip = document.querySelector('.cab-red');
  if (chip) chip.hidden = navigator.onLine;
}

export function aviso(texto, tipo = 'ok') {
  const t = document.createElement('div');
  t.className = `aviso aviso-${tipo}`;
  t.setAttribute('role', 'status');
  t.textContent = texto;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// Lee un formulario como objeto { nombre: valor }
export function leerFormulario(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'number' || el.dataset.numero !== undefined) o[el.name] = el.value === '' ? null : Number(el.value);
    else o[el.name] = el.value.trim() === '' ? null : el.value.trim();
  }
  return o;
}
