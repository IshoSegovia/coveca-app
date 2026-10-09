// Arranque y enrutador de la app (rutas con #/...).
import { $, $$, barra, ir, esc } from './ui.js';
import * as datos from './datos.js';
import { vistaLogin } from './vistas/login.js';
import { vistaRutas, vistaRuta, vistaRutaForm } from './vistas/rutas.js';
import { vistaClientes, vistaCliente, vistaClienteForm } from './vistas/clientes.js';
import { vistaPedido } from './vistas/pedido.js';
import { vistaInventario, vistaProductoForm } from './vistas/inventario.js';
import { vistaAjustes } from './vistas/ajustes.js';

const RUTAS = [
  [/^\/login$/, vistaLogin, null],
  [/^\/rutas$/, vistaRutas, 'rutas'],
  [/^\/rutas\/nueva$/, (p) => vistaRutaForm(p, null), 'rutas'],
  [/^\/rutas\/(\w+)\/editar$/, (p, id) => vistaRutaForm(p, id), 'rutas'],
  [/^\/rutas\/(\w+)$/, vistaRuta, 'rutas'],
  [/^\/clientes$/, vistaClientes, 'clientes'],
  [/^\/clientes\/nuevo$/, (p) => vistaClienteForm(p, null), 'clientes'],
  [/^\/clientes\/(\d+)\/editar$/, (p, id) => vistaClienteForm(p, id), 'clientes'],
  [/^\/clientes\/(\d+)\/pedido$/, vistaPedido, 'clientes'],
  [/^\/clientes\/(\d+)$/, vistaCliente, 'clientes'],
  [/^\/inventario$/, vistaInventario, 'inventario'],
  [/^\/inventario\/nuevo$/, (p) => vistaProductoForm(p, null), 'inventario'],
  [/^\/inventario\/(\d+)$/, (p, id) => vistaProductoForm(p, id), 'inventario'],
  [/^\/ajustes$/, vistaAjustes, 'ajustes'],
];

let sesion = false;

async function mostrar() {
  const ruta = (location.hash || '#/rutas').slice(1).split('?')[0];
  if (!sesion && ruta !== '/login') return ir('#/login');
  if (sesion && ruta === '/login') return ir('#/rutas');
  const [_, fn, tab] = RUTAS.find(([re]) => re.test(ruta)) || [null, null, null];
  if (!fn) return ir('#/rutas');
  const params = ruta.match(RUTAS.find(([re]) => re.test(ruta))[0]).slice(1);
  document.body.dataset.tab = tab || '';
  $$('#tabs a').forEach((a) => a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'));
  const vista = $('#vista');
  vista.innerHTML = '<div class="cargando" aria-label="Cargando"></div>';
  vista.scrollTop = 0;
  try {
    await fn(vista, ...params);
  } catch (e) {
    console.error(e);
    barra({ titulo: 'Algo salió mal', atras: '#/rutas' });
    vista.innerHTML = `<div class="vacio"><p class="vacio-t">No se pudo cargar esta pantalla</p><p>${esc(e.message)}</p>
      <button class="btn sec" onclick="location.reload()">Reintentar</button></div>`;
  }
}

window.addEventListener('hashchange', mostrar);
window.addEventListener('coveca:sesion', (e) => { sesion = e.detail; ir(sesion ? '#/rutas' : '#/login'); });

(async () => {
  try { sesion = await datos.iniciar(); } catch (e) { sesion = false; }
  document.body.classList.toggle('demo', datos.enDemo());
  mostrar();
})();
