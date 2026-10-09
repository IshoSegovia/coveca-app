// Código QR con la nota completa en texto, para que el cliente la guarde en su teléfono.
// Funciona sin internet: toda la información va dentro del QR.
// Requiere www/vendor/qrcode.js (cargado como <script>, define window.qrcode).
import { clp } from './escpos.js';

export function textoNota(nota, negocio) {
  // Texto corto a propósito: menos texto = QR menos denso = se lee más fácil con cualquier cámara.
  const lineas = [`COVECA - Nota de venta`, nota.fecha, nota.cliente, ''];
  let total = 0;
  for (const it of nota.items) {
    const sub = it.cant * it.precio;
    total += sub;
    lineas.push(`${it.cant} x ${it.nombre}: ${clp(sub)}`);
  }
  lineas.push('', `TOTAL ${clp(total)} (${nota.pago})`);
  return lineas.join('\n');
}

// QR con estilo COVECA: puntos redondeados azules, esquinas azul + centro rojo, logo al medio.
// Corrección Q (25 %) para tapar el centro con el logo; texto corto para que no sea denso.
// Probado: se lee casi igual que un QR clásico (ver historial de commits).
const AZUL = '#3E4095', ROJO = '#EC3237';

export function qrSvg(texto, { logo = 'logo-marca.png', nivel = 'Q', forma = 'punto', tamLogo = 0.18, plano = false } = {}) {
  const qr = window.qrcode(0, nivel);
  qr.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
  qr.addData(texto, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const M = 4;                      // margen blanco (zona de silencio)
  const total = n + M * 2;
  // Zona central libre para el logo: ~22 % del ancho, en número impar de módulos.
  let hueco = Math.round(n * tamLogo); if (hueco % 2 === 0) hueco++;
  const h0 = Math.floor((n - hueco) / 2), h1 = h0 + hueco;
  const esOjo = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const enHueco = (r, c) => r >= h0 && r < h1 && c >= h0 && c < h1;

  let puntos = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c) || esOjo(r, c) || enHueco(r, c)) continue;
      puntos += forma === 'punto'
        ? `<circle cx="${c + M + 0.5}" cy="${r + M + 0.5}" r="0.48"/>`
        : `<rect x="${c + M + 0.04}" y="${r + M + 0.04}" width="0.92" height="0.92" rx="0.3"/>`;
    }
  }
  const ojo = (r, c) => {
    const x = c + M, y = r + M;
    return `<path fill="${AZUL}" fill-rule="evenodd" d="M${x + 1.6} ${y}h3.8a1.6 1.6 0 0 1 1.6 1.6v3.8a1.6 1.6 0 0 1-1.6 1.6h-3.8a1.6 1.6 0 0 1-1.6-1.6v-3.8a1.6 1.6 0 0 1 1.6-1.6z
      M${x + 1.9} ${y + 1}h3.2a0.9 0.9 0 0 1 0.9 0.9v3.2a0.9 0.9 0 0 1-0.9 0.9h-3.2a0.9 0.9 0 0 1-0.9-0.9v-3.2a0.9 0.9 0 0 1 0.9-0.9z"/>
      <rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9" fill="${ROJO}"/>`;
  };
  const lx = h0 + M, ancho = hueco;
  if (plano) {   // referencia: QR clásico negro, sin logo
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + M} ${r + M}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}"><rect width="${total}" height="${total}" fill="#fff"/><path d="${d}"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" role="img" aria-label="Código QR de la nota">
  <rect width="${total}" height="${total}" fill="#fff"/>
  <g fill="${AZUL}">${puntos}</g>
  ${ojo(0, 0)}${ojo(0, n - 7)}${ojo(n - 7, 0)}
  <circle cx="${lx + ancho / 2}" cy="${lx + ancho / 2}" r="${ancho / 2}" fill="#fff"/>
  <image href="${logo}" x="${lx + 0.6}" y="${lx + 0.6}" width="${ancho - 1.2}" height="${ancho - 1.2}"/>
</svg>`;
}
