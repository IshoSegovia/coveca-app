// Generador mínimo de comandos ESC/POS para impresora térmica de 58 mm (32 caracteres por línea).
const ANCHO = 32;

// Tablas para caracteres del español. PC850 = código 2, Windows-1252 = código 16.
const PC850 = { 'á':0xA0,'é':0x82,'í':0xA1,'ó':0xA2,'ú':0xA3,'ñ':0xA4,'Ñ':0xA5,'Á':0xB5,'É':0x90,'Í':0xD6,'Ó':0xE0,'Ú':0xE9,'ü':0x81,'Ü':0x9A,'¿':0xA8,'¡':0xAD,'°':0xF8 };
const CP1252 = { 'á':0xE1,'é':0xE9,'í':0xED,'ó':0xF3,'ú':0xFA,'ñ':0xF1,'Ñ':0xD1,'Á':0xC1,'É':0xC9,'Í':0xCD,'Ó':0xD3,'Ú':0xDA,'ü':0xFC,'Ü':0xDC,'¿':0xBF,'¡':0xA1,'°':0xB0 };
const TABLAS = { pc850: { n: 2, mapa: PC850 }, cp1252: { n: 16, mapa: CP1252 } };

export class Ticket {
  constructor(codigo = 'pc850') {
    this.bytes = [];
    this.tabla = TABLAS[codigo];
    this.raw(0x1B, 0x40);                // ESC @  reiniciar
    this.raw(0x1B, 0x74, this.tabla.n);  // ESC t  página de códigos
  }
  raw(...b) { this.bytes.push(...b); return this; }
  usarTabla(codigo) { this.tabla = TABLAS[codigo]; return this.raw(0x1B, 0x74, this.tabla.n); }
  texto(s) {
    for (const ch of s) {
      const c = ch.charCodeAt(0);
      if (c < 128) this.bytes.push(c);
      else this.bytes.push(this.tabla.mapa[ch] ?? 0x3F); // '?' si no existe
    }
    return this;
  }
  linea(s = '') { return this.texto(s).raw(0x0A); }
  centro() { return this.raw(0x1B, 0x61, 1); }
  izquierda() { return this.raw(0x1B, 0x61, 0); }
  negrita(on = true) { return this.raw(0x1B, 0x45, on ? 1 : 0); }
  grande(on = true) { return this.raw(0x1D, 0x21, on ? 0x11 : 0x00); }
  separador(ch = '-') { return this.linea(ch.repeat(ANCHO)); }
  // Texto a la izquierda y monto a la derecha en la misma línea.
  par(izq, der) {
    const espacio = ANCHO - der.length;
    if (izq.length > espacio - 1) { this.linea(izq); izq = ''; }
    return this.linea(izq + ' '.repeat(Math.max(1, espacio - izq.length)) + der);
  }
  avanzar(n = 3) { return this.raw(0x1B, 0x64, n); }
  base64() {
    let bin = '';
    for (const b of this.bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }
}

// Formato chileno: $9.900
export const clp = (n) => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
