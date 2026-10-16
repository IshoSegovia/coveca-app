// Ajustes > Avanzado: opciones poco usadas. Apariencia (tema claro u oscuro) e impresión
// (modo, velocidad de la animación y nota de prueba). La impresora se elige en Ajustes.
import { $, barra, aviso } from '../ui.js';
import * as datos from '../datos.js';
import { config, imprimirNota } from '../impresora.js';
import { esApp } from '../nativo.js';
import { esEscritorio } from '../escritorio.js';
import { notaPdf, HOJAS } from '../nota-pdf.js';
import { imprimirPdf } from '../pdf.js';

const CLAVE = 'coveca.tema';

export function temaActual() {
  return document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'oscuro' : 'claro';
}

function aplicarTema(tema) {
  if (tema === 'oscuro') document.documentElement.setAttribute('data-tema', 'oscuro');
  else document.documentElement.removeAttribute('data-tema');
  try { localStorage.setItem(CLAVE, tema); } catch { /* se aplica igual, solo que no se recordará */ }
}

export function vistaAvanzado(v) {
  barra({ titulo: 'Avanzado', atras: '#/ajustes' });
  const actual = temaActual();
  const opcion = (valor, titulo, detalle) => `
    <label class="opcion">
      <input type="radio" name="tema" value="${valor}" ${actual === valor ? 'checked' : ''}>
      <span class="opcion-txt">${titulo}<small>${detalle}</small></span>
    </label>`;
  // Opciones de la térmica: en la app Android, o en el PC si se eligió la térmica en Ajustes.
  const termica = esApp || (esEscritorio() && config.pc === 'termica');
  const normalPc = !termica && esEscritorio();     // PC con impresora normal: nota de prueba en hoja
  v.innerHTML = `
    <div class="form pad">
      <h2 class="sec-t">Apariencia</h2>
      <fieldset class="opciones">
        <legend class="sr">Tema de la app</legend>
        ${opcion('claro', 'Claro', 'Fondo blanco. Se lee mejor a pleno sol.')}
        ${opcion('oscuro', 'Oscuro', 'Fondo oscuro. Cansa menos la vista de noche y puede ahorrar batería.')}
      </fieldset>
      <p class="ayuda">Se guarda solo en este equipo. La nota impresa y los PDF no cambian.</p>
      ${termica ? `<h2 class="sec-t">Impresión térmica</h2>
      <label class="campo"><span>Modo de impresión</span>
        <select id="modo"><option value="imagen">Diseño completo (recomendado)</option><option value="texto">Solo texto (más rápido, diseño simple)</option></select></label>
      <label class="campo"><span>Velocidad de la impresora (mm/s)</span>
        <input id="velocidad" type="number" inputmode="numeric" min="5" max="100"></label>
      <p class="ayuda">Ajusta la animación al papel: si la animación termina antes que el papel, baja este número; si termina después, súbelo.</p>
      <button id="prueba" type="button" class="btn sec">Imprimir nota de prueba</button>
      <p class="ayuda">${esApp ? (config.impresora ? 'Usa la impresora elegida en Ajustes.' : 'Primero elige la impresora en Ajustes.') : 'Usa la impresora térmica conectada en Ajustes.'}</p>` : ''}
      ${normalPc ? `<h2 class="sec-t">Impresión</h2>
      <fieldset class="opciones"><legend class="sr">Hoja de la nota de prueba</legend>
        ${HOJAS.map(([k, t, dd], i) => `<label class="opcion"><input type="radio" name="hoja-prueba" value="${k}" ${i === 0 ? 'checked' : ''}><span class="opcion-txt">${t}<small>${dd}</small></span></label>`).join('')}
      </fieldset>
      <button id="prueba-pc" type="button" class="btn sec">Imprimir nota de prueba</button>
      <p class="ayuda">Usa la impresora normal del computador. Para la térmica, elígela en Ajustes → Impresora.</p>` : ''}
    </div>`;
  // Tema: va antes que lo de la impresora para que funcione en todos los equipos.
  v.querySelectorAll('input[name="tema"]').forEach((r) => r.addEventListener('change', () => {
    aplicarTema(r.value);
    aviso(r.value === 'oscuro' ? 'Modo oscuro activado' : 'Modo claro activado');
  }));
  $('#prueba-pc', v)?.addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    const hoja = v.querySelector('input[name="hoja-prueba"]:checked')?.value || 'media';
    try {
      const yo = datos.usuario() || {};
      imprimirPdf(await notaPdf({
        numero: 0, fecha: new Date().toISOString(), cliente: { nombre: 'Cliente de prueba Ñuñoa', rut: '11.111.111-1', direccion: 'Calle de prueba 123', comuna: 'Parral' },
        vendedor: yo.nombre, terminal: yo.terminal, pago: 'Efectivo',
        items: [{ nombre: 'Super 8 Oblea Clásica x24', cantidad: 2, precio: 5990 }, { nombre: 'BigTime Menta x20', cantidad: 1, precio: 6690 }],
        subtotal: 18670, descuentoLealtad: 0, descuento: 0, total: 18670, lealtadTexto: '',
      }, await datos.configuracion(), hoja));
    } catch (err) { aviso(err.message || 'No se pudo preparar la impresión.', 'error'); }
    b.disabled = false;
  });
  if (!termica) return;
  $('#modo', v).value = config.modo;
  $('#velocidad', v).value = config.velocidad;
  $('#modo', v).addEventListener('change', (e) => { config.modo = e.target.value; aviso('Modo de impresión guardado'); });
  $('#velocidad', v).addEventListener('change', (e) => { config.velocidad = Number(e.target.value) || 24; aviso('Velocidad guardada'); });
  $('#prueba', v).addEventListener('click', async () => {
    const yo = datos.usuario();
    try {
      await imprimirNota({ numero: 0, vendedor: yo.nombre, terminal: yo.terminal, cliente: 'Cliente de prueba Ñuñoa', fecha: new Date().toLocaleString('es-CL'), pago: 'Efectivo',
        items: [{ nombre: 'Super 8 Oblea Clásica x24', cant: 2, precio: 5990 }, { nombre: 'BigTime Menta x20', cant: 1, precio: 6690 }],
        descuentoLealtad: 373, lealtad: { nivel: 'Oro', lineas: ['Cliente Oro · Ahorró $373', 'Le faltan $85.000 y 1 semana con compra para Platino'] } },
      await datos.configuracion());
    } catch (e) { aviso(e.message, 'error'); }
  });
}
