// Menú del celular: Rutas, Clientes, + (Nuevo pedido), Pedidos y "Más".
// "Más" abre una hoja abajo con Catálogo, Cotizaciones, Inventario, Proveedores, Programa de lealtad, Reportes, Soporte y Ajustes. En PC no se usa (menú lateral con todo).
import { $, icono, esc } from './ui.js';
import { esAdmin } from './datos.js';

const SECCIONES = [
  { tab: 'catalogo', href: '#/catalogo', icono: 'catalogo', t: 'Catálogo', s: 'Productos y precios para mostrar al cliente' },
  { tab: 'cotizaciones', href: '#/cotizaciones', icono: 'nota', t: 'Cotizaciones', s: 'Precios para clientes, sin nota de venta' },
  { tab: 'inventario', href: '#/inventario', icono: 'inventario', t: 'Inventario', s: 'Productos, stock y precios' },
  { tab: 'proveedores', href: '#/proveedores', icono: 'proveedores', t: 'Proveedores', s: 'Contactos, pedidos y compras', admin: true },
  { tab: 'lealtad', href: '#/lealtad', icono: 'medalla', t: 'Programa de lealtad', s: 'Niveles, metas y descuentos', admin: true },
  { tab: 'reportes', href: '#/reportes', icono: 'reportes', t: 'Reportes', s: 'Ventas, cierre del día, carga y cobros' },
  { tab: 'soporte', href: '#/soporte', icono: 'soporte', t: 'Soporte', s: 'Reportar un problema y cómo usar la app' },
  { tab: 'ajustes', href: '#/ajustes', icono: 'ajustes', t: 'Ajustes', s: 'Impresora, apariencia y cuenta' },
];
export const EN_MAS = SECCIONES.map((x) => x.tab);

function cerrar(capa, volverFoco = true) {
  capa.remove();
  window.covecaCerrarVisor = null;
  document.removeEventListener('keydown', capa._tecla);
  $('#vista')?.removeAttribute('inert');
  $('#tab-mas')?.setAttribute('aria-expanded', 'false');
  if (volverFoco) $('#tab-mas')?.focus();
}

function abrirMas() {
  if (document.querySelector('.mas-capa')) return;
  const actual = document.body.dataset.tab;
  const capa = document.createElement('div');
  capa.className = 'mas-capa';
  capa.innerHTML = `<div class="mas-hoja" role="dialog" aria-modal="true" aria-labelledby="mas-t">
    <div class="hoja-asa" aria-hidden="true"></div>
    <h2 id="mas-t" class="mas-t">Más secciones</h2>
    <nav class="mas-lista">${SECCIONES.filter((x) => !x.admin || esAdmin()).map((x) => `
      <a class="mas-item" href="${x.href}" ${x.tab === actual ? 'aria-current="page"' : ''}>
        <span class="mas-ico">${icono(x.icono)}</span>
        <span class="mas-txt"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span>
        ${icono('derecha', 'ico-chev')}
      </a>`).join('')}</nav>
    <button type="button" class="btn link mas-cerrar">Cerrar</button>
  </div>`;
  capa.addEventListener('click', (e) => {
    if (e.target === capa || e.target.closest('.mas-cerrar')) cerrar(capa);
    else if (e.target.closest('.mas-item')) cerrar(capa, false);
  });
  capa._tecla = (e) => { if (e.key === 'Escape') cerrar(capa); };
  document.addEventListener('keydown', capa._tecla);
  document.body.appendChild(capa);
  $('#vista')?.setAttribute('inert', '');
  $('#tab-mas')?.setAttribute('aria-expanded', 'true');
  window.covecaCerrarVisor = () => cerrar(capa);   // el botón atrás de Android cierra la hoja
  capa.querySelector('.mas-item')?.focus();
}

export function activarMenuMas() {
  $('#tab-mas')?.addEventListener('click', abrirMas);
}
