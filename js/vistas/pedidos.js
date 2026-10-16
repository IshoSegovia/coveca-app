// Pestaña Pedidos (entregas): notas por entregar agrupadas por ruta y cliente (las más antiguas primero),
// marcar como entregada una nota o toda una ruta, y las entregadas de hoy y ayer (con "Deshacer").
// No cambia la nota ni el stock: el stock ya bajó al tomar el pedido. Funciona sin señal (datos.pedidosEntrega usa la copia).
import { $, esc, normal, barra, icono, vacio, aviso, clp, diaChile, diaMes, horaChile as hora, plural, FORMAS_PAGO } from '../ui.js';
import * as datos from '../datos.js';
import { abrirCobro, textoPago, celebracion } from './cobro.js';
import { entregado as entregadoAnim, papelPicado } from '../anima.js';
import { actualizarWidget } from '../widget.js';
import { tieneGps, tieneDireccion, urlIrA } from '../gps.js';

// Se recuerdan mientras la app está abierta
let filtro = 'por', rutaSel = '', busqueda = '';

// Días desde que se tomó el pedido (por día de Chile)
const diasDesde = (f) => Math.round((Date.parse(diaChile(Date.now())) - Date.parse(diaChile(f))) / 864e5);
const cuando = (f) => { const n = diasDesde(f); return n <= 0 ? 'Hoy' : n === 1 ? 'Ayer' : `Hace ${n} días`; };

export async function vistaPedidos(v) {
  barra({ titulo: 'Pedidos', sub: 'Entregas' });
  const [todos, rutas] = await Promise.all([datos.pedidosEntrega(), datos.rutas()]);
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
  const deudas = await datos.fiadoTodos().catch(() => new Map());   // para avisar el límite al dejar a crédito
  const deRuta = (p) => (rutaSel === 'sin' ? p.ruta_id == null : !rutaSel || String(p.ruta_id) === rutaSel);
  const coincide = (p) => { const q = normal(busqueda); return !q || normal(p.cliente).includes(q) || String(p.numero || '') === q.replace(/^n[°º]?\s*/, ''); };

  v.innerHTML = `<div class="pedidos-vista">
    <div class="filtros" role="tablist">
      <button class="filtro" data-f="por" role="tab" aria-selected="${filtro === 'por'}">Por entregar <span class="n">${porEntregar.length}</span></button>
      <button class="filtro" data-f="cobrar" role="tab" aria-selected="${filtro === 'cobrar'}">Por cobrar <span class="n">${porCobrar.length}</span></button>
      <button class="filtro" data-f="hechos" role="tab" aria-selected="${filtro === 'hechos'}">Entregados hoy y ayer <span class="n">${entregados.length}</span></button>
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
      res.innerHTML = !lista.length ? vacio('No hay entregas de hoy ni de ayer', busqueda || rutaSel ? 'Prueba con otra búsqueda o ruta.' : 'Al marcar una nota como entregada aparece aquí.')
        : `<p class="resumen-entrega pad-x">${plural(lista.length, 'nota entregada', 'notas entregadas')} · <span class="monto">${clp(lista.reduce((s, p) => s + p.total, 0))}</span></p>
        <div class="lista">${lista.map((p) => `
          <div class="fila entrega">
            <a class="fila-txt" href="#/pedidos/${p.id}?desde=pedidos"><p class="fila-t">${p.numero ? `N° ${p.numero} · ` : ''}${esc(p.cliente)}</p>
              <p class="fila-s">${icono('check', 'ico-s')} Entregado ${diasDesde(p.entregado_en) === 0 ? 'hoy' : 'ayer'} ${hora(p.entregado_en)} · ${esc(nombreRuta(p.ruta_id))}${p.marcaPorSubir ? ' · Por subir' : ''}</p></a>
            <div class="entrega-der"><span class="monto">${clp(p.total)}</span>
              <button type="button" class="btn link" data-deshacer="${p.id}" aria-label="Deshacer entrega de la nota ${p.numero || ''}">Deshacer</button></div>
          </div>`).join('')}</div>`;
      return;
    }
    const lista = porEntregar.filter(deRuta).filter(coincide);
    if (!lista.length) {
      if (busqueda || rutaSel) { res.innerHTML = vacio('Nada por entregar con ese filtro', 'Prueba con otra búsqueda o ruta.'); return; }
      res.innerHTML = celebracion({ tipo: 'camion', titulo: '¡Ruta al día!', texto: 'Todo lo vendido ya llegó a tus clientes. ¡Buen trabajo!' });
      // Papel picado una sola vez: al entregar la última nota (no cada vez que se abre la pestaña vacía)
      try { if (sessionStorage.getItem('coveca-recien-entregado')) { sessionStorage.removeItem('coveca-recien-entregado'); setTimeout(papelPicado, 1700); } } catch (_) {}
      return;
    }
    // Ruta → cliente → notas (más antiguas primero)
    const grupos = new Map();
    for (const p of lista.sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      const k = p.ruta_id == null ? 'sin' : String(p.ruta_id);
      if (!grupos.has(k)) grupos.set(k, { id: k, ruta: nombreRuta(p.ruta_id), orden: ordenRuta(p.ruta_id), clientes: new Map() });
      const g = grupos.get(k);
      if (!g.clientes.has(p.cliente_id)) g.clientes.set(p.cliente_id, { nombre: p.cliente, id: p.cliente_id, notas: [] });
      g.clientes.get(p.cliente_id).notas.push(p);
    }
    const total = lista.reduce((s, p) => s + p.total, 0);
    const nota = (p) => { const n = diasDesde(p.fecha);
      return `<div class="fila entrega">
        <a class="fila-txt" href="#/pedidos/${p.id}?desde=pedidos"><p class="fila-t">${p.numero ? `Nota N° ${p.numero}` : 'Nota sin número'}</p>
          <p class="fila-s">${n >= 2 ? `<span class="txt-alerta">${icono('alerta', 'ico-s')} ${cuando(p.fecha)}</span>` : cuando(p.fecha)} · ${diaMes(p.fecha)} ${hora(p.fecha)}${p.porSubir ? ' · Por subir' : ''}</p></a>
        <div class="entrega-der"><span class="monto">${clp(p.total)}</span>
          <div class="entrega-btns">
            ${tieneGps(p) || tieneDireccion(p) ? `<a class="btn sec ir-gps" data-externo href="${urlIrA(p)}" aria-label="Ir con GPS a ${esc(p.cliente)}" title="Ir con GPS">${icono('mapa')}</a>` : ''}
            <button type="button" class="btn sec chico" data-entregar="${p.id}" aria-label="Marcar la nota ${p.numero || ''} como entregada">${icono('camion')} Entregar</button></div></div>
      </div>`; };
    res.innerHTML = `
      <p class="resumen-entrega pad-x">${plural(lista.length, 'nota')} por entregar · <span class="monto">${clp(total)}</span></p>
      ${[...grupos.values()].sort((a, b) => a.orden - b.orden).map((g) => { const ns = [...g.clientes.values()].flatMap((c) => c.notas);
        return `<section class="grupo-ruta">
        <div class="grupo-cab pad-x"><div><h2 class="grupo-t">${esc(g.ruta)}</h2>
          <p class="fila-s">${plural(ns.length, 'nota')} · ${plural(g.clientes.size, 'cliente')} · <span class="monto">${clp(ns.reduce((s, p) => s + p.total, 0))}</span></p></div>
          ${ns.length > 1 ? `<button type="button" class="btn link" data-todos="${g.id}">Entregar todos</button>` : ''}</div>
        ${[...g.clientes.values()].map((c) => `<div class="entrega-cli">
          <a class="entrega-cli-t" href="#/clientes/${c.id}">${esc(c.nombre)}</a>
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
    const b = e.target.closest('[data-entregar],[data-deshacer],[data-todos],[data-cobrar],[data-f]');
    if (!b) return;
    if (b.dataset.f) { filtro = b.dataset.f; v.querySelectorAll('.filtro').forEach((x) => x.setAttribute('aria-selected', x === b)); pintar(); return; }
    b.disabled = true;
    const nom = (p) => (p.numero ? `Nota N° ${p.numero}` : 'Nota');
    // Datos de la nota para la cola sin señal (el cobro se muestra antes de subir)
    const resumen = (p) => ({ cliente: p.cliente, total: p.total, cliente_id: p.cliente_id, numero: p.numero });
    const pedirPago = (p, preguntar) => abrirCobro({ total: p.total, numero: p.numero, cliente: p.cliente, preguntar,
      forma: FORMAS_PAGO[p.forma_pago] ? p.forma_pago : 'efectivo',
      credito: { deuda: deudas.get?.(p.cliente_id)?.deuda ?? 0, limite: p.limite_credito ?? null } });
    if (b.dataset.entregar) {
      const p = todos.find((x) => x.id === b.dataset.entregar);
      if (!datos.porCobrar(p)) return marcar([p.id], true, `${nom(p)} entregada`);
      // Sin pago registrado: al entregar se pregunta cómo pagó (efectivo con vuelto, transferencia o crédito)
      const r = await pedirPago(p, true);
      if (!r) { b.disabled = false; return; }
      try {
        if (r.cobrado) await datos.registrarCobro(p.id, true, r.forma, resumen(p));
        return marcar([p.id], true, r.cobrado ? `${nom(p)} entregada · ${textoPago(r)}` : `${nom(p)} entregada · falta registrar el pago`);
      } catch (err) { b.disabled = false; aviso(err.message, 'error'); return; }
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
    if (b.dataset.deshacer) {
      const p = todos.find((x) => x.id === b.dataset.deshacer);
      return marcar([p.id], false, `${nom(p)} vuelve a "Por entregar"`);
    }
    const ns = porEntregar.filter(deRuta).filter(coincide).filter((p) => (b.dataset.todos === 'sin' ? p.ruta_id == null : String(p.ruta_id) === b.dataset.todos));
    const sinCobrar = ns.filter((p) => datos.porCobrar(p)).length;
    if (!confirm(`¿Marcar como entregadas las ${ns.length} notas de ${nombreRuta(b.dataset.todos === 'sin' ? null : b.dataset.todos)} (${clp(ns.reduce((s, p) => s + p.total, 0))})?${sinCobrar ? `\n\n${sinCobrar} quedan sin pago registrado: regístralo después en "Por cobrar".` : ''}`)) { b.disabled = false; return; }
    marcar(ns.map((p) => p.id), true, plural(ns.length, 'nota entregada', 'notas entregadas'));
  });
  $('#q', v).addEventListener('input', (e) => { busqueda = e.target.value; pintar(); });
  $('#ruta-p', v).addEventListener('change', (e) => { rutaSel = e.target.value; pintar(); });
  pintar();
}
