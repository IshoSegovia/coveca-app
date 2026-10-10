// Reportes en PDF con la identidad de COVECA (logo, azul/rojo de marca, tablas ordenadas).
// Usa jsPDF + autotable (www/vendor). Todo se genera en el celular, sin internet.
import { clp } from './ui.js';

const AZUL = [62, 64, 149], AZUL_SUAVE = [231, 232, 244], ROJO = [236, 50, 55], ROJO_TEXTO = [196, 33, 39];
const TEXTO = [29, 31, 43], SUAVE = [91, 96, 112], BORDE = [217, 220, 229], FONDO = [245, 246, 250];
const AMBAR = [138, 83, 0], VERDE = [27, 94, 32];
export const COLORES = { AZUL, ROJO_TEXTO, AMBAR, VERDE, SUAVE };
const M = 16;                       // margen lateral (mm)
const PIE = 'COVECA · Su comercializadora de confianza · +56 9 7587 0827';

let logo = null;
async function cargarLogo() {
  if (logo) return logo;
  const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = 'logo-pdf.jpg'; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  logo = { data: c.toDataURL('image/jpeg', 0.92), ratio: img.height / img.width };
  return logo;
}

/** Crea un documento A4 con encabezado de marca. Devuelve un objeto con ayudas para armar el reporte. */
export async function nuevoReporte({ titulo, subtitulo }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const lg = await cargarLogo();

  // Franja superior azul con acento rojo
  doc.setFillColor(...AZUL); doc.rect(0, 0, W, 4, 'F');
  doc.setFillColor(...ROJO); doc.rect(0, 4, 38, 1.2, 'F');
  // Logo + título
  const anchoLogo = 46;
  doc.addImage(lg.data, 'JPEG', M, 12, anchoLogo, anchoLogo * lg.ratio);
  doc.setTextColor(...AZUL); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(titulo, W - M, 18, { align: 'right' });
  doc.setTextColor(...SUAVE); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  if (subtitulo) doc.text(subtitulo, W - M, 24, { align: 'right' });
  doc.text(`Generado el ${new Date().toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' })}`, W - M, 29, { align: 'right' });
  doc.setDrawColor(...BORDE); doc.setLineWidth(0.3); doc.line(M, 36, W - M, 36);

  let y = 44;
  const api = {
    doc, W,
    get y() { return y; }, set y(v) { y = v; },

    /** Recuadros de resumen: [{ valor, etiqueta, color? }] */
    resumen(items) {
      const gap = 4, w = (W - 2 * M - gap * (items.length - 1)) / items.length, h = 22;
      items.forEach((it, i) => {
        const x = M + i * (w + gap);
        doc.setFillColor(...FONDO); doc.setDrawColor(...BORDE); doc.roundedRect(x, y, w, h, 2, 2, 'FD');
        doc.setFillColor(...(it.color || AZUL)); doc.rect(x, y + 3, 1.2, h - 6, 'F');
        doc.setTextColor(...(it.color || TEXTO)); doc.setFont('helvetica', 'bold'); doc.setFontSize(it.grande ? 15 : 17);
        doc.text(String(it.valor), x + 6, y + 11);
        doc.setTextColor(...SUAVE); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        doc.text(it.etiqueta, x + 6, y + 17.5);
      });
      y += h + 8;
    },

    /** Dos bloques lado a lado (ej. "Para" y "De"): [{ titulo, lineas: [texto, ...] }] */
    bloques(items) {
      const gap = 6, w = (W - 2 * M - gap * (items.length - 1)) / items.length;
      const alto = Math.max(...items.map((b) => b.lineas.filter(Boolean).length)) * 5 + 12;
      items.forEach((b, i) => {
        const x = M + i * (w + gap);
        doc.setDrawColor(...BORDE); doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, w, alto, 2, 2, 'FD');
        doc.setTextColor(...AZUL); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
        doc.text(b.titulo.toUpperCase(), x + 4, y + 6);
        b.lineas.filter(Boolean).forEach((l, j) => {
          doc.setTextColor(...(j === 0 ? TEXTO : SUAVE)); doc.setFont('helvetica', j === 0 ? 'bold' : 'normal'); doc.setFontSize(j === 0 ? 11 : 9);
          doc.text(String(l), x + 4, y + 12 + j * 5);
        });
      });
      y += alto + 8;
    },

    /** Título de sección con línea de acento. */
    seccion(texto, nota) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setTextColor(...AZUL); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text(texto, M, y);
      doc.setFillColor(...ROJO); doc.rect(M, y + 1.8, 12, 0.8, 'F');
      y += 6;
      if (nota) {
        doc.setTextColor(...SUAVE); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        const l = doc.splitTextToSize(nota, W - 2 * M); doc.text(l, M, y + 1); y += l.length * 4 + 1;
      }
    },

    /** Tabla. columnas: [{ titulo, ancho?, alinear?: 'right'|'center' }]; filas: arrays; pie: fila de totales opcional. */
    tabla(columnas, filas, { pie = null, colorFila = null } = {}) {
      doc.autoTable({
        startY: y + 1,
        margin: { left: M, right: M, top: 20, bottom: 18 },
        head: [columnas.map((c) => c.titulo)],
        body: filas,
        foot: pie ? [pie] : undefined,
        theme: 'plain',
        styles: { font: 'helvetica', fontSize: 9, textColor: TEXTO, cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 }, lineColor: BORDE, lineWidth: { bottom: 0.2 } },
        headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        footStyles: { fillColor: AZUL_SUAVE, textColor: AZUL, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 252] },
        columnStyles: Object.fromEntries(columnas.map((c, i) => [i, { halign: c.alinear || 'left', cellWidth: c.ancho || 'auto' }])),
        didParseCell: (d) => {
          if (d.section === 'head' || d.section === 'foot') d.cell.styles.halign = columnas[d.column.index].alinear || 'left';
          if (colorFila && d.section === 'body') { const c = colorFila(d.row.index, d.column.index); if (c) { d.cell.styles.textColor = c; d.cell.styles.fontStyle = 'bold'; } }
        },
      });
      y = doc.lastAutoTable.finalY + 9;
    },

    /** Barras horizontales simples (ej. ventas por día). */
    barras(datos) {
      const max = Math.max(1, ...datos.map((d) => d.valor));
      const anchoEt = 22, anchoMonto = 28, x0 = M + anchoEt, anchoBarra = W - 2 * M - anchoEt - anchoMonto - 4;
      if (y + datos.length * 7 > 275) { doc.addPage(); y = 20; }
      datos.forEach((d, i) => {
        const yy = y + i * 7;
        doc.setTextColor(...TEXTO); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(d.etiqueta, M, yy + 3.3);
        doc.setFillColor(...FONDO); doc.setDrawColor(...BORDE); doc.roundedRect(x0, yy, anchoBarra, 4.5, 1.5, 1.5, 'FD');
        if (d.valor > 0) { doc.setFillColor(...AZUL); doc.roundedRect(x0, yy, Math.max(3, anchoBarra * d.valor / max), 4.5, 1.5, 1.5, 'F'); }
        doc.setFont('helvetica', 'normal'); doc.text(d.valor ? clp(d.valor) : '—', W - M, yy + 3.3, { align: 'right' });
      });
      y += datos.length * 7 + 6;
    },

    /** Pie de página en todas las hojas y devuelve el PDF en base64. */
    terminar() {
      const n = doc.getNumberOfPages();
      for (let i = 1; i <= n; i++) {
        doc.setPage(i);
        const H = doc.internal.pageSize.getHeight();
        doc.setDrawColor(...BORDE); doc.setLineWidth(0.3); doc.line(M, H - 13, W - M, H - 13);
        doc.setTextColor(...SUAVE); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        doc.text(PIE, M, H - 8);
        doc.text(`Página ${i} de ${n}`, W - M, H - 8, { align: 'right' });
        if (i > 1) { doc.setFillColor(...AZUL); doc.rect(0, 0, W, 2, 'F'); }
      }
      return doc.output('datauristring').split(',')[1];
    },
  };
  return api;
}

// ---------------------------------------------------------------- Guardar
const cap = window.Capacitor;
const esApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const Compartir = esApp ? ((cap.Plugins && cap.Plugins.Compartir) || cap.registerPlugin('Compartir')) : null;

/** Guarda el PDF: en el celular va a Descargas/COVECA y se abre; en el PC se descarga. */
export async function guardarPdf(base64, nombre) {
  if (esApp) {
    const r = await Compartir.guardarArchivo({ base64, nombre, mime: 'application/pdf' });
    return r?.ubicacion || 'Descargas/COVECA';
  }
  const a = document.createElement('a');
  a.href = 'data:application/pdf;base64,' + base64; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  return 'Descargas';
}
