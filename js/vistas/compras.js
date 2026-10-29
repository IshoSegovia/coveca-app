// Compras a proveedores (decisiones del 12-10-2026; migración 0027):
// - el producto queda con el ÚLTIMO costo (con IVA incluido);
// - si el costo cambia, se sugiere el precio con el margen que tenía y el administrador elige cuáles cambiar;
// - cada compra lleva proveedor, documento (factura / guía / boleta / otro + N°) y fecha. Sube el stock.
// Solo administradores y con señal. Mientras se llena, la compra se guarda como borrador en este equipo.
import { $, esc, normal, hoyChile, barra, icono, vacio, aviso, ir, clp, pct, margen, precioConMargen, fecha, fechaHora, verFoto, plural } from '../ui.js';
import * as datos from '../datos.js';
import { listaCambio } from '../escritorio.js';
import { prepararDocumento } from '../fotos.js';

// ---------------- Fotos del documento (factura, guía, boleta) ----------------
// Hasta 4 (una por página). Se suben apenas se toman; la compra guarda sus rutas (migración 0028).
const MAX_FOTOS = 4;
function htmlFotos(fotos, editable) {
  return `<div class="compra-fotos">${fotos.map((r, i) => `<div class="compra-foto">
      <button type="button" class="compra-foto-ver" data-ver="${i}" aria-label="Ver foto ${i + 1} del documento"><img src="${esc(datos.urlFotoCompra(r))}" alt=""></button>
      ${editable ? `<button type="button" class="btn link quitar-foto" data-quitar="${i}" aria-label="Quitar foto ${i + 1}">Quitar</button>` : ''}</div>`).join('')}</div>
    ${editable && fotos.length < MAX_FOTOS ? `<div class="fila-botones compra-foto-btns">
      <label class="btn sec">${icono('camara')} Tomar foto<input class="foto-doc" type="file" accept="image/*" capture="environment" hidden></label>
      <label class="btn sec">${icono('cuadricula')} Galería<input class="foto-doc" type="file" accept="image/*" hidden></label></div>` : ''}
    <p class="ayuda foto-estado" aria-live="polite">${fotos.length ? `${plural(fotos.length, 'foto')} del documento.${editable && fotos.length < MAX_FOTOS ? ' Si tiene más páginas, agrega otra.' : ''}`
      : editable ? 'Toma una foto de la factura o guía del proveedor: queda guardada con la compra.' : 'Sin foto del documento.'}</p>`;
}
// Conecta los botones de una zona de fotos. leer() da la lista actual y guardar(lista) la deja guardada.
function activarFotos(cont, { compraId, editable, leer, guardar }) {
  const pintar = () => { cont.innerHTML = htmlFotos(leer(), editable); };
  cont.addEventListener('change', async (e) => {
    if (!e.target.classList.contains('foto-doc') || !e.target.files[0]) return;
    const archivo = e.target.files[0];
    cont.querySelectorAll('.foto-doc').forEach((i) => { i.disabled = true; });
    $('.foto-estado', cont).textContent = 'Subiendo foto…';
    try {
      const ruta = await datos.subirFotoCompra(compraId, await prepararDocumento(archivo));
      try { await guardar([...leer(), ruta]); } catch (x) { datos.borrarFotoCompra(ruta); throw x; }
      pintar(); aviso('Foto guardada');
    } catch (x) { pintar(); $('.foto-estado', cont).textContent = x.message; $('.foto-estado', cont).classList.add('error'); }
  });
  cont.addEventListener('click', async (e) => {
    const ver = e.target.closest('[data-ver]');
    if (ver) return verFoto(datos.urlFotoCompra(leer()[Number(ver.dataset.ver)]));
    const q = e.target.closest('[data-quitar]'); if (!q) return;
    if (!confirm('¿Quitar esta foto del documento?')) return;
    const lista = leer(), ruta = lista[Number(q.dataset.quitar)];
    try {
      await guardar(lista.filter((x) => x !== ruta));
      datos.borrarFotoCompra(ruta);
      pintar();
    } catch (x) { aviso(x.message, 'error'); }
  });
  pintar();
}

const TIPOS = [['factura', 'Factura'], ['guia', 'Guía de despacho'], ['boleta', 'Boleta'], ['otro', 'Otro']];
const TIPO_CORTO = { factura: 'Factura', guia: 'Guía', boleta: 'Boleta', otro: 'Doc.' };
const documento = (c) => (c.documento ? `${TIPO_CORTO[c.tipo_documento] || 'Doc.'} N° ${c.documento}` : 'Sin N° de documento');
const soloAdmin = (v) => {
  barra({ titulo: 'Compras', atras: '#/proveedores' });
  v.innerHTML = vacio('Solo para administradores', 'Las compras a proveedores las registra un administrador.');
};

// ---------------- Lista ----------------
let filtroProv = '';
export async function vistaCompras(v) {
  if (!datos.esAdmin()) return soloAdmin(v);
  barra({ titulo: 'Compras', sub: 'A proveedores', atras: '#/proveedores' });
  const [cs, provs] = await Promise.all([datos.compras(), datos.proveedores()]);
  const mes = hoyChile().slice(0, 7);
  v.innerHTML = `
    <label class="campo pad filtro-prov"><span class="sr">Proveedor</span>
      <select id="prov" aria-label="Filtrar por proveedor"><option value="">Todos los proveedores</option>
        ${provs.map((x) => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}</select></label>
    <div id="lista-compras"></div>
    <div class="pie-fijo"><a class="btn prin" href="#/compras/nueva${filtroProv ? `?proveedor=${filtroProv}` : ''}" id="nueva">${icono('mas')} Registrar compra</a></div>`;
  const pintar = () => {
    const vis = cs.filter((c) => !filtroProv || String(c.proveedor_id) === filtroProv);
    const vig = vis.filter((c) => c.estado !== 'anulada' && c.fecha.startsWith(mes));
    $('#nueva', v).href = `#/compras/nueva${filtroProv ? `?proveedor=${filtroProv}` : ''}`;
    $('#lista-compras', v).innerHTML = vis.length ? `
      <p class="cuenta mt">Este mes: <b class="monto">${clp(vig.reduce((s, c) => s + c.total, 0))}</b> en ${plural(vig.length, 'compra')}</p>
      <div class="lista">${vis.map((c) => `
        <a class="fila" href="#/compras/${c.id}">
          <div class="fila-txt"><p class="fila-t">${esc(c.proveedor)}</p>
            <p class="fila-s">${fecha(c.fecha)} · ${esc(documento(c))} · ${plural(c.productos, 'producto')}</p></div>
          ${c.estado === 'anulada' ? `<span class="chip alerta">${icono('alerta', 'ico-s')} Anulada</span>` : `<span class="monto">${clp(c.total)}</span>`}
          ${icono('derecha', 'ico-chev')}</a>`).join('')}</div>`
      : vacio(filtroProv ? 'Sin compras de este proveedor' : 'Aún no hay compras registradas',
        'Registra cada factura o guía que llega: sube el stock y deja el costo al día.');
  };
  $('#prov', v).value = filtroProv;
  $('#prov', v).addEventListener('change', (e) => { filtroProv = e.target.value; pintar(); });
  pintar();
}

// ---------------- Registrar ----------------
const CLAVE_BORRADOR = 'coveca-compra-borrador';
const leerBorrador = () => { try { return JSON.parse(localStorage.getItem(CLAVE_BORRADOR) || 'null'); } catch (_) { return null; } };
const guardarBorrador = (b) => { try { localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(b)); } catch (_) {} };
const borrarBorrador = () => { try { localStorage.removeItem(CLAVE_BORRADOR); } catch (_) {} };
const nuevo = (prov = '') => ({ id: crypto.randomUUID(), proveedor_id: prov, tipo_documento: 'factura', documento: '', fecha: hoyChile(), notas: '', lineas: [], fotos: [] });

export async function vistaCompraNueva(v) {
  if (!datos.esAdmin()) return soloAdmin(v);
  barra({ titulo: 'Registrar compra', atras: '#/compras' });
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const [provs, prods] = await Promise.all([datos.proveedores(), datos.productos({ soloActivos: false })]);
  const porId = new Map(prods.map((p) => [p.id, p]));
  let b = leerBorrador();
  let recuperado = !!(b && (b.lineas?.length || b.documento || b.fotos?.length));
  if (!b || (!recuperado && q.get('proveedor'))) b = nuevo(q.get('proveedor') || '');
  // Desde un pedido al proveedor (#/compras/nueva?pedido=<id>): se llena con sus productos y cantidades y el costo actual.
  // Al guardar, el pedido queda Recibido y enlazado a esta compra.
  let delPedido = null;
  if (q.get('pedido')) {
    delPedido = await datos.pedidoProveedor(q.get('pedido'));
    if (b.pedido_id !== delPedido.id) {
      b = nuevo(String(delPedido.proveedor_id)); b.pedido_id = delPedido.id; recuperado = false;
      b.lineas = delPedido.items.filter((i) => porId.has(i.producto_id)).map((i) => ({ producto_id: i.producto_id, cantidad: String(i.cantidad),
        costo: porId.get(i.producto_id).costo ?? 0, aplicar: false, precio: '', precioManual: false }));
    }
  } else if (b.pedido_id) {
    delPedido = await datos.pedidoProveedor(b.pedido_id).catch(() => null);
  }
  b.lineas = (b.lineas || []).filter((l) => porId.has(l.producto_id));
  b.fotos = b.fotos || [];
  // Vuelta desde "Crear producto nuevo" (#/compras/nueva?agregar=<id>): el producto recién creado entra como línea.
  const agregado = Number(q.get('agregar')) || null;
  if (agregado && porId.has(agregado)) {
    if (!b.lineas.some((l) => l.producto_id === agregado)) b.lineas.push({ producto_id: agregado, cantidad: '', costo: porId.get(agregado).costo ?? 0, aplicar: false, precio: '', precioManual: false });
    guardarBorrador(b);
    history.replaceState(null, '', '#/compras/nueva');   // evita agregarlo otra vez si se recarga
    recuperado = false;
  }

  v.innerHTML = `
    ${recuperado ? `<div class="compra-borrador pad-x"><p class="fila-s">${icono('alerta', 'ico-s')} Seguiste la compra que dejaste a medias en este equipo.</p>
      <button type="button" id="descartar" class="btn link izq">Empezar de nuevo</button></div>` : ''}
    ${delPedido ? `<p class="ayuda pad-x mt">${icono('nota', 'ico-s')} Compra del <b>pedido N° ${delPedido.numero}</b>. Ajusta las cantidades y costos según lo que llegó en la factura o guía.</p>` : ''}
    <form id="f" class="form pad" novalidate>
      <h2 class="sec-t">Documento del proveedor</h2>
      <label class="campo"><span>Proveedor</span>
        <select name="proveedor_id" required><option value="">Elige el proveedor</option>
          ${provs.map((x) => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}</select></label>
      <div class="dos">
        <label class="campo"><span>Documento</span><select name="tipo_documento">${TIPOS.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></label>
        <label class="campo"><span>N° del documento</span><input name="documento" inputmode="numeric" autocomplete="off" placeholder="Ej.: 4521"></label>
      </div>
      <label class="campo"><span>Fecha del documento</span><input name="fecha" type="date" max="${hoyChile()}"></label>

      <h2 class="sec-t">Productos que llegaron</h2>
      <p class="ayuda">Costo por unidad <b>con IVA incluido</b>, tal como queda pagado. El producto queda con este costo.</p>
      <div id="lineas"></div>
      <div class="buscador compra-buscar">${icono('buscar')}<input id="q" type="search" placeholder="Agregar producto: nombre o REF" aria-label="Buscar producto para agregar" autocomplete="off"></div>
      <div id="resultados"></div>
      <button type="button" id="crear-producto" class="btn sec">${icono('mas')} Crear producto nuevo</button>
      <p class="ayuda">¿Llegó mercadería que aún no está en el inventario? Créala aquí y vuelves a esta compra con el producto ya agregado.</p>

      <h2 class="sec-t" id="fotos-t">Foto de la factura o guía</h2>
      <div id="fotos-doc"></div>

      <label class="campo"><span>Notas (opcional)</span><textarea name="notas" rows="2" maxlength="300" placeholder="Ej.: llegó con una caja dañada"></textarea></label>
      <dl class="totales" id="totales"></dl>
      <p id="err" class="error" role="alert"></p>
      <div class="pie-fijo"><button class="btn prin" type="submit" id="guardar">Guardar compra</button></div>
    </form>`;

  const f = $('#f', v);
  f.proveedor_id.value = b.proveedor_id || '';
  f.tipo_documento.value = b.tipo_documento || 'factura';
  f.documento.value = b.documento || '';
  f.fecha.value = b.fecha || hoyChile();
  f.notas.value = b.notas || '';

  const guardar = () => guardarBorrador(b);
  // Cálculos de una línea: ¿cambia el costo?, margen antes / con el precio actual y precio sugerido.
  const calc = (l) => {
    const p = porId.get(l.producto_id), costo = Number(l.costo);
    const cambia = l.costo !== '' && Number.isFinite(costo) && costo !== (p.costo || 0);
    const mAntes = margen(p.costo || 0, p.precio || 0);
    // Redondeado hacia arriba a $10 (los precios de la lista terminan en 0) para no quedar bajo el margen.
    const sugerido = cambia && mAntes != null && mAntes < 1 && costo > 0 ? Math.ceil(precioConMargen(costo, mAntes) / 10) * 10 : null;
    return { p, costo, cambia, sube: cambia && costo > (p.costo || 0), mAntes, mQueda: margen(costo, p.precio || 0), sugerido };
  };
  const mensaje = (k) => k.cambia ? `<span class="${k.sube ? 'txt-ambar' : ''}">${icono(k.sube ? 'alerta' : 'check', 'ico-s')} El costo ${k.sube ? 'sube' : 'baja'} de ${clp(k.p.costo)} a ${clp(k.costo)}.</span>
    Con el precio actual ${clp(k.p.precio)} el margen queda en ${pct(k.mQueda)} (antes ${pct(k.mAntes)}).` : '';
  // La tarjeta se dibuja una vez; al escribir solo se actualizan sus textos (no se pierde el cursor ni el toque).
  const linea = (l) => {
    const k = calc(l);
    if (!l.precioManual) l.precio = k.sugerido ?? '';
    return `<div class="compra-linea" data-pid="${k.p.id}">
      <div class="compra-linea-cab"><div class="fila-txt"><p class="fila-t">${esc(k.p.nombre)}</p>
        <p class="fila-s">${k.p.ref ? `REF ${esc(k.p.ref)} · ` : ''}Stock ${k.p.stock} · Costo actual ${clp(k.p.costo)}</p></div>
        <button type="button" class="btn link quitar" aria-label="Quitar ${esc(k.p.nombre)}">Quitar</button></div>
      <div class="dos">
        <label class="campo"><span>Cantidad</span><input class="c-cant" type="number" inputmode="numeric" min="1" step="1" value="${esc(l.cantidad)}" placeholder="0"></label>
        <label class="campo"><span>Costo unitario</span><input class="c-costo" type="number" inputmode="numeric" min="0" step="1" value="${esc(l.costo)}"></label>
      </div>
      <p class="fila-s c-sub">Subtotal <span class="monto">${clp((Number(l.cantidad) || 0) * (k.costo || 0))}</span></p>
      <div class="compra-precio" ${k.cambia ? '' : 'hidden'}>
        <p class="fila-s c-msg">${mensaje(k)}</p>
        <label class="check c-aplicar-caja" ${k.sugerido ? '' : 'hidden'}><input type="checkbox" class="c-aplicar" ${l.aplicar ? 'checked' : ''}> Cambiar el precio de venta para mantener el margen</label>
        <label class="campo c-precio-campo" ${l.aplicar && k.sugerido ? '' : 'hidden'}><span>Precio nuevo · margen <span class="c-mg">${pct(margen(k.costo, Number(l.precio)))}</span></span>
          <input class="c-precio" type="number" inputmode="numeric" min="1" step="1" value="${esc(l.precio)}"></label>
      </div>
    </div>`;
  };
  const actualizar = (caja, l) => {
    const k = calc(l);
    if (!l.precioManual) { l.precio = k.sugerido ?? ''; $('.c-precio', caja).value = l.precio; }
    $('.c-sub .monto', caja).textContent = clp((Number(l.cantidad) || 0) * (k.costo || 0));
    $('.compra-precio', caja).hidden = !k.cambia;
    $('.c-msg', caja).innerHTML = mensaje(k);
    $('.c-aplicar-caja', caja).hidden = !k.sugerido;
    $('.c-precio-campo', caja).hidden = !(l.aplicar && k.sugerido);
    $('.c-mg', caja).textContent = pct(margen(k.costo, Number(l.precio)));
  };
  const pintarTotales = () => {
    const total = b.lineas.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.costo) || 0), 0);
    const unidades = b.lineas.reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
    const precios = b.lineas.filter((l) => l.aplicar && calc(l).sugerido).length;
    $('#totales', v).innerHTML = `
      <div><dt>Productos</dt><dd>${b.lineas.length} (${unidades} unidades)</dd></div>
      ${precios ? `<div><dt>Precios que cambian</dt><dd>${precios}</dd></div>` : ''}
      <div class="total"><dt>Total con IVA</dt><dd class="monto">${clp(total)}</dd></div>`;
  };
  const pintarLineas = () => {
    $('#lineas', v).innerHTML = b.lineas.length ? b.lineas.map(linea).join('')
      : '<p class="ayuda compra-vacia">Aún no agregas productos. Búscalos abajo por nombre o REF.</p>';
    pintarTotales();
  };
  const deCaja = (e) => {
    const caja = e.target.closest('.compra-linea');
    return caja ? [caja, b.lineas.find((x) => x.producto_id === Number(caja.dataset.pid))] : [];
  };
  $('#lineas', v).addEventListener('input', (e) => {
    const [caja, l] = deCaja(e); if (!l) return;
    if (e.target.classList.contains('c-cant')) l.cantidad = e.target.value;
    if (e.target.classList.contains('c-costo')) { l.costo = e.target.value; l.precioManual = false; }
    if (e.target.classList.contains('c-precio')) { l.precio = e.target.value; l.precioManual = true; }
    actualizar(caja, l); guardar(); pintarTotales();
  });
  $('#lineas', v).addEventListener('change', (e) => {
    if (!e.target.classList.contains('c-aplicar')) return;
    const [caja, l] = deCaja(e); if (!l) return;
    l.aplicar = e.target.checked;
    actualizar(caja, l); guardar(); pintarTotales();
    if (l.aplicar) $('.c-precio', caja).focus();
  });
  $('#lineas', v).addEventListener('click', (e) => {
    const bt = e.target.closest('.quitar'); if (!bt) return;
    const pid = Number(bt.closest('.compra-linea').dataset.pid);
    b.lineas = b.lineas.filter((x) => x.producto_id !== pid);
    guardar(); pintarLineas(); pintarResultados();
  });

  // Buscador: sin texto muestra los productos del proveedor elegido que faltan agregar.
  const pintarResultados = () => {
    const txt = normal($('#q', v).value.trim());
    const ya = new Set(b.lineas.map((l) => l.producto_id));
    const prov = Number(f.proveedor_id.value) || null;
    let lista = prods.filter((p) => !ya.has(p.id));
    let titulo = '';
    if (txt) lista = lista.filter((p) => normal(p.nombre + ' ' + (p.ref || '') + ' ' + (p.marca || '')).includes(txt)).sort((a, c) => (c.proveedor_id === prov) - (a.proveedor_id === prov));
    else if (prov) { lista = lista.filter((p) => p.proveedor_id === prov); titulo = 'Productos de este proveedor'; }
    else lista = [];
    const total = lista.length; lista = lista.slice(0, 12);
    $('#resultados', v).innerHTML = lista.length ? `${titulo ? `<p class="cuenta">${titulo} · toca para agregar</p>` : ''}
      <div class="lista compra-res">${lista.map((p) => `<button type="button" class="fila" data-agregar="${p.id}">
        <div class="fila-txt"><p class="fila-t">${esc(p.nombre)}${p.activo ? '' : ' <span class="txt-suave">(inactivo)</span>'}</p>
          <p class="fila-s">${p.ref ? `REF ${esc(p.ref)} · ` : ''}Stock ${p.stock} · Costo ${clp(p.costo)}</p></div>${icono('mas')}</button>`).join('')}</div>
      ${total > lista.length ? `<p class="ayuda">Y ${total - lista.length} más: escribe parte del nombre para encontrarlo.</p>` : ''}`
      : txt ? '<p class="ayuda">No hay productos con ese nombre o REF. Si es nuevo, toca "Crear producto nuevo" aquí abajo.</p>' : '';
  };
  $('#q', v).addEventListener('input', pintarResultados);
  // La compra queda guardada como borrador en el equipo: al volver se retoma tal como estaba.
  $('#crear-producto', v).addEventListener('click', () => {
    ['proveedor_id', 'tipo_documento', 'documento', 'fecha', 'notas'].forEach((k) => { b[k] = f[k].value; });
    guardar();
    ir(`#/inventario/nuevo?desde=compra${f.proveedor_id.value ? `&proveedor=${f.proveedor_id.value}` : ''}`);
  });
  $('#resultados', v).addEventListener('click', (e) => {
    const bt = e.target.closest('[data-agregar]'); if (!bt) return;
    const p = porId.get(Number(bt.dataset.agregar));
    b.lineas.push({ producto_id: p.id, cantidad: '', costo: p.costo ?? 0, aplicar: false, precio: '', precioManual: false });
    guardar(); pintarLineas();
    $('#q', v).value = ''; pintarResultados();
    $(`.compra-linea[data-pid="${p.id}"] .c-cant`, v)?.focus();
  });

  ['proveedor_id', 'tipo_documento', 'documento', 'fecha', 'notas'].forEach((k) => f[k].addEventListener('input', () => {
    b[k] = f[k].value; guardar();
    if (k === 'proveedor_id') pintarResultados();
  }));
  activarFotos($('#fotos-doc', v), { compraId: b.id, editable: true, leer: () => b.fotos, guardar: async (l) => { b.fotos = l; guardar(); } });
  $('#descartar', v)?.addEventListener('click', () => {
    if ((b.lineas.length || b.fotos.length) && !confirm('¿Borrar lo que llevabas de esta compra y empezar de nuevo?')) return;
    b.fotos.forEach((r) => datos.borrarFotoCompra(r));
    borrarBorrador(); vistaCompraNueva(v);
  });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#err', v); err.textContent = '';
    if (!f.proveedor_id.value) { err.textContent = 'Elige el proveedor de la compra.'; f.proveedor_id.focus(); return; }
    if (!b.lineas.length) { err.textContent = 'Agrega al menos un producto con el buscador.'; $('#q', v).focus(); return; }
    for (const l of b.lineas) {
      const p = porId.get(l.producto_id), cant = Number(l.cantidad), costo = Number(l.costo);
      if (!Number.isInteger(cant) || cant <= 0) { err.textContent = `Escribe la cantidad que llegó de ${p.nombre}.`; $(`.compra-linea[data-pid="${p.id}"] .c-cant`, v)?.focus(); return; }
      if (l.costo === '' || !Number.isInteger(costo) || costo < 0) { err.textContent = `Revisa el costo de ${p.nombre} (en pesos, sin decimales).`; $(`.compra-linea[data-pid="${p.id}"] .c-costo`, v)?.focus(); return; }
      if (l.aplicar && calc(l).sugerido && !(Number.isInteger(Number(l.precio)) && Number(l.precio) > 0)) { err.textContent = `Revisa el precio nuevo de ${p.nombre}.`; return; }
    }
    if (!b.fotos.length && !confirm('No agregaste la foto de la factura o guía del proveedor. Sirve de respaldo si hay dudas después.\n\n¿Guardar sin foto? (Puedes agregarla después desde la compra.)')) {
      $('#fotos-t', v).scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    const total = b.lineas.reduce((s, l) => s + Number(l.cantidad) * Number(l.costo), 0);
    const prov = provs.find((x) => String(x.id) === f.proveedor_id.value)?.nombre || '';
    if (!confirm(`¿Guardar la compra a ${prov} por ${clp(total)}?\n\nSube el stock de ${plural(b.lineas.length, 'producto')} y deja su costo al día.`)) return;
    const boton = $('#guardar', v); boton.disabled = true; boton.textContent = 'Guardando…';
    try {
      const r = await datos.registrarCompra({
        id: b.id, proveedor_id: Number(f.proveedor_id.value), tipo_documento: f.tipo_documento.value,
        documento: f.documento.value.trim() || null, fecha: f.fecha.value || hoyChile(), notas: f.notas.value.trim() || null, fotos: b.fotos,
        items: b.lineas.map((l) => {
          return { producto_id: l.producto_id, cantidad: Number(l.cantidad), costo: Number(l.costo),
            precio: l.aplicar && calc(l).sugerido ? Number(l.precio) : null };
        }),
      });
      borrarBorrador(); listaCambio();
      if (b.pedido_id) {
        try { await datos.recibirPedidoProveedor(b.pedido_id, r.id); }
        catch (x) { aviso(`La compra se guardó, pero el pedido no quedó como recibido (${x.message}). Márcalo desde el pedido.`, 'error'); ir(`#/compras/${r.id}`); return; }
      }
      aviso(b.pedido_id ? 'Compra guardada y pedido recibido: stock y costos al día' : 'Compra guardada: stock y costos al día');
      ir(`#/compras/${r.id}`);
    } catch (x) {
      err.textContent = x.message; boton.disabled = false; boton.textContent = 'Guardar compra';
    }
  });

  pintarLineas();
  pintarResultados();
  guardar();
}

// ---------------- Detalle ----------------
export async function vistaCompra(v, id) {
  if (!datos.esAdmin()) return soloAdmin(v);
  const c = await datos.compra(id);
  const anulada = c.estado === 'anulada';
  barra({ titulo: c.proveedor, sub: `Compra · ${documento(c)}`, atras: '#/compras' });
  const cambios = c.items.filter((i) => i.precio_nuevo);
  v.innerHTML = `
    <div class="nota-cab pad">${anulada ? `<span class="chip alerta">${icono('alerta', 'ico-s')} Anulada</span>` : `<span class="chip ok">${icono('check', 'ico-s')} Vigente</span>`}
      <p class="fila-s">${fecha(c.fecha)}</p></div>
    ${anulada ? `<div class="nota-anulada">
      <p class="fila-t">Compra anulada${c.anulada_en ? ' el ' + esc(fechaHora(c.anulada_en)) : ''}</p>
      ${c.motivo_anulacion ? `<p class="fila-s">Motivo: ${esc(c.motivo_anulacion)}</p>` : ''}
      <p class="fila-s">El stock de estos productos ya se descontó. No cuenta en el total de compras.</p></div>` : ''}
    <h2 class="sec-t">Productos · ${c.items.length}</h2>
    <div class="lista">${c.items.map((i) => {
      const cambio = i.costo_anterior != null && i.costo_anterior !== i.costo;
      return `<a class="fila" href="#/inventario/${i.producto_id}"><div class="fila-txt"><p class="fila-t">${esc(i.nombre)}</p>
        <p class="fila-s">${i.cantidad} × ${clp(i.costo)}${cambio ? ` · antes ${clp(i.costo_anterior)}` : ''}${i.precio_nuevo ? ` · <span class="txt-ambar">precio ${clp(i.precio_anterior)} → ${clp(i.precio_nuevo)}</span>` : ''}</p></div>
        <span class="monto">${clp(i.cantidad * i.costo)}</span></a>`;
    }).join('')}</div>
    <dl class="totales">
      <div><dt>Unidades</dt><dd>${c.items.reduce((s, i) => s + i.cantidad, 0)}</dd></div>
      ${cambios.length ? `<div><dt>Precios cambiados</dt><dd>${cambios.length}</dd></div>` : ''}
      <div class="total"><dt>Total con IVA</dt><dd class="monto">${clp(c.total)}</dd></div>
    </dl>
    <h2 class="sec-t">Foto del documento</h2>
    <div id="fotos-doc" class="pad"></div>
    <dl class="datos">
      <div class="dato"><dt>Documento</dt><dd>${esc(documento(c))}</dd></div>
      ${c.notas ? `<div class="dato"><dt>Notas</dt><dd>${esc(c.notas)}</dd></div>` : ''}
      <div class="dato"><dt>Registrada</dt><dd>${esc(fechaHora(c.creado_en))}${c.registro ? ' · ' + esc(c.registro) : ''}</dd></div>
    </dl>
    ${!anulada ? `<div class="pad nota-acciones">
      <button type="button" id="abrir-anular" class="btn peligro">Anular compra</button>
      <form id="form-anular" class="form anular" hidden>
        <label class="campo"><span>Motivo de la anulación</span>
          <input id="motivo" type="text" maxlength="120" placeholder="Ej.: se ingresó una cantidad equivocada" required></label>
        <p class="ayuda">Se descuenta del stock lo que sumó esta compra. Si nadie cambió el costo o el precio después, vuelven a los de antes. No se puede deshacer: si hubo un error, anúlala y regístrala de nuevo.</p>
        <p id="err-anular" class="error" role="alert"></p>
        <div class="fila-botones"><button type="button" id="cancelar-anular" class="btn sec">Cancelar</button>
          <button type="submit" class="btn peligro sin-margen">Confirmar anulación</button></div>
      </form></div>` : ''}
    <div class="pie-fijo"><a class="btn prin" href="#/compras/nueva?proveedor=${c.proveedor_id}">${icono('mas')} Registrar otra compra</a></div>`;

  let fotos = c.fotos || [];
  activarFotos($('#fotos-doc', v), { compraId: c.id, editable: true, leer: () => fotos,
    guardar: async (l) => { await datos.cambiarFotosCompra(c.id, l); fotos = l; } });
  const form = $('#form-anular', v);
  $('#abrir-anular', v)?.addEventListener('click', (e) => { e.currentTarget.hidden = true; form.hidden = false; $('#motivo', v).focus(); });
  $('#cancelar-anular', v)?.addEventListener('click', () => { form.hidden = true; $('#abrir-anular', v).hidden = false; });
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const motivo = $('#motivo', v).value.trim();
    if (!motivo) { $('#err-anular', v).textContent = 'Escribe el motivo de la anulación.'; return; }
    try {
      await datos.anularCompra(c.id, motivo);
      aviso('Compra anulada: stock descontado'); listaCambio();
      vistaCompra(v, id);
    } catch (err) { $('#err-anular', v).textContent = err.message; }
  });
}

// Últimas compras de un producto, para su ficha en Inventario (solo admin).
export function htmlComprasProducto(lista) {
  return `<h2 class="sec-t">Últimas compras</h2>
    ${lista.length ? `<div class="lista">${lista.map((x) => `<a class="fila" href="#/compras/${x.id}">
      <div class="fila-txt"><p class="fila-t">${esc(x.proveedor)}</p><p class="fila-s">${fecha(x.fecha)} · ${x.cantidad} × ${clp(x.costo)}</p></div>
      ${icono('derecha', 'ico-chev')}</a>`).join('')}</div>`
    : '<p class="ayuda pad">Aún sin compras registradas. Se registran en Inventario → Compras.</p>'}`;
}
