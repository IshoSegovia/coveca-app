import { datos } from '../datos.js';
import { pantalla, ruta, esc, ICONOS, ir, aviso, esApp } from '../nucleo.js';
import { config, buscarImpresoras, imprimirNota } from '../impresora.js';
import { VELOCIDAD_DEFECTO } from '../impresion-animada.js';

ruta('/mas', async () => {
  const u = await datos.usuarioActual();
  pantalla({
    titulo: 'Más', tab: 'mas',
    cuerpo: `
      <div class="tarjeta-usuario"><strong>${esc(u?.nombre)}</strong><small>${esc(u?.correo)} · ${u?.rol === 'admin' ? 'Administrador' : 'Vendedor'} · ${esc(u?.terminal)}</small></div>
      <div class="lista">
        <a class="fila" href="#/mas/impresora"><span class="fila-icono">${ICONOS.impresora}</span>
          <span class="fila-texto"><strong>Impresora</strong><small>${config.direccion ? 'Configurada' : 'Sin configurar'} · modo ${config.modo === 'imagen' ? 'imagen' : 'texto + logo'}</small></span>
          <span class="fila-chevron">${ICONOS.chevron}</span></a>
        <button class="fila" id="salir"><span class="fila-icono">${ICONOS.salir}</span><span class="fila-texto"><strong>Cerrar sesión</strong></span></button>
      </div>
      ${datos.esDemo ? '<p class="aviso-demo">Versión de muestra: los datos son de ejemplo y los cambios no se guardan al cerrar la app.</p>' : ''}
      <p class="version">COVECA · versión ${esc(document.documentElement.dataset.version || 'desarrollo')}</p>`,
  });
  document.getElementById('salir').addEventListener('click', async () => { await datos.salir(); ir('/ingreso'); });
});

ruta('/mas/impresora', () => {
  pantalla({
    titulo: 'Impresora', atras: '/mas',
    cuerpo: `<form class="formulario" id="f-imp" novalidate>
      <ol class="pasos-ayuda"><li>Enciende la impresora RPP02N.</li><li>Vincúlala en Ajustes del teléfono &gt; Bluetooth (solo la primera vez).</li><li>Búscala aquí, elígela e imprime una prueba.</li></ol>
      <label class="campo"><span>Impresora</span><select id="impresora"><option value="">${config.direccion ? 'Guardada: ' + esc(config.direccion) : 'Sin elegir'}</option></select></label>
      <button type="button" class="boton boton-secundario" id="buscar">Buscar impresoras</button>
      <label class="campo"><span>Modo de impresión</span><select id="modo">
        <option value="texto" ${config.modo === 'texto' ? 'selected' : ''}>Texto + logo (rápido, recomendado)</option>
        <option value="imagen" ${config.modo === 'imagen' ? 'selected' : ''}>Imagen completa</option></select></label>
      <label class="campo"><span>Velocidad de la impresora (mm/s)</span>
        <input id="velocidad" type="number" inputmode="numeric" min="5" max="100" value="${config.velocidad}">
        <small>Sincroniza la animación con el papel. Si la animación termina antes, baja el número. Normal: ${VELOCIDAD_DEFECTO}.</small></label>
      <p class="estado-imp" id="estado-imp" role="status"></p>
    </form>`,
    pie: '<button class="boton boton-principal" id="probar">Imprimir nota de prueba</button>',
  });
  const est = (t, tipo = '') => { const e = document.getElementById('estado-imp'); e.textContent = t; e.className = 'estado-imp ' + tipo; };
  const sel = document.getElementById('impresora');
  sel.addEventListener('change', () => { if (sel.value) config.direccion = sel.value; });
  document.getElementById('modo').addEventListener('change', (e) => { config.modo = e.target.value; });
  document.getElementById('velocidad').addEventListener('change', (e) => { config.velocidad = Number(e.target.value) || VELOCIDAD_DEFECTO; });
  document.getElementById('buscar').addEventListener('click', async () => {
    est('Buscando…');
    try {
      const lista = await buscarImpresoras();
      sel.innerHTML = lista.map((d) => `<option value="${esc(d.address)}" ${d.address === config.direccion || (!config.direccion && /RPP|printer|pos/i.test(d.name)) ? 'selected' : ''}>${esc(d.name)} (${esc(d.address)})</option>`).join('');
      config.direccion = sel.value;
      est(`${lista.length} dispositivo(s). Impresora guardada.`, 'ok');
    } catch (e) { est(e.message, 'error'); }
  });
  document.getElementById('probar').addEventListener('click', async () => {
    const u = await datos.usuarioActual();
    await imprimirNota({
      numero: 0, vendedor: u?.nombre || 'COVECA', terminal: u?.terminal || '', cliente: 'Cliente de prueba',
      fecha: new Date().toLocaleString('es-CL'), pago: 'Efectivo',
      items: [{ nombre: 'Super 8 Oblea Clásica x24', cant: 2, precio: 5990 }, { nombre: 'Alfajor Panchote', cant: 1, precio: 6000 }],
    });
    if (!esApp) aviso('Vista previa (en el celular imprime de verdad)');
  });
});
