// Recorrido de una ruta: se eligen los clientes de la salida, se ordenan (GPS por cercanía; sin GPS por dirección,
// al final) y se abre la navegación por tramos en Google Maps. El orden se puede ajustar con flechas.
import { $, esc, barra, icono, vacio, aviso, plural } from '../ui.js';
import * as datos from '../datos.js';
import { miUbicacion, optimizar, tramos, urlTramo, largoKm, tieneGps, tieneDireccion, urlPunto, PARADAS_POR_TRAMO } from '../gps.js';
import { abrirExterno } from '../externo.js';

// Animación de entrada: un auto recorre el camino pasando por las paradas (≈1,6 s, no bloquea la pantalla).
function animarArranque() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelector('.arranque')?.remove();
  const capa = document.createElement('div');
  capa.className = 'arranque';
  capa.setAttribute('aria-hidden', 'true');
  capa.style.top = `${document.getElementById('barra').getBoundingClientRect().bottom}px`;
  capa.innerHTML = `
    <div class="arranque-escena">
      <span class="arranque-parada" style="--i:0"></span><span class="arranque-parada" style="--i:1"></span><span class="arranque-parada" style="--i:2"></span>
      <svg class="arranque-meta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>
      <div class="arranque-camino"></div>
      <svg class="arranque-auto" viewBox="0 0 64 32">
        <path class="auto-cuerpo" d="M6 22v-6l6-1 7-7h20l9 7 9 2v5H6z"/>
        <path class="auto-vidrio" d="M21 10h8v6H15zM32 10h6l7 6H32z"/>
        <g class="auto-rueda"><circle cx="18" cy="24" r="5"/><circle cx="18" cy="24" r="1.8" class="auto-llanta"/></g>
        <g class="auto-rueda"><circle cx="49" cy="24" r="5"/><circle cx="49" cy="24" r="1.8" class="auto-llanta"/></g>
      </svg>
    </div>
    <p class="arranque-txt">¡En marcha!</p>`;
  document.body.appendChild(capa);
  setTimeout(() => capa.remove(), 1800);
}

const direccionCorta = (c) => [c.direccion, c.comuna].filter(Boolean).join(', ');

// Clientes elegidos por ruta (se recuerdan mientras la app esté abierta, al volver desde una ficha).
const elegidosPorRuta = new Map();

export async function vistaRecorrido(v, rutaId) {
  animarArranque();
  const r = await datos.ruta(rutaId);
  const todos = await datos.clientes({ rutaId });
  barra({ titulo: 'Recorrido', sub: r.nombre, atras: `#/rutas/${rutaId}` });
  const base = r.base_lat != null ? { lat: r.base_lat, lng: r.base_lng, nombre: r.base_nombre || 'Base de la ruta' } : null;
  // Por defecto entran los clientes por visitar; se puede elegir quiénes van hoy.
  if (!elegidosPorRuta.has(rutaId)) elegidosPorRuta.set(rutaId, new Set(todos.filter((c) => !c.atendido).map((c) => c.id)));
  const elegidos = elegidosPorRuta.get(rutaId);
  let ordenManual = null;              // ids en el orden que dejó el vendedor con las flechas
  let abiertoElegir = true;
  let partida = base ? 'base' : 'actual';   // 'base' | 'actual'
  let actual = null, buscandoActual = false;
  const inicio = () => (partida === 'base' ? base : actual);

  const textoPartida = () => partida === 'base'
    ? `Ordenado desde ${base.nombre}.`
    : actual ? 'Ordenado desde tu ubicación actual.'
    : buscandoActual ? 'Buscando tu ubicación…' : 'Sin ubicación actual: se parte del primer cliente.';

  // Orden: los que tienen GPS se ordenan por cercanía; los que no, van al final y Google Maps los busca por dirección.
  const calcular = () => {
    const sel = todos.filter((c) => elegidos.has(c.id));
    const fuera = sel.filter((c) => !tieneGps(c) && !tieneDireccion(c));
    const porDireccion = sel.filter((c) => !tieneGps(c) && tieneDireccion(c));
    let ruta = [...optimizar(sel.filter(tieneGps), inicio()), ...porDireccion];
    if (ordenManual) {
      const porId = new Map(ruta.map((c) => [c.id, c]));
      const quedan = ordenManual.filter((id) => porId.has(id)).map((id) => porId.get(id));
      ruta = [...quedan, ...ruta.filter((c) => !ordenManual.includes(c.id))];
    }
    return { sel, fuera, porDireccion, ruta };
  };

  const filaElegir = (c) => `
    <label class="opcion elegir"><input type="checkbox" data-id="${c.id}" ${elegidos.has(c.id) ? 'checked' : ''}>
      <span class="opcion-txt">${esc(c.nombre)}<small>${esc(direccionCorta(c) || 'Sin dirección')}</small></span>
      ${c.atendido ? `<span class="chip ok">${icono('check', 'ico-s')} Visitado</span>` : ''}
      ${tieneGps(c) ? '' : '<span class="chip">Sin GPS</span>'}</label>`;

  const pintar = () => {
    const { sel, fuera, porDireccion, ruta } = calcular();
    const ts = tramos(ruta);
    const conGps = ruta.filter(tieneGps);
    const kmTotal = largoKm(conGps, inicio());
    // Origen de cada tramo: con base, el tramo 1 parte de la base y los siguientes de la última parada anterior.
    const origenTramo = (i) => (partida !== 'base' ? null : i === 0 ? base : ts[i - 1][ts[i - 1].length - 1]);
    const scroll = v.scrollTop;
    v.innerHTML = !todos.length ? vacio('Esta ruta no tiene clientes') : `
      <div class="resumen">
        <div><p class="resumen-n">${ruta.length}</p><p>Paradas</p></div>
        <div><p class="resumen-n">${Math.round(kmTotal * 1.3)}</p><p>km aprox.</p></div>
        <div><p class="resumen-n">${ts.length}</p><p>Tramo${ts.length === 1 ? '' : 's'}</p></div>
      </div>
      <details class="elegir-caja" ${abiertoElegir ? 'open' : ''}>
        <summary><span>Clientes de esta salida</span><span class="chip">${sel.length} de ${todos.length}</span></summary>
        <p class="ayuda">Marca solo los que vas a visitar en esta salida. Los demás quedan para otro día.</p>
        <div class="elegir-rapido">
          <button type="button" class="btn link" data-todos="pendientes">Solo por visitar</button>
          <button type="button" class="btn link" data-todos="todos">Todos</button>
          <button type="button" class="btn link" data-todos="ninguno">Ninguno</button>
        </div>
        <div class="opciones">${todos.map(filaElegir).join('')}</div>
      </details>
      <fieldset class="opciones pad partida"><legend>Punto de partida</legend>
        ${base ? `<label class="opcion"><input type="radio" name="partida" value="base" ${partida === 'base' ? 'checked' : ''}>
          <span class="opcion-txt">${esc(base.nombre)}<small>Base de la ruta</small></span>
          <a class="btn link mini-link" data-externo href="${urlPunto(base)}">Ver</a></label>` : ''}
        <label class="opcion"><input type="radio" name="partida" value="actual" ${partida === 'actual' ? 'checked' : ''}>
          <span class="opcion-txt">Mi ubicación actual<small>Usa el GPS del celular</small></span></label>
        ${!base && datos.esAdmin() ? `<a class="btn link" href="#/rutas/${rutaId}/editar">Definir una base para esta ruta</a>` : ''}
      </fieldset>
      <p class="ayuda pad">${esc(textoPartida())} Los km son una estimación${porDireccion.length ? ' (sin contar los clientes sin GPS)' : ''}; Google Maps calcula el camino real.</p>
      ${porDireccion.length ? `<p class="nota-falta">${plural(porDireccion.length, 'cliente')} sin GPS va${porDireccion.length === 1 ? '' : 'n'} al final y Google Maps lo${porDireccion.length === 1 ? '' : 's'} busca por su dirección. Muévelos con las flechas si quedan en otro punto del camino. Al llegar, guarda su ubicación desde su ficha.</p>` : ''}
      ${fuera.length ? `<p class="nota-falta alerta">${plural(fuera.length, 'cliente')} sin GPS ni dirección no puede${fuera.length === 1 ? '' : 'n'} entrar: ${esc(fuera.slice(0, 3).map((c) => c.nombre).join(', '))}${fuera.length > 3 ? '…' : ''}. Agrega su dirección en su ficha.</p>` : ''}
      ${!ruta.length ? vacio('No hay clientes elegidos', 'Marca arriba los clientes que vas a visitar.') : ''}
      ${ordenManual ? '<div class="pad"><button id="recalcular" class="btn link izq">Volver al orden calculado</button></div>' : ''}
      ${ts.map((t, i) => `
        <h2 class="sec-t">Tramo ${i + 1} · paradas ${i * PARADAS_POR_TRAMO + 1}–${i * PARADAS_POR_TRAMO + t.length}</h2>
        <div class="lista">${t.map((c, j) => { const n = i * PARADAS_POR_TRAMO + j; return `
          <div class="fila parada-fila"><span class="parada">${n + 1}</span>
            <a class="fila-txt" href="#/clientes/${c.id}"><p class="fila-t">${esc(c.nombre)}</p>
              <p class="fila-s">${esc(direccionCorta(c))}${tieneGps(c) ? '' : ' · <b class="txt-ambar">sin GPS: por dirección</b>'}</p></a>
            <div class="mover">
              <button type="button" class="cant-btn" data-mover="${n}" data-d="-1" aria-label="Subir ${esc(c.nombre)}" ${n === 0 ? 'disabled' : ''}>${icono('arriba')}</button>
              <button type="button" class="cant-btn" data-mover="${n}" data-d="1" aria-label="Bajar ${esc(c.nombre)}" ${n === ruta.length - 1 ? 'disabled' : ''}>${icono('abajo')}</button>
            </div></div>`; }).join('')}
        </div>
        <div class="pad tramo-acc"><button class="btn ${i === 0 ? 'prin' : 'sec'}" data-tramo="${i}">${icono('rutas')} Abrir tramo ${i + 1} en Google Maps</button></div>`).join('')}
      ${datos.esAdmin() && ruta.length > 1 ? `<div class="pad"><button id="guardar-orden" class="btn link">Guardar este orden como orden de visita de la ruta</button></div>` : ''}`;
    v.scrollTop = scroll;
    $('details.elegir-caja', v)?.addEventListener('toggle', (e) => { abiertoElegir = e.target.open; });
    v.querySelectorAll('.elegir input[type="checkbox"]').forEach((cb) => cb.addEventListener('change', () => {
      const id = Number(cb.dataset.id);
      if (cb.checked) elegidos.add(id); else elegidos.delete(id);
      pintar();
    }));
    v.querySelectorAll('[data-todos]').forEach((b) => b.addEventListener('click', () => {
      elegidos.clear();
      todos.filter((c) => b.dataset.todos === 'todos' || (b.dataset.todos === 'pendientes' && !c.atendido)).forEach((c) => elegidos.add(c.id));
      pintar();
    }));
    v.querySelectorAll('input[name="partida"]').forEach((rb) => rb.addEventListener('change', (e) => {
      partida = e.target.value; ordenManual = null;
      if (partida === 'actual' && !actual) buscarActual(); else pintar();
    }));
    v.querySelectorAll('[data-mover]').forEach((b) => b.addEventListener('click', () => {
      const ids = ruta.map((c) => c.id), i = Number(b.dataset.mover), j = i + Number(b.dataset.d);
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      ordenManual = ids; pintar();
    }));
    $('#recalcular', v)?.addEventListener('click', () => { ordenManual = null; pintar(); });
    v.querySelectorAll('[data-tramo]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.tramo);
      abrirExterno(urlTramo(ts[i], origenTramo(i)));
    }));
    $('#guardar-orden', v)?.addEventListener('click', async () => {
      try { await datos.ordenarRuta(ruta.map((c) => c.id)); aviso('Orden de visita guardado'); } catch (e) { aviso(e.message, 'error'); }
    });
  };

  async function buscarActual() {
    buscandoActual = true; pintar();
    try { actual = await miUbicacion({ precisa: false, espera: 8000 }); }
    catch (e) { aviso(e.message, 'error'); }
    buscandoActual = false; pintar();
  }

  if (partida === 'actual') await buscarActual(); else pintar();
}

