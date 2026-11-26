// Ajustes → Impresora (#/ajustes/impresora): todo lo de la impresión en una sola pantalla.
// Cada equipo ve solo sus opciones: la app Android, la térmica Bluetooth; el PC, impresora normal o térmica por
// puerto serie; el navegador del celular (iPhone), ninguna (la nota se comparte como imagen).
// Luego, si hay térmica: modo, velocidad de la animación y nota de prueba (antes en Ajustes → Avanzado).
import { $, esc, barra, aviso } from '../ui.js';
import * as datos from '../datos.js';
import { config, buscarImpresoras, imprimirNota } from '../impresora.js';
import { esApp } from '../nativo.js';
import { esEscritorio } from '../escritorio.js';
import { notaPdf } from '../nota-pdf.js';
import { imprimirPdf } from '../pdf.js';
import { hayPuertoSerie, puertoGuardado, elegirPuerto, olvidarPuerto } from '../termica-pc.js';

// Línea corta para la fila de Ajustes: qué impresora usa este equipo.
export function resumenImpresora() {
  if (esApp) return config.impresora ? 'Térmica Bluetooth elegida' : 'Elige la impresora térmica';
  if (esEscritorio()) return config.pc === 'termica' ? 'Impresora térmica 58 mm' : 'Impresora normal (hoja)';
  return 'En este teléfono la nota se comparte como imagen';
}

export function vistaImpresora(v) {
  barra({ titulo: 'Impresora', atras: '#/ajustes' });
  if (!esApp && !esEscritorio()) {
    v.innerHTML = `<div class="form pad"><p class="ayuda">La impresión térmica se hace desde la app Android o desde el PC.
      En este teléfono la nota se comparte como imagen o en PDF.</p></div>`;
    return;
  }
  v.innerHTML = `${esApp ? `<form id="imp" class="form pad">
      <h2 class="sec-t">Impresora térmica Bluetooth</h2>
      <label class="campo"><span>Impresora elegida</span>
        <select id="impresora"><option value="">Presiona Buscar</option></select></label>
      <button id="buscar" type="button" class="btn sec">Buscar impresoras vinculadas</button>
    </form>` : `<form id="imp" class="form pad imp-pc">
      <h2 class="sec-t">Impresora de este PC</h2>
      <fieldset class="opciones"><legend class="sr">Tipo de impresora</legend>
        <label class="opcion"><input type="radio" name="tipo-imp" value="normal" ${config.pc !== 'termica' ? 'checked' : ''}>
          <span class="opcion-txt">Impresora normal<small>Notas y reportes en hoja</small></span></label>
        <label class="opcion"><input type="radio" name="tipo-imp" value="termica" ${config.pc === 'termica' ? 'checked' : ''}>
          <span class="opcion-txt">Impresora térmica 58 mm<small>La misma RPP02N, conectada al PC por Bluetooth o USB</small></span></label>
      </fieldset>
      <div id="termica-pc" ${config.pc === 'termica' ? '' : 'hidden'}>
        ${hayPuertoSerie ? `<p class="fila-t" id="estado-termica">Revisando…</p>
        <button id="conectar-termica" type="button" class="btn sec">Conectar impresora térmica</button>
        <button id="olvidar-termica" type="button" class="btn link izq" hidden>Desconectar</button>
        <p class="ayuda">En Windows: vincula la impresora en Configuración → Bluetooth (se crea un puerto COM). Luego toca Conectar y elige ese puerto. Los reportes siguen saliendo por la impresora normal.</p>`
        : '<p class="nota-falta">Este navegador no puede conectar impresoras térmicas. Abre la app en Google Chrome o Microsoft Edge.</p>'}
      </div>
    </form>`}
    <div id="como-imprime"></div>`;
  if (esApp) activarBluetooth(v); else activarPc(v);
  pintarComo(v);
}

// Opciones de la térmica (app o PC con térmica) o nota de prueba en hoja (PC con impresora normal).
// Se redibuja al cambiar el tipo de impresora del PC.
function pintarComo(v) {
  const caja = $('#como-imprime', v);
  const termica = esApp || config.pc === 'termica';
  caja.innerHTML = termica ? `<div class="form pad">
      <h2 class="sec-t">Cómo imprime</h2>
      <label class="campo"><span>Modo de impresión</span>
        <select id="modo"><option value="imagen">Diseño completo (recomendado)</option><option value="texto">Solo texto (más rápido, diseño simple)</option></select></label>
      <label class="campo"><span>Velocidad de la impresora (mm/s)</span>
        <input id="velocidad" type="number" inputmode="numeric" min="5" max="100"></label>
      <p class="ayuda">Ajusta la animación al papel: si la animación termina antes que el papel, baja este número; si termina después, súbelo. Si la nota sale cortada, prueba "Solo texto".</p>
    </div>
    <div class="pie-fijo"><button id="prueba" type="button" class="btn prin">Imprimir nota de prueba</button></div>`
    : `<div class="pie-fijo"><button id="prueba-pc" type="button" class="btn prin">Imprimir nota de prueba</button></div>`;
  $('#prueba-pc', v)?.addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try {
      const yo = datos.usuario() || {};
      imprimirPdf(await notaPdf({
        numero: 0, fecha: new Date().toISOString(), cliente: { nombre: 'Cliente de prueba Ñuñoa', rut: '11.111.111-1', direccion: 'Calle de prueba 123', comuna: 'Parral' },
        vendedor: yo.nombre, terminal: yo.terminal, pago: 'Efectivo',
        items: [{ nombre: 'Super 8 Oblea Clásica x24', cantidad: 2, precio: 5990 }, { nombre: 'BigTime Menta x20', cantidad: 1, precio: 6690 }],
        subtotal: 18670, descuentoLealtad: 0, descuento: 0, total: 18670, lealtadTexto: '',
      }, await datos.configuracion(), 'limpia'));
    } catch (err) { aviso(err.message || 'No se pudo preparar la impresión.', 'error'); }
    b.disabled = false;
  });
  if (!termica) return;
  $('#modo', v).value = config.modo;
  $('#velocidad', v).value = config.velocidad;
  $('#modo', v).addEventListener('change', (e) => { config.modo = e.target.value; aviso('Modo de impresión guardado'); });
  $('#velocidad', v).addEventListener('change', (e) => { config.velocidad = Number(e.target.value) || 24; aviso('Velocidad guardada'); });
  $('#prueba', v).addEventListener('click', async () => {
    if (esApp && !config.impresora) { aviso('Primero elige la impresora: toca "Buscar impresoras vinculadas".', 'error'); return; }
    const yo = datos.usuario();
    try {
      await imprimirNota({ numero: 0, vendedor: yo.nombre, terminal: yo.terminal, cliente: 'Cliente de prueba Ñuñoa', fecha: new Date().toLocaleString('es-CL'), pago: 'Efectivo',
        items: [{ nombre: 'Super 8 Oblea Clásica x24', cant: 2, precio: 5990 }, { nombre: 'BigTime Menta x20', cant: 1, precio: 6690 }],
        descuentoLealtad: 373, lealtad: { nivel: 'Oro', lineas: ['Cliente Oro · Ahorró $373', 'Le faltan $85.000 y 1 semana con compra para Platino'] } },
      await datos.configuracion());
    } catch (e) { aviso(e.message, 'error'); }
  });
}

function activarPc(v) {
  const caja = $('#termica-pc', v);
  v.querySelectorAll('input[name="tipo-imp"]').forEach((rb) => rb.addEventListener('change', (e) => {
    config.pc = e.target.value; caja.hidden = config.pc !== 'termica';
    pintarComo(v);
    aviso(config.pc === 'termica' ? 'Las notas se imprimirán en la térmica' : 'Las notas se imprimirán en la impresora normal');
  }));
  if (!hayPuertoSerie) return;
  const pintar = async () => {
    const p = await puertoGuardado().catch(() => null);
    const info = p?.getInfo?.() || {};
    $('#estado-termica', v).textContent = p ? `✓ Impresora térmica conectada${info.usbProductId ? ' (USB)' : ''}` : 'Sin impresora térmica conectada';
    $('#conectar-termica', v).textContent = p ? 'Cambiar impresora térmica' : 'Conectar impresora térmica';
    $('#olvidar-termica', v).hidden = !p;
  };
  $('#conectar-termica', v).addEventListener('click', async () => {
    try { await elegirPuerto(); aviso('Impresora térmica conectada. Prueba con "Imprimir nota de prueba".'); }
    catch (e) { aviso(e.message, 'error'); }
    pintar();
  });
  $('#olvidar-termica', v).addEventListener('click', async () => { await olvidarPuerto(); aviso('Impresora térmica desconectada'); pintar(); });
  pintar();
}

function activarBluetooth(v) {
  const sel = $('#impresora', v);
  const llenar = (lista) => {
    if (!lista.length) return;
    sel.innerHTML = lista.map((d) => `<option value="${esc(d.address)}" ${d.address === config.impresora ? 'selected' : ''}>${esc(d.name)} (${esc(d.address)})</option>`).join('');
    if (!config.impresora) { const rpp = lista.find((d) => /RPP|printer|pos/i.test(d.name)) || lista[0]; sel.value = rpp.address; config.impresora = rpp.address; }
  };
  if (config.impresora) sel.innerHTML = `<option value="${esc(config.impresora)}">${esc(config.impresora)}</option>`;
  sel.addEventListener('change', () => { config.impresora = sel.value; });
  $('#buscar', v).addEventListener('click', async () => {
    try { const l = await buscarImpresoras(); l.length ? llenar(l) : aviso('No hay impresoras vinculadas. Vincúlala en Ajustes > Bluetooth del celular.', 'error'); }
    catch (e) { aviso(e.message, 'error'); }
  });
  buscarImpresoras().then(llenar).catch(() => {});
}
