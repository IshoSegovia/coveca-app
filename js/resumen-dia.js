// Resumen del día como imagen: tarjeta azul con lo vendido, notas, efectivo a rendir, transferencias y crédito,
// para compartir por WhatsApp al cerrar la ruta. Se dibuja en el teléfono; no se guarda nada en el servidor.
import { enviarImagenWhatsApp } from './pdf.js';

const AZUL = '#3E4095', AZUL_O = '#2C2E73', ROJO = '#EC3237', ORO = '#F2CD5C';
const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const clp = (n) => '$' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const cargar = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

// r = { titulo (p. ej. "Jueves 15-10-2026"), vendido, notas, efectivo, transf, credito, abonos, vendedor }
async function imagenResumen(r) {
  const W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const f = (t, p = 400) => { x.font = `${p} ${t}px ${FUENTE}`; };
  const txt = (s, px, py, color = '#fff', al = 'left') => { x.fillStyle = color; x.textAlign = al; x.fillText(s, px, py); };
  x.fillStyle = AZUL; x.fillRect(0, 0, W, H);
  // cuadritos 8 bits arriba
  [AZUL_O, ROJO, ORO, AZUL_O, ROJO, ORO, AZUL_O, ROJO].forEach((col, i) => { x.fillStyle = col; x.fillRect(W - 80 - (8 - i) * 44, 0, 44, 16); });
  const logo = await cargar('marca/coveca-negativo.svg');
  if (logo) x.drawImage(logo, 80, 90, 300, 300 / 3.9);
  f(34, 600); txt('Resumen del día', 80, 250, 'rgba(255,255,255,.85)');
  f(44, 800); txt(r.titulo, 80, 310);
  if (r.vendedor) { f(32); txt(r.vendedor, 80, 360, 'rgba(255,255,255,.75)'); }
  f(36, 600); txt('Vendido', 80, 480, 'rgba(255,255,255,.85)');
  f(130, 800); txt(clp(r.vendido), 80, 610);
  const caja = (cx, cy, et, val) => {
    x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); (x.roundRect ? x.roundRect(cx, cy, 440, 190, 28) : x.rect(cx, cy, 440, 190)); x.fill();
    f(30, 600); txt(et, cx + 34, cy + 64, 'rgba(255,255,255,.85)');
    f(60, 800); txt(val, cx + 34, cy + 146);
  };
  caja(80, 690, 'Notas', String(r.notas));
  caja(560, 690, 'Efectivo a rendir', clp(r.efectivo));
  caja(80, 910, 'Transferencias', clp(r.transf));
  caja(560, 910, 'Crédito', clp(r.credito));
  if (r.abonos) { f(32); txt(`Abonos recibidos: ${clp(r.abonos)}`, 80, 1170, 'rgba(255,255,255,.85)'); }
  f(32, 600); txt('Su comercializadora de confianza', 80, 1260, ORO);
  return c;
}

export async function compartirResumen(r) {
  const c = await imagenResumen(r);
  const base64 = c.toDataURL('image/png').split(',')[1];
  return enviarImagenWhatsApp(base64, `Resumen-COVECA-${r.dia || 'dia'}.png`, `Resumen del día · ${r.titulo}`);
}
