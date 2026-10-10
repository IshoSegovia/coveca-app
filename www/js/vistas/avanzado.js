// Ajustes > Avanzado: opciones poco usadas. Apariencia (tema claro u oscuro) e impresión
// (modo, velocidad de la animación y nota de prueba). La impresora se elige en Ajustes.
import { $, barra, aviso } from '../ui.js';
import * as datos from '../datos.js';
import { config, imprimirNota } from '../impresora.js';

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
  v.innerHTML = `
    <div class="form pad">
      <h2 class="sec-t">Apariencia</h2>
      <fieldset class="opciones">
        <legend class="sr">Tema de la app</legend>
        ${opcion('claro', 'Claro', 'Fondo blanco. Se lee mejor a pleno sol.')}
        ${opcion('oscuro', 'Oscuro', 'Fondo oscuro. Cansa menos la vista de noche y puede ahorrar batería.')}
      </fieldset>
      <p class="ayuda">Se guarda solo en este celular. La nota impresa y los PDF no cambian.</p>
      <h2 class="sec-t">Impresión</h2>
      <label class="campo"><span>Modo de impresión</span>
        <select id="modo"><option value="texto">Texto + logo (recomendado, más rápido)</option><option value="imagen">Imagen completa</option></select></label>
      <label class="campo"><span>Velocidad de la impresora (mm/s)</span>
        <input id="velocidad" type="number" inputmode="numeric" min="5" max="100"></label>
      <p class="ayuda">Ajusta la animación al papel: si la animación termina antes que el papel, baja este número; si termina después, súbelo.</p>
      <button id="prueba" type="button" class="btn sec">Imprimir nota de prueba</button>
      <p class="ayuda">${config.impresora ? 'Usa la impresora elegida en Ajustes.' : 'Primero elige la impresora en Ajustes.'}</p>
    </div>`;
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
  v.querySelectorAll('input[name="tema"]').forEach((r) => r.addEventListener('change', () => {
    aplicarTema(r.value);
    aviso(r.value === 'oscuro' ? 'Modo oscuro activado' : 'Modo claro activado');
  }));
}
