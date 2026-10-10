// Reportes: stock bajo y ventas de la semana. Se ven en pantalla, se guardan como PDF de marca
// o se envían por WhatsApp como texto.
import { $, esc, barra, icono, vacio, aviso, clp, pct, fecha, DIAS } from '../ui.js';
import * as datos from '../datos.js';
import { nuevoReporte, guardarPdf, COLORES } from '../pdf.js';
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
    <button type="button" class="btn sec" data-acc="pdf">${icono('descargar')} Guardar PDF</button>
    <button type="button" class="btn sec" data-acc="whatsapp">${icono('whatsapp')} WhatsApp</button>
  </div>`;

function activarAcciones(v, { pdf, nombre, texto }) {
  v.querySelector('[data-acc="pdf"]').addEventListener('click', async (e) => {
    const b = e.currentTarget, html = b.innerHTML;
    b.disabled = true; b.textContent = 'Generando…';
    try { const donde = await guardarPdf(await pdf(), nombre()); aviso(`PDF guardado en ${donde}`); }
    catch (err) { aviso(err.message || 'No se pudo generar el PDF.', 'error'); }
    b.disabled = false; b.innerHTML = html;
  });
  v.querySelector('[data-acc="whatsapp"]').addEventListener('click', () =>
    abrirExterno('https://wa.me/?text=' + encodeURIComponent(texto())));
}

const hoyArchivo = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- Stock bajo
const nivel = (p, umbral) => (p.stock < 0 ? 'negativo' : p.stock === 0 ? 'sin'
  : p.stock <= (p.stock_minimo ?? umbral) ? 'bajo' : null);
// Cantidad sugerida a pedir: reponer hasta el doble del mínimo (sin contar stock negativo).
const sugerido = (p, umbral) => Math.max(1, 2 * (p.stock_minimo ?? umbral) - Math.max(p.stock, 0));
const soloDigitos = (t) => (t || '').replace(/\D/g, '');

export async function vistaStockBajo(v) {
  barra({ titulo: 'Stock bajo', atras: '#/reportes' });
  const [todos, provs] = await Promise.all([datos.productos({ soloActivos: true }), datos.proveedores()]);
  let umbral = Number(leer('reporte-umbral', 3));
  let prov = leer('reporte-prov', '');                 // '' = general · 'sin' = sin proveedor · id
  if (prov && prov !== 'sin' && !provs.some((x) => String(x.id) === prov)) prov = '';
  const pedir = new Map();                              // producto_id -> cantidad (modo proveedor)

  const pintar = () => {
    const bajos = todos.filter((p) => nivel(p, umbral));
    const delFiltro = bajos.filter((p) => !prov || (prov === 'sin' ? !p.proveedor_id : String(p.proveedor_id) === prov));
    const proveedor = prov && prov !== 'sin' ? provs.find((x) => String(x.id) === prov) : null;
    const cuenta = (id) => bajos.filter((p) => (id === 'sin' ? !p.proveedor_id : p.proveedor_id === id)).length;
    const grupos = { negativo: [], sin: [], bajo: [] };
    for (const p of delFiltro) grupos[nivel(p, umbral)].push(p);
    grupos.bajo.sort((a, b) => a.stock - b.stock || a.nombre.localeCompare(b.nombre));
    grupos.sin.sort((a, b) => a.nombre.localeCompare(b.nombre));
    grupos.negativo.sort((a, b) => a.stock - b.stock);
    const total = delFiltro.length;

    const selector = `
      <div class="pad filtro-rep">
        <label class="campo"><span>Proveedor</span>
          <select id="prov">
            <option value="">Todos (reporte general) · ${bajos.length}</option>
            ${provs.filter((x) => x.activo !== false).map((x) => `<option value="${x.id}" ${prov === String(x.id) ? 'selected' : ''}>${esc(x.nombre)} · ${cuenta(x.id)}</option>`).join('')}
            <option value="sin" ${prov === 'sin' ? 'selected' : ''}>Sin proveedor asignado · ${cuenta('sin')}</option>
          </select></label>
        <label class="campo"><span>Productos sin mínimo propio: bajo con</span>
          <span class="umbral-in"><input id="umbral" type="number" inputmode="numeric" min="0" value="${umbral}"> unidades o menos</span></label>
      </div>`;

    if (proveedor) {
      // ---------- Modo proveedor: solicitud de pedido para enviarle
      const lista = [...grupos.negativo, ...grupos.sin, ...grupos.bajo];
      lista.forEach((p) => { if (!pedir.has(p.id)) pedir.set(p.id, sugerido(p, umbral)); });
      const wa = soloDigitos(proveedor.telefono);
      const faltan = [!wa && 'WhatsApp', !proveedor.correo && 'correo'].filter(Boolean);
      v.innerHTML = `${selector}
        <div class="prov-dest">
          <span class="avatar" aria-hidden="true">${esc(proveedor.nombre.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase())}</span>
          <div class="fila-txt"><p class="fila-t">${esc(proveedor.nombre)}</p>
            <p class="fila-s">${esc([proveedor.contacto, proveedor.telefono, proveedor.correo].filter(Boolean).join(' · ') || 'Sin datos de contacto')}</p></div>
        </div>
        ${faltan.length ? `<a class="nota-falta" href="#/proveedores/${proveedor.id}/editar">Para enviarle la lista falta su ${faltan.join(' y ')}. Toca para completar.</a>` : ''}
        ${!lista.length ? vacio('Nada que pedirle a este proveedor', 'Todos sus productos están sobre el mínimo.') : `
        <p class="ayuda pad mt">Cantidad sugerida: reponer hasta el doble del mínimo. Ajusta lo que necesites; con 0 no se incluye.</p>
        <div class="lista">${lista.map((p) => `
          <div class="fila prod" data-id="${p.id}">
            <div class="fila-txt"><p class="fila-t">${esc(p.nombre)}</p>
              <p class="fila-s">Stock <span class="${p.stock <= 0 ? 'txt-alerta' : ''}">${p.stock}</span> · mínimo ${p.stock_minimo ?? umbral}</p></div>
            <div class="cantidad" role="group" aria-label="Cantidad a pedir de ${esc(p.nombre)}">
              <button type="button" class="cant-btn" data-d="-1" aria-label="Uno menos">${icono('menos')}</button>
              <input class="cant-n" type="number" inputmode="numeric" min="0" value="${pedir.get(p.id)}" aria-label="Cantidad">
              <button type="button" class="cant-btn" data-d="1" aria-label="Uno más">${icono('mas')}</button>
            </div></div>`).join('')}
        </div>
        <p id="tot-pedir" class="total-reponer pad"></p>
        <div class="pad envio">
          <button type="button" class="btn prin" data-acc="wa-prov" ${wa ? '' : 'disabled'}>${icono('whatsapp')} Enviar por WhatsApp a ${esc(proveedor.nombre)}</button>
          <div class="foto-acciones reporte-acc">
            <button type="button" class="btn sec" data-acc="pdf">${icono('descargar')} Guardar PDF</button>
            <button type="button" class="btn sec" data-acc="correo" ${proveedor.correo ? '' : 'disabled'}>Correo</button>
          </div>
        </div>`}`;
      activarSelector();
      if (!lista.length) return;
      const items = () => lista.map((p) => ({ p, n: pedir.get(p.id) || 0 })).filter((x) => x.n > 0);
      const actualizarTotal = () => {
        const it = items();
        $('#tot-pedir', v).innerHTML = `<b>${it.length}</b> producto${it.length === 1 ? '' : 's'} · <b>${it.reduce((s, x) => s + x.n, 0)}</b> unidades a pedir`;
      };
      v.querySelectorAll('.fila.prod').forEach((f) => {
        const id = Number(f.dataset.id), inp = f.querySelector('.cant-n');
        const set = (n) => { n = Math.max(0, Math.floor(n) || 0); pedir.set(id, n); inp.value = n; f.classList.toggle('sel', n > 0); actualizarTotal(); };
        f.querySelectorAll('.cant-btn').forEach((b) => b.addEventListener('click', () => set((pedir.get(id) || 0) + Number(b.dataset.d))));
        inp.addEventListener('change', () => set(Number(inp.value)));
        f.classList.toggle('sel', (pedir.get(id) || 0) > 0);
      });
      actualizarTotal();
      const fechaTxt = new Date().toLocaleDateString('es-CL');
      const textoPedido = () => {
        const it = items();
        return [`Hola${proveedor.contacto ? ' ' + proveedor.contacto : ''}, le escribimos de *COVECA*.`,
          `Quisiéramos solicitar el siguiente pedido (${fechaTxt}):`, '',
          ...it.map(({ p, n }) => `• ${n} × ${p.nombre}${p.ref ? ` (REF ${p.ref})` : ''}`), '',
          `Total: ${it.reduce((s, x) => s + x.n, 0)} unidades.`, 'Por favor confirmar disponibilidad, precio y fecha de despacho. ¡Gracias!'].join('\n');
      };
      const sinItems = () => { if (!items().length) { aviso('Indica al menos una cantidad a pedir.', 'error'); return true; } return false; };
      $('[data-acc="wa-prov"]', v).addEventListener('click', () => {
        if (sinItems()) return;
        abrirExterno(`https://wa.me/${wa.startsWith('56') ? wa : '56' + wa}?text=${encodeURIComponent(textoPedido())}`);
      });
      $('[data-acc="correo"]', v).addEventListener('click', () => {
        if (sinItems()) return;
        abrirExterno(`mailto:${encodeURIComponent(proveedor.correo)}?subject=${encodeURIComponent('Solicitud de pedido COVECA – ' + fechaTxt)}&body=${encodeURIComponent(textoPedido().replace(/\*/g, ''))}`);
      });
      $('[data-acc="pdf"]', v).addEventListener('click', async (e) => {
        if (sinItems()) return;
        const b = e.currentTarget, html = b.innerHTML; b.disabled = true; b.textContent = 'Generando…';
        try {
          const it = items();
          const r = await nuevoReporte({ titulo: 'Solicitud de pedido', subtitulo: `Para ${proveedor.nombre}` });
          r.bloques([
            { titulo: 'Para', lineas: [proveedor.nombre, proveedor.contacto && `Atención: ${proveedor.contacto}`, proveedor.telefono, proveedor.correo] },
            { titulo: 'De', lineas: ['COVECA', 'Su comercializadora de confianza', '+56 9 7587 0827', `Fecha: ${fechaTxt}`] },
          ]);
          r.resumen([{ valor: it.length, etiqueta: 'Productos' }, { valor: it.reduce((s, x) => s + x.n, 0), etiqueta: 'Unidades a pedir' }]);
          r.seccion('Detalle del pedido');
          r.tabla([{ titulo: 'N°', ancho: 12 }, { titulo: 'Producto' }, { titulo: 'REF', ancho: 26 }, { titulo: 'Cantidad', ancho: 24, alinear: 'right' }],
            it.map(({ p, n }, i) => [String(i + 1), p.nombre, p.ref || '—', String(n)]),
            { pie: ['', 'Total', '', String(it.reduce((s, x) => s + x.n, 0))] });
          r.seccion('Observaciones', 'Por favor confirmar disponibilidad, precio y fecha de despacho. Ante cualquier duda, contactar a COVECA al +56 9 7587 0827.');
          const nombre = `COVECA-pedido-${proveedor.nombre.normalize('NFD').replace(/[^\w]+/g, '-')}-${hoyArchivo()}.pdf`;
          const donde = await guardarPdf(r.terminar(), nombre);
          aviso(`PDF guardado en ${donde}`);
        } catch (err) { aviso(err.message || 'No se pudo generar el PDF.', 'error'); }
        b.disabled = false; b.innerHTML = html;
      });
      return;
    }

    // ---------- Modo general (o sin proveedor): guía interna
    const fila = (p, k) => `<a class="fila" href="#/inventario/${p.id}">
        <div class="fila-txt"><p class="fila-t">${esc(p.nombre)}</p>
          <p class="fila-s">${esc(p.proveedor || 'Sin proveedor')} · mínimo ${p.stock_minimo ?? umbral}${p.stock_minimo == null ? ' (general)' : ''}</p></div>
        <span class="chip stock-${k}">${p.stock} unid.</span></a>`;
    const seccion = (k, titulo, ayuda) => grupos[k].length ? `
      <h2 class="sec-t">${titulo} · ${grupos[k].length}</h2>
      ${ayuda ? `<p class="ayuda pad">${ayuda}</p>` : ''}
      <div class="lista">${grupos[k].map((p) => fila(p, k)).join('')}</div>` : '';
    v.innerHTML = `${selector}
      <p class="total-reponer pad"><b>${total}</b> producto${total === 1 ? '' : 's'} por reponer${prov === 'sin' ? ' sin proveedor asignado' : ''}</p>
      <div class="resumen">
        <div><p class="resumen-n">${grupos.negativo.length}</p><p>Negativo</p></div>
        <div><p class="resumen-n">${grupos.sin.length}</p><p>Sin stock</p></div>
        <div><p class="resumen-n">${grupos.bajo.length}</p><p>Stock bajo</p></div>
      </div>
      ${total ? accionesHtml() : ''}
      ${total ? '' : vacio('Todo con stock suficiente', 'Ningún producto activo está bajo su mínimo.')}
      ${seccion('negativo', 'Negativo · revisar', 'Se vendió más de lo registrado. Conviene contar en bodega y ajustar.')}
      ${seccion('sin', 'Sin stock', '')}
      ${seccion('bajo', 'Stock bajo', '')}`;
    activarSelector();
    if (!total) return;
    activarAcciones(v, {
      nombre: () => `COVECA-stock-bajo${prov === 'sin' ? '-sin-proveedor' : ''}-${hoyArchivo()}.pdf`,
      pdf: async () => {
        const r = await nuevoReporte({ titulo: 'Reporte de stock bajo', subtitulo: prov === 'sin' ? `Sin proveedor asignado · ${total} productos` : `${total} productos por reponer` });
        r.resumen([
          { valor: total, etiqueta: 'Por reponer', color: COLORES.AZUL },
          { valor: grupos.negativo.length, etiqueta: 'Negativo (revisar)', color: COLORES.ROJO_TEXTO },
          { valor: grupos.sin.length, etiqueta: 'Sin stock', color: COLORES.ROJO_TEXTO },
          { valor: grupos.bajo.length, etiqueta: 'Stock bajo', color: COLORES.AMBAR },
        ]);
        const cols = [{ titulo: 'Producto' }, { titulo: 'Proveedor', ancho: 36 }, { titulo: 'REF', ancho: 18 },
          { titulo: 'Mínimo', ancho: 16, alinear: 'right' }, { titulo: 'Stock', ancho: 16, alinear: 'right' }];
        const filas = (lista) => lista.map((p) => [p.nombre, p.proveedor || '—', p.ref || '—',
          String(p.stock_minimo ?? umbral) + (p.stock_minimo == null ? '*' : ''), String(p.stock)]);
        const rojo = (k) => (i, c) => (c === 4 ? (k === 'bajo' ? COLORES.AMBAR : COLORES.ROJO_TEXTO) : null);
        if (grupos.negativo.length) { r.seccion('Negativo · revisar', 'Se vendió más de lo registrado. Conviene contar en bodega y ajustar el stock.'); r.tabla(cols, filas(grupos.negativo), { colorFila: rojo('negativo') }); }
        if (grupos.sin.length) { r.seccion('Sin stock'); r.tabla(cols, filas(grupos.sin), { colorFila: rojo('sin') }); }
        if (grupos.bajo.length) { r.seccion('Stock bajo'); r.tabla(cols, filas(grupos.bajo), { colorFila: rojo('bajo') }); }
        r.seccion('Nota', `* Productos sin mínimo propio: se consideran bajos con ${umbral} unidades o menos. Solo productos activos.`);
        return r.terminar();
      },
      texto: () => {
        const l = [`*COVECA – Stock bajo* (${new Date().toLocaleDateString('es-CL')})`, `${total} productos por reponer`];
        for (const [k, tit] of [['negativo', 'Negativo (revisar)'], ['sin', 'Sin stock'], ['bajo', 'Stock bajo']]) {
          if (!grupos[k].length) continue;
          l.push('', `*${tit}*`, ...grupos[k].map((p) => `• ${p.nombre}: ${p.stock}${p.proveedor ? ` (${p.proveedor})` : ''}`));
        }
        return l.join('\n');
      },
    });
  };

  function activarSelector() {
    $('#prov', v).addEventListener('change', (e) => { prov = e.target.value; guardar('reporte-prov', prov); pintar(); v.scrollTop = 0; });
    $('#umbral', v).addEventListener('change', (e) => {
      umbral = Math.max(0, Math.floor(Number(e.target.value)) || 0); guardar('reporte-umbral', String(umbral)); pedir.clear(); pintar();
    });
  }
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
      nombre: () => `COVECA-ventas-${desde.toISOString().slice(0, 10)}.pdf`,
      pdf: async () => {
        const r = await nuevoReporte({ titulo: 'Ventas de la semana', subtitulo: `Semana del ${etiqueta}` });
        r.resumen([
          { valor: clp(total), etiqueta: 'Total vendido', color: COLORES.AZUL, grande: true },
          { valor: clp(ganancia), etiqueta: `Ganancia (${pct(total ? ganancia / total : null)})`, color: COLORES.VERDE, grande: true },
          { valor: peds.length, etiqueta: 'Notas de venta' },
          { valor: clientes, etiqueta: 'Clientes atendidos' },
        ]);
        r.seccion('Por forma de pago');
        r.tabla([{ titulo: 'Forma de pago' }, { titulo: 'Notas', ancho: 24, alinear: 'right' }, { titulo: '% del total', ancho: 28, alinear: 'right' }, { titulo: 'Monto', ancho: 32, alinear: 'right' }],
          Object.entries(PAGOS).filter(([k]) => porPago[k]).map(([k, t]) => [t, String(peds.filter((p) => p.forma_pago === k).length), pct(porPago[k] / total), clp(porPago[k])]),
          { pie: ['Total', String(peds.length), '100 %', clp(total)] });
        r.seccion('Ventas por día');
        r.barras(porDia.map((m, i) => ({ etiqueta: DIAS[i + 1], valor: m })));
        r.seccion('Productos vendidos', `${ranking.length} productos · ${ranking.reduce((s, x) => s + x.cant, 0)} unidades`);
        r.tabla([{ titulo: 'Producto' }, { titulo: 'Unidades', ancho: 22, alinear: 'right' }, { titulo: '% del total', ancho: 26, alinear: 'right' }, { titulo: 'Monto', ancho: 32, alinear: 'right' }],
          ranking.map((x) => [x.nombre, String(x.cant), pct(x.monto / ranking.reduce((s, y) => s + y.monto, 0)), clp(x.monto)]),
          { pie: ['Total', String(ranking.reduce((s, x) => s + x.cant, 0)), '', clp(ranking.reduce((s, x) => s + x.monto, 0))] });
        r.seccion('Notas de venta', anuladas ? `${anuladas} nota(s) anulada(s) no se incluyen.` : '');
        r.tabla([{ titulo: 'N°', ancho: 14 }, { titulo: 'Fecha', ancho: 24 }, { titulo: 'Cliente' }, { titulo: 'Pago', ancho: 30 }, { titulo: 'Total', ancho: 28, alinear: 'right' }],
          peds.map((p) => [String(p.numero), fecha(p.fecha), p.cliente, PAGOS[p.forma_pago] || p.forma_pago, clp(p.total)]),
          { pie: ['', '', `${peds.length} notas`, '', clp(total)] });
        return r.terminar();
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
