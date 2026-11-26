// Temporadas de la tarjeta "Ruta de hoy" (por fecha de Chile): cambian el color, el adorno y la etiqueta.
// Cada una tiene un inicio, una fecha de celebración (`meta`, para la cuenta regresiva) y un último día en que se muestra (`hasta`).

const utc = (a, m, d) => Date.UTC(a, m - 1, d);

// Domingo de Pascua (algoritmo de Meeus/Jones/Butcher).
function pascua(a) {
  const g = a % 19, c = Math.floor(a / 100);
  const h = (c - Math.floor(c / 4) - Math.floor((8 * c + 13) / 25) + 19 * g + 15) % 30;
  const i = h - Math.floor(h / 28) * (1 - Math.floor(29 / (h + 1)) * Math.floor((21 - g) / 11));
  const j = (a + Math.floor(a / 4) + i + 2 - c + Math.floor(c / 4)) % 7;
  const l = i - j;
  const m = 3 + Math.floor((l + 40) / 44);
  return utc(a, m, l + 28 - 31 * Math.floor(m / 4));
}

// Segundo domingo del mes (Día de la Madre en mayo, Día del Niño en agosto).
const segundoDomingo = (a, m) => utc(a, m, 1 + ((7 - new Date(utc(a, m, 1)).getUTCDay()) % 7) + 7);

const DIA = 864e5;

// Orden de revisión; ninguna ventana se cruza con otra. `meta: null` = sin cuenta regresiva.
const TEMPORADAS = [
  { id: 'enamorados', t: 'Enamorados', para: 'el Día de los Enamorados', ini: (a) => utc(a, 2, 1), meta: (a) => utc(a, 2, 14) },
  { id: 'clases', t: 'Vuelta a clases', ini: (a) => utc(a, 2, 23), hasta: (a) => utc(a, 3, 6), meta: null },
  { id: 'pascua', t: 'Pascua', ini: (a) => pascua(a) - 14 * DIA, meta: (a) => pascua(a) },
  { id: 'madre', t: 'Día de la Madre', para: 'el Día de la Madre', ini: (a) => utc(a, 5, 1), meta: (a) => segundoDomingo(a, 5) },
  { id: 'ninos', t: 'Día del Niño', para: 'el Día del Niño', ini: (a) => utc(a, 8, 1), meta: (a) => segundoDomingo(a, 8) },
  { id: 'patrias', t: 'Fiestas Patrias', ini: (a) => utc(a, 9, 8), meta: (a) => utc(a, 9, 18), hasta: (a) => utc(a, 9, 19) },
  { id: 'halloween', t: 'Halloween', ini: (a) => utc(a, 10, 20), meta: (a) => utc(a, 10, 31) },
  { id: 'navidad', t: 'Navidad', ini: (a) => utc(a, 12, 1), meta: (a) => utc(a, 12, 25) },
  // Año Nuevo cruza el cambio de año: se revisa también con el año anterior.
  { id: 'ano', t: 'Año Nuevo', ini: (a) => utc(a, 12, 26), meta: (a) => utc(a + 1, 1, 1) },
];

// `iso` = AAAA-MM-DD. Devuelve { id, t (etiqueta), para ("Faltan N días para …"), quedan } (quedan = días hasta la fecha, o null) o null si hoy no hay temporada.
export function temporada(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const hoy = utc(a, m, d);
  for (const año of [a, a - 1]) {
    for (const s of TEMPORADAS) {
      const meta = s.meta ? s.meta(año) : null;
      const hasta = s.hasta ? s.hasta(año) : meta;
      if (hoy >= s.ini(año) && hoy <= hasta) return { id: s.id, t: s.t, para: s.para || s.t, quedan: meta == null ? null : Math.round((meta - hoy) / DIA) };
    }
  }
  return null;
}

const svg = (dentro) => `<svg class="hero-adorno" viewBox="0 0 48 48" aria-hidden="true">${dentro}</svg>`;

export const ADORNO = {
  halloween: svg('<path d="M24 14c-10 0-16 6-16 14s6 12 16 12 16-4 16-12-6-14-16-14z" fill="var(--halloween)"/><path d="M24 14V7" stroke="var(--luz-lista)" stroke-width="4" stroke-linecap="round"/><path d="M16 25l4-3 2 4zM32 25l-4-3-2 4zM16 32c5 3 11 3 16 0" fill="var(--hero-halloween)" stroke="var(--hero-halloween)" stroke-width="1.5"/>'),
  patrias: svg('<rect x="4" y="10" width="40" height="28" rx="3" fill="var(--papel)"/><rect x="4" y="24" width="40" height="14" fill="var(--rojo)"/><rect x="4" y="10" width="15" height="14" fill="var(--azul-oscuro)"/><path d="M11.5 13.5l1.3 3.6h3.7l-3 2.3 1.1 3.6-3.1-2.2-3.1 2.2 1.1-3.6-3-2.3h3.7z" fill="var(--papel)"/>'),
  navidad: svg('<path d="M24 6l9 13h-5l8 11h-6l8 10H10l8-10h-6l8-11h-5z" fill="var(--hero-ok)"/><rect x="21" y="40" width="6" height="5" fill="var(--ambar-relleno)"/><circle cx="24" cy="6" r="3" fill="var(--oro)"/>'),
  ninos: svg('<ellipse cx="24" cy="19" rx="11" ry="13" fill="var(--oro)"/><path d="M21 32l3 4 3-4z" fill="var(--oro)"/><path d="M24 36c-3 3 3 5 0 9" stroke="var(--papel)" stroke-width="1.5" fill="none" stroke-linecap="round"/>'),
  ano: svg('<path d="M24 6l3.5 11.5L39 21l-11.5 3.5L24 36l-3.5-11.5L9 21l11.5-3.5z" fill="var(--oro)"/><path d="M39 32l1.5 4.5L45 38l-4.5 1.5L39 44l-1.5-4.5L33 38l4.5-1.5z" fill="var(--papel)"/>'),
  enamorados: svg('<path d="M24 41C9 31 7 20 13 14c4-4 9-2 11 3 2-5 7-7 11-3 6 6 4 17-11 27z" fill="var(--rosa)"/>'),
  pascua: svg('<path d="M24 6c-8 0-14 13-14 21a14 14 0 0028 0c0-8-6-21-14-21z" fill="var(--oro)"/><path d="M11 28c4-3 7 3 13 0s9 3 13 0" stroke="var(--hero-pascua)" stroke-width="2.5" fill="none" stroke-linecap="round"/>'),
  madre: svg('<g fill="var(--rosa)"><circle cx="24" cy="12" r="8"/><circle cx="35" cy="20" r="8"/><circle cx="31" cy="33" r="8"/><circle cx="17" cy="33" r="8"/><circle cx="13" cy="20" r="8"/></g><circle cx="24" cy="24" r="6" fill="var(--oro)"/>'),
  clases: svg('<g transform="rotate(45 24 24)"><rect x="19" y="6" width="10" height="28" fill="var(--oro)"/><path d="M19 34h10l-5 9z" fill="var(--papel)"/><path d="M22 40h4l-2 3z" fill="var(--hero-clases)"/><rect x="19" y="3" width="10" height="5" rx="1" fill="var(--rosa)"/></g>'),
};
