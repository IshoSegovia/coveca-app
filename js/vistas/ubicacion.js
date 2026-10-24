// Bloque "Ubicación GPS" de un cliente: ver, tomar con el GPS del celular o pegar enlace/coordenadas.
import { $, esc, icono, aviso, fecha } from '../ui.js';
import * as datos from '../datos.js';
import { miUbicacion, leerCoordenadas, tieneGps, urlPunto, coordTxt } from '../gps.js';

export function ubicacionHtml(c) {
  return `<div class="ubic ${tieneGps(c) ? 'ok' : 'falta'}">
    <div class="ubic-estado">${icono('mapa')}
      <div><p class="fila-t">${tieneGps(c) ? 'Ubicación GPS guardada' : 'Sin ubicación GPS'}</p>
        <p class="fila-s">${tieneGps(c) ? `${esc(coordTxt(c))}${c.ubicacion_actualizada_en ? ' · ' + fecha(c.ubicacion_actualizada_en) : ''}` : 'Necesaria para planificar el recorrido de la ruta.'}</p></div>
      ${tieneGps(c) ? `<a class="btn link" href="${urlPunto(c)}" data-externo>Ver mapa</a>` : ''}
    </div>
    <div class="ubic-acc">
      <button type="button" class="btn sec" data-gps="aqui">${icono('mapa')} ${tieneGps(c) ? 'Actualizar con mi ubicación' : 'Usar mi ubicación actual'}</button>
      <button type="button" class="btn link" data-gps="pegar">Pegar enlace de Google Maps o coordenadas</button>
      <div class="ubic-pegar" hidden>
        <label class="campo"><span>Enlace o "latitud, longitud"</span>
          <input type="text" inputmode="url" placeholder="https://maps.google.com/… o -35.97, -72.32"></label>
        <button type="button" class="btn sec" data-gps="guardar">Guardar ubicación</button>
      </div>
      ${tieneGps(c) && datos.esAdmin() ? '<button type="button" class="btn link quitar" data-gps="quitar">Quitar ubicación</button>' : ''}
    </div>
  </div>`;
}

export function activarUbicacion(v, c, alTerminar) {
  const caja = $('.ubic', v);
  if (!caja) return;
  const guardar = async (lat, lng, msg) => {
    await datos.guardarUbicacion(c.id, lat, lng);
    aviso(msg);
    alTerminar();
  };
  caja.querySelector('[data-gps="aqui"]').addEventListener('click', async (e) => {
    const b = e.currentTarget, txt = b.innerHTML;
    b.disabled = true; b.textContent = 'Obteniendo ubicación…';
    try {
      const u = await miUbicacion();
      if (u.precision > 100 && !confirm(`La señal GPS es imprecisa (±${u.precision} m). ¿Guardar igual? Si estás en el local, espera unos segundos al aire libre y vuelve a intentar.`)) throw null;
      await guardar(u.lat, u.lng, `Ubicación guardada (±${u.precision} m)`);
    } catch (err) { if (err) aviso(err.message, 'error'); b.disabled = false; b.innerHTML = txt; }
  });
  caja.querySelector('[data-gps="pegar"]').addEventListener('click', () => {
    const p = caja.querySelector('.ubic-pegar'); p.hidden = !p.hidden; if (!p.hidden) p.querySelector('input').focus();
  });
  caja.querySelector('[data-gps="guardar"]').addEventListener('click', async () => {
    try { const { lat, lng } = leerCoordenadas(caja.querySelector('.ubic-pegar input').value); await guardar(lat, lng, 'Ubicación guardada'); }
    catch (err) { aviso(err.message, 'error'); }
  });
  caja.querySelector('[data-gps="quitar"]')?.addEventListener('click', async () => {
    if (!confirm('¿Quitar la ubicación GPS de este cliente?')) return;
    try { await guardar(null, null, 'Ubicación quitada'); } catch (err) { aviso(err.message, 'error'); }
  });
}
