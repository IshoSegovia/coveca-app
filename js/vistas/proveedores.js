// Proveedores: lista, ficha y edición. Cada producto puede tener su proveedor (ver inventario).
import { $, esc, barra, icono, vacio, leerForm, aviso, ir, clp, plural, fecha } from '../ui.js';
import { rutInput, campoTel, telWhatsApp } from '../campos.js';
import * as datos from '../datos.js';
import { listaCambio, puedeDividir } from '../escritorio.js';   // con la ficha al lado (PC), el botón principal es el de la ficha
import { chipPedidoProv } from './pedidos-proveedor.js';

const iniciales = (n) => n.split(/\s+/).filter((w) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// Proveedores es solo para administradores: el menú se lo oculta al vendedor, y esto cubre la dirección escrita a mano.
function soloAdmin(v) {
  barra({ titulo: 'Proveedores', atras: '#/rutas' });
  v.innerHTML = vacio('Solo para administradores', 'Los proveedores los maneja un administrador.');
}

export async function vistaProveedores(v) {
  if (!datos.esAdmin()) return soloAdmin(v);
  barra({ titulo: 'Proveedores',
    accion: datos.esAdmin() ? { href: '#/proveedores/nuevo', icono: 'mas', etiqueta: 'Nuevo proveedor' } : null });
  const ps = await datos.proveedores();
  v.innerHTML = ps.length ? `
    <div class="lista prov-accesos mt">
      <a class="fila" href="#/compras" id="ir-compras"><span class="ruta-ico" aria-hidden="true">${icono('caja')}</span>
        <div class="fila-txt"><p class="fila-t">Compras a proveedores</p><p class="fila-s">Facturas y guías: sube el stock y actualiza costos</p></div>${icono('derecha', 'ico-chev')}</a>
      <a class="fila" href="#/pedidos-proveedor" id="ir-pedidos-prov"><span class="ruta-ico" aria-hidden="true">${icono('nota')}</span>
        <div class="fila-txt"><p class="fila-t">Pedidos a proveedores</p><p class="fila-s">Por enviar, enviados y recibidos</p></div>${icono('derecha', 'ico-chev')}</a></div>
    <div class="pad mt"><a class="btn ${puedeDividir() ? 'sec' : 'prin'}" id="pedido-libre" href="#/proveedores/pedido-libre">${icono('mas')} Pedido libre a proveedor</a>
      <p class="ayuda">Elige tú el proveedor y los productos, aunque no tengan stock bajo.</p></div>
    <p class="cuenta mt">${ps.length} proveedor${ps.length === 1 ? '' : 'es'}</p>
    <div class="lista">${ps.map((p) => `
      <a class="fila" href="#/proveedores/${p.id}">
        <span class="avatar" aria-hidden="true">${esc(iniciales(p.nombre))}</span>
        <div class="fila-txt"><p class="fila-t">${esc(p.nombre)}${p.activo === false ? ' <span class="txt-suave">(inactivo)</span>' : ''}</p>
          <p class="fila-s">${esc([[p.contacto, p.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto', p.respaldo ? `${p.respaldo} de respaldo` : ''].filter(Boolean).join(' · '))}</p></div>
        <span class="chip">${p.productos} prod.</span>${icono('derecha', 'ico-chev')}</a>`).join('')}
    </div>`
    : vacio('Aún no hay proveedores', 'Crea los proveedores y luego asígnalos a cada producto desde Inventario.',
      datos.esAdmin() ? '<a class="btn prin" href="#/proveedores/nuevo">Agregar proveedor</a>' : '');
}

export async function vistaProveedor(v, id) {
  if (!datos.esAdmin()) return soloAdmin(v);
  const p = await datos.proveedor(id);
  const [prods, peds] = await Promise.all([datos.productosDeProveedor(id), datos.esAdmin() ? datos.pedidosProveedor({ proveedorId: id, limite: 5 }) : []]);
  barra({ titulo: p.nombre, sub: 'Proveedor', atras: '#/proveedores',
    accion: datos.esAdmin() ? { href: `#/proveedores/${id}/editar`, icono: 'editar', etiqueta: 'Editar proveedor' } : null });
  const principales = prods.filter((x) => x.rol === 'principal').length, respaldos = prods.length - principales;
  const tel = (p.telefono || '').replace(/[^\d+]/g, '');
  const wa = tel.replace(/\D/g, '');
  const faltan = [['contacto', 'contacto'], ['telefono', 'WhatsApp'], ['correo', 'correo'], ['rut', 'RUT']].filter(([k]) => !p[k]).map(([, t]) => t);
  const dato = (et, val) => (val ? `<div class="dato"><dt>${et}</dt><dd>${esc(val)}</dd></div>` : '');
  v.innerHTML = `
    <div class="perfil-cab">
      <span class="avatar grande" aria-hidden="true">${esc(iniciales(p.nombre))}</span>
      <div>
        ${p.activo === false ? '<span class="chip">Inactivo</span>' : `<span class="chip ok">${icono('check', 'ico-s')} Activo</span>`}
        <p class="perfil-s">${plural(principales, 'producto')} como principal${respaldos ? ` · ${respaldos} de respaldo` : ''}</p>
      </div>
    </div>
    ${tel || p.correo ? `<div class="acciones-rap">
      ${wa ? `<a class="btn sec" data-externo href="https://wa.me/${telWhatsApp(p.telefono)}">${icono('whatsapp')} WhatsApp</a>` : ''}
      ${tel ? `<a class="btn sec" href="tel:${esc(tel)}">${icono('telefono')} Llamar</a>` : ''}
      ${p.correo && !tel ? `<a class="btn sec" href="mailto:${esc(p.correo)}">Correo</a>` : ''}
    </div>` : ''}
    ${faltan.length && datos.esAdmin() ? `<a class="nota-falta" href="#/proveedores/${id}/editar">Faltan datos: ${faltan.join(', ')}. Toca para completar.</a>` : ''}
    ${datos.esAdmin() ? `<div class="lista prov-compras">
      <a class="fila" href="#/proveedores/${id}/pedido" id="hacer-pedido"><span class="ruta-ico" aria-hidden="true">${icono('nota')}</span>
        <div class="fila-txt"><p class="fila-t">Hacer pedido</p><p class="fila-s">Te sugerimos qué reponer; se envía por WhatsApp o en hoja</p></div>${icono('derecha', 'ico-chev')}</a>
      <a class="fila" href="#/proveedores/pedido-libre?proveedor=${id}" id="pedido-libre-prov"><span class="ruta-ico" aria-hidden="true">${icono('mas')}</span>
        <div class="fila-txt"><p class="fila-t">Pedido libre</p><p class="fila-s">Tú eliges los productos, con o sin stock bajo</p></div>${icono('derecha', 'ico-chev')}</a>
      <a class="fila" href="#/compras/nueva?proveedor=${id}"><span class="ruta-ico" aria-hidden="true">${icono('caja')}</span>
        <div class="fila-txt"><p class="fila-t">Registrar compra</p><p class="fila-s">Llegó mercadería de este proveedor</p></div>${icono('derecha', 'ico-chev')}</a></div>
    ${peds.length ? `<h2 class="sec-t">Pedidos a este proveedor</h2>
      <div class="lista" id="pedidos-prov">${peds.map((x) => `<a class="fila" href="#/pedidos-proveedor/${x.id}">
        <div class="fila-txt"><p class="fila-t">Pedido N° ${x.numero}</p><p class="fila-s">${fecha(x.fecha)} · ${plural(x.productos, 'producto')} · ${x.unidades} unid.</p></div>
        ${chipPedidoProv(x.estado)}${icono('derecha', 'ico-chev')}</a>`).join('')}</div>` : ''}` : ''}
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
        <p class="fila-s">Stock ${x.stock} · <span class="monto">${clp(x.precio)}</span></p></div>
        <span class="chip ${x.rol === 'principal' ? 'ok' : ''}">${x.rol === 'principal' ? 'Principal' : 'Respaldo'}</span>${icono('derecha', 'ico-chev')}</a>`).join('')}</div>`
    : '<p class="ayuda pad">Aún sin productos. Asígnalo desde la ficha de cada producto en Inventario (campos Proveedor y Proveedor de respaldo).</p>'}`;
}

export async function vistaProveedorForm(v, id) {
  if (!datos.esAdmin()) return soloAdmin(v);
  const p = id ? await datos.proveedor(id) : { activo: true };
  const admin = true;
  barra({ titulo: id ? 'Editar proveedor' : 'Nuevo proveedor', atras: id ? `#/proveedores/${id}` : '#/proveedores' });
  const campo = (name, et, o = {}) => `<label class="campo"><span>${et}</span>
    <input name="${name}" value="${esc(p[name] ?? '')}" ${o.tipo ? `type="${o.tipo}"` : ''} ${o.im ? `inputmode="${o.im}"` : ''} ${o.ph ? `placeholder="${o.ph}"` : ''}></label>`;
  v.innerHTML = `
    <form id="f" class="form pad" novalidate ${admin ? '' : 'inert'}>
      <h2 class="sec-t">Proveedor</h2>
      ${campo('nombre', 'Nombre o razón social', { ph: 'Ej.: Distribuidora del Sur' })}
      <label class="campo"><span>RUT</span>${rutInput('rut', p.rut, '76.123.456-7')}</label>
      <h2 class="sec-t">Contacto</h2>
      ${campo('contacto', 'Persona de contacto')}
      ${campoTel('telefono', 'WhatsApp / teléfono', p.telefono)}
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
      aviso(id ? 'Proveedor guardado' : 'Proveedor creado'); listaCambio();
      ir(`#/proveedores/${g.id}`);
    } catch (err) { $('#err', v).textContent = err.message; }
  });
}
