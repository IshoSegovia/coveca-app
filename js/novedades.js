// Lo nuevo de cada actualización (decisión de Francisco, 16-10-2026: opción A + B).
// A: al abrir por primera vez una versión con cambios visibles sale "La app se actualizó" con la lista de lo nuevo;
//    "Muéstrame" recorre las pantallas con el mismo motor del recorrido (etiqueta roja "Nuevo").
// B: "Ahora no" deja una cinta arriba del inicio (Rutas) hasta que se vea o se cierre.
// Fuente: www/novedades.json, cada entrada { titulo, puntos, pasos? }; pasos = [{ ir: '#/...', sel: ['selector', ...], t, s }].
// Se recuerda por equipo el título de la última entrada vista (coveca-novedades). No sale en el modo de ejemplo
// ni a un usuario nuevo (ese ve el recorrido completo).
import { recorrer } from './tour.js';
import { icono, esc, plural } from './ui.js';

const VISTA = 'coveca-novedades', CINTA = 'coveca-novedades-cinta', MAX = 3;
const leer = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const guardar = (k, val) => { try { if (val == null) localStorage.removeItem(k); else localStorage.setItem(k, val); } catch (_) {} };
let lista = null;
const cargar = async () => (lista ||= await fetch('novedades.json').then((r) => r.json()).catch(() => []));

// Entradas publicadas después de la última vista (máx. 3). Sin registro previo (quien ya usaba la app antes de esto): las 3 últimas.
async function pendientes() {
  const l = await cargar();
  const i = l.findIndex((n) => n.titulo === leer(VISTA));
  return l.slice(0, i < 0 ? MAX : Math.min(i, MAX));
}
const marcarVistas = async () => { const l = await cargar(); if (l[0]) guardar(VISTA, l[0].titulo); };

// Usuario nuevo: vio el recorrido completo, así que lo publicado hasta hoy ya no es "nuevo" para él.
export const novedadesVistas = () => { marcarVistas(); };

const pasosDe = (ns) => ns.flatMap((n) => n.pasos || []).map((p) => ({ ...p, sel: [p.sel] }));
const mostrarRecorrido = (ns) => recorrer(pasosDe(ns), { etiqueta: 'Nuevo', fin: 'Listo', nuevo: true });

// Ventana "La app se actualizó". cinta = al tocar "Ahora no" se deja la cinta en el inicio.
export function mostrarNovedades(ns, { cinta = true } = {}) {
  if (!ns.length || document.querySelector('.nv-ventana')) return;
  const hayPasos = pasosDe(ns).length > 0, version = window.COVECA_VERSION?.nombre;
  const el = document.createElement('div');
  el.className = 'nv-ventana';
  el.innerHTML = `<div class="nv-velo"></div>
    <div class="nv-modal" role="dialog" aria-modal="true" aria-labelledby="nv-t">
      <span class="nv-sello">Nuevo</span><h2 id="nv-t" class="nv-t">La app se actualizó</h2>
      <p class="nv-v">${version && version !== 'desarrollo' ? `Versión ${esc(version)} · ` : ''}esto es lo nuevo:</p>
      <ul class="nv-lista">${ns.map((n) => `<li><span class="nv-ico" aria-hidden="true">${icono('chispa')}</span>
        <div><b>${esc(n.titulo)}</b><small>${esc(n.puntos?.[0] || '')}</small></div></li>`).join('')}</ul>
      <div class="nv-pie">${hayPasos ? '<button type="button" class="btn sec nv-no">Ahora no</button><button type="button" class="btn prin nv-si">Muéstrame</button>'
        : '<button type="button" class="btn prin nv-ok">Entendido</button>'}</div></div>`;
  document.body.appendChild(el);
  document.getElementById('vista')?.setAttribute('inert', '');
  const cerrar = () => { el.remove(); window.covecaCerrarVisor = null; document.getElementById('vista')?.removeAttribute('inert'); };
  const ahoraNo = () => { if (cinta && hayPasos) guardar(CINTA, JSON.stringify(ns.map((n) => n.titulo))); cerrar();
    const v = document.getElementById('vista'); if (/^#\/rutas\/?$|^$/.test(location.hash) && v) cintaNovedades(v); };
  el.querySelector('.nv-no')?.addEventListener('click', ahoraNo);
  el.querySelector('.nv-ok')?.addEventListener('click', cerrar);
  el.querySelector('.nv-si')?.addEventListener('click', () => { guardar(CINTA, null); cerrar(); mostrarRecorrido(ns); });
  window.covecaCerrarVisor = hayPasos ? ahoraNo : cerrar;   // botón atrás de Android
  el.querySelector('.nv-si, .nv-ok').focus();
}

// Al abrir la app con sesión real: si hay entradas nuevas, se marcan vistas y sale la ventana.
export async function abrirNovedades() {
  const ns = await pendientes();
  if (!ns.length) return;
  await marcarVistas();
  mostrarNovedades(ns);
}

// Cinta del inicio (opción B): queda hasta tocar "Ver" o ×.
export async function cintaNovedades(v) {
  let titulos; try { titulos = JSON.parse(leer(CINTA) || 'null'); } catch (_) { titulos = null; }
  if (!titulos?.length || v.querySelector('.nv-cinta')) return;
  const ns = (await cargar()).filter((n) => titulos.includes(n.titulo));
  if (!ns.length) { guardar(CINTA, null); return; }
  const version = window.COVECA_VERSION?.nombre;
  v.insertAdjacentHTML('afterbegin', `<div class="nv-cinta" role="status"><span class="nv-ico" aria-hidden="true">${icono('chispa')}</span>
    <div class="nv-cinta-txt"><b>${version && version !== 'desarrollo' ? `Versión ${esc(version)}` : 'Lo nuevo de la app'}</b>${plural(ns.length, 'novedad', 'novedades')}</div>
    <button type="button" class="btn prin nv-ver">Ver</button><button type="button" class="nv-x" aria-label="Cerrar aviso de novedades">${icono('cerrar')}</button></div>`);
  const quitar = () => { guardar(CINTA, null); v.querySelector('.nv-cinta')?.remove(); };
  v.querySelector('.nv-ver').addEventListener('click', () => { quitar(); mostrarRecorrido(ns); });
  v.querySelector('.nv-x').addEventListener('click', quitar);
}
