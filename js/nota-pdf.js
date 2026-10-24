// Nota de venta en hoja completa (PDF). Dos estilos (decisión del 17-10-2026):
//   'limpia': lo que se imprime en papel desde el PC (blanco, N° azul, línea oscura).
//   'azul':   "Guardar en PDF" (opción C "Columna lateral": columna azul con logo, N°, fecha y QR grande).
// Formato: hoja carta con la nota arriba (Original · Cliente) y una copia abajo (Copia · COVECA), con línea de corte
// (media carta). Con más de MAX_MEDIA productos sale una nota por hoja carta, y si es larga sigue en otra hoja.
import { cargarLogo } from './pdf.js';
import { clp, fechaHora } from './ui.js';

const AZUL = [62, 64, 149], AZUL_O = [44, 46, 115], AZUL_S = [238, 240, 250], ROJO = [236, 50, 55], ROJO_TEXTO = [196, 33, 39];
const TEXTO = [29, 31, 43], SUAVE = [91, 96, 112], BORDE = [217, 220, 229], BLANCO = [255, 255, 255], BLANCO_S = [214, 216, 240];
const CARTA = { w: 215.9, h: 279.4 };
export const MAX_MEDIA = 9;   // productos que caben en media carta; con más, se usa carta

// enlace: n.html#<id> para el QR (solo notas guardadas)
// Título y "número grande" del encabezado: nota de venta (N°) o cotización (válida hasta).
const titulo = (n) => (n.tipo === 'cotizacion' ? 'COTIZACIÓN · VÁLIDA HASTA' : 'NOTA DE VENTA');
const numeroGrande = (n) => (n.tipo === 'cotizacion' ? fechaLarga(n.valida_hasta) : n.numero ? `N° ${n.numero}` : 'Sin número');
const fechaLarga = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '') : '');
const fechaCorta = (d) => (d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '');

/**
 * n = { numero, fecha, cliente: {nombre, razon_social, rut, direccion, comuna, telefono}, vendedor, terminal,
 *       pago, vence, items: [{nombre, cantidad, precio, subtotal}], subtotal, descuentoLealtad, nivel, descuento, total, anulada }
 * Devuelve el PDF en base64.
 */
export async function notaPdf(n, negocio, estilo = 'azul') {
  const { jsPDF } = window.jspdf;
  // Cotización (n.tipo = 'cotizacion', migración 0051): título COTIZACIÓN y "válida hasta" en vez del N°; sin QR, sin datos
  // para transferencia ni forma de pago, con su propia leyenda; una sola copia en hoja carta.
  const esCot = n.tipo === 'cotizacion';
  if (esCot) negocio = { ...negocio, transferencia: [], leyenda: n.leyenda || negocio.leyenda };
  else if (!n.enlace && /^[0-9a-f-]{36}$/i.test(n.id || '')) n = { ...n, enlace: `https://ishosegovia.github.io/coveca-app/n.html#${n.id}` };
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const azul = estilo === 'azul';
  const lg = azul ? await cargarLogoNegativo() : await cargarLogo();
  const dibujar = azul ? bloqueC : bloque;
  if (n.items.length <= MAX_MEDIA && !esCot) {
    const mitad = CARTA.h / 2;
    dibujar(doc, n, negocio, lg, { y0: 0, alto: mitad, compacta: true, etiqueta: 'Original · Cliente' });
    // Línea de corte
    doc.setDrawColor(...SUAVE); doc.setLineWidth(0.2); doc.setLineDashPattern([2, 2], 0);
    doc.line(6, mitad, CARTA.w - 6, mitad); doc.setLineDashPattern([], 0);
    doc.setFontSize(7); doc.setTextColor(...SUAVE); doc.text('cortar aquí', CARTA.w / 2, mitad - 1.2, { align: 'center' });
    dibujar(doc, n, negocio, lg, { y0: mitad, alto: mitad, compacta: true, etiqueta: 'Copia · COVECA' });
  } else {
    dibujar(doc, n, negocio, lg, { y0: 0, alto: CARTA.h, compacta: false, etiqueta: '' });
  }
  return doc.output('datauristring').split(',')[1];
}

// Logo blanco (versión negativa) para la columna azul: el SVG se pasa a PNG una sola vez.
let logoNeg;
async function cargarLogoNegativo() {
  if (logoNeg !== undefined) return logoNeg;
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = 'marca/coveca-negativo.svg'; });
    const ratio = img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1 / 3.9;
    const c = document.createElement('canvas'); c.width = 900; c.height = Math.round(900 * ratio);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    logoNeg = { data: c.toDataURL('image/png'), ratio };
  } catch (_) { logoNeg = null; }   // sin logo: la columna lleva el nombre escrito
  return logoNeg;
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
  doc.text(titulo(n), W - M, y + 3, { align: 'right' }); doc.setCharSpace(0);
  doc.setTextColor(...AZUL); fs(n.tipo === 'cotizacion' ? 20 : 26);
  doc.text(numeroGrande(n), W - M, y + 13, { align: 'right' });
  doc.setFont('helvetica', 'normal'); fs(9); doc.setTextColor(...SUAVE);
  doc.text((n.tipo === 'cotizacion' ? `Hecha el ${fechaHora(n.fecha)}` : fechaHora(n.fecha)) + (etiqueta ? `  ·  ${etiqueta}` : ''), W - M, y + 18.5, { align: 'right' });
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

// Diseño C "Columna lateral" (Guardar en PDF): columna azul a la izquierda con logo, N°, fecha, QR y transferencia;
// a la derecha cliente, detalle y TOTAL. En notas largas la columna se repite en cada hoja.
function bloqueC(doc, n, negocio, lg, { y0, alto, compacta, etiqueta }) {
  const W = CARTA.w, cw = compacta ? 50 : 56, k = compacta ? 0.88 : 1, X = cw + 8, D = W - 12;   // X: inicio del contenido; D: borde derecho
  const fs = (t) => doc.setFontSize(t * k);
  const columna = (x0, y, h, completa) => {
    doc.setFillColor(...AZUL_O); doc.rect(0, y, cw, h, 'F');
    if (!completa) return;
    const pad = 6, ancho = cw - 2 * pad;
    let yy = y + 9;
    if (lg) { const al = ancho * lg.ratio; doc.addImage(lg.data, 'PNG', pad, yy, ancho, al, 'logoneg', 'FAST'); yy += al + 3; }
    else { doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLANCO); fs(14); doc.text('COVECA', pad, yy + 5); yy += 9; }
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLANCO_S); fs(7.5);
    const sub = doc.splitTextToSize([negocio.eslogan, negocio.telefono].filter(Boolean).join(' · '), ancho); doc.text(sub, pad, yy); yy += sub.length * 3.2 + 6;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLANCO_S); fs(7.5); doc.setCharSpace(0.3); doc.text(titulo(n), pad, yy); doc.setCharSpace(0);
    doc.setTextColor(...BLANCO); fs(n.tipo === 'cotizacion' ? 15 : compacta ? 22 : 26); doc.text(numeroGrande(n), pad, yy + (compacta ? 9 : 11));
    yy += compacta ? 15 : 18;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLANCO_S); fs(8.5);
    doc.text(doc.splitTextToSize(n.tipo === 'cotizacion' ? `Hecha el ${fechaHora(n.fecha)}` : fechaHora(n.fecha), ancho), pad, yy); yy += 6;
    if (etiqueta) { doc.setFont('helvetica', 'bold'); fs(8); doc.setTextColor(...BLANCO); doc.text(etiqueta, pad, yy); yy += 4; }
    // QR sobre fondo blanco, abajo de la columna
    const lado = compacta ? 30 : 36, yq = y + h - (compacta ? 12 : 14) - lado - 4;
    const lineasT = (negocio.transferencia || []).filter(Boolean);
    if (n.enlace) {
      doc.setFillColor(...BLANCO); doc.rect(pad, yq, ancho, lado + 4, 'F');
      qrPdf(doc, n.enlace, pad + (ancho - lado) / 2, yq + 2, lado);
      doc.setFont('helvetica', 'normal'); fs(7); doc.setTextColor(...BLANCO_S); doc.text('Escanea para ver tu nota', pad, yq + lado + 8);
    }
    if (lineasT.length) {
      const yT = Math.max(yy + 4, yq - 4 - (lineasT.length * 3.2 + 5));
      doc.setFont('helvetica', 'bold'); fs(7.5); doc.setTextColor(...BLANCO); doc.text('Datos para transferencia', pad, yT);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLANCO_S); lineasT.forEach((l, j) => doc.text(doc.splitTextToSize(l, ancho)[0], pad, yT + 3.6 + j * 3.2));
    }
  };
  columna(0, y0, alto, true);

  let y = y0 + (compacta ? 11 : 16);
  // Cliente y vendedor
  const c = n.cliente || {};
  const col = (et, lineas, x, ancho) => {
    doc.setFont('helvetica', 'bold'); fs(7.5); doc.setTextColor(...SUAVE); doc.setCharSpace(0.25); doc.text(et, x, y); doc.setCharSpace(0);
    const ls = (lineas.length ? lineas : ['—']).flatMap((l, j) => doc.splitTextToSize(String(l), ancho - 3).slice(0, j === 0 ? 2 : 1));
    ls.forEach((l, j) => { doc.setFont('helvetica', et === 'CLIENTE' && j === 0 ? 'bold' : 'normal'); fs(et === 'CLIENTE' && j === 0 ? 11 : 9); doc.setTextColor(...TEXTO); doc.text(l, x, y + 4.8 + j * (compacta ? 3.9 : 4.6)); });
    return ls.length;
  };
  const mitadAncho = (D - X) / 2;
  const f1 = col('CLIENTE', [c.nombre, c.razon_social && c.razon_social !== c.nombre ? c.razon_social : '', c.rut ? `RUT ${c.rut}` : ''].filter(Boolean), X, mitadAncho + 6);
  const f2 = col('VENDEDOR', [n.vendedor, n.terminal, n.pago ? `Pago: ${n.pago}` : '', n.vence ? `Vence ${fechaCorta(n.vence)}` : ''].filter(Boolean), X + mitadAncho + 6, mitadAncho - 6);
  y += 5 + Math.max(f1, f2) * (compacta ? 3.9 : 4.6);
  const dir = [[c.direccion, c.comuna].filter(Boolean).join(', '), c.telefono ? `Tel. ${c.telefono}` : ''].filter(Boolean).join(' · ');
  if (dir) { doc.setFont('helvetica', 'normal'); fs(8.5); doc.setTextColor(...SUAVE); doc.text(doc.splitTextToSize(dir, D - X)[0], X, y); y += 4; }
  y += compacta ? 2 : 4;

  const conRef = n.items.some((i) => i.ref);
  doc.autoTable({
    startY: y,
    margin: { left: X, right: W - D, top: 14, bottom: compacta ? 0 : 36 },
    head: [[...(conRef ? ['REF'] : []), 'PRODUCTO', 'CANT.', 'PRECIO', 'TOTAL']],
    body: n.items.map((i) => [...(conRef ? [i.ref || ''] : []), i.nombre, String(i.cantidad), clp(i.precio), clp(i.subtotal ?? i.cantidad * i.precio)]),
    theme: 'plain',
    rowPageBreak: 'avoid', pageBreak: compacta ? 'avoid' : 'auto', showHead: 'everyPage',
    styles: { font: 'helvetica', fontSize: 9 * k, textColor: TEXTO, cellPadding: { top: compacta ? 1.2 : 1.9, bottom: compacta ? 1.2 : 1.9, left: 1.5, right: 1.5 } },
    headStyles: { textColor: AZUL, fillColor: AZUL_S, fontStyle: 'bold', fontSize: 7.5 * k },
    columnStyles: conRef ? { 0: { cellWidth: 14, textColor: SUAVE }, 2: { halign: 'right', cellWidth: 13 }, 3: { halign: 'right', cellWidth: 22 }, 4: { halign: 'right', cellWidth: 22, fontStyle: 'bold' } }
      : { 1: { halign: 'right', cellWidth: 13 }, 2: { halign: 'right', cellWidth: 22 }, 3: { halign: 'right', cellWidth: 22, fontStyle: 'bold' } },
    didParseCell: (d) => { if (d.section === 'head' && d.column.index > (conRef ? 1 : 0)) d.cell.styles.halign = 'right'; },
    // Filas separadas por una línea punteada
    didDrawCell: (d) => {
      if (d.section !== 'body' || d.column.index !== 0) return;
      doc.setDrawColor(...BORDE); doc.setLineWidth(0.2); doc.setLineDashPattern([0.8, 0.8], 0);
      doc.line(d.cell.x, d.cell.y + d.cell.height, D, d.cell.y + d.cell.height); doc.setLineDashPattern([], 0);
    },
    // Hojas siguientes: se repite la columna azul (solo el fondo, el logo y datos quedan en la primera)
    willDrawPage: (d) => { if (d.pageNumber > 1) columna(0, 0, CARTA.h, false); },
  });
  y = doc.lastAutoTable.finalY + 3;
  if (!compacta && y > CARTA.h - 50) { doc.addPage(); columna(0, 0, CARTA.h, false); y = 20; }

  // Subtotal y descuentos
  const filasTot = [['Subtotal', clp(n.subtotal)]];
  if (n.descuentoLealtad) filasTot.push([`Descuento cliente ${n.nivel || ''}`.trim(), '-' + clp(n.descuentoLealtad)]);
  if (n.descuento) filasTot.push(['Descuento', '-' + clp(n.descuento)]);
  doc.setFont('helvetica', 'normal'); fs(9);
  if (filasTot.length > 1) filasTot.forEach(([et, v]) => { y += 4.3 * k; doc.setTextColor(...SUAVE); doc.text(et, D - 62, y); doc.setTextColor(...TEXTO); doc.text(v, D, y, { align: 'right' }); });
  if (n.lealtadTexto) { doc.setFont('helvetica', 'bold'); fs(8.5); doc.setTextColor(...AZUL); doc.text(doc.splitTextToSize(n.lealtadTexto, D - X - 66), X, y); }

  // TOTAL grande en una franja azul clara, pegado al final de la franja de la hoja
  const hT = compacta ? 15 : 18, yT = Math.max(y + 5, y0 + alto - (compacta ? 12 : 14) - hT);
  doc.setFillColor(...AZUL_S); doc.rect(X, yT, D - X, hT, 'F');
  doc.setFont('helvetica', 'bold'); fs(8); doc.setTextColor(...SUAVE); doc.setCharSpace(0.35); doc.text('TOTAL', X + 4, yT + hT / 2 + 1.2); doc.setCharSpace(0);
  doc.setTextColor(...AZUL); fs(compacta ? 22 : 26); doc.text(clp(n.total), D - 4, yT + hT / 2 + (compacta ? 3.6 : 4.4), { align: 'right' });
  doc.setFont('helvetica', 'normal'); fs(7.5); doc.setTextColor(...SUAVE);
  if (negocio.leyenda) { const ls = doc.splitTextToSize(negocio.leyenda, D - X); doc.text(n.tipo === 'cotizacion' ? ls.slice(0, 3) : ls[0], X, yT + hT + 4.5); }   // la de la cotización, completa

  if (n.anulada) {
    doc.setTextColor(...ROJO_TEXTO); doc.setFont('helvetica', 'bold'); doc.setFontSize(compacta ? 40 : 60);
    doc.text('ANULADA', (X + D) / 2, y0 + alto / 2 + 8, { align: 'center', angle: 18 });
  }
}
