// Reporte de carga para bodega: cuánto de cada producto hay que cargar para una ruta y un día
// (los pedidos tomados ese día; la entrega es normalmente al día siguiente).
// Incluye los pedidos guardados en el celular que aún no se suben. Pantalla, PDF y WhatsApp.
// Notas de cambio (ticket N° 12): lo que recibe el cliente se suma a lo que hay que cargar y lo que devuelve va en
// "Para retirar", así bodega controla qué sale y qué vuelve.
import { $, esc, barra, icono, vacio, diaChile, sumarDias, etiquetaDia, plural, leerAjuste, guardarAjuste } from '../ui.js';
import * as datos from '../datos.js';
import { siluetas } from '../anima.js';
import { nuevoReporte, COLORES } from '../pdf.js';
import { accionesHtml, activarAcciones } from './reportes.js';
import { resumenCambio } from './cambios.js';


export async function vistaCarga(v) {
  barra({ titulo: 'Carga para bodega', atras: '#/reportes' });
  // Se puede abrir con ?dia=AAAA-MM-DD&ruta=ID (por ejemplo desde una captura o un enlace)
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const hoy = diaChile(new Date());
  // Por defecto, los pedidos de AYER: se toman un día y se cargan y entregan al siguiente (decisión del negocio).
  let dia = /^\d{4}-\d{2}-\d{2}$/.test(q.get('dia') || '') ? q.get('dia') : sumarDias(hoy, -1);
  const [rutas, productos, clis] = await Promise.all([datos.rutas(), datos.productos({ soloActivos: false }), datos.clientes({ inactivos: true }).catch(() => [])]);
  const nombreCliente = (id) => clis.find((c) => String(c.id) === String(id))?.nombre || 'Cliente';
  const rutasReales = rutas.filter((r) => !r.especial);
  const diaSemana = ((new Date(dia + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1;   // 1 = lunes
  // Ruta por defecto: la elegida antes; si no, la ruta que se recorre el día de los pedidos; si no, todas.
  let ruta = q.has('ruta') ? q.get('ruta') : leerAjuste('carga-ruta', '') || String(rutasReales.find((r) => r.dia_semana === diaSemana)?.id || '');
  if (ruta && ruta !== 'sin' && !rutasReales.some((r) => String(r.id) === ruta)) ruta = '';
  const prodDe = new Map(productos.map((p) => [p.id, p]));
  // Modo: pedidos tomados un día, o todo lo que falta por entregar (de cualquier día; pestaña Pedidos).
  let modo = q.get('modo') === 'entregar' ? 'entregar' : q.get('modo') === 'dia' ? 'dia' : leerAjuste('carga-modo', 'dia');

  const cargar = async () => {
    v.innerHTML = siluetas();
    // Pedidos del servidor (se pide un margen de un día a cada lado y se filtra por fecha de Chile)
    let delServidor = [], sinRed = false, pend = null;
    try {
      if (modo === 'entregar') {
        const porEntregar = (await datos.pedidosEntrega()).filter((p) => !p.entregado_en);
        pend = new Set(porEntregar.map((p) => p.id));
        const desde = porEntregar.map((p) => p.fecha).sort()[0];
        if (desde) delServidor = await datos.ventas(new Date(sumarDias(diaChile(desde), -1) + 'T00:00:00Z'), new Date(sumarDias(hoy, 2) + 'T00:00:00Z'));
      } else delServidor = await datos.ventas(new Date(sumarDias(dia, -1) + 'T00:00:00Z'), new Date(sumarDias(dia, 2) + 'T00:00:00Z'));
    } catch (e) {
      if (!e.sinRed) throw e;
      sinRed = true;
    }
    // Pedidos guardados en este celular que aún no se suben
    const enCola = datos.pedidosEnCola().map((x) => ({
      id: x.pedido.id, numero: x.pedido.numero, fecha: x.pedido.fecha, cliente_id: x.pedido.cliente_id, ruta_id: x.pedido.ruta_id ?? null,
      cliente: x.resumen.cliente || 'Cliente', estado: 'generado', porSubir: true,
      items: x.pedido.items.map((i) => ({ producto_id: i.producto_id, nombre: prodDe.get(i.producto_id)?.nombre || `Producto ${i.producto_id}`, cantidad: i.cantidad })),
    }));
    const nombreRuta = ruta === 'sin' ? 'Sin ruta' : ruta ? rutasReales.find((r) => String(r.id) === ruta)?.nombre : 'Todas las rutas';
    const cambs = (await datos.cambios().catch(() => [])).filter((c) => !c.anulado_en && (modo === 'entregar' ? !c.entregado_en : diaChile(c.fecha) === dia))
      .map((c) => ({ ...c, ruta_id: c.ruta_id ?? clis.find((k) => String(k.id) === String(c.cliente_id))?.ruta_id ?? null }))   // guardado sin señal: la ruta del cliente
      .filter((c) => (ruta === 'sin' ? c.ruta_id == null : !ruta || String(c.ruta_id) === ruta))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const peds = [...delServidor.filter((p) => !enCola.some((c) => c.id === p.id)), ...enCola]
      .filter((p) => p.estado !== 'anulado' && (modo === 'entregar' ? !pend || pend.has(p.id) : diaChile(p.fecha) === dia))
      .filter((p) => (ruta === 'sin' ? !p.ruta_id : !ruta || String(p.ruta_id) === ruta))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Total por producto (pedidos + lo que reciben los clientes por cambios)
    const tot = new Map();
    for (const p of peds) for (const i of p.items) {
      const t = tot.get(i.producto_id) || { id: i.producto_id, nombre: i.nombre, cant: 0, pedidos: 0, cambios: 0 };
      t.cant += i.cantidad; t.pedidos++; tot.set(i.producto_id, t);
    }
    const ret = new Map();   // lo que devuelven los clientes por cambios (para retirar)
    for (const c of cambs) for (const i of c.items) {
      const m = i.sentido === 'recibe' ? tot : ret;
      const t = m.get(i.producto_id) || { id: i.producto_id, nombre: i.nombre, cant: 0, pedidos: 0, cambios: 0, baja: 0 };
      t.cant += i.cantidad; t.cambios++; if (i.destino === 'baja') t.baja += i.cantidad; m.set(i.producto_id, t);
    }
    const retirar = [...ret.values()].map((t) => ({ ...t, ref: prodDe.get(t.id)?.ref || '' })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const uRetirar = retirar.reduce((s, l) => s + l.cant, 0);
    const detalleFila = (l) => [l.pedidos ? plural(l.pedidos, 'pedido') : '', l.cambios ? plural(l.cambios, 'cambio') : ''].filter(Boolean).join(' · ');
    const lineas = [...tot.values()].map((t) => ({ ...t, ref: prodDe.get(t.id)?.ref || '', stock: prodDe.get(t.id)?.stock }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const unidades = lineas.reduce((s, l) => s + l.cant, 0);
    const clientes = new Set(peds.map((p) => p.cliente_id ?? `nuevo:${p.id}`)).size;   // clientes nuevos sin subir cuentan aparte
    const faltan = lineas.filter((l) => l.stock != null && l.stock < 0);
    const titDia = modo === 'entregar' ? 'Todo lo que falta por entregar' : `${dia === hoy ? 'Hoy · ' : dia === sumarDias(hoy, -1) ? 'Ayer · ' : ''}${etiquetaDia(dia)}`;

    v.innerHTML = `
      <div class="pad filtro-rep">
        <label class="campo"><span>Ruta</span>
          <select id="ruta-c">
            <option value="">Todas las rutas</option>
            ${rutasReales.map((r) => `<option value="${r.id}" ${ruta === String(r.id) ? 'selected' : ''}>${esc(r.nombre)}</option>`).join('')}
            <option value="sin" ${ruta === 'sin' ? 'selected' : ''}>Clientes sin ruta</option>
          </select></label>
      </div>
      <div class="filtros" role="tablist">
        <button class="filtro" data-modo="dia" role="tab" aria-selected="${modo === 'dia'}">Por día</button>
        <button class="filtro" data-modo="entregar" role="tab" aria-selected="${modo === 'entregar'}">Por entregar</button>
      </div>
      ${modo === 'entregar' ? `<p class="ayuda pad-x">Pedidos de cualquier día que todavía no se marcan como entregados (pestaña Pedidos).</p>` : `<div class="semana-nav pad">
        <button type="button" class="btn sec" id="ant" aria-label="Día anterior">${icono('atras')}</button>
        <div class="semana-lbl"><p class="fila-t">${esc(titDia)}</p><p class="fila-s">Pedidos tomados ese día</p></div>
        <button type="button" class="btn sec" id="sig" aria-label="Día siguiente" ${dia >= hoy ? 'disabled' : ''}>${icono('derecha')}</button>
      </div>`}
      ${sinRed ? `<p class="nota-sin-senal pad-x">${icono('sinNube', 'ico-s')} Sin señal: solo se muestran los pedidos guardados en este celular.</p>` : ''}
      ${!peds.length && !cambs.length ? (modo === 'entregar' ? vacio('Nada por entregar', `${nombreRuta}: todos los pedidos están entregados.`) : vacio('Sin pedidos para cargar', `${nombreRuta} · ${etiquetaDia(dia)}. Usa las flechas para ver otro día.`)) : `
      <div class="resumen">
        <div><p class="resumen-n">${unidades}</p><p>Unidades</p></div>
        <div><p class="resumen-n">${lineas.length}</p><p>Productos</p></div>
        <div><p class="resumen-n">${peds.length}</p><p>Pedidos</p></div>
        ${cambs.length ? `<div><p class="resumen-n">${cambs.length}</p><p>Cambios</p></div>` : ''}
      </div>
      ${accionesHtml()}
      ${faltan.length ? `<p class="aviso-bodega pad-x">${icono('alerta', 'ico-s')} ${plural(faltan.length, 'producto')} con stock negativo: puede no alcanzar lo que hay en bodega.</p>` : ''}
      <h2 class="sec-t">Productos a cargar · ${lineas.length}</h2>
      <div class="lista">${lineas.map((l) => `
        <div class="fila carga"><div class="fila-txt"><p class="fila-t">${esc(l.nombre)}</p>
          <p class="fila-s">${l.ref ? `REF ${esc(l.ref)} · ` : ''}${detalleFila(l)}</p>
          ${l.stock != null && l.stock < 0 ? `<p class="fila-s txt-alerta">${icono('alerta', 'ico-s')} Stock ${l.stock}: puede no alcanzar</p>` : ''}</div>
          <span class="carga-n"><span class="monto">${l.cant}</span><span class="carga-u">unid.</span></span></div>`).join('')}</div>
      ${retirar.length ? `<h2 class="sec-t">Para retirar (cambios) · ${retirar.length}</h2>
      <p class="ayuda pad-x">Lo que devuelven los clientes. Lo marcado "se da de baja" no vuelve a la venta.</p>
      <div class="lista">${retirar.map((l) => `
        <div class="fila carga"><div class="fila-txt"><p class="fila-t">${esc(l.nombre)}</p>
          <p class="fila-s">${l.ref ? `REF ${esc(l.ref)} · ` : ''}${plural(l.cambios, 'cambio')}${l.baja ? ` · <span class="txt-alerta">${l.baja} se da${l.baja === 1 ? '' : 'n'} de baja</span>` : ''}</p></div>
          <span class="carga-n"><span class="monto">${l.cant}</span><span class="carga-u">unid.</span></span></div>`).join('')}</div>` : ''}
      ${cambs.length ? `<h2 class="sec-t">Cambios incluidos · ${cambs.length}</h2>
      <div class="lista">${cambs.map((c) => `
        <a class="fila" href="#/cambios/${c.id}"><div class="fila-txt"><p class="fila-t">Cambio N° ${esc(datos.numeroCambio(c))} · ${esc(c.cliente || nombreCliente(c.cliente_id))}</p>
          <p class="fila-s">${esc(resumenCambio(c))}${c.porSubir ? ' · Por subir' : ''}</p></div>
          ${icono('derecha', 'ico-chev')}</a>`).join('')}</div>` : ''}
      ${peds.length ? `<h2 class="sec-t">Pedidos incluidos · ${peds.length}</h2>
      <div class="lista">${peds.map((p) => `
        <a class="fila" href="#/pedidos/${p.id}"><div class="fila-txt"><p class="fila-t">${p.numero ? `N° ${p.numero} · ` : ''}${esc(p.cliente)}</p>
          <p class="fila-s">${p.items.reduce((s, i) => s + i.cantidad, 0)} unid.${p.porSubir ? ' · Por subir' : ''}</p></div>
          ${icono('derecha', 'ico-chev')}</a>`).join('')}</div>` : ''}`}`;

    $('#ruta-c', v).addEventListener('change', (e) => { ruta = e.target.value; guardarAjuste('carga-ruta', ruta); cargar(); });
    $('#ant', v)?.addEventListener('click', () => { dia = sumarDias(dia, -1); cargar(); });
    $('#sig', v)?.addEventListener('click', () => { if (dia < hoy) { dia = sumarDias(dia, 1); cargar(); } });
    v.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => { modo = b.dataset.modo; guardarAjuste('carga-modo', modo); cargar(); }));
    if (!peds.length && !cambs.length) return;
    activarAcciones(v, {
      nombre: () => `COVECA-carga-${(nombreRuta || 'rutas').normalize('NFD').replace(/[^\w]+/g, '-')}-${modo === 'entregar' ? 'por-entregar-' + hoy : dia}.pdf`,
      pdf: async () => {
        const r = await nuevoReporte({ titulo: 'Reporte de carga', subtitulo: `${nombreRuta} · ${modo === 'entregar' ? 'pedidos por entregar' : `pedidos del ${etiquetaDia(dia).toLowerCase()}`}` });
        r.resumen([
          { valor: unidades, etiqueta: 'Unidades a cargar', color: COLORES.AZUL, grande: true },
          { valor: lineas.length, etiqueta: 'Productos' },
          { valor: peds.length, etiqueta: 'Pedidos' },
          ...(cambs.length ? [{ valor: cambs.length, etiqueta: 'Cambios' }] : [{ valor: clientes, etiqueta: 'Clientes' }]),
        ]);
        r.seccion('Productos a cargar', `Marca cada producto al subirlo al vehículo.${faltan.length ? ` ${faltan.length} producto(s) con stock negativo (en rojo): puede no alcanzar.` : ''}`);
        r.tabla([{ titulo: 'Producto' }, { titulo: 'REF', ancho: 22 }, { titulo: 'Cantidad', ancho: 22, alinear: 'right' }, { titulo: 'Cargado', ancho: 20, alinear: 'center' }],
          lineas.map((l) => [l.nombre, l.ref, String(l.cant), '[   ]']),
          { pie: ['Total', '', String(unidades), ''], colorFila: (i, col) => (col <= 2 && lineas[i].stock != null && lineas[i].stock < 0 ? COLORES.ROJO_TEXTO : null) });
        if (retirar.length) {
          r.seccion('Para retirar (cambios)', 'Lo que devuelven los clientes. "Baja" = no vuelve a la venta.');
          r.tabla([{ titulo: 'Producto' }, { titulo: 'REF', ancho: 22 }, { titulo: 'Cantidad', ancho: 22, alinear: 'right' }, { titulo: 'Retirado', ancho: 20, alinear: 'center' }],
            retirar.map((l) => [l.nombre + (l.baja ? ` (baja: ${l.baja})` : ''), l.ref, String(l.cant), '[   ]']), { pie: ['Total', '', String(uRetirar), ''] });
        }
        if (cambs.length) {
          r.seccion('Cambios incluidos');
          r.tabla([{ titulo: 'N°', ancho: 22 }, { titulo: 'Cliente' }, { titulo: 'Detalle', ancho: 70 }],
            cambs.map((c) => [datos.numeroCambio(c), (c.cliente || nombreCliente(c.cliente_id)) + (c.porSubir ? ' (por subir)' : ''), resumenCambio(c)]));
        }
        if (peds.length) r.seccion('Pedidos incluidos');
        if (peds.length) r.tabla([{ titulo: 'N°', ancho: 18 }, { titulo: 'Cliente' }, { titulo: 'Unidades', ancho: 24, alinear: 'right' }],
          peds.map((p) => [p.numero ? String(p.numero) : '—', p.cliente + (p.porSubir ? ' (por subir)' : ''), String(p.items.reduce((s, i) => s + i.cantidad, 0))]),
          { pie: ['', `${peds.length} pedidos`, String(unidades)] });
        return r.terminar();
      },
      mensaje: () => `*COVECA – Carga ${nombreRuta}*`,
    });
  };
  await cargar();
}
