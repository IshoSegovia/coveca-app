// Comandos ESC/POS para la impresora térmica de 58 mm (RPP02N).
// Modo "texto + logo": el logo va como imagen y el resto con la fuente de la impresora.
const ANCHO_PX = 384;       // 58 mm
export const COLUMNAS = 32; // caracteres por línea con la fuente normal
const AVANCE_FINAL = 6;     // líneas en blanco al final para poder cortar

// Página de códigos para acentos y ñ. PC850 = 2, Windows-1252 = 16.
const PC850 = { 'á':0xA0,'é':0x82,'í':0xA1,'ó':0xA2,'ú':0xA3,'ñ':0xA4,'Ñ':0xA5,'Á':0xB5,'É':0x90,'Í':0xD6,'Ó':0xE0,'Ú':0xE9,'ü':0x81,'Ü':0x9A,'¿':0xA8,'¡':0xAD,'°':0xF8 };
const CP1252 = { 'á':0xE1,'é':0xE9,'í':0xED,'ó':0xF3,'ú':0xFA,'ñ':0xF1,'Ñ':0xD1,'Á':0xC1,'É':0xC9,'Í':0xCD,'Ó':0xD3,'Ú':0xDA,'ü':0xFC,'Ü':0xDC,'¿':0xBF,'¡':0xA1,'°':0xB0 };
export const TABLAS = { pc850: { n: 2, mapa: PC850 }, cp1252: { n: 16, mapa: CP1252 } };

export const clp = (n) => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Corta un texto en líneas de "ancho" caracteres sin partir palabras.
export function envolverTexto(texto, ancho) {
  const lineas = [];
  let actual = '';
  for (const p of texto.split(' ')) {
    if (!actual) actual = p;
    else if ((actual + ' ' + p).length <= ancho) actual += ' ' + p;
    else { lineas.push(actual); actual = p; }
  }
  if (actual) lineas.push(actual);
  return lineas.flatMap((l) => l.match(new RegExp(`.{1,${ancho}}`, 'g')) || ['']);
}

export class Ticket {
  constructor(codigo = 'pc850') {
    this.bytes = [];
    this.tabla = TABLAS[codigo];
    this.raw(0x1B, 0x40);                // reiniciar
    this.raw(0x1B, 0x74, this.tabla.n);  // página de códigos
  }
  raw(...b) { for (const x of b) this.bytes.push(x); return this; }
  usarTabla(codigo) { this.tabla = TABLAS[codigo]; return this.raw(0x1B, 0x74, this.tabla.n); }
  texto(s) {
    for (const ch of s) {
      const c = ch.charCodeAt(0);
      this.bytes.push(c < 128 ? c : (this.tabla.mapa[ch] ?? 0x3F));
    }
    return this;
  }
  linea(s = '') { return this.texto(s).raw(0x0A); }
  centro() { return this.raw(0x1B, 0x61, 1); }
  izquierda() { return this.raw(0x1B, 0x61, 0); }
  negrita(on = true) { return this.raw(0x1B, 0x45, on ? 1 : 0); }
  alto(on = true) { return this.raw(0x1D, 0x21, on ? 0x01 : 0x00); }   // doble alto, mismo ancho
  separador(ch = '-') { return this.linea(ch.repeat(COLUMNAS)); }
  // Texto a la izquierda y monto a la derecha; el texto largo se envuelve.
  par(izq, der, ancho = COLUMNAS) {
    const libre = ancho - der.length - 1;
    const lineas = envolverTexto(izq, libre);
    lineas.forEach((l, i) => {
      if (i === 0) this.linea(l + ' '.repeat(ancho - l.length - der.length) + der);
      else this.linea(l);
    });
    return this;
  }
  parrafo(s) { for (const l of envolverTexto(s, COLUMNAS)) this.linea(l); return this; }
  avanzar(n = AVANCE_FINAL) { return this.raw(0x1B, 0x64, n); }
  // Imagen (canvas de 384 px de ancho) en franjas GS v 0.
  imagen(canvas, umbral = 190) {
    const { width, height } = canvas;
    const px = canvas.getContext('2d').getImageData(0, 0, width, height).data;
    const bytesFila = width / 8;
    const FRANJA = 255;
    for (let y0 = 0; y0 < height; y0 += FRANJA) {
      const h = Math.min(FRANJA, height - y0);
      this.raw(0x1D, 0x76, 0x30, 0x00, bytesFila & 0xFF, bytesFila >> 8, h & 0xFF, h >> 8);
      for (let y = y0; y < y0 + h; y++) {
        for (let bx = 0; bx < bytesFila; bx++) {
          let b = 0;
          for (let bit = 0; bit < 8; bit++) {
            const i = (y * width + bx * 8 + bit) * 4;
            const a = px[i + 3] / 255;
            const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) * a + 255 * (1 - a);
            if (lum < umbral) b |= 0x80 >> bit;
          }
          this.bytes.push(b);
        }
      }
    }
    return this;
  }
  // Largo estimado del papel en mm: líneas de texto (~30 puntos), doble alto (+24), imágenes y avance.
  largoMm() {
    const b = this.bytes;
    let puntos = 0, doble = false;
    for (let i = 0; i < b.length; i++) {
      const c = b[i];
      if (c === 0x1D && b[i + 1] === 0x76) {               // imagen GS v 0
        const w = b[i + 4] + b[i + 5] * 256, h = b[i + 6] + b[i + 7] * 256;
        puntos += h; i += 7 + w * h; continue;
      }
      if (c === 0x1D && b[i + 1] === 0x21) { doble = b[i + 2] !== 0; i += 2; continue; }
      if (c === 0x1B && b[i + 1] === 0x64) { puntos += b[i + 2] * 30; i += 2; continue; }
      if (c === 0x1B) { i += b[i + 1] === 0x40 ? 1 : 2; continue; }
      if (c === 0x0A) puntos += doble ? 54 : 30;
    }
    return puntos / 8;
  }
  base64() {
    let bin = '';
    for (let i = 0; i < this.bytes.length; i += 8192) bin += String.fromCharCode.apply(null, this.bytes.slice(i, i + 8192));
    return btoa(bin);
  }
}

// Logo centrado en un lienzo de 384 px (la alineación de imágenes no es confiable en impresoras baratas).
export async function lienzoLogo(src = 'logo.png', anchoLogo = 300) {
  const img = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
  if (!img) return null;
  const h = Math.round(img.height * (anchoLogo / img.width));
  const c = document.createElement('canvas');
  c.width = ANCHO_PX; c.height = Math.ceil((h + 8) / 8) * 8;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, (ANCHO_PX - anchoLogo) / 2, 4, anchoLogo, h);
  return c;
}

// Nota de venta completa en modo texto + logo.
export async function notaTexto(nota, negocio, codigo = 'pc850', conPruebaAcentos = false) {
  const t = new Ticket(codigo);
  const logo = await lienzoLogo();
  if (logo) t.imagen(logo); else t.centro().negrita().alto().linea('COVECA').alto(false).negrita(false);
  t.centro().linea(negocio.eslogan).linea(negocio.telefono).linea()
    .izquierda()
    .linea(`Vendedor: ${nota.vendedor}`)
    .linea(`Terminal: ${nota.terminal}`)
    .negrita();
  t.parrafo(`Cliente: ${nota.cliente}`).negrita(false)
    .linea(nota.fecha)
    .separador();
  let total = 0;
  for (const it of nota.items) {
    const sub = it.cant * it.precio;
    total += sub;
    t.par(it.nombre, clp(sub)).linea(`  ${it.cant} x ${clp(it.precio)}`);
  }
  t.separador();
  if (nota.descuento) {
    t.par('Subtotal', clp(total)).par('Descuento', '-' + clp(nota.descuento));
    total = Math.max(0, total - nota.descuento);
  }
  t.negrita().alto().par('TOTAL', clp(total)).alto(false).negrita(false)
    .par(nota.pago, clp(total))
    .separador()
    .centro().parrafo(negocio.leyenda);
  if (negocio.transferencia) {
    t.linea().linea('Datos para transferencia:');
    for (const l of negocio.transferencia) t.linea(l);
  }
  if (conPruebaAcentos) {
    t.linea().izquierda().separador('=')
      .linea('Prueba de acentos:')
      .usarTabla('pc850').linea('A: áéíóú ñÑ ¿¡ Ñuble')
      .usarTabla('cp1252').linea('B: áéíóú ñÑ ¿¡ Ñuble')
      .usarTabla(codigo);
  }
  t.avanzar();
  return { data: t.base64(), largoMm: t.largoMm() };
}
