// Cotizaciones (migración 0051, pedido del 21-10-2026): precios para el cliente sin generar una nota de venta.
// Se arman con la misma pantalla del pedido (#/clientes/:id/cotizacion, pedido.js en modo cotización), se envían por
// WhatsApp (el mismo PDF que se guarda), se imprimen (térmica o PC) y se convierten en pedido
// (#/clientes/:id/pedido?cotizacion=<id>). No usan numeración, no mueven stock ni cuentan en ventas.
import { $, esc, barra, icono, vacio, aviso, ir, clp, fechaHora, plural, normal, leerAjuste, guardarAjuste, hoyChile, diaChile } from '../ui.js';
import * as datos from '../datos.js';
import { notaPdf } from '../nota-pdf.js';
import { guardarPdf, enviarPdfWhatsApp, imprimirPdf } from '../pdf.js';
import { hayTermica, imprimirCotizacion } from '../impresora.js';
import { esEscritorio } from '../escritorio.js';

export const VALIDEZ_MAX = 60;          // días; igual que la base
const VALIDEZ_DEFECTO = 3;
// La validez que se eligió la última vez en este equipo (en días desde hoy)
export const validezPorDefecto = () => { const n = Number(leerAjuste('coveca-validez-cot', VALIDEZ_DEFECTO)); return n >= 0 && n <= VALIDEZ_MAX ? n : VALIDEZ_DEFECTO; };
export const guardarValidez = (hasta) => guardarAjuste('coveca-validez-cot', String(Math.round((Date.parse(hasta) - Date.parse(hoyChile())) / 864e5)));

const fechaCorta = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '') : '');
const fechaLarga = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '');
const diaHecha = (q) => diaChile(q.fecha);

// Estado de una cotización: convertida (tiene nota), vigente o vencida.
export function estadoCot(q) {
  if (q.pedido_id && q.nota?.estado !== 'anulado') return { clave: 'convertida', chip: `<span class="chip ok">${icono('check', 'ico-s')} Convertida en pedido</span>` };
  if (datos.cotizacionVigente(q)) return { clave: 'vigente', chip: `<span class="chip">${icono('reloj', 'ico-s')} Vigente</span>`, hasta: `Hasta ${fechaCorta(q.valida_hasta)}` };
  return { clave: 'vencida', chip: `<span class="chip visita-sin">${icono('alerta', 'ico-s')} Vencida</span>` };
}
const chipNuevo = (q) => (q.cliente_id == null ? `<span class="chip visita-sin">${icono('clientes', 'ico-s')} Cliente nuevo</span>` : '');
const chipSubir = (q) => (q.porSubir ? `<span class="chip">${icono('sinNube', 'ico-s')} Por subir</span>` : '');

// Fila de la lista (también en la ficha del cliente)
export const filaCot = (q, conCliente = true) => `
  <a class="fila" href="#/cotizaciones/${esc(q.id)}"><div class="fila-txt">
    <p class="fila-t">${conCliente ? esc(q.cliente) : `Cotización del ${esc(fechaCorta(diaHecha(q)))}`}</p>
    <p class="fila-s">${conCliente ? `${esc(fechaCorta(diaHecha(q)))} · ` : ''}${plural(q.items.length, 'producto')}${estadoCot(q).hasta ? ` · ${esc(estadoCot(q).hasta)}` : ''}</p>
    <div class="fila-chips">${estadoCot(q).chip}${chipNuevo(q)}${chipSubir(q)}</div></div>
    <span class="monto">${clp(q.total)}</span>${icono('derecha', 'ico-chev')}</a>`;

// ---------------------------------------------------------------- Lista
const FILTROS = [['vigente', 'Vigentes'], ['vencida', 'Vencidas'], ['convertida', 'Convertidas'], ['todas', 'Todas']];
export async function vistaCotizaciones(v) {
  barra({ titulo: 'Cotizaciones', sub: `Últimos 60 días` });
  const lista = await datos.cotizaciones();
  let filtro = sessionStorage.getItem('coveca-cot-filtro') || 'vigente', busca = '';
  const cuenta = (k) => (k === 'todas' ? lista.length : lista.filter((q) => estadoCot(q).clave === k).length);
  v.innerHTML = `
    <div class="pad"><div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Buscar cliente" aria-label="Buscar cliente" autocomplete="off"></div></div>
    <div class="filtros" role="tablist">${FILTROS.map(([k, t]) => `<button class="filtro" data-f="${k}" role="tab" aria-selected="${k === filtro}">${t} <span class="n">${cuenta(k)}</span></button>`).join('')}</div>
    <p id="resumen" class="fila-s pad-x"></p>
    <div id="res"></div>
    <div class="pie-fijo"><a class="btn prin" href="#/nuevo?tipo=cotizacion">${icono('mas')} Nueva cotización</a></div>`;
  const pintar = () => {
    const b = normal(busca);
    const vis = lista.filter((q) => (filtro === 'todas' || estadoCot(q).clave === filtro) && (!b || normal(q.cliente).includes(b)));
    $('#resumen', v).textContent = vis.length ? `${plural(vis.length, 'cotización', 'cotizaciones')} · ${clp(vis.reduce((s, q) => s + q.total, 0))}` : '';
    $('#res', v).innerHTML = vis.length ? `<div class="lista">${vis.map((q) => filaCot(q)).join('')}</div>`
      : vacio(lista.length ? 'No hay cotizaciones con este filtro' : 'Aún no hay cotizaciones', 'Para hacer una, toca "Nueva cotización" y elige el cliente.');
    v.querySelectorAll('.filtro').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.f === filtro)));
  };
  v.querySelectorAll('.filtro').forEach((x) => x.addEventListener('click', () => { filtro = x.dataset.f; sessionStorage.setItem('coveca-cot-filtro', filtro); pintar(); }));
  $('#q', v).addEventListener('input', (e) => { busca = e.target.value.trim(); pintar(); });
  pintar();
}

// ---------------------------------------------------------------- Documento (PDF y térmica)
const leyendaCot = (q) => `Precios válidos hasta el ${fechaLarga(q.valida_hasta)}. Esta cotización no es una nota de venta ni reserva productos en bodega.`;
const nombreArchivo = (q) => `Cotizacion-COVECA-${normal(q.cliente).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'cliente'}-${diaHecha(q)}.pdf`;
const vendedorDe = (q) => (q.propia ? datos.usuario()?.nombre || '' : '');
// estilo 'azul' = WhatsApp y Guardar en PDF (diseño C); 'limpia' = imprimir en hoja desde el PC (diseño B)
async function pdfCot(q, estilo) {
  const negocio = await datos.configuracion();
  return notaPdf({ tipo: 'cotizacion', id: q.id, fecha: q.fecha, valida_hasta: q.valida_hasta, cliente: q.clienteDatos || { nombre: q.cliente },
    vendedor: vendedorDe(q), items: q.items, subtotal: q.subtotal, descuento: q.descuento, total: q.total, leyenda: leyendaCot(q) }, negocio, estilo);
}

// ---------------------------------------------------------------- Detalle
export async function vistaCotizacion(v, id) {
  const q = await datos.cotizacion(id);
  const nueva = new URLSearchParams(location.hash.split('?')[1] || '').get('nueva') === '1';
  barra({ titulo: 'Cotización', sub: q.cliente, atras: nueva && q.cliente_id != null ? `#/clientes/${q.cliente_id}` : '#/cotizaciones' });
  if (q.eliminada_en) {
    v.innerHTML = vacio('Esta cotización se eliminó', 'Ya no aparece en la lista. Si el cliente la necesita, haz una nueva.');
    return;
  }
  const est = estadoCot(q);
  const activo = q.clienteDatos ? q.clienteDatos.activo !== false : true;
  const notaVigente = !!q.pedido_id && q.nota?.estado !== 'anulado';   // sin señal la nota puede no estar en el celular: se da por convertida
  const puedeConvertir = !notaVigente && activo;
  const puedeEliminar = datos.esAdmin() || q.propia;
  const termica = hayTermica(), pcHoja = !termica && esEscritorio();
  // Un solo botón principal: recién guardada → enviarla; después → convertirla en pedido (si se puede)
  const principal = nueva || !puedeConvertir ? 'wa' : 'convertir';
  const btnWa = (prin) => `<button type="button" id="cot-wa" class="btn ${prin ? 'prin' : 'sec'}">${icono('whatsapp')} Enviar por WhatsApp</button>`;
  // Cliente nuevo: al convertir se elige la ruta y se crea el cliente junto con la nota
  const hrefConv = q.cliente_id == null ? `#/cotizaciones/${esc(q.id)}/convertir` : `#/clientes/${q.cliente_id}/pedido?cotizacion=${esc(q.id)}`;
  const btnConv = (prin) => `<a class="btn ${prin ? 'prin' : 'sec'}" href="${hrefConv}">${icono('nota')} Convertir en pedido</a>`;
  v.innerHTML = `
    <div class="nota-cab pad"><div class="nota-chips">${est.chip}${chipNuevo(q)}${chipSubir(q)}</div><p class="fila-s">Hecha el ${esc(fechaHora(q.fecha))}</p></div>
    <div class="cot-tarjeta pad-x"><div class="cot-valida ${est.clave}">
      <span class="cot-ico" aria-hidden="true">${icono(est.clave === 'convertida' ? 'check' : est.clave === 'vencida' ? 'alerta' : 'reloj')}</span>
      <div class="fila-txt">
        <p class="fila-t">${est.clave === 'vencida' ? 'Venció el' : 'Válida hasta el'} ${esc(fechaLarga(q.valida_hasta))}</p>
        <p class="fila-s">${notaVigente ? 'El cliente hizo el pedido con esta cotización.'
          : est.clave === 'vencida' ? 'Si el cliente pide ahora, el pedido usa los precios de hoy.'
          : 'Si el cliente pide hasta ese día, se respetan estos precios.'}</p>
        ${q.nota ? `<a class="nota-enlace" href="#/pedidos/${esc(q.nota.id)}">${q.nota.numero ? `Nota N° ${q.nota.numero}` : 'Ver la nota'}${q.nota.estado === 'anulado' ? ' (anulada)' : ''} ${icono('derecha', 'ico-s')}</a>`
          : q.pedido_id ? `<a class="nota-enlace" href="#/pedidos/${esc(q.pedido_id)}">Ver la nota ${icono('derecha', 'ico-s')}</a>` : ''}
      </div></div></div>
    ${q.porSubir ? `<p class="nota-sin-senal pad-x">${icono('sinNube', 'ico-s')} Guardada en el celular: se sube sola cuando vuelva la señal. Igual puedes enviarla o imprimirla.</p>` : ''}

    <h2 class="sec-t">Productos</h2>
    <div class="lista">${q.items.map((i) => `
      <div class="fila"><div class="fila-txt"><p class="fila-t">${esc(i.nombre)}</p>
        <p class="fila-s">${i.cantidad} × ${clp(i.precio)}${datos.esAdmin() && i.precio_lista > i.precio ? ` · <span class="txt-ambar">lista ${clp(i.precio_lista)}</span>` : ''}</p></div><span class="monto">${clp(i.subtotal ?? i.cantidad * i.precio)}</span></div>`).join('')}</div>
    <dl class="totales">
      <div><dt>Subtotal</dt><dd class="monto">${clp(q.subtotal)}</dd></div>
      ${q.descuento ? `<div><dt>Descuento</dt><dd class="monto">-${clp(q.descuento)}</dd></div>` : ''}
      <div class="total"><dt>Total</dt><dd class="monto">${clp(q.total)}</dd></div>
    </dl>
    <p class="ayuda pad-x">La cotización no es una nota de venta: no descuenta stock ni cuenta en ventas.</p>

    <div class="pad nota-acciones">
      ${principal === 'convertir' ? btnWa(false) : ''}
      ${principal === 'wa' && puedeConvertir ? btnConv(false) : ''}
      ${termica || pcHoja ? `<button type="button" id="cot-imprimir" class="btn sec">${icono('impresora')} Imprimir</button>` : ''}
      <button type="button" id="cot-pdf" class="btn sec">${icono('descargar')} Guardar en PDF</button>
      ${!activo ? '<p class="ayuda">El cliente está desactivado: para convertirla en pedido, primero hay que reactivarlo.</p>' : ''}
      ${puedeEliminar ? '<button type="button" id="cot-eliminar" class="btn peligro">Eliminar cotización</button>' : ''}
    </div>
    <div class="pie-fijo">${principal === 'convertir' ? btnConv(true) : btnWa(true)}</div>`;

  const conEspera = (sel, fn, error) => $(sel, v)?.addEventListener('click', async (e) => {
    const b = e.currentTarget, html = b.innerHTML; b.disabled = true; b.textContent = 'Preparando…';
    try { await fn(); } catch (err) { aviso(err.message || error, 'error'); }
    b.disabled = false; b.innerHTML = html;
  });
  conEspera('#cot-wa', async () => enviarPdfWhatsApp(await pdfCot(q, 'azul'), nombreArchivo(q),
    { telefono: q.clienteDatos?.telefono || '', texto: `Cotización COVECA para ${q.cliente} · válida hasta el ${fechaLarga(q.valida_hasta)}` }), 'No se pudo enviar por WhatsApp.');
  conEspera('#cot-pdf', async () => aviso(`PDF guardado en ${await guardarPdf(await pdfCot(q, 'azul'), nombreArchivo(q))}`), 'No se pudo generar el PDF.');
  conEspera('#cot-imprimir', async () => {
    if (pcHoja) return imprimirPdf(await pdfCot(q, 'limpia'));
    const yo = datos.usuario();
    await imprimirCotizacion({ fecha: new Date(q.fecha).toLocaleString('es-CL'), validaHasta: new Date(q.valida_hasta + 'T12:00:00').toLocaleDateString('es-CL').replace(/\//g, '-'),
      vendedor: vendedorDe(q) || yo?.nombre || '', terminal: yo?.terminal || '', cliente: q.cliente, descuento: q.descuento, leyenda: leyendaCot(q),
      items: q.items.map((i) => ({ nombre: i.nombre, cant: i.cantidad, precio: i.precio })) }, await datos.configuracion());
    aviso('Cotización impresa');
  }, 'No se pudo imprimir. Revisa que la impresora esté encendida y vuelve a intentar.');
  $('#cot-eliminar', v)?.addEventListener('click', async (e) => {
    if (!confirm('¿Eliminar esta cotización? Deja de aparecer en la lista. La visita al cliente queda registrada.')) return;
    const b = e.currentTarget; b.disabled = true;
    try { await datos.eliminarCotizacion(q.id); aviso('Cotización eliminada'); ir('#/cotizaciones'); }
    catch (err) { aviso(err.message, 'error'); b.disabled = false; }
  });
}

// Bloque de la ficha del cliente: sus últimas cotizaciones y el botón para hacer una.
export function cotizacionesClienteHtml(lista, clienteId, activo) {
  const ult = lista.slice(0, 3);
  return `<h2 class="sec-t">Cotizaciones</h2>
    ${ult.length ? `<div class="lista">${ult.map((q) => filaCot(q, false)).join('')}</div>` : '<p class="texto-suave pad-x">Sin cotizaciones en los últimos 60 días.</p>'}
    ${lista.length > 3 ? `<p class="pad-x"><a class="btn link" href="#/cotizaciones">Ver todas las cotizaciones</a></p>` : ''}
    ${activo ? `<div class="pad"><a class="btn sec" href="#/clientes/${clienteId}/cotizacion">${icono('nota')} Hacer cotización</a></div>` : ''}`;
}
