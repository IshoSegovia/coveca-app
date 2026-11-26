// Código QR de la nota (apunta a la nota digital, n.html#<id>) con el estilo de COVECA:
// puntos redondeados azules, esquinas azul + centro rojo y el logo al medio.
// Corrección Q (25 %) para poder tapar el centro con el logo; se lee casi igual que un QR clásico.
// Requiere www/vendor/qrcode.js (cargado como <script>, define window.qrcode).
const AZUL = '#3E4095', ROJO = '#EC3237';

export function qrSvg(texto, { logo = 'logo-marca.png', tamLogo = 0.18 } = {}) {
  const qr = window.qrcode(0, 'Q');
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
      puntos += `<circle cx="${c + M + 0.5}" cy="${r + M + 0.5}" r="0.48"/>`;
    }
  }
  const ojo = (r, c) => {
    const x = c + M, y = r + M;
    return `<path fill="${AZUL}" fill-rule="evenodd" d="M${x + 1.6} ${y}h3.8a1.6 1.6 0 0 1 1.6 1.6v3.8a1.6 1.6 0 0 1-1.6 1.6h-3.8a1.6 1.6 0 0 1-1.6-1.6v-3.8a1.6 1.6 0 0 1 1.6-1.6z
      M${x + 1.9} ${y + 1}h3.2a0.9 0.9 0 0 1 0.9 0.9v3.2a0.9 0.9 0 0 1-0.9 0.9h-3.2a0.9 0.9 0 0 1-0.9-0.9v-3.2a0.9 0.9 0 0 1 0.9-0.9z"/>
      <rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9" fill="${ROJO}"/>`;
  };
  const lx = h0 + M, ancho = hueco;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" role="img" aria-label="Código QR de la nota">
  <rect width="${total}" height="${total}" fill="#fff"/>
  <g fill="${AZUL}">${puntos}</g>
  ${ojo(0, 0)}${ojo(0, n - 7)}${ojo(n - 7, 0)}
  <circle cx="${lx + ancho / 2}" cy="${lx + ancho / 2}" r="${ancho / 2}" fill="#fff"/>
  <image href="${logo}" x="${lx + 0.6}" y="${lx + 0.6}" width="${ancho - 1.2}" height="${ancho - 1.2}"/>
</svg>`;
}
