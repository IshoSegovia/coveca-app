import { datos } from '../datos.js';
import { pantalla, ruta, esc, ICONOS, DIAS, ir, aviso, leerFormulario } from '../nucleo.js';
import { cargando, vacio, filaCliente, campo, selector } from './comunes.js';

ruta('/rutas', async () => {
  pantalla({ titulo: 'Rutas', subtitulo: `Hoy es ${DIAS[((new Date().getDay() + 6) % 7) + 1]}`, tab: 'rutas', cuerpo: cargando });
  const [lista, sinRuta] = await Promise.all([datos.listarRutas(), datos.clientesSinRuta()]);
  const hoy = ((new Date().getDay() + 6) % 7) + 1;
  const filas = lista.map((r) => `
    <a class="fila fila-ruta${r.dia_semana === hoy ? ' es-hoy' : ''}" href="#/rutas/${r.id}">
      <span class="fila-texto"><strong>${esc(r.nombre)}</strong>
        <small>${r.dia_semana ? DIAS[r.dia_semana] : 'Sin día'} · ${r.clientes} cliente${r.clientes === 1 ? '' : 's'}${r.dia_semana === hoy ? ' · <b>Hoy</b>' : ''}</small></span>
      <span class="progreso" aria-label="${r.atendidos} de ${r.clientes} atendidos"><b>${r.atendidos}</b>/${r.clientes}</span>
      <span class="fila-chevron">${ICONOS.chevron}</span>
    </a>`).join('');
  pantalla({
    titulo: 'Rutas', subtitulo: `Hoy es ${DIAS[hoy]}`, tab: 'rutas',
    accion: datos.esAdmin() ? { icono: 'mas_simple', etiqueta: 'Nueva ruta', href: '/rutas/nueva' } : null,
    cuerpo: `
      <p class="ayuda-seccion">Atendidos esta semana / clientes de la ruta</p>
      <div class="lista">${filas || vacio('Todavía no hay rutas.')}</div>
      ${sinRuta.length ? `<h2 class="seccion">Clientes sin ruta</h2>
      <div class="lista"><a class="fila" href="#/rutas/sin-ruta">
        <span class="fila-texto"><strong>Sin ruta asignada</strong><small>Asígnales una ruta para verlos en el recorrido</small></span>
        <span class="contador">${sinRuta.length}</span><span class="fila-chevron">${ICONOS.chevron}</span></a></div>` : ''}`,
  });
});

ruta('/rutas/sin-ruta', async () => {
  pantalla({ titulo: 'Sin ruta asignada', atras: '/rutas', cuerpo: cargando });
  const lista = await datos.clientesSinRuta();
  pantalla({
    titulo: 'Sin ruta asignada', subtitulo: `${lista.length} clientes`, atras: '/rutas',
    cuerpo: `<p class="ayuda-seccion">Abre un cliente y edítalo para asignarle una ruta, o crea una ruta nueva y agrégalos desde ahí.</p>
      <div class="lista">${lista.map((c) => filaCliente(c, { estado: false })).join('') || vacio('Todos los clientes tienen ruta.')}</div>`,
  });
});

ruta('/rutas/nueva', () => formularioRuta(null));
ruta('/rutas/:id/editar', async ({ id }) => formularioRuta(await datos.obtenerRuta(id)));

async function formularioRuta(r) {
  const nueva = !r;
  const sinRuta = await datos.clientesSinRuta();
  pantalla({
    titulo: nueva ? 'Nueva ruta' : 'Editar ruta', atras: nueva ? '/rutas' : `/rutas/${r.id}`,
    cuerpo: `<form id="f-ruta" class="formulario" novalidate>
      ${campo({ etiqueta: 'Nombre de la ruta', nombre: 'nombre', valor: r?.nombre, req: true, ayuda: 'Ej.: el nombre de la ciudad o "Lunes".' })}
      ${selector({ etiqueta: 'Día de visita', nombre: 'dia_semana', valor: r?.dia_semana,
        opciones: [[null, 'Sin día fijo'], ...DIAS.slice(1).map((d, i) => [i + 1, d])] })}
      ${sinRuta.length ? `<fieldset class="campo"><legend>Agregar clientes sin ruta</legend>
        <div class="checks">${sinRuta.map((c) => `<label class="check"><input type="checkbox" name="cliente_${c.id}" value="${c.id}"><span>${esc(c.nombre)}</span></label>`).join('')}</div>
      </fieldset>` : ''}
      <p class="error-form" hidden></p>
    </form>`,
    pie: `<button class="boton boton-principal" form="f-ruta">${nueva ? 'Crear ruta' : 'Guardar cambios'}</button>`,
  });
  document.getElementById('f-ruta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = leerFormulario(e.target);
    const ids = Object.entries(f).filter(([k, v]) => k.startsWith('cliente_') && v).map(([k]) => Number(k.slice(8)));
    try {
      const guardada = await datos.guardarRuta({ id: r?.id, nombre: f.nombre, dia_semana: f.dia_semana });
      if (ids.length) await datos.asignarClientesARuta(guardada.id, ids);
      aviso(nueva ? 'Ruta creada' : 'Ruta guardada');
      ir(`/rutas/${guardada.id}`);
    } catch (err) {
      const p = e.target.querySelector('.error-form'); p.textContent = err.message; p.hidden = false;
    }
  });
}

ruta('/rutas/:id', async ({ id }) => {
  pantalla({ titulo: 'Ruta', atras: '/rutas', cuerpo: cargando });
  const [r, lista] = await Promise.all([datos.obtenerRuta(id), datos.clientesDeRuta(id)]);
  if (!r) return ir('/rutas');
  const atendidos = lista.filter((c) => c.atendido).length;
  pantalla({
    titulo: r.nombre, subtitulo: r.dia_semana ? DIAS[r.dia_semana] : 'Sin día fijo', atras: '/rutas',
    accion: datos.esAdmin() ? { icono: 'editar', etiqueta: 'Editar ruta', href: `/rutas/${r.id}/editar` } : null,
    cuerpo: `
      <div class="resumen-ruta">
        <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="${lista.length}" aria-valuenow="${atendidos}">
          <span style="width:${lista.length ? (atendidos / lista.length) * 100 : 0}%"></span></div>
        <p><b>${atendidos} de ${lista.length}</b> clientes atendidos en su ciclo de visita</p>
      </div>
      <div class="lista">${lista.map((c) => filaCliente(c)).join('') || vacio('Esta ruta no tiene clientes todavía.', datos.esAdmin() ? `<a class="boton boton-secundario" href="#/rutas/${r.id}/editar">Agregar clientes</a>` : '')}</div>`,
  });
});
