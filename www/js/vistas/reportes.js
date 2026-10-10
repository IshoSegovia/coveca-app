// Reportes: stock bajo y ventas de la semana. Se ven en pantalla, se imprimen en la térmica
// o se envían por WhatsApp como texto.
import { $, esc, barra, icono, vacio, aviso, clp, pct, fecha, DIAS } from '../ui.js';
import * as datos from '../datos.js';
import { Ticket, COLUMNAS } from '../../escpos.js';
import { imprimirTicket } from '../impresora.js';
import { abrirExterno } from '../externo.js';

const leer = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (_) { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };

// ---------------------------------------------------------------- Menú
export function vistaReportes(v) {
  barra({ titulo: 'Reportes' });
  v.innerHTML = `
    <div class="grilla reportes-menu">
      <a class="tarjeta reporte" href="#/reportes/stock-bajo">
        <span class="ruta-ico ambar" aria-hidden="true">${icono('inventario')}</span>
        <p class="tarjeta-t">Stock bajo</p>
        <p class="tarjeta-s">Productos por reponer</p>
      </a>
      <a class="tarjeta reporte" href="#/reportes/ventas-semana">
        <span class="ruta-ico" aria-hidden="true">${icono('reportes')}</span>
        <p class="tarjeta-t">Ventas de la semana</p>
        <p class="tarjeta-s">Qué se vendió, a quién y cuánto</p>
      </a>
    </div>`;
}

// Botones de salida comunes a ambos reportes.
const accionesHtml = () => `<div class="foto-acciones mt reporte-acc">
    <button type="button" class="btn sec" data-acc="imprimir">${icono('impresora')} Imprimir</button>
    <button type="button" class="btn sec" data-acc="whatsapp">${icono('whatsapp')} WhatsApp</button>
  </div>`;

function activarAcciones(v, { ticket, texto }) {
  v.querySelector('[data-acc="imprimir"]').addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { await imprimirTicket(ticket()); aviso('Reporte impreso'); } catch (err) { aviso(err.message, 'error'); }
    b.disabled = false;
  });
  v.querySelector('[data-acc="whatsapp"]').addEventListener('click', () =>
    abrirExterno('https://wa.me/?text=' + encodeURIComponent(texto())));
}

// Encabezado de ticket de reporte.
function cabecera(titulo, sub) {
  const t = new Ticket('pc850');
  t.centro().negrita().alto().linea('COVECA').alto(false).linea(titulo).negrita(false);
  if (sub) t.linea(sub);
  t.linea(new Date().toLocaleString('es-CL')).izquierda().separador();
  return t;
}
const recortar = (s, n) => (s.length > n ? s.slice(0, n - 1) + '.' : s);

// ---------------------------------------------------------------- Stock bajo
const nivel = (p, umbral) => (p.stock < 0 ? 'negativo' : p.stock === 0 ? 'sin'
  : p.stock <= (p.stock_minimo ?? umbral) ? 'bajo' : null);

export async function vistaStockBajo(v) {
  barra({ titulo: 'Stock bajo', atras: '#/reportes' });
  const todos = (await datos.productos({ soloActivos: true }));
  let umbral = Number(leer('reporte-umbral', 3));

  const pintar = () => {
    const grupos = { negativo: [], sin: [], bajo: [] };
    for (const p of todos) { const k = nivel(p, umbral); if (k) grupos[k].push(p); }
    grupos.bajo.sort((a, b) => a.stock - b.stock || a.nombre.localeCompare(b.nombre));
    grupos.sin.sort((a, b) => a.nombre.localeCompare(b.nombre));
    grupos.negativo.sort((a, b) => a.stock - b.stock);
    const total = grupos.negativo.length + grupos.sin.length + grupos.bajo.length;
    const fila = (p, k) => `<a class="fila" href="#/inventario/${p.id}">
        <div class="fila-txt"><p class="fila-t">${esc(p.nombre)}</p>
          <p class="fila-s">${esc(p.categoria || 'Sin categoría')} · mínimo ${p.stock_minimo ?? umbral}${p.stock_minimo == null ? ' (general)' : ''}</p></div>
        <span class="chip stock-${k}">${p.stock} unid.</span></a>`;
    const seccion = (k, titulo, ayuda) => grupos[k].length ? `
      <h2 class="sec-t">${titulo} · ${grupos[k].length}</h2>
      ${ayuda ? `<p class="ayuda pad">${ayuda}</p>` : ''}
      <div class="lista">${grupos[k].map((p) => fila(p, k)).join('')}</div>` : '';
    v.innerHTML = `
      <p class="total-reponer pad"><b>${total}</b> producto${total === 1 ? '' : 's'} por reponer</p>
      <div class="resumen">
        <div><p class="resumen-n">${grupos.negativo.length}</p><p>Negativo</p></div>
        <div><p class="resumen-n">${grupos.sin.length}</p><p>Sin stock</p></div>
        <div><p class="resumen-n">${grupos.bajo.length}</p><p>Stock bajo</p></div>
      </div>
      <div class="pad umbral">
        <label class="campo"><span>Productos sin mínimo propio: bajo con</span>
          <span class="umbral-in"><input id="umbral" type="number" inputmode="numeric" min="0" value="${umbral}"> unidades o menos</span></label>
      </div>
      ${total ? accionesHtml() : ''}
      ${total ? '' : vacio('Todo con stock suficiente', 'Ningún producto activo está bajo su mínimo.')}
      ${seccion('negativo', 'Negativo · revisar', 'Se vendió más de lo registrado. Conviene contar en bodega y ajustar.')}
      ${seccion('sin', 'Sin stock', '')}
      ${seccion('bajo', 'Stock bajo', '')}`;
    $('#umbral', v).addEventListener('change', (e) => {
      umbral = Math.max(0, Math.floor(Number(e.target.value)) || 0); guardar('reporte-umbral', String(umbral)); pintar();
    });
    if (!total) return;
    activarAcciones(v, {
      ticket: () => {
        const t = cabecera('REPORTE STOCK BAJO', `${total} productos por reponer`);
        for (const [k, tit] of [['negativo', 'NEGATIVO (revisar)'], ['sin', 'SIN STOCK'], ['bajo', 'STOCK BAJO']]) {
          if (!grupos[k].length) continue;
          t.negrita().linea(tit).negrita(false);
          for (const p of grupos[k]) t.par(recortar(p.nombre, COLUMNAS - 6), String(p.stock));
          t.separador();
        }
        return t.avanzar().base64();
      },
      texto: () => {
        const l = [`*COVECA – Stock bajo* (${new Date().toLocaleDateString('es-CL')})`, `${total} productos por reponer`];
        for (const [k, tit] of [['negativo', 'Negativo (revisar)'], ['sin', 'Sin stock'], ['bajo', 'Stock bajo']]) {
          if (!grupos[k].length) continue;
          l.push('', `*${tit}*`, ...grupos[k].map((p) => `• ${p.nombre}: ${p.stock}`));
        }
        return l.join('\n');
      },
    });
  };
  pintar();
}

// ---------------------------------------------------------------- Ventas de la semana
const PAGOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', credito: 'Crédito (fiado)' };
function lunesDe(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const corta = (d) => d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '');

export async function vistaVentasSemana(v) {
  barra({ titulo: 'Ventas de la semana', atras: '#/reportes' });
  let desde = lunesDe(new Date());

  const cargar = async () => {
    const hasta = new Date(desde); hasta.setDate(hasta.getDate() + 7);
    const ultimo = new Date(hasta); ultimo.setDate(ultimo.getDate() - 1);
    const etiqueta = `${corta(desde)} – ${corta(ultimo)}`;
    const esActual = desde.getTime() === lunesDe(new Date()).getTime();
    v.innerHTML = '<div class="cargando" aria-label="Cargando"></div>';
    const todos = await datos.ventas(desde, hasta);
    const peds = todos.filter((p) => p.estado !== 'anulado');
    const anuladas = todos.length - peds.length;

    const total = peds.reduce((s, p) => s + p.total, 0);
    const costo = peds.reduce((s, p) => s + p.items.reduce((a, i) => a + i.cantidad * (i.costo || 0), 0), 0);
    const ganancia = total - costo;
    const clientes = new Set(peds.map((p) => p.cliente_id)).size;
    const porPago = {}; peds.forEach((p) => { porPago[p.forma_pago] = (porPago[p.forma_pago] || 0) + p.total; });
    const porDia = Array.from({ length: 7 }, () => 0);
    peds.forEach((p) => { porDia[(new Date(p.fecha).getDay() + 6) % 7] += p.total; });
    const maxDia = Math.max(1, ...porDia);
    const prods = {};
    peds.forEach((p) => p.items.forEach((i) => {
      const k = i.producto_id; prods[k] ||= { nombre: i.nombre, cant: 0, monto: 0 };
      prods[k].cant += i.cantidad; prods[k].monto += i.subtotal;
    }));
    const ranking = Object.values(prods).sort((a, b) => b.monto - a.monto);

    v.innerHTML = `
      <div class="semana-nav pad">
        <button type="button" class="btn sec" id="ant" aria-label="Semana anterior">${icono('atras')}</button>
        <div class="semana-lbl"><p class="fila-t">${esc(etiqueta)}</p><p class="fila-s">${esActual ? 'Semana actual' : 'Semana pasada'}</p></div>
        <button type="button" class="btn sec" id="sig" aria-label="Semana siguiente" ${esActual ? 'disabled' : ''}>${icono('derecha')}</button>
      </div>
      ${!peds.length ? vacio('Sin ventas esta semana', anuladas ? `${anuladas} nota(s) anulada(s) no se cuentan.` : 'Cuando se generen pedidos aparecerán aquí.') : `
      <div class="total-semana pad"><p class="fila-s">Total vendido</p><p class="monto grande">${clp(total)}</p>
        <p class="fila-s">Ganancia estimada <b class="monto">${clp(ganancia)}</b> (${pct(total ? ganancia / total : null)} sobre venta)</p></div>
      <div class="resumen">
        <div><p class="resumen-n">${peds.length}</p><p>Notas</p></div>
        <div><p class="resumen-n">${clientes}</p><p>Clientes</p></div>
        <div><p class="resumen-n">${ranking.reduce((s, r) => s + r.cant, 0)}</p><p>Unidades</p></div>
      </div>
      ${accionesHtml()}
      <h2 class="sec-t">Por forma de pago</h2>
      <dl class="datos">${Object.entries(PAGOS).filter(([k]) => porPago[k]).map(([k, t]) =>
        `<div class="dato"><dt>${t}</dt><dd class="monto der">${clp(porPago[k])}</dd></div>`).join('')}</dl>
      <h2 class="sec-t">Por día</h2>
      <div class="lista dias">${porDia.map((m, i) => `
        <div class="fila dia"><span class="dia-n">${DIAS[i + 1].slice(0, 3)}</span>
          <div class="dia-barra" aria-hidden="true"><span style="width:${Math.round((m / maxDia) * 100)}%"></span></div>
          <span class="monto">${m ? clp(m) : '—'}</span></div>`).join('')}</div>
      <h2 class="sec-t">Productos vendidos · ${ranking.length}</h2>
      <div class="lista">${ranking.map((r) => `
        <div class="fila"><div class="fila-txt"><p class="fila-t">${esc(r.nombre)}</p><p class="fila-s">${r.cant} unid.</p></div>
          <span class="monto">${clp(r.monto)}</span></div>`).join('')}</div>
      <h2 class="sec-t">Notas de venta</h2>
      <div class="lista">${peds.slice().reverse().map((p) => `
        <a class="fila" href="#/clientes/${p.cliente_id}"><div class="fila-txt"><p class="fila-t">N° ${p.numero} · ${esc(p.cliente)}</p>
          <p class="fila-s">${fecha(p.fecha)} · ${esc(PAGOS[p.forma_pago] || p.forma_pago)}</p></div>
          <span class="monto">${clp(p.total)}</span></a>`).join('')}</div>
      ${anuladas ? `<p class="ayuda pad mt">${anuladas} nota(s) anulada(s) no se incluyen.</p>` : ''}`}`;

    $('#ant', v).addEventListener('click', () => { desde.setDate(desde.getDate() - 7); cargar(); });
    $('#sig', v).addEventListener('click', () => { desde.setDate(desde.getDate() + 7); cargar(); });
    if (!peds.length) return;
    activarAcciones(v, {
      ticket: () => {
        const t = cabecera('VENTAS DE LA SEMANA', etiqueta);
        t.negrita().alto().par('TOTAL', clp(total)).alto(false).negrita(false)
          .par('Notas', String(peds.length)).par('Clientes', String(clientes))
          .par('Ganancia estimada', clp(ganancia)).separador();
        for (const [k, tt] of Object.entries(PAGOS)) if (porPago[k]) t.par(tt, clp(porPago[k]));
        t.separador().negrita().linea('POR DIA').negrita(false);
        porDia.forEach((m, i) => { if (m) t.par(DIAS[i + 1], clp(m)); });
        t.separador().negrita().linea('PRODUCTOS').negrita(false);
        for (const r of ranking) t.par(`${r.cant} ${recortar(r.nombre, COLUMNAS - 12)}`, clp(r.monto));
        return t.avanzar().base64();
      },
      texto: () => [
        `*COVECA – Ventas ${etiqueta}*`,
        `Total: *${clp(total)}* · ${peds.length} notas · ${clientes} clientes`,
        `Ganancia estimada: ${clp(ganancia)}`,
        '', '*Por forma de pago*', ...Object.entries(PAGOS).filter(([k]) => porPago[k]).map(([k, tt]) => `• ${tt}: ${clp(porPago[k])}`),
        '', '*Productos*', ...ranking.map((r) => `• ${r.cant} × ${r.nombre}: ${clp(r.monto)}`),
      ].join('\n'),
    });
  };
  await cargar();
}
