// Utilidades de interfaz: escape de HTML, formato CLP, navegación, avisos.
export const clp = (n) => (n == null || n === '' ? '—' : (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
export const pct = (x) => (x == null || !isFinite(x) ? '—' : (x * 100).toFixed(1).replace('.', ',') + ' %');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
export const ir = (ruta) => { location.hash = ruta; };
export const fecha = (d) => (d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '—');
export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Margen sobre precio de venta (regla COVECA).
export const margen = (costo, precio) => (precio > 0 ? (precio - costo) / precio : null);
export const precioConMargen = (costo, m) => (m < 1 ? Math.round(costo / (1 - m)) : null);

const ICONOS = {
  rutas: '<path d="M9 20l-5.4-2.7A1 1 0 0 1 3 16.4V4.6a1 1 0 0 1 1.4-.9L9 6m0 14 6-3m-6 3V6m6 11 4.6 2.3a1 1 0 0 0 1.4-.9V7.6a1 1 0 0 0-.6-.9L15 4m0 13V4m0 0L9 6"/>',
  clientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  inventario: '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3.3 7.6 12 12.5l8.7-4.9M12 22V12.5"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  atras: '<path d="M15 18l-6-6 6-6"/>',
  reportes: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/>',
  impresora: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  cuadricula: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
  camara: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  derecha: '<path d="M9 18l6-6-6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  telefono: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  mapa: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  nube: '<path d="M17.5 19H8a5 5 0 1 1 1.6-9.7A6 6 0 0 1 21 11.5 3.8 3.8 0 0 1 17.5 19z"/>',
  sinNube: '<path d="m2 2 20 20M5.8 5.8A5 5 0 0 0 8 19h9.5c.5 0 1-.1 1.4-.3M21 15.2A3.8 3.8 0 0 0 17.5 11 6 6 0 0 0 10 6.3"/>',
};
export const icono = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n] || ''}</svg>`;

// Barra superior: título, botón atrás opcional y acción opcional a la derecha.
export function barra({ titulo, sub = '', atras = null, accion = null }) {
  const b = $('#barra');
  b.innerHTML = `
    ${atras ? `<a class="barra-btn" href="${atras}" aria-label="Volver">${icono('atras')}</a>` : '<span class="barra-esp"></span>'}
    <div class="barra-titulo"><h1>${esc(titulo)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
    ${accion ? `<a class="barra-btn" href="${accion.href}" aria-label="${esc(accion.etiqueta)}">${icono(accion.icono)}</a>` : '<span class="barra-esp"></span>'}`;
}

export function aviso(texto, tipo = 'ok') {
  const t = document.createElement('div');
  t.className = `aviso ${tipo}`;
  t.setAttribute('role', 'status');
  t.textContent = texto;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('fuera'), 2600);
  setTimeout(() => t.remove(), 3000);
}

export function vacio(titulo, texto = '', accion = '') {
  return `<div class="vacio"><p class="vacio-t">${esc(titulo)}</p>${texto ? `<p>${esc(texto)}</p>` : ''}${accion}</div>`;
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

// Selector Lista / Íconos (recuerda la elección por pantalla).
export const vistaGuardada = (clave, def = 'iconos') => { try { return localStorage.getItem('vista-' + clave) || def; } catch (_) { return def; } };
export const guardarVistaElegida = (clave, x) => { try { localStorage.setItem('vista-' + clave, x); } catch (_) {} };
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
