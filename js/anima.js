// Animaciones de la app (bocetos en docs/rediseno/animaciones.html). Todas duran menos de 2 s, no bloquean la pantalla
// (pointer-events: none) y se apagan con "reducir movimiento" del teléfono.
import { vibrar as vibrarSi, sentir } from './sentir.js';
const reducir = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const fuera = (el, ms) => setTimeout(() => el.remove(), ms);

// Vibración suave (Android; se apaga en Ajustes). Sin permiso o en iPhone no hace nada.
export const vibrar = (ms = 12) => vibrarSi(ms);

// Un cuadrito vuela desde el producto hasta la barra del total, que late una vez.
export function vuelaAlTotal(desde, hasta) {
  if (!desde || !hasta || reducir()) return;
  const a = desde.getBoundingClientRect(), b = hasta.getBoundingClientRect();
  const el = document.createElement('i');
  el.className = 'anim-vuela';
  el.style.left = `${a.left + a.width / 2 - 14}px`; el.style.top = `${a.top + a.height / 2 - 14}px`;
  el.style.setProperty('--dx', `${b.left + 60 - (a.left + a.width / 2)}px`);
  el.style.setProperty('--dy', `${b.top + b.height / 2 - (a.top + a.height / 2)}px`);
  document.body.appendChild(el); fuera(el, 700);
  setTimeout(() => { hasta.classList.remove('anim-late'); void hasta.offsetWidth; hasta.classList.add('anim-late'); }, 560);
}

// Número que cuenta hasta el valor nuevo (total del pedido, ventas de la semana).
export function contar(el, de, a, fmt, dur = 600) {
  if (!el) return;
  if (reducir() || de === a) { el.textContent = fmt(a); return; }
  const ini = performance.now();
  const paso = (t) => { const p = Math.min(1, (t - ini) / dur); el.textContent = fmt(de + (a - de) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(paso); };
  requestAnimationFrame(paso);
}

const CAMION = '<svg class="anim-camion" viewBox="0 0 124 92" aria-hidden="true"><path d="M2 46h12M6 56h10M0 66h12" stroke="var(--azul-suave)" stroke-width="3.5" stroke-linecap="round"/><rect x="18" y="32" width="56" height="38" rx="3" fill="var(--papel)" stroke="var(--hero)" stroke-width="3"/><rect x="18" y="58" width="56" height="6" fill="var(--rojo)"/><path d="M74 45h15l11 13v12H74z" fill="var(--hero)"/><path d="M79 49h8l7 8H79z" fill="var(--azul-suave)"/><circle cx="34" cy="72" r="8" fill="var(--texto)"/><circle cx="34" cy="72" r="3" fill="var(--papel)"/><circle cx="87" cy="72" r="8" fill="var(--texto)"/><circle cx="87" cy="72" r="3" fill="var(--papel)"/></svg>';

// Entregar: el camión cruza, aparece el círculo verde y el visto se dibuja (sobre la pantalla, sin tapar los toques).
export function entregado(texto = '¡Entregado!', sub = '') {
  sentir('exito');
  if (reducir()) return;
  const el = document.createElement('div');
  el.className = 'anim-entrega'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="anim-entrega-caja"><div class="anim-pista">${CAMION}</div>
    <svg class="anim-ok" viewBox="0 0 96 96"><circle cx="48" cy="48" r="44" fill="var(--verde-relleno)"/><path d="M28 49l13 13 27-28" fill="none" stroke="var(--papel)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <p class="anim-msg"><b>${texto}</b>${sub ? `<small>${sub}</small>` : ''}</p></div>`;
  document.body.appendChild(el); fuera(el, 2300);
}

// Monedas que caen sobre el vuelto (al confirmar un pago en efectivo con vuelto).
export function monedas(sobre) {
  if (!sobre || reducir()) return;
  const r = sobre.getBoundingClientRect();
  const capa = document.createElement('div'); capa.className = 'anim-capa'; capa.setAttribute('aria-hidden', 'true');
  [0.2, 0.4, 0.6, 0.3, 0.5].forEach((x, i) => {
    const m = document.createElement('i'); m.className = 'anim-moneda'; m.textContent = '$';
    m.style.left = `${r.left + r.width * x}px`; m.style.top = `${r.top - 120}px`;
    m.style.setProperty('--y', `${110 + (i > 2 ? -14 : 0)}px`); m.style.animationDelay = `${i * 0.12}s`;
    capa.appendChild(m);
  });
  document.body.appendChild(capa); fuera(capa, 1800);
}

// Papel picado con los colores de la marca (¡Ruta al día!, una vez).
export function papelPicado() {
  if (reducir()) return;
  const capa = document.createElement('div'); capa.className = 'anim-capa'; capa.setAttribute('aria-hidden', 'true');
  const cols = ['var(--rojo)', 'var(--oro)', 'var(--hero)', 'var(--hero-ok)'];
  for (let i = 0; i < 28; i++) {
    const e = document.createElement('i'); e.className = 'anim-confeti';
    e.style.left = `${4 + Math.random() * 92}%`; e.style.background = cols[i % 4];
    e.style.animationDelay = `${Math.random() * 0.5}s`;
    e.style.setProperty('--x', `${(Math.random() - 0.5) * 90}px`); e.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    capa.appendChild(e);
  }
  document.body.appendChild(capa); fuera(capa, 2600);
}

// Siluetas mientras carga (en vez de la ruedita): imitan tarjetas y filas.
export const siluetas = () => `<div class="siluetas" aria-label="Cargando" role="status">
  <i style="height:14px;width:40%"></i><i style="height:26px;width:70%"></i><i class="g" style="height:150px"></i>
  <i class="f"></i><i class="f"></i><i class="f"></i></div>`;

// La C pixelada se arma cuadrito por cuadrito al abrir la app (solo mientras carga; máx. ~1,6 s).
const C = ['.####..', '#######', '###..##', '##.....', '##.....', '##.....', '##.....', '###..##', '#######', '.####..'];
export function pantallaInicio() {
  if (reducir() || navigator.webdriver) return () => {};   // pruebas automáticas (capturas, auditoría): sin pantalla de inicio
  const el = document.createElement('div');
  el.className = 'inicio-c'; el.setAttribute('aria-hidden', 'true');
  let k = 0, px = '';
  C.forEach((f, j) => [...f].forEach((c, i) => { if (c === '#') px += `<i style="left:${40 + i * 10}px;top:${25 + j * 10}px;animation-delay:${0.25 + (k++) * 0.012}s"></i>`; }));
  el.innerHTML = `<div class="inicio-circulo">${px}</div><p class="inicio-nombre">COVECA</p>`;
  document.body.appendChild(el);
  const t0 = Date.now();
  return () => setTimeout(() => { el.classList.add('sale'); fuera(el, 320); }, Math.max(0, 1100 - (Date.now() - t0)));
}

// Medalla de nivel en pixel art (Bronce, Plata, Oro, Platino). i = índice del nivel (0–3).
const FORMA = ['..####..', '.#oooo#.', '#oo**oo#', '#o****o#', '#o****o#', '#oo**oo#', '.#oooo#.', '..####..', '...##...', '..#..#..', '.#....#.'];
const COLORES = [['var(--medalla-0)', 'var(--nivel-0)'], ['var(--medalla-1)', 'var(--nivel-1)'], ['var(--oro)', 'var(--nivel-2)'], ['var(--medalla-3)', 'var(--nivel-3)']];
export function medalla(i, cls = '') {
  const [c, o] = COLORES[Math.max(0, Math.min(3, i))];
  let r = '';
  FORMA.forEach((f, j) => [...f].forEach((ch, x) => { const col = ch === '#' ? o : ch === 'o' ? c : ch === '*' ? 'var(--papel)' : null; if (col) r += `<rect x="${x}" y="${j}" width="1.02" height="1.02" fill="${col}"/>`; }));
  return `<svg class="medalla-px ${cls}" viewBox="0 0 8 11" aria-hidden="true" shape-rendering="crispEdges">${r}</svg>`;
}
