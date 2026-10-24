// Aviso a quien reportó un ticket (migración 0049; pedido del 21-10-2026) y pregunta "¿Se solucionó?" de los
// errores "Por confirmar" (migración 0053).
// Cuando un ticket propio pasa a "En revisión" o a "Resuelto", al abrir o volver a la app sale una ventana con lo
// que cambió (y, si está resuelto, qué pasó, qué hacer si vuelve a pasar y la versión que lo arregla). Al cerrarla o
// abrir el ticket, el aviso queda visto. Solo administradores (quienes envían tickets), con señal, nunca en el modo
// de ejemplo ni en pruebas automáticas. Espera a que no haya otra ventana encima (novedades, recorrido, actualización).
import * as datos from './datos.js';
import { esc, icono, ir, aviso } from './ui.js';
import { versionLocal } from './actualizacion.js';
import { esApp } from './nativo.js';

const OCUPADO = '.nv-ventana, .at-ventana, .ac-ventana, .tour, .act-capa, .cobro-capa, .mas-capa, .visor-foto, .escaner, .imp-capa';
const vistos = new Set();   // ya mostrados en esta sesión de la app (por si marcar "visto" falla sin señal)
let ultima = 0, esperando = false;

const recortar = (s, n) => (s && s.length > n ? s.slice(0, n - 2).trimEnd() + '…' : s || '');
// ¿La versión instalada es anterior a la que arregla el ticket? (solo app Android: la web siempre está al día)
export function faltaActualizar(version) {
  const v0 = versionLocal();
  if (!esApp || !v0.codigo || !version) return false;
  const partes = (x) => (String(x).match(/\d+/g) || []).slice(0, 3).map(Number);   // 2.0.32 (133) → 2, 0, 32
  const a = partes(v0.nombre), b = partes(version);
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0);
  return false;
}

const itemHtml = (t) => {
  const resuelto = t.aviso_estado === 'resuelto';
  return `<li class="at-item"><span class="nv-ico ${resuelto ? 'at-ok' : ''}" aria-hidden="true">${icono(resuelto ? 'check' : 'reloj')}</span>
    <div class="at-txt"><b>N° ${t.numero} · ${resuelto ? 'Resuelto' : 'En revisión'}</b>
      <small>${esc(recortar(t.descripcion, 90))}</small>
      ${resuelto ? `${t.causa ? `<p class="at-dato"><span>${t.tipo === 'mejora' ? 'Qué se hizo' : 'Qué pasó'}</span>${esc(t.causa)}</p>` : ''}
        ${t.solucion ? `<p class="at-dato"><span>Qué hacer si vuelve a pasar</span>${esc(t.solucion)}</p>` : ''}
        ${t.version_arreglo ? `<p class="at-dato at-version">${t.tipo === 'mejora' ? 'Disponible desde' : 'Arreglado en'} la versión ${esc(t.version_arreglo)}.${faltaActualizar(t.version_arreglo)
          ? ' <b>Actualiza la app</b> para tenerlo.' : ''}</p>` : ''}`
        : '<p class="at-dato">Soporte ya lo está revisando. Te avisaremos aquí cuando esté resuelto.</p>'}
      <button type="button" class="btn link at-ver" data-id="${esc(t.id)}">Ver ticket ${icono('derecha', 'ico-s')}</button></div></li>`;
};

// Muestra la ventana con los avisos (también la usan las capturas automáticas).
export function mostrarAvisosTickets(lista) {
  if (!lista.length || document.querySelector('.at-ventana')) return;
  const uno = lista.length === 1 ? lista[0] : null;
  const titulo = uno ? `Tu ticket N° ${uno.numero} ${uno.aviso_estado === 'resuelto' ? 'quedó resuelto' : 'está en revisión'}` : 'Novedades de tus tickets';
  const el = document.createElement('div');
  el.className = 'at-ventana';   // no nv-ventana: así la ventana de novedades no se cree ya mostrada
  el.innerHTML = `<div class="nv-velo"></div>
    <div class="nv-modal" role="dialog" aria-modal="true" aria-labelledby="at-t">
      <span class="nv-sello at-sello">Soporte</span><h2 id="at-t" class="nv-t">${esc(titulo)}</h2>
      <p class="nv-v">${uno ? 'Hay novedades del ticket que enviaste:' : `${lista.length} tickets que enviaste cambiaron de estado:`}</p>
      <ul class="nv-lista">${lista.map(itemHtml).join('')}</ul>
      <div class="nv-pie"><button type="button" class="btn prin at-ok-btn">Entendido</button></div></div>`;
  document.body.appendChild(el);
  document.getElementById('vista')?.setAttribute('inert', '');
  lista.forEach((t) => vistos.add(t.id));
  const cerrar = () => {
    el.remove(); window.covecaCerrarVisor = null; document.getElementById('vista')?.removeAttribute('inert');
    lista.forEach((t) => datos.avisoTicketVisto(t.id).catch(() => {}));
  };
  el.querySelector('.at-ok-btn').addEventListener('click', cerrar);
  el.querySelectorAll('.at-ver').forEach((b) => b.addEventListener('click', () => { cerrar(); ir(`#/tickets/${b.dataset.id}`); }));
  window.covecaCerrarVisor = cerrar;   // botón atrás de Android
  el.querySelector('.at-ok-btn').focus();
}

// ---------- "Por confirmar" (migración 0053; regla del 21-10-2026) ----------
// Un error arreglado espera que quien lo reportó lo pruebe: "Sí, funciona" → Resuelto; "Sigue fallando" (con nota) →
// vuelve a En revisión y se avisa a soporte por WhatsApp; "Más tarde" → se vuelve a preguntar 30 min después y, al
// segundo aviso, "Más tarde" lo da por resuelto. Si la app instalada es anterior a la del arreglo, solo pide actualizar
// (no cuenta como aviso).
export function mostrarConfirmacion(t, { alResponder = () => {} } = {}) {
  if (document.querySelector('.ac-ventana')) return;
  const actualizar = faltaActualizar(t.version_arreglo);
  const segundo = !actualizar && (t.confirmar_avisos || 0) >= 1;
  const el = document.createElement('div');
  el.className = 'ac-ventana';
  el.innerHTML = `<div class="nv-velo"></div>
    <div class="nv-modal" role="dialog" aria-modal="true" aria-labelledby="ac-t">
      <span class="nv-sello at-sello">Soporte</span>
      <h2 id="ac-t" class="nv-t">${actualizar ? `Tu ticket N° ${t.numero} ya tiene arreglo` : `¿Se solucionó tu ticket N° ${t.numero}?`}</h2>
      <ul class="nv-lista"><li class="at-item"><span class="nv-ico" aria-hidden="true">${icono('alerta')}</span><div class="at-txt">
        <b>Lo que reportaste</b><small>${esc(recortar(t.descripcion, 140))}</small>
        ${t.causa ? `<p class="at-dato"><span>Qué se arregló</span>${esc(t.causa)}</p>` : ''}
        ${t.version_arreglo ? `<p class="at-dato at-version">${actualizar ? `Viene en la versión ${esc(t.version_arreglo)}. <b>Actualiza la app</b> para probarlo; después te preguntaremos si funcionó.`
          : `Arreglado en la versión ${esc(t.version_arreglo)}.`}</p>` : ''}</div></li></ul>
      ${actualizar ? `<div class="nv-pie"><button type="button" class="btn prin ac-entendido">Entendido</button></div>`
        : `<p class="nv-v">Pruébalo en tu ruta y cuéntanos si quedó bien.${segundo ? ' <b>Si eliges «Más tarde» ahora, lo daremos por solucionado.</b>' : ''}</p>
      <div class="ac-botones"><button type="button" class="btn prin ac-si">${icono('check')} Sí, funciona</button>
        <button type="button" class="btn sec ac-no">Sigue fallando</button>
        <button type="button" class="btn link ac-despues">Más tarde</button></div>
      <form class="ac-falla form" hidden>
        <label class="campo"><span>¿Qué sigue pasando?</span>
          <textarea name="nota" rows="3" maxlength="1000" placeholder="Ej.: la nota sigue saliendo cortada al final."></textarea></label>
        <p class="error ac-err" role="alert"></p>
        <div class="nv-pie"><button type="button" class="btn sec ac-volver">Volver</button><button type="submit" class="btn prin">Enviar</button></div>
      </form>`}
    </div>`;
  document.body.appendChild(el);
  document.getElementById('vista')?.setAttribute('inert', '');
  const quitar = () => { el.remove(); window.covecaCerrarVisor = null; document.getElementById('vista')?.removeAttribute('inert'); };
  const responder = async (respuesta, nota) => {
    const r = await datos.confirmarTicket(t.id, respuesta, nota);
    quitar(); alResponder(r);
    return r;
  };
  if (actualizar) {
    // No cuenta como aviso ni puede cerrar el ticket: solo evita volver a preguntar antes de 30 min.
    const cerrar = () => { responder('aplazar').catch(() => quitar()); };
    el.querySelector('.ac-entendido').addEventListener('click', cerrar);
    window.covecaCerrarVisor = cerrar;
    el.querySelector('.ac-entendido').focus();
    return;
  }
  // Los botones se activan cuando el servidor ya contó este aviso (así la advertencia del segundo aviso se cumple).
  const btns = [...el.querySelectorAll('.ac-botones .btn')];
  btns.forEach((b) => { b.disabled = true; });
  datos.confirmarTicket(t.id, 'mostrado').catch(() => {}).finally(() => { btns.forEach((b) => { b.disabled = false; }); el.querySelector('.ac-si').focus(); });
  const despues = async () => {
    try {
      const r = await responder('despues');
      if (r.estado === 'resuelto') aviso(`Dimos por solucionado el ticket N° ${t.numero}. Si vuelve a pasar, envía uno nuevo.`);
      else setTimeout(() => revisarAvisosTickets({ forzar: true }), 30 * 60e3 + 15e3);   // volver a preguntar a los 30 min
    } catch (x) { quitar(); aviso(x.message, 'error'); }
  };
  el.querySelector('.ac-si').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try {
      const r = await responder('funciona');
      aviso(r.estado === 'resuelto' ? `Gracias. El ticket N° ${t.numero} quedó resuelto.` : `El ticket N° ${t.numero} ya había cambiado. Revísalo en Tickets de soporte.`);
    } catch (x) { e.currentTarget.disabled = false; aviso(x.message, 'error'); }
  });
  el.querySelector('.ac-despues').addEventListener('click', despues);
  const form = el.querySelector('.ac-falla'), botones = el.querySelector('.ac-botones');
  el.querySelector('.ac-no').addEventListener('click', () => { botones.hidden = true; form.hidden = false; form.nota.focus(); });
  el.querySelector('.ac-volver').addEventListener('click', () => { form.hidden = true; botones.hidden = false; el.querySelector('.ac-no').focus(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nota = form.nota.value.trim(), err = form.querySelector('.ac-err');
    err.textContent = '';
    if (nota.length < 3) { err.textContent = 'Cuenta qué sigue fallando (al menos unas palabras).'; form.nota.focus(); return; }
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const r = await responder('falla', nota);
      if (r.estado === 'revision') { aviso(`El ticket N° ${t.numero} volvió a revisión.`); ir(`#/tickets/${t.id}?falla=1`); }   // la pantalla del ticket avisa a soporte por WhatsApp
      else { aviso(`El ticket N° ${t.numero} ya había cambiado. Revísalo en Tickets de soporte.`); ir(`#/tickets/${t.id}`); }
    } catch (x) { btn.disabled = false; err.textContent = x.message; }
  });
  window.covecaCerrarVisor = despues;   // botón atrás de Android = Más tarde
}
// Sin filtrar por `vistos`: el servidor ya no la devuelve antes de 30 min (confirmar_ultimo) y así "Más tarde" vuelve a preguntar
// con la app abierta. Solo se evita repetirla mientras la ventana sigue en pantalla.
const leerConfirmar = async () => (document.querySelector('.ac-ventana') ? [] : (await datos.ticketsPorConfirmar()));

// Mientras se toma un pedido o se cobra no se interrumpe: se revisa al salir de esa pantalla.
const EN_VENTA = /^#\/(clientes\/[^/]+\/pedido|nuevo)/;
const leerAvisos = async () => (await datos.avisosTickets())?.filter((t) => !vistos.has(t.id)) ?? null;

// Revisa si hay avisos y los muestra. Al abrir la app, al volver a ella o a la señal (máx. una vez cada 5 min).
export async function revisarAvisosTickets({ forzar = false } = {}) {
  if (navigator.webdriver || datos.enDemo() || !datos.esAdmin() || /^#\/login/.test(location.hash)) return;
  if (EN_VENTA.test(location.hash) || esperando) return;
  if (!forzar && Date.now() - ultima < 5 * 60e3) return;
  let lista, conf;
  try { [lista, conf] = await Promise.all([leerAvisos(), leerConfirmar()]); } catch (_) { return; }
  if (lista === null && conf === null) return;   // sin señal: se vuelve a intentar al volver la señal o la app
  ultima = Date.now();
  if (!lista?.length && !conf?.length) return;
  // Si hay otra ventana encima (novedades, recorrido, actualización…), espera a que se cierre (hasta ~2 min).
  esperando = true;
  for (let i = 0; i < 30 && document.querySelector(OCUPADO); i++) await new Promise((ok) => setTimeout(ok, 4000));
  esperando = false;
  if (document.querySelector(OCUPADO) || EN_VENTA.test(location.hash)) { ultima = 0; return; }
  try { [lista, conf] = await Promise.all([leerAvisos(), leerConfirmar()]); } catch (_) { return; }   // de nuevo: pudo abrir el ticket mientras esperaba
  // Primero los avisos de cambio de estado; la pregunta "¿Se solucionó?" sale al cerrarlos (una por vez).
  const preguntar = () => { if (conf?.length) mostrarConfirmacion(conf[0], { alResponder: () => setTimeout(() => revisarAvisosTickets({ forzar: true }), 600) }); };
  if (lista?.length) {
    mostrarAvisosTickets(lista);
    const ventana = document.querySelector('.at-ventana');
    if (ventana && conf?.length) new MutationObserver((_, o) => { if (!ventana.isConnected) { o.disconnect(); setTimeout(preguntar, 400); } })
      .observe(document.body, { childList: true });
  } else preguntar();
}
// Con la app abierta, vuelve a revisar cada 30 min (la pregunta "¿Se solucionó?" se repite a los 30 min).
setInterval(() => { if (document.visibilityState === 'visible') revisarAvisosTickets({ forzar: true }); }, 30 * 60e3);
let antes = location.hash;
addEventListener('hashchange', () => { if (EN_VENTA.test(antes) && !EN_VENTA.test(location.hash)) revisarAvisosTickets(); antes = location.hash; });
addEventListener('online', () => revisarAvisosTickets({ forzar: true }));
