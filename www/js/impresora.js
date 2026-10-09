// Impresión de notas: reutiliza lo validado en la Etapa 0 (texto + logo, animación, QR, WhatsApp).
import { notaTexto } from '../escpos.js';
import { dibujarNota, imagenAEscPos } from '../render.js';
import { mostrarImpresion, VELOCIDAD_DEFECTO } from '../impresion-animada.js';
import { textoNota, qrSvg } from '../nota-qr.js';

const cap = window.Capacitor;
export const esApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const Printer = esApp ? ((cap.Plugins && cap.Plugins.BtPrinter) || cap.registerPlugin('BtPrinter')) : null;
const Compartir = esApp ? ((cap.Plugins && cap.Plugins.Compartir) || cap.registerPlugin('Compartir')) : null;

const leer = (k, d = null) => { try { return localStorage.getItem(k) ?? d; } catch (_) { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };

export const config = {
  get impresora() { return leer('impresora'); }, set impresora(v) { guardar('impresora', v); },
  get modo() { return leer('modo', 'texto'); }, set modo(v) { guardar('modo', v); },
  get velocidad() { return Number(leer('velocidad', VELOCIDAD_DEFECTO)); }, set velocidad(v) { guardar('velocidad', String(v)); },
};

export async function buscarImpresoras() {
  if (!esApp) return [];
  const { devices } = await Printer.listPaired();
  return devices;
}

/**
 * Imprime una nota con la pantalla animada.
 * nota = { numero, vendedor, terminal, cliente, telefonoCliente, fecha, pago, items: [{nombre, cant, precio}] }
 */
export async function imprimirNota(nota, negocio) {
  const address = config.impresora;
  if (esApp && !address) throw new Error('Primero elige la impresora en Ajustes.');
  const imagen = await dibujarNota(nota, negocio);
  const salida = config.modo === 'imagen' ? imagenAEscPos(imagen) : await notaTexto(nota, negocio, 'pc850');
  const tel = (nota.telefonoCliente || '').replace(/\D/g, '');
  return mostrarImpresion(imagen, {
    largoMm: salida.largoMm,
    velocidad: config.velocidad,
    qrSvg: qrSvg(textoNota(nota, negocio)),
    imprimir: () => (esApp ? Printer.print({ address, data: salida.data }) : new Promise((r) => setTimeout(r, 1500))),
    whatsapp: async () => {
      if (!esApp) return alert('En el celular se abre WhatsApp con la imagen de la nota.');
      await Compartir.whatsapp({
        imagen: imagen.toDataURL('image/png').split(',')[1],
        telefono: tel ? (tel.startsWith('56') ? tel : '56' + tel.replace(/^0+/, '')) : '',
        texto: `Nota de venta COVECA N° ${nota.numero ?? ''}`.trim(),
      });
    },
  });
}
