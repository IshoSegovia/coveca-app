// Programa de lealtad: configuración de los 4 niveles (solo administradores) y reporte "Clientes por nivel".
import { $, esc, barra, icono, vacio, aviso, ir, clp } from '../ui.js';
import * as datos from '../datos.js';
import * as lealtad from '../lealtad.js';
import { nuevoReporte, COLORES } from '../pdf.js';
import { accionesHtml, activarAcciones } from './reportes.js';

const pctTxt = (n) => `${String(n).replace('.', ',')} %`;
const SEMANAS_MAX = 13; // 90 días ≈ 13 semanas

// ---------------------------------------------------------------- Configuración
export async function vistaProgramaLealtad(v) {
  barra({ titulo: 'Programa de lealtad', atras: '#/ajustes' });
  const cfg = JSON.parse(JSON.stringify(await datos.programaLealtad()));
  const admin = datos.esAdmin();
  const num = (name, valor, o = {}) => `<input name="${name}" type="number" inputmode="${o.dec ? 'decimal' : 'numeric'}" min="0" ${o.max ? `max="${o.max}"` : ''} ${o.step ? `step="${o.step}"` : ''} value="${valor ?? ''}" ${o.dis ? 'disabled' : ''} aria-label="${o.et}">`;
  v.innerHTML = `
    <form id="f" class="form pad" novalidate ${admin ? '' : 'inert'}>
      <label class="check"><input name="activo" type="checkbox" ${cfg.activo ? 'checked' : ''}> Programa activo</label>
      <p class="ayuda">Cada cliente queda en el nivel más alto cuyas <b>dos metas</b> cumple con lo comprado en los últimos ${cfg.dias} días: monto comprado y semanas en que compró. Se recalcula solo con cada nota.</p>
      <label class="campo"><span>Margen mínimo protegido (%)</span>
        ${num('margen', Math.round(cfg.margen_minimo * 100), { max: 50, et: 'Margen mínimo protegido' })}</label>
      <p class="ayuda">El descuento de un nivel nunca deja un producto bajo este margen sobre el precio de venta: precio mínimo = costo ÷ (1 − margen).</p>
      ${cfg.niveles.map((n, i) => `
        <fieldset class="nivel-form nv-${i}" data-i="${i}">
          <h3>${icono('medalla')} Nivel ${i + 1}</h3>
          <label class="campo"><span>Nombre</span><input name="nombre" value="${esc(n.nombre)}" maxlength="20"></label>
          ${i === 0 ? '<p class="ayuda">Nivel de entrada: todos los clientes parten aquí.</p>' : `
          <div class="dos">
            <label class="campo"><span>Compra mínima ($)</span>${num('monto', n.monto, { et: 'Compra mínima', step: 1000 })}</label>
            <label class="campo"><span>Semanas con compra</span>${num('semanas', n.semanas, { max: SEMANAS_MAX, et: 'Semanas con compra' })}</label>
          </div>`}
          <label class="campo"><span>Descuento (%)</span>${num('descuento', n.descuento, { max: 10, step: 0.5, dec: true, et: 'Descuento' })}</label>
          <label class="campo"><span>Beneficios (se muestran en la ficha)</span><input name="beneficios" value="${esc(n.beneficios || '')}" placeholder="Ej.: Fiado hasta 15 días"></label>
        </fieldset>`).join('')}
      <p id="err" class="error" role="alert"></p>
      ${admin ? '<div class="pie-fijo"><button class="btn prin" type="submit">Guardar programa</button></div>' : ''}
    </form>`;

  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, err = $('#err', v);
    const nuevo = { ...cfg, activo: f.activo.checked, margen_minimo: Number(f.margen.value) / 100 };
    nuevo.niveles = [...f.querySelectorAll('.nivel-form')].map((fs, i) => ({
      nombre: fs.querySelector('[name="nombre"]').value.trim(),
      monto: i ? Math.round(Number(fs.querySelector('[name="monto"]').value) || 0) : 0,
      semanas: i ? Math.round(Number(fs.querySelector('[name="semanas"]').value) || 0) : 0,
      descuento: Number(String(fs.querySelector('[name="descuento"]').value).replace(',', '.')) || 0,
      beneficios: fs.querySelector('[name="beneficios"]').value.trim(),
    }));
    const problema = validar(nuevo);
    if (problema) { err.textContent = problema; return; }
    err.textContent = '';
    try { await datos.guardarProgramaLealtad(nuevo); aviso('Programa de lealtad guardado'); ir('#/ajustes'); }
    catch (x) { err.textContent = x.message; }
  });
}

function validar(c) {
  if (!(c.margen_minimo >= 0 && c.margen_minimo <= 0.5)) return 'El margen mínimo debe estar entre 0 y 50 %.';
  const nombres = new Set();
  for (const [i, n] of c.niveles.entries()) {
    if (!n.nombre) return `Escribe el nombre del nivel ${i + 1}.`;
    if (nombres.has(n.nombre.toLowerCase())) return `El nombre "${n.nombre}" está repetido. Cada nivel necesita un nombre distinto.`;
    nombres.add(n.nombre.toLowerCase());
    if (n.descuento < 0 || n.descuento > 10) return `El descuento de ${n.nombre} debe estar entre 0 y 10 %.`;
    if (n.semanas > SEMANAS_MAX) return `${n.nombre}: en 90 días hay como máximo ${SEMANAS_MAX} semanas.`;
    if (i) {
      const a = c.niveles[i - 1];
      if (n.monto < a.monto || n.semanas < a.semanas || (n.monto === a.monto && n.semanas === a.semanas))
        return `${n.nombre} debe pedir más que ${a.nombre}: una compra mínima o semanas mayores, y ninguna menor.`;
      if (n.descuento < a.descuento) return `El descuento de ${n.nombre} no puede ser menor que el de ${a.nombre}.`;
    }
  }
  return '';
}

// ---------------------------------------------------------------- Reporte
export async function vistaReporteLealtad(v) {
  barra({ titulo: 'Clientes por nivel', atras: '#/reportes' });
  const [cfg, compras, clientes] = await Promise.all([datos.programaLealtad(), datos.comprasLealtad(), datos.clientes()]);
  if (!cfg.activo) {
    v.innerHTML = vacio('El programa de lealtad está apagado', 'Actívalo en Ajustes > Programa de lealtad.',
      datos.esAdmin() ? '<a class="btn prin" href="#/lealtad">Ir al programa</a>' : '');
    return;
  }
  const filas = clientes.map((c) => ({ c, e: lealtad.estado(compras.get(c.id), cfg) }));
  const porNivel = cfg.niveles.map((n, i) => filas.filter((f) => f.e.i === i).sort((a, b) => b.e.stats.monto - a.e.stats.monto));
  // Por subir: le falta poco (≤ 25 % del monto del siguiente nivel y como máximo 1 semana con compra)
  const porSubir = filas.filter(({ e }) => e.siguiente && e.stats.compras && e.falta.monto <= e.siguiente.monto * 0.25 && e.falta.semanas <= 1)
    .sort((a, b) => a.e.falta.monto - b.e.falta.monto);
  const porBajar = filas.filter(({ e }) => e.bajaA).sort((a, b) => b.e.i - a.e.i);
  const sinCompras = porNivel[0].filter((f) => !f.e.stats.compras).length;

  const chip = (e) => `<span class="chip nivel nv-${e.i}">${icono('medalla', 'ico-s')} ${esc(e.nivel.nombre)}</span>`;
  const fila = ({ c, e }, sub) => `<a class="fila" href="#/clientes/${c.id}"><div class="fila-txt"><p class="fila-t">${esc(c.nombre)}</p>
      <p class="fila-s">${sub}</p></div>${chip(e)}</a>`;
  const compraTxt = (e) => `<span class="monto">${clp(e.stats.monto)}</span> · ${e.stats.semanas} sem.`;

  v.innerHTML = `
    <div class="resumen">${cfg.niveles.map((n, i) => `<div class="nv-${i}"><p class="resumen-n">${porNivel[i].length}</p><p>${esc(n.nombre)}</p></div>`).join('')}</div>
    ${accionesHtml()}
    <p class="ayuda pad">Según lo comprado en los últimos ${cfg.dias} días. ${sinCompras} cliente${sinCompras === 1 ? '' : 's'} sin compras en ese periodo (quedan en ${esc(cfg.niveles[0].nombre)}).</p>
    <h2 class="sec-t">Por subir · ${porSubir.length}</h2>
    ${porSubir.length ? `<div class="lista">${porSubir.map((f) => fila(f, esc(lealtad.textoFalta(f.e)))).join('')}</div>` : '<p class="ayuda pad">Nadie está cerca del siguiente nivel por ahora.</p>'}
    <h2 class="sec-t">Por bajar en 30 días · ${porBajar.length}</h2>
    ${porBajar.length ? `<div class="lista">${porBajar.map((f) => fila(f, `Si no compra, baja a ${esc(f.e.bajaA.nombre)}`)).join('')}</div>` : '<p class="ayuda pad">Ningún cliente está por bajar de nivel.</p>'}
    ${cfg.niveles.map((n, i) => i).reverse().map((i) => {
      const lista = porNivel[i].filter((f) => f.e.stats.compras);
      return lista.length ? `<h2 class="sec-t">${esc(cfg.niveles[i].nombre)} · ${lista.length}</h2>
        <div class="lista">${lista.map((f) => fila(f, compraTxt(f.e))).join('')}</div>` : '';
    }).join('')}`;

  activarAcciones(v, {
    nombre: () => `COVECA-clientes-por-nivel-${new Date().toISOString().slice(0, 10)}.pdf`,
    texto: () => [`*COVECA – Clientes por nivel*`, ...cfg.niveles.map((n, i) => `${n.nombre}: ${porNivel[i].length}`), '',
      porSubir.length ? '*Por subir*' : '', ...porSubir.map(({ c, e }) => `• ${c.nombre}: ${lealtad.textoFalta(e).replace('Le faltan', 'faltan')}`),
      porBajar.length ? '\n*Por bajar en 30 días*' : '', ...porBajar.map(({ c, e }) => `• ${c.nombre} → ${e.bajaA.nombre}`)].filter((l) => l !== '').join('\n'),
    pdf: async () => {
      const r = await nuevoReporte({ titulo: 'Clientes por nivel', subtitulo: `Programa de lealtad · últimos ${cfg.dias} días` });
      r.resumen(cfg.niveles.map((n, i) => ({ valor: porNivel[i].length, etiqueta: n.nombre })));
      r.seccion('Niveles del programa', `Un cliente alcanza un nivel cuando cumple las dos metas. El descuento nunca baja un producto del margen mínimo (${Math.round(cfg.margen_minimo * 100)} %).`);
      r.tabla([{ titulo: 'Nivel', ancho: 26 }, { titulo: 'Compra mínima', ancho: 30, alinear: 'right' }, { titulo: 'Semanas', ancho: 20, alinear: 'right' },
        { titulo: 'Descuento', ancho: 22, alinear: 'right' }, { titulo: 'Beneficios' }],
      cfg.niveles.map((n) => [n.nombre, clp(n.monto), String(n.semanas), pctTxt(n.descuento), n.beneficios || '']));
      if (porSubir.length) {
        r.seccion('Por subir', 'Les falta poco para el siguiente nivel: buena oportunidad para ofrecerles más en la próxima visita.');
        r.tabla([{ titulo: 'Cliente' }, { titulo: 'Nivel', ancho: 24 }, { titulo: 'Le falta', ancho: 70 }],
          porSubir.map(({ c, e }) => [c.nombre, e.nivel.nombre, lealtad.textoFalta(e).replace(/^Le faltan /, '')]));
      }
      if (porBajar.length) {
        r.seccion('Por bajar en 30 días', 'Si no vuelven a comprar, en 30 días bajan de nivel.');
        r.tabla([{ titulo: 'Cliente' }, { titulo: 'Nivel actual', ancho: 30 }, { titulo: 'Bajaría a', ancho: 30 }],
          porBajar.map(({ c, e }) => [c.nombre, e.nivel.nombre, e.bajaA.nombre]), { colorFila: (f, col) => (col === 2 ? COLORES.AMBAR : null) });
      }
      r.seccion('Clientes con compras', `${sinCompras} cliente(s) sin compras en el periodo no se listan.`);
      const conCompras = [...porNivel].reverse().flat().filter((f) => f.e.stats.compras);
      r.tabla([{ titulo: 'Cliente' }, { titulo: 'Nivel', ancho: 24 }, { titulo: 'Semanas', ancho: 20, alinear: 'right' }, { titulo: 'Compras 90 días', ancho: 34, alinear: 'right' }],
        conCompras.map(({ c, e }) => [c.nombre, e.nivel.nombre, String(e.stats.semanas), clp(e.stats.monto)]));
      return r.terminar();
    },
  });
}
