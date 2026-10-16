import { $, esc, barra, icono, vacio, leerForm, aviso, ir, clp, fecha, selectorVista, activarSelector, chipVisita, plural, PAGO_TXT, botonesFotoHtml } from '../ui.js';
import { rutInput, campoTel } from '../campos.js';
import * as datos from '../datos.js';
import { prepararFoto } from '../fotos.js';
import { medalla } from '../anima.js';
import { listaCambio, esEscritorio, tabla } from '../escritorio.js';
import { ubicacionHtml, activarUbicacion } from './ubicacion.js';
import { tieneGps, urlPunto } from '../gps.js';
import * as lealtad from '../lealtad.js';
import { fiadoHtml, activarFiado } from './fiado.js';

let ultimaBusqueda = '';
const ordenTabla = { k: 'nombre', dir: 'asc' };
let verDesactivados = false;   // filtro Activos / Desactivados

export async function vistaClientes(v) {
  barra({ titulo: 'Clientes', accion: datos.esAdmin() ? { href: '#/clientes/nuevo', icono: 'mas', etiqueta: 'Nuevo cliente' } : null });
  v.innerHTML = `
    <div class="inv-cab">
      <div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Nombre, RUT o comuna" value="${esc(ultimaBusqueda)}" aria-label="Buscar cliente"></div>
      ${selectorVista()}
    </div>
    <div class="filtros" role="tablist">
      <button class="filtro" data-f="activos" role="tab">Activos <span class="n"></span></button>
      <button class="filtro" data-f="desactivados" role="tab">Desactivados <span class="n"></span></button>
    </div>
    <p id="cuenta" class="cuenta"></p>
    <div id="lista"></div>`;
  // Niveles de lealtad (si no se pueden leer, la lista se muestra igual sin marcos)
  const niveles = await Promise.all([datos.programaLealtad(), datos.comprasLealtad()])
    .then(([cfg, compras]) => (cfg.activo ? { cfg, compras } : null)).catch(() => null);
  const nivelDe = (c) => (niveles ? lealtad.estado(niveles.compras.get(c.id), niveles.cfg) : null);
  const nivelTxt = (e) => `<b class="nivel-txt ${e.nuevo ? 'nv-nuevo' : `nv-${e.i}`}">${esc(e.nombre)}</b>`;
  const pintar = async () => {
    const todos = await datos.clientes({ busqueda: ultimaBusqueda, inactivos: true });
    const inact = todos.filter((c) => c.activo === false);
    v.querySelectorAll('.filtro').forEach((b) => {
      const des = b.dataset.f === 'desactivados';
      b.querySelector('.n').textContent = des ? inact.length : todos.length - inact.length;
      b.setAttribute('aria-selected', des === verDesactivados);
    });
    const cs = todos.filter((c) => (c.activo === false) === verDesactivados);
    $('#cuenta', v).textContent = `${plural(cs.length, 'cliente')}${verDesactivados ? (cs.length === 1 ? ' desactivado' : ' desactivados') + ': no aparecen en las rutas. Ábrelos para reactivarlos.' : ''}`;
    const cont = $('#lista', v);
    const lugar = (c) => esc(c.ruta_nombre || 'Sin ruta') + (c.comuna && c.comuna !== c.ruta_nombre ? ' · ' + esc(c.comuna) : '');
    const estado = (c) => (c.activo === false ? '<span class="chip">Desactivado</span>' : chipVisita(c));
    if (!cs.length) { cont.className = ''; cont.innerHTML = vacio(verDesactivados ? 'No hay clientes desactivados' : 'No hay clientes con esa búsqueda'); return; }
    if (esEscritorio()) {
      return tabla(cont, { etiqueta: 'Clientes', filas: cs, href: (c) => `#/clientes/${c.id}`, estado: ordenTabla, cols: [
        { k: 'nombre', t: 'Cliente', val: (c) => c.nombre,
          html: (c) => `${avatar(c)}<span class="celda-txt">${esc(c.nombre)}${c.razon_social && c.razon_social !== c.nombre ? `<small>${esc(c.razon_social)}</small>` : ''}</span>` },
        { k: 'rut', t: 'RUT', opc: true, prio2: true, val: (c) => c.rut || '', html: (c) => esc(c.rut || '—') },
        { k: 'ruta', t: 'Ruta', val: (c) => c.ruta_nombre || '', html: (c) => esc(c.ruta_nombre || 'Sin ruta') },
        { k: 'comuna', t: 'Comuna', opc: true, prio2: true, val: (c) => c.comuna || '', html: (c) => esc(c.comuna || '—') },
        { k: 'telefono', t: 'Teléfono', opc: true, val: (c) => c.telefono || '', html: (c) => esc(c.telefono || '—') },
        { k: 'nivel', t: 'Nivel', opc: true, val: (c) => { const e = nivelDe(c); return e ? (e.nuevo ? -1 : e.i) : -2; },
          html: (c) => { const e = nivelDe(c); return e ? nivelTxt(e) : '—'; } },
        { k: 'visita', t: 'Visita', prio3: true, val: (c) => (c.atendido ? 1 : 0), html: estado },
      ] });
    }
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
          <div class="fila-txt"><p class="fila-t">${esc(c.nombre)}</p><p class="fila-s">${nivelDe(c) ? nivelTxt(nivelDe(c)) + ' · ' : ''}${lugar(c)}</p></div>
          ${c.activo === false ? '<span class="chip">Desactivado</span>' : ''}
          ${icono('derecha', 'ico-chev')}</a>`).join('');
    }
  };
  const vista = activarSelector(v, 'clientes', pintar);
  v.querySelectorAll('.filtro').forEach((b) => b.addEventListener('click', () => { verDesactivados = b.dataset.f === 'desactivados'; pintar(); }));
  let t;
  $('#q', v).addEventListener('input', (e) => { ultimaBusqueda = e.target.value.trim(); clearTimeout(t); t = setTimeout(pintar, 250); });
  await pintar();
}

// Marco de nivel alrededor del avatar: anillo del color del nivel + medalla en pixel art (como la C del logo)
// abajo a la derecha. Cliente nuevo (nunca ha comprado) = sin marco, solo la placa "Cliente nuevo".
// El nombre del nivel siempre va escrito al lado.
const marco = (i) => `<svg class="rango-marco" viewBox="-52 -52 104 104" aria-hidden="true"><circle r="35" class="anillo"/></svg><span class="rango-medalla">${medalla(i)}</span>`;
// e: estado de lealtad del cliente (o null). tam: 'lista' | 'grilla' | 'perfil'
const conRango = (avatarHtml, e, tam) => {
  const clase = !e ? '' : e.nuevo ? 'nv-nuevo' : `nv-${e.i} con-marco`;
  return `<span class="rango rango-${tam} ${clase}">${avatarHtml}${e && !e.nuevo ? marco(e.i) : ''}${e && tam === 'grilla' ? `<span class="rango-placa">${esc(e.nombre)}</span>` : ''}</span>`;
};

const avatar = (c, cls = '') => c.imagen_url
  ? `<img class="avatar foto ${cls}" src="${esc(c.imagen_url)}" alt="" loading="lazy">`
  : `<span class="avatar ${cls}" aria-hidden="true">${esc(iniciales(c.nombre))}</span>`;
const iniciales = (n) => n.split(/\s+/).filter((p) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p)).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

// Botones de foto (cámara / galería) + subida. Se usa en el perfil y en Editar cliente.
// Con foto: solo "Quitar foto" (admin); los botones de cámara y galería vuelven al quitarla.
const botonesFoto = (c) => (c.imagen_url
  ? (datos.esAdmin() ? '<button type="button" id="quitar-foto" class="btn link quitar">Quitar foto</button>' : '')
  : botonesFotoHtml('mt'));

function activarFoto(v, id, alTerminar) {
  v.querySelectorAll('.foto-in').forEach((inp) => inp.addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const caja = $('.perfil-foto', v);
    caja?.classList.add('subiendo');
    try {
      await datos.subirFotoCliente(id, await prepararFoto(archivo));
      aviso('Foto guardada'); listaCambio();
      alTerminar();
    } catch (err) { caja?.classList.remove('subiendo'); aviso(err.message, 'error'); }
  }));
  $('#quitar-foto', v)?.addEventListener('click', async () => {
    if (!confirm('¿Quitar la foto de este cliente?')) return;
    try { await datos.quitarFotoCliente(id); aviso('Foto quitada'); listaCambio(); alTerminar(); }
    catch (err) { aviso(err.message, 'error'); }
  });
}

// Bloque "Programa de lealtad" de la ficha: nivel, beneficio, avance al siguiente y aviso si está por bajar.
function lealtadHtml(e) {
  const pct = e.nivel.descuento;
  const cab = (titulo, sub) => `<div class="lealtad-cab"><span class="medalla" aria-hidden="true">${icono('medalla')}</span>
    <div><p class="lealtad-n">${titulo}</p><p class="lealtad-s">${sub}</p></div></div>`;
  if (e.nuevo) return `<h2 class="sec-t">Programa de lealtad</h2>
    <div class="lealtad nv-nuevo">${cab('Cliente nuevo', 'Aún no tiene compras registradas')}
      <div class="lealtad-prog"><p>${esc(lealtad.textoFalta(e))}</p></div></div>`;
  return `<h2 class="sec-t">Programa de lealtad</h2>
    <div class="lealtad nv-${e.i}">
      ${cab(`Nivel ${esc(e.nivel.nombre)}`, pct ? `${String(pct).replace('.', ',')} % de descuento en cada nota` : 'Sin descuento en este nivel')}
      <p class="lealtad-benef">Últimos 90 días: <span class="monto">${clp(e.stats.monto)}</span> en ${plural(e.stats.semanas, 'semana')} con compra</p>
      ${e.nivel.beneficios ? `<p class="lealtad-benef">${esc(e.nivel.beneficios)}</p>` : ''}
      <div class="lealtad-prog">
        ${e.siguiente ? `<div class="barra-avance" role="progressbar" aria-valuenow="${Math.round(e.avance * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance a ${esc(e.siguiente.nombre)}"><span style="width:${Math.round(e.avance * 100)}%"></span></div>` : ''}
        <p>${esc(lealtad.textoFalta(e))}</p>
      </div>
      ${e.bajaA ? `<p class="nota-falta">Si no compra en los próximos 30 días, baja a ${esc(e.bajaA.nombre)}.</p>` : ''}
    </div>`;
}

// Historial de notas del cliente (las anuladas tachadas; las guardadas sin señal, "Por subir").
const listaNotas = (peds, vacia) => (peds.length ? `<div class="lista">${peds.map((p) => `
  <a class="fila" href="#/pedidos/${p.id}"><div class="fila-txt"><p class="fila-t">${p.numero ? `Nota N° ${p.numero}` : 'Nota sin número'}</p>
    <p class="fila-s">${fecha(p.fecha)} · ${esc(PAGO_TXT[p.forma_pago] || p.forma_pago)}${p.estado === 'anulado' ? ' · <span class="txt-alerta">Anulada</span>' : ''}${p.porSubir ? ' · Por subir' : ''}</p></div>
    <span class="monto ${p.estado === 'anulado' ? 'tachado' : ''}">${clp(p.total)}</span>${icono('derecha', 'ico-chev')}</a>`).join('')}</div>`
  : `<p class="texto-suave pad-x">${vacia}</p>`);

// Cliente con sus datos personales eliminados (migración 0026): solo se ven sus notas, sin acciones.
function fichaAnonimizada(v, c, peds) {
  barra({ titulo: c.nombre, sub: 'Datos eliminados', atras: '#/clientes' });
  v.innerHTML = `
    <div class="nota-falta aviso-inactivo">${icono('alerta', 'ico-s')} Los datos personales de este cliente se eliminaron el ${fecha(c.anonimizado_en)} a su pedido. Sus notas se conservan para las cuentas, sin datos personales. Si vuelve a comprar, créalo como cliente nuevo.</div>
    <h2 class="sec-t">Notas de venta</h2>
    ${listaNotas(peds, 'Sin notas de venta.')}`;
}

export async function vistaCliente(v, id) {
  const c = await datos.cliente(id);
  const peds = await datos.pedidosCliente(id);
  // Lealtad: si falla (sin señal), la ficha se muestra igual sin ese bloque
  const le = await Promise.all([datos.programaLealtad(), datos.comprasLealtad(id)])
    .then(([cfg, compras]) => (cfg.activo ? { cfg, e: lealtad.estado(compras, cfg) } : null)).catch(() => null);
  // Fiado: si no se puede leer (sin señal y sin copia), la ficha se muestra igual sin ese bloque
  const [fi, reglas] = await Promise.all([datos.fiadoCliente(id).catch(() => null), datos.reglasFiado().catch(() => null)]);
  const volver = c.ruta_id ? `#/rutas/${c.ruta_id}` : '#/clientes';
  if (c.anonimizado_en) return fichaAnonimizada(v, c, peds);
  barra({ titulo: c.nombre, sub: c.ruta_nombre || 'Sin ruta', atras: volver,
    accion: datos.esAdmin() ? { href: `#/clientes/${id}/editar`, icono: 'editar', etiqueta: 'Editar cliente' } : null });
  const dato = (et, val, extra = '') => (val ? `<div class="dato"><dt>${et}</dt><dd>${val}${extra}</dd></div>` : '');
  const tel = (c.telefono || '').replace(/[^\d+]/g, '');
  const faltan = ['rut', 'telefono', 'direccion', 'comuna'].filter((k) => !c[k]).concat(tieneGps(c) ? [] : ['gps']);
  const inactivo = c.activo === false;
  v.innerHTML = `
    ${inactivo ? `<div class="nota-falta aviso-inactivo">${icono('alerta', 'ico-s')} Cliente desactivado: no aparece en las rutas ni se le pueden tomar pedidos.${datos.esAdmin() ? '' : ' Pide a un administrador que lo reactive.'}</div>` : ''}
    <div class="perfil-cab">
      ${c.imagen_url ? `<div class="perfil-foto con-foto">${conRango(avatar(c, 'grande'), le?.e, 'perfil')}</div>`
        : `<label class="perfil-foto" aria-label="Agregar foto del cliente">${conRango(avatar(c, 'grande'), le?.e, 'perfil')}
        <span class="foto-insignia" aria-hidden="true">${icono('camara')}</span>
        <input class="foto-in" type="file" accept="image/*" hidden></label>`}
      <div>
        <div class="perfil-chips">${chipVisita(c, ' este ciclo')}
          ${le ? `<span class="chip nivel ${le.e.nuevo ? 'nv-nuevo' : `nv-${le.e.i}`}">${icono('medalla', 'ico-s')} ${esc(le.e.nombre)}</span>` : ''}</div>
        <p class="perfil-s">Visita cada ${c.frecuencia_dias} días${c.ultima_compra ? ' · Última compra ' + fecha(c.ultima_compra) : ''}</p>
      </div>
    </div>
    ${botonesFoto(c)}
    ${tel ? `<div class="acciones-rap"><a class="btn sec" href="tel:${esc(tel)}">${icono('telefono')} Llamar</a>
      ${tieneGps(c) || c.direccion || c.comuna ? `<a class="btn sec" data-externo href="${tieneGps(c) ? urlPunto(c) : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([c.direccion, c.comuna, 'Chile'].filter(Boolean).join(', '))}">${icono('mapa')} Mapa</a>` : ''}</div>` : ''}
    ${faltan.length && datos.esAdmin() ? `<a class="nota-falta" href="#/clientes/${id}/editar">Faltan datos: ${faltan.map((k) => ({ rut: 'RUT', telefono: 'teléfono', direccion: 'dirección', comuna: 'comuna', gps: 'ubicación GPS' }[k])).join(', ')}. Toca para completar.</a>` : ''}

    ${le ? lealtadHtml(le.e) : ''}
    ${fi ? fiadoHtml(fi, c, le && !le.e.nuevo ? le.e.nivel.nombre : null, le?.cfg, reglas?.plazo_dias) : ''}

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
      ${c.notas ? dato('Notas', esc(c.notas)) : ''}
    </dl>

    <h2 class="sec-t">Compras</h2>
    ${listaNotas(peds, 'Aún sin notas de venta.')}
    ${c.loyverse_compras ? `<div class="historial-ant">
      <p class="fila-t">Compras anteriores</p>
      <p class="fila-s">${c.loyverse_compras} compras · ${clp(c.loyverse_total)} en total</p>
      <p class="fila-s">Desde ${fecha(c.loyverse_primera_compra)} hasta ${fecha(c.loyverse_ultima_compra)}</p></div>` : ''}
    ${datos.esAdmin() ? `<h2 class="sec-t">Datos personales</h2>
    <div class="pad eliminar-datos">
      <button type="button" id="abrir-eliminar" class="btn peligro">Eliminar datos del cliente</button>
      <div id="caja-eliminar" class="form anular" hidden>
        <p class="fila-t">¿Eliminar los datos de ${esc(c.nombre)}?</p>
        <p class="ayuda">Úsalo solo si el cliente lo pide. Se borran su nombre, RUT, contacto, teléfono, correo, dirección, ubicación, foto y notas, y queda desactivado como "Cliente eliminado". Sus notas de venta y montos se conservan para las cuentas, sin datos personales. <b>No se puede deshacer.</b></p>
        <label class="campo"><span>Para confirmar, escribe <b>eliminar cliente</b></span>
          <input id="frase-eliminar" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="eliminar cliente"></label>
        <p id="err-eliminar" class="error" role="alert"></p>
        <div class="fila-botones"><button type="button" id="cancelar-eliminar" class="btn sec">Cancelar</button>
          <button type="button" id="confirmar-eliminar" class="btn peligro sin-margen" disabled>Eliminar datos</button></div>
      </div>
    </div>` : ''}
    ${inactivo ? (datos.esAdmin() ? '<div class="pie-fijo"><button id="reactivar" class="btn prin">Reactivar cliente</button></div>' : '')
      : `<div class="pie-fijo ${c.atendido ? '' : 'pie-doble'}">${c.atendido ? '' : `<button id="visitado" type="button" class="btn sec">${icono('puerta')} Marcar visitado</button>`}<a class="btn prin" href="#/clientes/${id}/pedido">Generar pedido</a></div>`}`;

  // Llegó al local pero no hubo pedido (cerrado, no estaba el encargado, no necesitaba nada): cuenta como visitado.
  $('#visitado', v)?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try {
      const vi = await datos.registrarVisita(Number(id), c.nombre);
      listaCambio(); vistaCliente(v, id);
      aviso('Marcado como visitado (sin pedido)', 'ok', { texto: 'Deshacer', fn: async () => {
        try { await datos.anularVisita(vi.id); aviso('Visita deshecha'); listaCambio(); if (location.hash.startsWith(`#/clientes/${id}`)) vistaCliente(v, id); }
        catch (err) { aviso(err.message, 'error'); }
      } });
    } catch (err) { e.target.disabled = false; aviso(err.message, 'error'); }
  });

  $('#reactivar', v)?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { await datos.guardarCliente({ id: Number(id), activo: true }); aviso('Cliente reactivado: vuelve a su ruta'); listaCambio(); vistaCliente(v, id); }
    catch (err) { e.target.disabled = false; aviso(err.message, 'error'); }
  });
  const caja = $('#caja-eliminar', v), pie = $('.pie-fijo', v);
  $('#abrir-eliminar', v)?.addEventListener('click', (e) => {
    e.currentTarget.hidden = true; caja.hidden = false; if (pie) pie.hidden = true;
    caja.scrollIntoView({ block: 'center' }); $('#frase-eliminar', v).focus();
  });
  // Confirmación reforzada: el botón solo se activa al escribir exactamente "eliminar cliente" (sin importar mayúsculas).
  const fraseOk = () => ($('#frase-eliminar', v)?.value || '').trim().replace(/\s+/g, ' ').toLowerCase() === 'eliminar cliente';
  $('#frase-eliminar', v)?.addEventListener('input', () => { $('#confirmar-eliminar', v).disabled = !fraseOk(); });
  $('#cancelar-eliminar', v)?.addEventListener('click', () => {
    caja.hidden = true; $('#abrir-eliminar', v).hidden = false; if (pie) pie.hidden = false;
    $('#frase-eliminar', v).value = ''; $('#confirmar-eliminar', v).disabled = true;
  });
  $('#confirmar-eliminar', v)?.addEventListener('click', async (e) => {
    if (!fraseOk()) return;
    e.currentTarget.disabled = true;
    try { await datos.eliminarDatosCliente(id); aviso('Datos del cliente eliminados'); listaCambio(); vistaCliente(v, id); }
    catch (err) { e.currentTarget.disabled = false; $('#err-eliminar', v).textContent = err.message; }
  });
  activarFoto(v, id, () => vistaCliente(v, id));
  activarUbicacion(v, c, () => vistaCliente(v, id));
  if (fi) activarFiado(v, c, fi, () => vistaCliente(v, id));
  // Desde una nota a crédito ("Registrar abono"): abre el formulario de abono.
  if (new URLSearchParams(location.hash.split('?')[1] || '').get('abono') === '1') $('#abrir-abono', v)?.click();
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
      <label class="campo"><span>RUT</span>${rutInput('rut', c.rut)}</label>
      <h2 class="sec-t">Contacto</h2>
      ${campo('contacto', 'Persona de contacto')}
      ${campoTel('telefono', 'Teléfono / WhatsApp', c.telefono)}
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
      <h2 class="sec-t">Crédito</h2>
      <label class="campo"><span>Límite de crédito ($)</span>
        <input name="limite_credito" type="number" inputmode="numeric" min="0" value="${c.limite_credito ?? ''}" placeholder="Vacío = sin tope · 0 = sin crédito"></label>
      <label class="campo"><span>Plazo para pagar (días)</span>
        <input name="plazo_credito_dias" type="number" inputmode="numeric" min="1" max="365" value="${c.plazo_credito_dias ?? ''}" placeholder="Vacío = plazo general"></label>
      <p class="ayuda">Límite vacío = sin tope; $0 = sin crédito disponible. Si un pedido lo supera, la app avisa y deja seguir. Los días extra por nivel de lealtad se suman al plazo.</p>
      <h2 class="sec-t">Notas</h2>
      <label class="campo"><span>Notas</span><textarea name="notas" rows="3" placeholder="Horario, referencias, preferencias…">${esc(c.notas || '')}</textarea></label>
      <label class="check"><input name="activo" type="checkbox" ${c.activo !== false ? 'checked' : ''}> Cliente activo</label>
      <p class="ayuda">Si lo desactivas sale de su ruta, pero queda guardado en Clientes → Desactivados, desde donde se puede reactivar.</p>
      <p id="err" class="error" role="alert"></p>
      <div class="pie-fijo ${!id && esEscritorio() ? 'pie-doble' : ''}">${!id && esEscritorio() ? '<button class="btn sec" type="submit" name="otro">Crear y agregar otro</button>' : ''}<button class="btn prin" type="submit">${id ? 'Guardar cambios' : 'Crear cliente'}</button></div>
    </form>`;
  if (id) { activarFoto(v, id, () => vistaClienteForm(v, id)); activarUbicacion(v, c, () => vistaClienteForm(v, id)); }
  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = leerForm(e.target);
    if (!d.nombre) { $('#err', v).textContent = 'El nombre es obligatorio.'; return; }
    d.limite_credito = d.limite_credito == null ? null : Math.max(0, d.limite_credito); d.orden_ruta = d.orden_ruta ?? 0;
    if (d.plazo_credito_dias != null && !(d.plazo_credito_dias >= 1 && d.plazo_credito_dias <= 365)) { $('#err', v).textContent = 'El plazo debe estar entre 1 y 365 días (o vacío para usar el general).'; return; }
    try {
      const g = await datos.guardarCliente(id ? { ...d, id: Number(id) } : d);
      aviso(id ? 'Cliente guardado' : 'Cliente creado'); listaCambio();
      if (e.submitter?.name === 'otro') { await vistaClienteForm(v, null); $('[name="nombre"]', v)?.focus(); return; }  // PC: carga uno tras otro
      ir(`#/clientes/${g.id}`);
    } catch (err) { $('#err', v).textContent = err.message; }
  });
}
