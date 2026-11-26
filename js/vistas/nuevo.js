import { $, esc, barra, icono, vacio } from '../ui.js';
import * as datos from '../datos.js';

// Nuevo pedido o cotización desde el menú (botón "Nuevo"): elegir qué hacer, buscar el cliente y entrar directo a
// elegir productos. Por defecto, pedido (el atajo de Android "Nuevo pedido" abre esta pantalla);
// #/nuevo?tipo=cotizacion abre con "Cotización" elegida (botón de la lista de cotizaciones).
// Usa la copia del celular sin señal (datos.clientes usa conCopia) y busca sin importar acentos.
export async function vistaNuevo(v) {
  let tipo = new URLSearchParams(location.hash.split('?')[1] || '').get('tipo') === 'cotizacion' ? 'cotizacion' : 'pedido';
  const cabecera = () => barra({ titulo: tipo === 'cotizacion' ? 'Nueva cotización' : 'Nuevo pedido', sub: 'Elige el cliente', atras: tipo === 'cotizacion' ? '#/cotizaciones' : '#/rutas' });
  cabecera();
  v.innerHTML = `<div class="segmento seg-ruta seg-nuevo" role="radiogroup" aria-label="Qué quieres hacer">
      <button type="button" role="radio" data-tipo="pedido">${icono('camion', 'ico-s')} Pedido</button>
      <button type="button" role="radio" data-tipo="cotizacion">${icono('nota', 'ico-s')} Cotización</button></div>
    <p id="tipo-ayuda" class="ayuda pad-x"></p>
    <div id="cot-nuevo" class="pad-x" hidden><a class="btn sec ancho" href="#/cotizaciones/nueva">${icono('mas')} Cliente nuevo (aún no está en la app)</a></div>
    <div class="pad"><div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Nombre, RUT o comuna" aria-label="Buscar cliente" autocomplete="off"></div></div>
    <div id="res"></div>`;
  const marcar = () => {
    v.querySelectorAll('[data-tipo]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.tipo === tipo)));
    $('#tipo-ayuda', v).textContent = tipo === 'cotizacion' ? 'Precios para el cliente, sin nota de venta: no descuenta stock. Se envía por WhatsApp o se imprime.' : '';
    $('#tipo-ayuda', v).hidden = tipo !== 'cotizacion';
    $('#cot-nuevo', v).hidden = tipo !== 'cotizacion';   // cotizar a alguien que todavía no es cliente (solo nombre y teléfono)
  };
  v.querySelectorAll('[data-tipo]').forEach((b) => b.addEventListener('click', () => { tipo = b.dataset.tipo; cabecera(); marcar(); pintar(); }));
  const q = $('#q', v);
  let turno = 0;
  const pintar = async () => {
    const t = ++turno;
    const lista = await datos.clientes({ busqueda: q.value.trim() });
    if (t !== turno) return;
    $('#res', v).innerHTML = lista.length ? `<div class="lista">${lista.slice(0, 60).map((c) => `
      <a class="fila" href="#/clientes/${c.id}/${tipo === 'cotizacion' ? 'cotizacion' : 'pedido'}"><div class="fila-txt"><p class="fila-t">${esc(c.nombre)}</p>
        <p class="fila-s">${esc([...new Set([c.ruta_nombre || 'Sin ruta', c.comuna].filter(Boolean))].join(' · '))}${c.atendido ? ' · Visitado' : ''}</p></div>
        ${icono('derecha', 'ico-chev')}</a>`).join('')}</div>${lista.length > 60 ? '<p class="ayuda pad">Escribe parte del nombre para ver más.</p>' : ''}`
      : vacio('No hay clientes con esa búsqueda', 'Prueba con otra parte del nombre, el RUT o la comuna.');
  };
  q.addEventListener('input', pintar);
  marcar();
  await pintar();
  q.focus();
}
