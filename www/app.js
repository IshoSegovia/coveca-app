import { Ticket, clp } from './escpos.js';

const NEGOCIO = {
  nombre: 'COVECA',
  eslogan: 'Su comercializadora de confianza',
  telefono: '+56 9 7587 0827',
  leyenda: 'Este documento no representa una factura, solo es una nota de venta y guia de despacho.',
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
  const items = [
    { nombre: 'Super 8 Oblea Clasica x24', cant: 2, precio: 5990 },
    { nombre: 'BigTime Menta x20', cant: 1, precio: 6690 },
    { nombre: 'Alfajor Panchote', cant: 3, precio: 6000 },
  ];
  const t = new Ticket('pc850');
  t.centro().grande().negrita().linea(NEGOCIO.nombre).grande(false).negrita(false)
    .linea(NEGOCIO.eslogan).linea(NEGOCIO.telefono).linea()
    .izquierda().linea('Vendedor: COVECA').linea('Terminal: Movil 1')
    .linea('Cliente: Cliente de prueba').linea('Fecha: ' + new Date().toLocaleString('es-CL'))
    .separador();
  let total = 0;
  for (const it of items) {
    const sub = it.cant * it.precio;
    total += sub;
    t.linea(it.nombre).par(`  ${it.cant} x ${clp(it.precio)}`, clp(sub));
  }
  t.separador().negrita().grande().par('TOTAL', clp(total)).grande(false).negrita(false)
    .par('Forma de pago', 'Efectivo').linea()
    .centro().linea(NEGOCIO.leyenda).linea()
    .separador('=')
    .negrita().linea('PRUEBA DE ACENTOS').negrita(false)
    .izquierda()
    .linea('Opcion A:').usarTabla('pc850').linea('  áéíóú ñÑ ¿¡ Ñuble')
    .linea('Opcion B:').usarTabla('cp1252').linea('  áéíóú ñÑ ¿¡ Ñuble')
    .usarTabla('pc850')
    .avanzar(4);
  return t.base64();
}

async function imprimir() {
  if (!esApp) return estado('Abre esto desde la app instalada en el celular.', 'error');
  const address = $('impresora').value;
  if (!address) return estado('Primero busca y elige la impresora.', 'error');
  guardar('impresora', address);
  estado('Imprimiendo…');
  try {
    await Printer.print({ address, data: notaDePrueba() });
    estado('Listo. Revisa la nota impresa y anota qué opción de acentos se ve bien (A o B).', 'ok');
  } catch (e) {
    estado(e.message || String(e), 'error');
  }
}

$('buscar').addEventListener('click', buscar);
$('imprimir').addEventListener('click', imprimir);
$('impresora').addEventListener('change', (e) => guardar('impresora', e.target.value));
if (esApp) buscar();
