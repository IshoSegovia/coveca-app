import { datos } from '../datos.js';
import { pantalla, ruta, esc, ICONOS, ir, aviso, clp, miles } from '../nucleo.js';
import { cargando, vacio, buscador, montoFila } from './comunes.js';
import { imprimirNota } from '../impresora.js';

// Carrito por cliente (se mantiene si el vendedor sale y vuelve)
const carritos = new Map();
const carrito = (id) => { if (!carritos.has(id)) carritos.set(id, { items: new Map(), descuento: 0, pago: 'efectivo' }); return carritos.get(id); };
let texto = '';

ruta('/pedido/:id', async ({ id }) => {
  pantalla({ titulo: 'Pedido', atras: `/clientes/${id}`, cuerpo: cargando });
  const [cliente, productos] = await Promise.all([datos.obtenerCliente(id), datos.listarProductos()]);
  const c = carrito(id);
  const pintarLista = () => {
    const t = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const lista = productos.filter((p) => !t || `${p.nombre} ${p.ref}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(t));
    document.getElementById('catalogo').innerHTML = lista.map((p) => {
      const cant = c.items.get(p.id) || 0;
      return `<div class="fila fila-producto${cant ? ' en-pedido' : ''}" data-id="${p.id}">
        <span class="fila-texto"><strong>${esc(p.nombre)}</strong>
          <small><span class="num">${clp(p.precio)}</span> · ${p.stock > 0 ? `${miles(p.stock)} en stock` : '<span class="texto-ambar">Sin stock</span>'}</small></span>
        <span class="cantidad">
          ${cant ? `<button class="paso" data-d="-1" aria-label="Quitar uno">${ICONOS.menos}</button>
          <input class="num" type="number" inputmode="numeric" min="0" value="${cant}" aria-label="Cantidad de ${esc(p.nombre)}">` : ''}
          <button class="paso paso-mas" data-d="1" aria-label="Agregar uno">${ICONOS.mas_simple}</button>
        </span></div>`;
    }).join('') || vacio('No hay productos con esa búsqueda.');
    pintarTotal();
  };
  const pintarTotal = () => {
    let n = 0, total = 0;
    for (const [pid, cant] of c.items) { n += cant; total += cant * (productos.find((p) => p.id === pid)?.precio || 0); }
    document.getElementById('pie-accion').innerHTML = n
      ? `<a class="boton boton-principal boton-total" href="#/pedido/${id}/revisar"><span>Revisar pedido · ${n} u.</span><span class="num">${clp(total)}</span></a>`
      : '<p class="pie-ayuda">Agrega productos con el botón +</p>';
  };
  pantalla({
    titulo: 'Nuevo pedido', subtitulo: cliente.nombre, atras: `/clientes/${id}`,
    cuerpo: `<div class="barra-busqueda">${buscador('q-catalogo', 'Buscar producto', texto)}</div><div class="lista" id="catalogo"></div>`,
    pie: ' ',
  });
  const cat = document.getElementById('catalogo');
  cat.addEventListener('click', (e) => {
    const b = e.target.closest('.paso'); if (!b) return;
    const pid = Number(b.closest('.fila-producto').dataset.id);
    const nuevo = Math.max(0, (c.items.get(pid) || 0) + Number(b.dataset.d));
    nuevo ? c.items.set(pid, nuevo) : c.items.delete(pid);
    pintarLista();
  });
  cat.addEventListener('change', (e) => {
    if (e.target.tagName !== 'INPUT') return;
    const pid = Number(e.target.closest('.fila-producto').dataset.id);
    const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
    v ? c.items.set(pid, v) : c.items.delete(pid);
    pintarLista();
  });
  let t;
  document.getElementById('q-catalogo').addEventListener('input', (e) => { texto = e.target.value; clearTimeout(t); t = setTimeout(pintarLista, 150); });
  pintarLista();
});

ruta('/pedido/:id/revisar', async ({ id }) => {
  const [cliente, productos, usuario] = await Promise.all([datos.obtenerCliente(id), datos.listarProductos(), datos.usuarioActual()]);
  const c = carrito(id);
  if (!c.items.size) return ir(`/pedido/${id}`);
  const lineas = [...c.items].map(([pid, cant]) => ({ p: productos.find((x) => x.id === pid), cant }));
  const pintar = () => {
    const subtotal = lineas.reduce((s, l) => s + l.cant * l.p.precio, 0);
    const total = Math.max(0, subtotal - (c.descuento || 0));
    const credito = c.pago === 'credito' && cliente.limite_credito && total > cliente.limite_credito;
    document.getElementById('totales').innerHTML = `
      ${montoFila('Subtotal', clp(subtotal))}
      ${c.descuento ? montoFila('Descuento', '-' + clp(c.descuento)) : ''}
      ${montoFila('Total', clp(total), true)}
      ${c.pago === 'credito' && !cliente.limite_credito ? '<p class="alerta">Este cliente no tiene límite de crédito configurado.</p>' : ''}
      ${credito ? `<p class="alerta">Supera el límite de crédito del cliente (${clp(cliente.limite_credito)}).</p>` : ''}`;
    return { subtotal, total };
  };
  pantalla({
    titulo: 'Revisar pedido', subtitulo: cliente.nombre, atras: `/pedido/${id}`,
    cuerpo: `
      <div class="lista">${lineas.map((l) => `<div class="fila"><span class="fila-texto"><strong>${esc(l.p.nombre)}</strong>
        <small>${l.cant} × ${clp(l.p.precio)}</small></span><span class="num">${clp(l.cant * l.p.precio)}</span></div>`).join('')}</div>
      <a class="boton-texto bloque" href="#/pedido/${id}">Modificar productos</a>
      <h2 class="seccion">Forma de pago</h2>
      <div class="segmentado" role="radiogroup" aria-label="Forma de pago">
        ${[['efectivo', 'Efectivo'], ['transferencia', 'Transferencia'], ['credito', 'Crédito']].map(([v, t]) =>
          `<button type="button" role="radio" aria-checked="${c.pago === v}" data-pago="${v}">${t}</button>`).join('')}
      </div>
      <label class="campo"><span>Descuento ($)</span><input id="descuento" type="number" inputmode="numeric" min="0" value="${c.descuento || ''}" placeholder="0"></label>
      <div class="totales" id="totales"></div>`,
    pie: '<button class="boton boton-principal" id="generar">Generar pedido</button>',
  });
  document.querySelectorAll('[data-pago]').forEach((b) => b.addEventListener('click', () => {
    c.pago = b.dataset.pago;
    document.querySelectorAll('[data-pago]').forEach((x) => x.setAttribute('aria-checked', x === b));
    pintar();
  }));
  document.getElementById('descuento').addEventListener('input', (e) => { c.descuento = Math.max(0, Number(e.target.value) || 0); pintar(); });
  pintar();
  document.getElementById('generar').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const pd = await datos.crearPedido({
        id: crypto.randomUUID(), cliente_id: cliente.id, ruta_id: cliente.ruta_id, forma_pago: c.pago, descuento: c.descuento,
        terminal: usuario?.terminal, items: lineas.map((l) => ({ producto_id: l.p.id, cantidad: l.cant, precio: l.p.precio })),
      });
      carritos.delete(id);
      await imprimirNota({
        numero: pd.numero, vendedor: usuario?.nombre || 'COVECA', terminal: usuario?.terminal || '',
        cliente: cliente.nombre, fecha: new Date(pd.fecha).toLocaleString('es-CL'),
        pago: { efectivo: 'Efectivo', transferencia: 'Transferencia', credito: 'Crédito' }[pd.forma_pago],
        items: pd.items.map((it) => ({ nombre: it.nombre, cant: it.cantidad, precio: it.precio })),
        descuento: pd.descuento, telefonoCliente: cliente.telefono,
      });
      aviso(`Nota N° ${pd.numero} generada`);
      ir(cliente.ruta_id ? `/rutas/${cliente.ruta_id}` : `/clientes/${cliente.id}`);
    } catch (err) {
      e.target.disabled = false;
      aviso(err.message || 'No se pudo generar el pedido', 'error');
    }
  });
});
