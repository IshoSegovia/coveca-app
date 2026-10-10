// Recorrido de una ruta: orden óptimo de los clientes pendientes y navegación por tramos en Google Maps.
import { $, esc, barra, icono, vacio, aviso, DIAS } from '../ui.js';
import * as datos from '../datos.js';
import { miUbicacion, optimizar, tramos, urlTramo, largoKm, tieneGps, urlPunto, PARADAS_POR_TRAMO } from '../gps.js';
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

export async function vistaRecorrido(v, rutaId) {
  animarArranque();
  const r = await datos.ruta(rutaId);
  const todos = await datos.clientes({ rutaId });
  barra({ titulo: 'Recorrido', sub: r.nombre, atras: `#/rutas/${rutaId}` });
  const base = r.base_lat != null ? { lat: r.base_lat, lng: r.base_lng, nombre: r.base_nombre || 'Base de la ruta' } : null;
  let incluirAtendidos = false;
  let partida = base ? 'base' : 'actual';   // 'base' | 'actual'
  let actual = null, buscandoActual = false;
  const inicio = () => (partida === 'base' ? base : actual);

  const textoPartida = () => partida === 'base'
    ? `Ordenado desde ${base.nombre}.`
    : actual ? 'Ordenado desde tu ubicación actual.'
    : buscandoActual ? 'Buscando tu ubicación…' : 'Sin ubicación actual: se parte del primer cliente.';

  const pintar = () => {
    const lista = todos.filter((c) => incluirAtendidos || !c.atendido);
    const conGps = lista.filter(tieneGps), sinGps = lista.filter((c) => !tieneGps(c));
    const ruta = optimizar(conGps, inicio());
    const ts = tramos(ruta);
    const kmTotal = largoKm(ruta, inicio());
    // Origen de cada tramo: con base, el tramo 1 parte de la base y los siguientes de la última parada anterior.
    const origenTramo = (i) => (partida !== 'base' ? null : i === 0 ? base : ts[i - 1][ts[i - 1].length - 1]);
    v.innerHTML = !lista.length ? vacio(incluirAtendidos ? 'Esta ruta no tiene clientes' : 'No quedan clientes pendientes', '¡Ruta completa!')
      : `
      <div class="resumen">
        <div><p class="resumen-n">${ruta.length}</p><p>Paradas</p></div>
        <div><p class="resumen-n">${Math.round(kmTotal * 1.3)}</p><p>km aprox.</p></div>
        <div><p class="resumen-n">${ts.length}</p><p>Tramo${ts.length === 1 ? '' : 's'}</p></div>
      </div>
      <fieldset class="opciones pad partida"><legend>Punto de partida</legend>
        ${base ? `<label class="opcion"><input type="radio" name="partida" value="base" ${partida === 'base' ? 'checked' : ''}>
          <span class="opcion-txt">${esc(base.nombre)}<small>Base de la ruta</small></span>
          <a class="btn link mini-link" data-externo href="${urlPunto(base)}">Ver</a></label>` : ''}
        <label class="opcion"><input type="radio" name="partida" value="actual" ${partida === 'actual' ? 'checked' : ''}>
          <span class="opcion-txt">Mi ubicación actual<small>Usa el GPS del celular</small></span></label>
        ${!base && datos.esAdmin() ? `<a class="btn link" href="#/rutas/${rutaId}/editar">Definir una base para esta ruta</a>` : ''}
      </fieldset>
      <p class="ayuda pad">${esc(textoPartida())} Los km son una estimación; Google Maps calcula el camino real.</p>
      <label class="check pad"><input id="atendidos" type="checkbox" ${incluirAtendidos ? 'checked' : ''}> Incluir clientes ya atendidos</label>
      ${sinGps.length ? `<a class="nota-falta" href="#/rutas/${rutaId}">${sinGps.length} cliente${sinGps.length === 1 ? '' : 's'} sin ubicación GPS no entra${sinGps.length === 1 ? '' : 'n'} en el recorrido: ${esc(sinGps.slice(0, 3).map((c) => c.nombre).join(', '))}${sinGps.length > 3 ? '…' : ''}. Agrégala desde su perfil.</a>` : ''}
      ${ts.map((t, i) => `
        <h2 class="sec-t">Tramo ${i + 1} · paradas ${i * PARADAS_POR_TRAMO + 1}–${i * PARADAS_POR_TRAMO + t.length}</h2>
        <div class="lista">${t.map((c, j) => `
          <a class="fila" href="#/clientes/${c.id}"><span class="parada">${i * PARADAS_POR_TRAMO + j + 1}</span>
            <div class="fila-txt"><p class="fila-t">${esc(c.nombre)}</p><p class="fila-s">${esc([c.direccion, c.comuna].filter(Boolean).join(', ') || '')}</p></div>
            ${c.atendido ? `<span class="chip ok">${icono('check', 'ico-s')} Atendido</span>` : ''}</a>`).join('')}
        </div>
        <div class="pad tramo-acc"><button class="btn ${i === 0 ? 'prin' : 'sec'}" data-tramo="${i}">${icono('rutas')} Abrir tramo ${i + 1} en Google Maps</button></div>`).join('')}
      ${datos.esAdmin() && ruta.length > 1 ? `<div class="pad"><button id="guardar-orden" class="btn link">Guardar este orden como orden de visita de la ruta</button></div>` : ''}`;
    $('#atendidos', v)?.addEventListener('change', (e) => { incluirAtendidos = e.target.checked; pintar(); });
    v.querySelectorAll('input[name="partida"]').forEach((rb) => rb.addEventListener('change', (e) => {
      partida = e.target.value;
      if (partida === 'actual' && !actual) buscarActual(); else pintar();
    }));
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
