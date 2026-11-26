// Logros del vendedor: cuándo celebrar con la largada (sentir.js). Decisión del 22-10-2026.
// Cada logro se celebra una sola vez y solo cuando ocurre: el equipo recuerda si ya lo vio sin cumplir
// ("0") y lo celebra al pasar a cumplido. La marca "1" (ya celebrado) se guarda recién cuando la largada
// se muestra: si la app se cierra antes, el logro sale la próxima vez. Si la primera vez que se mira ya
// estaba cumplido (p. ej. la meta se pasó en otro equipo), se marca sin celebrar.
import * as datos from './datos.js';
import { celebrar } from './sentir.js';
import { clp } from './ui.js';

const HITOS_NOTAS = [100, 250, 500, 1000, 2500, 5000];
const llave = (clave) => `coveca-logro:${datos.usuario()?.id || 'x'}:${clave}`;
const leer = (k) => { try { return localStorage.getItem(k); } catch (_) { return '1'; } };   // sin almacenamiento: no celebra
const poner = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* nada */ } };

// ¿Toca celebrar? antesCumplia = false cuando se sabe que justo antes no se cumplía (la venta recién hecha lo cruzó).
function cruce(clave, cumple, antesCumplia = null) {
  const k = llave(clave), antes = leer(k);
  if (!cumple) { if (antes === null) poner(k, '0'); return null; }
  if (antes === '1') return null;
  if (antes === '0' || antesCumplia === false) return () => poner(k, '1');
  poner(k, '1');   // primera vez que se mira y ya estaba cumplido
  return null;
}

function festejar(clave, cumple, titulo, opciones = {}, antesCumplia = null) {
  const marcar = cruce(clave, cumple, antesCumplia);
  if (marcar) celebrar(titulo, { ...opciones, clave: llave(clave), alMostrar: marcar });
}

// Ruta de hoy con todos sus clientes visitados (inicio y lista de la ruta).
export function revisarRuta(ruta, clientes, hoy) {
  if (!ruta?.id || !clientes?.length) return;
  festejar(`ruta:${hoy}:${ruta.id}`, clientes.every((c) => c.atendido), '¡Ruta completa!');
}

// Meta de la semana y semana anterior superada (inicio y después de cada venta).
// venta = total de la nota recién guardada (para saber si fue justo esa la que cruzó la meta).
export function revisarSemana(s, meta, venta = 0) {
  if (!s?.lunes) return;
  meta = Number(meta) || 0;
  const antes = s.total - venta;
  if (meta > 0) festejar(`meta:${s.lunes}`, s.total >= meta, '¡Meta de la semana!', {}, venta ? antes >= meta : null);
  if (s.anterior > 0) festejar(`semana:${s.lunes}`, s.total > s.anterior, '¡Superaste la semana pasada!', {}, venta ? antes > s.anterior : null);
}

// Después de guardar una nota nueva: semana, récord del día y notas propias. Lee solo lo que está en el celular
// (no consulta al servidor, salvo el conteo de notas como máximo cada 30 min). No espera ni lanza errores.
let ultimoConteo = 0;
export async function revisarVenta(nota) {
  const extra = nota?.id ? [{ id: nota.id, fecha: nota.fecha, total: nota.total, estado: 'generado' }] : [];
  const venta = Number(nota?.total) || 0;
  try {
    const [s, cfg] = await Promise.all([datos.semanaVentas({ soloEquipo: true, extra }), datos.configuracion().catch(() => null)]);
    revisarSemana(s, cfg?.meta_semanal, venta);   // configuracion() = datos del negocio
  } catch (_) { /* sin datos: se revisa la próxima vez */ }
  try {
    const r = await datos.recordDia({ soloEquipo: true, extra });
    // Solo con historia suficiente (5 días con venta) y superando de verdad el mejor día.
    if (r.diasConVenta >= 5 && r.mejor > 0) festejar(`record:${r.hoy}`, r.totalHoy > r.mejor, `¡Récord del día! ${clp(r.totalHoy)}`, {}, venta ? r.totalHoy - venta > r.mejor : null);
  } catch (_) { /* nada */ }
  if (Date.now() - ultimoConteo < 30 * 60000) return;
  ultimoConteo = Date.now();
  try {
    const n = await datos.misNotas();
    if (n != null) HITOS_NOTAS.forEach((h) => festejar(`notas:${h}`, n >= h, `¡${h.toLocaleString('es-CL')} notas!`, {}, n - 1 >= h));
  } catch (_) { /* nada */ }
}
