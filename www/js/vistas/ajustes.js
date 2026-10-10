import { $, esc, barra, aviso, icono } from '../ui.js';
import { temaActual } from './avanzado.js';
import * as datos from '../datos.js';
import { config, buscarImpresoras, esApp } from '../impresora.js';
import { versionLocal, revisarActualizacion } from '../actualizacion.js';

export async function vistaAjustes(v) {
  barra({ titulo: 'Ajustes' });
  const yo = datos.usuario();
  v.innerHTML = `
    <h2 class="sec-t">Usuario</h2>
    <dl class="datos">
      <div class="dato"><dt>Nombre</dt><dd>${esc(yo.nombre)}</dd></div>
      <div class="dato"><dt>Rol</dt><dd>${yo.rol === 'admin' ? 'Administrador' : 'Vendedor'}</dd></div>
      <div class="dato"><dt>Terminal</dt><dd>${esc(yo.terminal)}</dd></div>
    </dl>
    ${datos.esAdmin() ? `<h2 class="sec-t">Administración</h2>
    <div class="lista"><a class="fila" href="#/proveedores">
      <div class="fila-txt"><p class="fila-t">Proveedores</p><p class="fila-s">Contactos y productos de cada proveedor</p></div>
      ${icono('derecha', 'ico-chev')}</a>
      <a class="fila" href="#/lealtad">
      <div class="fila-txt"><p class="fila-t">Programa de lealtad</p><p class="fila-s">Niveles, metas, descuentos y beneficios</p></div>
      ${icono('derecha', 'ico-chev')}</a></div>` : ''}
    <form id="imp" class="form pad">
      <h2 class="sec-t">Impresora</h2>
      <label class="campo"><span>Impresora Bluetooth</span>
        <select id="impresora"><option value="">${esApp ? 'Presiona Buscar' : 'Solo disponible en el celular'}</option></select></label>
      <button id="buscar" type="button" class="btn sec">Buscar impresoras vinculadas</button>
    </form>
    <h2 class="sec-t">Otras opciones</h2>
    <div class="lista"><a class="fila" href="#/ajustes/avanzado">
      <div class="fila-txt"><p class="fila-t">Avanzado</p><p class="fila-s">Apariencia (modo ${temaActual() === 'oscuro' ? 'oscuro' : 'claro'}), impresión y nota de prueba</p></div>
      ${icono('derecha', 'ico-chev')}</a></div>
    <h2 class="sec-t">Versión</h2>
    <dl class="datos">
      <div class="dato"><dt>Instalada</dt><dd>${esc(versionLocal().nombre)}</dd></div>
      <div class="dato"><dt>Vigente</dt><dd id="v-vigente">Revisando…</dd></div>
    </dl>
    <p class="version">COVECA${versionLocal().commit ? ' · ' + esc(versionLocal().commit) : ''}</p>
    <div class="pad"><button id="salir" class="btn peligro">Cerrar sesión</button></div>`;
  datos.versionVigente().then((vv) => {
    const local = versionLocal();
    $('#v-vigente', v).textContent = vv?.nombre ? `${vv.nombre}${vv.codigo > local.codigo && local.codigo ? ' (hay que actualizar)' : local.codigo ? ' ✓ al día' : ''}` : '—';
    revisarActualizacion();
  }).catch(() => { $('#v-vigente', v).textContent = 'Sin conexión para revisar'; });

  const sel = $('#impresora', v);
  const llenar = (lista) => {
    if (!lista.length) return;
    sel.innerHTML = lista.map((d) => `<option value="${esc(d.address)}" ${d.address === config.impresora ? 'selected' : ''}>${esc(d.name)} (${esc(d.address)})</option>`).join('');
    if (!config.impresora) { const rpp = lista.find((d) => /RPP|printer|pos/i.test(d.name)) || lista[0]; sel.value = rpp.address; config.impresora = rpp.address; }
  };
  if (config.impresora) sel.innerHTML = `<option value="${esc(config.impresora)}">${esc(config.impresora)}</option>`;
  sel.addEventListener('change', () => { config.impresora = sel.value; });
  $('#buscar', v).addEventListener('click', async () => {
    try { const l = await buscarImpresoras(); l.length ? llenar(l) : aviso('No hay impresoras vinculadas. Vincúlala en Ajustes > Bluetooth del celular.', 'error'); }
    catch (e) { aviso(e.message, 'error'); }
  });
  if (esApp) buscarImpresoras().then(llenar).catch(() => {});
  $('#salir', v).addEventListener('click', async () => {
    await datos.salir();
    document.body.classList.remove('demo');
    window.dispatchEvent(new CustomEvent('coveca:sesion', { detail: false }));
  });
}
