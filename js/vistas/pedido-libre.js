// Pedido libre a proveedor (pedido del 20-10-2026): como armar una nota nueva, pero hacia el proveedor.
// Se elige el proveedor y cualquier producto —con stock bajo o no— y se envía. Usa el mismo pedido guardado
// de siempre (migración 0041: guardar_pedido_proveedor), así que queda con número y estado y se recibe igual.
// "Sus productos" = los que ese proveedor surte como principal o como respaldo; "Todo el catálogo" = cualquiera.
// Sin costos para el proveedor (el costo estimado que se muestra es solo para el administrador). Con señal.
// Corregir (ticket N° 20, 2.14.0): "Corregir pedido" abre esta misma pantalla con ?editar=<id> (mismo id, proveedor fijo,
// cantidades y notas del pedido; también los productos que hoy están inactivos). Es la única forma de corregir un pedido:
// antes la pantalla de sugeridos solo mostraba y guardaba los productos del proveedor principal y borraba el resto.
import { $, esc, barra, icono, vacio, aviso, ir, clp, plural, normal } from '../ui.js';
import * as datos from '../datos.js';
import { enviarPdfWhatsApp } from '../pdf.js';
import { telWhatsApp } from '../campos.js';
import { listaCambio } from '../escritorio.js';
import { pdfPedidoProveedor, textoPedidoProveedor, ESTADO_PP } from './pedidos-proveedor.js';

const MAX_CANT = 9999;
const ABIERTOS = ['por_enviar', 'enviado'];          // los únicos que se pueden corregir

// Costo estimado del pedido (solo lo ve el administrador; nunca va al proveedor). Una sola regla para el total en vivo y Revisar.
export const costoEstimado = (cant, porId) => [...cant].reduce((s, [pid, n]) => s + (n > 0 ? (porId.get(pid)?.costo || 0) * n : 0), 0);
let abierta = null;                                // la pantalla que está viva (en PC la ficha no se destruye al cambiar de ficha)

export async function vistaPedidoLibre(v) {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const editar = q.get('editar');
  barra({ titulo: editar ? 'Corregir pedido' : 'Pedido libre', sub: 'A un proveedor', atras: editar ? `#/pedidos-proveedor/${editar}` : '#/proveedores' });
  if (!datos.esAdmin()) { v.innerHTML = vacio('Solo para administradores', 'Los pedidos a proveedores los maneja un administrador.'); return; }
  // Al corregir se traen también los inactivos: un producto del pedido que se desactivó después no puede perderse al guardar.
  const [provs, todos, previo] = await Promise.all([datos.proveedores(), datos.productos({ soloActivos: !editar }), editar ? datos.pedidoProveedor(editar) : null]);
  if (previo && !ABIERTOS.includes(previo.estado)) {
    v.innerHTML = vacio('Este pedido ya no se puede corregir', `Está ${ESTADO_PP[previo.estado].t.toLowerCase()}.`, `<a class="btn prin" href="#/pedidos-proveedor/${previo.id}">Ver el pedido</a>`);
    return;
  }
  const enPedido = new Set((previo?.items || []).map((i) => i.producto_id));
  const prods = todos.filter((p) => p.activo !== false || enPedido.has(p.id));
  const activos = provs.filter((x) => x.activo !== false || x.id === previo?.proveedor_id);
  if (!activos.length) {
    v.innerHTML = vacio('Primero agrega un proveedor', 'El pedido libre se le envía a un proveedor de tu lista.', '<a class="btn prin" href="#/proveedores/nuevo">Agregar proveedor</a>');
    return;
  }

  const id = previo?.id || crypto.randomUUID();  // el mismo id si se reintenta: no duplica el pedido
  const est = { prov: previo ? previo.proveedor_id : activos.find((x) => String(x.id) === q.get('proveedor'))?.id ?? null,
    modo: 'suyos', busca: '', paso: 'elegir', notas: previo?.notas || '' };
  const cant = new Map((previo?.items || []).map((i) => [i.producto_id, i.cantidad]));   // producto_id -> cantidad; se conserva al cambiar de lista o de modo
  const atrasElegir = previo ? `#/pedidos-proveedor/${id}` : '#/proveedores';
  const aqui = location.hash;                    // la dirección de esta pantalla (con ?editar o ?proveedor)
  const porId = new Map(prods.map((p) => [p.id, p]));
  // Una línea del pedido que no vino en la lista (p. ej. más de 1.000 productos) igual se muestra y se guarda, con costo 0.
  for (const i of previo?.items || []) if (!porId.has(i.producto_id)) {
    const x = { id: i.producto_id, nombre: i.nombre, ref: i.ref, stock: i.stock ?? 0, costo: 0, proveedor_id: null, fueraDeLista: true };
    prods.push(x); porId.set(x.id, x);
  }
  const nombreProv = (pid) => provs.find((x) => x.id === pid)?.nombre || null;
  const items = () => [...cant].filter(([, n]) => n > 0).map(([producto_id, cantidad]) => ({ producto_id, cantidad }));
  const unidades = () => items().reduce((s, x) => s + x.cantidad, 0);
  const costo = () => costoEstimado(cant, porId);
  // Productos elegidos sin costo registrado: el costo estimado los cuenta en $0, así que se avisa cuántos son.
  const sinCosto = () => items().filter((x) => !(porId.get(x.producto_id)?.costo > 0)).length;
  const textoSinCosto = () => { const n = sinCosto(); return n ? ` · ${plural(n, 'producto')} sin costo registrado` : ''; };
  // Salir del paso 1 con cambios sin guardar pide confirmar (botón atrás de Android, como en el pedido de venta).
  const firma = () => JSON.stringify([items().sort((a, b) => a.producto_id - b.producto_id), est.notas]);
  const firmaInicial = firma();
  const confirmarSalida = () => { window.covecaConfirmarSalida = { hash: aqui,
    fn: () => est.paso !== 'elegir' || firma() === firmaInicial || confirm('¿Salir sin guardar los cambios del pedido?') }; };
  const guardarNotas = () => { const f = $('#f', v); if (f) est.notas = f.notas.value; };

  // "Revisar" no cambia la dirección, así que el atrás del navegador la dejaría de golpe. Al entrar a Revisar se agrega
  // una entrada al historial (misma dirección); atrás la saca y vuelve a elegir productos, y adelante vuelve a Revisar.
  const yo = (abierta = Symbol('pedido-libre'));
  let apilado = false;
  const alNavegar = (e) => {
    if (abierta !== yo) { window.removeEventListener('popstate', alNavegar); return; }          // ya hay otra pantalla
    if (!/^#\/proveedores\/pedido-libre/.test(location.hash)) return;                           // se está yendo a otra pantalla
    if (e.state?.plRevisar) { if (est.paso === 'elegir' && est.prov && items().length) { apilado = true; pintarRevisar(); } }
    else if (est.paso === 'revisar') { apilado = false; guardarNotas(); pintarElegir(); }
  };
  window.addEventListener('popstate', alNavegar);
  // Si se llegó aquí volviendo (o recargando) sobre la entrada de Revisar, se retrocede una más: la pantalla nace en el paso 1.
  if (history.state?.plRevisar) history.back();

  // ---------------- Paso 1: proveedor y productos ----------------
  function pintarElegir() {
    est.paso = 'elegir';
    confirmarSalida();
    barra(previo ? { titulo: `Corregir pedido N° ${previo.numero}`, sub: previo.proveedor?.nombre || nombreProv(est.prov) || '', atras: atrasElegir }
      : { titulo: 'Pedido libre', sub: 'A un proveedor', atras: atrasElegir });
    v.innerHTML = `
      ${previo ? `<p class="ayuda pad mt">Cambia las cantidades o agrega productos; con 0 el producto sale del pedido. El proveedor no se puede cambiar.</p>`
      : `<div class="form pad">
        <label class="campo"><span>Proveedor</span>
          <select id="pl-prov"><option value="">Elige el proveedor</option>
            ${activos.map((x) => `<option value="${x.id}" ${x.id === est.prov ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}
          </select></label>
      </div>`}
      <div class="inv-cab"><div class="buscador">${icono('buscar')}<input id="pl-q" type="search" placeholder="Buscar producto, marca o REF" value="${esc(est.busca)}" aria-label="Buscar producto"></div></div>
      <div class="filtros" role="tablist" aria-label="Qué productos mostrar">
        <button type="button" class="filtro" role="tab" data-m="suyos" aria-selected="${est.modo === 'suyos'}">Sus productos</button>
        <button type="button" class="filtro" role="tab" data-m="todo" aria-selected="${est.modo === 'todo'}">Todo el catálogo</button>
      </div>
      <div id="pl-lista"></div>
      <p class="ayuda pad">En “Sus productos” salen los que este proveedor surte como principal o como respaldo${previo ? ' y los que ya trae el pedido' : ''}. En “Todo el catálogo” puedes agregar cualquier producto, tenga o no stock bajo. El costo estimado usa el último costo registrado de cada producto y solo tú lo ves.</p>
      <div class="pie-fijo"><p id="pl-total" class="total-reponer" aria-live="polite"></p>
        <button type="button" class="btn prin" id="pl-revisar">Revisar pedido</button></div>`;

    $('#pl-prov', v)?.addEventListener('change', (e) => { est.prov = Number(e.target.value) || null; pintarLista(); });
    $('#pl-q', v).addEventListener('input', (e) => { est.busca = e.target.value; pintarLista(); });
    v.querySelectorAll('.filtro').forEach((b) => b.addEventListener('click', () => {
      est.modo = b.dataset.m;
      v.querySelectorAll('.filtro').forEach((x) => x.setAttribute('aria-selected', x === b));
      pintarLista();
    }));
    $('#pl-revisar', v).addEventListener('click', () => {
      if (!est.prov) return aviso('Elige primero el proveedor.', 'error');
      if (!items().length) return aviso('Indica la cantidad de al menos un producto.', 'error');
      pintarRevisar();
    });
    pintarLista();
  }

  const fila = (p) => {
    const n = cant.get(p.id) || 0;
    const rol = p.proveedor_id === est.prov ? '' : p.proveedor_respaldo_id === est.prov ? '<span class="chip">Respaldo aquí</span>'
      : nombreProv(p.proveedor_id) ? `<span class="chip">De ${esc(nombreProv(p.proveedor_id))}</span>` : '<span class="chip">Sin proveedor</span>';
    return `<div class="fila prod ${n > 0 ? 'sel' : ''}" data-id="${p.id}">
      <div class="fila-txt"><p class="fila-t">${esc(p.nombre)}</p>
        <p class="fila-s">${p.stock <= 0 ? '<span class="txt-alerta">Sin stock</span>' : `Stock ${p.stock}`}${p.ref ? ` · REF ${esc(p.ref)}` : ''} ${rol}${p.activo === false ? ' <span class="chip">Inactivo</span>' : ''}${p.fueraDeLista || !(p.costo > 0) ? ' <span class="chip">Sin costo</span>' : ''}</p></div>
      <div class="cantidad" role="group" aria-label="Cantidad a pedir de ${esc(p.nombre)}">
        <button type="button" class="cant-btn" data-d="-1" aria-label="Uno menos">${icono('menos')}</button>
        <input class="cant-n" type="number" inputmode="numeric" min="0" value="${n}" aria-label="Cantidad">
        <button type="button" class="cant-btn" data-d="1" aria-label="Uno más">${icono('mas')}</button>
      </div></div>`;
  };

  function total() {
    const it = items();
    $('#pl-total', v).innerHTML = it.length
      ? `<b>${plural(it.length, 'producto')}</b> · <b>${unidades()}</b> unidades<br><span class="pl-costo">Costo estimado <b class="monto">${clp(costo())}</b> · solo tú lo ves${textoSinCosto()}</span>`
      : 'Aún no eliges productos';
  }

  function pintarLista() {
    const caja = $('#pl-lista', v);
    if (!est.prov) { caja.innerHTML = '<p class="ayuda pad">Elige el proveedor para ver sus productos. Si quieres, puedes cambiarlo después sin perder lo que elegiste.</p>'; total(); return; }
    const b = normal(est.busca);
    let lista = prods.filter((p) => !b || normal(`${p.nombre} ${p.ref || ''} ${p.marca || ''} ${p.codigo_barras || ''}`).includes(b));
    if (est.modo === 'suyos') lista = lista.filter((p) => p.proveedor_id === est.prov || p.proveedor_respaldo_id === est.prov || cant.get(p.id) > 0);
    // Los ya elegidos primero; luego por nombre.
    lista.sort((a, c) => (cant.get(c.id) > 0) - (cant.get(a.id) > 0) || a.nombre.localeCompare(c.nombre, 'es'));
    caja.innerHTML = lista.length ? `<div class="lista">${lista.map(fila).join('')}</div>`
      : est.modo === 'suyos' && !b ? `<div class="vacio"><p class="vacio-t">Este proveedor aún no tiene productos</p><p>Asígnaselos desde la ficha de cada producto, o pasa a “Todo el catálogo” para armar el pedido igual.</p></div>`
      : '<p class="ayuda pad">No hay productos con esa búsqueda.</p>';
    caja.querySelectorAll('.fila.prod').forEach((f) => {
      const pid = Number(f.dataset.id), inp = f.querySelector('.cant-n');
      const set = (n) => { n = Math.min(MAX_CANT, Math.max(0, Math.floor(n) || 0)); cant.set(pid, n); inp.value = n; f.classList.toggle('sel', n > 0); total(); };
      f.querySelectorAll('.cant-btn').forEach((bt) => bt.addEventListener('click', () => set((cant.get(pid) || 0) + Number(bt.dataset.d))));
      inp.addEventListener('change', () => set(Number(inp.value)));
    });
    total();
  }

  // ---------------- Paso 2: revisar y enviar ----------------
  function pintarRevisar() {
    est.paso = 'revisar';
    if (!apilado) { history.pushState({ plRevisar: true }, ''); apilado = true; }
    const prov = provs.find((x) => x.id === est.prov);
    const it = items();
    const costoTotal = costo();
    const wa = telWhatsApp(prov.telefono || '');
    const yaEnviado = previo?.estado === 'enviado';
    barra({ titulo: previo ? `Revisar corrección N° ${previo.numero}` : 'Revisar pedido', sub: prov.nombre, atras: aqui });
    v.innerHTML = `
      <div class="lista"><div class="fila"><span class="avatar" aria-hidden="true">${esc(prov.nombre.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase())}</span>
        <div class="fila-txt"><p class="fila-t">${esc(prov.nombre)}</p><p class="fila-s">${previo ? `Pedido N° ${previo.numero} · ${ESTADO_PP[previo.estado].t}` : 'Pedido libre · lo eliges tú, sin sugerencia de stock'}</p></div></div></div>
      ${!wa ? `<a class="nota-falta" href="#/proveedores/${prov.id}/editar">Falta el WhatsApp de ${esc(prov.nombre)}: se abrirá WhatsApp para que elijas el contacto. Toca para completarlo.</a>` : ''}
      ${yaEnviado ? `<p class="nota-falta" role="note">${icono('alerta', 'ico-s')} El proveedor tiene la versión anterior de este pedido. Si cambiaste algo, recuerda reenviárselo.</p>` : ''}
      <h2 class="sec-t">Productos · ${it.length}</h2>
      <div class="lista" id="pl-rev">${it.map((x) => {
        const p = porId.get(x.producto_id);
        return `<div class="fila" data-id="${x.producto_id}"><div class="fila-txt"><p class="fila-t">${esc(p.nombre)}</p>
          <p class="fila-s">${p.costo > 0 ? `Costo ${clp(p.costo)} c/u` : 'Sin costo registrado'}</p></div>
          <span class="pp-cant">${x.cantidad} unid.</span>
          <button type="button" class="btn link" data-quitar="${x.producto_id}" aria-label="Quitar ${esc(p.nombre)}">${icono('basura')}</button></div>`;
      }).join('')}</div>
      <form id="f" class="form pad" novalidate>
        <label class="campo"><span>Nota para el proveedor (opcional)</span>
          <textarea name="notas" rows="2" maxlength="300" placeholder="Ej.: despacho el jueves, por favor">${esc(est.notas)}</textarea></label>
        ${sinCosto() ? `<p class="ayuda">${plural(sinCosto(), 'producto')} sin costo registrado: el costo estimado no los incluye.</p>` : ''}
        <dl class="totales"><div class="total"><dt>Costo estimado (solo tú lo ves)</dt><dd class="monto">${clp(costoTotal)}</dd></div>
          <div class="total"><dt>Unidades a pedir</dt><dd>${unidades()}</dd></div></dl>
        <p id="err" class="error" role="alert"></p>
        <div class="pie-fijo">${yaEnviado
          ? `<button type="submit" class="btn prin" id="pl-enviar">${icono('whatsapp')} Guardar y reenviar por WhatsApp</button>
          <button type="button" class="btn sec" id="pl-guardar">Guardar cambios sin reenviar</button>`
          : `<button type="submit" class="btn prin" id="pl-enviar">${icono('whatsapp')} Guardar y enviar por WhatsApp</button>
          <button type="button" class="btn sec" id="pl-guardar">${previo ? 'Guardar cambios sin enviar' : 'Guardar sin enviar'}</button>`}</div>
      </form>`;

    // La flecha ← (y el botón atrás de Android, que la sigue) vuelve al paso anterior sin perder lo elegido.
    $('#barra .barra-btn[aria-label="Volver"]')?.addEventListener('click', (e) => {
      e.preventDefault(); guardarNotas();
      if (apilado) history.back(); else pintarElegir();     // history.back() dispara alNavegar, que pinta el paso 1
    });
    v.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', () => {
      cant.set(Number(b.dataset.quitar), 0);
      guardarNotas();
      if (!items().length) { if (apilado) history.back(); else pintarElegir(); } else pintarRevisar();
    }));

    let guardado = null;                          // el pedido ya guardado: si falla el envío, no se guarda otra vez
    const guardar = async () => {
      if (guardado) return guardado;
      est.notas = $('#f', v).notas.value.trim();
      // Un pedido nuevo se guarda "Por enviar"; pasa a "Enviado" solo cuando el envío por WhatsApp se completa (o desde su pantalla).
      // Al corregir no se manda estado: el pedido conserva el suyo (Por enviar o Enviado).
      await datos.guardarPedidoProveedor({ id, proveedor_id: prov.id, notas: est.notas || null, items: items(), completo: true, ...(previo ? {} : { estado: 'por_enviar' }) });
      listaCambio();
      guardado = id;
      return id;
    };
    const bGuardar = $('#pl-guardar', v), bEnviar = $('#pl-enviar', v);
    const conBoton = (b, txt, fn) => async () => {
      const html = b.innerHTML; bGuardar.disabled = bEnviar.disabled = true; b.textContent = txt;
      try { await fn(); } catch (err) { const e = $('#err', v); if (e) e.textContent = err.message || 'No se pudo completar. Intenta de nuevo.'; bGuardar.disabled = bEnviar.disabled = false; b.innerHTML = html; }
    };
    bGuardar.addEventListener('click', conBoton(bGuardar, 'Guardando…', async () => {
      const pid = await guardar();
      aviso(previo ? 'Pedido corregido' : 'Pedido guardado como Por enviar. Puedes enviarlo desde su pantalla.'); ir(`#/pedidos-proveedor/${pid}`);
    }));
    $('#f', v).addEventListener('submit', (e) => { e.preventDefault(); });
    bEnviar.addEventListener('click', conBoton(bEnviar, 'Preparando…', async () => {
      const pid = await guardar();
      const [pp, neg] = await Promise.all([datos.pedidoProveedor(pid), datos.configuracion().catch(() => null)]);
      const nombre = `COVECA-pedido-${pp.numero}-${(prov.nombre || '').normalize('NFD').replace(/[^\w]+/g, '-')}.pdf`;
      let fallo = null;
      try {
        const salio = await enviarPdfWhatsApp(await pdfPedidoProveedor(pp, neg), nombre, { telefono: wa, texto: textoPedidoProveedor(pp, neg) });
        if (salio && !yaEnviado) await datos.marcarPedidoProveedorEnviado(pid);   // si se cancela o falla, queda Por enviar (en el PC: "Ya lo envié")
      } catch (err) { fallo = err; }
      // el pedido ya está guardado: se ve su estado y desde ahí se reenvía
      ir(`#/pedidos-proveedor/${pid}`);
      if (fallo) aviso(yaEnviado ? `Los cambios quedaron guardados, pero no se pudo reenviar: ${fallo.message || 'intenta de nuevo'}.`
        : `El pedido quedó guardado como Por enviar, pero no se pudo enviar: ${fallo.message || 'intenta de nuevo'}.`, 'error');
    }));
  }

  pintarElegir();
}
