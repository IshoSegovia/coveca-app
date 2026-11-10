// Tickets de soporte (solo administradores; migraciones 0042 y 0047; pedidos del 19 y 21-10-2026).
// Un administrador reporta un error o una idea con descripción, preguntas rápidas, hasta 3 fotos, 1 video de hasta 30 s y
// hasta 6 capturas de las últimas pantallas (capturas.js); la app agrega sola los datos del equipo (diagnostico.js) y
// avisa a soporte por WhatsApp. Estados: Nuevo → En revisión → Resuelto (con etiqueta, qué pasó, qué hacer si vuelve
// a pasar y versión). Los resueltos forman la base de conocimiento (pestaña Resueltos, con buscador y etiquetas).
// El video y las capturas se borran 7 días después de resolver (datos.limpiarVideosTickets); las fotos quedan.
import { $, esc, barra, icono, vacio, aviso, ir, fechaHora, horaChile, fecha, plural, normal, leerAjuste, guardarAjuste, verFoto } from '../ui.js';
import * as datos from '../datos.js';
import { prepararFotoTicket } from '../fotos.js';
import { prepararVideo, MAX_SEG } from '../video.js';
import { ultimasPantallas } from '../registro.js';
import { capturasGuardadas } from '../capturas.js';
import { datosEquipo } from '../diagnostico.js';
import { versionLocal } from '../actualizacion.js';
import { faltaActualizar } from '../avisos-tickets.js';
import { esApp } from '../nativo.js';
import { abrirExterno } from '../externo.js';
import { campoTel, telWhatsApp } from '../campos.js';

const WEB = 'https://ishosegovia.github.io/coveca-app/';
const MAX_FOTOS = 3, MAX_CAPTURAS = 6;
const TIPOS = {
  error: { t: 'Error', s: 'Algo no funciona o funciona mal', ico: 'alerta' },
  mejora: { t: 'Mejora', s: 'Una idea o algo que falta en la app', ico: 'chispa' },
};
const URGENCIAS = {
  bloquea: { t: 'Bloquea la venta', s: 'No puedo vender, imprimir, entregar o cobrar', chip: 'stock-sin' },
  molesta: { t: 'Molesta', s: 'Se puede seguir trabajando, pero cuesta', chip: 'stock-bajo' },
  espera: { t: 'Puede esperar', s: 'Cuando haya tiempo', chip: '' },
};
const ESTADOS = {
  nuevo: { t: 'Nuevo', chip: 'alerta', ico: 'alerta' },
  revision: { t: 'En revisión', chip: 'visita-sin', ico: 'reloj' },
  confirmar: { t: 'Por confirmar', chip: 'stock-bajo', ico: 'check' },   // error arreglado, esperando que quien lo reportó lo pruebe (0053)
  resuelto: { t: 'Resuelto', chip: 'ok', ico: 'check' },
};
// Etiquetas de la base de conocimiento (migración 0047).
const ETIQUETAS = {
  impresora: { t: 'Impresora', ico: 'impresora' }, sin_senal: { t: 'Sin señal', ico: 'nube' }, pedido: { t: 'Pedido', ico: 'nota' },
  entrega_cobro: { t: 'Entrega y cobro', ico: 'camion' }, credito: { t: 'Crédito', ico: 'moneda' },
  proveedores: { t: 'Proveedores', ico: 'proveedores' }, otro: { t: 'Otro', ico: 'lista' },
};
// Preguntas rápidas al reportar un error.
const FRECUENCIAS = { siempre: 'Siempre', a_veces: 'A veces', una_vez: 'Fue una vez' };
const DESDE = { hoy: 'Hoy', semana: 'Esta semana', actualizacion: 'Desde que se actualizó la app', no_se: 'No sé' };

const chipEstado = (e) => `<span class="chip ${ESTADOS[e]?.chip || ''}">${icono(ESTADOS[e]?.ico || 'alerta', 'ico-s')} ${ESTADOS[e]?.t || esc(e)}</span>`;
const chipUrgencia = (u) => `<span class="chip ${URGENCIAS[u]?.chip || ''}">${URGENCIAS[u]?.t || esc(u)}</span>`;
const chipTipo = (t) => `<span class="chip">${icono(TIPOS[t]?.ico || 'alerta', 'ico-s')} ${TIPOS[t]?.t || esc(t)}</span>`;
// Ticket propio con un cambio de estado que la persona aún no ve (migración 0049).
const esNovedad = (t) => !!t.aviso_estado && t.usuario_id === datos.usuario()?.id;
const chipNovedad = (t) => (esNovedad(t) ? `<span class="chip alerta t-novedad">${icono('chispa', 'ico-s')} Novedad</span>` : '');
const chipEtiqueta = (e) => (ETIQUETAS[e] ? `<span class="chip">${icono(ETIQUETAS[e].ico, 'ico-s')} ${ETIQUETAS[e].t}</span>` : '');
const soloAdmin = (v, atras = '#/soporte') => {
  barra({ titulo: 'Tickets de soporte', atras });
  v.innerHTML = vacio('Solo para administradores', 'Los tickets de soporte los envía un administrador.');
};
const query = () => new URLSearchParams(location.hash.split('?')[1] || '');

// Nombre de la sección donde estaba la persona antes de abrir el ticket (por la dirección de la pantalla).
const SECCIONES = [
  [/^#\/rutas\/[^/]+\/recorrido/, 'Planificar recorrido'], [/^#\/rutas\/./, 'Ruta (clientes de la ruta)'], [/^#\/rutas/, 'Inicio (ruta de hoy)'],
  [/^#\/clientes\/\d+\/pedido/, 'Pedido'], [/^#\/clientes\/./, 'Ficha del cliente'], [/^#\/clientes/, 'Clientes'], [/^#\/nuevo/, 'Pedido'],
  [/^#\/pedidos\/./, 'Nota de venta'], [/^#\/pedidos/, 'Pedidos (entregas y cobros)'],
  [/^#\/compras/, 'Compras a proveedores'], [/^#\/(proveedores|pedidos-proveedor)/, 'Proveedores y pedidos a proveedores'],
  [/^#\/inventario/, 'Inventario'], [/^#\/reportes/, 'Reportes'], [/^#\/lealtad/, 'Programa de lealtad'], [/^#\/(ajustes|negocio|fiado|pendientes|revisiones)/, 'Ajustes'],
];
const NOMBRES_SECCION = [...new Set(SECCIONES.map(([, n]) => n)), 'Impresión', 'Otra / no sé'];
const seccionDe = (h) => SECCIONES.find(([re]) => re.test(h || ''))?.[1] || 'Otra / no sé';
// Nombre corto de la pantalla de una captura (sin el texto entre paréntesis).
const nombreCaptura = (h = '') => { const [base, paso] = h.split(' · '); return paso || seccionDe(base).replace(/\s*\(.*\)$/, ''); };

const contar = (adj, tipo) => adj.filter((a) => a.tipo === tipo).length;
const textoAdjuntos = (adj = []) => {
  const f = contar(adj, 'foto'), c = contar(adj, 'captura'), vid = adj.find((a) => a.tipo === 'video');
  const partes = [f ? plural(f, 'foto') : '', c ? plural(c, 'captura') : '', vid ? `1 video${vid.segundos ? ` (${Math.round(vid.segundos)} s)` : ''}` : ''].filter(Boolean);
  return partes.length ? partes.join(', ').replace(/, ([^,]*)$/, ' y $1') : 'sin adjuntos';
};
function mensajeWhatsApp(t) {
  const preg = [t.frecuencia ? FRECUENCIAS[t.frecuencia] : null, t.desde ? `desde: ${DESDE[t.desde]?.toLowerCase()}` : null].filter(Boolean).join(' · ');
  return [`*Ticket N° ${t.numero}* · ${TIPOS[t.tipo]?.t} · ${URGENCIAS[t.urgencia]?.t}`,
    `${t.autor || datos.usuario()?.nombre || ''} · ${fechaHora(t.creado_en)}`,
    t.pantalla ? `Dónde: ${t.pantalla}` : null,
    preg ? `Pasa: ${preg}` : null,
    '', t.descripcion,
    t.esperaba ? `Esperaba: ${t.esperaba}` : null, '',
    ...(t.estado === 'revision' && t.fallas?.length ? [`*Sigue fallando*${t.fallas.at(-1).version ? ` (con la versión ${t.fallas.at(-1).version})` : ''}: ${t.fallas.at(-1).nota}`, ''] : []),
    `Adjuntos: ${textoAdjuntos(t.adjuntos)}`,
    t.equipo?.version ? `Versión ${t.equipo.version} · ${t.equipo.plataforma || ''}` : null,
    `Ver en la app: ${WEB}#/tickets/${t.id}`].filter((x) => x !== null).join('\n');
}
async function avisarWhatsApp(t) {
  let num = '';
  try { num = telWhatsApp((await datos.soporte()).whatsapp || ''); } catch (_) { /* sin número: WhatsApp pide el contacto */ }
  await abrirExterno(`https://wa.me/${num}?text=${encodeURIComponent(mensajeWhatsApp(t))}`);
}

// ---------------- Lista y base de conocimiento ----------------
let filtro = 'abiertos', busqueda = '', etiquetaSel = '';
export async function vistaTickets(v) {
  if (!datos.esAdmin()) return soloAdmin(v);
  barra({ titulo: 'Tickets de soporte', atras: '#/soporte' });
  datos.limpiarVideosTickets().catch(() => {});
  const [ts, sop] = await Promise.all([datos.tickets(), datos.soporte().catch(() => ({}))]);
  const abiertos = ts.filter((t) => t.estado !== 'resuelto'), resueltos = ts.filter((t) => t.estado === 'resuelto');
  const textoBusqueda = (t) => normal([t.numero, t.descripcion, t.causa, t.solucion, t.respuesta, t.pantalla, ETIQUETAS[t.etiqueta]?.t].filter(Boolean).join(' '));
  const listaVisible = () => {
    if (filtro === 'abiertos') return abiertos;
    if (filtro === 'todos') return ts;
    const q = normal(busqueda).trim().split(/\s+/).filter(Boolean);
    return resueltos.filter((t) => (!etiquetaSel || t.etiqueta === etiquetaSel) && q.every((p) => textoBusqueda(t).includes(p)));
  };
  const pintarLista = () => {
    const lista = listaVisible(), caja = $('#t-lista', v);
    caja.innerHTML = lista.length ? `<div class="lista">${lista.map(filtro === 'resueltos' ? filaResuelto : filaTicket).join('')}</div>`
      : filtro === 'resueltos' && (busqueda || etiquetaSel) ? vacio('No hay tickets resueltos con eso', 'Prueba con otras palabras o con otra etiqueta.')
      : vacio(filtro === 'resueltos' ? 'Aún no hay tickets resueltos' : filtro === 'abiertos' ? 'No hay tickets abiertos' : 'Aún no hay tickets',
        filtro === 'resueltos' ? 'Aquí quedará cada problema resuelto y qué hacer si vuelve a pasar.' : 'Si algo falla o se te ocurre una mejora, toca "Nuevo ticket".');
  };
  const pintar = () => {
    const usadas = Object.keys(ETIQUETAS).filter((k) => resueltos.some((t) => t.etiqueta === k));
    v.innerHTML = `
      <p class="ayuda pad mt">${filtro === 'resueltos' ? 'Antes de reportar, busca aquí si ya pasó y qué hacer.'
        : 'Reporta aquí los errores que encuentres o las ideas para mejorar la app. Llegan a soporte por WhatsApp con los datos del equipo.'}</p>
      <div class="filtros" role="tablist">
        <button class="filtro" data-f="abiertos" role="tab" aria-selected="${filtro === 'abiertos'}">Abiertos <span class="n">${abiertos.length}</span></button>
        <button class="filtro" data-f="resueltos" role="tab" aria-selected="${filtro === 'resueltos'}">Resueltos <span class="n">${resueltos.length}</span></button>
        <button class="filtro" data-f="todos" role="tab" aria-selected="${filtro === 'todos'}">Todos <span class="n">${ts.length}</span></button>
      </div>
      ${filtro === 'resueltos' && resueltos.length ? `<div class="pad t-buscar">
        <div class="buscador">${icono('buscar')}<input id="t-q" type="search" placeholder="Buscar: impresora, cortada, entrega…" value="${esc(busqueda)}" aria-label="Buscar en tickets resueltos" autocomplete="off"></div>
        ${usadas.length ? `<div class="filtros t-etiquetas" role="group" aria-label="Filtrar por etiqueta">
          <button type="button" class="filtro" data-e="" aria-pressed="${!etiquetaSel}">Todas</button>
          ${usadas.map((k) => `<button type="button" class="filtro" data-e="${k}" aria-pressed="${etiquetaSel === k}">${icono(ETIQUETAS[k].ico, 'ico-s')} ${ETIQUETAS[k].t}</button>`).join('')}
        </div>` : ''}</div>` : ''}
      <div id="t-lista"></div>
      <details class="elegir-caja ticket-sop" ${sop.whatsapp ? '' : 'open'}>
        <summary><span>WhatsApp que recibe los tickets: ${sop.whatsapp ? esc(sop.whatsapp) : 'sin número'}</span></summary>
        <form id="form-sop" class="form">
          ${campoTel('whatsapp', 'WhatsApp de soporte', sop.whatsapp || '')}
          <button class="btn sec" type="submit">Guardar número</button>
          <p class="ayuda">Sin número, al enviar un ticket se abre WhatsApp para que elijas el contacto.</p>
        </form>
      </details>
      <div class="pie-fijo"><a class="btn prin" href="#/tickets/nuevo">${icono('mas')} Nuevo ticket</a></div>`;
    pintarLista();
    v.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.f; pintar(); }));
    v.querySelectorAll('[data-e]').forEach((b) => b.addEventListener('click', () => {
      etiquetaSel = b.dataset.e;
      v.querySelectorAll('[data-e]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.e === etiquetaSel)));
      pintarLista();
    }));
    $('#t-q', v)?.addEventListener('input', (e) => { busqueda = e.target.value; pintarLista(); });
    $('#form-sop', v).addEventListener('submit', async (e) => {
      e.preventDefault();
      const n = e.target.querySelector('input[name="whatsapp"]').value.trim();
      try { await datos.guardarSoporte({ ...sop, whatsapp: n || null }); sop.whatsapp = n || null; aviso(n ? 'Número guardado' : 'Número borrado'); pintar(); }
      catch (x) { aviso(x.message, 'error'); }
    });
  };
  pintar();
}
const recortar = (s, n) => (s.length > n ? s.slice(0, n - 2).trimEnd() + '…' : s);
const filaTicket = (t) => {
  const n = (t.adjuntos || []).length;
  return `<a class="fila ticket-fila" href="#/tickets/${esc(t.id)}">
    <span class="avatar ticket-av ${t.tipo}" aria-hidden="true">${icono(TIPOS[t.tipo]?.ico || 'alerta')}</span>
    <div class="fila-txt"><p class="fila-t">${esc(recortar(t.descripcion, 70))}</p>
      <p class="fila-s">N° ${t.numero} · ${URGENCIAS[t.urgencia]?.t || ''} · ${esc(fechaHora(t.creado_en))}${t.autor ? ' · ' + esc(t.autor) : ''}${n ? ` · ${icono('camara', 'ico-s')} ${n}` : ''}</p>
      <p class="ticket-chips">${chipNovedad(t)}${chipEstado(t.estado)}</p></div>
    ${icono('derecha', 'ico-chev')}</a>`;
};
// En la base de conocimiento lo que importa es qué pasó y qué hacer: va en la fila.
const filaResuelto = (t) => {
  const que = t.solucion || t.causa || t.respuesta || '';
  return `<a class="fila ticket-fila" href="#/tickets/${esc(t.id)}">
    <span class="avatar ticket-av ${t.tipo}" aria-hidden="true">${icono(ETIQUETAS[t.etiqueta]?.ico || TIPOS[t.tipo]?.ico || 'alerta')}</span>
    <div class="fila-txt"><p class="fila-t">${esc(recortar(t.descripcion, 70))}</p>
      ${que ? `<p class="fila-s t-solucion">${t.solucion ? 'Qué hacer: ' : ''}${esc(recortar(que, 110))}</p>` : ''}
      <p class="fila-s">N° ${t.numero} · resuelto ${esc(fecha(t.resuelto_en))}${t.version_arreglo ? ` · versión ${esc(t.version_arreglo)}` : ''}</p>
      ${t.etiqueta || esNovedad(t) ? `<p class="ticket-chips">${chipNovedad(t)}${chipEtiqueta(t.etiqueta)}</p>` : ''}</div>
    ${icono('derecha', 'ico-chev')}</a>`;
};

// ---------------- Nuevo ticket ----------------
const K_BORRADOR = 'coveca-ticket-borrador';
const opcionesPreg = (nombre, opciones, actual) => Object.entries(opciones).map(([k, t]) =>
  `<label class="t-preg-op"><input type="radio" name="${nombre}" value="${k}" ${actual === k ? 'checked' : ''}><span>${t}</span></label>`).join('');
// Lista "Datos que se agregan solos": dice qué tipo de datos van, sin mostrar los valores (decisión del
// 21-10-2026: lo técnico se guarda completo y llega a Notion, pero en la app no se muestra).
const RESUMEN_EQUIPO = ['Versión de la app y modelo del celular', 'Señal y lo que falta subir', 'Hora del celular', 'Impresora y última impresión',
  'Tus últimas acciones en la app (sin lo que escribiste)', 'Errores técnicos recientes de la app'];
// Cabe en lo que acepta el servidor (60.000 letras): si se pasa, se acortan los errores y el rastro.
function ajustarEquipo(eq) {
  if (JSON.stringify(eq).length < 55000) return eq;
  return { ...eq, errores: eq.errores.slice(-5).map((x) => ({ ...x, m: x.m.slice(0, 400) })), rastro: eq.rastro.slice(-15) };
}

export async function vistaTicketNuevo(v) {
  if (!datos.esAdmin()) return soloAdmin(v, '#/tickets');
  barra({ titulo: 'Nuevo ticket', atras: '#/tickets' });
  let b = {}; try { b = JSON.parse(leerAjuste(K_BORRADOR, '{}')) || {}; } catch (_) { b = {}; }
  // A los tickets se entra por Ajustes: lo que interesa es la pantalla de antes (desde donde se tocó el engranaje).
  const previa = ultimasPantallas().filter((x) => !/^#\/(ajustes|soporte)$/.test(x.h)).slice(-1)[0]?.h;
  const pantalla = b.pantalla || seccionDe(previa);
  const fotos = [];      // { blob, url }
  let video = null;      // { url, segundos, listo: { blob, ext, segundos } | null, error }
  const subidos = new Map();   // adjunto → ruta ya subida (reintentar no vuelve a subir)
  const id = crypto.randomUUID();
  // Capturas automáticas de las últimas pantallas (hasta 10 en el equipo): vienen marcadas las 6 más recientes.
  const capturas = (await capturasGuardadas()).map((c, i) => ({ ...c, url: URL.createObjectURL(c.blob), elegida: i < MAX_CAPTURAS }));
  const tipoInicial = b.tipo || 'error';

  v.innerHTML = `
    <form id="form-ticket" class="form pad">
      <fieldset class="opciones"><legend>¿Qué quieres reportar?</legend>
        ${Object.entries(TIPOS).map(([k, x]) => `<label class="opcion"><input type="radio" name="tipo" value="${k}" ${tipoInicial === k ? 'checked' : ''}>
          <span class="opcion-txt">${x.t}<small>${x.s}</small></span></label>`).join('')}
      </fieldset>
      <fieldset class="opciones"><legend>¿Qué tan urgente es?</legend>
        ${Object.entries(URGENCIAS).map(([k, x]) => `<label class="opcion"><input type="radio" name="urgencia" value="${k}" ${(b.urgencia || 'molesta') === k ? 'checked' : ''}>
          <span class="opcion-txt">${x.t}<small>${x.s}</small></span></label>`).join('')}
      </fieldset>
      <label class="campo"><span>¿Dónde pasó?</span>
        <select name="pantalla">${NOMBRES_SECCION.map((n) => `<option ${n === pantalla ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="campo"><span>Descripción</span>
        <textarea name="descripcion" rows="5" maxlength="4000" required placeholder="Qué estabas haciendo y qué pasó. Ej.: edité la nota 214 y al imprimir salió &quot;No se pudo conectar&quot;.">${esc(b.descripcion || '')}</textarea></label>
      <div id="t-preguntas" class="t-preguntas" ${tipoInicial === 'error' ? '' : 'hidden'}>
        <fieldset class="t-preg"><legend>¿Pasa siempre o a veces?</legend><div class="t-preg-ops">${opcionesPreg('frecuencia', FRECUENCIAS, b.frecuencia)}</div></fieldset>
        <fieldset class="t-preg"><legend>¿Desde cuándo?</legend><div class="t-preg-ops">${opcionesPreg('desde', DESDE, b.desde)}</div></fieldset>
        <label class="campo"><span>¿Qué esperabas que pasara? (opcional)</span>
          <input name="esperaba" maxlength="300" value="${esc(b.esperaba || '')}" placeholder="Ej.: que saliera la nota impresa" autocomplete="off"></label>
      </div>
      ${capturas.length ? `<h2 class="sec-t">Últimas pantallas</h2>
        <p class="ayuda">Van las últimas pantallas que abriste. Quita las que no tengan que ver con el problema. Se borran 7 días después de resolver el ticket.</p>
        <p class="t-cap-cuenta" id="t-cap-cuenta" aria-live="polite"></p>
        <div class="t-capturas" id="t-capturas">${capturas.map((c, i) => `<div class="t-cap">
          <label class="t-cap-elegir"><img src="${esc(c.url)}" alt="Pantalla ${esc(nombreCaptura(c.h))}" loading="lazy">
            <span class="t-cap-pie"><input type="checkbox" data-cap="${i}" ${c.elegida ? 'checked' : ''}><span class="t-cap-txt">${esc(nombreCaptura(c.h))}<small>${esc(horaChile(c.t))}</small></span></span></label>
          <button type="button" class="btn link t-cap-ver" data-ver-cap="${i}">Ver</button></div>`).join('')}</div>` : ''}
      <h2 class="sec-t">Fotos y video (opcional)</h2>
      <p class="ayuda">Hasta ${MAX_FOTOS} fotos (los pantallazos sirven) y 1 video de hasta ${MAX_SEG} segundos. Para mostrar la pantalla, grábala con la grabación de pantalla del celular y elígela en "Video de galería".</p>
      <div id="adjuntos"></div>
      <details class="elegir-caja"><summary><span>Datos que se agregan solos</span></summary>
        <ul class="act-nov" id="lista-equipo">${RESUMEN_EQUIPO.map((x) => `<li>${x}</li>`).join('')}</ul>
        <p class="ayuda mt">No va lo que escribes en los campos. Las capturas que elijas sí muestran tus pantallas, con datos de clientes.</p></details>
      <p class="error" id="err-ticket" role="alert"></p>
      <div class="pie-fijo"><button class="btn prin" type="submit" id="enviar">${icono('whatsapp')} Enviar ticket</button></div>
    </form>`;
  const f = $('#form-ticket', v), err = $('#err-ticket', v), btn = $('#enviar', v);

  const guardarBorrador = () => {
    const d = new FormData(f);
    guardarAjuste(K_BORRADOR, JSON.stringify({ tipo: d.get('tipo'), urgencia: d.get('urgencia'), pantalla: d.get('pantalla'), descripcion: d.get('descripcion'),
      frecuencia: d.get('frecuencia'), desde: d.get('desde'), esperaba: d.get('esperaba') }));
  };
  f.addEventListener('input', guardarBorrador);
  f.addEventListener('change', (e) => {
    if (e.target.name === 'tipo') $('#t-preguntas', v).hidden = e.target.value !== 'error';
    if (!e.target.matches('input[type="file"], [data-cap]')) guardarBorrador();
  });

  // Capturas: elegir hasta 6.
  const contarCapturas = () => {
    const n = capturas.filter((c) => c.elegida).length, el = $('#t-cap-cuenta', v);
    if (el) el.textContent = n ? `${plural(n, 'captura elegida', 'capturas elegidas')} de ${MAX_CAPTURAS}` : 'Ninguna captura elegida: el ticket va sin pantallas.';
  };
  contarCapturas();
  $('#t-capturas', v)?.addEventListener('change', (e) => {
    const c = capturas[Number(e.target.dataset.cap)]; if (!c) return;
    if (e.target.checked && capturas.filter((x) => x.elegida).length >= MAX_CAPTURAS) {
      e.target.checked = false;
      err.textContent = `Puedes enviar hasta ${MAX_CAPTURAS} capturas. Quita una antes de marcar otra.`;
      return;
    }
    err.textContent = '';
    c.elegida = e.target.checked; contarCapturas();
  });
  $('#t-capturas', v)?.addEventListener('click', (e) => {
    const b2 = e.target.closest('[data-ver-cap]'); if (!b2) return;
    const c = capturas[Number(b2.dataset.verCap)];
    verFoto(c.url, `${nombreCaptura(c.h)} · ${horaChile(c.t)}`);
  });

  const preparando = () => video && !video.listo && !video.error;
  const pintarAdjuntos = () => {
    $('#adjuntos', v).innerHTML = `
      ${fotos.length ? `<div class="compra-fotos ticket-fotos">${fotos.map((x, i) => `<div class="compra-foto">
        <button type="button" class="compra-foto-ver" data-ver="${i}" aria-label="Ver foto ${i + 1}"><img src="${esc(x.url)}" alt=""></button>
        <button type="button" class="btn link quitar-foto" data-quitar="${i}" aria-label="Quitar foto ${i + 1}">Quitar</button></div>`).join('')}</div>` : ''}
      ${fotos.length < MAX_FOTOS ? `<div class="fila-botones compra-foto-btns">
        <label class="btn sec">${icono('camara')} Tomar foto<input class="t-foto" type="file" accept="image/*" capture="environment" hidden></label>
        <label class="btn sec">${icono('cuadricula')} Galería<input class="t-foto" type="file" accept="image/*" hidden></label></div>` : ''}
      ${video ? `<div class="ticket-video-caja">
        ${video.error ? `<p class="error">${esc(video.error)}</p>`
          : video.listo ? `<video class="ticket-video" src="${esc(video.url)}" controls playsinline preload="metadata"></video>
            <p class="ayuda">Video de ${Math.round(video.listo.segundos)} s · ${(video.listo.blob.size / 1048576).toFixed(1).replace('.', ',')} MB listo para enviar.</p>`
          : `<p class="fila-t">Preparando el video… <span id="v-pct">0 %</span></p>
            <div class="barra-progreso" aria-hidden="true"><span id="v-barra"></span></div>
            <p class="ayuda">Se achica para que suba rápido. No cierres esta pantalla (tarda lo mismo que dura el video).</p>`}
        <button type="button" class="btn link quitar-video" id="quitar-video">Quitar video</button></div>`
      : `<div class="fila-botones compra-foto-btns">
        <label class="btn sec">${icono('camara')} Grabar video<input class="t-video" type="file" accept="video/*" capture="environment" hidden></label>
        <label class="btn sec">${icono('cuadricula')} Video de galería<input class="t-video" type="file" accept="video/*" hidden></label></div>`}`;
    btn.disabled = preparando();
  };
  pintarAdjuntos();

  $('#adjuntos', v).addEventListener('change', async (e) => {
    const archivo = e.target.files?.[0]; if (!archivo) return;
    err.textContent = '';
    if (e.target.classList.contains('t-foto')) {
      try { const blob = await prepararFotoTicket(archivo); fotos.push({ blob, url: URL.createObjectURL(blob) }); }
      catch (x) { err.textContent = x.message; }
      pintarAdjuntos();
      return;
    }
    if (!e.target.classList.contains('t-video')) return;
    const este = { url: URL.createObjectURL(archivo), listo: null, error: null };
    video = este; pintarAdjuntos();
    try {
      este.listo = await prepararVideo(archivo, (p) => {
        if (video !== este) return;
        const pct = `${Math.round(p * 100)} %`;
        const t = $('#v-pct', v), br = $('#v-barra', v);
        if (t) t.textContent = pct; if (br) br.style.width = pct;
      });
      if (este.listo.blob !== archivo) { URL.revokeObjectURL(este.url); este.url = URL.createObjectURL(este.listo.blob); }
    } catch (x) { este.error = x.message; }
    if (video === este) pintarAdjuntos();
  });
  $('#adjuntos', v).addEventListener('click', (e) => {
    const ver = e.target.closest('[data-ver]');
    if (ver) { verFoto(fotos[Number(ver.dataset.ver)].url, 'Foto del ticket'); return; }
    const q = e.target.closest('[data-quitar]');
    if (q) { const [x] = fotos.splice(Number(q.dataset.quitar), 1); URL.revokeObjectURL(x.url); subidos.delete(x); pintarAdjuntos(); return; }
    if (e.target.closest('#quitar-video')) { URL.revokeObjectURL(video.url); subidos.delete(video); video = null; pintarAdjuntos(); }
  });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const d = new FormData(f);
    const descripcion = String(d.get('descripcion') || '').trim();
    if (descripcion.length < 5) { err.textContent = 'Cuenta qué pasó en la descripción (al menos unas palabras).'; f.descripcion.focus(); return; }
    if (preparando()) { err.textContent = 'Espera a que el video termine de prepararse.'; return; }
    if (video?.error) { err.textContent = 'Quita el video que no se pudo preparar, o elige otro.'; return; }
    btn.disabled = true;
    const estado = (t) => { btn.textContent = t; };
    try {
      estado('Revisando el equipo…');
      const equipo = ajustarEquipo(await datosEquipo());
      const adjuntos = [];
      const elegidas = capturas.filter((c) => c.elegida);
      const total = fotos.length + elegidas.length + (video ? 1 : 0);
      let paso = 0;
      const subir = async (x, blob, ext) => {
        paso++;
        if (!subidos.has(x)) subidos.set(x, await datos.subirAdjuntoTicket(id, blob, ext, (p) => estado(`Subiendo ${paso} de ${total}… ${Math.round(p * 100)} %`)));
        return subidos.get(x);
      };
      for (const x of fotos) adjuntos.push({ ruta: await subir(x, x.blob, 'jpg'), tipo: 'foto', bytes: x.blob.size });
      for (const c of elegidas) adjuntos.push({ ruta: await subir(c, c.blob, 'jpg'), tipo: 'captura', bytes: c.blob.size, pantalla: c.h, tomada: new Date(c.t).toISOString() });
      if (video) adjuntos.push({ ruta: await subir(video, video.listo.blob, video.listo.ext), tipo: 'video', bytes: video.listo.blob.size, segundos: Math.round(video.listo.segundos * 10) / 10 });
      estado('Guardando…');
      const esError = d.get('tipo') === 'error';
      const t = await datos.crearTicket({ id, tipo: d.get('tipo'), urgencia: d.get('urgencia'), pantalla: d.get('pantalla'), descripcion,
        frecuencia: esError ? d.get('frecuencia') : null, desde: esError ? d.get('desde') : null, esperaba: esError ? String(d.get('esperaba') || '').trim() || null : null,
        adjuntos, equipo });
      try { localStorage.removeItem(K_BORRADOR); } catch (_) { /* nada */ }
      capturas.forEach((c) => URL.revokeObjectURL(c.url));
      aviso(`Ticket N° ${t.numero} enviado`);
      ir(`#/tickets/${t.id}${esApp ? '' : '?nuevo=1'}`);
      // En la app se abre WhatsApp de inmediato; en la web el navegador lo bloquearía, así que el detalle ofrece el botón.
      if (esApp) avisarWhatsApp({ ...t, autor: t.autor || datos.usuario()?.nombre }).catch(() => {});
    } catch (x) {
      err.textContent = x.message;
      btn.disabled = false; btn.innerHTML = `${icono('whatsapp')} Reintentar envío`;
    }
  });
}

// ---------------- Detalle ----------------

export async function vistaTicket(v, id) {
  if (!datos.esAdmin()) return soloAdmin(v, '#/tickets');
  const t = await datos.ticket(id);
  if (esNovedad(t)) datos.avisoTicketVisto(t.id).catch(() => {});   // abrirlo cuenta como visto el aviso
  barra({ titulo: `Ticket N° ${t.numero}`, sub: TIPOS[t.tipo]?.t, atras: '#/tickets' });
  const adj = t.adjuntos || [];
  const urls = await datos.urlsAdjuntosTicket(adj.map((a) => a.ruta)).catch(() => adj.map(() => null));
  const conUrl = adj.map((a, i) => ({ ...a, url: urls[i] }));
  const fotosT = conUrl.filter((a) => a.tipo === 'foto');
  const capsT = conUrl.filter((a) => a.tipo === 'captura');
  const vid = conUrl.find((a) => a.tipo === 'video');
  const recien = query().get('nuevo') === '1' || query().get('falla') === '1';
  const abierto = t.estado !== 'resuelto';
  // "Por confirmar" (migración 0053): quien lo reportó responde aquí; otro administrador puede darlo por resuelto.
  const porConfirmar = t.estado === 'confirmar', mio = t.usuario_id === datos.usuario()?.id;
  const CIERRES = { confirmado: 'confirmado por quien lo reportó', sin_respuesta: 'sin respuesta de quien lo reportó', forzado: 'sin esperar la confirmación' };
  const borraEl = t.resuelto_en ? fecha(new Date(Date.parse(t.resuelto_en) + 7 * 864e5).toISOString()) : null;
  const eq = t.equipo || {};
  const filaEq = (k, x) => (x == null || x === '' ? '' : `<div class="dato"><dt>${k}</dt><dd>${esc(x)}</dd></div>`);
  const solucion = t.causa || t.solucion;
  const v0 = versionLocal();

  v.innerHTML = `
    <div class="ticket-cab">${chipEstado(t.estado)}${chipTipo(t.tipo)}${chipUrgencia(t.urgencia)}${chipEtiqueta(t.etiqueta)}</div>
    <p class="ticket-desc">${esc(t.descripcion)}</p>
    ${solucion ? `<div class="ticket-resp t-sol">
      ${t.causa ? `<p class="fila-t">${t.tipo === 'mejora' ? 'Qué se hizo' : 'Qué pasó'}</p><p>${esc(t.causa)}</p>` : ''}
      ${t.solucion ? `<p class="fila-t">Qué hacer si vuelve a pasar</p><p>${esc(t.solucion)}</p>` : ''}
      ${t.version_arreglo ? `<p class="ayuda">${t.tipo === 'mejora' ? 'Disponible desde' : 'Arreglado en'} la versión ${esc(t.version_arreglo)}.</p>` : ''}</div>` : ''}
    ${porConfirmar && mio && faltaActualizar(t.version_arreglo) ? `<div class="t-confirmar"><p class="fila-t">¿Se solucionó?</p>
        <p>El arreglo viene en la versión ${esc(t.version_arreglo)}. <b>Actualiza la app</b> para probarlo; después podrás confirmar aquí.</p></div>`
    : porConfirmar ? (mio ? `<div class="t-confirmar"><p class="fila-t">¿Se solucionó?</p>
        <p>Pruébalo${t.version_arreglo ? ` con la versión ${esc(t.version_arreglo)}` : ''} y cuéntanos si quedó bien.</p>
        <div class="ac-botones"><button type="button" class="btn prin" id="t-funciona">${icono('check')} Sí, funciona</button>
          <button type="button" class="btn sec" id="t-falla">Sigue fallando</button></div>
        <form id="form-falla" class="form" hidden><label class="campo"><span>¿Qué sigue pasando?</span>
          <textarea name="nota" rows="3" maxlength="1000" placeholder="Ej.: la nota sigue saliendo cortada al final."></textarea></label>
          <p class="error" id="err-falla" role="alert"></p><div class="ac-botones"><button type="button" class="btn sec" id="falla-volver">Volver</button><button type="submit" class="btn sec">Enviar</button></div></form></div>`
      : `<p class="ayuda pad">Arreglado. Falta que quien lo reportó lo pruebe y confirme en su app.</p>`) : ''}
    ${t.respuesta ? `<div class="ticket-resp"><p class="fila-t">Respuesta</p><p>${esc(t.respuesta)}</p></div>` : ''}
    <dl class="datos">
      ${filaEq('Dónde pasó', t.pantalla)}
      ${filaEq('Pasa', t.frecuencia ? FRECUENCIAS[t.frecuencia] : null)}
      ${filaEq('Desde cuándo', t.desde ? DESDE[t.desde] : null)}
      ${filaEq('Esperaba', t.esperaba)}
      <div class="dato"><dt>Enviado</dt><dd>${esc(fechaHora(t.creado_en))}${t.autor ? ' · ' + esc(t.autor) : ''}</dd></div>
      ${filaEq('Versión al reportar', eq.version ? String(eq.version).replace(/\s*\(.*\)$/, '') : null)}
      ${t.resuelto_en ? `<div class="dato"><dt>Resuelto</dt><dd>${esc(fechaHora(t.resuelto_en))}${CIERRES[t.cierre] ? ` · ${CIERRES[t.cierre]}` : ''}</dd></div>` : ''}
      ${porConfirmar && t.confirmar_desde ? `<div class="dato"><dt>Arreglado</dt><dd>${esc(fechaHora(t.confirmar_desde))} · falta confirmar</dd></div>` : ''}
    </dl>
    ${(t.fallas || []).length ? `<h2 class="sec-t">Siguió fallando</h2><ul class="t-fallas">${t.fallas.map((f) =>
      `<li><small>${esc(fechaHora(f.en))}${f.version ? ` · versión ${esc(f.version)}` : ''}</small>${esc(f.nota)}</li>`).join('')}</ul>` : ''}
    ${capsT.length ? `<h2 class="sec-t">Últimas pantallas</h2>
      <div class="t-capturas t-capturas-ver pad">${capsT.map((a, i) => `<button type="button" class="t-cap t-cap-btn" data-cap="${i}" aria-label="Ver pantalla ${esc(nombreCaptura(a.pantalla))}">
        ${a.url ? `<img src="${esc(a.url)}" alt="" loading="lazy">` : '<span class="t-cap-falta">No se pudo cargar</span>'}
        <span class="t-cap-pie"><span class="t-cap-txt">${esc(nombreCaptura(a.pantalla))}${a.tomada ? `<small>${esc(horaChile(a.tomada))}</small>` : ''}</span></span></button>`).join('')}</div>
      <p class="ayuda pad">${borraEl ? `Se borrarán el ${esc(borraEl)}` : 'Se borran 7 días después de resolver el ticket'}, porque muestran datos de clientes.</p>` : ''}
    ${t.capturas_borradas_en ? `<p class="ayuda pad">Las capturas de pantalla se borraron el ${esc(fecha(t.capturas_borradas_en))}, 7 días después de resolver el ticket.</p>` : ''}
    ${fotosT.length || vid || t.video_borrado_en ? `<h2 class="sec-t">Fotos y video</h2><div class="ticket-adj">
      ${fotosT.length ? `<div class="compra-fotos ticket-fotos">${fotosT.map((a, i) => `<div class="compra-foto">
        <button type="button" class="compra-foto-ver" data-ver="${i}" aria-label="Ver foto ${i + 1}">${a.url ? `<img src="${esc(a.url)}" alt="">` : ''}</button></div>`).join('')}</div>` : ''}
      ${vid ? `${vid.url ? `<video class="ticket-video" src="${esc(vid.url)}" controls playsinline preload="metadata"></video>` : '<p class="error">No se pudo cargar el video. Revisa la señal.</p>'}
        <p class="ayuda">${vid.segundos ? `Video de ${Math.round(vid.segundos)} s. ` : ''}${borraEl ? `Se borrará el ${esc(borraEl)} (7 días después de resolver el ticket).` : 'Se borra 7 días después de resolver el ticket.'}</p>` : ''}
      ${t.video_borrado_en ? `<p class="ayuda">El video se borró el ${esc(fecha(t.video_borrado_en))}, 7 días después de resolver el ticket.</p>` : ''}
    </div>` : ''}
    ${Object.keys(eq).length ? `<p class="ayuda pad t-tec-enviado">${icono('check', 'ico-s')} Se enviaron los datos técnicos del celular a soporte.</p>` : ''}
    <div class="pad nota-acciones ticket-acc">
      ${recien ? `<button type="button" class="btn prin" id="t-wa">${icono('whatsapp')} Avisar por WhatsApp</button>` : ''}
      ${porConfirmar ? (mio ? '' : `<button type="button" class="btn sec" id="t-forzar">${icono('check')} Dar por resuelto</button>
        <button type="button" class="btn sec" id="abrir-resolver">${icono('editar')} Corregir la solución</button>`)
      : abierto ? `<button type="button" class="btn ${recien ? 'sec' : 'prin'}" id="abrir-resolver">${icono('check')} Marcar resuelto</button>`
        : `<button type="button" class="btn sec" id="abrir-resolver">${icono('editar')} Corregir la solución</button>`}
      <form id="form-resolver" class="form anular" hidden>
        <label class="campo"><span>Etiqueta</span>
          <select name="etiqueta"><option value="">Elige una etiqueta</option>${Object.entries(ETIQUETAS).map(([k, x]) =>
            `<option value="${k}" ${t.etiqueta === k ? 'selected' : ''}>${x.t}</option>`).join('')}</select></label>
        <p class="ayuda">Lo lee quien reportó y queda en Resueltos. Cuenta lo que se veía en la pantalla y qué cambia, sin detalles técnicos ni de seguridad.</p>
        <label class="campo"><span>${t.tipo === 'mejora' ? 'Qué se hizo' : 'Qué pasó'}</span>
          <textarea name="causa" rows="3" maxlength="4000" placeholder="${t.tipo === 'mejora' ? 'Ej.: ahora el pedido muestra el stock al lado del precio.' : 'Ej.: la nota salía cortada al final. Ahora sale completa.'}">${esc(t.causa || '')}</textarea></label>
        <label class="campo"><span>Qué hacer si vuelve a pasar (opcional)</span>
          <textarea name="solucion" rows="3" maxlength="4000" placeholder="En palabras simples, para quien lo reportó. Ej.: actualiza la app y reimprime desde la nota.">${esc(t.solucion || t.respuesta || '')}</textarea></label>
        <label class="campo"><span>${t.tipo === 'mejora' ? 'Versión en que salió (opcional)' : 'Versión que lo arregló (opcional)'}</span>
          <input name="version" maxlength="40" value="${esc(t.version_arreglo || (abierto && v0.codigo ? v0.nombre : ''))}" placeholder="Ej.: 2.0.27" autocomplete="off"></label>
        <p class="error" id="err-resolver" role="alert"></p>
        <button type="submit" class="btn sec">${abierto && !porConfirmar ? 'Confirmar: resuelto' : 'Guardar la solución'}</button></form>
      ${abierto && t.estado === 'nuevo' ? `<button type="button" class="btn sec" id="t-revision">${icono('reloj')} Pasar a En revisión</button>` : ''}
      ${abierto ? '' : `<button type="button" class="btn sec" id="t-reabrir">Reabrir ticket</button>`}
      ${recien ? '' : `<button type="button" class="btn sec" id="t-wa">${icono('whatsapp')} Avisar por WhatsApp</button>`}
    </div>`;

  v.addEventListener('click', (e) => {
    const ver = e.target.closest('[data-ver]');
    const u = ver && fotosT[Number(ver.dataset.ver)]?.url;
    if (u) { verFoto(u, 'Foto del ticket'); return; }
    const cap = e.target.closest('[data-cap]');
    const c = cap && capsT[Number(cap.dataset.cap)];
    if (c?.url) verFoto(c.url, `${nombreCaptura(c.pantalla)}${c.tomada ? ` · ${horaChile(c.tomada)}` : ''}`);
  });
  $('#t-wa', v).addEventListener('click', () => avisarWhatsApp(t).catch((x) => aviso(x.message, 'error')));
  const cambiar = async (estado, texto) => {
    try { await datos.estadoTicket(t.id, estado, null); aviso(texto); window.covecaIr(`#/tickets/${t.id}`); }
    catch (x) { aviso(x.message, 'error'); }
  };
  $('#abrir-resolver', v)?.addEventListener('click', (e) => { e.currentTarget.hidden = true; const fr = $('#form-resolver', v); fr.hidden = false; (t.etiqueta ? fr.causa : fr.etiqueta).focus(); });
  $('#form-resolver', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const fr = e.target, er = $('#err-resolver', v);
    er.textContent = '';
    if (!fr.etiqueta.value) { er.textContent = 'Elige una etiqueta, para encontrarlo después.'; fr.etiqueta.focus(); return; }
    if (fr.causa.value.trim().length < 5) { er.textContent = 'Cuenta qué pasó (al menos unas palabras).'; fr.causa.focus(); return; }
    try {
      const r = await datos.resolverTicket({ id: t.id, etiqueta: fr.etiqueta.value, causa: fr.causa.value, solucion: fr.solucion.value, version: fr.version.value });
      aviso(!abierto || porConfirmar ? 'Solución guardada' : r?.estado === 'confirmar'
        ? `Ticket N° ${t.numero}: falta que quien lo reportó lo pruebe y confirme` : `Ticket N° ${t.numero} resuelto`);
      window.covecaIr(`#/tickets/${t.id}`);
    } catch (x) { er.textContent = x.message; }
  });
  $('#t-revision', v)?.addEventListener('click', () => cambiar('revision', 'Ticket en revisión'));
  $('#t-forzar', v)?.addEventListener('click', () => {
    if (confirm(`¿Dar por resuelto el ticket N° ${t.numero} sin esperar que quien lo reportó lo confirme?`)) cambiar('resuelto', `Ticket N° ${t.numero} resuelto`);
  });
  $('#t-funciona', v)?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try {
      const r = await datos.confirmarTicket(t.id, 'funciona');
      aviso(r.estado === 'resuelto' ? `Gracias. El ticket N° ${t.numero} quedó resuelto.` : `El ticket N° ${t.numero} ya había cambiado.`);
      window.covecaIr(`#/tickets/${t.id}`);
    }
    catch (x) { e.currentTarget.disabled = false; aviso(x.message, 'error'); }
  });
  $('#t-falla', v)?.addEventListener('click', (e) => { e.currentTarget.hidden = true; $('#t-funciona', v).hidden = true; const f = $('#form-falla', v); f.hidden = false; f.nota.focus(); });
  $('#falla-volver', v)?.addEventListener('click', () => { $('#form-falla', v).hidden = true; $('#t-falla', v).hidden = false; $('#t-funciona', v).hidden = false; $('#t-falla', v).focus(); });
  $('#form-falla', v)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nota = e.target.nota.value.trim(), er = $('#err-falla', v);
    er.textContent = '';
    if (nota.length < 3) { er.textContent = 'Cuenta qué sigue fallando (al menos unas palabras).'; e.target.nota.focus(); return; }
    try {
      const r = await datos.confirmarTicket(t.id, 'falla', nota);
      if (r.estado === 'revision') { aviso(`El ticket N° ${t.numero} volvió a revisión.`); window.covecaIr(`#/tickets/${t.id}?falla=1`); }
      else { aviso(`El ticket N° ${t.numero} ya había cambiado.`); window.covecaIr(`#/tickets/${t.id}`); }
    }
    catch (x) { er.textContent = x.message; }
  });
  // Recién vuelto a revisión por "Sigue fallando": en la app Android se abre WhatsApp para avisar a soporte.
  if (query().get('falla') === '1' && t.estado === 'revision' && esApp) {
    history.replaceState(null, '', `#/tickets/${t.id}?nuevo=1`);   // al volver a esta pantalla no se abre otra vez
    avisarWhatsApp(t).catch(() => {});
  }
  $('#t-reabrir', v)?.addEventListener('click', () => cambiar('revision', 'Ticket reabierto'));
}

// Una vez al día, al abrir la app con sesión de administrador: borra los videos y capturas vencidos.
export function limpiarVideosSiToca() {
  const hoy = new Date().toISOString().slice(0, 10);
  if (!datos.esAdmin() || datos.enDemo() || leerAjuste('coveca-tickets-limpieza') === hoy) return;
  datos.limpiarVideosTickets().then(() => guardarAjuste('coveca-tickets-limpieza', hoy)).catch(() => {});
}
