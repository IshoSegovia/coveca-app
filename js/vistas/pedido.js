import { $, $$, esc, normal, barra, icono, vacio, aviso, ir, clp, diaMes, plural, FORMAS_PAGO, hoyChile, sumarDias, ZONA } from '../ui.js';
import { campoTel } from '../campos.js';
import * as datos from '../datos.js';
import { imprimirNota, hayTermica, config as impresora } from '../impresora.js';
import { validezPorDefecto, guardarValidez, VALIDEZ_MAX } from './cotizaciones.js';
import { esApp } from '../nativo.js';
import * as lealtad from '../lealtad.js';
import { avisoFiado } from './fiado.js';
import { tieneGps, miUbicacion } from '../gps.js';
import { miniatura } from './inventario.js';
import { vuelaAlTotal, vibrar, contar } from '../anima.js';
import { celebrar, sentir } from '../sentir.js';
import { revisarVenta } from '../logros.js';
import { leerCodigo } from '../escaner.js';

// Pedido en dos pasos: 1) elegir productos y cantidades; 2) revisar y generar (la forma de pago se registra al entregar).
const MAX_CANT = 9999;   // tope por producto: evita totales imposibles por un error de tipeo
const avisoSinPrecio = (p) => aviso(`${p.nombre} no tiene precio. Pide que lo corrijan en Inventario antes de venderlo.`, 'error');   // sin precio no se vende

// Cotización (#/clientes/:id/cotizacion, migración 0051): la misma pantalla arma una cotización en vez de una nota:
// sin lealtad ni crédito, con fecha de validez, y al final "Guardar cotización" (no imprime ni toma número de nota).
export const vistaCotizacion = (v, clienteId) => vistaPedido(v, clienteId, { cotizacion: true });
// Cliente nuevo (migración 0052): cotizar a alguien que aún no es cliente (#/cotizaciones/nueva: solo nombre y teléfono)
// y convertir esa cotización en pedido (#/cotizaciones/:id/convertir: se elige la ruta; el servidor crea el cliente y la nota).
export const vistaCotizacionNueva = (v) => vistaPedido(v, null, { cotizacion: true });
export const vistaConvertirNuevo = (v, cotId) => vistaPedido(v, null, { convertirNuevo: cotId });
const diaHoy = () => { const d = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, weekday: 'short' }).format(new Date()); return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(d) + 1; };

export async function vistaPedido(v, clienteId, { cotizacion: esCot = false, convertirNuevo = null } = {}) {
  const sinCliente = clienteId == null;   // cliente nuevo: todavía no existe en la app
  // Editar: ?editar=<id> abre el pedido original con sus productos. Al generar, la nota original
  // queda anulada (con motivo) y se crea una nota nueva que la reemplaza.
  // Convertir: ?cotizacion=<id> abre el pedido con los productos de una cotización (con sus precios si sigue vigente).
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const editarId = esCot ? null : params.get('editar');
  const desdeCotId = convertirNuevo || (esCot || editarId ? null : params.get('cotizacion'));
  // Todo se pide a la vez (antes eran 5 esperas seguidas; con señal de ruta, varios segundos).
  //  - Programa de lealtad: nivel actual del cliente (si no se puede leer, el pedido sigue sin descuento de nivel)
  //  - Crédito del cliente (para avisar si el pedido a crédito supera el límite)
  //  - Repetir el último pedido y "Suele comprar" (solo en un pedido nuevo)
  const [c0, prods0, orig, le, fi, hab, cot, rutas] = await Promise.all([
    sinCliente ? null : datos.cliente(clienteId),
    datos.productos(),
    editarId ? datos.pedido(editarId) : null,
    esCot || sinCliente ? null : Promise.all([datos.programaLealtad(), datos.comprasLealtad(clienteId)])
      .then(([cfg, compras]) => (cfg.activo ? { cfg, compras, e: lealtad.estado(compras, cfg) } : null)).catch(() => null),
    esCot || sinCliente ? null : datos.fiadoCliente(clienteId).catch(() => null),
    editarId || sinCliente ? null : datos.habitosCliente(clienteId).catch(() => null),
    desdeCotId ? datos.cotizacion(desdeCotId) : null,
    convertirNuevo ? datos.rutas().catch(() => []) : null,
  ]);
  // Cliente nuevo: sus datos vienen de la cotización (al convertir) o se piden en Revisar (al cotizar)
  const c = c0 || { id: null, nombre: cot?.prospecto_nombre || 'Cliente nuevo', telefono: cot?.prospecto_telefono || '', activo: true, ruta_id: null, nuevo: true };
  let nuevoNombre = '', nuevoTel = '';
  const rutasNuevo = (rutas || []).filter((x) => !x.especial && x.activa !== false);
  let nuevaRuta = rutasNuevo.find((x) => x.dia_semana === diaHoy())?.id ?? '';   // la ruta de hoy, si hay
  let prods = prods0;
  if (orig && (!datos.puedeCorregir(orig) || String(orig.cliente_id) !== String(clienteId))) throw new Error('Esta nota no se puede editar.');
  if (esCot && c.activo === false) throw new Error('Este cliente está desactivado: reactívalo para hacerle una cotización.');
  // Desde una cotización: sus productos (los que siguen a la venta) con sus precios si sigue vigente; si venció, los de hoy.
  const cotVigente = cot && datos.cotizacionVigente(cot);
  let cotOmitidos = 0;
  if (cot) {
    if (convertirNuevo ? cot.cliente_id != null : String(cot.cliente_id) !== String(clienteId)) throw new Error(convertirNuevo ? 'Este cliente ya se creó: vuelve a abrir la cotización para convertirla.' : 'Esta cotización es de otro cliente.');
    if (cot.eliminada_en) throw new Error('Esta cotización se eliminó. Toma el pedido de forma normal.');
    // Ya convertida: se bloquea salvo que se sepa que su nota está anulada (sin señal la nota puede no estar en el celular)
    if (cot.pedido_id && cot.nota?.estado !== 'anulado') throw new Error(`Esta cotización ya se convirtió en ${cot.nota?.numero ? `la nota N° ${cot.nota.numero}` : 'una nota'}.`);
    if (cotVigente) {
      const precioCot = new Map(cot.items.map((i) => [i.producto_id, i.precio]));
      prods = prods.map((p) => (precioCot.has(p.id) ? { ...p, precio: precioCot.get(p.id) } : p));
    }
    cotOmitidos = cot.items.filter((i) => !prods.some((p) => p.id === i.producto_id && p.precio > 0)).length;
  }
  if (orig) {
    // Los productos del pedido original mantienen el precio con que se vendieron; los nuevos van a precio actual.
    const precioOrig = new Map(orig.items.map((i) => [i.producto_id, i.precio]));
    prods = prods.map((p) => (precioOrig.has(p.id) ? { ...p, precio: precioOrig.get(p.id), stock: p.stock + (orig.items.find((i) => i.producto_id === p.id)?.cantidad || 0) } : p));
    for (const i of orig.items) if (!prods.some((p) => p.id === i.producto_id)) prods.push({ id: i.producto_id, nombre: i.nombre, precio: i.precio, costo: i.costo || 0, stock: i.cantidad });
  }
  const idPedido = crypto.randomUUID();   // fijo por pantalla: reintentar no duplica el pedido
  let motivo = '';
  const deudaOriginal = orig?.forma_pago === 'credito' ? (fi?.notas.find((n) => n.pedido_id === orig.id)?.pendiente || 0) : 0;
  const carro = new Map(orig ? orig.items.map((i) => [i.producto_id, i.cantidad])
    : cot ? cot.items.filter((i) => prods.some((p) => p.id === i.producto_id && p.precio > 0)).map((i) => [i.producto_id, i.cantidad]) : []); // producto_id -> cantidad
  // La forma de pago se decide al entregar (confirmado el 15-10-2026): la nota nueva queda "pendiente".
  // Al editar una nota antigua que ya tenía forma de pago, se mantiene.
  const forma = orig?.forma_pago || 'pendiente';
  let filtro = '', descuento = orig?.descuento || (cotVigente ? cot.descuento || 0 : 0);
  const tituloPedido = orig ? `Editar nota N° ${orig.numero}` : esCot ? 'Nueva cotización' : cot ? 'Pedido desde cotización' : 'Nuevo pedido';
  // Validez de la cotización (día de Chile): la última elegida en este equipo (3 días si nunca se eligió)
  let validaHasta = esCot ? sumarDias(hoyChile(), validezPorDefecto()) : null;
  const palabra = esCot ? 'cotización' : 'pedido';

  const total = () => [...carro].reduce((s, [id, n]) => s + n * prods.find((p) => p.id === id).precio, 0);
  // Descuento de lealtad de la nota actual (con tope para no bajar del margen mínimo)
  const descLealtad = () => (le ? lealtad.descuentoNota([...carro].map(([id, n]) => { const p = prods.find((x) => x.id === id); return { precio: p.precio, costo: p.costo, cant: n }; }),
    le.e.nivel.descuento, le.cfg.margen_minimo) : { monto: 0, limitado: false });
  const unidades = () => [...carro.values()].reduce((s, n) => s + n, 0);

  // Salir de la lista con productos elegidos (atrás de Android o flecha ←) pide confirmar: antes se perdía el pedido.
  const confirmarSalida = () => !carro.size || guardado || confirm(`¿Descartar ${esCot ? 'esta cotización' : 'este pedido'}? Se perderán los productos que elegiste.`);
  window.covecaConfirmarSalida = { hash: location.hash, fn: confirmarSalida };
  function pasoProductos() {
    v.scrollTop = 0;
    barra({ titulo: tituloPedido, sub: sinCliente && esCot ? 'Cliente nuevo' : c.nombre, atras: orig ? `#/pedidos/${orig.id}` : cot ? `#/cotizaciones/${cot.id}` : sinCliente ? '#/nuevo?tipo=cotizacion' : `#/clientes/${clienteId}` });
    v.innerHTML = `
      <div id="habitos"></div>
      <div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Buscar producto, marca o REF" value="${esc(filtro)}" aria-label="Buscar producto"><button type="button" class="buscador-esc" id="escanear" aria-label="Escanear código de barras">${icono('escanear')}</button></div>
      <div id="lista" class="lista prod"></div>
      <div class="pie-fijo pedido-pie">
        <div class="pedido-total"><p id="unid"></p><p id="tot" class="monto grande"></p></div>
        <button id="sig" class="btn prin">Revisar ${palabra}</button>
      </div>`;
    $('#q', v).addEventListener('input', (e) => { filtro = e.target.value.trim(); pintarLista(); });
    pintarHabitos();
    if (cot && !pasoProductos.avisado) {   // una sola vez: de dónde vienen los productos y precios
      pasoProductos.avisado = true;
      aviso(`${cotVigente ? 'Productos y precios de la cotización' : 'La cotización venció: productos de la cotización con los precios de hoy'}${cotOmitidos ? ` · ${plural(cotOmitidos, 'producto')} ya no se vende${cotOmitidos > 1 ? 'n' : ''}` : ''}`, cotOmitidos ? 'error' : 'ok');
    }
    // Escanear: busca el producto por código de barras (o REF) y suma 1 al pedido
    $('#escanear', v).addEventListener('click', async () => {
      const cod = await leerCodigo({ titulo: 'Agregar producto' });
      if (!cod) return;
      const p = prods.find((x) => x.codigo_barras === cod) || prods.find((x) => x.ref === cod);
      if (!p) { aviso(`No hay ningún producto con el código ${cod}. Agrégalo en Inventario (campo "Código de barras").`, 'error'); return; }
      if (!(p.precio > 0)) { avisoSinPrecio(p); return; }
      carro.set(p.id, (carro.get(p.id) || 0) + 1);
      filtro = ''; $('#q', v).value = ''; pintarHabitos(); pintarLista();
      const fila = v.querySelector(`.fila.prod[data-id="${p.id}"]`);
      fila?.scrollIntoView({ block: 'center' }); fila?.classList.add('anim-late');
      vibrar(); aviso(`${p.nombre}: ${carro.get(p.id)} en el pedido`);
    });
    $('#sig', v).addEventListener('click', () => { if (carro.size) pasoRevisar(); });
    document.querySelector('#barra a.barra-btn[aria-label="Volver"]')?.addEventListener('click', (e) => { if (!confirmarSalida()) e.preventDefault(); });
    pintarLista();
  }

  function pintarLista() {
    const vis = prods.filter((p) => !filtro || normal(p.nombre + ' ' + (p.ref || '') + ' ' + (p.marca || '') + ' ' + (p.codigo_barras || '')).includes(normal(filtro)));
    $('#lista', v).innerHTML = vis.length ? vis.map((p) => {
      const q = carro.get(p.id) || 0;
      return `<div class="fila prod ${q ? 'sel' : ''}" data-id="${p.id}">
        ${miniatura(p, 'mini-pedido')}
        <div class="fila-txt"><p class="fila-t">${esc(p.nombre)}</p>
          <p class="fila-s">${p.marca ? `${esc(p.marca)} · ` : ''}${p.precio > 0 ? `<span class="monto">${clp(p.precio)}</span>` : `<span class="txt-alerta">${icono('alerta', 'ico-s')} Sin precio</span>`} · ${p.stock > 0 ? `Stock ${p.stock}` : '<span class="txt-alerta">Sin stock</span>'}</p>
          <p class="fila-s txt-alerta aviso-stock" ${q > Math.max(p.stock, 0) ? '' : 'hidden'}>${icono('alerta', 'ico-s')} ${esCot ? 'Cotizas' : 'Pides'} más de lo que hay en bodega</p></div>
        <div class="cantidad" role="group" aria-label="Cantidad de ${esc(p.nombre)}">
          <button class="cant-btn" data-d="-1" aria-label="Quitar uno" ${q ? '' : 'disabled'}>${icono('menos')}</button>
          <input class="cant-n" type="number" inputmode="numeric" min="0" value="${q || ''}" placeholder="0" aria-label="Cantidad">
          <button class="cant-btn" data-d="1" aria-label="Agregar uno">${icono('mas')}</button>
        </div></div>`;
    }).join('') : vacio('No hay productos con esa búsqueda');
    $$('.fila.prod', v).forEach((f) => {
      const id = Number(f.dataset.id);
      const set = (q) => {
        q = Math.max(0, Math.floor(q) || 0);
        const antes = carro.get(id) || 0, p = prods.find((x) => x.id === id);
        // Protecciones: sin precio no se vende; tope por producto y confirmación sobre 999 unidades.
        if (q > 0 && !(p.precio > 0)) { avisoSinPrecio(p); q = 0; }
        else if (q > MAX_CANT) { aviso(`Máximo ${MAX_CANT.toLocaleString('es-CL')} unidades por producto. Revisa la cantidad.`, 'error'); q = antes; }
        else if (q > 999 && antes <= 999 && !confirm(`¿Seguro? Estás pidiendo ${q.toLocaleString('es-CL')} unidades de ${p.nombre}.`)) q = antes;
        q ? carro.set(id, q) : carro.delete(id); actualizarFila(f, q); actualizarPie();
        const tope = Math.max(p.stock, 0);
        if (q > antes) { if (q > tope && antes <= tope) sentir('atencion'); else vibrar(); vuelaAlTotal(f.querySelector('.cant-n'), $('.pedido-pie', v)); }
      };
      f.querySelectorAll('.cant-btn').forEach((b) => b.addEventListener('click', () => set((carro.get(id) || 0) + Number(b.dataset.d))));
      f.querySelector('.cant-n').addEventListener('change', (e) => set(Number(e.target.value)));
    });
    actualizarPie();
  }
  // Tarjeta "Último pedido · Repetir" y chips "Suele comprar" (productos vendibles: existen y tienen precio)
  const vendible = (pid) => { const p = prods.find((x) => x.id === pid); return p && p.precio > 0 ? p : null; };
  function pintarHabitos() {
    const caja = $('#habitos', v);
    if (!caja || !hab) return;
    const ult = hab.ultimo ? hab.ultimo.items.filter((i) => vendible(i.producto_id)) : [];
    const sug = hab.habituales.filter((h) => vendible(h.producto_id));
    const fechaUlt = hab.ultimo ? diaMes(hab.ultimo.fecha) : '';
    caja.innerHTML = `
      ${ult.length ? `<div class="repetir">
        <span class="repetir-ico" aria-hidden="true">${icono('reloj')}</span>
        <div class="repetir-txt"><b>Último pedido · ${fechaUlt}</b><small>${plural(ult.length, 'producto')} · <span class="monto">${clp(hab.ultimo.total)}</span></small></div>
        <button type="button" id="repetir" class="btn sec repetir-btn">Repetir</button></div>` : ''}
      ${sug.length ? `<div class="suele"><div class="suele-cab"><h2>Suele comprar</h2><button type="button" id="suele-todo" class="btn link">Agregar todo</button></div>
        <div class="suele-chips">${sug.map((h) => { const p = vendible(h.producto_id), en = carro.has(p.id);
          return `<button type="button" class="suele-chip ${en ? 'en' : ''}" data-suele="${p.id}" data-cant="${h.cantidad}" aria-pressed="${en}">
            ${icono(en ? 'check' : 'mas', 'ico-s')} ${esc(p.nombre)} · ${h.cantidad}</button>`; }).join('')}</div></div>` : ''}`;
    $('#repetir', v)?.addEventListener('click', () => {
      if (carro.size && !confirm('¿Cambiar los productos elegidos por los del último pedido?')) return;
      carro.clear(); ult.forEach((i) => carro.set(i.producto_id, Number(i.cantidad)));
      aviso(`Se agregaron ${plural(ult.length, 'producto')} del último pedido. Revisa las cantidades.`);
      pintarHabitos(); pintarLista();
    });
    const agregar = (pid, n) => { if (!carro.has(pid)) carro.set(pid, n); };
    v.querySelectorAll('[data-suele]').forEach((b) => b.addEventListener('click', () => {
      const pid = Number(b.dataset.suele);
      carro.has(pid) ? carro.delete(pid) : agregar(pid, Number(b.dataset.cant));
      pintarHabitos(); pintarLista();
    }));
    $('#suele-todo', v)?.addEventListener('click', () => { sug.forEach((h) => agregar(h.producto_id, h.cantidad)); pintarHabitos(); pintarLista(); });
  }
  function actualizarFila(f, q) {
    const p = prods.find((x) => x.id === Number(f.dataset.id));
    f.querySelector('.aviso-stock').hidden = !(q > Math.max(p.stock, 0));
    f.classList.toggle('sel', q > 0);
    f.querySelector('.cant-n').value = q || '';
    f.querySelector('[data-d="-1"]').disabled = !q;
  }
  let totPrev = 0;
  function actualizarPie() {
    $('#unid', v).textContent = carro.size ? `${plural(carro.size, 'producto')} · ${unidades()} unid.` : 'Agrega productos';
    const t = total(); contar($('#tot', v), totPrev, t, clp, 450); totPrev = t;
    $('#sig', v).disabled = !carro.size;
  }

  function pasoRevisar(scroll = 0) {
    if (!scroll) window.dispatchEvent(new CustomEvent('coveca:paso', { detail: esCot ? 'Revisar cotización' : 'Revisar pedido' }));   // captura para los tickets (no en cada redibujo)
    barra({ titulo: orig ? `Revisar cambios · N° ${orig.numero}` : esCot ? 'Revisar cotización' : 'Revisar pedido', sub: sinCliente && esCot ? 'Cliente nuevo' : c.nombre, atras: null });
    const items = [...carro].map(([id, n]) => ({ p: prods.find((x) => x.id === id), n }));
    const leal = descLealtad();
    descuento = Math.min(descuento, total() - leal.monto);
    const pct = le ? String(le.e.nivel.descuento).replace('.', ',') : '';
    v.innerHTML = `
      <button id="volver" class="btn link izq">${icono('atras')} Seguir agregando productos</button>
      <div class="lista">${items.map(({ p, n }) => `
        <div class="fila rev-item" data-id="${p.id}"><div class="fila-txt"><p class="fila-t">${esc(p.nombre)}</p>
          <p class="fila-s">${n} × ${clp(p.precio)}</p>
          ${n > Math.max(p.stock, 0) ? `<p class="fila-s txt-alerta">${icono('alerta', 'ico-s')} Bodega tiene ${Math.max(p.stock, 0)}${esCot ? '' : `: el stock quedará en ${p.stock - n}`}</p>` : ''}</div>
          <span class="monto">${clp(n * p.precio)}</span>
          <div class="rev-acc"><div class="cantidad" role="group" aria-label="Cantidad de ${esc(p.nombre)}">
            <button type="button" class="cant-btn" data-d="-1" aria-label="Quitar uno" ${n > 1 ? '' : 'disabled'}>${icono('menos')}</button>
            <input class="cant-n" type="number" inputmode="numeric" min="1" value="${n}" aria-label="Cantidad">
            <button type="button" class="cant-btn" data-d="1" aria-label="Agregar uno">${icono('mas')}</button></div>
            <button type="button" class="btn sec rev-quitar" aria-label="Quitar ${esc(p.nombre)} ${esCot ? 'de la cotización' : 'del pedido'}">${icono('basura', 'ico-s')} Quitar</button></div></div>`).join('')}
      </div>
      ${datos.hayRed() ? '' : `<p class="nota-sin-senal pad-x">${icono('sinNube', 'ico-s')} Sin señal: ${esCot ? 'la cotización se guarda en el celular y se sube sola' : 'el pedido se guarda en el celular y se sube solo'} cuando vuelva la señal.</p>`}
      <div class="form pad">
        ${sinCliente && esCot ? `<h2 class="sec-t sin-margen">Cliente nuevo</h2>
          <label class="campo"><span>Nombre del cliente o del local</span>
            <input id="cn-nombre" type="text" maxlength="120" autocomplete="off" value="${esc(nuevoNombre)}" placeholder="Ej.: Almacén Don Pedro" required></label>
          ${campoTel('cn-tel', 'Teléfono / WhatsApp (opcional)', nuevoTel, { id: 'cn-tel', sinNombre: true })}
          <p class="ayuda">Solo se guardan en la cotización. Si se convierte en pedido, se crea el cliente y queda marcado para completar sus datos.</p>` : ''}
        ${convertirNuevo ? `<div class="cn-caja"><p class="fila-t">${icono('clientes', 'ico-s')} Cliente nuevo: ${esc(c.nombre)}</p>
          <p class="fila-s">${c.telefono ? `Teléfono ${esc(c.telefono)} · ` : ''}Al generar el pedido se crea el cliente y queda con "Faltan datos" para completar RUT, dirección y ubicación.</p></div>
          <label class="campo"><span>Ruta del cliente</span><select id="cn-ruta">
            ${rutasNuevo.map((x) => `<option value="${x.id}" ${String(x.id) === String(nuevaRuta) ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}
            <option value="" ${nuevaRuta === '' ? 'selected' : ''}>Sin ruta</option></select></label>` : ''}
        ${esCot ? `<label class="campo"><span>Válida hasta</span>
          <input id="valida" type="date" required min="${hoyChile()}" max="${sumarDias(hoyChile(), VALIDEZ_MAX)}" value="${validaHasta}"></label>
          <p class="ayuda">Los precios se respetan hasta ese día si el cliente hace el pedido. La cotización no descuenta stock ni es una nota de venta.</p>` : ''}
        <label class="campo"><span>Descuento ($)</span>
          <input id="desc" type="number" inputmode="numeric" min="0" value="${descuento || ''}" placeholder="0"></label>
        ${orig ? `<label class="campo"><span>Motivo del cambio</span>
          <input id="motivo" type="text" maxlength="120" value="${esc(motivo)}" placeholder="Ej.: el cliente agregó productos"></label>
          <p class="ayuda">La nota N° ${orig.numero} quedará anulada y se generará una nota nueva con otro número.</p>` : ''}
      </div>
      <div id="fiado-aviso"></div>
      ${!orig && !esCot && !sinCliente && !tieneGps(c) && !c._gpsGuardado ? `<div class="caja-gps">
        <p class="fila-t">${icono('mapa', 'ico-s')} Este local aún no tiene ubicación GPS</p>
        <p class="fila-s">Si estás en el local, guárdala ahora: así entra ordenado en el próximo recorrido.</p>
        <button type="button" id="gps-aqui" class="btn sec">Guardar ubicación del local</button></div>` : ''}
      ${le ? `<div class="prov-dest ${le.e.nuevo ? 'nv-nuevo' : `nv-${le.e.i}`}"><span class="medalla" aria-hidden="true">${icono('medalla')}</span>
        <div class="fila-txt"><p class="fila-t">${le.e.nuevo ? 'Cliente nuevo' : `Cliente ${esc(le.e.nivel.nombre)}`}${le.e.nivel.descuento ? ` · ${pct} % de descuento` : ''}</p>
          <p class="fila-s">${le.e.nivel.descuento ? (leal.limitado ? `Algunos productos llevan menos descuento para no bajar del margen mínimo (${Math.round(le.cfg.margen_minimo * 100)} %).` : 'Se aplica solo en esta nota.') : esc(lealtad.textoFalta(le.e))}</p></div></div>` : ''}
      <dl class="totales">
        <div><dt>Subtotal</dt><dd class="monto">${clp(total())}</dd></div>
        ${leal.monto ? `<div class="leal"><dt>Descuento cliente ${esc(le.e.nivel.nombre)} (${pct} %)</dt><dd class="monto">-${clp(leal.monto)}</dd></div>` : ''}
        <div id="fila-desc" ${descuento ? '' : 'hidden'}><dt>Descuento</dt><dd class="monto">-${clp(descuento)}</dd></div>
        <div class="total"><dt>Total</dt><dd id="total" class="monto">${clp(total() - leal.monto - descuento)}</dd></div>
      </dl>
      <p id="err" class="error pad-x" role="alert"></p>
      <div class="pie-fijo"><button id="generar" class="btn prin">${orig ? 'Generar nota corregida' : esCot ? 'Guardar cotización' : 'Generar pedido'}</button>
        ${hayTermica() && !esCot ? '<button id="sin-imprimir" type="button" class="btn link">Generar sin imprimir</button>' : ''}</div>`;
    v.scrollTop = scroll;
    $('#volver', v).addEventListener('click', pasoProductos);
    // Corregir un error de dedo sin volver a la lista: cambiar la cantidad o quitar un producto (no se agregan nuevos).
    const cambiar = (id, q) => {
      const p = prods.find((x) => x.id === id), antes = carro.get(id);
      if (q > MAX_CANT) { aviso(`Máximo ${MAX_CANT.toLocaleString('es-CL')} unidades por producto. Revisa la cantidad.`, 'error'); q = antes; }
      else if (q > 999 && antes <= 999 && !confirm(`¿Seguro? Estás pidiendo ${q.toLocaleString('es-CL')} unidades de ${p.nombre}.`)) q = antes;
      if (q > 0) carro.set(id, q);
      else if (confirm(carro.size === 1 ? `¿Quitar ${p.nombre}? Es el único producto: vuelves a la lista para elegir otros.` : `¿Quitar ${p.nombre} ${esCot ? 'de la cotización' : 'del pedido'}?`)) carro.delete(id);
      if (carro.size) pasoRevisar(v.scrollTop); else pasoProductos();
    };
    $$('.rev-item', v).forEach((f) => {
      const id = Number(f.dataset.id);
      f.querySelectorAll('.cant-btn').forEach((b) => b.addEventListener('click', () => cambiar(id, carro.get(id) + Number(b.dataset.d))));
      f.querySelector('.cant-n').addEventListener('change', (e) => cambiar(id, Math.max(0, Math.floor(Number(e.target.value)) || 0)));
      f.querySelector('.rev-quitar').addEventListener('click', () => cambiar(id, 0));
    });
    $('#gps-aqui', v)?.addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true; b.textContent = 'Obteniendo ubicación…';
      try {
        const u = await miUbicacion();
        await datos.guardarUbicacion(c.id, u.lat, u.lng);
        c._gpsGuardado = true;
        b.closest('.caja-gps').innerHTML = `<p class="fila-t txt-ok">${icono('check', 'ico-s')} Ubicación del local guardada (±${u.precision} m)</p>`;
      } catch (err) { aviso(err.message || 'No se pudo guardar la ubicación. Puedes hacerlo después desde la ficha.', 'error'); b.disabled = false; b.textContent = 'Guardar ubicación del local'; }
    });
    const totalNota = () => Math.max(total() - leal.monto - descuento, 0);
    const pintarFiado = () => { $('#fiado-aviso', v).innerHTML = forma === 'credito' ? avisoFiado(fi, c, totalNota(), deudaOriginal) : ''; };
    pintarFiado();

    $('#desc', v).addEventListener('input', (e) => {
      descuento = Math.min(total() - leal.monto, Math.max(0, Math.floor(Number(e.target.value)) || 0));
      $('#fila-desc', v).hidden = !descuento;
      $('#fila-desc dd', v).textContent = '-' + clp(descuento);
      $('#total', v).textContent = clp(total() - leal.monto - descuento);
      pintarFiado();
    });
    $('#motivo', v)?.addEventListener('input', (e) => { motivo = e.target.value; });
    $('#valida', v)?.addEventListener('change', (e) => { validaHasta = e.target.value; });
    $('#cn-nombre', v)?.addEventListener('input', (e) => { nuevoNombre = e.target.value; });
    $('#cn-ruta', v)?.addEventListener('change', (e) => { nuevaRuta = e.target.value; });
    // El teléfono se arma en el campo oculto (campos.js) al escribir: se lee al guardar y al redibujar
    v.querySelector('.tel-campo')?.addEventListener('input', () => setTimeout(() => { nuevoTel = $('#cn-tel', v)?.value || ''; }));
    $('#generar', v).addEventListener('click', () => generar());
    $('#sin-imprimir', v)?.addEventListener('click', () => generar({ imprimir: false }));
  }

  // El pedido se guarda una sola vez: si algo falla DESPUÉS de guardarlo (por ejemplo, al imprimir), no se vuelve a
  // guardar ni se reactiva el botón; se lleva a la nota, desde donde se puede reimprimir.
  let guardado = null;
  async function generar({ imprimir = true } = {}) {
    const b = $('#generar', v);
    if (guardado) return;
    if (esCot) return guardarCot(b);
    if (orig && !motivo.trim()) { $('#err', v).textContent = 'Escribe el motivo del cambio.'; $('#motivo', v).focus(); return; }
    // Sin impresora elegida en la app: se avisa ANTES de guardar (antes se guardaba y luego fallaba, y al repetir quedaba duplicado).
    if (imprimir && esApp && !impresora.impresora) { $('#err', v).textContent = 'Primero elige la impresora en Ajustes → Impresora. El pedido no se ha guardado: tus productos siguen aquí.'; return; }
    const textoBoton = b.textContent;
    b.disabled = true; b.textContent = 'Generando…';
    // Mientras se genera no se puede volver a la lista ni cambiar el pago o el descuento: lo impreso = lo guardado.
    const bloqueo = $$('#volver, #sin-imprimir, #desc, #motivo', v);
    bloqueo.forEach((x) => { x.disabled = true; });
    const yo = datos.usuario();
    const leal = descLealtad().monto;
    const descNota = descuento;
    // El precio (y el nombre) va en cada línea: el pedido subido tiene los mismos montos que la nota impresa,
    // y una nota guardada sin señal se puede reimprimir con sus nombres.
    const lineas = [...carro].map(([id, n]) => { const p = prods.find((x) => x.id === id); return { producto_id: id, cantidad: n, precio: p.precio, nombre: p.nombre }; });
    const rutaNueva = nuevaRuta === '' ? null : Number(nuevaRuta);
    const datosPedido = {
      id: idPedido, cliente_id: sinCliente ? null : Number(clienteId), ruta_id: convertirNuevo ? rutaNueva : c.ruta_id,
      ...(convertirNuevo ? { cliente_nuevo: { cotizacion_id: cot.id, nombre: c.nombre, telefono: c.telefono || null, ruta_id: rutaNueva } } : {}), forma_pago: forma, descuento: descNota,
      descuento_lealtad: leal, nivel: le ? (le.e.nuevo ? 'Nuevo' : le.e.nivel.nombre) : null,
      terminal: yo.terminal, items: lineas,
      ...(orig ? { fecha: orig.fecha } : {}),   // la nota corregida mantiene el día de la venta (carga, cierre y vencimiento del crédito)
    };
    let ped;
    try {
      ped = orig ? await datos.reemplazarPedido(orig.id, motivo.trim(), datosPedido)
        : await datos.crearPedido(datosPedido, { cliente: c.nombre, total: Math.max(total() - leal - descNota, 0) });
    } catch (err) {
      $('#err', v).textContent = err.message;
      b.disabled = false; b.textContent = textoBoton;
      bloqueo.forEach((x) => { x.disabled = false; });
      return;
    }
    guardado = ped;
    // Logros (solo notas nuevas, no correcciones): se revisan al terminar la impresión, con lo que hay en el celular
    const logros = () => { if (orig) return; if (convertirNuevo) celebrar('¡Cliente nuevo!'); revisarVenta({ id: ped.id, fecha: ped.fecha, total: ped.total }); };
    // Desde una cotización: queda enlazada a esta nota (si falla, la nota igual quedó; solo no se marca la cotización)
    if (cot && !convertirNuevo) datos.cotizacionAPedido(cot.id, ped.id, { cliente: c.nombre }).catch((e) => console.error(e));   // sin esperar: la nota se imprime ya

    const destino = orig || convertirNuevo ? `#/pedidos/${ped.id}` : c.ruta_id ? `#/rutas/${c.ruta_id}` : `#/clientes/${clienteId}`;
    const textoOk = convertirNuevo ? `${ped.numero ? `Nota N° ${ped.numero}` : 'Nota'} generada · cliente nuevo creado (faltan sus datos)${ped.porSubir ? ' · se sube al volver la señal' : ''}`
      : orig ? `Nota N° ${ped.numero} generada · reemplaza a la N° ${orig.numero}`
      : ped.porSubir ? `${ped.numero ? `Nota N° ${ped.numero}` : 'Nota'} guardada en el celular · se sube al volver la señal` : `Nota N° ${ped.numero} generada`;
    try {
      const negocio = await datos.configuracion();
      const r = await imprimirNota({
        id: ped.id, numero: ped.numero, vendedor: yo.nombre, terminal: yo.terminal, cliente: c.nombre, telefonoCliente: c.telefono, rut: c.rut, fechaIso: ped.fecha,
        fecha: new Date(ped.fecha).toLocaleString('es-CL'), pago: FORMAS_PAGO[forma] || '',   // pendiente: la nota no lleva forma de pago
        formaPago: FORMAS_PAGO[forma] ? forma : null, vence: forma === 'credito' ? ped.vence_en || null : null, reemplaza: orig?.numero ?? null,
        descuento: descNota, descuentoLealtad: ped.descuento_lealtad ?? leal,
        lealtad: le ? lealtad.paraNota(le.e, ped.descuento_lealtad ?? leal, lealtad.estado(lealtad.trasCompra(le.compras, ped.total), le.cfg)) : null,
        items: lineas.map((l) => ({ nombre: l.nombre, cant: l.cantidad, precio: l.precio })),
      }, negocio, { imprimir, ofrecerHoja: true });
      aviso(textoOk);
      logros();
      ir(r === 'hoja' ? `#/pedidos/${ped.id}` : destino);   // PC: "Imprimir nota en hoja" abre la nota con la elección de hoja
    } catch (err) {
      // El pedido YA quedó guardado: no se repite. Se abre la nota para reimprimirla.
      aviso(`${textoOk}. No se pudo imprimir: ${err.message} Reimprímela desde esta pantalla.`, 'error');
      logros();
      ir(`#/pedidos/${ped.id}`);
    }
  }

  // Guardar la cotización (no imprime, no toma número de nota, no mueve stock). Lleva a su pantalla para enviarla.
  async function guardarCot(b) {
    const hoy = hoyChile(), max = sumarDias(hoy, VALIDEZ_MAX);
    if (sinCliente) {
      nuevoNombre = ($('#cn-nombre', v)?.value || '').trim().replace(/\s+/g, ' '); nuevoTel = $('#cn-tel', v)?.value || '';
      if (nuevoNombre.length < 2) { $('#err', v).textContent = 'Escribe el nombre del cliente nuevo.'; $('#cn-nombre', v)?.focus(); return; }
    }
    if (!validaHasta || validaHasta < hoy || validaHasta > max) { $('#err', v).textContent = `Elige hasta qué día vale la cotización (desde hoy hasta ${VALIDEZ_MAX} días más).`; $('#valida', v)?.focus(); return; }
    b.disabled = true; b.textContent = 'Guardando…';
    const bloqueo = $$('#volver, #desc, #valida, #cn-nombre', v);
    bloqueo.forEach((x) => { x.disabled = true; });
    const lineas = [...carro].map(([id, n]) => { const p = prods.find((x) => x.id === id); return { producto_id: id, cantidad: n, precio: p.precio, nombre: p.nombre }; });
    const totalCot = Math.max(total() - descuento, 0);
    try {
      const q = await datos.guardarCotizacion({ id: idPedido, cliente_id: sinCliente ? null : Number(clienteId), valida_hasta: validaHasta, descuento, items: lineas,
        ...(sinCliente ? { prospecto: { nombre: nuevoNombre, telefono: nuevoTel || null } } : {}) }, { cliente: sinCliente ? nuevoNombre : c.nombre, total: totalCot });
      guardado = q;
      guardarValidez(validaHasta);
      sentir('exito');
      aviso(q.porSubir ? 'Cotización guardada en el celular · se sube al volver la señal' : 'Cotización guardada');
      ir(`#/cotizaciones/${idPedido}?nueva=1`);
    } catch (err) {
      $('#err', v).textContent = err.message;
      b.disabled = false; b.textContent = 'Guardar cotización';
      bloqueo.forEach((x) => { x.disabled = false; });
    }
  }

  pasoProductos();
}
