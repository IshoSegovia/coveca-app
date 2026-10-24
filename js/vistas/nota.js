// Detalle de una nota de venta: productos, totales y estado. Desde aquí se reimprime, se edita
// (anula y crea una nota nueva que la reemplaza) o se anula con motivo.
import { $, esc, barra, icono, aviso, clp, fecha, fechaHora, FORMAS_PAGO } from '../ui.js';
import * as datos from '../datos.js';
import { abrirCobro, textoPago, estadoNota, pasosHtml, tarjetaEstado } from './cobro.js';
import { tieneGps, tieneDireccion, urlIrA } from '../gps.js';
import { imprimirNota, enviarNotaWhatsApp, notaParaEnviar, config } from '../impresora.js';
import { esApp } from '../nativo.js';
import { esEscritorio } from '../escritorio.js';
import { notaPdf } from '../nota-pdf.js';
import { entregado as entregadoAnim } from '../anima.js';
import { imprimirPdf, guardarPdf } from '../pdf.js';
import { cambiosNotaHtml } from './cambios.js';


export async function vistaNota(v, id) {
  const p = await datos.pedido(id);
  const titulo = p.numero ? `Nota N° ${p.numero}` : 'Nota sin número';
  const desdePedidos = new URLSearchParams(location.hash.split('?')[1] || '').get('desde') === 'pedidos';
  barra({ titulo, sub: p.cliente, atras: desdePedidos || p.cliente_id == null ? '#/pedidos' : `#/clientes/${p.cliente_id}` });   // cliente nuevo sin subir: aún no tiene ficha
  const entregada = !!p.entregado_en && p.estado !== 'anulado';
  const anulada = p.estado === 'anulado';
  // Crédito: lo pendiente de esta nota sale del reparto de abonos (las más antiguas se pagan primero).
  const fi = p.forma_pago === 'credito' && !anulada ? await datos.fiadoCliente(p.cliente_id).catch(() => null) : null;
  const est = estadoNota(p, fi ? (fi.notas.find((n) => n.pedido_id === p.id) || { pendiente: p.total }) : null);
  // Antes de entregar: botón "Ir" con GPS al local (por coordenadas o dirección)
  const [cli, cambiosNota] = await Promise.all([
    !anulada && !p.entregado_en ? datos.cliente(p.cliente_id).catch(() => null) : null,
    p.porSubir ? [] : datos.cambios({ pedidoId: p.id }).catch(() => []),   // nota de cambio (ticket N° 12)
  ]);
  const irA = cli && (tieneGps(cli) || tieneDireccion(cli)) ? urlIrA(cli) : null;
  const puede = datos.puedeCorregir(p);
  const puedeEditar = puede && !p.entregado_en;   // una nota entregada se puede anular, no editar
  const sub = p.subtotal ?? p.items.reduce((s, i) => s + i.subtotal, 0);
  const leal = p.descuento_lealtad || 0, desc = p.descuento || 0;
  // Solo el administrador ve si la nota se vendió bajo el precio de lista (migración 0024).
  const verLista = datos.esAdmin() && !anulada;
  const bajo = verLista ? (p.bajo_lista || 0) : 0;
  const bajoItem = (i) => (verLista && i.precio_lista > i.precio ? i.precio_lista : 0);
  const estado = anulada ? `<span class="chip alerta">${icono('alerta', 'ico-s')} Anulada</span>`
    : `${p.porSubir ? `<span class="chip">${icono('sinNube', 'ico-s')} Por subir</span>` : ''}
      ${entregada ? `<span class="chip ok">${icono('check', 'ico-s')} Entregada</span>` : `<span class="chip">${icono('caja', 'ico-s')} Por entregar</span>`}
      ${est.pagada ? `<span class="chip ok">${icono('check', 'ico-s')} Pagada</span>` : est.esCredito ? `<span class="chip visita-sin">${icono('reloj', 'ico-s')} Crédito</span>`
        : entregada ? `<span class="chip visita-sin">${icono('reloj', 'ico-s')} Falta el pago</span>` : ''}`;   // antes de entregar no se habla de pago
  // Pedido → Entregado → Pagado, tarjeta con el estado y acciones según cómo va la nota.
  const deshacer = [
    entregada && !cambiosNota.some((c) => !c.anulado_en) ? '<button type="button" id="deshacer-entrega" class="btn link">Deshacer entrega</button>' : '',   // con un cambio vigente, no
    (est.pagada && !est.esCredito) || (est.esCredito && p.pago_definido_en) ? '<button type="button" id="deshacer-cobro" class="btn link">Deshacer pago</button>' : '',
  ].filter(Boolean).join('');
  const pasos = anulada ? '' : `<div class="pad-x">${pasosHtml(p, est)}${tarjetaEstado(p, est, irA)}
    ${p.marcaPorSubir || p.cobroPorSubir ? `<p class="fila-s">${icono('sinNube', 'ico-s')} Cambios guardados en el celular: se suben solos con señal.</p>` : ''}
    ${deshacer ? `<div class="nota-deshacer">${deshacer}</div>` : ''}</div>`;
  // Botón principal: Entregar → Registrar pago (o abono si es a crédito). Editar queda como secundario.
  const principal = anulada ? ''
    : !entregada ? `<button type="button" id="entregar" class="btn prin">${icono('camion')} Entregar</button>`
    : datos.porCobrar(p) ? `<button type="button" id="cobrar" class="btn prin">${icono('moneda')} Registrar pago</button>`
    : !est.pagada && p.cliente_id != null ? `<a class="btn prin" href="#/clientes/${p.cliente_id}?abono=1">${icono('moneda')} Registrar abono</a>` : '';

  v.innerHTML = `
    <div class="nota-cab pad"><div class="nota-chips">${estado}</div><p class="fila-s">${fechaHora(p.fecha)}</p></div>
    ${anulada ? `<div class="nota-anulada">
      <p class="fila-t">Nota anulada${p.anulado_en ? ' el ' + esc(fechaHora(p.anulado_en)) : ''}</p>
      ${p.anulado_motivo ? `<p class="fila-s">Motivo: ${esc(p.anulado_motivo)}</p>` : ''}
      ${p.reemplazado_por ? `<a class="nota-enlace" href="#/pedidos/${p.reemplazado_por.id}">Reemplazada por la nota N° ${p.reemplazado_por.numero} ${icono('derecha', 'ico-s')}</a>` : ''}
      <p class="fila-s">No cuenta en ventas, carga ni lealtad. El stock ya se devolvió.</p></div>` : ''}
    ${pasos}
    ${p.reemplaza ? `<a class="nota-enlace pad-x" href="#/pedidos/${p.reemplaza.id}">Corrige a la nota N° ${p.reemplaza.numero} ${icono('derecha', 'ico-s')}</a>` : ''}
    ${bajo ? `<div class="nota-bajo-lista">
      <p class="fila-t">${icono('alerta', 'ico-s')} Vendida bajo el precio de lista: ${clp(bajo)} menos</p>
      <p class="fila-s">Los productos marcados se cobraron más barato que su precio de lista. Los descuentos no cuentan aquí.</p></div>` : ''}
    ${p.porSubir ? `<p class="nota-sin-senal pad-x">${icono('sinNube', 'ico-s')} Esta nota está guardada en el celular. Para anularla o editarla, espera a que se suba (necesita señal).</p>` : ''}

    <h2 class="sec-t">Productos</h2>
    <div class="lista">${p.items.map((i) => `
      <div class="fila"><div class="fila-txt"><p class="fila-t">${esc(i.nombre || `Producto ${i.producto_id}`)}</p>
        <p class="fila-s">${i.cantidad} × ${clp(i.precio)}${bajoItem(i) ? ` · <span class="txt-ambar">lista ${clp(bajoItem(i))}</span>` : ''}</p></div><span class="monto">${clp(i.subtotal)}</span></div>`).join('')}</div>
    <dl class="totales">
      <div><dt>Subtotal</dt><dd class="monto">${clp(sub)}</dd></div>
      ${leal ? `<div class="leal"><dt>Descuento cliente ${esc(p.nivel || '')}</dt><dd class="monto">-${clp(leal)}</dd></div>` : ''}
      ${desc ? `<div><dt>Descuento</dt><dd class="monto">-${clp(desc)}</dd></div>` : ''}
      <div class="total"><dt>Total</dt><dd class="monto">${clp(p.total)}</dd></div>
    </dl>
    <dl class="datos">
      ${FORMAS_PAGO[p.forma_pago] ? `<div class="dato"><dt>Forma de pago</dt><dd>${esc(FORMAS_PAGO[p.forma_pago])}</dd></div>` : ''}
      ${p.forma_pago === 'credito' && p.vence_en ? `<div class="dato"><dt>Vence</dt><dd>${fecha(p.vence_en)}</dd></div>` : ''}
      ${p.sobre_limite ? `<div class="dato"><dt>Crédito</dt><dd class="txt-alerta">${icono('alerta', 'ico-s')} Sobre el límite de crédito</dd></div>` : ''}
      ${p.vendedor ? `<div class="dato"><dt>Vendedor</dt><dd>${esc(p.vendedor)}</dd></div>` : ''}
      ${p.terminal ? `<div class="dato"><dt>Terminal</dt><dd>${esc(p.terminal)}</dd></div>` : ''}
    </dl>

    ${cambiosNotaHtml(cambiosNota, p, entregada && !p.porSubir)}
    ${!anulada ? `<div class="pad nota-acciones">
      ${esApp || (esEscritorio() && config.pc === 'termica') ? `<button type="button" id="reimprimir" class="btn sec">${icono('impresora')} Imprimir</button>`
        : esEscritorio() ? `<button type="button" id="imprimir-pc" class="btn sec">${icono('impresora')} Imprimir</button>` : ''}
      <button type="button" id="nota-wa" class="btn sec">${icono('whatsapp')} Enviar por WhatsApp</button>
      <button type="button" id="guardar-hoja" class="btn sec">${icono('descargar')} Guardar en PDF</button>
      ${puede ? `<button type="button" id="abrir-anular" class="btn peligro">Anular pedido</button>
      <form id="form-anular" class="form anular" hidden>
        <label class="campo"><span>Motivo de la anulación</span>
          <input id="motivo" type="text" maxlength="120" placeholder="Ej.: el cliente canceló el pedido" required></label>
        <p class="ayuda">El stock vuelve a bodega y la nota deja de contar en ventas. No se puede deshacer.</p>
        <p id="err-anular" class="error" role="alert"></p>
        <div class="fila-botones"><button type="button" id="cancelar-anular" class="btn sec">Cancelar</button>
          <button type="submit" class="btn peligro sin-margen">Confirmar anulación</button></div>
      </form>` : ''}
      ${!puede && !p.porSubir ? '<p class="ayuda">Solo quien tomó el pedido o un administrador puede anularlo o editarlo.</p>' : ''}
      ${puede && entregada ? '<p class="ayuda">Esta nota ya se entregó: no se puede editar. Si hay que corregirla, anúlala y toma un pedido nuevo (o usa "Registrar cambio" si el cliente cambia productos).</p>' : ''}
      ${puedeEditar ? `<a class="btn sec" href="#/clientes/${p.cliente_id}/pedido?editar=${p.id}">${icono('editar')} Editar pedido</a>` : ''}
    </div>` : ''}
    ${principal ? `<div class="pie-fijo">${principal}</div>` : ''}`;

  const accion = (sel, fn) => $(sel, v)?.addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { if (await fn() !== false) vistaNota(v, id); else b.disabled = false; }
    catch (err) { b.disabled = false; aviso(err.message, 'error'); }
  });
  const resumen = { cliente: p.cliente, total: p.total, cliente_id: p.cliente_id, numero: p.numero };
  // Deuda y límite del cliente, para avisar si dejarla a crédito supera su límite
  const infoCredito = async () => {
    const [f, cl] = await Promise.all([datos.fiadoCliente(p.cliente_id).catch(() => null), datos.cliente(p.cliente_id).catch(() => null)]);
    // Cliente nuevo aún sin subir (sin ficha): nace con límite $0, así que dejarla a crédito avisa.
    return { deuda: f?.deuda ?? 0, limite: p.cliente_id == null ? 0 : cl?.limite_credito ?? null };
  };
  const pedirPago = async (preguntar) => abrirCobro({ total: p.total, numero: p.numero, cliente: p.cliente, preguntar,
    forma: FORMAS_PAGO[p.forma_pago] ? p.forma_pago : 'efectivo', credito: await infoCredito() });
  // Entregar: si la nota no tiene pago registrado, se pregunta cómo pagó (efectivo con vuelto, transferencia o crédito).
  accion('#entregar', async () => {
    if (datos.porCobrar(p)) {
      const r = await pedirPago(true);
      if (!r) return false;
      await datos.marcarEntrega([p.id], true);
      entregadoAnim('¡Entregado!', r.cobrado ? '' : 'Falta registrar cómo pagó');
      if (r.cobrado) await datos.registrarCobro(p.id, true, r.forma, resumen);
      aviso(r.cobrado ? `${titulo} entregada · ${textoPago(r)}` : `${titulo} entregada · falta registrar el pago`);
    } else { await datos.marcarEntrega([p.id], true); entregadoAnim(); aviso(`${titulo} entregada`); }
    // Abierta desde Pedidos (ahí ya no hay botón Entregar, ticket N° 11): vuelve a la lista para seguir la ruta.
    if (desdePedidos) { try { sessionStorage.setItem('coveca-recien-entregado', '1'); } catch (_) {} location.hash = '#/pedidos'; return false; }
  });
  accion('#cobrar', async () => {
    const r = await pedirPago(false);
    if (!r) return false;
    await datos.registrarCobro(p.id, true, r.forma, resumen);
    aviso(`${titulo} ${textoPago(r)}`);
  });
  accion('#deshacer-entrega', async () => { await datos.marcarEntrega([p.id], false); aviso('La nota vuelve a "Por entregar"'); });
  accion('#deshacer-cobro', async () => { await datos.registrarCobro(p.id, false, null, resumen); aviso('Pago deshecho: la nota queda sin pago registrado'); });
  // La nota en la forma que usan la impresión y el PDF (impresora.js)
  const notaApp = () => notaParaEnviar(p, datos.usuario());
  $('#reimprimir', v)?.addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { await imprimirNota(notaApp(), await datos.configuracion()); } catch (err) { aviso(err.message, 'error'); }
    b.disabled = false;
  });
  $('#nota-wa', v)?.addEventListener('click', async (e) => {
    const b = e.currentTarget, html = b.innerHTML; b.disabled = true; b.textContent = 'Preparando…';
    try { await enviarNotaWhatsApp(notaApp(), await datos.configuracion()); } catch (err) { aviso(err.message || 'No se pudo enviar por WhatsApp.', 'error'); }
    b.disabled = false; b.innerHTML = html;
  });
  // Nota en hoja completa: 'limpia' para imprimir en papel desde el PC; 'azul' (columna azul) para Guardar en PDF.
  const pdfHoja = async (estilo) => {
    const [cli, negocio] = await Promise.all([datos.cliente(p.cliente_id).catch(() => ({ nombre: p.cliente })), datos.configuracion()]);
    return notaPdf({
      id: p.id, numero: p.numero, fecha: p.fecha, cliente: cli, vendedor: p.vendedor || datos.usuario()?.nombre, terminal: p.terminal,
      pago: FORMAS_PAGO[p.forma_pago] || '', vence: p.forma_pago === 'credito' ? p.vence_en : null,
      items: p.items, subtotal: sub, descuentoLealtad: leal, nivel: p.nivel, descuento: desc, total: p.total, anulada,
      lealtadTexto: p.nivel && leal ? `Cliente ${p.nivel} · Ahorró ${clp(leal)}` : '',
    }, negocio, estilo);
  };
  const conEspera = (sel, fn, error) => $(sel, v)?.addEventListener('click', async (e) => {
    const b = e.currentTarget, html = b.innerHTML; b.disabled = true; b.textContent = 'Preparando…';
    try { await fn(); } catch (err) { aviso(err.message || error, 'error'); }
    b.disabled = false; b.innerHTML = html;
  });
  conEspera('#imprimir-pc', async () => imprimirPdf(await pdfHoja('limpia')), 'No se pudo preparar la impresión.');
  conEspera('#guardar-hoja', async () => aviso(`PDF guardado en ${await guardarPdf(await pdfHoja('azul'), `Nota-COVECA-${p.numero || 'sin-numero'}.pdf`)}`), 'No se pudo generar el PDF.');
  const form = $('#form-anular', v);
  const pie = $('.pie-fijo', v);
  $('#abrir-anular', v)?.addEventListener('click', (e) => {
    e.currentTarget.hidden = true; form.hidden = false; if (pie) pie.hidden = true;   // la confirmación queda a la vista
    $('#motivo', v).focus(); form.scrollIntoView({ block: 'center' });
  });
  $('#cancelar-anular', v)?.addEventListener('click', () => { form.hidden = true; $('#abrir-anular', v).hidden = false; if (pie) pie.hidden = false; });
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const motivo = $('#motivo', v).value.trim();
    if (!motivo) { $('#err-anular', v).textContent = 'Escribe el motivo de la anulación.'; return; }
    const b = form.querySelector('[type="submit"]'); b.disabled = true; b.textContent = 'Anulando…';
    try {
      await datos.anularPedido(p.id, motivo);
      aviso(`${titulo} anulada · stock devuelto`);
      vistaNota(v, id);
    } catch (err) {
      $('#err-anular', v).textContent = err.message;
      b.disabled = false; b.textContent = 'Confirmar anulación';
    }
  });
}
