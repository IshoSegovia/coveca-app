// Fiado: bloque de la ficha del cliente (deuda, notas pendientes, abonos), reglas (plazo general)
// y reporte de cuentas por cobrar.
import { $, $$, esc, barra, icono, vacio, aviso, ir, clp, fecha, leerForm, DIAS, diaChile, diaMes, hoyChile, plural } from '../ui.js';
import * as datos from '../datos.js';
import { entreDias, diasExtra, PLAZO_DEFECTO, sinTope, superaLimite, textoLimite } from '../fiado.js';
import { accionesHtml, activarAcciones } from './reportes.js';
import { nuevoReporte, COLORES } from '../pdf.js';
import { telWhatsApp } from '../campos.js';

// Formas de pago de un abono (un abono no puede ser a crédito)
const PAGOS = { efectivo: 'Efectivo', transferencia: 'Transferencia' };
const estadoNota = (n) => (n.dias_atraso > 0 ? `<span class="chip alerta">${icono('alerta', 'ico-s')} Atrasada ${plural(n.dias_atraso, 'día')}</span>`
  : (() => { const d = entreDias(hoyChile(), n.vence_en); return `<span class="chip">${d === 0 ? 'Vence hoy' : `Vence en ${plural(d, 'día')}`}</span>`; })());

// ---------------------------------------------------------------- Ficha del cliente
// fi = datos.fiadoCliente(id) · c = cliente · nivel = nombre del nivel de lealtad (o null)
export function fiadoHtml(fi, c, nivel, programa, plazoGeneral) {
  const pend = fi.notas.filter((n) => n.pendiente > 0);
  const extra = diasExtra(programa, nivel);
  const plazo = c.plazo_credito_dias || plazoGeneral || PLAZO_DEFECTO;
  const hayAlgo = pend.length || fi.abonos.length || fi.saldo_favor;
  const limite = c.limite_credito ?? null;
  return `
    <h2 class="sec-t">Crédito</h2>
    <div class="resumen fiado-res">
      <div><p class="resumen-n monto">${clp(fi.deuda)}</p><p>Debe</p></div>
      <div class="${fi.atrasado ? 'alerta' : ''}"><p class="resumen-n monto">${clp(fi.atrasado)}</p><p>Atrasado</p></div>
      <div><p class="resumen-n monto">${textoLimite(limite, clp)}</p><p>Límite</p></div>
    </div>
    ${fi.atrasado ? `<p class="nota-falta alerta">${icono('alerta', 'ico-s')} Tiene ${clp(fi.atrasado)} atrasado (hace ${plural(fi.dias_atraso, 'día')}). Cóbralo en esta visita.</p>` : ''}
    ${superaLimite(limite, fi.deuda) ? `<p class="nota-falta alerta">${icono('alerta', 'ico-s')} ${Number(limite) === 0 ? 'No tiene crédito disponible y debe ' + clp(fi.deuda) + '.' : `Está ${clp(fi.deuda - limite)} sobre su límite de crédito.`}</p>` : ''}
    ${fi.saldo_favor ? `<p class="nota-falta">Tiene ${clp(fi.saldo_favor)} a favor (abonó más de lo que debía).</p>` : ''}
    <p class="ayuda pad-x">Plazo para pagar: ${plural(plazo, 'día')}${c.plazo_credito_dias ? '' : ' (plazo general)'}${extra ? ` + ${plural(extra, 'día')} por ser cliente ${esc(nivel)}` : ''}.</p>
    ${pend.length ? `<div class="lista mt">${pend.map((n) => `
      <a class="fila" href="#/pedidos/${n.pedido_id}"><div class="fila-txt">
        <p class="fila-t">${n.numero ? `Nota N° ${n.numero}` : 'Nota sin número'}${n.porSubir ? ' · Por subir' : ''}</p>
        <p class="fila-s">${fecha(n.fecha)} · vence ${fecha(n.vence_en)}${n.pagado ? ` · pagado ${clp(n.pagado)} de ${clp(n.total)}` : ''}</p>
        ${estadoNota(n)}</div>
        <span class="monto">${clp(n.pendiente)}</span>${icono('derecha', 'ico-chev')}</a>`).join('')}</div>`
      : `<p class="texto-suave pad-x">${hayAlgo ? `${icono('check', 'ico-s')} Sin deudas pendientes.` : 'Sin compras a crédito.'}</p>`}

    ${fi.deuda > 0 ? `<div class="pad"><button type="button" id="abrir-abono" class="btn sec">${icono('mas')} Registrar abono</button></div>
    <form id="form-abono" class="form pad abono-form" hidden novalidate>
      <h3 class="sub-t">Registrar abono</h3>
      <label class="campo"><span>Monto ($)</span>
        <input name="monto" type="number" inputmode="numeric" min="1" placeholder="Debe ${clp(fi.deuda)}" required></label>
      <button type="button" id="abono-todo" class="btn link izq">Paga todo: ${clp(fi.deuda)}</button>
      <fieldset class="opciones"><legend>Forma de pago</legend>
        ${Object.entries(PAGOS).map(([k, t], i) => `<label class="opcion"><input type="radio" name="forma_pago" value="${k}" ${i ? '' : 'checked'}> ${t}</label>`).join('')}
      </fieldset>
      <label class="campo"><span>Nota (opcional)</span><input name="nota" maxlength="120" placeholder="Ej.: transferencia del 11-10"></label>
      <p class="ayuda">El abono paga primero las notas más antiguas.</p>
      <p id="err-abono" class="error" role="alert"></p>
      <div class="fila-botones"><button type="button" id="cancelar-abono" class="btn sec">Cancelar</button>
        <button type="submit" class="btn prin sin-margen">Guardar abono</button></div>
    </form>` : ''}

    ${fi.abonos.length ? `<h3 class="sub-t pad-x">Abonos</h3>
    <div class="lista">${fi.abonos.slice(0, 10).map((a) => `
      <div class="fila abono" data-id="${esc(a.id)}"><div class="fila-txt">
        <p class="fila-t">${fecha(a.fecha)} · ${esc(PAGOS[a.forma_pago] || a.forma_pago)}${a.porSubir ? ' · Por subir' : ''}${a.anulado ? ' · <span class="txt-alerta">Anulado</span>' : ''}</p>
        ${a.nota || a.anulado_motivo ? `<p class="fila-s">${esc(a.anulado ? 'Motivo: ' + a.anulado_motivo : a.nota)}</p>` : ''}
        ${!a.anulado && !a.porSubir && (datos.esAdmin() || a.vendedor_id === datos.usuario()?.id) ? `<button type="button" class="btn link izq anular-abono" data-id="${esc(a.id)}">Anular abono</button>` : ''}</div>
        <span class="monto ${a.anulado ? 'tachado' : ''}">${clp(a.monto)}</span></div>`).join('')}</div>` : ''}`;
}

export function activarFiado(v, c, fi, recargar) {
  const form = $('#form-abono', v), abrir = $('#abrir-abono', v), pie = $('.pie-fijo', v);
  const mostrar = (si) => { if (!form) return; form.hidden = !si; abrir.hidden = si; if (pie) pie.hidden = si; };
  abrir?.addEventListener('click', () => { mostrar(true); form.monto.focus(); form.scrollIntoView({ block: 'center' }); });
  $('#cancelar-abono', v)?.addEventListener('click', () => mostrar(false));
  $('#abono-todo', v)?.addEventListener('click', () => { form.monto.value = fi.deuda; });
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = leerForm(form), err = $('#err-abono', v);
    const monto = Math.floor(Number(d.monto) || 0);
    if (monto <= 0) { err.textContent = 'Escribe el monto del abono.'; return; }
    if (monto > fi.deuda) { err.textContent = `El abono no puede ser mayor que la deuda (${clp(fi.deuda)}).`; return; }
    const b = form.querySelector('[type="submit"]'); b.disabled = true; b.textContent = 'Guardando…';
    try {
      const r = await datos.registrarAbono({ id: crypto.randomUUID(), cliente_id: Number(c.id), monto, forma_pago: d.forma_pago || 'efectivo', nota: d.nota },
        { cliente: c.nombre });
      aviso(r.porSubir ? `Abono de ${clp(monto)} guardado en el celular · se sube al volver la señal` : `Abono de ${clp(monto)} registrado`);
      recargar();
    } catch (x) { err.textContent = x.message; b.disabled = false; b.textContent = 'Guardar abono'; }
  });
  // Anular un abono: pide el motivo en la misma fila
  $$('.anular-abono', v).forEach((btn) => btn.addEventListener('click', () => {
    const fila = btn.closest('.fila');
    if (fila.nextElementSibling?.classList.contains('anular-form')) return;
    btn.hidden = true;
    fila.insertAdjacentHTML('afterend', `<form class="form pad anular-form" novalidate>
      <label class="campo"><span>Motivo de la anulación</span><input name="motivo" maxlength="120" placeholder="Ej.: se registró dos veces"></label>
      <p class="error" role="alert"></p>
      <div class="fila-botones"><button type="button" class="btn sec cancelar">Cancelar</button>
        <button type="submit" class="btn peligro sin-margen">Anular abono</button></div></form>`);
    const f = fila.nextElementSibling;
    f.motivo.focus();
    f.querySelector('.cancelar').addEventListener('click', () => { f.remove(); btn.hidden = false; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const motivo = f.motivo.value.trim();
      if (!motivo) { f.querySelector('.error').textContent = 'Escribe el motivo.'; return; }
      try { await datos.anularAbono(btn.dataset.id, motivo); aviso('Abono anulado'); recargar(); }
      catch (x) { f.querySelector('.error').textContent = x.message; }
    });
  }));
}

// Aviso de crédito en "Revisar pedido" (solo al editar una nota antigua que ya era a crédito)
export function avisoFiado(fi, c, totalPedido, deudaQueSeAnula = 0) {
  if (!fi) return `<p class="nota-falta">No se pudo leer la deuda de este cliente. Revisa su ficha antes de vender a crédito.</p>`;
  const limite = c.limite_credito ?? null;
  const antes = Math.max(0, fi.deuda - deudaQueSeAnula), despues = antes + totalPedido;
  const supera = superaLimite(limite, despues);
  return `<div class="fiado-aviso ${supera || fi.atrasado ? 'alerta' : ''}">
    <p class="fila-t">${icono(supera || fi.atrasado ? 'alerta' : 'check', 'ico-s')} Crédito: debe ${clp(antes)} · con este pedido, ${clp(despues)}</p>
    <p class="fila-s">${sinTope(limite) ? 'Sin tope de crédito.' : Number(limite) === 0 ? 'Sin crédito disponible.' : `Límite ${clp(limite)}.`}${fi.atrasado ? ` Tiene ${clp(fi.atrasado)} atrasado (${plural(fi.dias_atraso, 'día')}).` : ''}</p>
    ${supera ? `<p class="fila-s txt-alerta">${Number(limite) === 0 ? 'No tiene crédito disponible' : `Supera el límite en ${clp(despues - limite)}`}. Puedes seguir: la nota quedará marcada "sobre el límite".</p>` : ''}
  </div>`;
}

// ---------------------------------------------------------------- Reglas del fiado (Ajustes)
export async function vistaReglasFiado(v) {
  barra({ titulo: 'Reglas del crédito', atras: '#/ajustes' });
  const [cfg, prog] = await Promise.all([datos.reglasFiado(), datos.programaLealtad().catch(() => null)]);
  const admin = datos.esAdmin();
  v.innerHTML = `
    <form id="f" class="form pad" novalidate ${admin ? '' : 'inert'}>
      <label class="campo"><span>Plazo general para pagar (días)</span>
        <input name="plazo_dias" type="number" inputmode="numeric" min="1" max="365" value="${cfg.plazo_dias || PLAZO_DEFECTO}"></label>
      <p class="ayuda">Se usa para los clientes que no tienen un plazo propio en su ficha. Después de este plazo, la nota a crédito queda atrasada.</p>
      <h2 class="sec-t">Días extra por nivel</h2>
      <dl class="datos">${(prog?.niveles || []).map((n) => `<div class="dato"><dt>${esc(n.nombre)}</dt><dd>${n.dias_fiado ? `+ ${plural(n.dias_fiado, 'día')}` : 'Sin días extra'}</dd></div>`).join('')}</dl>
      <a class="btn link izq" href="#/lealtad">Cambiar en Programa de lealtad ${icono('derecha', 'ico-s')}</a>
      <h2 class="sec-t">Cómo funciona</h2>
      <ul class="ayuda lista-ayuda">
        <li>Cada nota a crédito vence el día de la nota + el plazo del cliente + los días extra de su nivel.</li>
        <li>Los abonos pagan primero las notas más antiguas.</li>
        <li>Límite de crédito vacío = sin tope; $0 = sin crédito disponible. Si un pedido lo supera, la app avisa y deja seguir; la nota queda marcada.</li>
      </ul>
      <p id="err" class="error" role="alert"></p>
      ${admin ? '<div class="pie-fijo"><button class="btn prin" type="submit">Guardar</button></div>' : ''}
    </form>`;
  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const plazo = Math.round(Number(e.target.plazo_dias.value));
    if (!(plazo >= 1 && plazo <= 365)) { $('#err', v).textContent = 'El plazo debe estar entre 1 y 365 días.'; return; }
    try { await datos.guardarReglasFiado({ ...cfg, plazo_dias: plazo }); aviso('Reglas del crédito guardadas'); ir('#/ajustes'); }
    catch (x) { $('#err', v).textContent = x.message; }
  });
}

// ---------------------------------------------------------------- Reporte: cuentas por cobrar
export async function vistaCobrar(v) {
  barra({ titulo: 'Cuentas por cobrar', atras: '#/reportes' });
  // Dos cosas por cobrar: créditos pendientes (se pagan con abonos) y notas entregadas sin pago registrado
  // (el pago se registra al entregar; si no se registró, quedan aquí). Las por entregar se cobran al entregarlas.
  const [fm, cs, rs, ped, neg] = await Promise.all([datos.fiadoTodos(), datos.clientes(), datos.rutas(), datos.pedidosEntrega().catch(() => []), datos.configuracion().catch(() => null)]);
  const rutas = rs.filter((r) => !r.especial);
  let ruta = '';
  const cliDe = new Map(cs.map((c) => [c.id, c]));
  const hace = (f) => { const d = Math.max(0, entreDias(diaChile(f), hoyChile())); return d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`; };
  // Recordatorio de cobro por WhatsApp (un toque): saldo, notas, vencimiento y cómo pagar
  const diaRuta = (c) => { const r = rs.find((x) => x.id === c?.ruta_id); return r?.dia_semana ? DIAS[r.dia_semana].toLowerCase() : ''; };
  const mensaje = (c, detalle) => {
    const transf = (neg?.transferencia || []).filter(Boolean);
    const dia = diaRuta(c);
    return [`Hola${c?.contacto ? `, ${c.contacto.split(' ')[0]}` : ''} 👋 Le escribimos de COVECA.`, detalle,
      `Puede pagar en efectivo en la próxima visita${dia ? ` (${dia})` : ''} o por transferencia.`,
      ...(transf.length ? ['', 'Datos para transferencia:', ...transf] : []), '', '¡Gracias por su preferencia!'].join('\n');
  };
  const recordar = (c, detalle) => { const tel = telWhatsApp(c?.telefono);
    return tel ? `<a class="btn sec recordar" data-externo href="https://wa.me/${tel}?text=${encodeURIComponent(mensaje(c, detalle))}">${icono('whatsapp')} Recordar por WhatsApp</a>`
      : `<p class="recordar-sin">${icono('telefono', 'ico-s')} Sin teléfono: agrégalo en la ficha para enviar recordatorios</p>`; };
  const pintar = () => {
    const enRuta = (c) => c && (!ruta || (ruta === 'sin' ? !c.ruta_id : String(c.ruta_id) === ruta));
    const filas = [...fm.values()].filter((f) => f.deuda > 0).map((f) => ({ ...f, c: cliDe.get(f.cliente_id) }))
      .filter((f) => enRuta(f.c))
      .sort((a, b) => b.atrasado - a.atrasado || b.dias_atraso - a.dias_atraso || b.deuda - a.deuda);
    const sinPago = ped.filter((p) => p.entregado_en && datos.porCobrar(p)).map((p) => ({ ...p, c: cliDe.get(p.cliente_id) }))
      .filter((p) => enRuta(p.c)).sort((a, b) => a.entregado_en.localeCompare(b.entregado_en));
    const porEntregar = ped.filter((p) => !p.entregado_en && datos.porCobrar(p) && enRuta(cliDe.get(p.cliente_id)));
    const totalCred = filas.reduce((s, f) => s + f.deuda, 0), atrasado = filas.reduce((s, f) => s + f.atrasado, 0);
    const totalSin = sinPago.reduce((s, p) => s + p.total, 0), total = totalCred + totalSin;
    const quienes = new Set([...filas.map((f) => f.cliente_id), ...sinPago.map((p) => p.cliente_id)]).size;
    const conAtraso = filas.filter((f) => f.atrasado > 0).length;
    const nombreRuta = ruta === 'sin' ? 'Clientes sin ruta' : ruta ? rutas.find((r) => String(r.id) === ruta)?.nombre : 'Todas las rutas';
    const nada = !filas.length && !sinPago.length;
    v.innerHTML = `
      <div class="pad filtro-rep"><label class="campo"><span>Ruta</span><select id="ruta-f">
        <option value="">Todas las rutas</option>
        ${rutas.map((r) => `<option value="${r.id}" ${ruta === String(r.id) ? 'selected' : ''}>${esc(r.nombre)}</option>`).join('')}
        <option value="sin" ${ruta === 'sin' ? 'selected' : ''}>Clientes sin ruta</option></select></label></div>
      ${nada ? vacio('Nadie debe', `${nombreRuta}: no hay créditos pendientes ni notas entregadas sin pago.`) : `
      <div class="resumen fiado-res">
        <div><p class="resumen-n monto">${clp(total)}</p><p>Por cobrar</p></div>
        <div class="${atrasado ? 'alerta' : ''}"><p class="resumen-n monto">${clp(atrasado)}</p><p>Crédito atrasado</p></div>
        <div><p class="resumen-n">${quienes}</p><p>Clientes deben</p></div>
      </div>
      ${accionesHtml()}
      <h2 class="sec-t">Entregadas sin pago · ${sinPago.length} · ${clp(totalSin)}</h2>
      ${sinPago.length ? `<div class="lista">${sinPago.map((p) => `<div class="cobrar-item">
        <a class="fila" href="#/pedidos/${p.id}"><div class="fila-txt">
          <p class="fila-t">${esc(p.c?.nombre || p.cliente)}</p>
          <p class="fila-s">${p.numero ? `Nota N° ${p.numero} · ` : ''}${esc(p.c?.ruta_nombre || 'Sin ruta')} · entregada ${hace(p.entregado_en)}</p>
          <span class="chip visita-sin">${icono('reloj', 'ico-s')} Falta registrar el pago</span></div>
          <span class="monto">${clp(p.total)}</span>${icono('derecha', 'ico-chev')}</a>
        ${recordar(p.c, `Le recordamos que la nota${p.numero ? ` N° ${p.numero}` : ''} por ${clp(p.total)}, entregada el ${diaMes(p.entregado_en)}, está pendiente de pago.`)}</div>`).join('')}</div>`
        : `<p class="texto-suave pad-x">${icono('check', 'ico-s')} Todas las notas entregadas tienen su pago registrado.</p>`}
      <h2 class="sec-t">Créditos pendientes · ${filas.length} · ${clp(totalCred)}</h2>
      ${filas.length ? `<div class="lista">${filas.map((f) => `<div class="cobrar-item">
        <a class="fila" href="#/clientes/${f.cliente_id}"><div class="fila-txt">
          <p class="fila-t">${esc(f.c.nombre)}</p>
          <p class="fila-s">${esc(f.c.ruta_nombre || 'Sin ruta')} · ${plural(f.notas_pendientes, 'nota')}${superaLimite(f.limite_credito, f.deuda) ? ' · <span class="txt-alerta">sobre el límite</span>' : ''}</p>
          ${f.atrasado ? `<span class="chip alerta">${icono('alerta', 'ico-s')} ${clp(f.atrasado)} atrasado · ${plural(f.dias_atraso, 'día')}</span>`
            : f.proximo_vencimiento ? `<span class="chip">Vence ${fecha(f.proximo_vencimiento)}</span>` : ''}</div>
          <span class="monto">${clp(f.deuda)}</span>${icono('derecha', 'ico-chev')}</a>
        ${recordar(f.c, `Le recordamos que tiene un saldo de crédito pendiente de ${clp(f.deuda)}${f.atrasado ? `, de los cuales ${clp(f.atrasado)} ya están vencidos` : f.proximo_vencimiento ? ` que vence el ${fecha(f.proximo_vencimiento)}` : ''}.`)}</div>`).join('')}</div>`
        : `<p class="texto-suave pad-x">${icono('check', 'ico-s')} Nadie debe crédito.</p>`}`}
      ${porEntregar.length ? `<p class="ayuda pad">${plural(porEntregar.length, 'nota')} por entregar (${clp(porEntregar.reduce((s, p) => s + p.total, 0))}): se cobran al entregarlas, no suman aquí.</p>` : ''}`;
    $('#ruta-f', v).addEventListener('change', (e) => { ruta = e.target.value; pintar(); });
    if (nada) return;
    activarAcciones(v, {
      nombre: () => `COVECA-cuentas-por-cobrar-${hoyChile()}.pdf`,
      pdf: async () => {
        const r = await nuevoReporte({ titulo: 'Cuentas por cobrar', subtitulo: `${nombreRuta} · al ${fecha(hoyChile())}` });
        r.resumen([
          { valor: clp(total), etiqueta: 'Por cobrar', color: COLORES.AZUL, grande: true },
          { valor: clp(totalSin), etiqueta: 'Entregadas sin pago' },
          { valor: clp(totalCred), etiqueta: 'Créditos' },
          { valor: clp(atrasado), etiqueta: 'Crédito atrasado', color: atrasado ? COLORES.ROJO_TEXTO : undefined },
        ]);
        if (sinPago.length) {
          r.seccion('Entregadas sin pago', 'Notas entregadas a las que falta registrar el pago (efectivo, transferencia o crédito).');
          r.tabla([{ titulo: 'Cliente' }, { titulo: 'N°', ancho: 16 }, { titulo: 'Ruta', ancho: 28 }, { titulo: 'Entregada', ancho: 24 }, { titulo: 'Monto', ancho: 26, alinear: 'right' }],
            sinPago.map((p) => [p.c?.nombre || p.cliente, p.numero ? String(p.numero) : '—', p.c?.ruta_nombre || 'Sin ruta', fecha(diaChile(p.entregado_en)), clp(p.total)]),
            { pie: ['Total', '', '', '', clp(totalSin)] });
        }
        if (filas.length) {
          r.seccion('Créditos pendientes', `Primero los atrasados. Los abonos pagan primero las notas más antiguas.${conAtraso ? ` ${conAtraso} cliente(s) con atraso.` : ''}`);
          r.tabla([{ titulo: 'Cliente' }, { titulo: 'Ruta', ancho: 28 }, { titulo: 'Notas', ancho: 14, alinear: 'right' }, { titulo: 'Atraso', ancho: 18, alinear: 'right' },
            { titulo: 'Atrasado', ancho: 24, alinear: 'right' }, { titulo: 'Debe', ancho: 24, alinear: 'right' }],
            filas.map((f) => [f.c.nombre, f.c.ruta_nombre || 'Sin ruta', String(f.notas_pendientes), f.dias_atraso ? `${f.dias_atraso} d` : '—', f.atrasado ? clp(f.atrasado) : '—', clp(f.deuda)]),
            { pie: ['Total', '', '', '', clp(atrasado), clp(totalCred)], colorFila: (i, col) => (filas[i].atrasado && col >= 3 ? COLORES.ROJO_TEXTO : null) });
        }
        return r.terminar();
      },
      mensaje: () => `*COVECA – Cuentas por cobrar* · ${nombreRuta}`,
    });
  };
  pintar();
}
