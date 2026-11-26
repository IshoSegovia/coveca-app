import { $, esc, barra, icono, aviso, clp, plural, FORMAS_PAGO } from '../ui.js';
import * as datos from '../datos.js';

// Trabajo sin señal: pedidos guardados en el celular que faltan por subir y estado de la copia de datos.
const hace = (min) => (!isFinite(min) ? 'nunca' : min < 1 ? 'hace un momento' : min < 60 ? `hace ${Math.round(min)} min`
  : min < 1440 ? `hace ${Math.round(min / 60)} h` : `hace ${plural(Math.round(min / 1440), 'día')}`);
const hora = (f) => new Date(f).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-');

// Cada registro de la cola lleva uno de estos: pedido, abono, visita, entrega, cobro, cotización o su conversión,
// cambio o la entrega de un cambio.
const registro = (x) => x.pedido || x.abono || x.visita || x.entrega || x.cobro || x.cotizacion || x.cotizacionPedido || x.cambio || x.entregaCambio;
const idDe = (x) => registro(x).id;
const titulo = (x) => (x.cambio ? `Cambio N° ${x.resumen.numero || ''}`.trim()
  : x.entregaCambio ? (x.entregaCambio.entregado ? 'Entrega de cambio' : 'Entrega de cambio deshecha')
  : x.cotizacion ? 'Cotización' : x.cotizacionPedido ? 'Cotización convertida en nota'
  : x.cobro ? (x.cobro.cobrado ? `Cobro (${(FORMAS_PAGO[x.cobro.forma] || 'efectivo').toLowerCase()})` : 'Queda por cobrar')
  : x.entrega ? (x.entrega.entregado ? 'Entrega' : 'Entrega deshecha')
  : x.visita ? 'Visitado sin pedido'
  : x.abono ? 'Abono de crédito'
  : x.pedido.numero ? `Nota N° ${x.pedido.numero}` : 'Nota sin número');
// Qué se pierde al descartar, en palabras simples.
function textoDescartar(x) {
  const cli = x.resumen.cliente || 'el cliente';
  const fin = '\n\nSe borra de este celular y no se sube. No se puede deshacer.';
  if (x.pedido) return `¿Descartar la ${x.pedido.numero ? `nota N° ${x.pedido.numero}` : 'nota'} de ${cli} (${clp(x.resumen.total)})?\n\nNo contará en ventas, stock ni crédito. Si el cliente igual quiere los productos, toma el pedido de nuevo.${fin}`;
  if (x.abono) return `¿Descartar el abono de ${clp(x.abono.monto)} de ${cli}?\n\nLa deuda del cliente no bajará. Si el cliente pagó, registra el abono de nuevo.${fin}`;
  if (x.visita) return `¿Descartar la visita sin pedido a ${cli}?${fin}`;
  if (x.cotizacion) return `¿Descartar la cotización de ${cli} (${clp(x.resumen.total)})?${fin}`;
  if (x.cotizacionPedido) return `¿Descartar el enlace entre la cotización y la nota de ${cli}? La nota no cambia; solo la cotización no quedará marcada como convertida.${fin}`;
  if (x.cambio) return `¿Descartar el cambio de ${cli}?\n\nEl stock no se moverá y no aparecerá para entregar. Si el cambio sigue en pie, regístralo de nuevo desde la nota.${fin}`;
  if (x.entregaCambio) return `¿Descartar esta marca de entrega del cambio (${cli})? El cambio quedará como estaba; puedes entregarlo de nuevo desde Pedidos.${fin}`;
  if (x.cobro) return `¿Descartar este registro de cobro (${cli})? La nota quedará como estaba en el servidor; puedes registrar el cobro de nuevo.${fin}`;
  return `¿Descartar esta marca de entrega (${cli})? Las notas quedarán como estaban; puedes marcarlas de nuevo en Pedidos.${fin}`;
}

export async function vistaPendientes(v) {
  barra({ titulo: 'Trabajo sin señal', atras: '#/ajustes' });
  const pintar = () => {
    if (!v.isConnected || location.hash !== '#/pendientes') return;
    const cola = datos.colaCompleta();   // todo lo guardado sin subir
    const errores = cola.filter((x) => x.estado === 'error').length;
    const red = datos.hayRed();
    v.innerHTML = `
      <div class="estado-red-ficha ${red ? 'con' : 'sin'}">${icono(red ? 'nube' : 'sinNube')}
        <div class="fila-txt"><p class="fila-t">${red ? 'Con señal' : 'Sin señal'}</p>
        <p class="fila-s">${red ? 'Los pedidos se suben en cuanto se generan.' : 'Puedes seguir tomando pedidos: quedan guardados en el celular y se suben solos al volver la señal.'}</p></div></div>

      <h2 class="sec-t">Por subir al servidor</h2>
      ${cola.length ? `<div class="lista">${cola.map((x) => `
        <div class="fila"><div class="fila-txt">
          <p class="fila-t">${titulo(x)} · ${esc(x.resumen.cliente || 'Cliente')}</p>
          <p class="fila-s">${hora(registro(x).fecha)}</p>
          ${x.estado === 'error' ? `<p class="fila-s txt-alerta">${icono('alerta', 'ico-s')} No se pudo subir: ${esc(x.error)}</p>
          <div class="cola-acciones">${x.pedido ? `<a class="btn link" href="#/pedidos/${esc(x.pedido.id)}">Ver nota</a>` : x.cotizacion ? `<a class="btn link" href="#/cotizaciones/${esc(x.cotizacion.id)}">Ver cotización</a>` : x.cambio ? `<a class="btn link" href="#/cambios/${esc(x.cambio.id)}">Ver cambio</a>` : ''}
            <button type="button" class="btn link txt-alerta" data-descartar="${esc(idDe(x))}">Descartar</button></div>` : ''}</div>
          <div class="cola-der">${x.visita || x.entrega || x.cotizacionPedido || x.cambio || x.entregaCambio || (x.cobro && !x.cobro.cobrado) ? '' : `<span class="monto">${clp(x.abono ? x.abono.monto : x.resumen.total)}</span>`}
          <span class="chip ${x.estado === 'error' ? 'alerta' : ''}">${x.estado === 'error' ? 'Con problema' : 'Por subir'}</span></div></div>`).join('')}</div>
        ${errores ? `<p class="ayuda pad">Si sigue con problema después de reintentar, envía a soporte una captura de esta pantalla. Si no se puede arreglar, "Descartar" lo borra del celular para que deje de bloquear (no se sube).</p>` : ''}`
        : `<p class="texto-suave pad-x">${icono('check', 'ico-s')} No hay nada pendiente: todo está en el servidor.</p>`}

      <h2 class="sec-t">Datos guardados en el celular</h2>
      <dl class="datos">
        <div class="dato"><dt>Rutas, clientes y productos</dt><dd>Actualizados ${hace(datos.edadCopia())}</dd></div>
        <div class="dato"><dt>Números de nota reservados</dt><dd>${datos.numerosLibres()} disponibles</dd></div>
      </dl>
      <p class="ayuda pad">Con señal, la app renueva estos datos sola. Antes de salir a una zona sin señal, abre la app con señal para llevar todo al día.</p>
      <div class="pie-fijo"><button id="subir" class="btn prin">${icono('nube')} ${cola.length ? (errores ? 'Reintentar y subir ahora' : 'Subir ahora') : 'Actualizar datos ahora'}</button></div>`;

    v.querySelectorAll('[data-descartar]').forEach((b) => b.addEventListener('click', () => {
      const x = datos.colaCompleta().find((y) => idDe(y) === b.dataset.descartar);
      if (!x || !confirm(textoDescartar(x))) return;
      datos.descartarDeCola(idDe(x));
      aviso('Registro descartado');
      pintar();
    }));
    $('#subir', v).addEventListener('click', async (e) => {
      const b = e.currentTarget;
      if (!navigator.onLine) { aviso('Sin señal. Intenta cuando el celular tenga internet.', 'error'); return; }
      b.disabled = true; b.textContent = 'Subiendo…';
      const antes = datos.colaCompleta().length;
      await datos.reintentarCola();
      const quedan = datos.colaCompleta();
      if (!datos.hayRed()) aviso('No hay señal suficiente. Intenta de nuevo en un momento.', 'error');
      else if (quedan.some((x) => x.estado === 'error')) aviso('Algunos pedidos no se pudieron subir. Revisa el mensaje.', 'error');
      else aviso(antes ? 'Pedidos subidos' : 'Datos actualizados');
      pintar();
    });
  };
  repintar = pintar;
  pintar();
}
// Una sola suscripción: repinta la pantalla abierta cuando cambia la cola o la señal.
let repintar = () => {};
window.addEventListener('coveca:cola', () => repintar());
window.addEventListener('coveca:red', () => repintar());
