// Arranque y enrutador de la app (rutas con #/...).
import './registro.js';   // primero: anota errores y pantallas para los tickets de soporte
import './capturas.js';   // capturas de las últimas pantallas para los tickets (solo administradores)
import { $, $$, barra, ir, esc, desviarBarra, verFoto, aviso, icono } from './ui.js';
import * as datos from './datos.js';
import { vistaLogin } from './vistas/login.js';
import { vistaRutas, vistaRuta, vistaRutaForm } from './vistas/rutas.js';
import { vistaClientes, vistaCliente, vistaClienteForm } from './vistas/clientes.js';
import { vistaPedido, vistaCotizacion as vistaArmarCotizacion, vistaCotizacionNueva, vistaConvertirNuevo } from './vistas/pedido.js';
import { vistaCotizaciones, vistaCotizacion } from './vistas/cotizaciones.js';
import { vistaInventario, vistaProductoForm } from './vistas/inventario.js';
import { vistaAjustes } from './vistas/ajustes.js';
import { vistaNuevo } from './vistas/nuevo.js';
import { vistaImpresora } from './vistas/ajustes-impresora.js';
import { vistaSoporte } from './vistas/soporte.js';
import { vistaCatalogo } from './vistas/catalogo.js';
import { vistaProgramaLealtad, vistaReporteLealtad } from './vistas/lealtad.js';
import { revisarActualizacion } from './actualizacion.js';
import { vistaRecorrido } from './vistas/recorrido.js';
import { vistaReportes, vistaStockBajo, vistaVentasSemana } from './vistas/reportes.js';
import { vistaProveedores, vistaProveedor, vistaProveedorForm } from './vistas/proveedores.js';
import { vistaPedidoProveedorForm, vistaPedidoProveedor, vistaPedidosProveedor } from './vistas/pedidos-proveedor.js';
import { vistaPedidoLibre } from './vistas/pedido-libre.js';
import { vistaRevisiones, vistaRevision } from './vistas/revisiones.js';
import { vistaPendientes } from './vistas/pendientes.js';
import { vistaCarga } from './vistas/carga.js';
import { vistaNota } from './vistas/nota.js';
import { vistaCambioNuevo, vistaCambio } from './vistas/cambios.js';
import { vistaPedidos } from './vistas/pedidos.js';
import { vistaNegocio } from './vistas/negocio.js';
import { vistaCierre } from './vistas/cierre.js';
import { vistaCobrar, vistaReglasFiado } from './vistas/fiado.js';
import { vistaCompras, vistaCompraNueva, vistaCompra } from './vistas/compras.js';
import { vistaTickets, vistaTicketNuevo, vistaTicket, limpiarVideosSiToca } from './vistas/tickets.js';
import { puedeDividir, marcarActual } from './escritorio.js';
import './externo.js';
import { invitarApp } from './abrir-app.js';
import './atras.js';
import { activarMenuMas, EN_MAS } from './menu-mas.js';
import { aplicarBarraEstado } from './barra-estado.js';
import { siluetas, pantallaInicio } from './anima.js';
import { abrirTour, tourPendiente } from './tour.js';
import { abrirNovedades, novedadesVistas } from './novedades.js';
import { revisarAvisosTickets } from './avisos-tickets.js';
import { subirErrores } from './errores-sync.js';
import { Camara } from './nativo.js';

const RUTAS = [
  [/^\/login$/, vistaLogin, null],
  [/^\/rutas$/, vistaRutas, 'rutas'],
  [/^\/rutas\/nueva$/, (p) => vistaRutaForm(p, null), 'rutas'],
  [/^\/rutas\/(\w+)\/editar$/, (p, id) => vistaRutaForm(p, id), 'rutas'],
  [/^\/rutas\/(\w+)\/recorrido$/, vistaRecorrido, 'rutas'],
  [/^\/rutas\/(\w+)$/, vistaRuta, 'rutas'],
  [/^\/clientes$/, vistaClientes, 'clientes'],
  [/^\/clientes\/nuevo$/, (p) => vistaClienteForm(p, null), 'clientes'],
  [/^\/clientes\/(\d+)\/editar$/, (p, id) => vistaClienteForm(p, id), 'clientes'],
  [/^\/clientes\/(\d+)\/pedido$/, vistaPedido, 'clientes'],
  [/^\/clientes\/(\d+)\/cotizacion$/, vistaArmarCotizacion, 'clientes'],
  [/^\/catalogo$/, vistaCatalogo, 'catalogo'],
  [/^\/cotizaciones$/, vistaCotizaciones, 'cotizaciones'],
  [/^\/cotizaciones\/nueva$/, vistaCotizacionNueva, 'cotizaciones'],
  [/^\/cotizaciones\/([\w-]+)\/convertir$/, vistaConvertirNuevo, 'cotizaciones'],
  [/^\/cotizaciones\/([\w-]+)$/, vistaCotizacion, 'cotizaciones'],
  [/^\/clientes\/(\d+)$/, vistaCliente, 'clientes'],
  [/^\/pedidos$/, vistaPedidos, 'pedidos'],
  [/^\/pedidos\/([\w-]+)$/, vistaNota, 'clientes'],
  [/^\/pedidos\/([\w-]+)\/cambio$/, vistaCambioNuevo, 'pedidos'],
  [/^\/cambios\/([\w-]+)$/, vistaCambio, 'pedidos'],
  [/^\/inventario$/, vistaInventario, 'inventario'],
  [/^\/inventario\/nuevo$/, (p) => vistaProductoForm(p, null), 'inventario'],
  [/^\/inventario\/(\d+)$/, (p, id) => vistaProductoForm(p, id), 'inventario'],
  [/^\/compras$/, vistaCompras, 'proveedores'],
  [/^\/compras\/nueva$/, vistaCompraNueva, 'proveedores'],
  [/^\/compras\/([\w-]+)$/, vistaCompra, 'proveedores'],
  [/^\/reportes$/, vistaReportes, 'reportes'],
  [/^\/reportes\/carga$/, vistaCarga, 'reportes'],
  [/^\/reportes\/cierre$/, vistaCierre, 'reportes'],
  [/^\/reportes\/stock-bajo$/, vistaStockBajo, 'reportes'],
  [/^\/reportes\/cobrar$/, vistaCobrar, 'reportes'],
  [/^\/nuevo$/, vistaNuevo, 'nuevo'],
  [/^\/fiado$/, vistaReglasFiado, 'ajustes'],
  [/^\/negocio$/, vistaNegocio, 'ajustes'],
  [/^\/reportes\/ventas-semana$/, vistaVentasSemana, 'reportes'],
  [/^\/proveedores$/, vistaProveedores, 'proveedores'],
  [/^\/proveedores\/nuevo$/, (p) => vistaProveedorForm(p, null), 'proveedores'],
  [/^\/proveedores\/pedido-libre$/, vistaPedidoLibre, 'proveedores'],
  [/^\/proveedores\/(\d+)\/editar$/, (p, id) => vistaProveedorForm(p, id), 'proveedores'],
  [/^\/proveedores\/(\d+)$/, vistaProveedor, 'proveedores'],
  [/^\/proveedores\/(\d+)\/pedido$/, vistaPedidoProveedorForm, 'proveedores'],
  [/^\/pedidos-proveedor$/, vistaPedidosProveedor, 'proveedores'],
  [/^\/pedidos-proveedor\/([\w-]+)$/, vistaPedidoProveedor, 'proveedores'],
  [/^\/ajustes$/, vistaAjustes, 'ajustes'],
  [/^\/ajustes\/impresora$/, vistaImpresora, 'ajustes'],
  [/^\/ajustes\/avanzado$/, () => ir('#/ajustes/impresora'), 'ajustes'],   // dirección antigua (antes de 2.3.0)
  [/^\/soporte$/, vistaSoporte, 'soporte'],
  [/^\/pendientes$/, vistaPendientes, 'ajustes'],
  [/^\/lealtad$/, vistaProgramaLealtad, 'lealtad'],
  [/^\/revisiones$/, vistaRevisiones, 'ajustes'],
  [/^\/revisiones\/(\d+)$/, vistaRevision, 'ajustes'],
  [/^\/tickets$/, vistaTickets, 'soporte'],
  [/^\/tickets\/nuevo$/, vistaTicketNuevo, 'soporte'],
  [/^\/tickets\/([\w-]+)$/, vistaTicket, 'soporte'],
  [/^\/reportes\/lealtad$/, vistaReporteLealtad, 'reportes'],
];

let sesion = false;
let rutaAnterior = null, tabAnterior = null;

// Recorrido "Cómo funciona": siempre al entrar al modo de ejemplo; con sesión real, la primera vez de cada usuario.
// Si no toca el recorrido, se muestra lo nuevo de la versión (js/novedades.js). Nada de esto en pruebas automáticas.
const quizasTour = (alEntrar) => {
  if (!sesion || navigator.webdriver) return;
  if (datos.enDemo()) { if (alEntrar) abrirTour(); return; }
  if (tourPendiente()) { abrirTour(); novedadesVistas(); } else abrirNovedades();
};

// Mensaje cuando una pantalla no se pudo cargar (sin señal, error del servidor…), con botón para reintentar.
const pantallaError = (e) => `<div class="vacio"><p class="vacio-t">No se pudo cargar esta pantalla</p><p>${esc(e.message)}</p>
  <button class="btn sec" onclick="location.reload()">Reintentar</button></div>`;

// Dirección de la animación al cambiar de pantalla: más profunda = adelante, menos = atrás, otra pestaña = suave.
function direccion(ruta, tab) {
  if (rutaAnterior === null) return 'inicio';
  if (tab !== tabAnterior) return 'tab';
  const prof = (r) => r.split('/').filter(Boolean).length;
  return prof(ruta) > prof(rutaAnterior) ? 'adelante' : prof(ruta) < prof(rutaAnterior) ? 'atras' : 'tab';
}
function animar(vista, dir) {
  vista.classList.remove('anim-adelante', 'anim-atras', 'anim-tab', 'anim-inicio', 'animando');
  void vista.offsetWidth;                      // reinicia la animación
  vista.classList.add('anim-' + dir, 'animando');
  clearTimeout(vista._anim);
  vista._anim = setTimeout(() => vista.classList.remove('animando'), 700); // las listas solo se escalonan al entrar
}

// Cada pantalla tiene su turno: si se abre otra antes de que termine de cargar (toques rápidos,
// vuelta de la señal), la anterior se descarta sin mostrar "Algo salió mal".
let turno = 0;
async function mostrar() {
  const mio = ++turno;
  const ruta = (location.hash || '#/rutas').slice(1).split('?')[0];
  if (!sesion && ruta !== '/login') return ir('#/login');
  if (sesion && ruta === '/login') return ir('#/rutas');
  const encontrada = RUTAS.find(([re]) => re.test(ruta));
  if (!encontrada) return ir('#/rutas');
  const [re, fn, tab] = encontrada;
  const params = ruta.match(re).slice(1);
  document.body.dataset.tab = tab || '';
  const u = sesion ? datos.usuario() : null;   // pie del menú en PC: quién está conectado
  $('#tabs-usuario').textContent = u ? `${u.nombre} · ${u.rol === 'admin' ? 'Administrador' : 'Vendedor'}` : '';
  $$('#tabs a').forEach((a) => a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'));
  ['proveedores', 'lealtad'].forEach((t) => $(`#tabs [data-tab="${t}"]`)?.toggleAttribute('hidden', !(sesion && datos.esAdmin())));   // solo administradores
  $('#tab-mas')?.toggleAttribute('data-actual', EN_MAS.includes(tab));   // "Más" se marca en Inventario, Reportes y Ajustes
  let vista = $('#vista');
  // Crear un producto desde una compra (?desde=compra) va a pantalla completa: al guardar se vuelve a la compra.
  const fam = puedeDividir() && !/[?&]desde=compra/.test(location.hash) ? FAMILIAS.find((f) => f.lista.test(ruta) || f.ficha.test(ruta)) : null;
  if (fam) {
    rutaAnterior = ruta; tabAnterior = tab;
    try { await mostrarDividida(vista, fam, ruta, fn, params); }
    catch (e) { if (mio !== turno) return; console.error(e); $('#panel-ficha')?.replaceChildren(); vista.innerHTML = pantallaError(e); }
    if (mio === turno) pantallaLista();
    return;
  }
  // Contenedor nuevo para cada pantalla: si una carga anterior termina tarde, escribe en el suyo (ya fuera
  // de la página) y no encima de esta.
  const nueva = vista.cloneNode(false);
  nueva.className = 'vista';
  vista.replaceWith(nueva);
  vista = nueva;
  vista.innerHTML = siluetas();   // siluetas de tarjetas mientras carga
  const dir = direccion(ruta, tab);
  rutaAnterior = ruta; tabAnterior = tab;
  try {
    await fn(vista, ...params);
    if (mio === turno) animar(vista, dir);
  } catch (e) {
    if (mio !== turno) return;
    console.error(e);
    barra({ titulo: 'Algo salió mal', atras: '#/rutas' });
    vista.innerHTML = pantallaError(e);
  }
  if (mio === turno) pantallaLista();
}
// Pantalla terminada de cargar (o con error): las capturas de los tickets toman una cuando quede quieta.
function pantallaLista() { window.dispatchEvent(new Event('coveca:pantalla')); }

// ---------- Escritorio: lista y ficha lado a lado ----------
// En PC, Inventario, Clientes y Proveedores muestran la lista a la izquierda y la ficha a la derecha.
// La lista se conserva (con su búsqueda y scroll) al pasar de una ficha a otra; se recarga al volver
// a la lista sola o cuando una ficha guarda cambios (evento coveca:lista).
const FAMILIAS = [
  { nombre: 'inventario', lista: /^\/inventario$/, ficha: /^\/inventario\/(nuevo|\d+)$/, fnLista: vistaInventario },
  { nombre: 'clientes', lista: /^\/clientes$/, ficha: /^\/clientes\/(nuevo|\d+)(\/editar)?$/, fnLista: vistaClientes },
  { nombre: 'proveedores', lista: /^\/proveedores$/, ficha: /^\/proveedores\/(nuevo|pedido-libre|\d+)(\/editar|\/pedido)?$/, fnLista: vistaProveedores },
];

// Pinta (o vuelve a pintar) la lista del panel izquierdo sin tocar la barra superior de la ficha.
async function pintarLista(div) {
  const fam = FAMILIAS.find((f) => f.nombre === div.dataset.fam);
  const pl = $('#panel-lista', div), sc = pl.scrollTop, caja = document.createElement('div');
  desviarBarra(caja);
  const listo = fam.fnLista(pl);      // la barra se escribe antes de la primera espera
  desviarBarra(null);
  await listo;
  pl.scrollTop = sc;
  pl._barra = caja.innerHTML;
  marcarActual(pl);
}
window.addEventListener('coveca:lista', () => { const div = document.querySelector('.dividida'); if (div) pintarLista(div).catch(console.error); });

async function mostrarDividida(vista, fam, ruta, fn, params) {
  let div = vista.querySelector(':scope > .dividida');
  const nueva = !div || div.dataset.fam !== fam.nombre;
  const esFicha = fam.ficha.test(ruta);
  if (nueva) {
    vista.innerHTML = `<div class="dividida" data-fam="${fam.nombre}">
      <section id="panel-lista" class="panel-lista" aria-label="Lista">${siluetas()}</section>
      <section id="panel-ficha" class="panel-ficha" aria-label="Ficha"></section></div>`;
    div = vista.firstElementChild;
  }
  const pl = $('#panel-lista', div);
  let pf = $('#panel-ficha', div);
  if (esFicha) { const n = pf.cloneNode(false); n.className = 'panel-ficha'; pf.replaceWith(n); pf = n; }   // igual que #vista: cada ficha en su contenedor
  div.classList.toggle('con-ficha', esFicha);
  if (nueva || !esFicha) await pintarLista(div);
  marcarActual(pl);
  if (esFicha) {
    pf.innerHTML = siluetas();
    pf.scrollTop = 0;
    await fn(pf, ...params);
    pf.classList.remove('entra'); void pf.offsetWidth; pf.classList.add('entra');
    if (/\/nuevo$/.test(ruta)) pf.querySelector('input[name="nombre"]')?.focus();   // listo para escribir
  } else {
    pf.replaceChildren();
    $('#barra').innerHTML = pl._barra || '';
  }
}

// Tecla "/" (como en muchos sitios): lleva al buscador de la pantalla, si hay uno y no se está escribiendo en un campo.
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  const q = document.querySelector('#vista .buscador input, #panel-lista .buscador input');
  if (q && q.offsetParent !== null) { e.preventDefault(); q.focus(); q.select(); }
});

// Esc cierra la ficha abierta al lado (si no se está escribiendo en un campo).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  const div = document.querySelector('.dividida.con-ficha');
  if (div) location.hash = '#/' + div.dataset.fam;
});
window.addEventListener('coveca:escritorio', () => { $('#vista').replaceChildren(); mostrar(); });

window.addEventListener('hashchange', mostrar);
// Una foto tomada sin señal terminó de subir (ticket N° 15): la ruta o la ficha abierta se redibuja sin "Foto por subir"
window.addEventListener('coveca:fotos', () => { if (/^#\/(rutas|clientes)/.test(location.hash) && !document.querySelector('.imp-capa, .cobro-capa')) mostrar(); });
// Atajo de Android (mantener presionado el ícono → "Nuevo pedido"): MainActivity llama a covecaIr('#/nuevo').
window.covecaIr = (h) => { if (location.hash !== h) location.hash = h; else mostrar(); return true; };
// "Tomar foto" en la app Android: abre la cámara con el plugin oficial (el selector del sistema abría la galería en
// algunos celulares, como el Motorola con Android 16; reporte del 14-10-2026). La foto se entrega al mismo
// <input type=file> de siempre, así el resto (recorte, reducción, subida) no cambia. En la web sigue igual.
document.addEventListener('click', async (e) => {
  const label = Camara && e.target.closest('label');
  const input = label?.querySelector('input[type="file"][capture]:not([accept^="video"])');   // grabar video: lo maneja el selector del sistema
  if (!input) return;
  e.preventDefault();
  try {
    const f = await Camara.getPhoto({ source: 'CAMERA', resultType: 'base64', quality: 85, correctOrientation: true, saveToGallery: false, width: 2000 });
    const bin = atob(f.base64String); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const tipo = `image/${f.format === 'png' ? 'png' : 'jpeg'}`;
    const dt = new DataTransfer(); dt.items.add(new File([bytes], `foto.${f.format || 'jpg'}`, { type: tipo }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (err) {
    const m = String(err?.message || err);
    if (/cancel/i.test(m)) return;   // la persona cerró la cámara sin sacar foto
    aviso(/denied|permission/i.test(m) ? 'Sin permiso para usar la cámara. Actívalo en Ajustes del celular → Apps → COVECA → Permisos.' : 'No se pudo abrir la cámara. Intenta de nuevo o usa Galería.', 'error');
  }
});

// Tocar la foto de la fachada (ficha del cliente) o del producto la abre en grande.
document.addEventListener('click', (e) => {
  const img = e.target.closest('.perfil-foto.con-foto img.foto, .prod-foto img.mini');
  if (img) { e.preventDefault(); verFoto(img.src, img.closest('.prod-foto') ? 'Foto del producto' : 'Foto del local'); }
});
window.addEventListener('coveca:sesion', (e) => { sesion = e.detail; ir(sesion ? '#/rutas' : '#/login'); setTimeout(() => quizasTour(true), 800);
  if (sesion) { setTimeout(limpiarVideosSiToca, 10000); setTimeout(() => revisarAvisosTickets({ forzar: true }), 3000); setTimeout(subirErrores, 15000); } });

activarMenuMas();
aplicarBarraEstado();
const finInicio = pantallaInicio();   // la C pixelada se arma mientras carga la app
(async () => {
  try { sesion = await datos.iniciar(); } catch (e) { sesion = false; }
  document.body.classList.toggle('demo', datos.enDemo());
  pintarCinta();
  await mostrar();
  finInicio();
  setTimeout(() => quizasTour(false), 1300);
  revisarActualizacion();
  invitarApp();
  if (sesion) setTimeout(limpiarVideosSiToca, 10000);   // después de cargar la primera pantalla
  if (sesion) setTimeout(() => revisarAvisosTickets({ forzar: true }), 3000);   // tickets propios que cambiaron de estado
  if (sesion) setTimeout(subirErrores, 15000);   // errores silenciosos del celular (máx. cada 30 min)
})();

// Al volver a la app (estaba en segundo plano) o al recuperar señal: buscar actualización y subir lo pendiente.
// Si cambió el día y está en el inicio, se redibuja para que "Ruta de hoy" muestre la ruta correcta.
let diaVisto = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  revisarActualizacion(); if (sesion) { datos.sincronizar(); revisarAvisosTickets(); }
  const hoy = new Date().toDateString();
  if (hoy === diaVisto) return;
  diaVisto = hoy;
  const pantalla = (location.hash || '#/rutas').split('?')[0];
  if (sesion && (pantalla === '#/rutas' || pantalla === '#' || pantalla === '#/')) mostrar();
});
window.addEventListener('online', revisarActualizacion);

// Cinta de estado bajo la barra: sin señal y/o pedidos por subir. Toca para ver el detalle.
function pintarCinta() {
  const c = $('#cinta-red');
  const cola = sesion ? datos.colaCompleta() : [];   // pedidos y abonos
  const errores = cola.filter((x) => x.estado === 'error').length;
  const sinRed = sesion && !datos.hayRed();
  const debil = sesion && !sinRed && datos.senalDebil();   // el servidor tardó: se muestran los datos guardados
  const n = cola.length;
  c.hidden = !sinRed && !debil && !n;
  if (c.hidden) return;
  const pedidos = n ? `${n} ${cola.every((x) => x.pedido) ? `pedido${n === 1 ? '' : 's'}` : `registro${n === 1 ? '' : 's'}`} por subir` : '';
  c.classList.toggle('problema', !!errores);
  c.innerHTML = `${icono(errores ? 'alerta' : 'sinNube', 'ico-s')}<span>${errores ? `${errores} ${errores === 1 ? 'registro' : 'registros'} con problema · toca para revisar`
    : sinRed ? `Sin señal${n ? ' · ' + pedidos : ' · puedes seguir tomando pedidos'}`
    : debil ? `Señal débil · mostrando datos guardados${n ? ' · ' + pedidos : ''}` : `${pedidos} · toca para subir`}</span>`;
}
window.addEventListener('coveca:red', pintarCinta);
window.addEventListener('coveca:cola', pintarCinta);
window.addEventListener('coveca:sesion', pintarCinta);
window.addEventListener('hashchange', pintarCinta);
// Mientras haya pedidos en cola o fotos por subir, reintenta cada minuto (por si el celular no avisa que volvió la señal).
setInterval(() => { if (sesion && (datos.colaCompleta().length || datos.fotosPorSubir())) datos.sincronizar(); }, 60000);   // también fotos por subir (ticket N° 15)
