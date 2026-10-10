// Proveedores: lista, ficha y edición. Cada producto puede tener su proveedor (ver inventario).
import { $, esc, barra, icono, vacio, leerForm, aviso, ir, clp } from '../ui.js';
import * as datos from '../datos.js';

export async function vistaProveedores(v) {
  barra({ titulo: 'Proveedores', atras: '#/ajustes',
    accion: datos.esAdmin() ? { href: '#/proveedores/nuevo', icono: 'mas', etiqueta: 'Nuevo proveedor' } : null });
  const ps = await datos.proveedores();
  v.innerHTML = ps.length ? `
    <p class="cuenta mt">${ps.length} proveedor${ps.length === 1 ? '' : 'es'}</p>
    <div class="lista">${ps.map((p) => `
      <a class="fila" href="#/proveedores/${p.id}">
        <span class="ruta-ico" aria-hidden="true">${icono('inventario')}</span>
        <div class="fila-txt"><p class="fila-t">${esc(p.nombre)}${p.activo === false ? ' <span class="txt-suave">(inactivo)</span>' : ''}</p>
          <p class="fila-s">${esc([p.contacto, p.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto')}</p></div>
        <span class="chip">${p.productos} prod.</span>${icono('derecha', 'ico-chev')}</a>`).join('')}
    </div>`
    : vacio('Aún no hay proveedores', 'Crea los proveedores y luego asígnalos a cada producto desde Inventario.',
      datos.esAdmin() ? '<a class="btn prin" href="#/proveedores/nuevo">Agregar proveedor</a>' : '');
}

export async function vistaProveedorForm(v, id) {
  const p = id ? await datos.proveedor(id) : { activo: true };
  const prods = id ? await datos.productosDeProveedor(id) : [];
  const admin = datos.esAdmin();
  barra({ titulo: id ? p.nombre : 'Nuevo proveedor', atras: '#/proveedores' });
  const campo = (name, et, o = {}) => `<label class="campo"><span>${et}</span>
    <input name="${name}" value="${esc(p[name] ?? '')}" ${o.tipo ? `type="${o.tipo}"` : ''} ${o.im ? `inputmode="${o.im}"` : ''} ${o.ph ? `placeholder="${o.ph}"` : ''}></label>`;
  v.innerHTML = `
    <form id="f" class="form pad" novalidate ${admin ? '' : 'inert'}>
      <h2 class="sec-t">Proveedor</h2>
      ${campo('nombre', 'Nombre o razón social', { ph: 'Ej.: Distribuidora del Sur' })}
      ${campo('rut', 'RUT', { ph: '76.123.456-7' })}
      <h2 class="sec-t">Contacto</h2>
      ${campo('contacto', 'Persona de contacto')}
      ${campo('telefono', 'WhatsApp / teléfono', { tipo: 'tel', im: 'tel', ph: '+56 9 1234 5678' })}
      ${campo('correo', 'Correo para pedidos', { tipo: 'email', im: 'email' })}
      <label class="campo"><span>Notas</span><textarea name="notas" rows="3" placeholder="Días de despacho, pedido mínimo, forma de pago…">${esc(p.notas || '')}</textarea></label>
      <label class="check"><input name="activo" type="checkbox" ${p.activo !== false ? 'checked' : ''}> Proveedor activo</label>
      <p id="err" class="error" role="alert"></p>
      ${admin ? `<div class="pie-fijo"><button class="btn prin" type="submit">${id ? 'Guardar cambios' : 'Crear proveedor'}</button></div>` : ''}
    </form>
    ${id ? `<h2 class="sec-t">Productos de este proveedor · ${prods.length}</h2>
      ${prods.length ? `<div class="lista">${prods.map((x) => `
        <a class="fila" href="#/inventario/${x.id}"><div class="fila-txt"><p class="fila-t">${esc(x.nombre)}</p>
          <p class="fila-s">Stock ${x.stock} · <span class="monto">${clp(x.precio)}</span></p></div>${icono('derecha', 'ico-chev')}</a>`).join('')}</div>`
      : '<p class="ayuda pad">Asígnalo desde la ficha de cada producto en Inventario.</p>'}` : ''}`;
  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = leerForm(e.target);
    if (!d.nombre) { $('#err', v).textContent = 'Escribe el nombre del proveedor.'; return; }
    try {
      const g = await datos.guardarProveedor(id ? { ...d, id: Number(id) } : d);
      aviso(id ? 'Proveedor guardado' : 'Proveedor creado');
      ir(`#/proveedores/${g.id}`);
    } catch (err) { $('#err', v).textContent = err.message; }
  });
}
