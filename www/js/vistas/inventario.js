import { $, $$, esc, barra, icono, vacio, leerForm, aviso, ir, clp, pct, margen, precioConMargen } from '../ui.js';
import * as datos from '../datos.js';
import { prepararFoto } from '../fotos.js';

const FILTROS = [
  ['todos', 'Todos'], ['disponible', 'Disponible'], ['bajo', 'Stock bajo'], ['sin', 'Sin stock'], ['negativo', 'Negativo'],
];
let estado = { filtro: 'todos', q: '' };
const clase = (p) => (p.stock < 0 ? 'negativo' : p.stock === 0 ? 'sin' : p.stock_minimo && p.stock <= p.stock_minimo ? 'bajo' : 'disponible');

const leerVista = () => { try { return localStorage.getItem('inventario-vista') || 'iconos'; } catch (_) { return 'iconos'; } };
const guardarVista = (x) => { try { localStorage.setItem('inventario-vista', x); } catch (_) {} };
const iniciales = (n) => n.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9 ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const ETIQ = { disponible: (p) => `${p.stock} disp.`, bajo: (p) => `${p.stock} · bajo`, sin: () => 'Sin stock', negativo: (p) => `${p.stock} · revisar` };

// Miniatura: foto si existe; si no, recuadro con iniciales.
export const miniatura = (p, cls = '') => p.imagen_url
  ? `<img class="mini ${cls}" src="${esc(p.imagen_url)}" alt="" loading="lazy">`
  : `<span class="mini sin-foto ${cls}" aria-hidden="true">${esc(iniciales(p.nombre))}</span>`;

export async function vistaInventario(v) {
  barra({ titulo: 'Inventario', accion: datos.esAdmin() ? { href: '#/inventario/nuevo', icono: 'mas', etiqueta: 'Nuevo producto' } : null });
  const todos = await datos.productos({ soloActivos: false });
  let vista = leerVista();
  v.innerHTML = `
    <div class="inv-cab">
      <div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Buscar producto o REF" value="${esc(estado.q)}" aria-label="Buscar producto"></div>
      <div class="segmento" role="radiogroup" aria-label="Forma de ver">
        <button data-v="lista" role="radio" aria-label="Lista">${icono('lista')}</button>
        <button data-v="iconos" role="radio" aria-label="Íconos">${icono('cuadricula')}</button>
      </div>
    </div>
    <div class="filtros" role="tablist">${FILTROS.map(([k, t]) => `<button class="filtro" data-f="${k}" role="tab">${t} <span class="n"></span></button>`).join('')}</div>
    <div id="lista"></div>`;
  const n = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pintar = () => {
    const buscados = todos.filter((p) => !estado.q || n(p.nombre + ' ' + p.ref).includes(n(estado.q)));
    v.querySelectorAll('.filtro').forEach((b) => {
      const k = b.dataset.f;
      b.querySelector('.n').textContent = k === 'todos' ? buscados.length : buscados.filter((p) => clase(p) === k).length;
      b.setAttribute('aria-selected', estado.filtro === k);
    });
    v.querySelectorAll('.segmento button').forEach((b) => b.setAttribute('aria-checked', b.dataset.v === vista));
    const vis = buscados.filter((p) => estado.filtro === 'todos' || clase(p) === estado.filtro);
    const cont = $('#lista', v);
    if (!vis.length) { cont.className = ''; cont.innerHTML = vacio('No hay productos en este filtro'); return; }
    if (vista === 'iconos') {
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
            <p class="fila-s">${esc(p.categoria || 'Sin categoría')} · <span class="monto">${clp(p.precio)}</span></p></div>
          <span class="chip stock-${k}">${ETIQ[k](p)}</span></a>`;
      }).join('');
    }
  };
  $('#q', v).addEventListener('input', (e) => { estado.q = e.target.value.trim(); pintar(); });
  v.querySelectorAll('.filtro').forEach((b) => b.addEventListener('click', () => { estado.filtro = b.dataset.f; pintar(); }));
  v.querySelectorAll('.segmento button').forEach((b) => b.addEventListener('click', () => { vista = b.dataset.v; guardarVista(vista); pintar(); }));
  pintar();
}

export async function vistaProductoForm(v, id) {
  const p = id ? await datos.producto(id) : { activo: true, costo: null, precio: null };
  const cats = await datos.categorias();
  const admin = datos.esAdmin();
  barra({ titulo: id ? p.nombre : 'Nuevo producto', sub: id ? `REF ${p.ref || '—'}` : '', atras: '#/inventario' });
  const m0 = margen(p.costo || 0, p.precio || 0);
  v.innerHTML = `
    ${id ? `<div class="prod-cab">
      <div class="prod-foto">${miniatura(p, 'grande')}</div>
      <div class="stock-cab stock-${clase(p)}"><p class="resumen-n">${p.stock}</p><p>en stock</p>
        <span class="chip stock-${clase(p)}">${{ disponible: 'Disponible', bajo: 'Stock bajo', sin: 'Sin stock', negativo: 'Negativo · revisar' }[clase(p)]}</span></div>
    </div>
    ${admin ? `<div class="foto-acciones">
      <label class="btn sec">${icono('camara')} ${p.imagen_url ? 'Nueva foto' : 'Tomar foto'}<input class="foto-in" type="file" accept="image/*" capture="environment" hidden></label>
      <label class="btn sec">${icono('cuadricula')} Galería<input class="foto-in" type="file" accept="image/*" hidden></label>
    </div>
    ${p.imagen_url ? '<button id="quitar-foto" class="btn link quitar">Quitar foto</button>' : ''}` : ''}` : ''}
    <form id="f" class="form pad" novalidate ${admin ? '' : 'inert'}>
      <h2 class="sec-t">Producto</h2>
      <label class="campo"><span>Nombre</span><input name="nombre" required value="${esc(p.nombre || '')}" placeholder="Ej.: BigTime Menta x20"></label>
      <label class="campo"><span>Categoría</span>
        <select name="categoria_id" data-num><option value="">Sin categoría</option>
          ${cats.map((c) => `<option value="${c.id}" ${p.categoria_id === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}
        </select></label>
      <div class="dos">
        <label class="campo"><span>REF</span><input name="ref" value="${esc(p.ref || '')}"></label>
        <label class="campo"><span>Código de barras</span><input name="codigo_barras" inputmode="numeric" value="${esc(p.codigo_barras || '')}"></label>
      </div>
      <h2 class="sec-t">Precio</h2>
      <div class="dos">
        <label class="campo"><span>Costo ($)</span><input id="costo" name="costo" type="number" inputmode="numeric" min="0" value="${p.costo ?? ''}"></label>
        <label class="campo"><span>Margen (%)</span><input id="margen" type="number" inputmode="decimal" step="0.1" value="${m0 != null ? (m0 * 100).toFixed(1) : ''}"></label>
      </div>
      <label class="campo"><span>Precio de venta ($)</span><input id="precio" name="precio" type="number" inputmode="numeric" min="0" value="${p.precio ?? ''}"></label>
      <p class="ayuda">Margen sobre el precio de venta: precio = costo ÷ (1 − margen). Al cambiar el margen se calcula el precio, y al cambiar el precio se muestra el margen. <span id="ganancia"></span></p>
      <h2 class="sec-t">Stock</h2>
      ${id ? '' : `<label class="campo"><span>Stock inicial</span><input name="stock_inicial" type="number" inputmode="numeric" value="" placeholder="0"></label>`}
      <label class="campo"><span>Avisar con stock bajo en</span><input name="stock_minimo" type="number" inputmode="numeric" min="0" value="${p.stock_minimo ?? ''}" placeholder="Ej.: 3"></label>
      <label class="check"><input name="activo" type="checkbox" ${p.activo !== false ? 'checked' : ''}> Disponible para vender</label>
      <p id="err" class="error" role="alert"></p>
      ${admin ? `<div class="pie-fijo"><button class="btn prin" type="submit">${id ? 'Guardar cambios' : 'Crear producto'}</button></div>` : ''}
    </form>
    ${id && admin ? `
    <form id="ajuste" class="form pad caja">
      <h2 class="sec-t">Ajustar stock</h2>
      <p class="ayuda">Para corregir tras un conteo en bodega o registrar mercadería que llegó.</p>
      <div class="dos">
        <label class="campo"><span>Movimiento</span><select name="tipo"><option value="compra">Entrada (llegó mercadería)</option><option value="ajuste">Corrección (+/−)</option><option value="conteo">Dejar en una cantidad exacta</option></select></label>
        <label class="campo"><span>Cantidad</span><input name="cant" type="number" inputmode="numeric" required></label>
      </div>
      <button class="btn sec" type="submit">Aplicar ajuste</button>
    </form>` : ''}`;

  if (id && admin) {
    v.querySelectorAll('.foto-in').forEach((inp) => inp.addEventListener('change', async (e) => {
      const archivo = e.target.files[0];
      if (!archivo) return;
      const caja = $('.prod-foto', v);
      caja.classList.add('subiendo');
      try {
        await datos.subirFotoProducto(Number(id), await prepararFoto(archivo));
        aviso('Foto guardada');
        vistaProductoForm(v, id);
      } catch (err) { caja.classList.remove('subiendo'); aviso(err.message, 'error'); }
    }));
    $('#quitar-foto', v)?.addEventListener('click', async () => {
      if (!confirm('¿Quitar la foto de este producto?')) return;
      try { await datos.quitarFotoProducto(Number(id)); aviso('Foto quitada'); vistaProductoForm(v, id); }
      catch (err) { aviso(err.message, 'error'); }
    });
  }

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

  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = leerForm(e.target);
    if (!d.nombre) { $('#err', v).textContent = 'El nombre es obligatorio.'; return; }
    if (d.precio == null) { $('#err', v).textContent = 'Indica el precio de venta.'; return; }
    d.costo = d.costo ?? 0;
    try {
      const g = await datos.guardarProducto(id ? { ...d, id: Number(id) } : d);
      aviso(id ? 'Producto guardado' : 'Producto creado');
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
      aviso(`Stock ${delta > 0 ? '+' : ''}${delta}`);
      vistaProductoForm(v, id);
    } catch (err) { aviso(err.message, 'error'); }
  });
}
