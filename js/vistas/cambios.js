// Nota de cambio (migración 0056, ticket N° 12): el cliente devuelve productos de una nota ya entregada y recibe otros
// del mismo valor. Se anota en la visita (#/pedidos/:id/cambio) y queda por entregar (pestaña Pedidos y Carga para bodega);
// el detalle (#/cambios/:id) se entrega, imprime, envía por WhatsApp, guarda en PDF o anula. No cambia la nota de venta.
// Funciona sin señal: la nota de origen sale de la copia del celular y el cambio se sube solo.
import { $, $$, esc, normal, barra, icono, vacio, aviso, ir, clp, fechaHora, plural } from '../ui.js';
import * as datos from '../datos.js';
import { miniatura } from './inventario.js';
import { hayTermica, imprimirCambio, enviarCambioWhatsApp, pdfCambio, archivoCambio } from '../impresora.js';
import { esEscritorio } from '../escritorio.js';
import { imprimirPdf, guardarPdf } from '../pdf.js';
import { entregado as entregadoAnim } from '../anima.js';
import { sentir } from '../sentir.js';

const MAX_CANT = 9999;
const DESTINOS = { bodega: 'Vuelve a bodega', baja: 'Se da de baja' };
// Lo que se imprime y se envía al cliente: siempre en tono neutral, sin decir quién se equivocó (consejo de tickets, 23-10-2026)
const MOTIVO_PAPEL = { variedad: 'Cambio de sabor o variedad', mal_estado: 'Reposición de producto' };
const ayudaDestino = 'Vuelve a bodega: está bien y se puede vender. Se da de baja: viene en mal estado o vencido.';

// ---------------------------------------------------------------- Registrar
export async function vistaCambioNuevo(v, pedidoId) {
  const [p, productos, previos] = await Promise.all([datos.pedido(pedidoId), datos.productos({ soloActivos: false }), datos.cambios({ pedidoId }).catch(() => [])]);
  const n = previos.reduce((m, c) => Math.max(m, Number(c.n) || 0), 0) + 1;   // el servidor toma el siguiente si ya se usó
  // Lo ya devuelto en otros cambios vigentes de esta nota: no se devuelve más de lo vendido (también lo revisa el servidor)
  const yaDev = new Map();
  for (const c of previos) if (!c.anulado_en) for (const i of c.items) if (i.sentido === 'devuelve') yaDev.set(i.producto_id, (yaDev.get(i.producto_id) || 0) + i.cantidad);
  const admin = datos.esAdmin();
  barra({ titulo: 'Registrar cambio', sub: `${p.cliente} · nota N° ${p.numero ?? ''}`, atras: `#/pedidos/${pedidoId}` });
  if (p.estado === 'anulado' || !p.entregado_en || p.porSubir) {
    v.innerHTML = vacio(p.estado === 'anulado' ? 'Esta nota está anulada' : p.porSubir ? 'Esta nota todavía no se sube' : 'Esta nota todavía no se entrega',
      p.estado === 'anulado' ? 'Los cambios se registran sobre una nota vigente.'
        : p.porSubir ? 'Espera a que se suba (necesita señal una vez) y vuelve a intentar.'
        : 'Si hay que cambiar productos antes de entregar, usa "Editar pedido" en la nota.',
      `<a class="btn sec" href="#/pedidos/${esc(pedidoId)}">Volver a la nota</a>`);
    return;
  }
  const prod = new Map(productos.map((x) => [x.id, x]));
  const vendidos = new Map();   // producto → { nombre, cantidad (sumada), precio cobrado }
  for (const i of p.items) { const v0 = vendidos.get(i.producto_id); vendidos.set(i.producto_id, v0 ? { ...v0, cantidad: v0.cantidad + i.cantidad, precio: Math.min(v0.precio, i.precio) } : { ...i }); }
  const puedeDevolver = (id) => (vendidos.get(id)?.cantidad || 0) - (yaDev.get(id) || 0);
  // Estado del formulario
  let motivo = '', detalle = '';
  const dev = new Map();   // producto_id → { producto_id, nombre, precio, cant, destino }
  const rec = new Map();   // producto_id → { producto_id, nombre, precio, cant }
  let buscaDev = null, buscaRec = '';   // buscaDev: null = cerrado; texto = abierto
  const precioDev = (id) => vendidos.get(id)?.precio ?? prod.get(id)?.precio ?? 0;   // lo devuelto vale lo que se cobró
  const total = (m) => [...m.values()].reduce((s, i) => s + i.cant * i.precio, 0);

  const filaCant = (lado, i, extra = '') => `
    <div class="fila prod cb-item ${i.cant ? 'sel' : ''}" data-lado="${lado}" data-id="${i.producto_id}">
      ${miniatura(prod.get(i.producto_id) || { nombre: i.nombre }, 'mini-pedido')}
      <div class="fila-txt"><p class="fila-t">${esc(i.nombre)}</p>
        <p class="fila-s"><span class="monto">${clp(i.precio)}</span>${extra}</p></div>
      <div class="cantidad" role="group" aria-label="Cantidad de ${esc(i.nombre)}">
        <button type="button" class="cant-btn" data-d="-1" aria-label="Quitar uno" ${i.cant ? '' : 'disabled'}>${icono('menos')}</button>
        <input class="cant-n" type="number" inputmode="numeric" min="0" value="${i.cant || ''}" placeholder="0" aria-label="Cantidad">
        <button type="button" class="cant-btn" data-d="1" aria-label="Agregar uno">${icono('mas')}</button></div>
    </div>`;
  const destinoHtml = (i) => `
    <div class="cb-destino" role="radiogroup" aria-label="Qué pasa con ${esc(i.nombre)}">
      ${Object.entries(DESTINOS).map(([k, t]) => `<button type="button" role="radio" aria-checked="${i.destino === k}" data-destino="${k}" data-id="${i.producto_id}">${icono(k === 'baja' ? 'basura' : 'caja', 'ico-s')} ${t}</button>`).join('')}
    </div>`;
  const resultados = (texto, lado) => {
    const q = normal(texto || '');
    if (!q) return '';
    const lista = productos.filter((x) => (lado === 'dev' || (x.activo && x.precio > 0)) && normal(`${x.nombre} ${x.ref || ''} ${x.marca || ''} ${x.codigo_barras || ''}`).includes(q)).slice(0, 12);
    return lista.length ? `<div class="lista cb-resultados">${lista.map((x) => `
      <button type="button" class="fila cb-agregar" data-agregar="${lado}" data-id="${x.id}">
        ${miniatura(x, 'mini-pedido')}<div class="fila-txt"><p class="fila-t">${esc(x.nombre)}</p>
        <p class="fila-s"><span class="monto">${clp(x.precio)}</span> · Stock ${x.stock}</p></div>${icono('mas')}</button>`).join('')}</div>`
      : `<p class="texto-suave pad-x">No hay productos con esa búsqueda.</p>`;
  };

  const pintar = () => {
    const tDev = total(dev), tRec = total(rec), conDev = [...dev.values()].filter((i) => i.cant), conRec = [...rec.values()].filter((i) => i.cant);
    const faltaDestino = conDev.some((i) => !i.destino);
    const pasan = conDev.filter((i) => vendidos.has(i.producto_id) && i.cant > puedeDevolver(i.producto_id));
    const igual = tDev > 0 && tDev === tRec;
    const listo = motivo && conDev.length && conRec.length && igual && !faltaDestino && !pasan.length;
    const devLista = [...new Set([...vendidos.keys(), ...dev.keys()])].map((id) => dev.get(id) || {
      producto_id: id, nombre: vendidos.get(id)?.nombre || prod.get(id)?.nombre || `Producto ${id}`, precio: precioDev(id), cant: 0, destino: null });
    v.innerHTML = `<div class="cambio-form">
      <p class="ayuda pad">El cliente devuelve productos de la nota N° ${esc(p.numero)} y recibe otros del <b>mismo valor</b>. Se entrega con la próxima entrega; la nota de venta no cambia.</p>
      <fieldset class="opciones pad-x"><legend>Motivo del cambio</legend>
        ${Object.entries(datos.MOTIVOS_CAMBIO).map(([k, t]) => `<label class="opcion"><input type="radio" name="motivo" value="${k}" ${motivo === k ? 'checked' : ''}> ${t}</label>`).join('')}
      </fieldset>
      <label class="campo pad-x cb-detalle"><span>Detalle (opcional)</span>
        <input id="cb-detalle" type="text" maxlength="200" value="${esc(detalle)}" placeholder="Ej.: quería sabor queso" autocomplete="off"></label>

      <h2 class="sec-t">Devuelve · <span class="monto">${clp(tDev)}</span></h2>
      <p class="ayuda pad-x">Productos de la nota. Marca cuántos devuelve el cliente.</p>
      <div class="lista">${devLista.map((i) => {
        const vend = vendidos.get(i.producto_id)?.cantidad || 0, ya = yaDev.get(i.producto_id) || 0, max = vend - ya;
        const extra = vend ? ` · En la nota: ${vend}${ya ? ` · ya devolvió ${ya}` : ''}` : ' · No está en la nota';
        const aviso = !vend ? 'Este producto no está en la nota: revisa antes de seguir.'
          : i.cant > max ? `Puede devolver hasta ${max}${ya ? ' (el resto ya se devolvió en otro cambio)' : ''}.` : '';
        return filaCant('dev', i, extra) + (i.cant ? `<div class="cb-sub">${aviso ? `<p class="fila-s txt-alerta">${icono('alerta', 'ico-s')} ${aviso}</p>` : ''}${destinoHtml(i)}</div>` : '');
      }).join('')}</div>
      ${!admin ? '' : buscaDev == null ? `<div class="pad-x"><button type="button" id="otro-dev" class="btn link izq">${icono('mas', 'ico-s')} Devuelve otro producto</button></div>`
        : `<div class="buscador">${icono('buscar')}<input id="q-dev" type="search" placeholder="Buscar producto que devuelve" value="${esc(buscaDev)}" aria-label="Buscar producto que devuelve" autocomplete="off"></div>${resultados(buscaDev, 'dev')}`}
      ${conDev.length ? `<p class="ayuda pad-x">${ayudaDestino}</p>` : ''}

      <h2 class="sec-t">Recibe · <span class="monto">${clp(tRec)}</span></h2>
      ${conDev.length ? `<div class="pad-x"><button type="button" id="lo-mismo" class="btn sec">${icono('nota', 'ico-s')} Lo mismo que devuelve</button></div>` : ''}
      ${rec.size ? `<div class="lista">${[...rec.values()].map((i) => {
        const st = prod.get(i.producto_id)?.stock;
        return filaCant('rec', i, st != null && i.cant > Math.max(st, 0) ? ` · <span class="txt-alerta">Bodega tiene ${Math.max(st, 0)}</span>` : '');
      }).join('')}</div>` : ''}
      <div class="buscador">${icono('buscar')}<input id="q-rec" type="search" placeholder="Buscar producto que recibe" value="${esc(buscaRec)}" aria-label="Buscar producto que recibe" autocomplete="off"></div>
      ${resultados(buscaRec, 'rec')}

      <div class="cb-resumen pad">
        <dl class="totales sin-margen">
          <div><dt>Devuelve</dt><dd class="monto">${clp(tDev)}</dd></div>
          <div><dt>Recibe</dt><dd class="monto">${clp(tRec)}</dd></div>
        </dl>
        ${tDev && tRec && !igual ? `<p class="aviso-bodega" role="alert">${icono('alerta', 'ico-s')} Los dos lados deben valer lo mismo (diferencia ${clp(Math.abs(tDev - tRec))}). Si hay diferencia de precio, anula la nota y toma un pedido nuevo.</p>` : ''}
        ${!motivo && (conDev.length || conRec.length) ? '<p class="fila-s">Falta elegir el motivo.</p>' : ''}
        ${faltaDestino ? '<p class="fila-s">Falta elegir qué pasa con cada producto que devuelve.</p>' : ''}
        ${pasan.length ? '<p class="fila-s">Hay productos que devuelven más de lo que tenía la nota.</p>' : ''}
      </div>
      ${datos.hayRed() ? '' : `<p class="nota-sin-senal pad-x">${icono('sinNube', 'ico-s')} Sin señal: el cambio se guarda en el celular y se sube solo cuando vuelva la señal.</p>`}
      <div class="pie-fijo"><button type="button" id="cb-guardar" class="btn prin" ${listo ? '' : 'disabled'}>${icono('check')} Registrar cambio</button></div>
    </div>`;
    activar();
  };

  // Conserva el scroll y el foco del buscador al redibujar
  const redibujar = (foco) => {
    const y = window.scrollY;
    pintar();
    window.scrollTo(0, y);
    if (foco) { const i = $(foco, v); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  };
  const fijar = (lado, id, q) => {
    const m = lado === 'dev' ? dev : rec;
    q = Math.max(0, Math.floor(Number(q)) || 0);
    if (q > MAX_CANT) { aviso(`Máximo ${MAX_CANT.toLocaleString('es-CL')} unidades por producto.`, 'error'); return; }
    const base = m.get(id) || (lado === 'dev'
      ? { producto_id: id, nombre: vendidos.get(id)?.nombre || prod.get(id)?.nombre, precio: precioDev(id), cant: 0, destino: motivo === 'mal_estado' ? null : 'bodega' }
      : { producto_id: id, nombre: prod.get(id)?.nombre, precio: prod.get(id)?.precio || 0, cant: 0 });
    if (lado === 'rec' && q === 0) m.delete(id);
    else if (lado === 'dev' && q === 0 && vendidos.has(id)) m.delete(id);
    else if (lado === 'dev' && q === 0) m.delete(id);
    else m.set(id, { ...base, cant: q });
    if (q) sentir('toque');
    redibujar();
  };
  function activar() {
    $$('input[name="motivo"]', v).forEach((r) => r.addEventListener('change', () => {
      const antes = motivo; motivo = r.value;
      // Producto en mal estado: hay que decidir a mano qué pasa con cada uno (decisión del negocio: "depende del estado")
      if (motivo === 'mal_estado' && antes !== 'mal_estado') for (const i of dev.values()) i.destino = null;
      redibujar();
    }));
    $('#cb-detalle', v).addEventListener('input', (e) => { detalle = e.target.value; });
    $$('.cb-item', v).forEach((f) => {
      const lado = f.dataset.lado, id = Number(f.dataset.id), m = lado === 'dev' ? dev : rec;
      f.querySelectorAll('.cant-btn').forEach((b) => b.addEventListener('click', () => fijar(lado, id, (m.get(id)?.cant || 0) + Number(b.dataset.d))));
      f.querySelector('.cant-n').addEventListener('change', (e) => fijar(lado, id, e.target.value));
    });
    $$('[data-destino]', v).forEach((b) => b.addEventListener('click', () => {
      const i = dev.get(Number(b.dataset.id)); if (i) { i.destino = b.dataset.destino; redibujar(); }
    }));
    $$('[data-agregar]', v).forEach((b) => b.addEventListener('click', () => {
      const lado = b.dataset.agregar, id = Number(b.dataset.id), m = lado === 'dev' ? dev : rec;
      if (lado === 'dev') buscaDev = null; else buscaRec = '';
      if (!m.get(id)?.cant) fijar(lado, id, 1); else redibujar();
    }));
    $('#otro-dev', v)?.addEventListener('click', () => { buscaDev = ''; redibujar('#q-dev'); });
    $('#q-dev', v)?.addEventListener('input', (e) => { buscaDev = e.target.value; redibujar('#q-dev'); });
    $('#q-rec', v).addEventListener('input', (e) => { buscaRec = e.target.value; redibujar('#q-rec'); });
    $('#lo-mismo', v)?.addEventListener('click', () => {
      for (const i of dev.values()) if (i.cant) {
        const pr = prod.get(i.producto_id);
        if (!pr?.activo || !(pr.precio > 0)) { aviso(`${i.nombre} no se puede entregar (desactivado o sin precio).`, 'error'); continue; }
        rec.set(i.producto_id, { producto_id: i.producto_id, nombre: pr.nombre, precio: i.precio, cant: i.cant });   // mismo precio que se devuelve
      }
      redibujar();
    });
    $('#cb-guardar', v).addEventListener('click', guardar);
  }

  async function guardar(e) {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Guardando…';
    const items = [
      ...[...dev.values()].filter((i) => i.cant).map((i) => ({ sentido: 'devuelve', producto_id: i.producto_id, nombre: i.nombre, cantidad: i.cant, precio: i.precio, destino: i.destino })),
      ...[...rec.values()].filter((i) => i.cant).map((i) => ({ sentido: 'recibe', producto_id: i.producto_id, nombre: i.nombre, cantidad: i.cant, precio: i.precio })),
    ];
    const cambio = { id: crypto.randomUUID(), pedido_id: p.id, n, motivo, detalle: detalle.trim() || null, items };
    try {
      const r = await datos.registrarCambio(cambio, { cliente: p.cliente, cliente_id: p.cliente_id, numero_nota: p.numero, ruta_id: p.ruta_id ?? null });
      sentir('exito');
      aviso(`Cambio N° ${p.numero}-${r.n} registrado${r.porSubir ? ' en el celular' : ''} · queda por entregar`);
      ir(`#/cambios/${cambio.id}?nuevo=1`);
    } catch (err) {
      aviso(err.message, 'error');
      b.disabled = false; b.innerHTML = `${icono('check')} Registrar cambio`;
    }
  }
  pintar();
}

// ---------------------------------------------------------------- Detalle
export async function vistaCambio(v, id) {
  const c = await datos.cambio(id);
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const desdePedidos = q.get('desde') === 'pedidos';
  const num = datos.numeroCambio(c);
  barra({ titulo: `Cambio N° ${num}`, sub: c.cliente, atras: desdePedidos ? '#/pedidos' : `#/pedidos/${c.pedido_id}` });
  const anulado = !!c.anulado_en, entregado = !!c.entregado_en && !anulado;
  const dev = c.items.filter((i) => i.sentido === 'devuelve'), rec = c.items.filter((i) => i.sentido === 'recibe');
  const termica = hayTermica(), pcHoja = !termica && esEscritorio();
  const conMotivo = { ...c, motivoTexto: MOTIVO_PAPEL[c.motivo] || 'Cambio de producto' };
  const chips = anulado ? `<span class="chip alerta">${icono('alerta', 'ico-s')} Anulado</span>`
    : `${c.porSubir ? `<span class="chip">${icono('sinNube', 'ico-s')} Por subir</span>` : ''}
       ${entregado ? `<span class="chip ok">${icono('check', 'ico-s')} Entregado</span>` : `<span class="chip">${icono('caja', 'ico-s')} Por entregar</span>`}`;
  const lineas = (lista) => `<div class="lista">${lista.map((i) => `
    <div class="fila"><div class="fila-txt"><p class="fila-t">${esc(i.nombre)}</p>
      <p class="fila-s">${i.cantidad} × ${clp(i.precio)}${i.destino ? ` · ${i.destino === 'baja' ? `<span class="txt-alerta">${icono('basura', 'ico-s')} Se da de baja</span>` : 'Vuelve a bodega'}` : ''}</p></div>
      <span class="monto">${clp(i.subtotal)}</span></div>`).join('')}</div>`;
  v.innerHTML = `
    <div class="nota-cab pad"><div class="nota-chips">${chips}</div><p class="fila-s">${esc(fechaHora(c.fecha))}</p></div>
    ${anulado ? `<div class="nota-anulada"><p class="fila-t">Cambio anulado${c.anulado_en ? ' el ' + esc(fechaHora(c.anulado_en)) : ''}</p>
      ${c.anulado_motivo ? `<p class="fila-s">Motivo: ${esc(c.anulado_motivo)}</p>` : ''}<p class="fila-s">El stock volvió como estaba.</p></div>` : ''}
    <dl class="datos">
      <div class="dato"><dt>Nota de venta</dt><dd><a class="nota-enlace" href="#/pedidos/${esc(c.pedido_id)}">N° ${esc(c.numero_nota)} ${icono('derecha', 'ico-s')}</a></dd></div>
      ${c.n_en_papel && c.n_en_papel !== c.n ? `<div class="dato"><dt>N° impreso</dt><dd>${esc(`${c.numero_nota}-${c.n_en_papel}`)} (otro cambio ya tenía ese número)</dd></div>` : ''}
      <div class="dato"><dt>Motivo</dt><dd>${esc(datos.MOTIVOS_CAMBIO[c.motivo] || c.motivo)}</dd></div>
      ${c.detalle ? `<div class="dato"><dt>Detalle</dt><dd>${esc(c.detalle)}</dd></div>` : ''}
      ${entregado ? `<div class="dato"><dt>Entregado</dt><dd>${esc(fechaHora(c.entregado_en))}</dd></div>` : ''}
    </dl>
    ${c.porSubir ? `<p class="nota-sin-senal pad-x">${icono('sinNube', 'ico-s')} Guardado en el celular: se sube solo cuando vuelva la señal. Igual puedes imprimirlo o enviarlo.</p>` : ''}
    ${c.conProblema ? `<p class="aviso-bodega pad-x">${icono('alerta', 'ico-s')} No se pudo subir: revisa Ajustes → Trabajo sin señal.</p>` : ''}
    <h2 class="sec-t">Devuelve</h2>${lineas(dev)}
    <h2 class="sec-t">Recibe</h2>${lineas(rec)}
    <dl class="totales"><div class="total"><dt>Mismo valor</dt><dd class="monto">${clp(c.valor)}</dd></div></dl>
    <p class="ayuda pad-x">El stock ya se ajustó al anotar el cambio. No cambia la nota de venta ni cuenta en ventas.</p>

    ${!anulado ? `<div class="pad nota-acciones">
      ${termica || pcHoja ? `<button type="button" id="cb-imprimir" class="btn sec">${icono('impresora')} Imprimir</button>` : ''}
      <button type="button" id="cb-wa" class="btn sec">${icono('whatsapp')} Enviar por WhatsApp</button>
      <button type="button" id="cb-pdf" class="btn sec">${icono('descargar')} Guardar en PDF</button>
      ${entregado ? '<button type="button" id="cb-deshacer" class="btn link">Deshacer entrega</button>' : ''}
      ${c.puedeAnular ? `<button type="button" id="abrir-anular" class="btn peligro">Anular cambio</button>
      <form id="form-anular" class="form anular" hidden>
        <label class="campo"><span>Motivo de la anulación</span>
          <input id="motivo" type="text" maxlength="120" placeholder="Ej.: el cliente ya no quiere el cambio" required></label>
        <p class="ayuda">El stock vuelve como estaba y el cambio deja de aparecer para entregar. No se puede deshacer.</p>
        <p id="err-anular" class="error" role="alert"></p>
        <div class="fila-botones"><button type="button" id="cancelar-anular" class="btn sec">Cancelar</button>
          <button type="submit" class="btn peligro sin-margen">Confirmar anulación</button></div>
      </form>` : ''}
      ${entregado && !anulado ? '<p class="ayuda">Un cambio entregado no se anula. Si no se hizo, primero usa "Deshacer entrega".</p>' : ''}
    </div>` : ''}
    ${!anulado && !entregado ? `<div class="pie-fijo"><button type="button" id="cb-entregar" class="btn prin">${icono('camion')} Entregar cambio</button></div>` : ''}`;

  const yo = datos.usuario();
  const resumen = { cliente: c.cliente };
  const conEspera = (sel, fn, error) => $(sel, v)?.addEventListener('click', async (e) => {
    const b = e.currentTarget, html = b.innerHTML; b.disabled = true; b.textContent = 'Preparando…';
    try { await fn(); } catch (err) { aviso(err.message || error, 'error'); }
    b.disabled = false; b.innerHTML = html;
  });
  conEspera('#cb-imprimir', async () => {
    const negocio = await datos.configuracion();
    if (pcHoja) return imprimirPdf(await pdfCambio(conMotivo, negocio, yo, 'limpia'));
    await imprimirCambio(conMotivo, negocio, yo);
    sentir('exito'); aviso('Nota de cambio impresa');
  }, 'No se pudo imprimir. Revisa que la impresora esté encendida y vuelve a intentar.');
  conEspera('#cb-wa', async () => {
    if (!c.telefonoCliente) aviso('Este cliente no tiene teléfono guardado: elige el contacto en WhatsApp.', 'ok');
    await enviarCambioWhatsApp(conMotivo, await datos.configuracion(), yo);
  }, 'No se pudo enviar por WhatsApp.');
  conEspera('#cb-pdf', async () => aviso(`PDF guardado en ${await guardarPdf(await pdfCambio(conMotivo, await datos.configuracion(), yo, 'azul'), archivoCambio(c))}`), 'No se pudo generar el PDF.');
  $('#cb-entregar', v)?.addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try {
      await datos.entregarCambio(c.id, true, resumen);
      entregadoAnim('¡Cambio entregado!');
      aviso(`Cambio N° ${num} entregado`);
      if (desdePedidos) { try { sessionStorage.setItem('coveca-recien-entregado', '1'); } catch (_) {} ir('#/pedidos'); return; }
      vistaCambio(v, id);
    } catch (err) { b.disabled = false; aviso(err.message, 'error'); }
  });
  $('#cb-deshacer', v)?.addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { await datos.entregarCambio(c.id, false, resumen); aviso('El cambio vuelve a "Por entregar"'); vistaCambio(v, id); }
    catch (err) { b.disabled = false; aviso(err.message, 'error'); }
  });
  const form = $('#form-anular', v), pie = $('.pie-fijo', v);
  $('#abrir-anular', v)?.addEventListener('click', (e) => {
    e.currentTarget.hidden = true; form.hidden = false; if (pie) pie.hidden = true;
    $('#motivo', v).focus(); form.scrollIntoView({ block: 'center' });
  });
  $('#cancelar-anular', v)?.addEventListener('click', () => { form.hidden = true; $('#abrir-anular', v).hidden = false; if (pie) pie.hidden = false; });
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const motivo = $('#motivo', v).value.trim();
    if (!motivo) { $('#err-anular', v).textContent = 'Escribe el motivo de la anulación.'; return; }
    const b = form.querySelector('[type="submit"]'); b.disabled = true; b.textContent = 'Anulando…';
    try {
      await datos.anularCambio(c.id, motivo);
      aviso(`Cambio N° ${num} anulado · stock devuelto`);
      if (c.porSubir) { ir(`#/pedidos/${c.pedido_id}`); return; }   // el que estaba en el celular se borró
      vistaCambio(v, id);
    } catch (err) { $('#err-anular', v).textContent = err.message; b.disabled = false; b.textContent = 'Confirmar anulación'; }
  });
}

// Bloque de la nota de venta: sus cambios (si hay) y el botón para registrar uno (solo nota entregada, vigente y subida).
export function cambiosNotaHtml(lista, p, puede) {
  return `${lista.length ? `<h2 class="sec-t">Cambios · ${lista.length}</h2>
    <div class="lista">${lista.map((c) => `
      <a class="fila" href="#/cambios/${esc(c.id)}"><div class="fila-txt"><p class="fila-t">Cambio N° ${esc(datos.numeroCambio(c))}</p>
        <p class="fila-s">${esc(datos.MOTIVOS_CAMBIO[c.motivo] || '')} · ${c.anulado_en ? 'Anulado' : c.entregado_en ? 'Entregado' : 'Por entregar'}${c.porSubir ? ' · Por subir' : ''}</p></div>
        ${icono('derecha', 'ico-chev')}</a>`).join('')}</div>` : ''}
    ${puede ? `<div class="pad nota-cambio"><a class="btn sec" id="registrar-cambio" href="#/pedidos/${esc(p.id)}/cambio">${icono('nota')} Registrar cambio</a>
      <p class="ayuda">Si el cliente cambia productos de esta nota por otros del mismo valor.</p></div>` : ''}`;
}

// Cantidad de unidades de un lado del cambio (para Pedidos y la Carga)
export const unidades = (c, sentido) => c.items.filter((i) => i.sentido === sentido).reduce((s, i) => s + i.cantidad, 0);
export const resumenCambio = (c) => `Devuelve ${plural(unidades(c, 'devuelve'), 'unidad', 'unidades')} · recibe ${plural(unidades(c, 'recibe'), 'unidad', 'unidades')}`;
