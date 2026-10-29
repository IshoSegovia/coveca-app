// Campos con formato (pedido del 15-10-2026):
// - RUT: se formatea solo al escribir (12.345.678-9) y avisa si el dígito verificador no calza.
// - Teléfono: selector de país de América + número sin código ("9 1234 5678"). Se guarda como "+56 9 1234 5678".
// Funcionan en cualquier pantalla por delegación de eventos: basta con usar rutInput() / campoTel() en el HTML.
import { esc } from './ui.js';

// ---------------- RUT ----------------
const limpioRut = (s) => String(s || '').toUpperCase().replace(/[^0-9K]/g, '').replace(/K(?=.)/g, '');
function formatoRut(s) {
  const r = limpioRut(s).slice(0, 9);
  if (r.length < 2) return r;
  const cuerpo = r.slice(0, -1).replace(/^0+/, ''), dv = r.slice(-1);
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
}
function rutValido(s) {
  const r = limpioRut(s);
  if (r.length < 2) return false;
  const cuerpo = r.slice(0, -1), dv = r.slice(-1);
  let suma = 0, m = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) { suma += Number(cuerpo[i]) * m; m = m === 7 ? 2 : m + 1; }
  const esperado = 11 - (suma % 11);
  return dv === (esperado === 11 ? '0' : esperado === 10 ? 'K' : String(esperado));
}
// <input> de RUT con su aviso (no impide guardar: puede haber RUT antiguos mal escritos).
export const rutInput = (name, valor, ph = '12.345.678-9') => `<input name="${name}" data-rut value="${esc(valor ? formatoRut(valor) : '')}" inputmode="text" autocomplete="off" autocapitalize="characters" placeholder="${ph}" maxlength="12">
  <small class="campo-aviso" data-rut-aviso hidden></small>`;

document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.matches?.('[data-rut]')) return;
  const f = formatoRut(el.value);
  if (f !== el.value) el.value = f;
  const av = el.parentElement.querySelector('[data-rut-aviso]');
  if (av && !av.hidden && rutValido(f)) av.hidden = true;
});
document.addEventListener('focusout', (e) => {
  const el = e.target;
  if (!el.matches?.('[data-rut]')) return;
  const av = el.parentElement.querySelector('[data-rut-aviso]');
  if (!av) return;
  const mal = el.value.trim() && !rutValido(el.value);
  av.hidden = !mal;
  av.textContent = mal ? 'Revisa el RUT: el dígito verificador (después del guion) no corresponde.' : '';
});

// ---------------- Teléfono ----------------
// Países de América (el +1 se comparte: se muestra como Estados Unidos / Canadá).
const PAISES = [
  ['CL', 'Chile', '56'], ['AR', 'Argentina', '54'], ['BO', 'Bolivia', '591'], ['BR', 'Brasil', '55'], ['CO', 'Colombia', '57'],
  ['CR', 'Costa Rica', '506'], ['CU', 'Cuba', '53'], ['EC', 'Ecuador', '593'], ['SV', 'El Salvador', '503'],
  ['US', 'Estados Unidos / Canadá', '1'], ['GT', 'Guatemala', '502'], ['HN', 'Honduras', '504'], ['MX', 'México', '52'],
  ['NI', 'Nicaragua', '505'], ['PA', 'Panamá', '507'], ['PY', 'Paraguay', '595'], ['PE', 'Perú', '51'],
  ['DO', 'R. Dominicana', '1809'], ['UY', 'Uruguay', '598'], ['VE', 'Venezuela', '58'],
];
const PAIS_DEF = 'CL';
const codigoDe = (iso) => (PAISES.find((p) => p[0] === iso) || PAISES[0])[2];
// R. Dominicana usa +1 con su área (809/829/849) al inicio del número: se guarda como "+1 809…".

// Separa un teléfono guardado ("+56 9 1234 5678", "56912345678", "912345678") en país y número local.
function partirTel(valor) {
  const s = String(valor || '').trim();
  const d = s.replace(/\D/g, '');
  if (!d) return { pais: PAIS_DEF, numero: '' };
  if (s.startsWith('+') || (d.startsWith('56') && d.length === 11)) {
    if (/^1(809|829|849)/.test(d)) return { pais: 'DO', numero: formatoLocal('DO', d.slice(1)) };
    const p = [...PAISES].filter((x) => x[0] !== 'DO').sort((a, b) => b[2].length - a[2].length).find((x) => d.startsWith(x[2]));
    if (p) return { pais: p[0], numero: formatoLocal(p[0], d.slice(p[2].length)) };
  }
  return { pais: PAIS_DEF, numero: formatoLocal(PAIS_DEF, d.replace(/^0+/, '')) };
}
// Chile: 9 1234 5678 (celular) o 2 2123 4567 (fijo de 9 dígitos). Otros: grupos de 3-4.
function formatoLocal(pais, num) {
  const d = String(num || '').replace(/\D/g, '');
  if (pais === 'CL' && d.length === 9) return `${d[0]} ${d.slice(1, 5)} ${d.slice(5)}`;
  if (d.length <= 4) return d;
  // Últimos 4 dígitos juntos; antes, grupos de 3 (el último puede quedar de 4): 412 123 4567 · 911 2345 6789
  const grupos = (r) => (r.length <= 4 ? [r] : [r.slice(0, 3), ...grupos(r.slice(3))]);
  return [...grupos(d.slice(0, -4)), d.slice(-4)].join(' ');
}
// Valor a guardar: "+56 9 1234 5678" (vacío si no hay número)
function unirTel(pais, numero) {
  const d = String(numero || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!d) return '';
  return pais === 'DO' ? `+1 ${d}` : `+${codigoDe(pais)} ${formatoLocal(pais, d)}`;
}
// Número para WhatsApp (solo dígitos con código de país). Sin "+", se asume Chile (datos antiguos).
export function telWhatsApp(valor) {
  const s = String(valor || '').trim(), d = s.replace(/\D/g, '');
  if (!d) return '';
  if (s.startsWith('+') || (d.startsWith('56') && d.length === 11)) return d;
  return '56' + d.replace(/^0+/, '');
}

// Campo de teléfono: selector de país + número. El valor real va en el <input hidden name=…> (lo lee leerForm).
// sinNombre: el valor no va en el formulario (se lee por id), p. ej. el proveedor nuevo dentro del formulario de producto.
export function campoTel(name, etiqueta, valor, { id = '', ph, sinNombre = false } = {}) {
  const { pais, numero } = partirTel(valor);
  return `<div class="campo"><span id="et-${name}">${etiqueta}</span>
    <div class="tel-campo">
      <div class="tel-pais-caja"><span class="tel-pais-txt" aria-hidden="true">+${pais === 'DO' ? '1' : codigoDe(pais)}</span>
        <select class="tel-pais" aria-label="País del teléfono">${PAISES.map(([iso, nom, cod]) =>
        `<option value="${iso}" ${iso === pais ? 'selected' : ''}>${nom} (+${iso === 'DO' ? '1' : cod})</option>`).join('')}</select></div>
      <input class="tel-num" type="tel" inputmode="tel" autocomplete="tel-national" aria-labelledby="et-${name}" value="${esc(numero)}" placeholder="${ph || (pais === 'CL' ? '9 1234 5678' : pais === 'DO' ? '809 123 4567' : 'Número')}">
    </div>
    <input type="hidden" ${sinNombre ? '' : `name="${name}"`} ${id ? `id="${id}"` : ''} value="${esc(unirTel(pais, numero))}"></div>`;
}
function sincronizar(caja) {
  const pais = caja.querySelector('.tel-pais').value, num = caja.querySelector('.tel-num');
  caja.parentElement.querySelector('input[type="hidden"]').value = unirTel(pais, num.value);
  caja.querySelector('.tel-pais-txt').textContent = `+${pais === 'DO' ? '1' : codigoDe(pais)}`;
  num.placeholder = pais === 'CL' ? '9 1234 5678' : pais === 'DO' ? '809 123 4567' : 'Número';
}
document.addEventListener('input', (e) => {
  const caja = e.target.closest?.('.tel-campo');
  if (!caja) return;
  // Si pegan un número con código (+54 …), se elige el país solo.
  const num = caja.querySelector('.tel-num');
  if (e.target === num && num.value.trim().startsWith('+')) {
    const { pais, numero } = partirTel(num.value);
    caja.querySelector('.tel-pais').value = pais; num.value = numero;
  }
  sincronizar(caja);
});
document.addEventListener('change', (e) => { const caja = e.target.closest?.('.tel-campo'); if (caja) sincronizar(caja); });
document.addEventListener('focusout', (e) => {
  const caja = e.target.closest?.('.tel-campo');
  if (!caja || !e.target.matches('.tel-num')) return;
  const { numero } = partirTel(unirTel(caja.querySelector('.tel-pais').value, e.target.value));
  if (e.target.value.replace(/\D/g, '')) e.target.value = numero;   // ordena los espacios al salir
  sincronizar(caja);
});
