// Pedidos a proveedores (migración 0041, decisiones del 17-10-2026):
// se arman desde la ficha del proveedor con una sugerencia (stock bajo + lo vendido en 4 semanas), se guardan
// y se envían por WhatsApp (el mismo PDF + la lista escrita) o en hoja PDF. Sin costos. Por enviar (guardado, aún no
// mandado; migración 0046) → Enviado → Recibido (al registrar la compra con "?pedido=") o Anulado. Solo administradores y con señal.
import { $, esc, barra, icono, vacio, aviso, ir, fecha, fechaHora, plural, leerAjuste, hoyChile } from '../ui.js';
import * as datos from '../datos.js';
import { nuevoReporte, guardarPdf, imprimirPdf, enviarPdfWhatsApp } from '../pdf.js';
import { telWhatsApp } from '../campos.js';
import { esEscritorio, listaCambio } from '../escritorio.js';
import { abrirExterno } from '../externo.js';

const SEMANAS = 4;                    // ventas que se miran para sugerir
export const ESTADO_PP = {
  por_enviar: { t: 'Por enviar', clase: '', ico: 'nota' },
  enviado: { t: 'Enviado', clase: 'stock-bajo', ico: 'reloj' },
  recibido: { t: 'Recibido', clase: 'ok', ico: 'check' },
  anulado: { t: 'Anulado', clase: 'alerta', ico: 'alerta' },
};
export const chipPedidoProv = (e) => { const x = ESTADO_PP[e] || ESTADO_PP.enviado; return `<span class="chip ${x.clase}">${icono(x.ico, 'ico-s')} ${x.t}</span>`; };
const ABIERTOS = ['por_enviar', 'enviado'];          // se pueden corregir, recibir y anular

// Cuánto pedir: llegar al mayor entre el doble del mínimo y lo vendido en 4 semanas (si el stock está negativo, también se cubre).
export const sugerir = (p, vendido, umbral) => Math.max(0, Math.max(2 * (p.stock_minimo ?? umbral), vendido) - p.stock);

function soloAdmin(v) {
  barra({ titulo: 'Pedido a proveedor', atras: '#/proveedores' });
  v.innerHTML = vacio('Solo para administradores', 'Los pedidos a proveedores los maneja un administrador.');
}

// ---------------- Lista de todos los pedidos a proveedores (#/pedidos-proveedor) ----------------
let filtroPP = 'abiertos';
export async function vistaPedidosProveedor(v) {
  if (!datos.esAdmin()) return soloAdmin(v);
  barra({ titulo: 'Pedidos a proveedores', atras: '#/proveedores' });
  const ps = await datos.pedidosProveedor({ limite: 100 });
  const FILTROS = { abiertos: 'Pendientes', recibidos: 'Recibidos', todos: 'Todos' };
  const pintar = () => {
    const lista = ps.filter((x) => filtroPP === 'todos' || (filtroPP === 'abiertos' ? ABIERTOS.includes(x.estado) : x.estado === 'recibido'));
    const n = (k) => ps.filter((x) => k === 'todos' || (k === 'abiertos' ? ABIERTOS.includes(x.estado) : x.estado === 'recibido')).length;
    v.innerHTML = `<div class="filtros" role="tablist">${Object.entries(FILTROS).map(([k, t]) =>
      `<button class="filtro" role="tab" aria-selected="${k === filtroPP}" data-f="${k}">${t} <span class="n">${n(k)}</span></button>`).join('')}</div>
      ${lista.length ? `<div class="lista" id="lista-pp">${lista.map((x) => `<a class="fila" href="#/pedidos-proveedor/${x.id}?desde=lista">
        <div class="fila-txt"><p class="fila-t">${esc(x.proveedor)} · N° ${x.numero}</p><p class="fila-s">${fecha(x.fecha)} · ${plural(x.productos, 'producto')} · ${x.unidades} unid.</p></div>
        ${chipPedidoProv(x.estado)}${icono('derecha', 'ico-chev')}</a>`).join('')}</div>`
      : vacio(filtroPP === 'abiertos' ? 'Sin pedidos pendientes' : 'Sin pedidos', 'Los pedidos se hacen desde la ficha de cada proveedor o con "Pedido libre a proveedor".')}`;
    v.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filtroPP = b.dataset.f; pintar(); }));
  };
  pintar();
}

// ---------------- Armar o corregir el pedido ----------------
export async function vistaPedidoProveedorForm(v, provId) {
  if (!datos.esAdmin()) return soloAdmin(v);
  const editar = new URLSearchParams(location.hash.split('?')[1] || '').get('editar');
  const [prov, prods, ventas, previo] = await Promise.all([datos.proveedor(provId), datos.productos(),
    datos.ventasPorProducto(SEMANAS * 7), editar ? datos.pedidoProveedor(editar) : null]);
  barra({ titulo: editar ? `Corregir pedido N° ${previo.numero}` : 'Nuevo pedido', sub: prov.nombre, atras: editar ? `#/pedidos-proveedor/${editar}` : `#/proveedores/${provId}` });
  if (previo && !ABIERTOS.includes(previo.estado)) { v.innerHTML = vacio('Este pedido ya no se puede corregir', `Está ${ESTADO_PP[previo.estado].t.toLowerCase()}.`); return; }
  const umbral = Number(leerAjuste('reporte-umbral', 3));
  const delProv = prods.filter((p) => String(p.proveedor_id) === String(provId));
  if (!delProv.length) {
    v.innerHTML = vacio('Este proveedor no tiene productos', 'Asígnale productos desde la ficha de cada producto en Inventario (campo Proveedor).',
      '<a class="btn prin" href="#/inventario">Ir a Inventario</a>');
    return;
  }
  const id = previo?.id || crypto.randomUUID();
  const vend = (p) => ventas.get(p.id) || 0;
  const cant = new Map();
  if (previo) for (const i of previo.items) cant.set(i.producto_id, i.cantidad);
  else for (const p of delProv) cant.set(p.id, sugerir(p, vend(p), umbral));
  // Arriba: lo sugerido (o lo que ya traía el pedido); abajo, plegado: el resto de los productos del proveedor.
  const arriba = delProv.filter((p) => (cant.get(p.id) || 0) > 0).sort((a, b) => a.stock - b.stock || a.nombre.localeCompare(b.nombre, 'es'));
  const resto = delProv.filter((p) => !arriba.includes(p)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const fila = (p) => `
    <div class="fila prod" data-id="${p.id}">
      <div class="fila-txt"><p class="fila-t">${esc(p.nombre)}</p>
        <p class="fila-s">Stock <span class="${p.stock <= 0 ? 'txt-alerta' : ''}">${p.stock}</span> · vendiste ${vend(p)} en ${SEMANAS} semanas</p></div>
      <div class="cantidad" role="group" aria-label="Cantidad a pedir de ${esc(p.nombre)}">
        <button type="button" class="cant-btn" data-d="-1" aria-label="Uno menos">${icono('menos')}</button>
        <input class="cant-n" type="number" inputmode="numeric" min="0" value="${cant.get(p.id) || 0}" aria-label="Cantidad">
        <button type="button" class="cant-btn" data-d="1" aria-label="Uno más">${icono('mas')}</button>
      </div></div>`;
  v.innerHTML = `
    <p class="ayuda pad mt">${previo ? 'Corrige las cantidades; con 0 el producto sale del pedido.'
      : `Te sugerimos reponer hasta el doble del mínimo o lo que vendiste en ${SEMANAS} semanas (lo que sea mayor). Ajusta lo que necesites; con 0 no se incluye.`}</p>
    ${arriba.length ? `<h2 class="sec-t">${previo ? 'En el pedido' : 'Sugeridos'} · ${arriba.length}</h2><div class="lista">${arriba.map(fila).join('')}</div>`
      : '<p class="ayuda pad">Ningún producto de este proveedor necesita reposición. Elige abajo lo que quieras pedir.</p>'}
    ${resto.length ? `<details class="pp-resto" ${arriba.length ? '' : 'open'}><summary class="sec-t">Otros productos de ${esc(prov.nombre)} · ${resto.length}</summary>
      <div class="lista">${resto.map(fila).join('')}</div></details>` : ''}
    <form id="f" class="form pad" novalidate>
      <label class="campo"><span>Notas para el proveedor (opcional)</span>
        <textarea name="notas" rows="2" maxlength="300" placeholder="Ej.: despacho el jueves, por favor">${esc(previo?.notas || '')}</textarea></label>
      <p id="tot-pedir" class="total-reponer"></p>
      <p id="err" class="error" role="alert"></p>
      <div class="pie-fijo"><button class="btn prin" type="submit" id="guardar">${previo ? 'Guardar cambios' : 'Guardar pedido'}</button></div>
    </form>`;

  const items = () => delProv.map((p) => ({ producto_id: p.id, cantidad: cant.get(p.id) || 0 })).filter((x) => x.cantidad > 0);
  const total = () => { const it = items(); $('#tot-pedir', v).innerHTML = `<b>${plural(it.length, 'producto')}</b> · <b>${it.reduce((s, x) => s + x.cantidad, 0)}</b> unidades a pedir`; };
  v.querySelectorAll('.fila.prod').forEach((f) => {
    const pid = Number(f.dataset.id), inp = f.querySelector('.cant-n');
    const set = (n) => { n = Math.min(99999, Math.max(0, Math.floor(n) || 0)); cant.set(pid, n); inp.value = n; f.classList.toggle('sel', n > 0); total(); };
    f.querySelectorAll('.cant-btn').forEach((b) => b.addEventListener('click', () => set((cant.get(pid) || 0) + Number(b.dataset.d))));
    inp.addEventListener('change', () => set(Number(inp.value)));
    f.classList.toggle('sel', (cant.get(pid) || 0) > 0);
  });
  total();
  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const it = items(), err = $('#err', v), b = $('#guardar', v);
    if (!it.length) { err.textContent = 'Indica al menos una cantidad a pedir.'; return; }
    b.disabled = true; b.textContent = 'Guardando…';
    try {
      // Un pedido nuevo queda "Por enviar" hasta que se manda; al corregir uno existente se conserva su estado.
      await datos.guardarPedidoProveedor({ id, proveedor_id: Number(provId), notas: e.target.notas.value.trim() || null, items: it, ...(previo ? {} : { estado: 'por_enviar' }) });
      aviso(previo ? 'Pedido corregido' : 'Pedido guardado. Ahora envíaselo al proveedor.'); listaCambio();
      ir(`#/pedidos-proveedor/${id}`);
    } catch (x) { err.textContent = x.message; b.disabled = false; b.textContent = previo ? 'Guardar cambios' : 'Guardar pedido'; }
  });
}

// ---------------- Ver, enviar y recibir ----------------
export async function vistaPedidoProveedor(v, id) {
  if (!datos.esAdmin()) return soloAdmin(v);
  const [pp, neg] = await Promise.all([datos.pedidoProveedor(id), datos.configuracion().catch(() => null)]);
  const prov = pp.proveedor || {};
  barra({ titulo: `Pedido N° ${pp.numero}`, sub: prov.nombre, atras: /[?&]desde=lista/.test(location.hash) ? '#/pedidos-proveedor' : `#/proveedores/${pp.proveedor_id}` });
  const unidades = pp.items.reduce((s, i) => s + i.cantidad, 0);
  const wa = telWhatsApp(prov.telefono || '');
  const enviado = ABIERTOS.includes(pp.estado);       // abierto: aún se puede enviar, corregir, recibir o anular
  const porEnviar = pp.estado === 'por_enviar';
  v.innerHTML = `
    <div class="nota-cab pad">${chipPedidoProv(pp.estado)}<p class="fila-s">${fecha(pp.fecha)}</p></div>
    ${pp.estado === 'anulado' ? `<div class="nota-anulada"><p class="fila-t">Pedido anulado${pp.anulado_en ? ' el ' + esc(fechaHora(pp.anulado_en)) : ''}</p>
      ${pp.motivo_anulacion ? `<p class="fila-s">Motivo: ${esc(pp.motivo_anulacion)}</p>` : ''}</div>` : ''}
    ${pp.estado === 'recibido' ? `<div class="pp-recibido pad"><p class="fila-t">${icono('check', 'ico-s')} Recibido el ${esc(fechaHora(pp.recibido_en))}</p>
      ${pp.compra_id ? `<a class="btn link izq" href="#/compras/${pp.compra_id}">Ver la compra registrada</a>` : '<p class="fila-s">Se marcó recibido sin registrar la compra.</p>'}</div>` : ''}
    ${porEnviar ? '<p class="ayuda pad">Este pedido está guardado pero todavía no se lo has enviado al proveedor.</p>' : ''}
    ${!wa && enviado ? `<a class="nota-falta" href="#/proveedores/${pp.proveedor_id}/editar">Falta el WhatsApp de ${esc(prov.nombre)}: se abrirá WhatsApp para que elijas el contacto. Toca para completarlo.</a>` : ''}
    <h2 class="sec-t">Productos · ${pp.items.length}</h2>
    <div class="lista">${pp.items.map((i) => `<a class="fila" href="#/inventario/${i.producto_id}"><div class="fila-txt"><p class="fila-t">${esc(i.nombre)}</p>
      <p class="fila-s">${i.ref ? `REF ${esc(i.ref)} · ` : ''}stock hoy ${i.stock ?? '—'}</p></div><span class="pp-cant">${i.cantidad} unid.</span></a>`).join('')}</div>
    <dl class="totales"><div class="total"><dt>Unidades a pedir</dt><dd>${unidades}</dd></div></dl>
    <dl class="datos">
      ${pp.notas ? `<div class="dato"><dt>Notas</dt><dd>${esc(pp.notas)}</dd></div>` : ''}
      <div class="dato"><dt>Hecho</dt><dd>${esc(fechaHora(pp.creado_en))}${pp.hizo ? ' · ' + esc(pp.hizo) : ''}</dd></div>
      ${pp.enviado_en ? `<div class="dato"><dt>Enviado</dt><dd>${esc(fechaHora(pp.enviado_en))}</dd></div>` : ''}
    </dl>
    <div class="pad envio">
      ${enviado ? `<button type="button" class="btn prin" id="pp-wa">${icono('whatsapp')} Enviar por WhatsApp${wa ? ` a ${esc(prov.nombre)}` : ''}</button>` : ''}
      <div class="foto-acciones reporte-acc">
        ${esEscritorio() ? `<button type="button" class="btn sec" id="pp-imprimir">${icono('impresora')} Imprimir</button>` : ''}
        <button type="button" class="btn sec" id="pp-pdf">${icono('descargar')} Guardar PDF</button>
        ${prov.correo && enviado ? '<button type="button" class="btn sec" id="pp-correo">Correo</button>' : ''}
        ${!enviado ? `<button type="button" class="btn sec" id="pp-wa">${icono('whatsapp')} WhatsApp</button>` : ''}
      </div>
      ${porEnviar ? '<button type="button" class="btn link izq" id="pp-marcar">Ya lo envié: marcar como enviado</button>' : ''}
    </div>
    ${enviado ? `<h2 class="sec-t">¿Llegó la mercadería?</h2>
      <div class="lista"><a class="fila" href="#/compras/nueva?pedido=${pp.id}" id="pp-compra">
        <div class="fila-txt"><p class="fila-t">Registrar la compra de este pedido</p><p class="fila-s">Se llena con estos productos; ajusta cantidades y costos según la factura</p></div>${icono('derecha', 'ico-chev')}</a></div>
      <div class="pad nota-acciones">
        <a class="btn sec" href="#/proveedores/${pp.proveedor_id}/pedido?editar=${pp.id}">${icono('editar')} Corregir pedido</a>
        <button type="button" id="pp-recibir" class="btn link">Marcar recibido sin registrar compra</button>
        <button type="button" id="abrir-anular" class="btn peligro">Anular pedido</button>
        <form id="form-anular" class="form anular" hidden>
          <label class="campo"><span>Motivo de la anulación</span>
            <input id="motivo" type="text" maxlength="120" placeholder="Ej.: el proveedor no tenía stock" required></label>
          <p class="ayuda">El pedido queda en el historial como anulado. No cambia el stock.</p>
          <p id="err-anular" class="error" role="alert"></p>
          <div class="fila-botones"><button type="button" id="cancelar-anular" class="btn sec">Cancelar</button>
            <button type="submit" class="btn peligro sin-margen">Confirmar anulación</button></div>
        </form></div>` : ''}`;

  const conBoton = (b, txt, fn) => async () => {
    const html = b.innerHTML; b.disabled = true; b.textContent = txt;
    try { await fn(); } catch (err) { aviso(err.message || 'No se pudo completar.', 'error'); }
    b.disabled = false; b.innerHTML = html;
  };
  const pdf = () => pdfPedidoProveedor(pp, neg);
  const nombre = `COVECA-pedido-${pp.numero}-${(prov.nombre || '').normalize('NFD').replace(/[^\w]+/g, '-')}.pdf`;
  const recargar = () => { listaCambio(); return vistaPedidoProveedor(v, id); };
  const bWa = $('#pp-wa', v);
  bWa?.addEventListener('click', conBoton(bWa, 'Preparando…', async () => {
    const salio = await enviarPdfWhatsApp(await pdf(), nombre, { telefono: wa, texto: textoPedidoProveedor(pp, neg) });
    if (porEnviar && salio) { await datos.marcarPedidoProveedorEnviado(pp.id); aviso('Pedido enviado'); await recargar(); }   // si se cancela o falla, sigue Por enviar (en el PC: "Ya lo envié")
  }));
  $('#pp-marcar', v)?.addEventListener('click', async () => {
    try { await datos.marcarPedidoProveedorEnviado(pp.id); aviso('Pedido marcado como enviado'); await recargar(); }
    catch (err) { aviso(err.message, 'error'); }
  });
  const bPdf = $('#pp-pdf', v);
  bPdf.addEventListener('click', conBoton(bPdf, 'Generando…', async () => aviso(`PDF guardado en ${await guardarPdf(await pdf(), nombre)}`)));
  const bImp = $('#pp-imprimir', v);
  bImp?.addEventListener('click', conBoton(bImp, 'Preparando…', async () => imprimirPdf(await pdf())));
  $('#pp-correo', v)?.addEventListener('click', () => abrirExterno(`mailto:${encodeURIComponent(prov.correo)}?subject=${encodeURIComponent(`Pedido N° ${pp.numero} de COVECA`)}&body=${encodeURIComponent(textoPedidoProveedor(pp, neg).replace(/\*/g, ''))}`));
  $('#pp-recibir', v)?.addEventListener('click', async () => {
    if (!confirm('¿Marcar el pedido como recibido sin registrar la compra?\n\nEl stock no cambia. Para sumar el stock y dejar los costos al día, usa "Registrar la compra de este pedido".')) return;
    try { await datos.recibirPedidoProveedor(pp.id); aviso('Pedido marcado como recibido'); listaCambio(); vistaPedidoProveedor(v, id); }
    catch (err) { aviso(err.message, 'error'); }
  });
  const form = $('#form-anular', v);
  $('#abrir-anular', v)?.addEventListener('click', (e) => { e.currentTarget.hidden = true; form.hidden = false; $('#motivo', v).focus(); });
  $('#cancelar-anular', v)?.addEventListener('click', () => { form.hidden = true; $('#abrir-anular', v).hidden = false; });
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const motivo = $('#motivo', v).value.trim();
    if (!motivo) { $('#err-anular', v).textContent = 'Escribe el motivo de la anulación.'; return; }
    try { await datos.anularPedidoProveedor(pp.id, motivo); aviso('Pedido anulado'); listaCambio(); vistaPedidoProveedor(v, id); }
    catch (err) { $('#err-anular', v).textContent = err.message; }
  });
}

// Mensaje de WhatsApp (va junto al PDF): la lista escrita para que el proveedor la lea sin abrir el archivo.
export function textoPedidoProveedor(pp, neg) {
  const prov = pp.proveedor || {};
  return [`Hola${prov.contacto ? ' ' + prov.contacto : ''}, le escribimos de *COVECA*.`,
    `Le enviamos nuestro *pedido N° ${pp.numero}* (${fecha(pp.fecha)}):`, '',
    ...pp.items.map((i) => `• ${i.cantidad} × ${i.nombre}${i.ref ? ` (REF ${i.ref})` : ''}`), '',
    `Total: ${pp.items.reduce((s, i) => s + i.cantidad, 0)} unidades.`,
    ...(pp.notas ? [`Nota: ${pp.notas}`] : []),
    `Por favor confirmar disponibilidad, precio y fecha de despacho.${neg?.telefono ? ` Contacto: ${neg.telefono}.` : ''} ¡Gracias!`].join('\n');
}

// Hoja PDF del pedido (sin stock ni costos): la misma para guardar, imprimir y enviar por WhatsApp.
export async function pdfPedidoProveedor(pp, neg) {
  const prov = pp.proveedor || {};
  const tel = neg?.telefono || '+56 9 7587 0827';
  const unidades = pp.items.reduce((s, i) => s + i.cantidad, 0);
  const r = await nuevoReporte({ titulo: `Pedido N° ${pp.numero}`, subtitulo: `Para ${prov.nombre || ''}` });
  r.bloques([
    { titulo: 'Para', lineas: [prov.nombre, prov.contacto && `Atención: ${prov.contacto}`, prov.telefono, prov.correo] },
    { titulo: 'De', lineas: ['COVECA', 'Su comercializadora de confianza', tel, `Fecha: ${fecha(pp.fecha || hoyChile())}`] },
  ]);
  r.resumen([{ valor: pp.items.length, etiqueta: 'Productos' }, { valor: unidades, etiqueta: 'Unidades a pedir' }]);
  r.seccion('Detalle del pedido');
  r.tabla([{ titulo: 'N°', ancho: 12 }, { titulo: 'Producto' }, { titulo: 'REF', ancho: 26 }, { titulo: 'Cantidad', ancho: 24, alinear: 'right' }],
    pp.items.map((i, k) => [String(k + 1), i.nombre, i.ref || '—', String(i.cantidad)]),
    { pie: ['', 'Total', '', String(unidades)] });
  r.seccion('Observaciones', `${pp.notas ? pp.notas.replace(/\.?$/, '. ') : ''}Por favor confirmar disponibilidad, precio y fecha de despacho. Ante cualquier duda, contactar a COVECA al ${tel}.`);
  return r.terminar();
}
