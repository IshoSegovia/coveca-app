// Código QR con la nota completa en texto, para que el cliente la guarde en su teléfono.
// Funciona sin internet: toda la información va dentro del QR.
// Requiere www/vendor/qrcode.js (cargado como <script>, define window.qrcode).
import { clp } from './escpos.js';

export function textoNota(nota, negocio) {
  const lineas = [
    'COVECA - Nota de venta',
    nota.fecha,
    `Cliente: ${nota.cliente}`,
    '',
  ];
  let total = 0;
  for (const it of nota.items) {
    const sub = it.cant * it.precio;
    total += sub;
    lineas.push(`${it.cant} x ${it.nombre} (${clp(it.precio)}) = ${clp(sub)}`);
  }
  // Sin números de teléfono: las cámaras los detectan y muestran solo "Llamar", ocultando la nota.
  lineas.push('', `TOTAL: ${clp(total)} - ${nota.pago}`, '', negocio.eslogan);
  lineas.push('No es factura: nota de venta y guía de despacho.');
  return lineas.join('\n');
}

export function qrSvg(texto) {
  const qr = window.qrcode(0, 'L');                 // tamaño automático, corrección baja = menos denso
  qr.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
  qr.addData(texto, 'Byte');
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
}
