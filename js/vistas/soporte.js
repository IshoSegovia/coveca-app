// Soporte (#/soporte): ayuda para usar la app (recorrido y novedades) y, para administradores, los tickets.
// En el celular se abre desde "Más"; en PC, desde el menú lateral.
import { $, esc, barra, icono } from '../ui.js';
import * as datos from '../datos.js';
import { abrirTour } from '../tour.js';
import { mostrarNovedades } from '../novedades.js';

export function vistaSoporte(v) {
  barra({ titulo: 'Soporte' });
  const admin = datos.esAdmin();
  v.innerHTML = `
    <p class="ayuda pad mt">¿Algo no funciona o tienes una idea? Aquí lo reportas y aprendes a usar la app.</p>
    <h2 class="sec-t">Ayuda</h2>
    <div class="lista"><button type="button" class="fila fila-btn" id="ver-tour">
      <span class="ruta-ico" aria-hidden="true">${icono('rutas')}</span>
      <div class="fila-txt"><p class="fila-t">Cómo funciona la app</p><p class="fila-s">Recorrido de 10 pasos por la app</p></div>
      ${icono('derecha', 'ico-chev')}</button></div>
    <div id="novedades"></div>
    ${admin ? `<h2 class="sec-t">Reportes a soporte</h2>
    <div class="lista"><a class="fila" href="#/tickets">
      <span class="ruta-ico" aria-hidden="true">${icono('lista')}</span>
      <div class="fila-txt"><p class="fila-t">Tickets de soporte</p><p class="fila-s">Abiertos y resueltos, con su solución</p></div>
      ${icono('derecha', 'ico-chev')}</a></div>
    <div class="pie-fijo"><a class="btn prin" id="reportar" href="#/tickets/nuevo">${icono('mas')} Reportar un problema o mejora</a></div>` : ''}`;
  $('#ver-tour', v).addEventListener('click', abrirTour);
  // Novedades de la versión instalada (www/novedades.json)
  fetch('novedades.json').then((r) => r.json()).then((l) => {
    const n = l?.[0]; if (!n?.puntos?.length || !v.isConnected) return;
    $('#novedades', v).innerHTML = `<details class="elegir-caja"><summary><span>Novedades de esta versión</span></summary>
      <p class="fila-t">${esc(n.titulo || '')}</p><ul class="act-nov">${n.puntos.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      ${n.pasos?.length ? '<button type="button" id="ver-novedades" class="btn sec">Mostrarme lo nuevo</button>' : ''}</details>`;
    $('#ver-novedades', v)?.addEventListener('click', () => mostrarNovedades([n], { cinta: false }));
  }).catch(() => {});
}
