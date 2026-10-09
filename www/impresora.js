// Impresión de notas de venta: arma la nota, muestra la animación e imprime por Bluetooth.
import { esApp, Printer, Compartir, NEGOCIO, leer, guardar } from './nucleo.js';
import { dibujarNota, imagenAEscPos } from './render.js';
import { notaTexto } from './escpos.js';
import { mostrarImpresion, VELOCIDAD_DEFECTO } from './impresion-animada.js';
import { textoNota, qrSvg } from './nota-qr.js';

export const config = {
  get direccion() { return leer('impresora'); },
  set direccion(v) { guardar('impresora', v); },
  get modo() { return leer('modo') || 'texto'; },
  set modo(v) { guardar('modo', v); },
  get velocidad() { return Number(leer('velocidad')) || VELOCIDAD_DEFECTO; },
  set velocidad(v) { guardar('velocidad', String(v)); },
};

export async function buscarImpresoras() {
  if (!esApp) throw new Error('Las impresoras solo se buscan desde la app instalada en el celular.');
  const { devices } = await Printer.listPaired();
  if (!devices.length) throw new Error('No hay dispositivos vinculados. Vincula la impresora en Ajustes del teléfono > Bluetooth.');
  return devices;
}

/**
 * Imprime una nota con la animación de salida del papel.
 * nota: { numero, vendedor, terminal, cliente, fecha, pago, items: [{nombre, cant, precio}], telefonoCliente }
 */
export async function imprimirNota(nota) {
  const imagen = await dibujarNota(nota, NEGOCIO);
  const salida = config.modo === 'imagen' ? imagenAEscPos(imagen) : await notaTexto(nota, NEGOCIO, 'pc850');
  const direccion = config.direccion;
  return mostrarImpresion(imagen, {
    largoMm: salida.largoMm,
    velocidad: config.velocidad,
    qrSvg: qrSvg(textoNota(nota, NEGOCIO)),
    imprimir: () => {
      if (!esApp) return new Promise((r) => setTimeout(r, 1200));            // vista previa en navegador
      if (!direccion) return Promise.reject(new Error('No hay impresora elegida. Ve a Más > Impresora.'));
      return Printer.print({ address: direccion, data: salida.data });
    },
    whatsapp: async () => {
      if (!esApp) return alert('En el celular se abre WhatsApp con la imagen de la nota.');
      const tel = (nota.telefonoCliente || '').replace(/\D/g, '');
      await Compartir.whatsapp({
        imagen: imagen.toDataURL('image/png').split(',')[1],
        telefono: tel ? (tel.startsWith('56') ? tel : '56' + tel) : '',
        texto: `Nota de venta COVECA N° ${nota.numero ?? ''}`.trim(),
      });
    },
  });
}
