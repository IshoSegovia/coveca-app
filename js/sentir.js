// Vibración y sonido de la app, y celebración de logros con la largada de F1 (decisión del 22-10-2026).
// - sentir(tipo): vibración corta según lo que pasó (toque, éxito, atención, error).
// - celebrar(titulo): pórtico con 5 luces que baja desde arriba; cada luz roja lleva un tono y una vibración,
//   y en la partida las luces pasan a verde con el texto del logro. Luces, sonido y vibración siguen el mismo
//   reloj (el del audio, descontando su retraso de salida), para que vayan sincronizados.
// Ambos vienen activados y se apagan en Ajustes. El sonido solo suena si el celular está en modo normal
// (en silencio o en vibración, solo vibra). Con "reducir movimiento" no hay pórtico.
import { esApp, Compartir } from './nativo.js';

const VIBRACION = 'coveca-vibracion', SONIDO = 'coveca-sonido-logros';
const leer = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
export const vibracionActiva = () => leer(VIBRACION) !== '0';
export const sonidoActivo = () => leer(SONIDO) !== '0';
export function activar(cual, si) {
  try { localStorage.setItem(cual === 'sonido' ? SONIDO : VIBRACION, si ? '1' : '0'); } catch (_) { /* no se recordará */ }
}

const PATRONES = { toque: 12, exito: [18, 70, 18], atencion: [220], error: [40, 60, 40, 60, 40] };
export function vibrar(patron) {
  if (!vibracionActiva()) return;
  try { navigator.vibrate?.(patron); } catch (_) { /* sin permiso o en iPhone: no hace nada */ }
}
export const sentir = (tipo) => vibrar(PATRONES[tipo] ?? PATRONES.toque);

// ---------------- Largada ----------------
const LUCES = [0.2, 0.5, 0.8, 1.1, 1.4];   // segundos desde el inicio, una luz roja cada 0,3 s
const PARTIDA = 1.88;                      // se apagan las rojas: partida (verde)
const FIN = 3.6;                           // el pórtico vuelve a subir
// Capas que no se tapan: la celebración espera a que se cierren (impresión, cobro, avisos, recorrido, escáner…),
// y tampoco sale mientras se arma un pedido o una cotización (frente al cliente).
const OCUPADO = '.imp-capa, .cobro-capa, .act-capa, .nv-ventana, .at-ventana, .ac-ventana, .tour, .mas-capa, .visor-foto, .catalogo, .anim-entrega, .escaner';
const armando = () => /^#\/clientes\/[^/]+\/(pedido|cotizacion)|^#\/cotizaciones\/(nueva|[^/]+\/convertir)/.test(location.hash);
const ocupado = () => document.hidden || armando() || !!document.querySelector(OCUPADO);
const reducir = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

async function timbreNormal() {
  if (!esApp) return true;
  try { const r = await Promise.race([Compartir.modoTimbre(), new Promise((_, no) => setTimeout(no, 800))]); return r?.modo === 'normal'; }
  catch (_) { return false; }   // APK anterior o error: mejor no sonar
}

function tono(ctx, inicio, frecuencia, duracion, volumen) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = 'sine'; osc.frequency.value = frecuencia;
  g.gain.setValueAtTime(0.0001, inicio);
  g.gain.exponentialRampToValueAtTime(volumen, inicio + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(inicio); osc.stop(inicio + duracion + 0.05);
}

// Reloj de la largada: el del audio si suena (así las luces caen justo con cada tono), si no el del navegador.
async function prepararReloj() {
  if (sonidoActivo() && await timbreNormal()) {
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      const ctx = new C();
      await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 400))]);
      if (ctx.state === 'running') {
        const t0 = ctx.currentTime + 0.05;
        // Retraso hasta el parlante: se lee en cada cuadro porque el navegador lo ajusta mientras suena.
        const retraso = () => (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
        LUCES.forEach((s) => tono(ctx, t0 + s, 587, 0.12, 0.12));
        tono(ctx, t0 + PARTIDA, 1175, 0.45, 0.15);
        return { ahora: () => ctx.currentTime - retraso() - t0, cerrar: () => { try { ctx.close(); } catch (_) { /* nada */ } } };
      }
      try { ctx.close(); } catch (_) { /* nada */ }
    } catch (_) { /* sin audio: sigue en silencio */ }
  }
  const p0 = performance.now() + 50;
  return { ahora: () => (performance.now() - p0) / 1000, cerrar: () => {} };
}

const cola = [];
let corriendo = false;

// Celebra un logro. Si hay una ventana encima, la app está en segundo plano o se está armando un pedido, espera
// (sin plazo: el logro no se pierde). Varios logros juntos salen uno tras otro; el mismo logro (clave) no se repite.
// alMostrar se llama cuando la largada empieza (logros.js guarda ahí que ya se celebró).
export function celebrar(titulo, { portico = true, clave = null, alMostrar = null } = {}) {
  if (navigator.webdriver && !window.covecaLogrosPrueba) return;   // pruebas automáticas (capturas, auditoría): sin celebración
  if (clave && cola.some((l) => l.clave === clave)) return;
  cola.push({ titulo, portico, clave, alMostrar });
  if (!corriendo) siguiente();
}

function siguiente() {
  const l = cola[0];
  if (!l) { corriendo = false; return; }
  corriendo = true;
  if (ocupado()) { setTimeout(siguiente, 700); return; }
  cola.shift();
  try { l.alMostrar?.(); } catch (_) { /* nada */ }
  largada(l).catch(() => {}).then(() => setTimeout(siguiente, 400));
}

async function largada({ titulo, portico }) {
  const reloj = await prepararReloj();
  const conPortico = portico && !reducir();
  if (portico && !conPortico) import('./ui.js').then((u) => u.aviso(titulo)).catch(() => {});   // reducir movimiento: el logro en texto
  let el = null, luces = [];
  if (conPortico) {
    el = document.createElement('div');
    el.className = 'logro-portico';
    el.setAttribute('role', 'status');
    el.innerHTML = `<div class="logro-caja"><span class="logro-luces" aria-hidden="true">${'<i></i>'.repeat(5)}</span>
      <span class="logro-t"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>${titulo.replace(/[<>&]/g, '')}</span></div>`;
    document.body.appendChild(el);
    luces = [...el.querySelectorAll('.logro-luces i')];
    requestAnimationFrame(() => el.classList.add('baja'));
  }
  let encendidas = 0, partio = false;
  await new Promise((listo) => {
    const cuadro = () => {
      const t = reloj.ahora();
      while (encendidas < LUCES.length && t >= LUCES[encendidas]) {
        luces[encendidas]?.classList.add('roja');
        vibrar(40);
        encendidas += 1;
      }
      if (!partio && t >= PARTIDA) {
        partio = true;
        el?.classList.add('partida');
        vibrar(320);
      }
      if (t >= FIN) { listo(); return; }
      requestAnimationFrame(cuadro);
    };
    requestAnimationFrame(cuadro);
    setTimeout(listo, (FIN + 2) * 1000);   // por si la pantalla deja de dibujar (app en segundo plano)
  });
  reloj.cerrar();
  if (el) { el.classList.remove('baja'); setTimeout(() => el.remove(), 400); }
}
