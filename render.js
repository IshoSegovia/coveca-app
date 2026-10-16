// Dibuja la nota de venta como imagen y la convierte a comandos ESC/POS raster.
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

// Logo dibujado si no carga www/logo.png.
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
    ctx.setLineDash([]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(ANCHO - M, y); ctx.stroke();
    ctx.setLineDash([]); y += 4;
  };

  // Encabezado (diseño "Limpio" en blanco y negro): franja 8 bits, logo y datos a la izquierda,
  // N° grande, fecha a la derecha y una línea gruesa antes del cliente.
  for (let i = 0, x = 0; x < ANCHO; i++, x += 24) { if (i % 3 !== 1) { ctx.fillStyle = '#000'; ctx.fillRect(x, 0, 24, i % 3 ? 6 : 10); } }
  y = 22;
  const logo = await cargarImagen('logo.png');
  if (logo) {
    const w = Math.min(230, logo.width), h = logo.height * (w / logo.width);
    ctx.drawImage(logo, M, y, w, h);
    y += h + 4;
  } else {
    y = logoRespaldo(ctx, y);
  }
  if (negocio.eslogan) texto(negocio.eslogan, { size: 19 });
  if (negocio.telefono) texto(negocio.telefono, { size: 19 });
  y += 14;
  texto('NOTA DE VENTA', { size: 19, bold: true });
  ctx.font = `bold 46px ${FUENTE}`; ctx.textAlign = 'left'; y += 46;
  ctx.fillText(nota.numero ? `N° ${nota.numero}` : 'Sin número', M, y);
  const [fFecha, fHora] = String(nota.fecha || '').split(/,\s*/);
  ctx.font = `19px ${FUENTE}`; ctx.textAlign = 'right';
  ctx.fillText(fFecha || '', ANCHO - M, y - 22); if (fHora) ctx.fillText(fHora, ANCHO - M, y);
  y += 12; ctx.fillStyle = '#000'; ctx.fillRect(M, y, ANCHO - 2 * M, 4); y += 6;
  y += 4;
  parrafo(nota.cliente, { size: 24, bold: true });
  texto(`Vendedor: ${nota.vendedor} · ${nota.terminal}`, { size: 19 });
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

  // Subtotal y descuento (si hay)
  if (nota.descuento || nota.descuentoLealtad) {
    texto('Subtotal', { size: 20 });
    ctx.font = `20px ${FUENTE}`; ctx.textAlign = 'right'; ctx.fillText(clp(total), ANCHO - M, y);
    if (nota.descuentoLealtad) {
      texto(`Desc. cliente ${nota.lealtad?.nivel || ''}`.trim(), { size: 20 });
      ctx.font = `20px ${FUENTE}`; ctx.textAlign = 'right'; ctx.fillText('-' + clp(nota.descuentoLealtad), ANCHO - M, y);
    }
    if (nota.descuento) {
      texto('Descuento', { size: 20 });
      ctx.font = `20px ${FUENTE}`; ctx.textAlign = 'right'; ctx.fillText('-' + clp(nota.descuento), ANCHO - M, y);
    }
    total = Math.max(0, total - (nota.descuentoLealtad || 0) - (nota.descuento || 0));
  }

  // Total
  ctx.font = `bold 20px ${FUENTE}`; ctx.textAlign = 'left'; y += 44;
  ctx.fillText('TOTAL', M, y);
  ctx.font = `bold 42px ${FUENTE}`; ctx.textAlign = 'right'; ctx.fillText(clp(total), ANCHO - M, y);
  if (nota.pago) {   // sin forma de pago (se decide al entregar) no se imprime la línea
    texto(nota.pago, { size: 20 });
    ctx.font = `20px ${FUENTE}`; ctx.textAlign = 'right'; ctx.fillText(clp(total), ANCHO - M, y);
  }
  separador();

  // Programa de lealtad
  if (nota.lealtad) {
    y += 4;
    parrafo(nota.lealtad.lineas[0], { size: 22, bold: true });
    if (nota.lealtad.lineas[1]) parrafo(nota.lealtad.lineas[1], { size: 19 });
    separador();
  }

  // Pie
  y += 4;
  if (negocio.transferencia?.length) {
    texto('Datos para transferencia', { size: 19, bold: true });
    for (const l of negocio.transferencia) parrafo(l, { size: 19 });
    y += 12;
  }
  parrafo(negocio.leyenda || '', { size: 18 });
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
  salida.push(0x1B, 0x64, 6); // papel en blanco al final para cortar
  const largoMm = (height + 6 * 30) / 8;
  let bin = '';
  for (let i = 0; i < salida.length; i += 8192) bin += String.fromCharCode.apply(null, salida.slice(i, i + 8192));
  return { data: btoa(bin), largoMm };
}
