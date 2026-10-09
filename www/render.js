// Dibuja la nota de venta como imagen (igual que Loyverse) y la convierte a comandos ESC/POS raster.
// Impresora de 58 mm = 384 puntos de ancho.
const ANCHO = 384;
const M = 8; // margen lateral
const FUENTE = 'Roboto, "Noto Sans", Arial, sans-serif';

export const clp = (n) => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function cargarImagen(src) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

// Corta un texto en líneas que quepan en "max" píxeles.
function envolver(ctx, texto, max) {
  const palabras = texto.split(' ');
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? actual + ' ' + p : p;
    if (ctx.measureText(prueba).width <= max || !actual) actual = prueba;
    else { lineas.push(actual); actual = p; }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

// Logo de respaldo mientras no exista www/logo.png.
function logoRespaldo(ctx, y) {
  const r = 26, cx = ANCHO / 2 - 92, cy = y + r;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `bold 36px ${FUENTE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('C', cx, cy + 2);
  ctx.fillStyle = '#000'; ctx.font = `bold 44px ${FUENTE}`; ctx.textAlign = 'left';
  ctx.fillText('COVECA', cx + r + 10, cy + 2);
  ctx.textBaseline = 'alphabetic';
  return y + r * 2 + 12;
}

export async function dibujarNota(nota, negocio) {
  const canvas = document.createElement('canvas');
  canvas.width = ANCHO;
  canvas.height = 3000; // se recorta al final
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ANCHO, canvas.height);
  ctx.fillStyle = '#000';
  let y = 8;

  const texto = (s, { size = 22, bold = false, align = 'left', x } = {}) => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FUENTE}`;
    ctx.textAlign = align;
    const px = x ?? (align === 'center' ? ANCHO / 2 : align === 'right' ? ANCHO - M : M);
    y += size + 4;
    ctx.fillText(s, px, y);
  };
  const parrafo = (s, opts = {}) => {
    ctx.font = `${opts.bold ? 'bold ' : ''}${opts.size || 20}px ${FUENTE}`;
    for (const l of envolver(ctx, s, ANCHO - M * 2)) texto(l, opts);
  };
  const separador = () => {
    y += 10;
    ctx.setLineDash([4, 4]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(ANCHO - M, y); ctx.stroke();
    ctx.setLineDash([]); y += 4;
  };

  // Encabezado
  const logo = await cargarImagen('logo.png');
  if (logo) {
    const w = Math.min(300, logo.width), h = logo.height * (w / logo.width);
    ctx.drawImage(logo, (ANCHO - w) / 2, y, w, h);
    y += h + 8;
  } else {
    y = logoRespaldo(ctx, y);
  }
  texto(negocio.eslogan, { size: 20, align: 'center' });
  texto(negocio.telefono, { size: 20, align: 'center' });
  y += 10;
  texto(`Vendedor: ${nota.vendedor}`, { size: 20 });
  texto(`Terminal: ${nota.terminal}`, { size: 20 });
  parrafo(`Cliente: ${nota.cliente}`, { size: 20, bold: true });
  texto(nota.fecha, { size: 20 });
  separador();

  // Detalle
  let total = 0;
  for (const it of nota.items) {
    const sub = it.cant * it.precio;
    total += sub;
    ctx.font = `bold 22px ${FUENTE}`;
    const anchoMonto = ctx.measureText(clp(sub)).width + 12;
    const lineas = envolver(ctx, it.nombre, ANCHO - M * 2 - anchoMonto);
    lineas.forEach((l, i) => {
      texto(l, { size: 22 });
      if (i === 0) { ctx.font = `22px ${FUENTE}`; ctx.textAlign = 'right'; ctx.fillText(clp(sub), ANCHO - M, y); }
    });
    texto(`${it.cant} x ${clp(it.precio)}`, { size: 19 });
    y += 6;
  }
  separador();

  // Total
  ctx.font = `bold 34px ${FUENTE}`; ctx.textAlign = 'left'; y += 40;
  ctx.fillText('Total', M, y);
  ctx.textAlign = 'right'; ctx.fillText(clp(total), ANCHO - M, y);
  texto(nota.pago, { size: 20 });
  ctx.font = `20px ${FUENTE}`; ctx.textAlign = 'right'; ctx.fillText(clp(total), ANCHO - M, y);
  separador();

  // Pie
  y += 4;
  parrafo(negocio.leyenda, { size: 19, align: 'center' });
  if (negocio.transferencia) {
    y += 12;
    texto('Datos para transferencia:', { size: 19, align: 'center' });
    for (const l of negocio.transferencia) texto(l, { size: 19, align: 'center' });
  }
  y += 24;

  // Recortar al alto usado (múltiplo de 8)
  const alto = Math.ceil(y / 8) * 8;
  const final = document.createElement('canvas');
  final.width = ANCHO; final.height = alto;
  final.getContext('2d').drawImage(canvas, 0, 0);
  return final;
}

// Convierte la imagen a blanco/negro y la empaqueta como ESC/POS (GS v 0) en franjas.
export function imagenAEscPos(canvas, umbral = 190) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const px = ctx.getImageData(0, 0, width, height).data;
  const bytesFila = width / 8;
  const salida = [0x1B, 0x40]; // reiniciar
  const FRANJA = 255;
  for (let y0 = 0; y0 < height; y0 += FRANJA) {
    const h = Math.min(FRANJA, height - y0);
    salida.push(0x1D, 0x76, 0x30, 0x00, bytesFila & 0xFF, bytesFila >> 8, h & 0xFF, h >> 8);
    for (let y = y0; y < y0 + h; y++) {
      for (let bx = 0; bx < bytesFila; bx++) {
        let b = 0;
        for (let bit = 0; bit < 8; bit++) {
          const i = (y * width + bx * 8 + bit) * 4;
          const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          if (lum < umbral) b |= 0x80 >> bit;
        }
        salida.push(b);
      }
    }
  }
  salida.push(0x1B, 0x64, 4); // avanzar papel
  let bin = '';
  for (let i = 0; i < salida.length; i += 8192) bin += String.fromCharCode.apply(null, salida.slice(i, i + 8192));
  return btoa(bin);
}
