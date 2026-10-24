// Copia digital de la nota de venta: la que abre el QR (n.html) y el PDF que sale de la app (WhatsApp, Guardar PDF, copia al negocio).
// Diseño "Columna lateral" (en vertical: encabezado azul con logo, N° y fecha; cliente en recuadro; total con barra roja;
// QR y datos para transferencia al pie). Se dibuja en el teléfono a partir de los datos de la nota (no se guarda ninguna imagen en el servidor).
// n = respuesta de nota_publica (migración 0023) o la misma forma armada en la app (impresora.js). n.enlace (opcional) dibuja el QR.

const AZUL = '#3E4095', AZUL_O = '#2C2E73', AZUL_S = '#EEF0FA', ROJO = '#EC3237', ROJO_TEXTO = '#C42127', ROJO_S = '#FBE9EA';
const TEXTO = '#1D1F2B', SUAVE = '#5B6070', BORDE = '#DADCE6', ORO = '#7A5A00', ORO_S = '#FAF0CF';
const ANCHO = 720, M = 40;
const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const PAGOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', credito: 'Crédito' };

export const clp = (x) => (x < 0 ? '-$' : '$') + Math.abs(Math.round(x || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fecha = (f) => new Date(f).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santiago' }).replace(/\//g, '-');
const hora = (f) => new Date(f).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' });
const fechaCorta = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

const cargar = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

function envolver(ctx, texto, max) {
  const lineas = []; let actual = '';
  for (const p of String(texto || '').split(' ')) {
    const prueba = actual ? actual + ' ' + p : p;
    if (ctx.measureText(prueba).width <= max || !actual) actual = prueba; else { lineas.push(actual); actual = p; }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function caja(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color; ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  ctx.fill();
}

// QR con la librería de la app (vendor/qrcode.js); sin ella (n.html) no se dibuja.
function dibujarQr(ctx, texto, x, y, lado) {
  const qr = window.qrcode?.(0, 'M');
  if (!qr) return false;
  qr.addData(texto); qr.make();
  const n = qr.getModuleCount(), t = lado / n;
  ctx.fillStyle = AZUL_O;
  for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (qr.isDark(f, c)) ctx.fillRect(Math.floor(x + c * t), Math.floor(y + f * t), Math.ceil(t), Math.ceil(t));
  return true;
}

export async function dibujarNotaDigital(n, logoSrc = 'marca/coveca-negativo.svg') {
  const c = document.createElement('canvas');
  c.width = ANCHO; c.height = 5000;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ANCHO, c.height);
  let y = 0;
  const f = (tam, peso = 400, estilo = '') => { ctx.font = `${estilo} ${peso} ${tam}px ${FUENTE}`; };
  const txt = (s, x, yy, { color = TEXTO, align = 'left' } = {}) => { ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, yy); };
  const neg = n.negocio || {};
  // Nota de cambio (ticket N° 12): n.tipo = 'cambio', n.ref (N° de la nota de venta), n.motivo, n.devuelve / n.recibe
  // ([{ nombre, cantidad, destino }]), n.valor y n.leyenda. Sin total, pago, QR ni datos para transferencia.
  const esCam = n.tipo === 'cambio';

  // Encabezado azul oscuro: logo y fecha a la izquierda, N° a la derecha
  const altoCab = 196;
  ctx.fillStyle = AZUL_O; ctx.fillRect(0, 0, ANCHO, altoCab);
  const logo = await cargar(logoSrc);
  if (logo) ctx.drawImage(logo, M, 44, 230, 230 / 3.9);
  else { f(44, 800); txt('COVECA', M, 92, { color: '#fff' }); }
  f(22); txt(n.fecha ? `${fecha(n.fecha)} · ${hora(n.fecha)}` : '', M, 140, { color: 'rgba(255,255,255,.85)' });
  if (n.vendedor) txt(n.vendedor, M, 170, { color: 'rgba(255,255,255,.7)' });
  f(18, 700); ctx.letterSpacing = '3px'; txt(esCam ? 'NOTA DE CAMBIO' : 'NOTA DE VENTA', ANCHO - M, 74, { color: 'rgba(255,255,255,.75)', align: 'right' }); ctx.letterSpacing = '0px';
  f(54, 800); txt(n.numero ? `N° ${n.numero}` : 'Sin número', ANCHO - M, 134, { color: '#fff', align: 'right' });
  ctx.fillStyle = ROJO; ctx.fillRect(0, altoCab, ANCHO, 6);
  y = altoCab + 36;

  // Nota anulada
  if (n.estado === 'anulado') {
    const h = n.reemplazada_por ? 96 : 66;
    caja(ctx, M, y, ANCHO - 2 * M, h, 16, ROJO_S);
    f(26, 800); txt('NOTA ANULADA', M + 22, y + 42, { color: ROJO_TEXTO });
    if (n.reemplazada_por) { f(22); txt(`Reemplazada por la nota N° ${n.reemplazada_por}`, M + 22, y + 76, { color: ROJO_TEXTO }); }
    y += h + 24;
  }

  // Cliente en recuadro azul suave
  const cl = n.cliente || {};
  f(28, 700);
  const nomCli = envolver(ctx, cl.nombre, ANCHO - 2 * M - 48).slice(0, 2);
  const extra = [cl.razon_social && cl.razon_social !== cl.nombre ? cl.razon_social : '', cl.rut ? `RUT ${cl.rut}` : '', [cl.direccion, cl.comuna].filter(Boolean).join(', ')].filter(Boolean);
  const altoCli = 40 + nomCli.length * 36 + extra.length * 30 + 10;
  caja(ctx, M, y, ANCHO - 2 * M, altoCli, 18, AZUL_S);
  nomCli.forEach((l, i) => { f(28, 700); txt(l, M + 24, y + 48 + i * 36); });
  f(22); extra.forEach((l, i) => txt(l, M + 24, y + 48 + nomCli.length * 36 + i * 30, { color: SUAVE }));
  y += altoCli + 34;

  if (esCam) {
    f(24, 700); txt(`Ref. nota de venta N° ${n.ref}`, M, y); y += 34;
    if (n.motivo) { f(22); for (const l of envolver(ctx, `Motivo: ${n.motivo}`, ANCHO - 2 * M)) { txt(l, M, y, { color: SUAVE }); y += 30; } }
    y += 16;
    for (const [titulo, lista] of [['DEVUELVE', n.devuelve || []], ['RECIBE', n.recibe || []]]) {
      f(17, 700); ctx.letterSpacing = '2px';
      txt(titulo, M, y, { color: SUAVE }); txt('CANT.', ANCHO - M, y, { color: SUAVE, align: 'right' });
      ctx.letterSpacing = '0px';
      y += 14; ctx.fillStyle = AZUL; ctx.fillRect(M, y, ANCHO - 2 * M, 3); y += 6;
      for (const it of lista) {
        f(24, 600);
        const lineas = envolver(ctx, it.nombre, ANCHO - 2 * M - 120);
        lineas.forEach((l, i) => txt(l, M, y + 36 + i * 32));
        f(24, 700); txt(String(it.cantidad), ANCHO - M, y + 36, { align: 'right' });
        y += 36 + (lineas.length - 1) * 32;
        if (it.destino) { f(21); txt(it.destino === 'baja' ? 'Se da de baja' : 'Vuelve a bodega', M, y + 32, { color: SUAVE }); y += 32; }
        y += 18;
        ctx.strokeStyle = BORDE; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(ANCHO - M, y); ctx.stroke(); ctx.setLineDash([]);
      }
      y += 36;
    }
    ctx.fillStyle = AZUL; ctx.fillRect(M, y, 8, 64);
    f(19, 700); ctx.letterSpacing = '2px'; txt('MISMO VALOR', M + 26, y + 42, { color: SUAVE }); ctx.letterSpacing = '0px';
    f(40, 800); txt(clp(n.valor), ANCHO - M, y + 50, { color: AZUL_O, align: 'right' });
    y += 64 + 36;
  } else {

  // Productos
  f(17, 700); ctx.letterSpacing = '2px';
  txt('PRODUCTO', M, y, { color: SUAVE }); txt('TOTAL', ANCHO - M, y, { color: SUAVE, align: 'right' });
  ctx.letterSpacing = '0px';
  y += 14; ctx.fillStyle = AZUL; ctx.fillRect(M, y, ANCHO - 2 * M, 3); y += 6;
  for (const it of n.items || []) {
    f(24, 600);
    const lineas = envolver(ctx, it.nombre, ANCHO - 2 * M - 170);
    lineas.forEach((l, i) => txt(l, M, y + 36 + i * 32));
    f(24, 700); txt(clp(it.subtotal ?? it.cantidad * it.precio), ANCHO - M, y + 36, { align: 'right' });
    y += 36 + (lineas.length - 1) * 32;
    f(21); txt(`${it.cantidad} × ${clp(it.precio)}`, M, y + 32, { color: SUAVE });
    y += 50;
    ctx.strokeStyle = BORDE; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(ANCHO - M, y); ctx.stroke(); ctx.setLineDash([]);
  }
  y += 12;

  // Subtotal y descuentos
  const fila = (et, val, color = TEXTO) => { f(22); txt(et, M, y + 30, { color: SUAVE }); txt(val, ANCHO - M, y + 30, { color, align: 'right' }); y += 38; };
  if (n.descuento || n.descuento_lealtad) {
    fila('Subtotal', clp(n.subtotal));
    if (n.descuento_lealtad) fila(`Descuento cliente ${n.nivel || ''}`.trim(), '-' + clp(n.descuento_lealtad));
    if (n.descuento) fila('Descuento', '-' + clp(n.descuento));
  }

  // Total con barra roja
  y += 18;
  ctx.fillStyle = ROJO; ctx.fillRect(M, y, 8, 74);
  f(19, 700); ctx.letterSpacing = '3px'; txt('TOTAL', M + 26, y + 46, { color: SUAVE }); ctx.letterSpacing = '0px';
  f(54, 800); txt(clp(n.total), ANCHO - M, y + 58, { color: AZUL_O, align: 'right' });
  y += 74 + 30;

  // Pago, vencimiento y nivel
  if (PAGOS[n.forma_pago]) { fila('Forma de pago', PAGOS[n.forma_pago]); }
  if (n.forma_pago === 'credito' && n.vence_en) fila('Vence', fechaCorta(n.vence_en));
  if (n.nivel && n.descuento_lealtad) {
    y += 8; caja(ctx, M, y, ANCHO - 2 * M, 62, 16, ORO_S);
    f(23, 700); txt(`★ Cliente ${n.nivel} · ahorró ${clp(n.descuento_lealtad)}`, M + 22, y + 40, { color: ORO });
    y += 62 + 10;
  }
  y += 18;

  }   // fin de la nota de venta (la de cambio no lleva total, pago ni lealtad)

  // Pie: QR (si hay enlace) y datos para transferencia
  const transf = (neg.transferencia || []).filter(Boolean);
  const conQr = !!n.enlace && !!window.qrcode;
  if (conQr || transf.length) {
    const lado = 170, xT = conQr ? M + lado + 28 : M;
    if (conQr) { caja(ctx, M - 6, y - 6, lado + 12, lado + 12, 14, '#fff'); dibujarQr(ctx, n.enlace, M, y, lado); }
    let yt = y + 26;
    if (transf.length) {
      f(20, 700); txt('Datos para transferencia', xT, yt); yt += 32;
      f(20); transf.forEach((l) => { txt(l, xT, yt, { color: SUAVE }); yt += 28; });
    } else if (conQr) {
      f(20, 700); txt('Escanea para ver o', xT, yt); txt('descargar esta nota', xT, yt + 28);
    }
    y = Math.max(y + (conQr ? lado : 0), yt) + 26;
  }

  // Leyenda y pie
  ctx.fillStyle = BORDE; ctx.fillRect(M, y, ANCHO - 2 * M, 2); y += 14;
  f(19);
  for (const l of envolver(ctx, (esCam ? n.leyenda : null) || neg.leyenda || '', ANCHO - 2 * M)) { txt(l, M, y + 26, { color: SUAVE }); y += 28; }
  y += 10;
  f(18, 700); txt([neg.eslogan, neg.telefono].filter(Boolean).join(' · ') || 'COVECA', M, y + 22, { color: AZUL });
  y += 50;
  ctx.fillStyle = AZUL_O; ctx.fillRect(0, y, ANCHO, 10); y += 10;

  const fin = document.createElement('canvas');
  fin.width = ANCHO; fin.height = y;
  fin.getContext('2d').drawImage(c, 0, 0);
  return fin;
}
