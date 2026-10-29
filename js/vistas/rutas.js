import { $, esc, barra, icono, vacio, leerForm, aviso, ir, DIAS, clp, chipVisita, chipFaltan, hoyChile, ZONA, plural, imgFoto } from '../ui.js';
import { contar } from '../anima.js';
import { actualizarWidget } from '../widget.js';
import { revisarRuta, revisarSemana } from '../logros.js';
import { cintaNovedades } from '../novedades.js';
import { temporada, ADORNO } from '../temporadas.js';
import * as datos from '../datos.js';
import { tieneGps, miUbicacion, leerCoordenadas, coordTxt, BASE_COVECA, optimizar, largoKm } from '../gps.js';

// Día de hoy (1 = lunes), en hora de Chile y calculado cada vez: la app puede quedar abierta de un día para otro.
const diaHoy = () => { const d = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, weekday: 'short' }).format(new Date()); return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(d) + 1; };

// Largo aproximado del recorrido desde la base (km), o null si hay menos de 2 clientes con GPS.
function kmRuta(r, cs) {
  const con = cs.filter(tieneGps);
  if (con.length < 2) return null;
  const base = r.base_lat != null ? { lat: r.base_lat, lng: r.base_lng } : null;
  return largoKm(optimizar(con, base), base);
}

function anillo(hechos, total) {
  const R = 30, L = 2 * Math.PI * R, f = total ? hechos / total : 0;
  return `<svg class="hero-anillo" viewBox="0 0 76 76" role="img" aria-label="${hechos} de ${total} visitados">
    <circle cx="38" cy="38" r="${R}" fill="none" stroke="var(--papel)" stroke-opacity=".22" stroke-width="8"/>
    <circle class="anillo-avance" cx="38" cy="38" r="${R}" fill="none" stroke="var(--papel)" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${(L * f).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 38 38)" style="--largo:${L.toFixed(1)}"/>
    <text x="38" y="38" text-anchor="middle" font-size="17" font-weight="800" fill="var(--papel)">${hechos}/${total}</text>
    <text x="38" y="52" text-anchor="middle" font-size="9.5" fill="var(--papel)" fill-opacity=".85">visitados</text></svg>`;
}

// "Tu semana": ventas de lunes a domingo (cuentan hacia arriba), barra hacia la meta y los días con ventas encendidos.
function tuSemana(s, meta) {
  const pct = meta ? Math.min(100, Math.round((s.total / meta) * 100)) : 0;
  const LETRAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'], NOMBRES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  return `<section class="semana" aria-label="Tu semana">
    <div class="semana-cab"><h2>Tu semana</h2><a class="btn link" href="#/reportes/ventas-semana">Ver ventas</a></div>
    <p class="semana-n monto" id="semana-n">${clp(s.total)}</p>
    <p class="semana-s">${plural(s.notas, 'nota')} de lunes a hoy</p>
    ${meta ? `<div class="semana-barra" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance de la meta"><span style="--w:${pct}%"></span></div>
      <p class="semana-s">${pct} % de la meta de ${clp(meta)}${pct >= 100 ? ' · ¡Meta cumplida!' : ''}</p>` : ''}
    <div class="racha" aria-label="Días con ventas esta semana">${LETRAS.map((l, i) => {
      const si = s.dias.has(i), fut = i > s.hoy;
      return `<span class="racha-dia ${si ? 'si' : fut ? 'fut' : ''}" style="--d:${0.3 + i * 0.12}s" title="${NOMBRES[i]}: ${si ? 'con ventas' : fut ? 'por venir' : 'sin ventas'}">
        <i>${si ? icono('check', 'ico-s') : ''}</i>${l}</span>`; }).join('')}</div>
    <p class="semana-s">${plural(s.dias.size, 'día')} con ventas esta semana</p>
  </section>`;
}

const fechaLarga = () => new Intl.DateTimeFormat('es-CL', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' })
  .format(new Date()).replace(/^./, (x) => x.toUpperCase());

export async function vistaRutas(v) {
  const hoyDia = diaHoy();
  const nombre = (datos.usuario()?.nombre || '').split(' ')[0];
  barra({ titulo: nombre ? `Hola, ${nombre}` : 'Rutas', sub: fechaLarga(), accion: datos.esAdmin() ? { href: '#/rutas/nueva', icono: 'mas', etiqueta: 'Nueva ruta' } : null });
  // Lo que no depende de cuál es la ruta de hoy se pide junto con las rutas.
  const extras = Promise.all([datos.pedidosEntrega().catch(() => []), datos.semanaVentas().catch(() => null), datos.configuracion().catch(() => null),
    datos.clientes().catch(() => [])]);   // todos los clientes activos: se reparten por ruta abajo (una consulta en vez de una por ruta)
  extras.catch(() => {});
  const rs = await datos.rutas();
  if (!rs.length) {
    v.innerHTML = vacio('Aún no hay rutas', 'Crea la primera ruta para ordenar a tus clientes.',
      datos.esAdmin() ? '<a class="btn prin" href="#/rutas/nueva">Crear ruta</a>' : '');
    return;
  }
  const deHoy = rs.filter((r) => r.dia_semana === hoyDia && r.activa !== false);
  // Sin ruta hoy: la tarjeta azul muestra la próxima ruta de la semana (la más cercana en días).
  const faltan = (r) => (r.dia_semana - hoyDia + 7) % 7;
  const proxima = deHoy.length ? null : rs.filter((r) => !r.especial && r.activa !== false && r.dia_semana)
    .sort((a, b) => faltan(a) - faltan(b))[0];
  const destacadas = deHoy.length ? deHoy : proxima ? [proxima] : [];
  const resto = rs.filter((r) => !destacadas.includes(r));
  const [entregas, semana, neg, activos] = await extras;
  const clientesHoy = destacadas.map((r) => activos.filter((c) => String(c.ruta_id) === String(r.id)));
  const tem = temporada(hoyChile());
  // La próxima ruta va sin botones: toda la tarjeta abre sus clientes.
  const etiqueta = (r) => (!proxima ? 'Ruta de hoy' : `Próxima ruta · ${faltan(r) === 1 ? 'mañana' : DIAS[r.dia_semana].toLowerCase()}`);
  const hero = (r, cs) => {
    const ids = new Set(cs.map((c) => String(c.id)));
    const mias = entregas.filter((p) => ids.has(String(p.cliente_id)));
    const porEntregar = mias.filter((p) => !p.entregado_en).length;
    const porCobrar = mias.filter((p) => p.entregado_en && datos.porCobrar(p)).length;
    const hechos = cs.filter((c) => c.atendido).length;
    const km = kmRuta(r, cs);
    return `<section class="hero ${tem ? `hero-${tem.id}` : ''} ${proxima ? 'hero-proxima' : ''}" aria-label="${etiqueta(r)}: ${esc(r.nombre)}">
      ${tem ? ADORNO[tem.id] : ''}
      <div class="hero-cab">
        <div class="hero-txt"><p class="hero-et">${etiqueta(r)}${tem ? ` · ${tem.t}` : ''}</p>
          <h2 class="hero-t">${esc(r.nombre)}</h2>
          <p class="hero-s">${plural(cs.length, 'cliente')}${km ? ` · ${Math.round(km)} km aprox.` : ''}</p></div>
        ${tem ? '' : anillo(hechos, cs.length)}
      </div>
      ${tem ? `<p class="hero-s hero-avance">${hechos} de ${cs.length} visitados${tem.quedan > 0 ? ` · Faltan ${plural(tem.quedan, 'día')} para ${tem.para}` : tem.quedan === 0 ? ` · ¡Hoy es ${tem.para}!` : ''}</p>` : ''}
      ${porEntregar || porCobrar ? `<div class="hero-pills">
        ${porEntregar ? `<a class="hero-pill" href="#/pedidos">${icono('camion', 'ico-s')} ${porEntregar} por entregar</a>` : ''}
        ${porCobrar ? `<a class="hero-pill" href="#/pedidos">${icono('moneda', 'ico-s')} ${porCobrar} por cobrar</a>` : ''}</div>` : ''}
      ${proxima ? `<a class="hero-toque" href="#/rutas/${r.id}" aria-label="Ver clientes de ${esc(r.nombre)}"></a>`
        : `<div class="hero-btns"><a class="hero-btn llena" href="#/rutas/${r.id}">Ver clientes</a>
        ${r.especial ? '' : `<a class="hero-btn borde" href="#/rutas/${r.id}/recorrido">Planificar</a>`}</div>`}
    </section>`;
  };
  const abrev = (r) => r.especial ? icono('clientes') : esc((DIAS[r.dia_semana] || '—').slice(0, 3).toUpperCase());
  const fila = (r) => {
    const avance = r.clientes ? Math.round((r.atendidos / r.clientes) * 100) : 0;
    return `<a class="ruta-fila ${r.activa === false ? 'inactivo' : ''}" href="#/rutas/${r.id}">
      <span class="ruta-dia ${r.especial ? 'especial' : ''}" aria-hidden="true">${abrev(r)}</span>
      <span class="ruta-fila-txt"><b>${esc(r.nombre)}</b>
        <small>${r.especial ? 'Por asignar · ' : r.activa === false ? 'Inactiva · ' : ''}${plural(r.clientes, 'cliente')}${r.clientes ? ` · ${r.clientes - r.atendidos ? `${r.clientes - r.atendidos} por visitar` : 'completa'}` : ''}</small>
        ${r.clientes ? `<span class="barra-avance" role="progressbar" aria-valuenow="${avance}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance del ciclo"><span style="width:${avance}%"></span></span>` : ''}</span>
      ${icono('derecha', 'ico-chev')}</a>`;
  };
  v.innerHTML = `
    ${destacadas.length ? `<div class="heroes">${destacadas.map((r, i) => hero(r, clientesHoy[i])).join('')}</div>`
      : `<div class="hero-vacio"><p><b>Hoy ${DIAS[hoyDia].toLowerCase()} no hay ruta</b></p><p>Elige una ruta de la lista para ver sus clientes.</p></div>`}
    ${proxima ? `<p class="hero-nota">${icono('reloj', 'ico-s')} Hoy ${DIAS[hoyDia].toLowerCase()} no hay ruta asignada.</p>` : ''}
    ${semana ? tuSemana(semana, neg?.meta_semanal) : ''}
    <h2 class="sec-t">${destacadas.length ? 'Otras rutas' : 'Todas las rutas'}</h2>
    <div class="rutas-lista">${resto.map(fila).join('')}</div>`;
  // Widgets de Android: ruta de hoy (la primera), avance, próximos por visitar, lo que falta entregar/cobrar y la semana
  const r0 = deHoy[0], cs0 = clientesHoy[0] || [];
  const porEnt = entregas.filter((p) => !p.entregado_en), porCob = entregas.filter((p) => p.entregado_en && datos.porCobrar(p));
  const suma = (l) => l.reduce((t, p) => t + (Number(p.total) || 0), 0);
  actualizarWidget({ ruta: r0?.nombre || '', hechos: cs0.filter((c) => c.atendido).length, total: cs0.length,
    proximos: JSON.stringify(cs0.filter((c) => !c.atendido).slice(0, 3).map((c) => ({ id: c.id, nombre: c.nombre }))),
    porEntregar: porEnt.length, porCobrar: porCob.length, montoEntregar: suma(porEnt), montoCobrar: suma(porCob),
    ...(semana ? { semTotal: semana.total, semMeta: Number(neg?.meta_semanal) || 0,
      semDias: [0, 1, 2, 3, 4, 5, 6].map((i) => (semana.dias.has(i) ? '1' : i > semana.hoy ? '-' : '0')).join('') } : {}) });
  const n = $('#semana-n', v);
  if (n) contar(n, 0, semana.total, clp, 900);
  // Logros: ruta de hoy completa y meta de la semana (solo se celebran al cumplirse, una vez)
  if (!proxima) deHoy.forEach((r, i) => revisarRuta(r, clientesHoy[i], hoyChile()));
  if (semana) revisarSemana(semana, neg?.meta_semanal);
  cintaNovedades(v);   // "Ahora no" en la ventana de novedades deja este aviso arriba
}

export async function vistaRuta(v, id) {
  // A la vez: la ruta, sus clientes y las deudas a crédito (para cobrar en la visita).
  const [r, cs, fm] = await Promise.all([datos.ruta(id), datos.clientes({ rutaId: id }), datos.fiadoTodos().catch(() => new Map())]);
  if (!r) return ir('#/rutas');
  const deuda = (c) => { const f = fm.get(c.id); return f?.deuda ? ` · <span class="deuda-ruta ${f.atrasado ? 'atrasada' : ''}">Debe ${clp(f.deuda)}${f.atrasado ? ' (atrasado)' : ''}</span>` : ''; };
  barra({ titulo: r.nombre, sub: r.especial ? 'Clientes por asignar' : DIAS[r.dia_semana] || '', atras: '#/rutas',
    accion: datos.esAdmin() && !r.especial ? { href: `#/rutas/${id}/editar`, icono: 'editar', etiqueta: 'Editar ruta' } : null });
  const pend = cs.filter((c) => !c.atendido), hechos = cs.filter((c) => c.atendido);
  if (r.dia_semana === diaHoy() && r.activa !== false && !r.especial) revisarRuta(r, cs, hoyChile());   // logro: ruta de hoy completa
  const fachada = (c) => c.imagen_url ? imgFoto(c.imagen_url, 'fachada')
    : `<span class="fachada sin" aria-hidden="true">${icono('tienda')}</span>`;
  const fila = (c) => `<a class="fila cli-ruta" href="#/clientes/${c.id}">
      ${fachada(c)}
      <div class="fila-txt"><p class="fila-t">${esc(c.nombre)}</p>
        <p class="fila-s">${esc([c.direccion, c.comuna].filter(Boolean).join(', ') || 'Sin dirección')}${deuda(c)}${c.foto_por_subir ? ' · Foto por subir' : ''}</p>
        <div class="fila-chips">${chipVisita(c)}${chipFaltan(c)}${tieneGps(c) ? '' : `<span class="chip sin-gps">${icono('mapa', 'ico-s')} Sin GPS</span>`}</div></div>
      ${icono('derecha', 'ico-chev')}</a>`;
  const conGps = cs.filter(tieneGps).length;
  let ver = sessionStorage.getItem(`coveca-ruta-ver-${id}`) || (pend.length ? 'pend' : 'todos');
  const pintar = () => {
    const lista = ver === 'pend' ? pend : ver === 'hechos' ? hechos : [...pend, ...hechos];
    $('#cli-ruta', v).innerHTML = lista.length ? `<div class="lista">${lista.map(fila).join('')}</div>`
      : `<p class="ayuda pad">${ver === 'pend' ? '¡Todos visitados! Buen trabajo.' : 'Aún no hay clientes visitados.'}</p>`;
    v.querySelectorAll('[data-ver]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.ver === ver)));
  };
  v.innerHTML = cs.length ? `
    <div class="segmento seg-ruta" role="radiogroup" aria-label="Qué clientes ver">
      <button type="button" role="radio" data-ver="pend">Por visitar · ${pend.length}</button>
      <button type="button" role="radio" data-ver="hechos">Visitados · ${hechos.length}</button>
      <button type="button" role="radio" data-ver="todos">Todos · ${cs.length}</button>
    </div>
    <div id="cli-ruta"></div>
    ${r.especial ? '' : `<p class="ayuda pad gps-cuenta">${icono('mapa', 'ico-s')} ${conGps} de ${cs.length} clientes con ubicación GPS${conGps < cs.length ? ' · los que no tienen no entran en el recorrido' : ''}</p>
    <div class="pie-fijo"><a class="btn prin" href="#/rutas/${id}/recorrido">${icono('rutas')} Planificar recorrido</a></div>`}`
    : vacio('Esta ruta no tiene clientes', 'Asígnale clientes desde el perfil de cada cliente (Editar → Ruta).');
  if (!cs.length) return;
  v.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => {
    ver = b.dataset.ver; try { sessionStorage.setItem(`coveca-ruta-ver-${id}`, ver); } catch (_) {} pintar(); }));
  pintar();
}

export async function vistaRutaForm(v, id) {
  const r = id ? await datos.ruta(id) : { activa: true, base_nombre: BASE_COVECA.nombre, base_lat: BASE_COVECA.lat, base_lng: BASE_COVECA.lng };
  barra({ titulo: id ? 'Editar ruta' : 'Nueva ruta', atras: id ? `#/rutas/${id}` : '#/rutas' });
  v.innerHTML = `
    <form id="f" class="form pad" novalidate>
      <label class="campo"><span>Nombre de la ruta</span>
        <input name="nombre" required value="${esc(r.nombre || '')}" placeholder="Ej.: Retiro"></label>
      <label class="campo"><span>Día de visita</span>
        <select name="dia_semana" data-num>
          <option value="">Sin día fijo</option>
          ${DIAS.slice(1).map((d, i) => `<option value="${i + 1}" ${r.dia_semana === i + 1 ? 'selected' : ''}>${d}</option>`).join('')}
        </select></label>
      <label class="campo"><span>Orden en la lista</span>
        <input name="orden" type="number" inputmode="numeric" value="${r.orden ?? ''}" placeholder="1, 2, 3…"></label>
      <label class="check"><input name="activa" type="checkbox" ${r.activa !== false ? 'checked' : ''}> Ruta activa</label>
      <h2 class="sec-t">Base de partida</h2>
      <p class="ayuda">Punto desde donde sale el recorrido (bodega, casa, etc.). Sirve para planificar sin estar en terreno.</p>
      <label class="campo"><span>Nombre de la base</span>
        <input name="base_nombre" value="${esc(r.base_nombre || '')}" placeholder="Ej.: Bodega COVECA"></label>
      <label class="campo"><span>Ubicación (enlace de Google Maps o "latitud, longitud")</span>
        <input id="base-coord" type="text" inputmode="url" value="${r.base_lat != null ? coordTxt({ lat: r.base_lat, lng: r.base_lng }) : ''}" placeholder="-35.97, -72.32"></label>
      <button type="button" id="base-aqui" class="btn sec">Usar mi ubicación actual</button>
      <p id="err" class="error" role="alert"></p>
      <div class="pie-fijo"><button class="btn prin" type="submit">${id ? 'Guardar cambios' : 'Crear ruta'}</button></div>
    </form>`;
  $('#base-aqui', v).addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Obteniendo ubicación…';
    try { const u = await miUbicacion(); $('#base-coord', v).value = coordTxt(u); aviso(`Ubicación tomada (±${u.precision} m). Guarda para confirmar.`); }
    catch (err) { aviso(err.message, 'error'); }
    b.disabled = false; b.textContent = 'Usar mi ubicación actual';
  });
  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = leerForm(e.target);
    if (!d.nombre) { $('#err', v).textContent = 'Escribe un nombre para la ruta.'; return; }
    d.orden = d.orden ?? 0;
    const txt = $('#base-coord', v).value.trim();
    try {
      const b = txt ? leerCoordenadas(txt) : { lat: null, lng: null };
      d.base_lat = b.lat; d.base_lng = b.lng;
    } catch (err) { $('#err', v).textContent = err.message; return; }
    try {
      const g = await datos.guardarRuta(id ? { ...d, id: Number(id) } : d);
      aviso(id ? 'Ruta guardada' : 'Ruta creada');
      ir(`#/rutas/${g.id}`);
    } catch (err) { $('#err', v).textContent = err.message; }
  });
}
