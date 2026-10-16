import { $, esc, barra, icono, vacio } from '../ui.js';
import * as datos from '../datos.js';

// Nuevo pedido desde el menú (botón "Nuevo"): buscar el cliente y entrar directo a elegir productos.
// Usa la copia del celular sin señal (datos.clientes usa conCopia) y busca sin importar acentos.
export async function vistaNuevo(v) {
  barra({ titulo: 'Nuevo pedido', sub: 'Elige el cliente', atras: '#/rutas' });
  v.innerHTML = `<div class="pad"><div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Nombre, RUT o comuna" aria-label="Buscar cliente" autocomplete="off"></div></div>
    <div id="res"></div>`;
  const q = $('#q', v);
  let turno = 0;
  const pintar = async () => {
    const t = ++turno;
    const lista = await datos.clientes({ busqueda: q.value.trim() });
    if (t !== turno) return;
    $('#res', v).innerHTML = lista.length ? `<div class="lista">${lista.slice(0, 60).map((c) => `
      <a class="fila" href="#/clientes/${c.id}/pedido"><div class="fila-txt"><p class="fila-t">${esc(c.nombre)}</p>
        <p class="fila-s">${esc([...new Set([c.ruta_nombre || 'Sin ruta', c.comuna].filter(Boolean))].join(' · '))}${c.atendido ? ' · Visitado' : ''}</p></div>
        ${icono('derecha', 'ico-chev')}</a>`).join('')}</div>${lista.length > 60 ? '<p class="ayuda pad">Escribe parte del nombre para ver más.</p>' : ''}`
      : vacio('No hay clientes con esa búsqueda', 'Prueba con otra parte del nombre, el RUT o la comuna.');
  };
  q.addEventListener('input', pintar);
  await pintar();
  q.focus();
}
