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

// nota.tipo = 'cotizacion' (migración 0051): título COTIZACIÓN y "Válida hasta" en vez del N°; sin forma de pago,
// lealtad ni datos para transferencia; nota.leyenda reemplaza la leyenda de la nota de venta.
// nota.tipo = 'cambio' (migración 0056, ticket N° 12): NOTA DE CAMBIO con su N° (602-1), referencia a la nota de venta y
// motivo; productos en dos bloques (DEVUELVE con su destino y RECIBE, solo cantidades) y el valor del cambio; sin total,
// forma de pago, lealtad ni datos para transferencia. nota = { tipo, numero, ref, motivo, fecha, vendedor, terminal, cliente,
// devuelve: [{ nombre, cant, destino }], recibe: [{ nombre, cant }], valor, leyenda }
export async function dibujarNota(nota, negocio) {
  const esCot = nota.tipo === 'cotizacion', esCam = nota.tipo === 'cambio';
  if (esCot || esCam) negocio = { ...negocio, transferencia: [], leyenda: nota.leyenda || negocio.leyenda };
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
  texto(esCot ? 'COTIZACIÓN · VÁLIDA HASTA' : esCam ? 'NOTA DE CAMBIO' : 'NOTA DE VENTA', { size: 19, bold: true });
  ctx.font = `bold ${esCot ? 34 : 46}px ${FUENTE}`; ctx.textAlign = 'left'; y += 46;
  ctx.fillText(esCot ? nota.validaHasta : nota.numero ? `N° ${nota.numero}` : 'Sin número', M, y);
  const [fFecha, fHora] = String(nota.fecha || '').split(/,\s*/);
  ctx.font = `19px ${FUENTE}`; ctx.textAlign = 'right';
  ctx.fillText(fFecha || '', ANCHO - M, y - 22); if (fHora) ctx.fillText(fHora, ANCHO - M, y);
  y += 12; ctx.fillStyle = '#000'; ctx.fillRect(M, y, ANCHO - 2 * M, 4); y += 6;
  y += 4;
  parrafo(nota.cliente, { size: 24, bold: true });
  texto(`Vendedor: ${nota.vendedor} · ${nota.terminal}`, { size: 19 });
  if (esCam) {
    texto(`Ref. nota de venta N° ${nota.ref}`, { size: 20, bold: true });
    if (nota.motivo) parrafo(`Motivo: ${nota.motivo}`, { size: 19 });
  }
  separador();

  if (esCam) {
    // Dos bloques: lo que el cliente devuelve y lo que recibe (cantidades a la derecha)
    for (const [titulo, lista] of [['DEVUELVE', nota.devuelve || []], ['RECIBE', nota.recibe || []]]) {
      texto(titulo, { size: 20, bold: true });
      for (const it of lista) {
        ctx.font = `bold 22px ${FUENTE}`;
        const cant = `x${it.cant}`, anchoCant = ctx.measureText(cant).width + 12;
        envolver(ctx, it.nombre, ANCHO - M * 2 - anchoCant).forEach((l, i) => {
          texto(l, { size: 22 });
          if (i === 0) { ctx.font = `bold 22px ${FUENTE}`; ctx.textAlign = 'right'; ctx.fillText(cant, ANCHO - M, y); }
        });
        if (it.destino) texto(it.destino === 'baja' ? 'Se da de baja' : 'Vuelve a bodega', { size: 19 });
        y += 6;
      }
      separador();
    }
    texto('Valor del cambio (mismo valor)', { size: 20 });
    ctx.font = `bold 22px ${FUENTE}`; ctx.textAlign = 'right'; ctx.fillText(clp(nota.valor || 0), ANCHO - M, y);
    separador();
  } else {

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
  if (nota.pago && !esCot) {   // sin forma de pago (se decide al entregar) no se imprime la línea
    texto(nota.pago, { size: 20 });
    ctx.font = `20px ${FUENTE}`; ctx.textAlign = 'right'; ctx.fillText(clp(total), ANCHO - M, y);
  }
  separador();

  // Programa de lealtad
  if (nota.lealtad && !esCot) {
    y += 4;
    parrafo(nota.lealtad.lineas[0], { size: 22, bold: true });
    if (nota.lealtad.lineas[1]) parrafo(nota.lealtad.lineas[1], { size: 19 });
    separador();
  }

  }   // fin de la nota de venta o cotización (la nota de cambio no lleva total, pago ni lealtad)

  // Pie
  y += 4;
  const inicioPie = y;
  if (negocio.transferencia?.length) {
    // Letra 20 % más grande en el pie (pedido del 17-10-2026: a los clientes les costaba leerla).
    texto('Datos para transferencia', { size: 23, bold: true });
    for (const l of negocio.transferencia) parrafo(l, { size: 23 });
    y += 12;
  }
  parrafo(negocio.leyenda || '', { size: 22 });
  // Pie (datos para transferencia y leyenda) un 20 % más alto hacia abajo (pedido del 17-10-2026).
  y += Math.round((y - inicioPie) * 0.2);
  // Final: espacio en blanco y franja 8 bits (igual que arriba) como guía de corte, lejos del último texto
  // (17-10-2026: la leyenda quedaba al borde y la cortaban al arrancar el papel).
  y += 40;
  ctx.fillStyle = '#000';
  for (let i = 0, x = 0; x < ANCHO; i++, x += 24) { if (i % 3 !== 1) ctx.fillRect(x, y, 24, 6); }
  y += 14;

  // Recortar al alto usado (múltiplo de 8)
  const alto = Math.ceil(y / 8) * 8;
  const final = document.createElement('canvas');
  final.width = ANCHO; final.height = alto;
  final.getContext('2d').drawImage(canvas, 0, 0);
  return final;
}

// Convierte la imagen a blanco/negro y la empaqueta como ESC/POS (GS v 0) en franjas.
const AVANCE = 8; // líneas de avance final (~30 mm); la sierra de la RPP02N queda ~15 mm sobre el cabezal
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
  salida.push(0x1B, 0x64, AVANCE); // papel en blanco al final para que la franja pase la sierra de corte
  const largoMm = (height + AVANCE * 30) / 8;
  let bin = '';
  for (let i = 0; i < salida.length; i += 8192) bin += String.fromCharCode.apply(null, salida.slice(i, i + 8192));
  return { data: btoa(bin), largoMm };
}
