// Impresión de notas: térmica (Bluetooth en la app, Web Serial en el PC), animación, QR y PDF para WhatsApp.
import { notaTexto } from '../escpos.js';
import { dibujarNota, imagenAEscPos } from '../render.js';
import { mostrarImpresion, VELOCIDAD_DEFECTO } from '../impresion-animada.js';
import { qrSvg } from '../nota-qr.js';
import { imprimirSerie } from './termica-pc.js';
import { guardarPdf, enviarPdfWhatsApp } from './pdf.js';
import { dibujarNotaDigital } from './nota-digital.js';
import { esApp, Impresora as Printer } from './nativo.js';
import { esEscritorio } from './escritorio.js';
import { leerAjuste, guardarAjuste, FORMAS_PAGO } from './ui.js';

const soloDigitos = (t) => (t || '').replace(/\D/g, '');

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

// Nota en PDF de 58 mm a partir de su imagen (lo que sale de la app: Guardar PDF, WhatsApp y copia al negocio).
function pdf58(img) {
  const { jsPDF } = window.jspdf;
  const w = 58, h = (img.height * w) / img.width;
  const doc = new jsPDF({ unit: 'mm', format: [w, h], orientation: 'portrait' });
  doc.addImage(img.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, w, h, 'nota', 'FAST');
  return doc.output('datauristring').split(',')[1];
}

const nombreNota = (nota) => `Nota-COVECA-${nota.numero || 'sin-numero'}.pdf`;
// WhatsApp al cliente: a su teléfono (enviarPdfWhatsApp le pone el código de país) con el enlace a la nota digital.
const mensajeCliente = (nota) => ({ telefono: nota.telefonoCliente || '',
  texto: `Nota de venta COVECA N° ${nota.numero ?? ''}${enlaceNota(nota) ? `\nVer y descargar: ${enlaceNota(nota)}` : ''}`.trim() });

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
 * Imprime una nota con la pantalla animada (impresión, QR, WhatsApp, PDF y copia al negocio).
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
  // PC con impresora normal (no térmica): la nota se imprime en hoja desde su ficha (media carta, carta o tira).
  const pcHoja = ofrecerHoja && !esApp && !termicaPc() && esEscritorio();
  const imagen = await dibujarNota(nota, negocio);
  const salida = config.modo === 'imagen' ? imagenAEscPos(imagen) : await notaTexto(nota, negocio, 'pc850');
  // Papel (térmica): diseño "Limpio" en blanco y negro. Digital (PDF): diseño de la nota digital, a color.
  // La imagen digital se empieza a dibujar ya, para no demorar al tocar un botón.
  const digital = dibujarDigital(nota, negocio).catch(() => imagen);
  const nombrePdf = nombreNota(nota);
  let pdfListo = null;
  const pdfNota = () => (pdfListo ||= digital.then(pdf58));
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
      : esApp ? Printer.print({ address, data: salida.data }) : imprimirSerie(salida.data)),
    // Si la térmica falla: la misma imagen de la nota en un PDF de 58 mm para entregarla igual (Descargas/COVECA en Android).
    pdf: conPapel || omitida ? async () => guardarPdf(await pdfNota(), nombrePdf) : null,
    // Copia al WhatsApp del negocio (Ajustes → Datos de la nota). Solo en la app Android.
    copia: esApp && soloDigitos(negocio.whatsapp_copias) ? async () => enviarPdfWhatsApp(await pdfNota(), nombrePdf, {
      telefono: negocio.whatsapp_copias,
      texto: `Copia nota COVECA N° ${nota.numero ?? ''} · ${nota.cliente || ''}`.trim(),
    }) : null,
    whatsapp: async () => enviarPdfWhatsApp(await pdfNota(), nombrePdf, mensajeCliente(nota)),
  });
}

/** Envía por WhatsApp al cliente el PDF de una nota ya guardada (botón de la nota), sin pasar por la impresión. */
export async function enviarNotaWhatsApp(nota, negocio) {
  return enviarPdfWhatsApp(pdf58(await dibujarDigital(nota, negocio)), nombreNota(nota), mensajeCliente(nota));
}
