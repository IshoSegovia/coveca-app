import { dibujarNota, imagenAEscPos } from './render.js';
import { notaTexto } from './escpos.js';
import { mostrarImpresion, VELOCIDAD_DEFECTO } from './impresion-animada.js';
import { textoNota, qrSvg } from './nota-qr.js';

const NEGOCIO = {
  nombre: 'COVECA',
  eslogan: 'Su comercializadora de confianza',
  telefono: '+56 9 7587 0827',
  leyenda: 'Este documento no representa una factura, solo es una nota de venta y guía de despacho.',
};

const $ = (id) => document.getElementById(id);
const estado = (msg, tipo = '') => { const e = $('estado'); e.textContent = msg; e.className = tipo; };
const cap = window.Capacitor;
const esApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const Printer = esApp ? ((cap.Plugins && cap.Plugins.BtPrinter) || cap.registerPlugin('BtPrinter')) : null;

const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
const leer = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };

async function buscar() {
  if (!esApp) return estado('Abre esto desde la app instalada en el celular.', 'error');
  estado('Buscando impresoras vinculadas…');
  try {
    const { devices } = await Printer.listPaired();
    const sel = $('impresora');
    sel.innerHTML = '';
    if (!devices.length) {
      estado('No hay dispositivos vinculados. Vincula la impresora en Ajustes > Bluetooth.', 'error');
      return;
    }
    const guardada = leer('impresora');
    for (const d of devices) {
      const o = document.createElement('option');
      o.value = d.address;
      o.textContent = `${d.name} (${d.address})`;
      if (d.address === guardada || (!guardada && /RPP|printer|pos/i.test(d.name))) o.selected = true;
      sel.appendChild(o);
    }
    guardar('impresora', sel.value);
    estado(`${devices.length} dispositivo(s) encontrados. Elige la impresora y presiona Imprimir.`, 'ok');
  } catch (e) {
    estado(e.message || String(e), 'error');
  }
}

function notaDePrueba() {
  return {
    vendedor: 'COVECA',
    terminal: 'Movil 1',
    cliente: 'Cliente de prueba Ñuñoa',
    fecha: new Date().toLocaleString('es-CL'),
    pago: 'Efectivo',
    items: [
      { nombre: 'Super 8 Oblea Clásica x24', cant: 2, precio: 5990 },
      { nombre: 'BigTime Menta x20', cant: 1, precio: 6690 },
      { nombre: 'Bon Bon Bum Colombineta x24', cant: 1, precio: 1950 },
      { nombre: 'Alfajor Panchote', cant: 3, precio: 6000 },
    ],
  };
}

async function imprimir() {
  const address = $('impresora').value;
  if (esApp && !address) return estado('Primero busca y elige la impresora.', 'error');
  if (address) guardar('impresora', address);
  const modo = $('modo').value;
  guardar('modo', modo);
  const velocidad = Number($('velocidad').value) || VELOCIDAD_DEFECTO;
  guardar('velocidad', String(velocidad));
  const nota = notaDePrueba();
  const imagen = await dibujarNota(nota, NEGOCIO);   // lo que se ve en pantalla
  const salida = modo === 'imagen' ? imagenAEscPos(imagen) : await notaTexto(nota, NEGOCIO, 'pc850');
  const trabajo = {
    largoMm: salida.largoMm,
    qrSvg: qrSvg(textoNota(nota, NEGOCIO)),
    velocidad,
    imprimir: () => esApp
      ? Printer.print({ address, data: salida.data })
      : new Promise((r) => setTimeout(r, 1500)),     // demostración en navegador
  };
  estado(`Nota de ${Math.round(salida.largoMm)} mm a ${velocidad} mm/s ≈ ${(salida.largoMm / velocidad).toFixed(1)} s.`);
  await mostrarImpresion(imagen, trabajo);
}

$('buscar').addEventListener('click', buscar);
$('imprimir').addEventListener('click', imprimir);
$('impresora').addEventListener('change', (e) => guardar('impresora', e.target.value));
if (leer('modo')) $('modo').value = leer('modo');
$('velocidad').value = leer('velocidad') || VELOCIDAD_DEFECTO;
if (esApp) buscar();
