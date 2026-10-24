import { $, esc, normal, barra, icono, vacio, leerForm, aviso, ir, clp, pct, margen, precioConMargen, selectorVista, activarSelector, botonesFotoHtml } from '../ui.js';
import { campoTel } from '../campos.js';
import * as datos from '../datos.js';
import { prepararFoto } from '../fotos.js';
import { listaCambio, esEscritorio, tabla } from '../escritorio.js';
import { htmlComprasProducto } from './compras.js';
import { leerCodigo } from '../escaner.js';

const FILTROS = [
  ['todos', 'Todos'], ['disponible', 'Disponible'], ['bajo', 'Stock bajo'], ['sin', 'Sin stock'], ['negativo', 'Negativo'],
];
let estado = { filtro: 'todos', q: '', prov: '', orden: { k: 'nombre', dir: 'asc' } };
const clase = (p) => (p.stock < 0 ? 'negativo' : p.stock === 0 ? 'sin' : p.stock_minimo && p.stock <= p.stock_minimo ? 'bajo' : 'disponible');

const iniciales = (n) => n.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9 ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const ETIQ = { disponible: (p) => `${p.stock} disp.`, bajo: (p) => `${p.stock} · bajo`, sin: () => 'Sin stock', negativo: (p) => `${p.stock} · revisar` };

// Miniatura: foto si existe; si no, recuadro con iniciales.
export const miniatura = (p, cls = '') => p.imagen_url
  ? `<img class="mini ${cls}" src="${esc(p.imagen_url)}" alt="" loading="lazy">`
  : `<span class="mini sin-foto ${cls}" aria-hidden="true">${esc(iniciales(p.nombre))}</span>`;

// Columnas de la tabla en PC (las "opc" se ocultan cuando hay una ficha abierta al lado).
const ESTADO_TXT = { disponible: 'Disponible', bajo: 'Stock bajo', sin: 'Sin stock', negativo: 'Negativo' };
const MARGEN_MIN = 0.10;   // margen mínimo protegido (lealtad): bajo esto se marca la celda
const COLS = [
  { k: 'nombre', t: 'Producto', val: (p) => p.nombre,
    html: (p) => `${miniatura(p, 'chica')}<span class="celda-txt">${esc(p.nombre)}${p.activo ? '' : ' <span class="txt-suave">(inactivo)</span>'}</span>` },
  { k: 'marca', t: 'Marca', opc: true, prio2: true, val: (p) => p.marca || '', html: (p) => esc(p.marca || '—') },
  { k: 'ref', t: 'REF', opc: true, prio2: true, val: (p) => p.ref || '', html: (p) => esc(p.ref || '—') },
  { k: 'categoria', t: 'Categoría', opc: true, prio2: true, val: (p) => p.categoria || '', html: (p) => esc(p.categoria || '—') },
  { k: 'proveedor', t: 'Proveedor', opc: true, val: (p) => p.proveedor || '', html: (p) => esc(p.proveedor || '—') },
  { k: 'costo', t: 'Costo', num: true, opc: true, val: (p) => p.costo ?? 0, html: (p) => `<span class="monto">${clp(p.costo)}</span>` },
  { k: 'precio', t: 'Precio', num: true, val: (p) => p.precio ?? 0, html: (p) => `<span class="monto">${clp(p.precio)}</span>` },
  { k: 'margen', t: 'Margen', num: true, opc: true, val: (p) => margen(p.costo || 0, p.precio || 0) ?? -1,
    html: (p) => { const m = margen(p.costo || 0, p.precio || 0); return m != null && m < MARGEN_MIN ? `<span class="txt-alerta">${icono('alerta', 'ico-s')} ${pct(m)}</span>` : pct(m); } },
  { k: 'stock', t: 'Stock', num: true, val: (p) => p.stock,
    html: (p) => { const k = clase(p); return `<span class="chip stock-${k}">${p.stock} · ${ESTADO_TXT[k]}</span>`; } },
];

export async function vistaInventario(v) {
  barra({ titulo: 'Inventario', accion: datos.esAdmin() ? { href: '#/inventario/nuevo', icono: 'mas', etiqueta: 'Nuevo producto' } : null });
  const [todos, provs] = await Promise.all([datos.productos({ soloActivos: false }), datos.proveedores()]);
  v.innerHTML = `
    <div class="inv-cab">
      <div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Buscar producto, marca o REF" value="${esc(estado.q)}" aria-label="Buscar producto"><button type="button" class="buscador-esc" id="escanear" aria-label="Escanear código de barras">${icono('escanear')}</button></div>
      ${selectorVista()}
    </div>
    <div class="filtros" role="tablist">${FILTROS.map(([k, t]) => `<button class="filtro" data-f="${k}" role="tab">${t} <span class="n"></span></button>`).join('')}</div>
    <label class="campo pad filtro-prov"><span class="sr">Proveedor</span>
      <select id="prov" aria-label="Filtrar por proveedor">
        <option value="">Todos los proveedores</option>
        <option value="sin">Sin proveedor asignado</option>
        ${provs.map((x) => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}
      </select></label>
    ${datos.esAdmin() ? `<div class="pad inv-compras"><a class="btn sec" href="#/compras">${icono('inventario')} Compras a proveedores</a></div>` : ''}
    <div id="lista"></div>`;
  const pintar = () => {
    const buscados = todos.filter((p) => (!estado.q || normal(p.nombre + ' ' + p.ref + ' ' + (p.marca || '') + ' ' + (p.codigo_barras || '')).includes(normal(estado.q)))
      && (!estado.prov || (estado.prov === 'sin' ? !p.proveedor_id : String(p.proveedor_id) === estado.prov)));
    v.querySelectorAll('.filtro').forEach((b) => {
      const k = b.dataset.f;
      b.querySelector('.n').textContent = k === 'todos' ? buscados.length : buscados.filter((p) => clase(p) === k).length;
      b.setAttribute('aria-selected', estado.filtro === k);
    });
    const vis = buscados.filter((p) => estado.filtro === 'todos' || clase(p) === estado.filtro);
    const cont = $('#lista', v);
    if (!vis.length) { cont.className = ''; cont.innerHTML = vacio('No hay productos en este filtro'); return; }
    if (esEscritorio()) return tabla(cont, { cols: COLS, filas: vis, href: (p) => `#/inventario/${p.id}`, estado: estado.orden, etiqueta: 'Productos' });
    if (vista() === 'iconos') {
      cont.className = 'grilla';
      cont.innerHTML = vis.map((p) => {
        const k = clase(p);
        return `<a class="tarjeta ${p.activo ? '' : 'inactivo'}" href="#/inventario/${p.id}">
          <div class="tarjeta-foto">${miniatura(p)}<span class="chip stock-${k} flotante">${ETIQ[k](p)}</span></div>
          <p class="tarjeta-t">${esc(p.nombre)}</p>
          <p class="tarjeta-p monto">${clp(p.precio)}</p></a>`;
      }).join('');
    } else {
      cont.className = 'lista';
      cont.innerHTML = vis.map((p) => {
        const k = clase(p);
        return `<a class="fila" href="#/inventario/${p.id}">${miniatura(p, 'chica')}
          <div class="fila-txt"><p class="fila-t">${esc(p.nombre)}${p.activo ? '' : ' <span class="txt-suave">(inactivo)</span>'}</p>
            <p class="fila-s">${esc([p.marca, p.categoria || 'Sin categoría'].filter(Boolean).join(' · '))} · <span class="monto">${clp(p.precio)}</span></p></div>
          <span class="chip stock-${k}">${ETIQ[k](p)}</span></a>`;
      }).join('');
    }
  };
  $('#q', v).addEventListener('input', (e) => { estado.q = e.target.value.trim(); pintar(); });
  $('#escanear', v).addEventListener('click', async () => {   // escanear: abre el producto (o lo busca si no hay uno exacto)
    const cod = await leerCodigo({ titulo: 'Buscar producto' });
    if (!cod) return;
    const p = todos.find((x) => x.codigo_barras === cod) || todos.find((x) => x.ref === cod);
    if (p) return ir(`#/inventario/${p.id}`);
    aviso(`Ningún producto tiene el código ${cod}.${datos.esAdmin() ? ' Puedes crearlo con el botón +.' : ''}`, 'error');
  });
  $('#prov', v).value = estado.prov;
  $('#prov', v).addEventListener('change', (e) => { estado.prov = e.target.value; pintar(); });
  v.querySelectorAll('.filtro').forEach((b) => b.addEventListener('click', () => { estado.filtro = b.dataset.f; pintar(); }));
  const vista = activarSelector(v, 'inventario', pintar);
  pintar();
}

export async function vistaProductoForm(v, id) {
  // Producto nuevo creado desde Registrar compra (#/inventario/nuevo?desde=compra&proveedor=ID): queda con el
  // proveedor de la compra, sin stock inicial (el stock sube al guardar la compra) y al crearlo se vuelve a ella.
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const desdeCompra = !id && q.get('desde') === 'compra';
  const p = id ? await datos.producto(id) : { activo: true, costo: null, precio: null, proveedor_id: desdeCompra ? Number(q.get('proveedor')) || null : null };
  const cats = await datos.categorias();
  let provs = await datos.proveedores();
  const marcas = await datos.marcas().catch(() => []);
  const admin = datos.esAdmin();
  barra({ titulo: id ? p.nombre : 'Nuevo producto', sub: id ? `REF ${p.ref || '—'}` : '', atras: desdeCompra ? '#/compras/nueva' : '#/inventario' });
  const m0 = margen(p.costo || 0, p.precio || 0);
  v.innerHTML = `
    ${id ? `<div class="prod-cab">
      <div class="prod-foto">${miniatura(p, 'grande')}</div>
      <div class="stock-cab stock-${clase(p)}"><p class="resumen-n">${p.stock}</p><p>en stock</p>
        <span class="chip stock-${clase(p)}">${clase(p) === 'negativo' ? 'Negativo · revisar' : ESTADO_TXT[clase(p)]}</span></div>
    </div>
    ${admin ? (p.imagen_url ? '<button id="quitar-foto" class="btn link quitar">Quitar foto</button>' : botonesFotoHtml()) : ''}` : ''}
    <form id="f" class="form pad" novalidate ${admin ? '' : 'inert'}>
      <h2 class="sec-t">Producto</h2>
      <label class="campo"><span>Nombre</span><input name="nombre" required value="${esc(p.nombre || '')}" placeholder="Ej.: BigTime Menta x20"></label>
      <label class="campo"><span>Marca</span>
        <select id="marca-sel"><option value="">Sin marca</option>
          ${[...new Set([...marcas, ...(p.marca ? [p.marca] : [])])].sort((x, y) => x.localeCompare(y, 'es')).map((m) => `<option value="${esc(m)}" ${p.marca === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}
          ${admin ? '<option value="__nueva">+ Agregar marca nueva…</option>' : ''}
        </select></label>
      <input type="hidden" id="marca" name="marca" value="${esc(p.marca || '')}">
      <label class="campo" id="marca-nueva-caja" hidden><span>Nombre de la marca nueva</span><input id="marca-nueva" autocomplete="off" placeholder="Ej.: Costa"></label>
      <label class="campo"><span>Categoría</span>
        <select name="categoria_id" data-num><option value="">Sin categoría</option>
          ${cats.map((c) => `<option value="${c.id}" ${p.categoria_id === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}
        </select></label>
      <label class="campo"><span>Proveedor</span>
        <select id="proveedor" name="proveedor_id" data-num><option value="">Sin proveedor</option>
          ${provs.filter((x) => x.activo !== false || x.id === p.proveedor_id).map((x) => `<option value="${x.id}" ${p.proveedor_id === x.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}
          ${admin ? '<option value="nuevo">+ Agregar proveedor nuevo…</option>' : ''}
        </select></label>
      <div id="prov-nuevo" class="caja-inline" hidden>
        <label class="campo"><span>Nombre del proveedor</span><input id="pn-nombre" placeholder="Ej.: Distribuidora del Sur"></label>
        ${campoTel('pn_tel', 'WhatsApp (opcional)', '', { id: 'pn-tel', sinNombre: true })}
        <div class="dos"><button type="button" id="pn-cancelar" class="btn sec">Cancelar</button><button type="button" id="pn-crear" class="btn sec">Crear y elegir</button></div>
        <p class="ayuda">Los demás datos (correo, RUT, notas) se completan en la sección Proveedores.</p>
      </div>
      <label class="campo"><span>Proveedor de respaldo <span class="txt-suave">(opcional)</span></span>
        <select id="proveedor-respaldo" name="proveedor_respaldo_id" data-num ${p.proveedor_id ? '' : 'disabled'}></select></label>
      <p class="ayuda" id="ayuda-respaldo">Por si el principal no tiene el producto. Sale en los pedidos libres a ese proveedor; no cambia el stock ni las sugerencias.</p>
      <div class="dos">
        <label class="campo"><span>REF</span><input name="ref" value="${esc(p.ref || '')}"></label>
        <label class="campo"><span>Código de barras</span><span class="campo-esc"><input name="codigo_barras" inputmode="numeric" value="${esc(p.codigo_barras || '')}"><button type="button" class="buscador-esc" id="esc-codigo" aria-label="Escanear el código de barras">${icono('escanear')}</button></span></label>
      </div>
      <h2 class="sec-t">Precio</h2>
      <div class="dos">
        <label class="campo"><span>Costo ($)</span><input id="costo" name="costo" type="number" inputmode="numeric" min="0" value="${p.costo ?? ''}"></label>
        <label class="campo"><span>Margen (%)</span><input id="margen" type="number" inputmode="decimal" step="0.1" value="${m0 != null ? (m0 * 100).toFixed(1) : ''}"></label>
      </div>
      <label class="campo"><span>Precio de venta ($)</span><input id="precio" name="precio" type="number" inputmode="numeric" min="0" value="${p.precio ?? ''}"></label>
      <p class="ayuda">Margen sobre el precio de venta: precio = costo ÷ (1 − margen). Al cambiar el margen se calcula el precio, y al cambiar el precio se muestra el margen. <span id="ganancia"></span></p>
      <h2 class="sec-t">Stock</h2>
      ${id ? '' : desdeCompra ? '<p class="ayuda">El stock de este producto sube con las unidades que registres en la compra.</p>'
        : `<label class="campo"><span>Stock inicial</span><input name="stock_inicial" type="number" inputmode="numeric" value="" placeholder="0"></label>`}
      <label class="campo"><span>Avisar con stock bajo en</span><input name="stock_minimo" type="number" inputmode="numeric" min="0" value="${p.stock_minimo ?? ''}" placeholder="Ej.: 3"></label>
      <label class="check"><input name="activo" type="checkbox" ${p.activo !== false ? 'checked' : ''}> Disponible para vender</label>
      <p id="err" class="error" role="alert"></p>
      ${admin ? `<div class="pie-fijo ${!id && !desdeCompra && esEscritorio() ? 'pie-doble' : ''}">${!id && !desdeCompra && esEscritorio() ? '<button class="btn sec" type="submit" name="otro">Crear y agregar otro</button>' : ''}<button class="btn prin" type="submit">${id ? 'Guardar cambios' : desdeCompra ? 'Crear y volver a la compra' : 'Crear producto'}</button></div>` : ''}
    </form>
    ${id && admin ? `
    <form id="ajuste" class="form pad caja">
      <h2 class="sec-t">Ajustar stock</h2>
      <p class="ayuda">Para corregir tras un conteo en bodega. La mercadería que llega con factura o guía regístrala en <a href="#/compras/nueva${p.proveedor_id ? `?proveedor=${p.proveedor_id}` : ''}">Compras</a>: además deja el costo al día.</p>
      <div class="dos">
        <label class="campo"><span>Movimiento</span><select name="tipo"><option value="compra">Entrada (llegó mercadería)</option><option value="ajuste">Corrección (+/−)</option><option value="conteo">Dejar en una cantidad exacta</option></select></label>
        <label class="campo"><span>Cantidad</span><input name="cant" type="number" inputmode="numeric" required></label>
      </div>
      <button class="btn sec" type="submit">Aplicar ajuste</button>
    </form>
    <div id="ult-compras"></div>` : ''}`;
  if (id && admin) datos.comprasDeProducto(Number(id)).then((l) => { const c = $('#ult-compras', v); if (c) c.innerHTML = htmlComprasProducto(l); }).catch(() => {});

  if (id && admin) {
    v.querySelectorAll('.foto-in').forEach((inp) => inp.addEventListener('change', async (e) => {
      const archivo = e.target.files[0];
      if (!archivo) return;
      const caja = $('.prod-foto', v);
      caja.classList.add('subiendo');
      try {
        await datos.subirFotoProducto(Number(id), await prepararFoto(archivo));
        aviso('Foto guardada'); listaCambio();
        vistaProductoForm(v, id);
      } catch (err) { caja.classList.remove('subiendo'); aviso(err.message, 'error'); }
    }));
    $('#quitar-foto', v)?.addEventListener('click', async () => {
      if (!confirm('¿Quitar la foto de este producto?')) return;
      try { await datos.quitarFotoProducto(Number(id)); aviso('Foto quitada'); listaCambio(); vistaProductoForm(v, id); }
      catch (err) { aviso(err.message, 'error'); }
    });
  }

  // Proveedor: crear uno nuevo sin salir de la ficha.
  const selProv = $('#proveedor', v), cajaProv = $('#prov-nuevo', v), selResp = $('#proveedor-respaldo', v);
  let provAnterior = selProv.value;
  // Respaldo: solo con proveedor principal elegido y nunca el mismo que el principal.
  let respElegido = p.proveedor_respaldo_id ?? null;
  const pintarRespaldo = () => {
    const principal = Number(selProv.value) || null;
    if (principal && respElegido === principal) respElegido = null;
    selResp.disabled = !principal || !admin;
    const lista = provs.filter((x) => x.id !== principal && (x.activo !== false || x.id === respElegido));
    selResp.innerHTML = `<option value="">${principal ? 'Sin respaldo' : 'Primero elige el proveedor principal'}</option>`
      + lista.map((x) => `<option value="${x.id}" ${respElegido === x.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('');
  };
  selResp.addEventListener('change', () => { respElegido = Number(selResp.value) || null; });
  pintarRespaldo();
  selProv.addEventListener('change', () => {
    if (selProv.value === 'nuevo') { cajaProv.hidden = false; $('#pn-nombre', v).focus(); }
    else { provAnterior = selProv.value; cajaProv.hidden = true; pintarRespaldo(); }
  });
  $('#pn-cancelar', v)?.addEventListener('click', () => { selProv.value = provAnterior; cajaProv.hidden = true; });
  $('#pn-crear', v)?.addEventListener('click', async () => {
    const nombre = $('#pn-nombre', v).value.trim();
    if (!nombre) return aviso('Escribe el nombre del proveedor.', 'error');
    try {
      const g = await datos.guardarProveedor({ nombre, telefono: $('#pn-tel', v).value.trim() || null, activo: true });
      const o = document.createElement('option'); o.value = g.id; o.textContent = g.nombre;
      selProv.insertBefore(o, selProv.querySelector('option[value="nuevo"]'));
      provs = [...provs, g];
      selProv.value = String(g.id); provAnterior = selProv.value; cajaProv.hidden = true; pintarRespaldo();
      aviso('Proveedor creado. Guarda el producto para confirmar.');
    } catch (err) { aviso(err.message, 'error'); }
  });

  // Marca: lista desplegable con las ya usadas; "+ Agregar marca nueva…" muestra un campo para escribirla.
  const selMarca = $('#marca-sel', v), inMarca = $('#marca', v), cajaMarca = $('#marca-nueva-caja', v), nuevaMarca = $('#marca-nueva', v);
  selMarca.addEventListener('change', () => {
    const nueva = selMarca.value === '__nueva';
    cajaMarca.hidden = !nueva;
    inMarca.value = nueva ? nuevaMarca.value.trim() : selMarca.value;
    if (nueva) nuevaMarca.focus();
  });
  nuevaMarca.addEventListener('input', () => {
    // Si ya existe (aunque cambien mayúsculas o tildes), se usa la escrita igual que antes
    const t = nuevaMarca.value.trim(), igual = marcas.find((m) => normal(m) === normal(t));
    inMarca.value = igual || t;
  });

  const costo = $('#costo', v), mg = $('#margen', v), precio = $('#precio', v);
  const gan = () => {
    const c = Number(costo.value), pr = Number(precio.value);
    $('#ganancia', v).textContent = pr ? `Ganancia por unidad: ${clp(pr - c)}.` : '';
  };
  mg.addEventListener('input', () => {
    const m = Number(mg.value) / 100;
    if (costo.value !== '' && m < 1) precio.value = precioConMargen(Number(costo.value), m);
    gan();
  });
  const recalcMargen = () => { const m = margen(Number(costo.value), Number(precio.value)); mg.value = m != null ? (m * 100).toFixed(1) : ''; gan(); };
  precio.addEventListener('input', recalcMargen);
  costo.addEventListener('input', recalcMargen);
  gan();

  $('#esc-codigo', v)?.addEventListener('click', async () => {
    const cod = await leerCodigo({ titulo: 'Código del producto' });
    if (cod) { const inp = v.querySelector('[name="codigo_barras"]'); inp.value = cod; inp.dispatchEvent(new Event('input', { bubbles: true })); aviso(`Código ${cod} listo: guarda para confirmar.`); }
  });
  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = leerForm(e.target);
    if (!d.nombre) { $('#err', v).textContent = 'El nombre es obligatorio.'; return; }
    if (selMarca.value === '__nueva' && !d.marca) { $('#err', v).textContent = 'Escribe el nombre de la marca nueva, o elige una de la lista.'; nuevaMarca.focus(); return; }
    if (d.precio == null) { $('#err', v).textContent = 'Indica el precio de venta.'; return; }
    if (Number.isNaN(d.proveedor_id)) d.proveedor_id = null;
    if (!d.proveedor_id || Number.isNaN(d.proveedor_respaldo_id) || !selResp.value) d.proveedor_respaldo_id = null;
    if (d.proveedor_respaldo_id && d.proveedor_respaldo_id === d.proveedor_id) { $('#err', v).textContent = 'El proveedor de respaldo no puede ser el mismo que el principal.'; return; }
    d.costo = d.costo ?? 0;
    // Avisos antes de guardar: precio $0 o bajo el costo
    if (d.precio === 0 && !confirm('El precio de venta es $0: este producto no se podrá vender hasta que tenga precio. ¿Guardar igual?')) return;
    if (d.precio > 0 && d.costo > d.precio && !confirm(`El precio (${clp(d.precio)}) es menor que el costo (${clp(d.costo)}): se pierden ${clp(d.costo - d.precio)} por unidad. ¿Guardar igual?`)) return;
    try {
      const g = await datos.guardarProducto(id ? { ...d, id: Number(id) } : d);
      aviso(id ? 'Producto guardado' : 'Producto creado'); listaCambio();
      if (e.submitter?.name === 'otro') { await vistaProductoForm(v, null); $('[name="nombre"]', v)?.focus(); return; }  // PC: carga uno tras otro
      if (desdeCompra) return ir(`#/compras/nueva?agregar=${g.id}`); // vuelve a la compra con el producto ya agregado
      ir(id ? '#/inventario' : `#/inventario/${g.id}`); // al crear, queda en su ficha para agregar la foto
    } catch (err) { $('#err', v).textContent = err.message; }
  });

  if (id && admin) $('#ajuste', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const tipo = e.target.tipo.value, cant = Math.floor(Number(e.target.cant.value));
    if (!Number.isFinite(cant) || (tipo !== 'conteo' && !cant)) return;
    const delta = tipo === 'conteo' ? cant - p.stock : tipo === 'compra' ? Math.abs(cant) : cant;
    if (!delta) return aviso('El stock ya está en esa cantidad');
    try {
      await datos.ajustarStock(Number(id), delta, tipo === 'compra' ? 'compra' : 'ajuste');
      aviso(`Stock ${delta > 0 ? '+' : ''}${delta}`); listaCambio();
      vistaProductoForm(v, id);
    } catch (err) { aviso(err.message, 'error'); }
  });
}
