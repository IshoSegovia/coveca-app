// Datos del negocio que salen en la nota de venta: teléfono, datos para transferencia y
// el WhatsApp del negocio que recibe una copia de cada nota. Solo administradores editan.
import { $, esc, barra, aviso, ir } from '../ui.js';
import { campoTel } from '../campos.js';
import * as datos from '../datos.js';

const ANCHO = 32;   // columnas de la impresora térmica (58 mm)
const MAX_LINEAS = 6;

export async function vistaNegocio(v) {
  barra({ titulo: 'Datos de la nota', atras: '#/ajustes' });
  const n = await datos.configuracion();
  const admin = datos.esAdmin();
  v.innerHTML = `
    <form id="f" class="form pad" novalidate ${admin ? '' : 'inert'}>
      ${campoTel('telefono', 'Teléfono que sale en la nota', n.telefono)}

      <label class="campo"><span>Datos para transferencia (uno por línea)</span>
        <textarea name="transferencia" rows="6" placeholder="Banco Estado · Cuenta RUT&#10;N° 12345678&#10;COVECA SpA&#10;RUT 76.123.456-7&#10;pagos@coveca.cl">${esc((n.transferencia || []).join('\n'))}</textarea></label>
      <p class="ayuda">Salen al pie de cada nota impresa. Máximo ${MAX_LINEAS} líneas de ${ANCHO} caracteres (el ancho del papel). Vacío = no se imprimen.</p>


      <label class="campo"><span>Meta de ventas de la semana ($)</span>
        <input name="meta_semanal" type="number" inputmode="numeric" min="0" step="1000" value="${n.meta_semanal || ''}" placeholder="Ej.: 600000"></label>
      <p class="ayuda">Se ve en el inicio ("Tu semana") con una barra de avance de lunes a domingo. Vacío = sin meta.</p>

      <p id="err" class="error" role="alert"></p>
      ${admin ? '<div class="pie-fijo"><button class="btn prin" type="submit">Guardar</button></div>' : ''}
    </form>`;

  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, err = $('#err', v);
    const lineas = f.transferencia.value.split('\n').map((l) => l.trim()).filter(Boolean);
    const larga = lineas.find((l) => l.length > ANCHO);
    if (lineas.length > MAX_LINEAS) { err.textContent = `Usa como máximo ${MAX_LINEAS} líneas para los datos de transferencia.`; return; }
    if (larga) { err.textContent = `La línea "${larga}" tiene ${larga.length} caracteres; el máximo es ${ANCHO}. Divídela en dos.`; return; }
    err.textContent = '';
    try {
      await datos.guardarConfiguracion({ ...n, telefono: f.telefono.value.trim(), transferencia: lineas, meta_semanal: Math.max(0, Math.round(Number(f.meta_semanal.value) || 0)) || null });
      aviso('Datos de la nota guardados');
      ir('#/ajustes');
    } catch (x) { err.textContent = x.message; }
  });
}
