import { datos } from '../datos.js';
import { pantalla, ruta, esc, ICONOS, ir, aviso, leerFormulario, clp, fecha, DIAS } from '../nucleo.js';
import { cargando, vacio, filaCliente, buscador, campo, selector, dato, etiquetaEstado } from './comunes.js';

let ultimaBusqueda = '';

ruta('/clientes', async () => {
  pantalla({ titulo: 'Clientes', tab: 'clientes', cuerpo: cargando });
  const pintar = async () => {
    const lista = await datos.listarClientes(ultimaBusqueda);
    document.getElementById('lista-clientes').innerHTML =
      lista.map((c) => filaCliente(c, { mostrarRuta: true, estado: false })).join('') || vacio('No hay clientes con esa búsqueda.');
    document.getElementById('total-clientes').textContent = `${lista.length} cliente${lista.length === 1 ? '' : 's'}`;
  };
  pantalla({
    titulo: 'Clientes', tab: 'clientes',
    accion: datos.esAdmin() ? { icono: 'mas_simple', etiqueta: 'Nuevo cliente', href: '/clientes/nuevo' } : null,
    cuerpo: `<div class="barra-busqueda">${buscador('q-clientes', 'Buscar por nombre, RUT o comuna', ultimaBusqueda)}</div>
      <p class="ayuda-seccion" id="total-clientes"></p>
      <div class="lista" id="lista-clientes">${cargando}</div>`,
  });
  let t;
  document.getElementById('q-clientes').addEventListener('input', (e) => {
    ultimaBusqueda = e.target.value; clearTimeout(t); t = setTimeout(pintar, 200);
  });
  pintar();
});

ruta('/clientes/nuevo', () => formularioCliente(null));
ruta('/clientes/:id/editar', async ({ id }) => formularioCliente(await datos.obtenerCliente(id)));

ruta('/clientes/:id', async ({ id }) => {
  pantalla({ titulo: 'Cliente', atras: '/clientes', cuerpo: cargando });
  const [c, pedidos] = await Promise.all([datos.obtenerCliente(id), datos.pedidosDeCliente(id)]);
  if (!c) return ir('/clientes');
  const tel = c.telefono ? c.telefono.replace(/\D/g, '') : '';
  const contacto = [
    c.telefono ? `<a class="accion-rapida" href="tel:${esc(c.telefono)}">${ICONOS.telefono}<span>Llamar</span></a>` : '',
    tel ? `<a class="accion-rapida" href="https://wa.me/${tel}">${ICONOS.whatsapp}<span>WhatsApp</span></a>` : '',
    c.direccion || c.comuna ? `<a class="accion-rapida" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([c.direccion, c.comuna, 'Chile'].filter(Boolean).join(', '))}">${ICONOS.mapa}<span>Mapa</span></a>` : '',
  ].join('');
  pantalla({
    titulo: c.nombre, subtitulo: c.ruta_nombre ? `Ruta ${c.ruta_nombre}` : 'Sin ruta', atras: c.ruta_id ? `/rutas/${c.ruta_id}` : '/clientes',
    accion: datos.esAdmin() ? { icono: 'editar', etiqueta: 'Editar cliente', href: `/clientes/${c.id}/editar` } : null,
    cuerpo: `
      <div class="perfil-cabecera">
        ${etiquetaEstado(c)}
        <span class="perfil-frecuencia">Visita cada ${c.frecuencia_dias} días</span>
      </div>
      ${contacto ? `<div class="acciones-rapidas">${contacto}</div>` : ''}
      ${c.notas ? `<div class="nota-cliente"><strong>Notas</strong><p>${esc(c.notas)}</p></div>` : ''}
      <h2 class="seccion">Datos</h2>
      <dl class="datos">
        ${dato('Razón social', c.razon_social)}${dato('RUT', c.rut)}${dato('Contacto', c.contacto)}
        ${dato('Teléfono', c.telefono)}${dato('Correo', c.correo)}
        ${dato('Dirección', c.direccion)}${dato('Comuna', c.comuna)}
        ${dato('Límite de crédito', c.limite_credito ? clp(c.limite_credito) : null)}
      </dl>
      <h2 class="seccion">Compras</h2>
      ${pedidos.length ? `<div class="lista">${pedidos.slice(0, 10).map((pd) => `
        <div class="fila fila-pedido"><span class="fila-texto"><strong>Nota N° ${pd.numero}</strong>
          <small>${fecha(pd.fecha)} · ${pd.items.length} producto${pd.items.length === 1 ? '' : 's'} · ${esc(pd.forma_pago)}</small></span>
          <span class="num">${clp(pd.total)}</span></div>`).join('')}</div>` : '<p class="ayuda-seccion">Aún no tiene pedidos en la app nueva.</p>'}
      ${c.loyverse_compras ? `<dl class="datos datos-compactos">
        ${dato('Compras en Loyverse', String(c.loyverse_compras))}${dato('Total comprado (Loyverse)', clp(c.loyverse_total))}
        ${dato('Primera compra', fecha(c.loyverse_primera_compra))}${dato('Última compra (Loyverse)', fecha(c.loyverse_ultima_compra))}
      </dl>` : ''}`,
    pie: `<a class="boton boton-principal" href="#/pedido/${c.id}">Generar pedido</a>`,
  });
});

async function formularioCliente(c) {
  const nuevo = !c;
  const rutas = await datos.listarRutas();
  pantalla({
    titulo: nuevo ? 'Nuevo cliente' : 'Editar cliente', subtitulo: nuevo ? '' : c.nombre,
    atras: nuevo ? '/clientes' : `/clientes/${c.id}`,
    cuerpo: `<form id="f-cliente" class="formulario" novalidate>
      <h2 class="seccion">Identificación</h2>
      ${campo({ etiqueta: 'Nombre del cliente', nombre: 'nombre', valor: c?.nombre, req: true, ayuda: 'Como lo conocen en la ruta. Sale en la nota.' })}
      ${campo({ etiqueta: 'Razón social', nombre: 'razon_social', valor: c?.razon_social })}
      ${campo({ etiqueta: 'RUT', nombre: 'rut', valor: c?.rut, ayuda: 'Formato 12.345.678-9. Necesario para facturar en el futuro.' })}
      ${campo({ etiqueta: 'Nombre de contacto', nombre: 'contacto', valor: c?.contacto })}
      <h2 class="seccion">Contacto y ubicación</h2>
      ${campo({ etiqueta: 'Teléfono / WhatsApp', nombre: 'telefono', valor: c?.telefono, tipo: 'tel', modo: 'tel' })}
      ${campo({ etiqueta: 'Correo', nombre: 'correo', valor: c?.correo, tipo: 'email', modo: 'email' })}
      ${campo({ etiqueta: 'Dirección', nombre: 'direccion', valor: c?.direccion })}
      ${campo({ etiqueta: 'Comuna', nombre: 'comuna', valor: c?.comuna })}
      <h2 class="seccion">Ruta y visitas</h2>
      ${selector({ etiqueta: 'Ruta', nombre: 'ruta_id', valor: c?.ruta_id,
        opciones: [[null, 'Sin ruta'], ...rutas.map((r) => [r.id, `${r.nombre}${r.dia_semana ? ' · ' + DIAS[r.dia_semana] : ''}`])] })}
      ${selector({ etiqueta: 'Frecuencia de visita', nombre: 'frecuencia_dias', valor: c?.frecuencia_dias ?? 7,
        opciones: [[7, 'Semanal (7 días)'], [14, 'Quincenal (14 días)'], [21, 'Cada 3 semanas (21 días)'], [30, 'Mensual (30 días)']] })}
      <h2 class="seccion">Crédito y notas</h2>
      ${campo({ etiqueta: 'Límite de crédito ($)', nombre: 'limite_credito', valor: c?.limite_credito || '', tipo: 'number', modo: 'numeric', ayuda: '0 o vacío = no se le vende a crédito.' })}
      <label class="campo"><span>Notas</span><textarea name="notas" rows="3">${esc(c?.notas || '')}</textarea>
        <small>Ej.: horario de recepción, a quién entregar.</small></label>
      <p class="error-form" hidden></p>
    </form>`,
    pie: `<button class="boton boton-principal" form="f-cliente">${nuevo ? 'Crear cliente' : 'Guardar cambios'}</button>`,
  });
  document.getElementById('f-cliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = leerFormulario(e.target);
    f.limite_credito = f.limite_credito || 0;
    try {
      const g = await datos.guardarCliente({ ...(c ? { id: c.id } : {}), ...f });
      aviso(nuevo ? 'Cliente creado' : 'Cambios guardados');
      ir(`/clientes/${g.id}`);
    } catch (err) {
      const p = e.target.querySelector('.error-form'); p.textContent = err.message; p.hidden = false; p.scrollIntoView({ block: 'center' });
    }
  });
}
