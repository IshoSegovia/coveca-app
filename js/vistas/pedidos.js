// Pestaña Pedidos (entregas): notas por entregar agrupadas por ruta y cliente (las más antiguas primero), con "Ir" (GPS) y
// "Avisar" (WhatsApp al cliente con la nota: vamos en camino). Para entregar se abre la nota (decisión del 22-10-2026,
// ticket N° 11). También las por cobrar y las entregadas de hoy y ayer (con "Deshacer").
// No cambia la nota ni el stock: el stock ya bajó al tomar el pedido. Funciona sin señal (datos.pedidosEntrega usa la copia).
import { celebrar } from '../sentir.js';
import { $, esc, normal, barra, icono, vacio, aviso, clp, diaChile, diaMes, horaChile as hora, plural, FORMAS_PAGO, leerAjuste } from '../ui.js';
import * as datos from '../datos.js';
import { abrirCobro, textoPago, celebracion } from './cobro.js';
import { entregado as entregadoAnim, papelPicado } from '../anima.js';
import { actualizarWidget } from '../widget.js';
import { tieneGps, tieneDireccion, urlIrA, miUbicacion, km } from '../gps.js';
import { enviarNotaWhatsApp, notaParaEnviar } from '../impresora.js';
import { resumenCambio } from './cambios.js';

// Se recuerdan mientras la app está abierta
let filtro = 'por', rutaSel = '', busqueda = '';

// Días desde que se tomó el pedido (por día de Chile)
const diasDesde = (f) => Math.round((Date.parse(diaChile(Date.now())) - Date.parse(diaChile(f))) / 864e5);
const cuando = (f) => { const n = diasDesde(f); return n <= 0 ? 'Hoy' : n === 1 ? 'Ayer' : `Hace ${n} días`; };

// "Avisado · hora": se guarda en este celular por 24 h (no cambia la nota).
const AVISOS = 'coveca-avisos';
const avisos = () => { try { const a = JSON.parse(localStorage.getItem(AVISOS) || '{}'), hace = Date.now() - 864e5;
  return Object.fromEntries(Object.entries(a).filter(([, f]) => Date.parse(f) > hace)); } catch (_) { return {}; } };
const anotarAviso = (id) => { try { localStorage.setItem(AVISOS, JSON.stringify({ ...avisos(), [id]: new Date().toISOString() })); } catch (_) {} };
// ¿El aviso dice a cuántos km estás? Ajuste de este equipo (Ajustes → WhatsApp); sí por defecto (decisión del negocio, 22-10-2026).
export const AVISO_KM = 'coveca-aviso-km';
export const avisoConKm = () => leerAjuste(AVISO_KM, 'si') !== 'no';
// Distancia aproximada (línea recta, km enteros) desde el celular al cliente; null si no hay GPS del cliente o del celular.
async function distancia(p) {
  if (!tieneGps(p)) return null;
  try { const d = km(await miUbicacion({ precisa: false, espera: 3000 }), p); return d < 1 ? 0 : Math.round(d); } catch (_) { return null; }
}

export async function vistaPedidos(v) {
  barra({ titulo: 'Pedidos', sub: 'Entregas' });
  const [todos, rutas, deudas, cambiosTodos, clis] = await Promise.all([datos.pedidosEntrega(), datos.rutas(),
    datos.fiadoTodos().catch(() => new Map()),   // deudas: para avisar el límite al dejar a crédito
    datos.cambios().catch(() => []), datos.clientes({ inactivos: true }).catch(() => [])]);
  // Notas de cambio (ticket N° 12): se entregan junto con las notas, con los datos del cliente para el GPS
  const cliDe = new Map(clis.map((c) => [String(c.id), c]));
  const cambiosVig = cambiosTodos.filter((c) => !c.anulado_en).map((c) => { const k = cliDe.get(String(c.cliente_id));
    return { ...c, cliente: k?.nombre || c.cliente || 'Cliente', ruta_id: c.ruta_id ?? k?.ruta_id ?? null, lat: k?.lat ?? null, lng: k?.lng ?? null,
      direccion: k?.direccion || '', comuna: k?.comuna || '' }; });
  const cambiosPor = cambiosVig.filter((c) => !c.entregado_en);
  const cambiosHechos = cambiosVig.filter((c) => c.entregado_en && diasDesde(c.entregado_en) <= 1);
  const rutasReales = rutas.filter((r) => !r.especial);
  const nombreRuta = (id) => (id == null ? 'Sin ruta' : rutasReales.find((r) => String(r.id) === String(id))?.nombre || 'Sin ruta');
  const ordenRuta = (id) => { const i = rutasReales.findIndex((r) => String(r.id) === String(id)); return i < 0 ? 999 : i; };
  if (rutaSel && rutaSel !== 'sin' && !rutasReales.some((r) => String(r.id) === rutaSel)) rutaSel = '';

  const porEntregar = todos.filter((p) => !p.entregado_en);
  const entregados = todos.filter((p) => p.entregado_en && diasDesde(p.entregado_en) <= 1);
  // Entregadas sin pago registrado (p. ej. con "Entregar todos"); las por entregar se pagan al entregarlas.
  const porCobrar = todos.filter((p) => datos.porCobrar(p) && p.entregado_en);
  const suma = (l) => l.reduce((t, p) => t + (Number(p.total) || 0), 0);
  actualizarWidget({ porEntregar: porEntregar.length, porCobrar: porCobrar.length, montoEntregar: suma(porEntregar), montoCobrar: suma(porCobrar) });   // widgets de Android al día
  const deRuta = (p) => (rutaSel === 'sin' ? p.ruta_id == null : !rutaSel || String(p.ruta_id) === rutaSel);
  const coincide = (p) => { const q = normal(busqueda); return !q || normal(p.cliente).includes(q) || String(p.numero || '') === q.replace(/^n[°º]?\s*/, ''); };
  const coincideCambio = (c) => { const q = normal(busqueda); return !q || normal(c.cliente).includes(q) || datos.numeroCambio(c) === q.replace(/^n[°º]?\s*/, '') || String(c.numero_nota) === q.replace(/^n[°º]?\s*/, ''); };

  v.innerHTML = `<div class="pedidos-vista">
    <div class="filtros" role="tablist">
      <button class="filtro" data-f="por" role="tab" aria-selected="${filtro === 'por'}">Por entregar <span class="n">${porEntregar.length + cambiosPor.length}</span></button>
      <button class="filtro" data-f="cobrar" role="tab" aria-selected="${filtro === 'cobrar'}">Por cobrar <span class="n">${porCobrar.length}</span></button>
      <button class="filtro" data-f="hechos" role="tab" aria-selected="${filtro === 'hechos'}">Entregados hoy y ayer <span class="n">${entregados.length + cambiosHechos.length}</span></button>
    </div>
    <div class="pad-x pedidos-filtros">
      <div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Cliente o N° de nota" value="${esc(busqueda)}" aria-label="Buscar por cliente o número de nota" autocomplete="off"></div>
      <label class="campo"><span>Ruta</span>
        <select id="ruta-p">
          <option value="">Todas las rutas</option>
          ${rutasReales.map((r) => `<option value="${r.id}" ${rutaSel === String(r.id) ? 'selected' : ''}>${esc(r.nombre)}</option>`).join('')}
          <option value="sin" ${rutaSel === 'sin' ? 'selected' : ''}>Clientes sin ruta</option>
        </select></label>
    </div>
    <div id="res"></div></div>`;

  const pintar = () => {
    const res = $('#res', v);
    if (filtro === 'cobrar') {
      const lista = porCobrar.filter(deRuta).filter(coincide).sort((a, b) => a.fecha.localeCompare(b.fecha));
      res.innerHTML = !lista.length ? (busqueda || rutaSel ? vacio('Nada por cobrar', 'Prueba con otra búsqueda o ruta.')
        : celebracion({ tipo: 'monedas', titulo: '¡Todo cobrado!', texto: 'Ninguna nota entregada está esperando su pago.' }))
        : `<p class="resumen-entrega pad-x">${plural(lista.length, 'nota')} por cobrar · <span class="monto">${clp(lista.reduce((s, p) => s + p.total, 0))}</span></p>
        <div class="lista">${lista.map((p) => `
          <div class="fila entrega">
            <a class="fila-txt" href="#/pedidos/${p.id}?desde=pedidos"><p class="fila-t">${p.numero ? `N° ${p.numero} · ` : ''}${esc(p.cliente)}</p>
              <p class="fila-s">${icono('check', 'ico-s')} Entregada ${cuando(p.entregado_en).toLowerCase()} · ${esc(nombreRuta(p.ruta_id))}${p.cobroPorSubir || p.porSubir ? ' · Por subir' : ''}</p></a>
            <div class="entrega-der"><span class="monto">${clp(p.total)}</span>
              <button type="button" class="btn sec chico" data-cobrar="${p.id}" aria-label="Cobrar la nota ${p.numero || ''}">${icono('moneda')} Cobrar</button></div>
          </div>`).join('')}</div>`;
      return;
    }
    if (filtro === 'hechos') {
      const lista = entregados.filter(deRuta).filter(coincide).sort((a, b) => b.entregado_en.localeCompare(a.entregado_en));
      const camb = cambiosHechos.filter(deRuta).filter(coincideCambio);
      const filaCamb = (c) => `<div class="fila entrega">
            <a class="fila-txt" href="#/cambios/${c.id}?desde=pedidos"><p class="fila-t">Cambio N° ${esc(datos.numeroCambio(c))} · ${esc(c.cliente)}</p>
              <p class="fila-s">${icono('check', 'ico-s')} Entregado ${diasDesde(c.entregado_en) === 0 ? 'hoy' : 'ayer'} ${hora(c.entregado_en)} · ${esc(nombreRuta(c.ruta_id))}${c.marcaPorSubir ? ' · Por subir' : ''}</p></a>
            <div class="entrega-der"><span class="chip">${icono('nota', 'ico-s')} Cambio</span>
              <button type="button" class="btn link" data-deshacer-cambio="${c.id}" aria-label="Deshacer entrega del cambio ${esc(datos.numeroCambio(c))}">Deshacer</button></div>
          </div>`;
      if (!lista.length && camb.length) { res.innerHTML = `<div class="lista">${camb.map(filaCamb).join('')}</div>`; return; }
      res.innerHTML = !lista.length ? vacio('No hay entregas de hoy ni de ayer', busqueda || rutaSel ? 'Prueba con otra búsqueda o ruta.' : 'Al marcar una nota como entregada aparece aquí.')
        : `<p class="resumen-entrega pad-x">${plural(lista.length, 'nota entregada', 'notas entregadas')} · <span class="monto">${clp(lista.reduce((s, p) => s + p.total, 0))}</span></p>
        <div class="lista">${lista.map((p) => `
          <div class="fila entrega">
            <a class="fila-txt" href="#/pedidos/${p.id}?desde=pedidos"><p class="fila-t">${p.numero ? `N° ${p.numero} · ` : ''}${esc(p.cliente)}</p>
              <p class="fila-s">${icono('check', 'ico-s')} Entregado ${diasDesde(p.entregado_en) === 0 ? 'hoy' : 'ayer'} ${hora(p.entregado_en)} · ${esc(nombreRuta(p.ruta_id))}${p.marcaPorSubir ? ' · Por subir' : ''}</p></a>
            <div class="entrega-der"><span class="monto">${clp(p.total)}</span>
              ${cambiosVig.some((c) => c.pedido_id === p.id) ? '' : `<button type="button" class="btn link" data-deshacer="${p.id}" aria-label="Deshacer entrega de la nota ${p.numero || ''}">Deshacer</button>`}</div>
          </div>`).join('')}${camb.map(filaCamb).join('')}</div>`;
      return;
    }
    const lista = porEntregar.filter(deRuta).filter(coincide);
    const camb = cambiosPor.filter(deRuta).filter(coincideCambio);
    if (!lista.length && !camb.length) {
      if (busqueda || rutaSel) { res.innerHTML = vacio('Nada por entregar con ese filtro', 'Prueba con otra búsqueda o ruta.'); return; }
      res.innerHTML = celebracion({ tipo: 'camion', titulo: '¡Ruta al día!', texto: 'Todo lo vendido ya llegó a tus clientes. ¡Buen trabajo!' });
      // Papel picado una sola vez: al entregar la última nota (no cada vez que se abre la pestaña vacía)
      try { if (sessionStorage.getItem('coveca-recien-entregado')) { sessionStorage.removeItem('coveca-recien-entregado'); setTimeout(papelPicado, 1700); celebrar('¡Ruta al día!', { portico: false }); } } catch (_) {}
      return;
    }
    // Ruta → cliente → notas (más antiguas primero)
    const grupos = new Map();
    for (const p of [...lista, ...camb.map((c) => ({ ...c, esCambio: true }))].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      const k = p.ruta_id == null ? 'sin' : String(p.ruta_id);
      if (!grupos.has(k)) grupos.set(k, { id: k, ruta: nombreRuta(p.ruta_id), orden: ordenRuta(p.ruta_id), clientes: new Map() });
      const g = grupos.get(k);
      const kc = p.cliente_id ?? `nuevo:${p.id}`;   // cliente nuevo sin subir: cada nota por separado
      if (!g.clientes.has(kc)) g.clientes.set(kc, { nombre: p.cliente, id: p.cliente_id, notas: [] });
      g.clientes.get(kc).notas.push(p);
    }
    const total = lista.reduce((s, p) => s + p.total, 0);
    const yaAvisados = avisos();
    // Nota de cambio por entregar: se abre para entregarla (no lleva monto ni aviso por WhatsApp)
    const filaCambio = (c) => `<div class="fila entrega">
        <a class="fila-txt" href="#/cambios/${c.id}?desde=pedidos" aria-label="Abrir el cambio N° ${esc(datos.numeroCambio(c))} para entregarlo"><p class="fila-t">Cambio N° ${esc(datos.numeroCambio(c))} ${icono('derecha', 'ico-s abrir-nota')}</p>
          <p class="fila-s">${esc(resumenCambio(c))} · ${cuando(c.fecha)}${c.porSubir ? ' · Por subir' : ''}</p></a>
        <div class="entrega-der"><span class="chip">${icono('nota', 'ico-s')} Cambio</span>
          ${tieneGps(c) || tieneDireccion(c) ? `<div class="entrega-btns"><a class="btn sec ir-gps" data-externo href="${urlIrA(c)}" aria-label="Ir con GPS a ${esc(c.cliente)}" title="Ir con GPS">${icono('mapa')}</a></div>` : ''}</div>
      </div>`;
    const nota = (p) => { if (p.esCambio) return filaCambio(p); const n = diasDesde(p.fecha), av = yaAvisados[p.id];
      return `<div class="fila entrega">
        <a class="fila-txt" href="#/pedidos/${p.id}?desde=pedidos" aria-label="Abrir la ${p.numero ? `nota N° ${p.numero}` : 'nota'} para entregarla"><p class="fila-t">${p.numero ? `Nota N° ${p.numero}` : 'Nota sin número'} ${icono('derecha', 'ico-s abrir-nota')}</p>
          <p class="fila-s">${n >= 2 ? `<span class="txt-alerta">${icono('alerta', 'ico-s')} ${cuando(p.fecha)}</span>` : cuando(p.fecha)} · ${diaMes(p.fecha)} ${hora(p.fecha)}${p.porSubir ? ' · Por subir' : ''}</p>
          ${av ? `<p class="fila-s avisado">${icono('check', 'ico-s')} Avisado · ${hora(av)}</p>` : ''}</a>
        <div class="entrega-der"><span class="monto">${clp(p.total)}</span>
          <div class="entrega-btns">
            ${tieneGps(p) || tieneDireccion(p) ? `<a class="btn sec ir-gps" data-externo href="${urlIrA(p)}" aria-label="Ir con GPS a ${esc(p.cliente)}" title="Ir con GPS">${icono('mapa')}</a>` : ''}
            <button type="button" class="btn sec chico" data-avisar="${p.id}" aria-label="Avisar a ${esc(p.cliente)} que vas en camino">${icono('whatsapp')} Avisar</button></div></div>
      </div>`; };
    res.innerHTML = `
      <p class="resumen-entrega pad-x">${plural(lista.length, 'nota')}${camb.length ? ` y ${plural(camb.length, 'cambio')}` : ''} por entregar · <span class="monto">${clp(total)}</span></p>
      <p class="ayuda pad-x">Para entregar, toca la nota. "Avisar" le manda al cliente la nota por WhatsApp.</p>
      ${[...grupos.values()].sort((a, b) => a.orden - b.orden).map((g) => { const ns = [...g.clientes.values()].flatMap((c) => c.notas);
        const nn = ns.filter((p) => !p.esCambio), nc = ns.length - nn.length;
        return `<section class="grupo-ruta">
        <div class="grupo-cab pad-x"><div><h2 class="grupo-t">${esc(g.ruta)}</h2>
          <p class="fila-s">${plural(nn.length, 'nota')}${nc ? ` · ${plural(nc, 'cambio')}` : ''} · ${plural(g.clientes.size, 'cliente')} · <span class="monto">${clp(nn.reduce((s, p) => s + p.total, 0))}</span></p></div></div>
        ${[...g.clientes.values()].map((c) => `<div class="entrega-cli">
          ${c.id == null ? `<p class="entrega-cli-t">${esc(c.nombre)} · cliente nuevo</p>` : `<a class="entrega-cli-t" href="#/clientes/${c.id}">${esc(c.nombre)}</a>`}
          <div class="lista">${c.notas.map(nota).join('')}</div></div>`).join('')}
      </section>`; }).join('')}`;
  };

  // Marca y vuelve a dibujar; el aviso ofrece deshacer.
  const marcar = async (ids, entregado, texto) => {
    try {
      await datos.marcarEntrega(ids, entregado);
      if (entregado) { entregadoAnim(ids.length > 1 ? `¡${ids.length} notas entregadas!` : '¡Entregado!'); try { sessionStorage.setItem('coveca-recien-entregado', '1'); } catch (_) {} }
      await vistaPedidos(v);
      aviso(texto, 'ok', { texto: 'Deshacer', fn: async () => {
        try { await datos.marcarEntrega(ids, !entregado); if (location.hash.startsWith('#/pedidos')) await vistaPedidos(v); }
        catch (err) { aviso(err.message, 'error'); }
      } });
    } catch (err) { aviso(err.message, 'error'); }
  };
  // Escucha en un contenedor que se crea de nuevo en cada dibujo (#vista es el mismo para todas las pantallas).
  $('.pedidos-vista', v).addEventListener('click', async (e) => {
    const b = e.target.closest('[data-avisar],[data-deshacer],[data-deshacer-cambio],[data-cobrar],[data-f]');
    if (!b) return;
    if (b.dataset.f) { filtro = b.dataset.f; v.querySelectorAll('.filtro').forEach((x) => x.setAttribute('aria-selected', x === b)); pintar(); return; }
    b.disabled = true;
    const nom = (p) => (p.numero ? `Nota N° ${p.numero}` : 'Nota');
    // Datos de la nota para la cola sin señal (el cobro se muestra antes de subir)
    const resumen = (p) => ({ cliente: p.cliente, total: p.total, cliente_id: p.cliente_id, numero: p.numero });
    const pedirPago = (p, preguntar) => abrirCobro({ total: p.total, numero: p.numero, cliente: p.cliente, preguntar,
      forma: FORMAS_PAGO[p.forma_pago] ? p.forma_pago : 'efectivo',
      credito: { deuda: deudas.get?.(p.cliente_id)?.deuda ?? 0, limite: p.limite_credito ?? null } });
    if (b.dataset.avisar) {
      // WhatsApp al cliente de esta nota con la imagen de la nota y "vamos en camino" (con la distancia, si hay GPS).
      // No cambia la nota. Funciona sin señal: la nota sale de la copia del celular y WhatsApp la envía al volver la señal.
      const p = todos.find((x) => x.id === b.dataset.avisar), html = b.innerHTML;
      b.textContent = 'Preparando…';
      try {
        const [n, negocio, lejos] = await Promise.all([datos.pedido(p.id), datos.configuracion(), avisoConKm() ? distancia(p) : null]);
        if (!n.telefonoCliente && p.telefono) n.telefonoCliente = p.telefono;
        if (!n.telefonoCliente) aviso('Este cliente no tiene teléfono guardado: elige el contacto en WhatsApp y agrégalo después en su ficha.', 'ok');
        const salio = await enviarNotaWhatsApp(notaParaEnviar(n, datos.usuario()), negocio, { motivo: 'en_camino', km: lejos });
        if (salio) { anotarAviso(p.id); b.disabled = false; b.innerHTML = html; return pintar(); }
      } catch (err) { aviso(err.message || 'No se pudo preparar el aviso por WhatsApp.', 'error'); }
      b.disabled = false; b.innerHTML = html;
      return;
    }
    if (b.dataset.cobrar) {
      const p = todos.find((x) => x.id === b.dataset.cobrar);
      const r = await pedirPago(p, false);
      if (!r) { b.disabled = false; return; }
      try {
        await datos.registrarCobro(p.id, true, r.forma, resumen(p));
        await vistaPedidos(v);
        aviso(`${nom(p)} ${textoPago(r)}`, 'ok', { texto: 'Deshacer', fn: async () => {
          try { await datos.registrarCobro(p.id, false, null, resumen(p)); if (location.hash.startsWith('#/pedidos')) await vistaPedidos(v); }
          catch (err) { aviso(err.message, 'error'); }
        } });
      } catch (err) { b.disabled = false; aviso(err.message, 'error'); }
      return;
    }
    if (b.dataset.deshacerCambio) {
      const c = cambiosHechos.find((x) => x.id === b.dataset.deshacerCambio);
      try { await datos.entregarCambio(c.id, false, { cliente: c.cliente }); await vistaPedidos(v); aviso(`Cambio N° ${datos.numeroCambio(c)} vuelve a "Por entregar"`); }
      catch (err) { b.disabled = false; aviso(err.message, 'error'); }
      return;
    }
    if (b.dataset.deshacer) {
      const p = todos.find((x) => x.id === b.dataset.deshacer);
      return marcar([p.id], false, `${nom(p)} vuelve a "Por entregar"`);
    }
  });
  $('#q', v).addEventListener('input', (e) => { busqueda = e.target.value; pintar(); });
  $('#ruta-p', v).addEventListener('change', (e) => { rutaSel = e.target.value; pintar(); });
  pintar();
}
