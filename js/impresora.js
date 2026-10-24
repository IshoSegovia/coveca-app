// Impresión de notas: térmica (Bluetooth en la app, Web Serial en el PC), animación, QR y PDF para WhatsApp.
import { notaTexto } from '../escpos.js';
import { dibujarNota, imagenAEscPos } from '../render.js';
import { mostrarImpresion, VELOCIDAD_DEFECTO } from '../impresion-animada.js';
import { qrSvg } from '../nota-qr.js';
import { imprimirSerie } from './termica-pc.js';
import { guardarPdf, enviarJpegWhatsApp } from './pdf.js';
import { notaPdf } from './nota-pdf.js';
import { dibujarNotaDigital } from './nota-digital.js';
import { esApp, Impresora as Printer } from './nativo.js';
import { esEscritorio } from './escritorio.js';
import { leerAjuste, guardarAjuste, FORMAS_PAGO, clp } from './ui.js';
import { anotarImpresion } from './registro.js';

// Anota el resultado de cada impresión en la térmica (para los tickets de soporte).
async function conRegistro(imprimir) {
  const t0 = Date.now();
  try { const r = await imprimir(); anotarImpresion({ ok: true, ms: Date.now() - t0 }); return r; }
  catch (e) { anotarImpresion({ ok: false, ms: Date.now() - t0, error: String(e?.message || e).slice(0, 200) }); throw e; }
}

export const config = {
  get impresora() { return leerAjuste('impresora'); }, set impresora(v) { guardarAjuste('impresora', v); },
  // 'imagen' = la nota con el diseño nuevo (por defecto); 'texto' = solo texto con la fuente de la impresora (más rápida, diseño simple).
  get modo() { return leerAjuste('modo-nota', 'imagen'); }, set modo(v) { guardarAjuste('modo-nota', v); },
  get velocidad() { return Number(leerAjuste('velocidad', VELOCIDAD_DEFECTO)); }, set velocidad(v) { guardarAjuste('velocidad', String(v)); },
  // PC: 'normal' (impresora de hojas, por PDF) o 'termica' (58 mm por puerto serie). En el celular no se usa.
  get pc() { return leerAjuste('impresora-pc', 'normal'); }, set pc(v) { guardarAjuste('impresora-pc', v); },
};

export async function buscarImpresoras() {
  if (!esApp) return [];
  const { devices } = await Printer.listPaired();
  return devices;
}

// QR: enlace a la copia digital de la nota (página n.html, migración 0023). Funciona aunque la nota se haya
// tomado sin señal: el id lo genera el celular y la página la muestra apenas la nota se sube.
const URL_NOTA = 'https://ishosegovia.github.io/coveca-app/n.html#';
const esUuid = (x) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x || ''));
const enlaceNota = (nota) => (esUuid(nota.id) ? URL_NOTA + nota.id : null);
// Nota de prueba (Avanzado) o de ejemplo (modo demostración): no está guardada, así que el QR abre una nota de ejemplo.
const ENLACE_PRUEBA = URL_NOTA + 'prueba';

// PC con térmica conectada (Ajustes → Impresora): se imprime igual que en la app, por puerto serie.
const termicaPc = () => !esApp && esEscritorio() && config.pc === 'termica';
export const hayTermica = () => esApp || termicaPc();

const nombreNota = (nota, ext) => `Nota-COVECA-${nota.numero || 'sin-numero'}.${ext}`;
// WhatsApp al cliente: a su teléfono (enviarJpegWhatsApp le pone el código de país) con el enlace a la nota digital.
// motivo 'nota' (al generarla o desde la nota) o 'en_camino' (Avisar, en Pedidos: ticket N° 11). Todos los mensajes al
// cliente que acompañan la nota se escriben aquí. km = distancia aproximada (en línea recta) o null.
const mensajeCliente = (nota, motivo = 'nota', { km = null } = {}) => {
  const enlace = enlaceNota(nota);
  if (motivo === 'en_camino') {
    const lejos = km == null ? '' : km < 1 ? ' Estamos a menos de 1 km.' : ` Estamos a unos ${km} km.`;
    return { telefono: nota.telefonoCliente || '',
      texto: `Hola ${nota.cliente && nota.cliente !== '—' ? nota.cliente : ''}, vamos en camino con tu pedido N° ${nota.numero ?? ''} de COVECA.${lejos} Te adjunto la nota.${enlace && !nota.porSubir ? `\nVer y descargar: ${enlace}` : ''}`
        .replace(/^Hola ,/, 'Hola,') };
  }
  return { telefono: nota.telefonoCliente || '',
    texto: `Nota de venta COVECA N° ${nota.numero ?? ''}${enlace ? `\nVer y descargar: ${enlace}` : ''}`.trim() };
};

// Imagen JPEG (base64) de la nota digital: es lo que se envía por WhatsApp.
const jpegBase64 = (canvas) => canvas.toDataURL('image/jpeg', 0.9).split(',')[1];

/**
 * Nota en hoja completa (PDF) a partir de los datos de la nota de la app. estilo 'azul' = Guardar en PDF (columna azul);
 * 'limpia' = lo que se imprime en papel desde el PC. nota.clienteDatos (opcional): rut, direccion, comuna, telefono, razon_social.
 */
export async function pdfHoja(nota, negocio, estilo = 'azul') {
  const items = nota.items.map((i) => ({ nombre: i.nombre, cantidad: i.cant, precio: i.precio, subtotal: i.cant * i.precio }));
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const desc = nota.descuento || 0, leal = nota.descuentoLealtad || 0;
  return notaPdf({
    id: nota.id, numero: nota.numero, fecha: nota.fechaIso || new Date().toISOString(),
    cliente: { nombre: nota.cliente, rut: nota.rut || '', ...(nota.clienteDatos || {}) },
    vendedor: nota.vendedor, terminal: nota.terminal, pago: nota.pago, items, subtotal,
    descuentoLealtad: leal, nivel: nota.lealtad?.nivel, descuento: desc, total: Math.max(0, subtotal - desc - leal),
    lealtadTexto: nota.lealtad?.lineas?.[0] || '',
  }, negocio, estilo);
}

// Imagen de la nota digital (a color) a partir de los datos de la nota que maneja la app.
function dibujarDigital(nota, negocio) {
  const sub = nota.items.reduce((s, i) => s + i.cant * i.precio, 0);
  return dibujarNotaDigital({
    numero: nota.numero, fecha: nota.fechaIso || new Date().toISOString(), vendedor: nota.vendedor, enlace: enlaceNota(nota) || ENLACE_PRUEBA,
    cliente: { nombre: nota.cliente, rut: nota.rut || '' },
    items: nota.items.map((i) => ({ nombre: i.nombre, cantidad: i.cant, precio: i.precio, subtotal: i.cant * i.precio })),
    subtotal: sub, descuento: nota.descuento || 0, descuento_lealtad: nota.descuentoLealtad || 0, nivel: nota.lealtad?.nivel || null,
    total: Math.max(0, sub - (nota.descuento || 0) - (nota.descuentoLealtad || 0)),
    forma_pago: Object.keys(FORMAS_PAGO).find((k) => FORMAS_PAGO[k] === nota.pago) || null, negocio,
  });
}

/**
 * Imprime una nota con la pantalla animada (impresión, QR, WhatsApp y PDF).
 * nota = { id, numero, vendedor, terminal, cliente, telefonoCliente, fecha, fechaIso, pago, descuento, descuentoLealtad, lealtad,
 *          items: [{ nombre, cant, precio }] }
 * imprimir = false: "Generar sin imprimir" (misma pantalla final sin mandar nada a la térmica; se imprime después desde la nota).
 * ofrecerHoja: en PC con impresora normal, la pantalla final ofrece "Imprimir en hoja" (devuelve 'hoja' y quien llama abre la nota).
 */
export async function imprimirNota(nota, negocio, { imprimir = true, ofrecerHoja = false } = {}) {
  const address = config.impresora;
  if (imprimir && esApp && !address) throw new Error('Primero elige la impresora en Ajustes.');
  const conPapel = (esApp || termicaPc()) && imprimir;
  const omitida = !imprimir && (esApp || termicaPc());
  // PC con impresora normal (no térmica): la nota se imprime en hoja desde su ficha (media carta).
  const pcHoja = ofrecerHoja && !esApp && !termicaPc() && esEscritorio();
  const imagen = await dibujarNota(nota, negocio);
  const salida = config.modo === 'imagen' ? imagenAEscPos(imagen) : await notaTexto(nota, negocio, 'pc850');
  // Papel (térmica): diseño "Limpio" en blanco y negro. WhatsApp: imagen de la nota digital, a color.
  // La imagen digital se empieza a dibujar ya, para no demorar al tocar un botón.
  const digital = dibujarDigital(nota, negocio).catch(() => imagen);
  return mostrarImpresion(imagen, {
    largoMm: salida.largoMm,
    velocidad: conPapel ? config.velocidad : 90,   // sin impresora no hay papel que esperar
    qrSvg: qrSvg(enlaceNota(nota) || ENLACE_PRUEBA),
    sinImpresora: !conPapel,
    msgListo: omitida ? 'No se imprimió. Entrégala con el QR o por WhatsApp, o imprímela después desde la nota.'
      : pcHoja ? 'Imprímela en una hoja con el botón de abajo, o compártela con el cliente.' : null,
    hoja: pcHoja ? { texto: 'Imprimir nota en hoja' } : null,
    // "Generar sin imprimir" (o sin térmica): nunca se toca la impresora, solo la animación (error del 15-10-2026:
    // en la app se llamaba igual a Printer.print y con la impresora apagada salía "No se pudo imprimir").
    imprimir: () => (!conPapel ? new Promise((r) => setTimeout(r, 1500))
      : conRegistro(() => (esApp ? Printer.print({ address, data: salida.data, largoMm: salida.largoMm }) : imprimirSerie(salida.data)))),
    // Guardar en PDF: hoja completa con el diseño de columna azul (Descargas/COVECA en Android). Disponible en toda pantalla final.
    pdf: async () => guardarPdf(await pdfHoja(nota, negocio, 'azul'), nombreNota(nota, 'pdf')),
    whatsapp: async () => enviarJpegWhatsApp(jpegBase64(await digital), nombreNota(nota, 'jpg'), mensajeCliente(nota)),
  });
}

/** Envía por WhatsApp al cliente la imagen de una nota ya guardada (botón de la nota), sin pasar por la impresión. */
export async function enviarNotaWhatsApp(nota, negocio, { motivo = 'nota', km = null } = {}) {
  return enviarJpegWhatsApp(jpegBase64(await dibujarDigital(nota, negocio)), nombreNota(nota, 'jpg'), mensajeCliente(nota, motivo, { km }));
}

/** Una nota guardada (datos.pedido) en la forma que usan la impresión, el PDF y WhatsApp. yo = usuario actual. */
export const notaParaEnviar = (p, yo = {}) => {
  const leal = p.descuento_lealtad || 0;
  return { id: p.id, numero: p.numero, vendedor: p.vendedor || yo?.nombre, terminal: p.terminal || yo?.terminal, cliente: p.cliente, telefonoCliente: p.telefonoCliente,
    fechaIso: p.fecha, fecha: new Date(p.fecha).toLocaleString('es-CL'), pago: FORMAS_PAGO[p.forma_pago] || '', porSubir: !!p.porSubir,
    descuento: p.descuento || 0, descuentoLealtad: leal,
    lealtad: p.nivel && leal ? { nivel: p.nivel, ahorro: leal, lineas: [`Cliente ${p.nivel} · Ahorró ${clp(leal)}`] } : null,
    items: p.items.map((i) => ({ nombre: i.nombre, cant: i.cantidad, precio: i.precio })) };
};

/**
 * Imprime una cotización en la térmica (app Android o PC con térmica), sin la pantalla animada: la cotización no lleva
 * QR ni número de nota. Siempre con el diseño de imagen (el modo "solo texto" es solo para notas de venta).
 * nota = { tipo: 'cotizacion', fecha, validaHasta, vendedor, terminal, cliente, items: [{ nombre, cant, precio }], descuento, leyenda }
 */
export async function imprimirCotizacion(nota, negocio) {
  const address = config.impresora;
  if (esApp && !address) throw new Error('Primero elige la impresora en Ajustes → Impresora.');
  if (!hayTermica()) throw new Error('Este equipo no tiene impresora térmica.');
  const salida = imagenAEscPos(await dibujarNota({ ...nota, tipo: 'cotizacion' }, negocio));
  await conRegistro(() => (esApp ? Printer.print({ address, data: salida.data, largoMm: salida.largoMm }) : imprimirSerie(salida.data)));
}

// ---------------- Nota de cambio (migración 0056, ticket N° 12) ----------------
// c = cambio de datos.cambio (con items { sentido, nombre, cantidad, destino }). Papel = diseño B (render.js);
// WhatsApp y Guardar en PDF = diseño C (nota-digital.js). Sin QR, total, pago ni datos para transferencia.
export const LEYENDA_CAMBIO = 'Documento interno de cambio de productos. No es boleta ni factura y no cambia el total de la nota de venta.';
const nombreCambio = (c, ext) => `Cambio-COVECA-${c.numero_nota}-${c.n}.${ext}`;
const ladoCambio = (c, sentido) => c.items.filter((i) => i.sentido === sentido);
function cambioPapel(c, yo = {}) {
  return { tipo: 'cambio', numero: `${c.numero_nota}-${c.n}`, ref: c.numero_nota, motivo: c.motivoTexto || '', valor: c.valor,
    fecha: new Date(c.fecha).toLocaleString('es-CL'), vendedor: yo?.nombre || '', terminal: yo?.terminal || '', cliente: c.cliente,
    devuelve: ladoCambio(c, 'devuelve').map((i) => ({ nombre: i.nombre, cant: i.cantidad, destino: i.destino })),
    recibe: ladoCambio(c, 'recibe').map((i) => ({ nombre: i.nombre, cant: i.cantidad })), leyenda: LEYENDA_CAMBIO, items: [] };
}
const cambioDigital = (c, negocio, yo = {}) => dibujarNotaDigital({
  tipo: 'cambio', numero: `${c.numero_nota}-${c.n}`, ref: c.numero_nota, motivo: c.motivoTexto || '', valor: c.valor, fecha: c.fecha,
  vendedor: yo?.nombre || '', cliente: { nombre: c.cliente }, devuelve: ladoCambio(c, 'devuelve'), recibe: ladoCambio(c, 'recibe'),
  leyenda: LEYENDA_CAMBIO, negocio: { ...negocio, transferencia: [] } });
/** Imprime la nota de cambio en la térmica (app Android o PC con térmica), siempre como imagen. */
export async function imprimirCambio(c, negocio, yo) {
  const address = config.impresora;
  if (esApp && !address) throw new Error('Primero elige la impresora en Ajustes → Impresora.');
  if (!hayTermica()) throw new Error('Este equipo no tiene impresora térmica.');
  const salida = imagenAEscPos(await dibujarNota(cambioPapel(c, yo), negocio));
  await conRegistro(() => (esApp ? Printer.print({ address, data: salida.data, largoMm: salida.largoMm }) : imprimirSerie(salida.data)));
}
/** Envía la nota de cambio por WhatsApp al cliente (imagen del diseño C). */
export async function enviarCambioWhatsApp(c, negocio, yo) {
  return enviarJpegWhatsApp(jpegBase64(await cambioDigital(c, negocio, yo)), nombreCambio(c, 'jpg'),
    { telefono: c.telefonoCliente || '', texto: `Nota de cambio COVECA N° ${c.numero_nota}-${c.n} (nota de venta N° ${c.numero_nota})` });
}
/** PDF de la nota de cambio en una hoja carta: 'azul' = Guardar en PDF (diseño C); 'limpia' = imprimir en hoja desde el PC (diseño B). */
export async function pdfCambio(c, negocio, yo, estilo = 'azul') {
  const img = estilo === 'limpia' ? await dibujarNota(cambioPapel(c, yo), negocio) : await cambioDigital(c, negocio, yo);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const ancho = estilo === 'limpia' ? 72 : 120, alto = ancho * (img.height / img.width);
  const escala = Math.min(1, 260 / alto);   // que quepa en una hoja
  doc.addImage(img.toDataURL('image/jpeg', 0.92), 'JPEG', (215.9 - ancho * escala) / 2, 10, ancho * escala, alto * escala, 'cambio', 'FAST');
  return doc.output('datauristring').split(',')[1];
}
export const archivoCambio = (c) => nombreCambio(c, 'pdf');
