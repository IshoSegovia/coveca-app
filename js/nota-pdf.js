// Nota de venta en PDF para imprimir en una impresora normal (PC).
// Tres formatos, a elección al imprimir:
//   media: hoja carta con la nota arriba (Original · Cliente) y una copia abajo (Copia · COVECA), con línea de corte.
//   carta: una nota por hoja carta, con más espacio (si es larga sigue en otra hoja).
//   tira:  la misma tira de 58 mm de la impresora térmica.
import { cargarLogo } from './pdf.js';
import { dibujarNota } from '../render.js';
import { clp, fechaHora } from './ui.js';

const AZUL = [62, 64, 149], ROJO = [236, 50, 55], ROJO_TEXTO = [196, 33, 39];
const TEXTO = [29, 31, 43], SUAVE = [91, 96, 112], BORDE = [217, 220, 229];
const CARTA = { w: 215.9, h: 279.4 };
export const HOJAS = [
  ['media', 'Media carta', 'Original y copia en una hoja carta, para cortar'],
  ['carta', 'Carta', 'Una nota por hoja'],
  ['tira', 'Tira de 58 mm', 'Igual a la impresora térmica'],
];
export const MAX_MEDIA = 9;   // productos que caben en media carta; con más, se usa carta

// enlace: n.html#<id> para el QR (solo notas guardadas)
const fechaCorta = (d) => (d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '');

/**
 * n = { numero, fecha, cliente: {nombre, razon_social, rut, direccion, comuna, telefono}, vendedor, terminal,
 *       pago, vence, items: [{nombre, cantidad, precio, subtotal}], subtotal, descuentoLealtad, nivel, descuento, total, anulada }
 * Devuelve el PDF en base64.
 */
export async function notaPdf(n, negocio, hoja = 'media') {
  const { jsPDF } = window.jspdf;
  if (!n.enlace && /^[0-9a-f-]{36}$/i.test(n.id || '')) n = { ...n, enlace: `https://ishosegovia.github.io/coveca-app/n.html#${n.id}` };
  if (hoja === 'tira') return tira(n, negocio, jsPDF);
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const lg = await cargarLogo();
  if (hoja === 'media' && n.items.length <= MAX_MEDIA) {
    const mitad = CARTA.h / 2;
    bloque(doc, n, negocio, lg, { y0: 0, alto: mitad, compacta: true, etiqueta: 'Original · Cliente' });
    // Línea de corte
    doc.setDrawColor(...SUAVE); doc.setLineWidth(0.2); doc.setLineDashPattern([2, 2], 0);
    doc.line(6, mitad, CARTA.w - 6, mitad); doc.setLineDashPattern([], 0);
    doc.setFontSize(7); doc.setTextColor(...SUAVE); doc.text('cortar aquí', CARTA.w / 2, mitad - 1.2, { align: 'center' });
    bloque(doc, n, negocio, lg, { y0: mitad, alto: mitad, compacta: true, etiqueta: 'Copia · COVECA' });
  } else {
    bloque(doc, n, negocio, lg, { y0: 0, alto: CARTA.h, compacta: false, etiqueta: '' });
  }
  return doc.output('datauristring').split(',')[1];
}

// Cuadritos 8 bits de la marca (arriba a la derecha) y QR dibujado con rectángulos (sin imágenes).
const PIX = [AZUL, ROJO, [242, 205, 92], AZUL, [44, 46, 115], ROJO, AZUL, [242, 205, 92], [44, 46, 115], ROJO];
function qrPdf(doc, texto, x, y, lado) {
  const qr = window.qrcode?.(0, 'M'); if (!qr) return false;
  qr.addData(texto); qr.make();
  const n = qr.getModuleCount(), t = lado / n;
  doc.setFillColor(...AZUL);
  for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (qr.isDark(f, c)) doc.rect(x + c * t, y + f * t, t + 0.02, t + 0.02, 'F');
  return true;
}

// Dibuja una nota completa dentro de la franja [y0, y0 + alto] de la hoja.
// Diseño "Limpio" (todo lo impreso en papel): fondo blanco, N° grande en azul, línea oscura,
// datos en tres columnas, tabla con líneas finas, QR + transferencia abajo a la izquierda y TOTAL grande a la derecha.
function bloque(doc, n, negocio, lg, { y0, alto, compacta, etiqueta }) {
  const M = compacta ? 14 : 18, W = CARTA.w, k = compacta ? 0.88 : 1;   // k: escala de letra
  const fs = (t) => doc.setFontSize(t * k);
  let y = y0 + (compacta ? 9 : 14);

  // Cuadritos 8 bits arriba a la derecha
  const anchoPix = compacta ? 44 : 56, cel = anchoPix / PIX.length;
  PIX.forEach((col, i) => { doc.setFillColor(...col); doc.rect(W - M - anchoPix + i * cel + (compacta ? 0 : 0), y0, cel, compacta ? 1.6 : 2.2, 'F'); });

  // Encabezado: logo y eslogan a la izquierda; NOTA DE VENTA, N° grande y fecha a la derecha
  const anchoLogo = compacta ? 36 : 46, altoLogo = anchoLogo * lg.ratio;
  doc.addImage(lg.data, 'PNG', M, y, anchoLogo, altoLogo, 'logo', 'FAST');
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...SUAVE); fs(8.5);
  doc.text([negocio.eslogan, negocio.telefono].filter(Boolean).join(' · '), M, y + altoLogo + 4.5);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...ROJO_TEXTO); fs(8.5); doc.setCharSpace(0.35);
  doc.text('NOTA DE VENTA', W - M, y + 3, { align: 'right' }); doc.setCharSpace(0);
  doc.setTextColor(...AZUL); fs(26);
  doc.text(n.numero ? `N° ${n.numero}` : 'Sin número', W - M, y + 13, { align: 'right' });
  doc.setFont('helvetica', 'normal'); fs(9); doc.setTextColor(...SUAVE);
  doc.text(fechaHora(n.fecha) + (etiqueta ? `  ·  ${etiqueta}` : ''), W - M, y + 18.5, { align: 'right' });
  y += Math.max(altoLogo + 9, 23);
  doc.setDrawColor(...TEXTO); doc.setLineWidth(0.6); doc.line(M, y, W - M, y);
  y += compacta ? 5 : 6;

  // Tres columnas: Cliente / Dirección / Vendedor
  const c = n.cliente || {};
  const cols = [
    ['CLIENTE', [c.nombre, c.razon_social && c.razon_social !== c.nombre ? c.razon_social : '', c.rut ? `RUT ${c.rut}` : ''].filter(Boolean)],
    ['DIRECCIÓN', [[c.direccion, c.comuna].filter(Boolean).join(', '), c.telefono ? `Tel. ${c.telefono}` : ''].filter(Boolean)],
    ['VENDEDOR', [n.vendedor, n.terminal, n.pago ? `Pago: ${n.pago}` : '', n.vence ? `Vence ${fechaCorta(n.vence)}` : ''].filter(Boolean)],
  ];
  const anchoCol = (W - 2 * M) / 3, lh = compacta ? 3.9 : 4.6;
  let filas = 0;
  cols.forEach(([et, lineas], i) => {
    const x = M + i * anchoCol;
    doc.setFont('helvetica', 'bold'); fs(7.5); doc.setTextColor(...SUAVE); doc.setCharSpace(0.25); doc.text(et, x, y); doc.setCharSpace(0);
    const ls = (lineas.length ? lineas : ['—']).flatMap((l, j) => doc.splitTextToSize(String(l), anchoCol - 4).slice(0, j === 0 ? 2 : 1));
    ls.forEach((l, j) => { doc.setFont('helvetica', i === 0 && j === 0 ? 'bold' : 'normal'); fs(9); doc.setTextColor(...TEXTO); doc.text(l, x, y + 4.6 + j * lh); });
    filas = Math.max(filas, ls.length);
  });
  y += 4.6 + filas * lh + (compacta ? 1.5 : 3);

  // Detalle (columna REF solo si los productos la traen)
  const conRef = n.items.some((i) => i.ref);
  doc.autoTable({
    startY: y,
    margin: { left: M, right: M, top: 14, bottom: compacta ? 0 : 40 },
    head: [[...(conRef ? ['REF'] : []), 'PRODUCTO', 'CANT.', 'PRECIO', 'TOTAL']],
    body: n.items.map((i) => [...(conRef ? [i.ref || ''] : []), i.nombre, String(i.cantidad), clp(i.precio), clp(i.subtotal ?? i.cantidad * i.precio)]),
    theme: 'plain',
    rowPageBreak: 'avoid', pageBreak: compacta ? 'avoid' : 'auto', showHead: 'everyPage',
    styles: { font: 'helvetica', fontSize: 9 * k, textColor: TEXTO, cellPadding: { top: compacta ? 1.2 : 1.9, bottom: compacta ? 1.2 : 1.9, left: 1.5, right: 1.5 }, lineColor: [238, 239, 244], lineWidth: { bottom: 0.2 } },
    headStyles: { textColor: SUAVE, fontStyle: 'bold', fontSize: 7.5 * k, lineColor: BORDE, lineWidth: { bottom: 0.3 } },
    columnStyles: conRef ? { 0: { cellWidth: 16, textColor: SUAVE }, 2: { halign: 'right', cellWidth: 16 }, 3: { halign: 'right', cellWidth: 26 }, 4: { halign: 'right', cellWidth: 26, fontStyle: 'bold' } }
      : { 1: { halign: 'right', cellWidth: 16 }, 2: { halign: 'right', cellWidth: 26 }, 3: { halign: 'right', cellWidth: 26, fontStyle: 'bold' } },
    didParseCell: (d) => { if (d.section === 'head' && d.column.index > (conRef ? 1 : 0)) d.cell.styles.halign = 'right'; },
  });
  y = doc.lastAutoTable.finalY + 3;
  if (!compacta && y > CARTA.h - 60) { doc.addPage(); y = 20; }

  // Subtotal y descuentos (a la derecha)
  const filasTot = [['Subtotal', clp(n.subtotal)]];
  if (n.descuentoLealtad) filasTot.push([`Descuento cliente ${n.nivel || ''}`.trim(), '-' + clp(n.descuentoLealtad)]);
  if (n.descuento) filasTot.push(['Descuento', '-' + clp(n.descuento)]);
  const xEt = W - M - 70;
  doc.setFont('helvetica', 'normal'); fs(9);
  if (filasTot.length > 1) filasTot.forEach(([et, v]) => { y += 4.3 * k; doc.setTextColor(...SUAVE); doc.text(et, xEt, y); doc.setTextColor(...TEXTO); doc.text(v, W - M, y, { align: 'right' }); });
  if (n.lealtadTexto) { doc.setFont('helvetica', 'bold'); fs(9); doc.setTextColor(...AZUL); doc.text(doc.splitTextToSize(n.lealtadTexto, xEt - M - 6), M, y); }

  // Pie: QR + transferencia + leyenda a la izquierda; TOTAL grande a la derecha (pegado al final de la franja)
  const lineasT = (negocio.transferencia || []).filter(Boolean);
  const ladoQr = compacta ? 19 : 24;
  const altoPie = Math.max(ladoQr, 4 + lineasT.length * 3.5 + 8);
  const yPie = Math.max(y + 6, y0 + alto - (compacta ? 7 : 16) - altoPie);
  const conQr = n.enlace ? qrPdf(doc, n.enlace, M, yPie, ladoQr) : false;
  const xT = conQr ? M + ladoQr + 5 : M;
  let yt = yPie + 3;
  if (lineasT.length) {
    doc.setFont('helvetica', 'bold'); fs(8); doc.setTextColor(...TEXTO); doc.text('Datos para transferencia', xT, yt); yt += 3.6;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...SUAVE); lineasT.forEach((l) => { doc.text(l, xT, yt); yt += 3.5; });
    yt += 1.5;
  } else if (conQr) { doc.setFont('helvetica', 'bold'); fs(8); doc.setTextColor(...TEXTO); doc.text('Escanea para ver la nota digital', xT, yt); yt += 5; }
  doc.setFont('helvetica', 'normal'); fs(7.5); doc.setTextColor(...SUAVE);
  doc.text(doc.splitTextToSize(negocio.leyenda || '', xEt - xT - 8), xT, yt);
  doc.setFont('helvetica', 'bold'); fs(8); doc.setTextColor(...SUAVE); doc.setCharSpace(0.35);
  doc.text('TOTAL', W - M, yPie + altoPie - 13 * k, { align: 'right' }); doc.setCharSpace(0);
  doc.setTextColor(...AZUL); fs(24); doc.text(clp(n.total), W - M, yPie + altoPie - 2, { align: 'right' });

  // Nota anulada: marca de agua
  if (n.anulada) {
    doc.setTextColor(...ROJO_TEXTO); doc.setFont('helvetica', 'bold'); doc.setFontSize(compacta ? 40 : 60);
    doc.text('ANULADA', W / 2, y0 + alto / 2 + 8, { align: 'center', angle: 18 });
  }
}

// Tira de 58 mm: la misma imagen que sale por la impresora térmica.
async function tira(n, negocio, jsPDF) {
  const canvas = await dibujarNota({
    numero: n.numero, vendedor: n.vendedor || '', terminal: n.terminal || '', cliente: n.cliente?.nombre || '',
    fecha: new Date(n.fecha).toLocaleString('es-CL'), pago: n.pago, descuento: n.descuento, descuentoLealtad: n.descuentoLealtad,
    lealtad: n.lealtadTexto ? { nivel: n.nivel, lineas: [n.lealtadTexto] } : null,
    items: n.items.map((i) => ({ nombre: i.nombre, cant: i.cantidad, precio: i.precio })),
  }, negocio);
  const w = 58, h = (canvas.height * w) / canvas.width;
  const doc = new jsPDF({ unit: 'mm', format: [w, h + 4], orientation: 'portrait' });
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 2, w, h, 'nota', 'FAST');
  return doc.output('datauristring').split(',')[1];
}
