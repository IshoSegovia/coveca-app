// Catálogo en PDF para compartir (ticket N° 18): se genera en el equipo, también sin señal, con los datos de la copia y las
// fotos guardadas (nunca descarga nada). Hoja A5 vertical con la misma imagen del catálogo de la app: portada azul, categorías
// con su ícono 8 bits y tarjetas de producto. Cuatro tarjetas por hoja, para leerse en un teléfono sin hacer zoom.
// El archivo se reenvía y envejece: por eso no lleva disponibilidad y cada hoja repite la fecha y la condición de precios.
import { clp, plural } from './ui.js';
import { CLAUSULA, C_PIX, PIX, avisosCatalogo, paraCliente, unidades } from './catalogo-base.js';
import { CATEGORIA } from './catalogo-datos.js';
import { fotoGuardadaBlob } from './fotos-guardadas.js';

// Colores de tokens.css (tema claro: el PDF no cambia con el tema del equipo)
const AZUL = [62, 64, 149], AZUL_SUAVE = [231, 232, 244], ROJO = [236, 50, 55], ROJO_TEXTO = [196, 33, 39], ORO = [242, 205, 92];
const TEXTO = [29, 31, 43], SUAVE = [91, 96, 112], BORDE = [225, 228, 236], FONDO = [246, 247, 251], GRIS = [233, 235, 242], BLANCO = [255, 255, 255];
const W = 148, H = 210, M = 10;             // hoja A5 (mm)
const BARRA = 17, ARRIBA = 21, ABAJO = 194; // barra superior y zona de contenido
const POR_HOJA = 4, SEP = 3, ALTO = (ABAJO - ARRIBA - SEP * (POR_HOJA - 1)) / POR_HOJA;   // tarjetas de producto
const FOTO_W = 44, FOTO_H = 36;             // zona de la foto dentro de la tarjeta
const LADO = 320, CALIDAD = 0.6;            // foto: píxeles y calidad JPEG (ver la medición en docs/tickets/0018.md)
const TANDA = 6;                            // productos entre pausas, para que la pantalla no se congele

// La letra base del PDF no trae emojis ni símbolos raros
const texto = (s) => String(s ?? '').replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...').replace(/[^\x20-\x7E\xA0-\xFF]/g, '').trim();
const pausa = () => new Promise((ok) => setTimeout(ok));
const COLOR = { 1: AZUL, 2: ROJO, 3: ORO };

const lienzo = document.createElement('canvas');
async function fotoJpeg(url) {
  if (!url) return null;
  const blob = await fotoGuardadaBlob(url);
  if (!blob) return null;
  try {
    const img = await createImageBitmap(blob);
    const ancho = LADO, alto = Math.round(LADO * FOTO_H / FOTO_W);
    lienzo.width = ancho; lienzo.height = alto;
    const x = lienzo.getContext('2d'), k = Math.min(ancho / img.width, alto / img.height), w = img.width * k, h = img.height * k;
    x.fillStyle = '#fff'; x.fillRect(0, 0, ancho, alto);
    x.drawImage(img, (ancho - w) / 2, (alto - h) / 2, w, h);
    img.close();
    return lienzo.toDataURL('image/jpeg', CALIDAD);
  } catch (_) { return null; }
}

async function logo(ruta) {
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = ruta; });
    const ratio = img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1 / 3.9;
    const c = document.createElement('canvas'); c.width = 900; c.height = Math.round(900 * ratio);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/png'), ratio };
  } catch (_) { return null; }
}

// Corta a una línea o a dos, con puntos suspensivos si no cabe, para que nada se pierda sin aviso ni pise otro texto.
function lineas(doc, s, ancho, max) {
  const l = doc.splitTextToSize(texto(s), ancho);
  if (l.length <= max) return l;
  const ultima = l.slice(0, max);
  ultima[max - 1] = `${ultima[max - 1].replace(/\s*\S{0,3}$/, '')}...`;
  return ultima;
}

const fondo = (doc, c) => { doc.setFillColor(...c); doc.rect(0, 0, W, H, 'F'); };
// Ícono 8 bits de la categoría (o el de Bazar), igual al de la pantalla pero en vector.
function pixeles(doc, cat, x, y, lado) {
  const g = PIX[cat] || PIX.Bazar, p = lado / 8;
  g.forEach((f, r) => [...f].forEach((v, c) => { if (v !== '0') { doc.setFillColor(...COLOR[v]); doc.rect(x + c * p, y + r * p, p + 0.03, p + 0.03, 'F'); } }));
}
// Cuadros 8 bits sobre el azul, siempre iguales para que el archivo no cambie sin motivo.
function cuadros(doc) {
  const tam = 9, tonos = [[67, 69, 152], [72, 74, 156], [79, 81, 161]];
  let s = 12345;
  const azar = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (let f = 0; f * tam < H; f++) for (let c = 0; c * tam < W; c++) {
    const a = azar(), t = tonos[Math.floor(azar() * tonos.length)];
    if (a < 0.35) { doc.setFillColor(...t); doc.rect(c * tam + 0.5, f * tam + 0.5, tam - 1, tam - 1, 'F'); }
  }
}
function isotipo(doc, x, y, r) {
  doc.setFillColor(...ROJO); doc.circle(x + r, y + r, r, 'F');
  const p = r * 2 * 0.56 / 10, x0 = x + r - p * 3.5, y0 = y + r - p * 5;
  doc.setFillColor(...BLANCO);
  C_PIX.forEach((f, i) => [...f].forEach((v, j) => { if (v === '1') doc.rect(x0 + j * p, y0 + i * p, p + 0.03, p + 0.03, 'F'); }));
}

function portada(doc, { fecha, total, categorias, marcas, palabra, ejemplo }) {
  fondo(doc, AZUL); cuadros(doc);
  const x = M + 2;
  isotipo(doc, x, 12, 19);
  if (palabra) doc.addImage(palabra.data, 'PNG', x, 55, 58, 58 * palabra.ratio, 'palabra', 'FAST');
  else { doc.setFont('helvetica', 'bold'); doc.setFontSize(30); doc.setTextColor(...BLANCO); doc.text('COVECA', x, 66); }
  const eti = `CATÁLOGO MAYORISTA · ${fecha}`;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.setFillColor(...ROJO_TEXTO); doc.roundedRect(x, 75, doc.getTextWidth(eti) + 9, 8, 4, 4, 'F');
  doc.setTextColor(...BLANCO); doc.text(eti, x + 4.5, 80.5);
  doc.setFontSize(25); doc.text(['Su comercializadora', 'de confianza'], x, 94, { lineHeightFactor: 1.05 });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
  doc.text(doc.splitTextToSize('Golosinas, bebidas y artículos de aseo en cajas y displays, con reparto por ruta en la Región del Maule.', W - 2 * x), x, 113);
  [[total, 'productos'], [categorias, 'categorías'], [marcas, 'marcas']].forEach(([n, t], i) => {
    const cx = x + i * 38;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.text(String(n), cx, 138);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text(t, cx, 144);
  });
  doc.setFillColor(...BLANCO); doc.roundedRect(x, 151, 58, 13, 6.5, 6.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...AZUL); doc.text('Ver el catálogo  >', x + 29, 159.3, { align: 'center' });
  doc.link(x, 151, 58, 13, { pageNumber: 2 });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...BLANCO);
  doc.text(doc.splitTextToSize(`Precios al ${fecha}. ${CLAUSULA}`, W - 2 * x), x, 174);
  if (ejemplo) { doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('DATOS DE EJEMPLO. NO VÁLIDO.', x, 195); }
  doc.setFillColor(...ROJO); doc.rect(0, H - 5, W, 5, 'F');
}

// Barra superior, como la del catálogo en pantalla; el botón de la derecha lleva a Categorías.
function encabezado(doc, titulo, sub) {
  doc.setFillColor(...BLANCO); doc.rect(0, 0, W, BARRA, 'F');
  doc.setDrawColor(...BORDE); doc.setLineWidth(0.2); doc.line(0, BARRA, W, BARRA);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...TEXTO); doc.text(lineas(doc, titulo, W - 2 * M - 16, 1), M, 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...SUAVE); doc.text(lineas(doc, sub, W - 2 * M - 16, 1), M, 13);
  const r = 5.5, cx = W - M - r, cy = BARRA / 2;
  doc.setFillColor(...AZUL_SUAVE); doc.circle(cx, cy, r, 'F');
  doc.setDrawColor(...AZUL); doc.setLineWidth(0.4);
  [[-2.5, -2.5], [0.4, -2.5], [-2.5, 0.4], [0.4, 0.4]].forEach(([a, b]) => doc.roundedRect(cx + a, cy + b, 2.1, 2.1, 0.5, 0.5, 'S'));
  doc.setLineWidth(0.2);
  doc.link(cx - r, cy - r, 2 * r, 2 * r, { pageNumber: 2 });
}

function tarjeta(doc, p, foto, y) {
  doc.setFillColor(...BLANCO); doc.setDrawColor(...BORDE); doc.roundedRect(M, y, W - 2 * M, ALTO, 3.5, 3.5, 'FD');
  const yF = y + (ALTO - FOTO_H) / 2, xF = M + 2;
  if (foto) doc.addImage(foto, 'JPEG', xF, yF, FOTO_W, FOTO_H, undefined, 'NONE');
  else {
    pixeles(doc, p.tipo, xF + FOTO_W / 2 - 8, yF + 5, 16);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...AZUL); doc.text('Foto pronto', xF + FOTO_W / 2, yF + 28, { align: 'center' });
  }
  const x = xF + FOTO_W + 3, ancho = W - M - 4 - x, der = W - M - 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...ROJO_TEXTO);
  doc.text(lineas(doc, String(p.marca || p.categoria || '').toUpperCase(), ancho, 1), x, y + 6.5, { charSpace: 0.25 });
  doc.setFontSize(12.5); doc.setTextColor(...TEXTO);
  doc.text(lineas(doc, p.nombre, ancho, 2), x, y + 12, { lineHeightFactor: 1.12 });
  const u = unidades(p.nombre);
  if (u > 1) {
    const t = `${u} unidades`;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.setFillColor(...GRIS); doc.roundedRect(x, y + 20.2, doc.getTextWidth(t) + 6, 5.4, 2.7, 2.7, 'F');
    doc.setTextColor(...SUAVE); doc.text(t, x + 3, y + 24);
  }
  doc.setDrawColor(...BORDE); doc.setLineDashPattern([0.8, 0.8], 0); doc.line(x, y + 27.5, der, y + 27.5); doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...AZUL); doc.text(clp(p.precio), x, y + 36);
  if (u > 1 && p.precio / u >= 10) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...SUAVE); doc.text('por unidad', der, y + 31.8, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...TEXTO); doc.text(`aprox. ${clp(p.precio / u)}`, der, y + 36, { align: 'right' });
  }
}
// Lo que sobra al final de una categoría, como en la pantalla
function tarjetaVacia(doc, y, alto) {
  doc.setDrawColor(...SUAVE); doc.setLineDashPattern([1.2, 1.2], 0); doc.roundedRect(M, y, W - 2 * M, alto, 3.5, 3.5, 'S'); doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(...SUAVE);
  doc.text(['¿Busca algo que no está aquí?', 'Pregúntenos: lo conseguimos.'], W / 2, y + alto / 2 - 1.5, { align: 'center' });
}

// Portada de la categoría, con su ícono y un "¿Sabía que...?"
function separador(doc, c, i, totalCats) {
  fondo(doc, BLANCO);
  encabezado(doc, c.nombre, `Categoría ${i + 1} de ${totalCats}`);
  pixeles(doc, c.tipo, M, 30, 34);
  let y = 76;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...ROJO_TEXTO); doc.text(`CATEGORÍA ${i + 1} DE ${totalCats}`, M, y, { charSpace: 0.5 });
  y += 11;
  doc.setFontSize(32); doc.setTextColor(...AZUL);
  const titulo = doc.splitTextToSize(texto(c.nombre), W - 2 * M);
  doc.text(titulo, M, y, { lineHeightFactor: 1 }); y += (titulo.length - 1) * 11.5 + 9;
  const marcas = [...new Set(c.lista.map((p) => p.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13); doc.setTextColor(...SUAVE);
  doc.text(`${plural(c.lista.length, 'producto')}${marcas.length ? ` · ${plural(marcas.length, 'marca')}` : ''}`, M, y); y += 5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  let x = M;
  marcas.slice(0, 10).forEach((m) => {
    const t = lineas(doc, m, 60, 1)[0], a = doc.getTextWidth(t) + 7;
    if (x + a > W - M) { x = M; y += 8; }
    doc.setFillColor(...GRIS); doc.roundedRect(x, y, a, 6.4, 3.2, 3.2, 'F');
    doc.setTextColor(...SUAVE); doc.text(t, x + 3.5, y + 4.5);
    x += a + 2;
  });
  y += 13;
  const dato = CATEGORIA[c.tipo];
  if (dato) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
    const l = doc.splitTextToSize(texto(dato), W - 2 * M - 12), alto = 16 + l.length * 5.6;
    doc.setFillColor(...AZUL_SUAVE); doc.roundedRect(M, y, W - 2 * M, alto, 3.5, 3.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); const eti = '¿SABÍA QUE...?';
    doc.setFillColor(...ROJO_TEXTO); doc.roundedRect(M + 6, y + 5, doc.getTextWidth(eti) + 5, 5.6, 1, 1, 'F');
    doc.setTextColor(...BLANCO); doc.text(eti, M + 8.5, y + 9);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(...AZUL); doc.text(l, M + 6, y + 17, { lineHeightFactor: 1.25 });
  }
}

function indice(doc, cats, { total, fecha }) {
  doc.setPage(2); fondo(doc, FONDO);
  encabezado(doc, 'Categorías', `${plural(total, 'producto')} · precios al ${fecha}`);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...TEXTO); doc.text('¿Qué busca hoy?', M, 32);
  // Hasta 14 categorías en una columna; con más (las crea un administrador desde la 2.12.0), en dos columnas con letra
  // más chica, para que cada fila siga siendo legible y tocable.
  const hueco = 1.6, cols = cats.length > 14 ? 2 : 1, filas = Math.ceil(cats.length / cols), gap = 3;
  const ancho = (W - 2 * M - gap * (cols - 1)) / cols, alto = Math.max(7.5, Math.min(14, (ABAJO - 38 - hueco * (filas - 1)) / filas));
  const letra = cols > 1 ? 10 : 12.5, letraN = cols > 1 ? 8 : 10;
  cats.forEach((c, i) => {
    const col = Math.floor(i / filas), x = M + col * (ancho + gap), y = 38 + (i % filas) * (alto + hueco), lado = Math.min(8, alto - 2);
    doc.setFillColor(...BLANCO); doc.setDrawColor(...BORDE); doc.roundedRect(x, y, ancho, alto, 2.5, 2.5, 'FD');
    pixeles(doc, c.tipo, x + 3, y + (alto - lado) / 2, lado);
    const n = cols > 1 ? String(c.lista.length) : `${plural(c.lista.length, 'producto')}  >`;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(letraN); const anchoN = doc.getTextWidth(n);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(letra); doc.setTextColor(...TEXTO);
    doc.text(lineas(doc, c.nombre, ancho - lado - 12 - anchoN, 1), x + lado + 6, y + alto / 2 + letra * 0.12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(letraN); doc.setTextColor(...SUAVE); doc.text(n, x + ancho - 3.5, y + alto / 2 + letraN * 0.12, { align: 'right' });
    doc.link(x, y, ancho, alto, { pageNumber: c.pagina });
  });
}

function cierre(doc, { fecha, telefono, palabra }) {
  doc.addPage(); fondo(doc, AZUL);
  doc.setFillColor(...ROJO); doc.rect(0, H - 5, W, 5, 'F');
  if (palabra) doc.addImage(palabra.data, 'PNG', M + 2, 16, 42, 42 * palabra.ratio, 'palabra', 'FAST');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(21); doc.setTextColor(...BLANCO);
  const titulo = doc.splitTextToSize('Haga su pedido hoy y lo recibe en su ruta', W - 2 * M - 4);
  doc.text(titulo, M + 2, 42, { lineHeightFactor: 1.08 });
  let y = 42 + titulo.length * 8.4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12.5);
  const pedir = doc.splitTextToSize('Responda el mensaje con el que recibió este catálogo o hable con su vendedor en la visita.', W - 2 * M - 4);
  doc.text(pedir, M + 2, y); y += pedir.length * 5.8 + 2;
  if (telefono) { doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(texto(telefono), M + 2, y + 5); y += 12; }
  y += 3;
  const anchoTxt = W - 2 * M - 17;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  const avisos = avisosCatalogo(fecha).map((a) => doc.splitTextToSize(a, anchoTxt));
  const alto = 18 + avisos.reduce((s, l) => s + l.length * 5 + 2, 0);
  doc.setFillColor(...BLANCO); doc.roundedRect(M, y, W - 2 * M, alto, 3.5, 3.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...AZUL); doc.text('Condiciones', M + 6, y + 10);
  let ya = y + 17;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...TEXTO);
  avisos.forEach((l) => { doc.text('•', M + 6, ya); doc.text(l, M + 11, ya); ya += l.length * 5 + 2; });
}

// Avance en rojo (como la línea sobre el menú de la pantalla) y la fecha y condición en cada hoja
function pies(doc, fecha, ejemplo) {
  const total = doc.getNumberOfPages();
  for (let n = 2; n <= total; n++) {
    doc.setPage(n);
    const azul = n === total;
    if (!azul) {
      doc.setFillColor(...AZUL_SUAVE); doc.rect(0, ABAJO + 2, W, 1, 'F');
      doc.setFillColor(...ROJO); doc.rect(0, ABAJO + 2, W * n / total, 1, 'F');
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...(azul ? BLANCO : SUAVE));
    const y = azul ? H - 8 : ABAJO + 8;
    doc.text(ejemplo ? 'DATOS DE EJEMPLO. NO VÁLIDO.' : `Precios al ${fecha}. ${CLAUSULA}`, M, y, { maxWidth: W - 2 * M - 16 });
    doc.text(`${n} / ${total}`, W - M, y, { align: 'right' });
  }
}

// cats = armarCategorias(). alAvance(hechos, total); parar() corta el trabajo (devuelve null).
export async function generarCatalogoPdf({ cats, fecha, telefono, ejemplo, alAvance, parar }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a5', compress: true });
  doc.setProperties({ title: 'Catálogo COVECA', author: 'COVECA' });
  // Otro orden que el de la pantalla: allá lo disponible va primero, y aquí eso delataría qué estaba agotado.
  const orden = (a, b) => (a.marca || '~').localeCompare(b.marca || '~', 'es') || a.nombre.localeCompare(b.nombre, 'es');
  const secciones = cats.map((c) => ({ nombre: c.nombre, tipo: c.tipo, lista: c.lista.map(paraCliente).sort(orden) }));
  const total = secciones.reduce((s, c) => s + c.lista.length, 0);
  const palabra = await logo('marca/coveca-palabra-blanco.svg');
  const marcas = new Set(secciones.flatMap((c) => c.lista.map((p) => p.marca)).filter(Boolean)).size;
  portada(doc, { fecha, total, categorias: secciones.length, marcas, palabra, ejemplo });
  doc.addPage();   // índice: se dibuja al final, cuando se conocen las hojas
  let hechos = 0, sinFoto = 0;
  for (const [i, c] of secciones.entries()) {
    doc.addPage(); c.pagina = doc.getCurrentPageInfo().pageNumber;
    separador(doc, c, i, secciones.length);
    const hojas = Math.ceil(c.lista.length / POR_HOJA);
    for (let h = 0; h < hojas; h++) {
      doc.addPage(); fondo(doc, FONDO);
      encabezado(doc, c.nombre, `Página ${h + 1} de ${hojas} · ${plural(c.lista.length, 'producto')}`);
      const grupo = c.lista.slice(h * POR_HOJA, (h + 1) * POR_HOJA);
      for (const [k, p] of grupo.entries()) {
        if (parar?.()) return null;
        const foto = await fotoJpeg(p.imagen_url);
        if (!foto) sinFoto++;
        tarjeta(doc, p, foto, ARRIBA + k * (ALTO + SEP)); hechos++;
        if (hechos % TANDA === 0) { alAvance?.(hechos, total); await pausa(); }
      }
      if (grupo.length < POR_HOJA) { const sobra = POR_HOJA - grupo.length; tarjetaVacia(doc, ARRIBA + grupo.length * (ALTO + SEP), sobra * ALTO + (sobra - 1) * SEP); }
    }
  }
  cierre(doc, { fecha, telefono: ejemplo ? '' : telefono, palabra });
  indice(doc, secciones, { total, fecha });
  pies(doc, fecha, ejemplo);
  if (parar?.()) return null;
  const base64 = doc.output('datauristring').split(',')[1];
  return { base64, total, sinFoto, paginas: doc.getNumberOfPages(), bytes: Math.round(base64.length * 0.75) };
}
