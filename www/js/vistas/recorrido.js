// Recorrido de una ruta: orden óptimo de los clientes pendientes y navegación por tramos en Google Maps.
import { $, esc, barra, icono, vacio, aviso, DIAS } from '../ui.js';
import * as datos from '../datos.js';
import { miUbicacion, optimizar, tramos, urlTramo, largoKm, tieneGps, PARADAS_POR_TRAMO } from '../gps.js';
import { abrirExterno } from '../externo.js';

export async function vistaRecorrido(v, rutaId) {
  const r = await datos.ruta(rutaId);
  const todos = await datos.clientes({ rutaId });
  barra({ titulo: 'Recorrido', sub: r.nombre, atras: `#/rutas/${rutaId}` });
  let incluirAtendidos = false, inicio = null, origen = 'Sin ubicación actual: se parte del primer cliente.';

  const pintar = () => {
    const base = todos.filter((c) => incluirAtendidos || !c.atendido);
    const conGps = base.filter(tieneGps), sinGps = base.filter((c) => !tieneGps(c));
    const ruta = optimizar(conGps, inicio);
    const ts = tramos(ruta);
    const kmTotal = largoKm(ruta, inicio);
    v.innerHTML = !base.length ? vacio(incluirAtendidos ? 'Esta ruta no tiene clientes' : 'No quedan clientes pendientes', '¡Ruta completa!')
      : `
      <div class="resumen">
        <div><p class="resumen-n">${ruta.length}</p><p>Paradas</p></div>
        <div><p class="resumen-n">${Math.round(kmTotal * 1.3)}</p><p>km aprox.</p></div>
        <div><p class="resumen-n">${ts.length}</p><p>Tramo${ts.length === 1 ? '' : 's'}</p></div>
      </div>
      <p class="ayuda pad">${esc(origen)} Los km son una estimación; Google Maps calcula el camino real.</p>
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
    v.querySelectorAll('[data-tramo]').forEach((b) => b.addEventListener('click', () => abrirExterno(urlTramo(ts[Number(b.dataset.tramo)]))));
    $('#guardar-orden', v)?.addEventListener('click', async () => {
      try { await datos.ordenarRuta(ruta.map((c) => c.id)); aviso('Orden de visita guardado'); } catch (e) { aviso(e.message, 'error'); }
    });
  };

  v.innerHTML = '<div class="cargando" aria-label="Buscando tu ubicación"></div><p class="ayuda" style="text-align:center">Buscando tu ubicación para ordenar el recorrido…</p>';
  try { inicio = await miUbicacion({ precisa: false, espera: 8000 }); origen = 'Ordenado desde tu ubicación actual.'; }
  catch (_) { /* sin GPS: se ordena desde el primer cliente */ }
  pintar();
}
