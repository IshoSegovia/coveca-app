// Recorrido "Cómo funciona" en 10 pasos sobre la app real: oscurece la pantalla, enmarca una zona y la explica
// con una tarjeta (Atrás / Siguiente). Sale siempre al entrar en el modo de ejemplo y, con sesión real, solo la primera
// vez de cada usuario en el equipo (decisión de Francisco, 16-10-2026). También desde Ajustes → "Cómo funciona la app".
// Solo navega y mira: no agrega productos ni guarda nada.
import { esEscritorio } from './escritorio.js';

import { usuario } from './datos.js';

const CLAVE = 'coveca-tour';   // + ':<id del usuario>' = ya lo vio. La clave sola (2.0.11) = el equipo ya lo vio.
const claveUsuario = () => `${CLAVE}:${usuario()?.id ?? ''}`;
const hrefDe = (sel) => document.querySelector(sel)?.getAttribute('href');

// Cada paso: a dónde ir (null = quedarse), qué enmarcar (grupos alternativos: se usa el primero que exista) y el texto.
const PASOS = [
  { ir: () => '#/rutas', sel: [['.hero'], ['.hero-vacio'], ['.fila']], t: 'Tu ruta del día',
    s: 'Aquí ves la ruta de hoy, cuántos clientes llevas visitados y lo que falta entregar o cobrar.' },
  { ir: () => null, sel: [['.semana']], t: 'Tu semana',
    s: 'Lo que llevas vendido de lunes a domingo, cuánto falta para la meta y los días con ventas.' },
  { ir: () => hrefDe('.hero a[href^="#/rutas/"]') || hrefDe('a.fila[href^="#/rutas/"]'), sel: [['.cli-ruta']], t: 'Elige el cliente',
    s: 'Toca un cliente para abrir su ficha y tomar el pedido. Los visitados quedan marcados.' },
  { ir: () => hrefDe('.cli-ruta'), sel: [['.pie-fijo']], t: 'La ficha del cliente',
    s: 'Aquí ves su historial y su crédito. Genera el pedido o, si no compró nada, toca Marcar visitado.' },
  { ir: () => { const c = location.hash.match(/^#\/clientes\/\d+$/)?.[0]; return c ? `${c}/pedido` : '#/nuevo'; }, sel: [['#repetir', '#escanear'], ['.buscador']], t: 'Agrega productos',
    s: 'Repetir trae su último pedido. También puedes buscar o escanear el código de barras.' },
  { ir: () => null, sel: [['#sig']], t: 'Genera la nota',
    s: 'Cuando termines, toca Revisar pedido y genera la nota: sale por la impresora o la envías por WhatsApp.' },
  { ir: () => '#/pedidos', sel: [['.fila.entrega'], ['.filtros']], t: 'Entrega y cobra',
    s: 'Al entregar, toca Entregar y registra cómo pagó: efectivo con vuelto, transferencia o crédito.' },
  { ir: () => '#/reportes', sel: [['a[href="#/reportes/cierre"]']], t: 'Cierre del día',
    s: 'Al terminar el día, el Cierre te dice cuánto efectivo y transferencias rendir, y qué quedó por cobrar.' },
  { ir: () => null, sel: [['#barra a[href="#/ajustes"]'], ['#tabs [data-tab="ajustes"]']], t: 'Antes de salir a ruta',
    s: 'En Ajustes conectas la impresora y ves lo guardado sin señal. Sin señal igual puedes vender: todo se sube después.' },
  { ir: () => '#/rutas', sel: [['#tabs']], t: 'Todo a mano',
    s: () => (esEscritorio() ? 'En el menú tienes Clientes, Pedidos, Inventario, Reportes y el Cierre del día.'
      : 'Con el + tomas un pedido nuevo. En Más están Inventario, Reportes y el Cierre del día.') },
];

export const tourPendiente = () => { try { return !localStorage.getItem(claveUsuario()) && !localStorage.getItem(CLAVE); } catch (_) { return false; } };

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Primer grupo de selectores que exista (de cada selector, el primero). Espera hasta 4 s a que la vista lo dibuje.
async function buscar(grupos) {
  for (let t = 0; t < 40; t++) {
    for (const g of grupos) {
      const els = g.map((s) => [...document.querySelectorAll(s)].find((e) => e.getClientRects().length)).filter(Boolean);   // solo los visibles
      if (els.length === g.length) return els;
    }
    await espera(100);
  }
  return [];
}

export function abrirTour() {
  try { localStorage.setItem(claveUsuario(), '1'); } catch (_) {}
  recorrer(PASOS);
}

// Motor del recorrido (también lo usa js/novedades.js para mostrar lo nuevo de una versión).
// pasos: [{ ir: hash | () => hash | null, sel: [[selectores]], t, s }]. etiqueta = texto rojo/azul arriba de la tarjeta.
export function recorrer(pasos, { etiqueta = 'Cómo funciona', fin = 'Empezar', nuevo = false } = {}) {
  if (document.querySelector('.tour') || !pasos.length) return;
  const el = document.createElement('div');
  el.className = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'tour-t');
  el.innerHTML = '<div class="tour-foco" hidden></div><div class="tour-card"></div>';
  document.body.appendChild(el);
  const foco = el.querySelector('.tour-foco'), card = el.querySelector('.tour-card');
  const rutas = [];   // a dónde fue cada paso, para volver con "Atrás"
  let i = 0, marco = null, turno = 0;

  const cerrar = () => {
    el.remove(); window.covecaCerrarVisor = null; removeEventListener('resize', ubicar);
    if (location.hash !== '#/rutas') location.hash = '#/rutas';
  };

  // Marco alrededor de los elementos y tarjeta debajo, arriba, al lado o (si no cabe) abajo de la pantalla.
  function ubicar() {
    const W = innerWidth, H = innerHeight, P = 8, w = Math.min(420, W - 32);
    card.style.width = `${w}px`; card.removeAttribute('data-lado');
    if (!marco?.length) { foco.hidden = true; Object.assign(card.style, { left: `${(W - w) / 2}px`, top: '', bottom: '24px' }); return; }
    const rs = marco.map((e) => e.getBoundingClientRect());
    const r = { x: Math.max(6, Math.min(...rs.map((a) => a.left)) - P), y: Math.max(6, Math.min(...rs.map((a) => a.top)) - P) };
    r.r = Math.min(W - 6, Math.max(...rs.map((a) => a.right)) + P); r.b = Math.min(H - 6, Math.max(...rs.map((a) => a.bottom)) + P);
    foco.hidden = false;
    Object.assign(foco.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.r - r.x}px`, height: `${r.b - r.y}px` });
    const ch = card.offsetHeight, mitad = (r.x + r.r) / 2;
    let left = Math.min(Math.max(16, mitad - w / 2), W - w - 16), top = null, bottom = null, lado = null;
    if (H - r.b >= ch + 24) { top = r.b + 16; lado = 'abajo'; }
    else if (r.y >= ch + 24) { bottom = H - r.y + 16; lado = 'arriba'; }
    else if (W - r.r >= w + 32) { left = r.r + 20; top = Math.min(Math.max(16, (r.y + r.b) / 2 - ch / 2), H - ch - 16); }
    else bottom = 16;
    Object.assign(card.style, { left: `${left}px`, top: top == null ? '' : `${top}px`, bottom: bottom == null ? '' : `${bottom}px` });
    if (lado) { card.dataset.lado = lado; card.style.setProperty('--flecha', `${Math.min(Math.max(20, mitad - left - 8), w - 36)}px`); }
  }

  async function pintar(atras) {
    const yo = ++turno, p = pasos[i], ultimo = i === pasos.length - 1;
    card.innerHTML = `<p class="tour-et ${nuevo ? 'nuevo' : ''}">${etiqueta} <span>${i + 1} de ${pasos.length}</span></p>
      <h2 id="tour-t" class="tour-t">${p.t}</h2><p class="tour-s">${typeof p.s === 'function' ? p.s() : p.s}</p>
      <div class="tour-pie"><div class="tour-puntos" aria-hidden="true">${pasos.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
        ${i ? '<button type="button" class="btn sec tour-atras">Atrás</button>' : '<button type="button" class="btn link tour-saltar">Saltar</button>'}
        <button type="button" class="btn prin tour-sig">${ultimo ? fin : 'Siguiente'}</button></div>`;
    card.querySelector('.tour-sig').onclick = () => { if (ultimo) cerrar(); else { i++; pintar(); } };
    card.querySelector('.tour-saltar')?.addEventListener('click', cerrar);
    card.querySelector('.tour-atras')?.addEventListener('click', () => { i--; pintar(true); });
    card.hidden = true; foco.hidden = true;
    const destino = atras ? rutas[i] : (rutas[i] = (typeof p.ir === 'function' ? p.ir() : p.ir) || location.hash);
    if (destino && destino !== location.hash) {
      const antes = document.getElementById('vista')?.firstElementChild;
      location.hash = destino;
      for (let t = 0; t < 30 && document.getElementById('vista')?.firstElementChild === antes; t++) await espera(100);
    }
    const els = await buscar(p.sel);
    if (yo !== turno) return;   // ya se pasó a otro paso
    els[0]?.scrollIntoView({ block: 'center', behavior: 'instant' });
    await espera(150);
    marco = els; card.hidden = false; ubicar();
    card.querySelector('.tour-sig').focus();
  }

  addEventListener('resize', ubicar);
  window.covecaCerrarVisor = cerrar;   // botón atrás de Android
  pintar();
}
