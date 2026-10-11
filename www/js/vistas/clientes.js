import { $, esc, barra, icono, vacio, leerForm, aviso, ir, clp, fecha, selectorVista, activarSelector } from '../ui.js';
import * as datos from '../datos.js';
import { prepararFoto } from '../fotos.js';
import { ubicacionHtml, activarUbicacion } from './ubicacion.js';
import { tieneGps, urlPunto } from '../gps.js';
import * as lealtad from '../lealtad.js';

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
  // Niveles de lealtad (si no se pueden leer, la lista se muestra igual sin marcos)
  const niveles = await Promise.all([datos.programaLealtad(), datos.comprasLealtad()])
    .then(([cfg, compras]) => (cfg.activo ? { cfg, compras } : null)).catch(() => null);
  const nivelDe = (c) => (niveles ? lealtad.estado(niveles.compras.get(c.id), niveles.cfg) : null);
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
          ${conRango(avatar(c, 'grande'), nivelDe(c), 'grilla')}
          <p class="tarjeta-t">${esc(c.nombre)}</p>
          <p class="tarjeta-s">${lugar(c)}</p>
          ${estado(c)}</a>`).join('');
    } else {
      cont.className = 'lista';
      cont.innerHTML = cs.map((c) => `
        <a class="fila" href="#/clientes/${c.id}">
          ${conRango(avatar(c), nivelDe(c), 'lista')}
          <div class="fila-txt"><p class="fila-t">${esc(c.nombre)}</p><p class="fila-s">${(() => { const e = nivelDe(c); return e ? `<b class="nivel-txt ${e.nuevo ? 'nv-nuevo' : `nv-${e.i}`}">${esc(e.nombre)}</b> · ` : ''; })()}${lugar(c)}</p></div>
          ${icono('derecha', 'ico-chev')}</a>`).join('');
    }
  };
  const vista = activarSelector(v, 'clientes', pintar);
  let t;
  $('#q', v).addEventListener('input', (e) => { ultimaBusqueda = e.target.value.trim(); clearTimeout(t); t = setTimeout(pintar, 250); });
  await pintar();
}

// Marco de nivel alrededor del avatar (inspirado en los emblemas de rango de los videojuegos):
// cada nivel suma adornos. Cliente nuevo (nunca ha comprado) = sin marco, solo la placa "Cliente nuevo".
// El nombre del nivel siempre va escrito al lado.
const PLUMAS = ['M37 -6 52 -12 45 4Z', 'M34 -19 50 -31 44 -12Z', 'M36 8 49 9 40 19Z'];
const ala = (n) => PLUMAS.slice(0, n).map((d) => `<path d="M${d.slice(1)}"/><path d="M${d.slice(1)}" transform="scale(-1 1)"/>`).join('');
const ADORNOS = [
  '<path d="M-6 36 0 43 6 36Z"/>',
  `${ala(1)}<circle r="39.5" class="fino"/><path d="M-7 36 0 44 7 36Z"/>`,
  `${ala(2)}<circle r="39.5" class="fino"/><path d="M-10 -36-12-46-5-41 0-49 5-41 12-46 10-36Z"/><path d="M-8 36 0 45 8 36Z"/>`,
  `${ala(3)}<circle r="39.5" class="fino"/><path d="M-11 -36-13-47-5-42 0-50 5-42 13-47 11-36Z"/><circle cy="-44" r="3.2" class="gema"/><path d="M0 34 7 42 0 50-7 42Z"/><circle cy="42" r="2" class="gema"/>`,
];
const marco = (i) => `<svg class="rango-marco" viewBox="-52 -52 104 104" aria-hidden="true"><circle r="35" class="anillo"/>${ADORNOS[i]}</svg>`;
// e: estado de lealtad del cliente (o null). tam: 'lista' | 'grilla' | 'perfil'
const conRango = (avatarHtml, e, tam) => {
  const r = e || null;
  const clase = !r ? '' : r.nuevo ? 'nv-nuevo' : `nv-${r.i} con-marco`;
  return `<span class="rango rango-${tam} ${clase}">${avatarHtml}${r && !r.nuevo ? marco(r.i) : ''}${r && tam === 'grilla' ? `<span class="rango-placa">${esc(r.nombre)}</span>` : ''}</span>`;
};

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

// Bloque "Programa de lealtad" de la ficha: nivel, beneficio, avance al siguiente y aviso si está por bajar.
function lealtadHtml(e) {
  const pct = e.nivel.descuento;
  if (e.nuevo) return `<h2 class="sec-t">Programa de lealtad</h2>
    <div class="lealtad nv-nuevo">
      <div class="lealtad-cab">
        <span class="medalla" aria-hidden="true">${icono('medalla')}</span>
        <div><p class="lealtad-n">Cliente nuevo</p><p class="lealtad-s">Aún no tiene compras registradas</p></div>
      </div>
      <div class="lealtad-prog"><p>${esc(lealtad.textoFalta(e))}</p></div>
    </div>`;
  return `<h2 class="sec-t">Programa de lealtad</h2>
    <div class="lealtad nv-${e.i}">
      <div class="lealtad-cab">
        <span class="medalla" aria-hidden="true">${icono('medalla')}</span>
        <div><p class="lealtad-n">Nivel ${esc(e.nivel.nombre)}</p>
          <p class="lealtad-s">${pct ? `${String(pct).replace('.', ',')} % de descuento en cada nota` : 'Sin descuento en este nivel'}</p></div>
      </div>
      <p class="lealtad-benef">Últimos 90 días: <span class="monto">${clp(e.stats.monto)}</span> en ${e.stats.semanas} semana${e.stats.semanas === 1 ? '' : 's'} con compra</p>
      ${e.nivel.beneficios ? `<p class="lealtad-benef">${esc(e.nivel.beneficios)}</p>` : ''}
      <div class="lealtad-prog">
        ${e.siguiente ? `<div class="barra-avance" role="progressbar" aria-valuenow="${Math.round(e.avance * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance a ${esc(e.siguiente.nombre)}"><span style="width:${Math.round(e.avance * 100)}%"></span></div>` : ''}
        <p>${esc(lealtad.textoFalta(e))}</p>
      </div>
      ${e.bajaA ? `<p class="nota-falta">Si no compra en los próximos 30 días, baja a ${esc(e.bajaA.nombre)}.</p>` : ''}
    </div>`;
}

export async function vistaCliente(v, id) {
  const c = await datos.cliente(id);
  const peds = await datos.pedidosCliente(id);
  // Lealtad: si falla (sin señal), la ficha se muestra igual sin ese bloque
  const le = await Promise.all([datos.programaLealtad(), datos.comprasLealtad(id)])
    .then(([cfg, compras]) => (cfg.activo ? { cfg, e: lealtad.estado(compras, cfg) } : null)).catch(() => null);
  const volver = c.ruta_id ? `#/rutas/${c.ruta_id}` : '#/clientes';
  barra({ titulo: c.nombre, sub: c.ruta_nombre || 'Sin ruta', atras: volver,
    accion: datos.esAdmin() ? { href: `#/clientes/${id}/editar`, icono: 'editar', etiqueta: 'Editar cliente' } : null });
  const dato = (et, val, extra = '') => (val ? `<div class="dato"><dt>${et}</dt><dd>${val}${extra}</dd></div>` : '');
  const tel = (c.telefono || '').replace(/[^\d+]/g, '');
  const faltan = ['rut', 'telefono', 'direccion', 'comuna'].filter((k) => !c[k]).concat(tieneGps(c) ? [] : ['gps']);
  v.innerHTML = `
    <div class="perfil-cab">
      <label class="perfil-foto" aria-label="Agregar o cambiar foto del cliente">${conRango(avatar(c, 'grande'), le?.e, 'perfil')}
        <span class="foto-insignia" aria-hidden="true">${icono('camara')}</span>
        <input class="foto-in" type="file" accept="image/*" hidden></label>
      <div>
        <div class="perfil-chips">${c.atendido ? `<span class="chip ok">${icono('check', 'ico-s')} Atendido este ciclo</span>` : '<span class="chip">Pendiente este ciclo</span>'}
          ${le ? `<span class="chip nivel ${le.e.nuevo ? 'nv-nuevo' : `nv-${le.e.i}`}">${icono('medalla', 'ico-s')} ${esc(le.e.nombre)}</span>` : ''}</div>
        <p class="perfil-s">Visita cada ${c.frecuencia_dias} días${c.ultima_compra ? ' · Última compra ' + fecha(c.ultima_compra) : ''}</p>
      </div>
    </div>
    ${botonesFoto(c)}
    ${tel ? `<div class="acciones-rap"><a class="btn sec" href="tel:${esc(tel)}">${icono('telefono')} Llamar</a>
      ${tieneGps(c) || c.direccion || c.comuna ? `<a class="btn sec" data-externo href="${tieneGps(c) ? urlPunto(c) : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([c.direccion, c.comuna, 'Chile'].filter(Boolean).join(', '))}">${icono('mapa')} Mapa</a>` : ''}</div>` : ''}
    ${faltan.length && datos.esAdmin() ? `<a class="nota-falta" href="#/clientes/${id}/editar">Faltan datos: ${faltan.map((k) => ({ rut: 'RUT', telefono: 'teléfono', direccion: 'dirección', comuna: 'comuna', gps: 'ubicación GPS' }[k])).join(', ')}. Toca para completar.</a>` : ''}

    ${le ? lealtadHtml(le.e) : ''}

    <h2 class="sec-t">Ubicación</h2>
    ${ubicacionHtml(c)}

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
      : '<p class="texto-suave pad-x">Aún sin notas de venta.</p>'}
    ${c.loyverse_compras ? `<div class="historial-ant">
      <p class="fila-t">Compras anteriores</p>
      <p class="fila-s">${c.loyverse_compras} compras · ${clp(c.loyverse_total)} en total</p>
      <p class="fila-s">Desde ${fecha(c.loyverse_primera_compra)} hasta ${fecha(c.loyverse_ultima_compra)}</p></div>` : ''}
    <div class="pie-fijo"><a class="btn prin" href="#/clientes/${id}/pedido">Generar pedido</a></div>`;

  activarFoto(v, id, () => vistaCliente(v, id));
  activarUbicacion(v, c, () => vistaCliente(v, id));
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
      ${id ? `<h2 class="sec-t">Ubicación GPS</h2>${ubicacionHtml(c)}` : ''}
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
  if (id) { activarFoto(v, id, () => vistaClienteForm(v, id)); activarUbicacion(v, c, () => vistaClienteForm(v, id)); }
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
