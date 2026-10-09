// Piezas de interfaz compartidas entre pantallas.
import { esc, ICONOS, fecha, clp } from '../nucleo.js';

export const cargando = '<div class="cargando" role="status">Cargando…</div>';
export const vacio = (texto, extra = '') => `<div class="vacio"><p>${esc(texto)}</p>${extra}</div>`;

export function etiquetaEstado(c) {
  if (c.atendido) return `<span class="etiqueta etiqueta-ok">${ICONOS.check}Atendido</span>`;
  return '<span class="etiqueta etiqueta-pendiente">Pendiente</span>';
}

export function filaCliente(c, { mostrarRuta = false, estado = true } = {}) {
  const detalle = [mostrarRuta ? (c.ruta_nombre || 'Sin ruta') : null, c.comuna && c.comuna !== c.ruta_nombre ? c.comuna : null,
    c.ultima_compra ? `Última compra ${fecha(c.ultima_compra)}` : 'Sin compras'].filter(Boolean).join(' · ');
  return `<a class="fila" href="#/clientes/${c.id}">
    <span class="fila-texto"><strong>${esc(c.nombre)}</strong><small>${esc(detalle)}</small></span>
    ${estado ? etiquetaEstado(c) : ''}
    <span class="fila-chevron">${ICONOS.chevron}</span>
  </a>`;
}

export function buscador(id, placeholder, valor = '') {
  return `<label class="buscador">${ICONOS.buscar}<input id="${id}" type="search" placeholder="${esc(placeholder)}" value="${esc(valor)}" autocomplete="off" enterkeyhint="search"></label>`;
}

// Campo de formulario con etiqueta
export function campo({ etiqueta, nombre, valor = '', tipo = 'text', ayuda = '', req = false, extra = '', modo = '' }) {
  return `<label class="campo"><span>${esc(etiqueta)}${req ? ' <em>*</em>' : ''}</span>
    <input name="${nombre}" type="${tipo}" value="${esc(valor ?? '')}" ${req ? 'required' : ''} ${modo ? `inputmode="${modo}"` : ''} ${extra}>
    ${ayuda ? `<small>${esc(ayuda)}</small>` : ''}</label>`;
}
export function selector({ etiqueta, nombre, opciones, valor, ayuda = '' }) {
  return `<label class="campo"><span>${esc(etiqueta)}</span><select name="${nombre}" ${nombre.endsWith('_id') || nombre.endsWith('_dias') || nombre === 'dia_semana' ? 'data-numero' : ''}>
    ${opciones.map(([v, t]) => `<option value="${esc(v ?? '')}" ${String(v ?? '') === String(valor ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('')}
  </select>${ayuda ? `<small>${esc(ayuda)}</small>` : ''}</label>`;
}

export const dato = (etiqueta, valor, html = false) =>
  `<div class="dato"><dt>${esc(etiqueta)}</dt><dd>${valor == null || valor === '' ? '<span class="falta">Sin dato</span>' : html ? valor : esc(valor)}</dd></div>`;

export const montoFila = (izq, der, fuerte = false) => `<div class="monto-fila${fuerte ? ' fuerte' : ''}"><span>${esc(izq)}</span><span class="num">${esc(der)}</span></div>`;
export { clp };
