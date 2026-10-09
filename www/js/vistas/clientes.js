import { $, esc, barra, icono, vacio, leerForm, aviso, ir, clp, fecha, selectorVista, activarSelector } from '../ui.js';
import * as datos from '../datos.js';
import { prepararFoto } from '../fotos.js';

let ultimaBusqueda = '';

export async function vistaClientes(v) {
  barra({ titulo: 'Clientes', accion: datos.esAdmin() ? { href: '#/clientes/nuevo', icono: 'mas', etiqueta: 'Nuevo cliente' } : null });
  v.innerHTML = `
    <div class="inv-cab">
      <div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Nombre, RUT o comuna" value="${esc(ultimaBusqueda)}" aria-label="Buscar cliente"></div>
      ${selectorVista()}
    </div>
    <p id="cuenta" class="cuenta"></p>
    <div id="lista"></div>`;
  const pintar = async () => {
    const cs = await datos.clientes({ busqueda: ultimaBusqueda });
    $('#cuenta', v).textContent = `${cs.length} cliente${cs.length === 1 ? '' : 's'}`;
    const cont = $('#lista', v);
    const lugar = (c) => esc(c.ruta_nombre || 'Sin ruta') + (c.comuna && c.comuna !== c.ruta_nombre ? ' · ' + esc(c.comuna) : '');
    const estado = (c) => (c.atendido ? `<span class="chip ok">${icono('check', 'ico-s')} Atendido</span>` : '<span class="chip">Pendiente</span>');
    if (!cs.length) { cont.className = ''; cont.innerHTML = vacio('No hay clientes con esa búsqueda'); return; }
    if (vista() === 'iconos') {
      cont.className = 'grilla';
      cont.innerHTML = cs.map((c) => `
        <a class="tarjeta cliente" href="#/clientes/${c.id}">
          ${avatar(c, 'grande')}
          <p class="tarjeta-t">${esc(c.nombre)}</p>
          <p class="tarjeta-s">${lugar(c)}</p>
          ${estado(c)}</a>`).join('');
    } else {
      cont.className = 'lista';
      cont.innerHTML = cs.map((c) => `
        <a class="fila" href="#/clientes/${c.id}">
          ${avatar(c)}
          <div class="fila-txt"><p class="fila-t">${esc(c.nombre)}</p><p class="fila-s">${lugar(c)}</p></div>
          ${icono('derecha', 'ico-chev')}</a>`).join('');
    }
  };
  const vista = activarSelector(v, 'clientes', pintar);
  let t;
  $('#q', v).addEventListener('input', (e) => { ultimaBusqueda = e.target.value.trim(); clearTimeout(t); t = setTimeout(pintar, 250); });
  await pintar();
}

const avatar = (c, cls = '') => c.imagen_url
  ? `<img class="avatar foto ${cls}" src="${esc(c.imagen_url)}" alt="" loading="lazy">`
  : `<span class="avatar ${cls}" aria-hidden="true">${esc(iniciales(c.nombre))}</span>`;
const iniciales = (n) => n.split(/\s+/).filter((p) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p)).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

// Botones de foto (cámara / galería) + subida. Se usa en el perfil y en Editar cliente.
const botonesFoto = (c) => `<div class="foto-acciones mt">
      <label class="btn sec">${icono('camara')} ${c.imagen_url ? 'Nueva foto' : 'Tomar foto'}<input class="foto-in" type="file" accept="image/*" capture="environment" hidden></label>
      <label class="btn sec">${icono('cuadricula')} Galería<input class="foto-in" type="file" accept="image/*" hidden></label>
    </div>
    ${c.imagen_url && datos.esAdmin() ? '<button type="button" id="quitar-foto" class="btn link quitar">Quitar foto</button>' : ''}`;

function activarFoto(v, id, alTerminar) {
  v.querySelectorAll('.foto-in').forEach((inp) => inp.addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const caja = $('.perfil-foto', v);
    caja?.classList.add('subiendo');
    try {
      await datos.subirFotoCliente(id, await prepararFoto(archivo));
      aviso('Foto guardada');
      alTerminar();
    } catch (err) { caja?.classList.remove('subiendo'); aviso(err.message, 'error'); }
  }));
  $('#quitar-foto', v)?.addEventListener('click', async () => {
    if (!confirm('¿Quitar la foto de este cliente?')) return;
    try { await datos.quitarFotoCliente(id); aviso('Foto quitada'); alTerminar(); }
    catch (err) { aviso(err.message, 'error'); }
  });
}

export async function vistaCliente(v, id) {
  const c = await datos.cliente(id);
  const peds = await datos.pedidosCliente(id);
  const volver = c.ruta_id ? `#/rutas/${c.ruta_id}` : '#/clientes';
  barra({ titulo: c.nombre, sub: c.ruta_nombre || 'Sin ruta', atras: volver,
    accion: datos.esAdmin() ? { href: `#/clientes/${id}/editar`, icono: 'editar', etiqueta: 'Editar cliente' } : null });
  const dato = (et, val, extra = '') => (val ? `<div class="dato"><dt>${et}</dt><dd>${val}${extra}</dd></div>` : '');
  const tel = (c.telefono || '').replace(/[^\d+]/g, '');
  const faltan = ['rut', 'telefono', 'direccion', 'comuna'].filter((k) => !c[k]);
  v.innerHTML = `
    <div class="perfil-cab">
      <label class="perfil-foto" aria-label="Agregar o cambiar foto del cliente">${avatar(c, 'grande')}
        <span class="foto-insignia" aria-hidden="true">${icono('camara')}</span>
        <input class="foto-in" type="file" accept="image/*" hidden></label>
      <div>
        ${c.atendido ? `<span class="chip ok">${icono('check', 'ico-s')} Atendido este ciclo</span>` : '<span class="chip">Pendiente este ciclo</span>'}
        <p class="perfil-s">Visita cada ${c.frecuencia_dias} días${c.ultima_compra ? ' · Última compra ' + fecha(c.ultima_compra) : ''}</p>
      </div>
    </div>
    ${botonesFoto(c)}
    ${tel ? `<div class="acciones-rap"><a class="btn sec" href="tel:${esc(tel)}">${icono('telefono')} Llamar</a>
      ${c.direccion || c.comuna ? `<a class="btn sec" href="https://maps.google.com/?q=${encodeURIComponent([c.direccion, c.comuna, 'Chile'].filter(Boolean).join(', '))}" target="_blank" rel="noopener">${icono('mapa')} Mapa</a>` : ''}</div>` : ''}
    ${faltan.length && datos.esAdmin() ? `<a class="nota-falta" href="#/clientes/${id}/editar">Faltan datos: ${faltan.map((k) => ({ rut: 'RUT', telefono: 'teléfono', direccion: 'dirección', comuna: 'comuna' }[k])).join(', ')}. Toca para completar.</a>` : ''}

    <h2 class="sec-t">Datos</h2>
    <dl class="datos">
      ${dato('Razón social', esc(c.razon_social))}
      ${dato('RUT', esc(c.rut))}
      ${dato('Contacto', esc(c.contacto))}
      ${dato('Teléfono', esc(c.telefono))}
      ${dato('Correo', esc(c.correo))}
      ${dato('Dirección', esc([c.direccion, c.comuna].filter(Boolean).join(', ')))}
      ${dato('Límite de crédito', c.limite_credito ? clp(c.limite_credito) : '')}
      ${c.notas ? dato('Notas', esc(c.notas)) : ''}
    </dl>

    <h2 class="sec-t">Compras</h2>
    ${peds.length ? `<div class="lista">${peds.map((p) => `
      <div class="fila"><div class="fila-txt"><p class="fila-t">Nota N° ${p.numero}</p>
        <p class="fila-s">${fecha(p.fecha)} · ${esc(p.forma_pago)}${p.estado === 'anulado' ? ' · Anulada' : ''}</p></div>
        <span class="monto">${clp(p.total)}</span></div>`).join('')}</div>`
      : '<p class="texto-suave pad-x">Aún sin compras en la app nueva.</p>'}
    ${c.loyverse_compras ? `<div class="historial-ant">
      <p class="fila-t">Historial en Loyverse</p>
      <p class="fila-s">${c.loyverse_compras} compras · ${clp(c.loyverse_total)} en total</p>
      <p class="fila-s">Desde ${fecha(c.loyverse_primera_compra)} hasta ${fecha(c.loyverse_ultima_compra)}</p></div>` : ''}
    <div class="pie-fijo"><a class="btn prin" href="#/clientes/${id}/pedido">Generar pedido</a></div>`;

  activarFoto(v, id, () => vistaCliente(v, id));
}

export async function vistaClienteForm(v, id) {
  const c = id ? await datos.cliente(id) : { frecuencia_dias: 7, ruta_id: Number(new URLSearchParams(location.hash.split('?')[1]).get('ruta')) || null };
  const rs = (await datos.rutas()).filter((r) => !r.especial);
  barra({ titulo: id ? 'Editar cliente' : 'Nuevo cliente', atras: id ? `#/clientes/${id}` : '#/clientes' });
  const campo = (name, et, opt = {}) => `<label class="campo"><span>${et}</span>
    <input name="${name}" value="${esc(c[name] ?? '')}" ${opt.tipo ? `type="${opt.tipo}"` : ''} ${opt.im ? `inputmode="${opt.im}"` : ''} ${opt.ph ? `placeholder="${opt.ph}"` : ''} ${opt.req ? 'required' : ''}></label>`;
  v.innerHTML = `
    <form id="f" class="form pad" novalidate>
      ${id ? `<h2 class="sec-t">Foto del local</h2>
      <div class="perfil-cab sin-borde"><div class="perfil-foto">${avatar(c, 'grande')}</div>
        <p class="ayuda">Una foto del frente ayuda a reconocer el local en ruta.</p></div>
      ${botonesFoto(c)}` : ''}
      <h2 class="sec-t">Identificación</h2>
      ${campo('nombre', 'Nombre del cliente o negocio', { req: true })}
      ${campo('razon_social', 'Razón social', { ph: 'Para facturar en el futuro' })}
      ${campo('rut', 'RUT', { ph: '12.345.678-9' })}
      <h2 class="sec-t">Contacto</h2>
      ${campo('contacto', 'Persona de contacto')}
      ${campo('telefono', 'Teléfono / WhatsApp', { tipo: 'tel', im: 'tel', ph: '+56 9 1234 5678' })}
      ${campo('correo', 'Correo', { tipo: 'email', im: 'email' })}
      <h2 class="sec-t">Ubicación</h2>
      ${campo('direccion', 'Dirección')}
      ${campo('comuna', 'Comuna o localidad')}
      <h2 class="sec-t">Ruta y visitas</h2>
      <label class="campo"><span>Ruta</span>
        <select name="ruta_id" data-num><option value="">Sin ruta</option>
          ${rs.map((r) => `<option value="${r.id}" ${c.ruta_id === r.id ? 'selected' : ''}>${esc(r.nombre)}</option>`).join('')}
        </select></label>
      <label class="campo"><span>Frecuencia de visita</span>
        <select name="frecuencia_dias" data-num>
          ${[[7, 'Semanal (cada 7 días)'], [14, 'Quincenal (cada 14 días)'], [21, 'Cada 3 semanas'], [30, 'Mensual']].map(([d, t]) => `<option value="${d}" ${c.frecuencia_dias === d ? 'selected' : ''}>${t}</option>`).join('')}
        </select></label>
      <label class="campo"><span>Orden dentro de la ruta</span>
        <input name="orden_ruta" type="number" inputmode="numeric" value="${c.orden_ruta ?? ''}" placeholder="1 = primero en visitar"></label>
      <h2 class="sec-t">Crédito y notas</h2>
      <label class="campo"><span>Límite de crédito ($)</span>
        <input name="limite_credito" type="number" inputmode="numeric" value="${c.limite_credito ?? ''}" placeholder="0 = sin crédito"></label>
      <label class="campo"><span>Notas</span><textarea name="notas" rows="3" placeholder="Horario, referencias, preferencias…">${esc(c.notas || '')}</textarea></label>
      <label class="check"><input name="activo" type="checkbox" ${c.activo !== false ? 'checked' : ''}> Cliente activo</label>
      <p id="err" class="error" role="alert"></p>
      <div class="pie-fijo"><button class="btn prin" type="submit">${id ? 'Guardar cambios' : 'Crear cliente'}</button></div>
    </form>`;
  if (id) activarFoto(v, id, () => vistaClienteForm(v, id));
  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = leerForm(e.target);
    if (!d.nombre) { $('#err', v).textContent = 'El nombre es obligatorio.'; return; }
    d.limite_credito = d.limite_credito ?? 0; d.orden_ruta = d.orden_ruta ?? 0;
    try {
      const g = await datos.guardarCliente(id ? { ...d, id: Number(id) } : d);
      aviso(id ? 'Cliente guardado' : 'Cliente creado');
      ir(`#/clientes/${g.id}`);
    } catch (err) { $('#err', v).textContent = err.message; }
  });
}
