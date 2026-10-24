// Cobro de notas en efectivo o transferencia (migración 0038) y estado de la nota: Pedido → Entregado → Pagado.
// - abrirCobro(): hoja inferior "¿Cómo pagó?" (efectivo con calculadora de vuelto, transferencia o crédito).
// - vueltoHtml()/activarVuelto(): calculadora de vuelto (total, recibido, vuelto) de esa hoja.
// - pasosHtml(): línea de estado. ilustracion(): dibujos propios de COVECA (planos, colores de la marca).
import { sentir } from '../sentir.js';
import { esc, icono, clp, ZONA } from '../ui.js';
import { monedas } from '../anima.js';

const fechaCorta = (f) => new Date(f).toLocaleDateString('es-CL', { timeZone: ZONA, day: '2-digit', month: '2-digit' }).replace(/\//g, '-');
const FORMAS = { efectivo: 'efectivo', transferencia: 'transferencia', credito: 'credito' };

// ---------------- Calculadora de vuelto ----------------
// Billetes chilenos: sugerencias de "recibido" por encima del total.
function sugerencias(total) {
  const s = new Set([total]);
  for (const b of [5000, 10000, 20000, 50000]) { const r = Math.ceil(total / b) * b; if (r > total) s.add(r); }   // billetes comunes
  return [...s].sort((a, b) => a - b).slice(0, 4);
}
const vueltoHtml = (total) => `<div class="vuelto" data-total="${total}">
    <div class="vuelto-fila"><label for="recibido">Recibido</label>
      <input id="recibido" class="vuelto-in" type="number" inputmode="numeric" min="0" step="1" placeholder="${clp(total)}" autocomplete="off"></div>
    <div class="vuelto-rapido" role="group" aria-label="Montos rápidos">${sugerencias(total).map((m) =>
      `<button type="button" class="chip-btn" data-recibido="${m}">${m === total ? 'Justo' : clp(m)}</button>`).join('')}</div>
    <p class="vuelto-res" aria-live="polite"></p>
  </div>`;
function activarVuelto(caja) {
  if (!caja) return;
  const total = () => Number(caja.dataset.total) || 0;
  const inp = caja.querySelector('.vuelto-in'), res = caja.querySelector('.vuelto-res');
  const pintar = () => {
    const r = Math.floor(Number(inp.value) || 0);
    if (!inp.value) { res.className = 'vuelto-res'; res.innerHTML = ''; return; }
    const d = r - total();
    if (d > 0 && !res.classList.contains('ok')) setTimeout(() => monedas(res), 30);   // caen monedas sobre el vuelto
    res.className = `vuelto-res ${d >= 0 ? 'ok' : 'falta'}`;
    res.innerHTML = d >= 0 ? `<span>Vuelto</span><strong class="monto">${clp(d)}</strong>`
      : `<span>${icono('alerta', 'ico-s')} Faltan</span><strong class="monto">${clp(-d)}</strong>`;
  };
  inp.addEventListener('input', pintar);
  caja.querySelectorAll('[data-recibido]').forEach((b) => b.addEventListener('click', () => { inp.value = b.dataset.recibido; pintar(); }));
  caja.actualizar = (t) => {   // cambia el total (p. ej. al poner un descuento)
    caja.dataset.total = t; inp.placeholder = clp(t);
    caja.querySelector('.vuelto-rapido').innerHTML = sugerencias(t).map((m) =>
      `<button type="button" class="chip-btn" data-recibido="${m}">${m === t ? 'Justo' : clp(m)}</button>`).join('');
    caja.querySelectorAll('[data-recibido]').forEach((b) => b.addEventListener('click', () => { inp.value = b.dataset.recibido; pintar(); }));
    pintar();
  };
}

// ---------------- Hoja de pago (al entregar) ----------------
// Efectivo (con vuelto), transferencia o crédito. preguntar = true (al tocar Entregar): ofrece "Entregar sin registrar el pago".
// credito = { deuda, limite } del cliente para avisar si supera el límite (avisa y deja seguir).
// Devuelve { cobrado, forma } o null si se cancela.
export function abrirCobro({ total, numero, cliente, preguntar = false, forma = 'efectivo', credito = null }) {
  return new Promise((resolver) => {
    const capa = document.createElement('div');
    capa.className = 'cobro-capa'; capa.setAttribute('role', 'dialog'); capa.setAttribute('aria-modal', 'true');
    capa.setAttribute('aria-labelledby', 'cobro-t');
    capa.innerHTML = `<div class="cobro-hoja">
      <p id="cobro-t" class="cobro-t">${preguntar ? '¿Cómo pagó?' : 'Registrar pago'}</p>
      <p class="fila-s">${numero ? `Nota N° ${numero} · ` : ''}${esc(cliente || '')}</p>
      <div class="cobro-total"><span>Total</span><strong class="monto">${clp(total)}</strong></div>
      <div class="segmento cobro-forma" role="radiogroup" aria-label="Forma de pago">
        <button type="button" role="radio" data-f="efectivo">${icono('dinero', 'ico-s')} Efectivo</button>
        <button type="button" role="radio" data-f="transferencia">${icono('moneda', 'ico-s')} Transf.</button>
        <button type="button" role="radio" data-f="credito">${icono('reloj', 'ico-s')} Crédito</button>
      </div>
      <div class="cobro-vuelto">${vueltoHtml(total)}</div>
      <div class="cobro-credito" hidden>${textoCredito(total, credito)}</div>
      <button type="button" class="btn prin" data-ok>Confirmar pago</button>
      ${preguntar ? `<button type="button" class="btn sec" data-pendiente>Entregar sin registrar el pago</button>` : ''}
      <button type="button" class="btn link" data-cancelar>Cancelar</button>
    </div>`;
    // Lo de atrás queda inactivo mientras la hoja está abierta (ni toques ni lector de pantalla)
    const fondo = [...document.body.children].filter((e) => !e.inert);
    const cerrar = (r) => { fondo.forEach((e) => { e.inert = false; }); capa.remove(); document.removeEventListener('keydown', tecla); window.covecaCerrarVisor = null; resolver(r); };
    const tecla = (e) => { if (e.key === 'Escape') cerrar(null); };
    const elegir = (f) => {
      forma = f;
      capa.querySelectorAll('[data-f]').forEach((b) => b.setAttribute('aria-checked', b.dataset.f === f));
      capa.querySelector('.cobro-vuelto').hidden = f !== 'efectivo';
      capa.querySelector('.cobro-credito').hidden = f !== 'credito';
      if (f === 'credito' && capa.querySelector('.cobro-credito .txt-alerta')) sentir('atencion');   // supera el límite: avisa y deja seguir
      capa.querySelector('[data-ok]').textContent = f === 'credito' ? 'Dejar a crédito' : f === 'transferencia' ? 'Confirmar transferencia' : 'Confirmar pago en efectivo';
    };
    capa.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => elegir(b.dataset.f)));
    capa.querySelector('[data-ok]').addEventListener('click', () => cerrar({ cobrado: true, forma }));
    capa.querySelector('[data-pendiente]')?.addEventListener('click', () => cerrar({ cobrado: false, forma: null }));
    capa.querySelector('[data-cancelar]').addEventListener('click', () => cerrar(null));
    capa.addEventListener('click', (e) => { if (e.target === capa) cerrar(null); });
    document.addEventListener('keydown', tecla);
    window.covecaCerrarVisor = () => cerrar(null);   // el botón atrás de Android cierra la hoja
    fondo.forEach((e) => { e.inert = true; });
    document.body.appendChild(capa);
    activarVuelto(capa.querySelector('.vuelto'));
    elegir(FORMAS[forma] ? forma : 'efectivo');
    capa.querySelector('[data-ok]').focus();
  });
}

// Texto del aviso tras registrar el pago ("Nota N° 5 pagada en efectivo")
export const textoPago = (r) => (r.forma === 'credito' ? 'queda a crédito' : r.forma === 'transferencia' ? 'pagada por transferencia' : 'pagada en efectivo');

// Aviso al dejar a crédito: deuda del cliente antes y después, y si supera su límite (avisa y deja seguir).
function textoCredito(total, c) {
  if (!c) return `<p class="fila-s">${icono('reloj', 'ico-s')} Queda a crédito: el plazo empieza a contar desde hoy.</p>`;
  const despues = (c.deuda || 0) + total;
  const supera = c.limite != null && despues > c.limite;
  const sinCredito = c.limite === 0;
  return `<p class="fila-s">${icono('reloj', 'ico-s')} Queda a crédito: el plazo empieza a contar desde hoy.</p>
    <p class="fila-s">Debe ahora ${clp(c.deuda || 0)} · quedará en <strong>${clp(despues)}</strong></p>
    ${supera ? `<p class="fila-s txt-alerta">${icono('alerta', 'ico-s')} ${sinCredito ? 'Este cliente no tiene crédito disponible' : `Supera su límite de ${clp(c.limite)}`}. Puedes seguir igual.</p>` : ''}`;
}

// ---------------- Estado de la nota ----------------
// p = nota (con entregado_en, pagado_en, pago_forma, forma_pago); credito = { pendiente } si es a crédito.
export function estadoNota(p, credito) {
  const entregada = !!p.entregado_en;
  const esCredito = p.forma_pago === 'credito';
  const pagada = esCredito ? !!credito && credito.pendiente <= 0 : !!p.pagado_en;
  return { entregada, esCredito, pagada, debe: esCredito ? (credito?.pendiente ?? p.total) : (pagada ? 0 : p.total) };
}
export function pasosHtml(p, e) {
  const paso = (hecho, actual, ic, t, sub) => `<li class="paso ${hecho ? 'hecho' : actual ? 'actual' : ''}">
      <span class="paso-ico" aria-hidden="true">${icono(hecho ? 'check' : ic)}</span>
      <span class="paso-t">${t}</span><span class="paso-s">${sub}</span></li>`;
  const pagoSub = e.pagada ? (e.esCredito ? 'Crédito pagado' : `${p.pago_forma === 'transferencia' ? 'Transf.' : 'Efectivo'} · ${fechaCorta(p.pagado_en)}`)
    : e.esCredito ? `Crédito · debe ${clp(e.debe)}` : e.entregada ? 'Falta registrar' : 'Al entregar';
  return `<ol class="pasos" aria-label="Estado de la nota">
    ${paso(true, false, 'nota', 'Pedido', fechaCorta(p.fecha))}
    ${paso(e.entregada, !e.entregada, 'caja', 'Entregado', e.entregada ? fechaCorta(p.entregado_en) : 'Pendiente')}
    ${paso(e.pagada, e.entregada && !e.pagada, 'moneda', 'Pagado', pagoSub)}
  </ol>`;
}

// Ilustraciones propias (sin copiar otras apps): recibo, caja entregada y monedas. Planas, con los colores de la marca.
const insignia = (tipo) => tipo === 'ok'
  ? '<circle class="il-ok" cx="104" cy="20" r="14"/><path class="il-trazo-claro" d="M97 20l5 5 9-9"/>'
  : '<circle class="il-pend" cx="104" cy="20" r="14"/><path class="il-trazo-claro" d="M104 12v9l5 3"/>';
export function ilustracion(tipo, marca = 'ok') {
  const dib = {
    // Nota lista: recibo con borde dentado y la "C" de COVECA
    nota: `<path class="il-papel" d="M30 14h50v62l-6-4-6 4-6-4-6 4-6-4-6 4-6-4-8 4z"/>
      <circle class="il-rojo" cx="42" cy="28" r="6"/><path class="il-linea" d="M54 26h18M54 31h12M38 44h34M38 52h34M38 60h20"/>`,
    // Entregada: caja con cinta roja
    caja: `<path class="il-caja-l" d="M20 40l36-16 36 16-36 16z"/><path class="il-caja" d="M20 40v30l36 16V56z"/><path class="il-caja-d" d="M92 40v30L56 86V56z"/>
      <path class="il-cinta" d="M38 32l36 16v8l-6 3v-8L32 35z"/>`,
    // Pagada: monedas apiladas con signo $
    monedas: `<ellipse class="il-moneda-b" cx="54" cy="76" rx="30" ry="9"/><path class="il-moneda" d="M24 66v10c0 5 13 9 30 9s30-4 30-9V66"/>
      <ellipse class="il-moneda-b" cx="54" cy="66" rx="30" ry="9"/><path class="il-moneda" d="M28 52v12c0 5 12 8 26 8s26-3 26-8V52"/>
      <ellipse class="il-moneda-t" cx="54" cy="52" rx="26" ry="8"/><path class="il-signo" d="M58 48.5c-1-1-2.4-1.5-4-1.5-2.2 0-4 .9-4 2.2s1.8 1.8 4 2.1 4 .9 4 2.2-1.8 2.3-4 2.3c-1.6 0-3-.5-4-1.5M54 45v2M54 57v2"/>`,
    // Ruta al día: camión de reparto con franja roja, líneas de velocidad y papel picado
    camion: `<path class="il-linea" d="M2 46h12M6 56h10M0 66h12"/>
      <rect class="il-caja" x="18" y="34" width="54" height="36" rx="3"/><rect class="il-cinta" x="18" y="58" width="54" height="5"/>
      <path class="il-cabina" d="M72 46h15l11 13v11H72z"/><path class="il-ventana" d="M77 50h8l7 8H77z"/>
      <circle class="il-rueda" cx="34" cy="72" r="7"/><circle class="il-rueda-c" cx="34" cy="72" r="2.5"/>
      <circle class="il-rueda" cx="85" cy="72" r="7"/><circle class="il-rueda-c" cx="85" cy="72" r="2.5"/>
      <circle class="il-c1" cx="14" cy="20" r="2.5"/><rect class="il-c2" x="44" y="14" width="5" height="5" rx="1" transform="rotate(20 46 16)"/>
      <circle class="il-c3" cx="66" cy="22" r="2"/><rect class="il-c1" x="84" y="34" width="4" height="4" rx="1" transform="rotate(-25 86 36)"/>
      <circle class="il-c2" cx="118" cy="44" r="2.5"/>`,
  }[tipo];
  return `<svg class="ilus" viewBox="0 0 124 92" aria-hidden="true" focusable="false"><ellipse class="il-sombra" cx="58" cy="86" rx="46" ry="5"/>${dib}${insignia(marca)}</svg>`;
}
// Tarjeta de estado: dibujo + título + texto, según cómo va la nota.
// irA = enlace de Google Maps al local (solo antes de entregar): botón "Ir" al lado del texto.
export function tarjetaEstado(p, e, irA = null) {
  let tipo, marca, t, s;
  if (!e.entregada && !e.pagada) { tipo = 'nota'; marca = 'ok'; t = 'Nota lista'; s = 'Al entregar, registra cómo pagó.'; }
  else if (!e.entregada) { tipo = 'nota'; marca = 'ok'; t = 'Nota lista y pagada'; s = 'Ya está pagada: solo falta entregarla.'; }
  else if (!e.pagada) { tipo = 'caja'; marca = 'pend'; t = e.esCredito ? 'Entregada · a crédito' : 'Entregada · falta el pago';
    s = e.esCredito ? `Debe ${clp(e.debe)}. Se paga con abonos.` : `Registra cómo pagó ${clp(e.debe)}: efectivo, transferencia o crédito.`; }
  else { tipo = 'monedas'; marca = 'ok'; t = 'Todo listo'; s = 'Entregada y pagada.'; }
  return `<div class="estado-nota ${marca === 'pend' ? 'pend' : ''} ${irA && !e.entregada ? 'con-ir' : ''}">${ilustracion(tipo, marca)}
    <div><p class="estado-nota-t">${t}</p><p class="fila-s">${s}</p></div>
    ${irA && !e.entregada ? `<a class="btn sec ir-nota" data-externo href="${irA}" aria-label="Ir con GPS al local">${icono('mapa')} Ir</a>` : ''}</div>`;
}

// Pantalla vacía que celebra (Pedidos sin nada pendiente): dibujo grande, título, mensaje y frase del día; sin cifras ni botones.
const FRASES = ['Su comercializadora de confianza', 'Cliente bien atendido, cliente que vuelve',
  'Cada entrega a tiempo suma confianza', 'Ruta cumplida, bodega tranquila'];
export function celebracion({ tipo, marca = 'ok', titulo, texto }) {
  const frase = FRASES[new Date().getDate() % FRASES.length];
  return `<div class="celebra">
    <div class="celebra-dib">${ilustracion(tipo, marca)}</div>
    <p class="celebra-t">${titulo}</p><p class="celebra-s">${texto}</p>
    <p class="celebra-frase" aria-hidden="true">“${frase}”</p></div>`;
}
