import { $, esc, barra, icono, vacio, leerForm, aviso, ir, DIAS, fecha } from '../ui.js';
import * as datos from '../datos.js';

const hoyDia = ((new Date().getDay() + 6) % 7) + 1; // 1 = lunes

export async function vistaRutas(v) {
  barra({ titulo: 'Rutas', sub: DIAS[hoyDia], accion: datos.esAdmin() ? { href: '#/rutas/nueva', icono: 'mas', etiqueta: 'Nueva ruta' } : null });
  const rs = await datos.rutas();
  if (!rs.length) {
    v.innerHTML = vacio('Aún no hay rutas', 'Crea la primera ruta para ordenar a tus clientes.',
      datos.esAdmin() ? '<a class="btn prin" href="#/rutas/nueva">Crear ruta</a>' : '');
    return;
  }
  const deHoy = rs.filter((r) => r.dia_semana === hoyDia);
  const resto = rs.filter((r) => r.dia_semana !== hoyDia);
  const tarjeta = (r) => {
    const pend = r.clientes - r.atendidos;
    return `<a class="fila" href="#/rutas/${r.id}">
      <div class="fila-txt">
        <p class="fila-t">${esc(r.nombre)}</p>
        <p class="fila-s">${r.especial ? 'Clientes por asignar' : (DIAS[r.dia_semana] || 'Sin día')} · ${r.clientes} cliente${r.clientes === 1 ? '' : 's'}</p>
      </div>
      ${r.clientes ? `<span class="chip ${pend ? '' : 'ok'}">${pend ? `${pend} pendiente${pend === 1 ? '' : 's'}` : `${icono('check', 'ico-s')} Completa`}</span>` : ''}
      ${icono('derecha', 'ico-chev')}
    </a>`;
  };
  v.innerHTML = `
    ${deHoy.length ? `<h2 class="sec-t">Hoy</h2><div class="lista">${deHoy.map(tarjeta).join('')}</div>` : ''}
    <h2 class="sec-t">${deHoy.length ? 'Otras rutas' : 'Todas las rutas'}</h2>
    <div class="lista">${resto.map(tarjeta).join('')}</div>`;
}

export async function vistaRuta(v, id) {
  const r = await datos.ruta(id);
  if (!r) return ir('#/rutas');
  const cs = await datos.clientes({ rutaId: id });
  barra({ titulo: r.nombre, sub: r.especial ? 'Clientes por asignar' : DIAS[r.dia_semana] || '', atras: '#/rutas',
    accion: datos.esAdmin() && !r.especial ? { href: `#/rutas/${id}/editar`, icono: 'editar', etiqueta: 'Editar ruta' } : null });
  const pend = cs.filter((c) => !c.atendido), hechos = cs.filter((c) => c.atendido);
  const fila = (c) => `<a class="fila" href="#/clientes/${c.id}">
      <div class="fila-txt"><p class="fila-t">${esc(c.nombre)}</p>
        <p class="fila-s">${esc([c.direccion, c.comuna].filter(Boolean).join(', ') || 'Sin dirección')}</p></div>
      ${c.atendido ? `<span class="chip ok">${icono('check', 'ico-s')} Atendido</span>` : `<span class="chip">Pendiente</span>`}
      ${icono('derecha', 'ico-chev')}</a>`;
  v.innerHTML = cs.length ? `
    <div class="resumen">
      <div><p class="resumen-n">${pend.length}</p><p>Pendientes</p></div>
      <div><p class="resumen-n">${hechos.length}</p><p>Atendidos</p></div>
      <div><p class="resumen-n">${cs.length}</p><p>Clientes</p></div>
    </div>
    ${pend.length ? `<h2 class="sec-t">Pendientes</h2><div class="lista">${pend.map(fila).join('')}</div>` : ''}
    ${hechos.length ? `<h2 class="sec-t">Atendidos</h2><div class="lista">${hechos.map(fila).join('')}</div>` : ''}`
    : vacio('Esta ruta no tiene clientes', 'Asígnale clientes desde el perfil de cada cliente (Editar → Ruta).');
}

export async function vistaRutaForm(v, id) {
  const r = id ? await datos.ruta(id) : { activa: true };
  barra({ titulo: id ? 'Editar ruta' : 'Nueva ruta', atras: id ? `#/rutas/${id}` : '#/rutas' });
  v.innerHTML = `
    <form id="f" class="form pad" novalidate>
      <label class="campo"><span>Nombre de la ruta</span>
        <input name="nombre" required value="${esc(r.nombre || '')}" placeholder="Ej.: Retiro"></label>
      <label class="campo"><span>Día de visita</span>
        <select name="dia_semana" data-num>
          <option value="">Sin día fijo</option>
          ${DIAS.slice(1).map((d, i) => `<option value="${i + 1}" ${r.dia_semana === i + 1 ? 'selected' : ''}>${d}</option>`).join('')}
        </select></label>
      <label class="campo"><span>Orden en la lista</span>
        <input name="orden" type="number" inputmode="numeric" value="${r.orden ?? ''}" placeholder="1, 2, 3…"></label>
      <label class="check"><input name="activa" type="checkbox" ${r.activa !== false ? 'checked' : ''}> Ruta activa</label>
      <p id="err" class="error" role="alert"></p>
      <div class="pie-fijo"><button class="btn prin" type="submit">${id ? 'Guardar cambios' : 'Crear ruta'}</button></div>
    </form>`;
  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = leerForm(e.target);
    if (!d.nombre) { $('#err', v).textContent = 'Escribe un nombre para la ruta.'; return; }
    d.orden = d.orden ?? 0;
    try {
      const g = await datos.guardarRuta(id ? { ...d, id: Number(id) } : d);
      aviso(id ? 'Ruta guardada' : 'Ruta creada');
      ir(`#/rutas/${g.id}`);
    } catch (err) { $('#err', v).textContent = err.message; }
  });
}
