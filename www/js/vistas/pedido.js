import { $, $$, esc, barra, icono, vacio, aviso, ir, clp } from '../ui.js';
import * as datos from '../datos.js';
import { imprimirNota } from '../impresora.js';
import * as lealtad from '../lealtad.js';

// Pedido en dos pasos: 1) elegir productos y cantidades; 2) revisar, forma de pago y generar.
export async function vistaPedido(v, clienteId) {
  const c = await datos.cliente(clienteId);
  const prods = await datos.productos();
  // Programa de lealtad: nivel actual del cliente (si no se puede leer, el pedido sigue sin descuento de nivel)
  const le = await Promise.all([datos.programaLealtad(), datos.comprasLealtad(clienteId)])
    .then(([cfg, compras]) => (cfg.activo ? { cfg, compras, e: lealtad.estado(compras, cfg) } : null)).catch(() => null);
  const carro = new Map(); // producto_id -> cantidad
  let filtro = '', paso = 1, forma = 'efectivo', descuento = 0;

  const total = () => [...carro].reduce((s, [id, n]) => s + n * prods.find((p) => p.id === id).precio, 0);
  // Descuento de lealtad de la nota actual (con tope para no bajar del margen mínimo)
  const descLealtad = () => (le ? lealtad.descuentoNota([...carro].map(([id, n]) => { const p = prods.find((x) => x.id === id); return { precio: p.precio, costo: p.costo, cant: n }; }),
    le.e.nivel.descuento, le.cfg.margen_minimo) : { monto: 0, limitado: false });
  const unidades = () => [...carro.values()].reduce((s, n) => s + n, 0);

  function pasoProductos() {
    paso = 1; v.scrollTop = 0;
    barra({ titulo: 'Nuevo pedido', sub: c.nombre, atras: `#/clientes/${clienteId}` });
    v.innerHTML = `
      <div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Buscar producto o REF" value="${esc(filtro)}" aria-label="Buscar producto"></div>
      <div id="lista" class="lista prod"></div>
      <div class="pie-fijo pedido-pie">
        <div class="pedido-total"><p id="unid"></p><p id="tot" class="monto grande"></p></div>
        <button id="sig" class="btn prin">Revisar pedido</button>
      </div>`;
    $('#q', v).addEventListener('input', (e) => { filtro = e.target.value.trim(); pintarLista(); });
    $('#sig', v).addEventListener('click', () => { if (carro.size) pasoRevisar(); });
    pintarLista();
  }

  function pintarLista() {
    const n = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const vis = prods.filter((p) => !filtro || n(p.nombre + ' ' + (p.ref || '')).includes(n(filtro)));
    $('#lista', v).innerHTML = vis.length ? vis.map((p) => {
      const q = carro.get(p.id) || 0;
      return `<div class="fila prod ${q ? 'sel' : ''}" data-id="${p.id}">
        <div class="fila-txt"><p class="fila-t">${esc(p.nombre)}</p>
          <p class="fila-s"><span class="monto">${clp(p.precio)}</span> · ${p.stock > 0 ? `Stock ${p.stock}` : '<span class="txt-alerta">Sin stock</span>'}</p></div>
        <div class="cantidad" role="group" aria-label="Cantidad de ${esc(p.nombre)}">
          <button class="cant-btn" data-d="-1" aria-label="Quitar uno" ${q ? '' : 'disabled'}>${icono('menos')}</button>
          <input class="cant-n" type="number" inputmode="numeric" min="0" value="${q || ''}" placeholder="0" aria-label="Cantidad">
          <button class="cant-btn" data-d="1" aria-label="Agregar uno">${icono('mas')}</button>
        </div></div>`;
    }).join('') : vacio('No hay productos con esa búsqueda');
    $$('.fila.prod', v).forEach((f) => {
      const id = Number(f.dataset.id);
      const set = (q) => { q = Math.max(0, Math.floor(q) || 0); q ? carro.set(id, q) : carro.delete(id); actualizarFila(f, q); actualizarPie(); };
      f.querySelectorAll('.cant-btn').forEach((b) => b.addEventListener('click', () => set((carro.get(id) || 0) + Number(b.dataset.d))));
      f.querySelector('.cant-n').addEventListener('change', (e) => set(Number(e.target.value)));
    });
    actualizarPie();
  }
  function actualizarFila(f, q) {
    f.classList.toggle('sel', q > 0);
    f.querySelector('.cant-n').value = q || '';
    f.querySelector('[data-d="-1"]').disabled = !q;
  }
  function actualizarPie() {
    $('#unid', v).textContent = carro.size ? `${carro.size} producto${carro.size === 1 ? '' : 's'} · ${unidades()} unid.` : 'Agrega productos';
    $('#tot', v).textContent = clp(total());
    $('#sig', v).disabled = !carro.size;
  }

  function pasoRevisar() {
    paso = 2; v.scrollTop = 0;
    barra({ titulo: 'Revisar pedido', sub: c.nombre, atras: null });
    const items = [...carro].map(([id, n]) => ({ p: prods.find((x) => x.id === id), n }));
    const leal = descLealtad();
    descuento = Math.min(descuento, total() - leal.monto);
    const pct = le ? String(le.e.nivel.descuento).replace('.', ',') : '';
    v.innerHTML = `
      <button id="volver" class="btn link izq">${icono('atras')} Seguir agregando productos</button>
      <div class="lista">${items.map(({ p, n }) => `
        <div class="fila"><div class="fila-txt"><p class="fila-t">${esc(p.nombre)}</p>
          <p class="fila-s">${n} × ${clp(p.precio)}</p></div><span class="monto">${clp(n * p.precio)}</span></div>`).join('')}
      </div>
      <div class="form pad">
        <fieldset class="opciones"><legend>Forma de pago</legend>
          ${[['efectivo', 'Efectivo'], ['transferencia', 'Transferencia'], ['credito', 'Crédito (fiado)']].map(([k, t]) =>
            `<label class="opcion"><input type="radio" name="pago" value="${k}" ${forma === k ? 'checked' : ''}> ${t}</label>`).join('')}
        </fieldset>
        <label class="campo"><span>Descuento ($)</span>
          <input id="desc" type="number" inputmode="numeric" min="0" value="${descuento || ''}" placeholder="0"></label>
      </div>
      ${le ? `<div class="prov-dest nv-${le.e.i}"><span class="medalla" aria-hidden="true">${icono('medalla')}</span>
        <div class="fila-txt"><p class="fila-t">Cliente ${esc(le.e.nivel.nombre)}${le.e.nivel.descuento ? ` · ${pct} % de descuento` : ''}</p>
          <p class="fila-s">${le.e.nivel.descuento ? (leal.limitado ? `Algunos productos llevan menos descuento para no bajar del margen mínimo (${Math.round(le.cfg.margen_minimo * 100)} %).` : 'Se aplica solo en esta nota.') : esc(lealtad.textoFalta(le.e))}</p></div></div>` : ''}
      <dl class="totales">
        <div><dt>Subtotal</dt><dd class="monto">${clp(total())}</dd></div>
        ${leal.monto ? `<div class="leal"><dt>Descuento cliente ${esc(le.e.nivel.nombre)} (${pct} %)</dt><dd class="monto">-${clp(leal.monto)}</dd></div>` : ''}
        <div id="fila-desc" ${descuento ? '' : 'hidden'}><dt>Descuento</dt><dd class="monto">-${clp(descuento)}</dd></div>
        <div class="total"><dt>Total</dt><dd id="total" class="monto">${clp(total() - leal.monto - descuento)}</dd></div>
      </dl>
      <p id="err" class="error pad-x" role="alert"></p>
      <div class="pie-fijo"><button id="generar" class="btn prin">Generar pedido</button></div>`;
    $('#volver', v).addEventListener('click', pasoProductos);
    $$('input[name="pago"]', v).forEach((r) => r.addEventListener('change', (e) => { forma = e.target.value; }));
    $('#desc', v).addEventListener('input', (e) => {
      descuento = Math.min(total() - leal.monto, Math.max(0, Math.floor(Number(e.target.value)) || 0));
      $('#fila-desc', v).hidden = !descuento;
      $('#fila-desc dd', v).textContent = '-' + clp(descuento);
      $('#total', v).textContent = clp(total() - leal.monto - descuento);
    });
    $('#generar', v).addEventListener('click', generar);
  }

  async function generar() {
    const b = $('#generar', v);
    b.disabled = true; b.textContent = 'Generando…';
    try {
      const yo = datos.usuario();
      const leal = descLealtad().monto;
      const ped = await datos.crearPedido({
        id: crypto.randomUUID(), cliente_id: Number(clienteId), ruta_id: c.ruta_id, forma_pago: forma, descuento,
        descuento_lealtad: leal, nivel: le ? le.e.nivel.nombre : null,
        terminal: yo.terminal, items: [...carro].map(([id, n]) => ({ producto_id: id, cantidad: n })),
      });
      const negocio = await datos.configuracion();
      await imprimirNota({
        numero: ped.numero, vendedor: yo.nombre, terminal: yo.terminal, cliente: c.nombre, telefonoCliente: c.telefono,
        fecha: new Date(ped.fecha).toLocaleString('es-CL'), pago: { efectivo: 'Efectivo', transferencia: 'Transferencia', credito: 'Crédito' }[forma],
        descuento, descuentoLealtad: ped.descuento_lealtad ?? leal,
        lealtad: le ? lealtad.paraNota(le.e, ped.descuento_lealtad ?? leal, lealtad.estado(lealtad.trasCompra(le.compras, ped.total), le.cfg)) : null,
        items: [...carro].map(([id, n]) => { const p = prods.find((x) => x.id === id); return { nombre: p.nombre, cant: n, precio: p.precio }; }),
      }, negocio);
      aviso(`Nota N° ${ped.numero} generada`);
      ir(c.ruta_id ? `#/rutas/${c.ruta_id}` : `#/clientes/${clienteId}`);
    } catch (err) {
      $('#err', v).textContent = err.message;
      b.disabled = false; b.textContent = 'Generar pedido';
    }
  }

  pasoProductos();
}
