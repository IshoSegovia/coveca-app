// Cierre del día: cuánto se vendió y cobró en un día (fecha de Chile), por forma de pago.
// "Efectivo a rendir" = notas cobradas en efectivo ese día (tomadas ese día u otro: cobro al entregar)
// + abonos en efectivo (migración 0038). Incluye lo guardado en el celular
// que aún no se sube (y avisa: al cerrar el día la cola debería quedar vacía). Pantalla, PDF, WhatsApp e imagen.
import { $, esc, barra, icono, vacio, clp, aviso, diaChile, sumarDias, etiquetaDia, horaChile as hora, plural, PAGO_TXT } from '../ui.js';
import * as datos from '../datos.js';
import { siluetas } from '../anima.js';
import { nuevoReporte, COLORES } from '../pdf.js';
import { accionesHtml, activarAcciones } from './reportes.js';
import { compartirResumen } from '../resumen-dia.js';

const suma = (l) => l.reduce((s, x) => s + (Number(x.total ?? x.monto) || 0), 0);

export async function vistaCierre(v) {
  barra({ titulo: 'Cierre del día', atras: '#/reportes' });
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const hoy = diaChile(new Date());
  let dia = /^\d{4}-\d{2}-\d{2}$/.test(q.get('dia') || '') ? q.get('dia') : hoy;

  const cargar = async () => {
    v.innerHTML = siluetas();
    const { pedidos, abonos, cobrados = [], creditos = [], sinRed } = await datos.cierreDia(dia);
    const vigentes = pedidos.filter((p) => p.estado !== 'anulado');
    const anuladas = pedidos.filter((p) => p.estado === 'anulado');
    const abonosV = abonos.filter((a) => !a.anulado);
    const ventas = (f) => suma(vigentes.filter((p) => p.forma_pago === f));
    const cobros = (f) => suma(abonosV.filter((a) => a.forma_pago === f));
    const cobradas = (f) => suma(cobrados.filter((p) => p.pago_forma === f));   // notas cobradas ese día
    const efectivo = cobradas('efectivo') + cobros('efectivo');
    const transf = cobradas('transferencia') + cobros('transferencia');
    const porCobrar = vigentes.filter((p) => datos.porCobrar(p));             // notas del día que quedaron por cobrar
    const deOtroDia = cobrados.filter((p) => diaChile(p.fecha) !== dia);
    const fiado = suma(creditos);   // crédito dado ese día (al entregar; en notas antiguas, al tomar el pedido)
    const vendido = suma(vigentes);
    const porSubir = pedidos.filter((p) => p.porSubir).length + abonos.filter((a) => a.porSubir).length;
    const titDia = `${dia === hoy ? 'Hoy · ' : dia === sumarDias(hoy, -1) ? 'Ayer · ' : ''}${etiquetaDia(dia)}`;
    const nada = !pedidos.length && !abonos.length && !cobrados.length && !creditos.length;
    // Notas vendidas bajo el precio de lista (solo administrador; lo calcula el servidor al subir la nota).
    const bajoNotas = datos.esAdmin() ? vigentes.filter((p) => p.bajo_lista > 0) : [];
    const bajoTotal = bajoNotas.reduce((s, p) => s + p.bajo_lista, 0);

    const filaMonto = (t, s, m) => `<div class="fila"><div class="fila-txt"><p class="fila-t">${t}</p>${s ? `<p class="fila-s">${s}</p>` : ''}</div><span class="monto">${clp(m)}</span></div>`;
    v.innerHTML = `
      <div class="semana-nav pad">
        <button type="button" class="btn sec" id="ant" aria-label="Día anterior">${icono('atras')}</button>
        <div class="semana-lbl"><p class="fila-t">${esc(titDia)}</p><p class="fila-s">Notas y abonos del día</p></div>
        <button type="button" class="btn sec" id="sig" aria-label="Día siguiente" ${dia >= hoy ? 'disabled' : ''}>${icono('derecha')}</button>
      </div>
      ${sinRed ? `<p class="nota-sin-senal pad-x">${icono('sinNube', 'ico-s')} Sin señal: se muestra lo que está guardado en este celular. Puede faltar lo de otros vendedores.</p>` : ''}
      ${porSubir ? `<p class="aviso-bodega pad-x">${icono('alerta', 'ico-s')} ${plural(porSubir, 'nota')} o abono${porSubir === 1 ? '' : 's'} por subir. Antes de cerrar el día, busca señal para que se suban (Ajustes → Trabajo sin señal).</p>` : ''}
      ${nada ? vacio('Sin ventas ni abonos', `${etiquetaDia(dia)}. Usa las flechas para ver otro día.`) : `
      <div class="resumen fiado-res cierre-res">
        <div><p class="resumen-n">${clp(efectivo)}</p><p>Efectivo a rendir</p></div>
        <div><p class="resumen-n">${clp(transf)}</p><p>Transferencias</p></div>
        <div><p class="resumen-n">${clp(fiado)}</p><p>Crédito</p></div>
      </div>
      ${bajoNotas.length ? `<div class="nota-bajo-lista">
        <p class="fila-t">${icono('alerta', 'ico-s')} ${plural(bajoNotas.length, 'nota')} bajo el precio de lista: ${clp(bajoTotal)} menos</p>
        <p class="fila-s">Están marcadas en "Notas del día". Los descuentos no cuentan aquí.</p></div>` : ''}
      ${accionesHtml()}
      <div class="pad-x"><button type="button" class="btn sec" id="resumen-img">${icono('whatsapp')} Compartir resumen del día (imagen)</button></div>
      <h2 class="sec-t">Ventas · ${plural(vigentes.length, 'nota')}</h2>
      <div class="lista">
        ${Object.entries(PAGO_TXT).filter(([k]) => k !== 'pendiente' || ventas(k)).map(([k, t]) => filaMonto(t, plural(vigentes.filter((p) => p.forma_pago === k).length, 'nota'), ventas(k))).join('')}
        ${filaMonto('<strong>Total vendido</strong>', anuladas.length ? `${plural(anuladas.length, 'anulada')}, no se cuenta${anuladas.length === 1 ? '' : 'n'}` : '', vendido)}
      </div>
      ${porCobrar.length ? `<p class="aviso-bodega pad-x">${icono('alerta', 'ico-s')} ${plural(porCobrar.length, 'nota')} de este día sin pago registrado (${clp(suma(porCobrar))}): se pagan al entregar y cuentan el día en que se cobran.</p>` : ''}
      ${creditos.length ? `<h2 class="sec-t">Dado a crédito · ${creditos.length}</h2>
      <div class="lista">${creditos.map((p) => `<a class="fila" href="#/pedidos/${p.id}"><div class="fila-txt"><p class="fila-t">${p.numero ? `N° ${p.numero} · ` : ''}${esc(p.cliente || 'Cliente')}</p>
        <p class="fila-s">${diaChile(p.fecha) !== dia ? 'Nota de otro día · ' : ''}${p.porSubir || p.cobroPorSubir ? 'Por subir' : 'A crédito'}</p></div><span class="monto">${clp(p.total)}</span></a>`).join('')}</div>` : ''}
      <h2 class="sec-t">Cobrado de notas · ${cobrados.length}</h2>
      <div class="lista">
        ${filaMonto('Efectivo', '', cobradas('efectivo'))}
        ${filaMonto('Transferencia', '', cobradas('transferencia'))}
        ${deOtroDia.length ? `<p class="pad-x fila-s">Incluye ${plural(deOtroDia.length, 'nota')} de otro día cobrada${deOtroDia.length === 1 ? '' : 's'} hoy al entregar (${clp(suma(deOtroDia))}).</p>` : ''}
      </div>
      <h2 class="sec-t">Abonos de crédito · ${abonosV.length}</h2>
      <div class="lista">
        ${filaMonto('Efectivo', '', cobros('efectivo'))}
        ${filaMonto('Transferencia', '', cobros('transferencia'))}
      </div>
      <h2 class="sec-t">Notas del día · ${pedidos.length}</h2>
      <div class="lista">${pedidos.map((p) => `
        <a class="fila" href="#/pedidos/${p.id}"><div class="fila-txt"><p class="fila-t">${p.numero ? `N° ${p.numero} · ` : ''}${esc(p.cliente || 'Cliente')}</p>
          <p class="fila-s">${hora(p.fecha)} · ${PAGO_TXT[p.forma_pago] || esc(p.forma_pago || '')}${datos.porCobrar(p) ? ' · <span class="txt-ambar">Por cobrar</span>' : ''}${p.porSubir ? ' · Por subir' : ''}${p.estado === 'anulado' ? ' · <span class="txt-alerta">Anulada</span>' : ''}${bajoNotas.includes(p) ? ` · <span class="txt-ambar">${icono('alerta', 'ico-s')} bajo lista ${clp(p.bajo_lista)}</span>` : ''}</p></div>
          <span class="monto">${p.estado === 'anulado' ? `<s>${clp(p.total)}</s>` : clp(p.total)}</span></a>`).join('') || '<p class="pad-x fila-s">Sin notas este día.</p>'}</div>
      ${abonos.length ? `<h2 class="sec-t">Abonos del día · ${abonos.length}</h2>
      <div class="lista">${abonos.map((a) => `
        <a class="fila" href="#/clientes/${a.cliente_id}"><div class="fila-txt"><p class="fila-t">${esc(a.cliente || 'Cliente')}</p>
          <p class="fila-s">${hora(a.fecha)} · ${PAGO_TXT[a.forma_pago] || esc(a.forma_pago || '')}${a.porSubir ? ' · Por subir' : ''}${a.anulado ? ' · <span class="txt-alerta">Anulado</span>' : ''}</p></div>
          <span class="monto">${a.anulado ? `<s>${clp(a.monto)}</s>` : clp(a.monto)}</span></a>`).join('')}</div>` : ''}`}`;

    $('#ant', v).addEventListener('click', () => { dia = sumarDias(dia, -1); cargar(); });
    $('#sig', v).addEventListener('click', () => { if (dia < hoy) { dia = sumarDias(dia, 1); cargar(); } });
    if (nada) return;
    $('#resumen-img', v)?.addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try {
        await compartirResumen({ dia, titulo: etiquetaDia(dia), vendido, notas: vigentes.length, efectivo, transf, credito: fiado,
          abonos: suma(abonosV), vendedor: datos.usuario()?.nombre || '' });
      } catch (err) { aviso(`No se pudo compartir el resumen: ${err.message}`, 'error'); }
      b.disabled = false;
    });
    activarAcciones(v, {
      nombre: () => `COVECA-cierre-${dia}.pdf`,
      pdf: async () => {
        const r = await nuevoReporte({ titulo: 'Cierre del día', subtitulo: etiquetaDia(dia) });
        r.resumen([
          { valor: clp(efectivo), etiqueta: 'Efectivo a rendir', color: COLORES.AZUL, grande: true },
          { valor: clp(transf), etiqueta: 'Transferencias' },
          { valor: clp(fiado), etiqueta: 'Crédito' },
          { valor: clp(vendido), etiqueta: 'Total vendido' },
        ]);
        r.seccion('Por forma de pago', porSubir ? `${porSubir} registro(s) aún por subir desde el celular.` : '');
        r.tabla([{ titulo: 'Forma' }, { titulo: 'Vendido', ancho: 30, alinear: 'right' }, { titulo: 'Notas cobradas', ancho: 32, alinear: 'right' }, { titulo: 'Abonos', ancho: 28, alinear: 'right' }, { titulo: 'A rendir', ancho: 30, alinear: 'right' }],
          Object.entries(PAGO_TXT).map(([k, t]) => k === 'credito' || k === 'pendiente' ? [t, clp(ventas(k)), '—', '—', '—']
            : [t, clp(ventas(k)), clp(cobradas(k)), clp(cobros(k)), clp(cobradas(k) + cobros(k))]),
          { pie: ['Total', clp(vendido), clp(suma(cobrados)), clp(suma(abonosV)), clp(efectivo + transf)] });
        if (porCobrar.length || deOtroDia.length) r.seccion('Cobros', [porCobrar.length ? `${porCobrar.length} nota(s) del día por cobrar: ${clp(suma(porCobrar))}.` : '', deOtroDia.length ? `${deOtroDia.length} nota(s) de otro día cobrada(s) hoy: ${clp(suma(deOtroDia))}.` : ''].filter(Boolean).join(' '));
        r.seccion('Notas del día', anuladas.length ? `${anuladas.length} anulada(s), no suman.` : '');
        r.tabla([{ titulo: 'N°', ancho: 16 }, { titulo: 'Hora', ancho: 16 }, { titulo: 'Cliente' }, { titulo: 'Pago', ancho: 28 }, { titulo: 'Total', ancho: 28, alinear: 'right' }],
          pedidos.map((p) => [p.numero ? String(p.numero) : '—', hora(p.fecha), (p.cliente || 'Cliente') + (p.porSubir ? ' (por subir)' : ''),
            p.estado === 'anulado' ? 'Anulada' : (PAGO_TXT[p.forma_pago] || '') + (datos.porCobrar(p) ? ' (por cobrar)' : ''), clp(p.total)]),
          { colorFila: (i) => (pedidos[i].estado === 'anulado' ? COLORES.ROJO_TEXTO : null) });
        if (bajoNotas.length) {
          r.seccion('Vendido bajo el precio de lista', `${bajoNotas.length} nota(s) · ${clp(bajoTotal)} menos que el precio de lista. Los descuentos no cuentan aquí.`);
          r.tabla([{ titulo: 'N°', ancho: 16 }, { titulo: 'Hora', ancho: 16 }, { titulo: 'Cliente' }, { titulo: 'Bajo lista', ancho: 30, alinear: 'right' }],
            bajoNotas.map((p) => [String(p.numero || '—'), hora(p.fecha), p.cliente || 'Cliente', clp(p.bajo_lista)]));
        }
        if (abonos.length) {
          r.seccion('Abonos del día');
          r.tabla([{ titulo: 'Hora', ancho: 16 }, { titulo: 'Cliente' }, { titulo: 'Forma', ancho: 30 }, { titulo: 'Monto', ancho: 28, alinear: 'right' }],
            abonos.map((a) => [hora(a.fecha), (a.cliente || 'Cliente') + (a.porSubir ? ' (por subir)' : ''), a.anulado ? 'Anulado' : PAGO_TXT[a.forma_pago] || '', clp(a.monto)]),
            { colorFila: (i) => (abonos[i].anulado ? COLORES.ROJO_TEXTO : null) });
        }
        return r.terminar();
      },
      mensaje: () => `*COVECA – Cierre ${etiquetaDia(dia).toLowerCase()}*`,
    });
  };
  await cargar();
}
