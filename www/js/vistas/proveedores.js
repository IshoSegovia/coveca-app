// Proveedores: lista, ficha y edición. Cada producto puede tener su proveedor (ver inventario).
import { $, esc, barra, icono, vacio, leerForm, aviso, ir, clp } from '../ui.js';
import * as datos from '../datos.js';

const iniciales = (n) => n.split(/\s+/).filter((w) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export async function vistaProveedores(v) {
  barra({ titulo: 'Proveedores', atras: '#/ajustes',
    accion: datos.esAdmin() ? { href: '#/proveedores/nuevo', icono: 'mas', etiqueta: 'Nuevo proveedor' } : null });
  const ps = await datos.proveedores();
  v.innerHTML = ps.length ? `
    <p class="cuenta mt">${ps.length} proveedor${ps.length === 1 ? '' : 'es'}</p>
    <div class="lista">${ps.map((p) => `
      <a class="fila" href="#/proveedores/${p.id}">
        <span class="avatar" aria-hidden="true">${esc(iniciales(p.nombre))}</span>
        <div class="fila-txt"><p class="fila-t">${esc(p.nombre)}${p.activo === false ? ' <span class="txt-suave">(inactivo)</span>' : ''}</p>
          <p class="fila-s">${esc([p.contacto, p.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto')}</p></div>
        <span class="chip">${p.productos} prod.</span>${icono('derecha', 'ico-chev')}</a>`).join('')}
    </div>`
    : vacio('Aún no hay proveedores', 'Crea los proveedores y luego asígnalos a cada producto desde Inventario.',
      datos.esAdmin() ? '<a class="btn prin" href="#/proveedores/nuevo">Agregar proveedor</a>' : '');
}

export async function vistaProveedor(v, id) {
  const p = await datos.proveedor(id);
  const prods = await datos.productosDeProveedor(id);
  barra({ titulo: p.nombre, sub: 'Proveedor', atras: '#/proveedores',
    accion: datos.esAdmin() ? { href: `#/proveedores/${id}/editar`, icono: 'editar', etiqueta: 'Editar proveedor' } : null });
  const tel = (p.telefono || '').replace(/[^\d+]/g, '');
  const wa = tel.replace(/\D/g, '');
  const faltan = [['contacto', 'contacto'], ['telefono', 'WhatsApp'], ['correo', 'correo'], ['rut', 'RUT']].filter(([k]) => !p[k]).map(([, t]) => t);
  const dato = (et, val) => (val ? `<div class="dato"><dt>${et}</dt><dd>${esc(val)}</dd></div>` : '');
  v.innerHTML = `
    <div class="perfil-cab">
      <span class="avatar grande" aria-hidden="true">${esc(iniciales(p.nombre))}</span>
      <div>
        ${p.activo === false ? '<span class="chip">Inactivo</span>' : `<span class="chip ok">${icono('check', 'ico-s')} Activo</span>`}
        <p class="perfil-s">${prods.length} producto${prods.length === 1 ? '' : 's'} asignado${prods.length === 1 ? '' : 's'}</p>
      </div>
    </div>
    ${tel || p.correo ? `<div class="acciones-rap">
      ${wa ? `<a class="btn sec" data-externo href="https://wa.me/${wa.startsWith('56') ? wa : '56' + wa}">${icono('whatsapp')} WhatsApp</a>` : ''}
      ${tel ? `<a class="btn sec" href="tel:${esc(tel)}">${icono('telefono')} Llamar</a>` : ''}
      ${p.correo && !tel ? `<a class="btn sec" href="mailto:${esc(p.correo)}">Correo</a>` : ''}
    </div>` : ''}
    ${faltan.length && datos.esAdmin() ? `<a class="nota-falta" href="#/proveedores/${id}/editar">Faltan datos: ${faltan.join(', ')}. Toca para completar.</a>` : ''}
    <h2 class="sec-t">Datos</h2>
    <dl class="datos">
      ${dato('Nombre', p.nombre)}
      ${dato('RUT', p.rut)}
      ${dato('Contacto', p.contacto)}
      ${dato('WhatsApp', p.telefono)}
      ${dato('Correo', p.correo)}
      ${dato('Notas', p.notas)}
    </dl>
    <h2 class="sec-t">Productos de este proveedor · ${prods.length}</h2>
    ${prods.length ? `<div class="lista">${prods.map((x) => `
      <a class="fila" href="#/inventario/${x.id}"><div class="fila-txt"><p class="fila-t">${esc(x.nombre)}</p>
        <p class="fila-s">Stock ${x.stock} · <span class="monto">${clp(x.precio)}</span></p></div>${icono('derecha', 'ico-chev')}</a>`).join('')}</div>`
    : '<p class="ayuda pad">Aún sin productos. Asígnalo desde la ficha de cada producto en Inventario (campo Proveedor).</p>'}`;
}

export async function vistaProveedorForm(v, id) {
  const p = id ? await datos.proveedor(id) : { activo: true };
  const admin = datos.esAdmin();
  barra({ titulo: id ? 'Editar proveedor' : 'Nuevo proveedor', atras: id ? `#/proveedores/${id}` : '#/proveedores' });
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
`;
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
