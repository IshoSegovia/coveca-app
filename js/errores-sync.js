// Errores silenciosos (pedido del 21-10-2026; migración 0050).
// La app ya guardaba en el celular sus últimos errores (js/registro.js) y solo los mandaba dentro de un ticket. Ahora
// los sube sola, de cualquier usuario (vendedor o administrador), para que soporte los vea ("Errores
// registrados") aunque nadie los reporte. Solo viajan errores técnicos ya limpios (sin correos, RUT, teléfonos, montos
// ni lo escrito en campos); nunca el rastro de acciones ni capturas.
// Cuándo: al abrir la app, al volver a ella y al recuperar la señal, como máximo cada 30 min, solo con sesión y señal
// buena. Nunca en el modo de ejemplo ni en pruebas automáticas. Si falla, se reintenta 30 min después.
import * as datos from './datos.js';
import { erroresPorSubir, erroresSubidos } from './registro.js';
import { versionLocal } from './actualizacion.js';
import { esApp } from './nativo.js';
import { esEscritorio } from './escritorio.js';

const K_ULTIMA = 'coveca-errores-subida';
const CADA = 30 * 60e3;
let subiendo = false;
const leerPrueba = () => { try { return localStorage.getItem('coveca-errores-prueba'); } catch (_) { return null; } };

export async function subirErrores({ forzar = false } = {}) {
  if (subiendo || datos.enDemo() || !datos.usuario()) return;
  if (navigator.webdriver && leerPrueba() !== '1') return;   // pruebas automáticas: solo si la prueba lo pide
  let ultima = 0;
  try { ultima = Number(localStorage.getItem(K_ULTIMA)) || 0; } catch (_) { /* sin almacenamiento */ }
  if (!forzar && Date.now() - ultima < CADA) return;
  const lista = erroresPorSubir();
  if (!lista.length) return;
  subiendo = true;
  try {
    const v = versionLocal();
    const errores = lista.map((x) => ({ id: x.id, m: x.m, o: x.o, p: x.p, c: x.c, op: x.op, n: x.n || 1, t: x.t, t0: x.t0 || x.t }));
    const ok = await datos.registrarErrores(errores, `${v.nombre}${v.codigo ? ` (${v.codigo})` : ''}`,
      esApp ? 'App Android' : esEscritorio() ? 'Web en PC' : 'Web en celular');
    if (ok) erroresSubidos(lista);
    // También si falló: el próximo intento espera 30 min (no compite con la subida de pedidos cada vez que se vuelve).
    try { localStorage.setItem(K_ULTIMA, String(Date.now())); } catch (_) { /* sin almacenamiento */ }
  } finally { subiendo = false; }
}

// Al volver a la app, unos segundos después: primero se suben los pedidos y lo demás de la cola (main.js).
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(subirErrores, 20000); });
addEventListener('online', () => setTimeout(() => subirErrores({ forzar: true }), 5000));
