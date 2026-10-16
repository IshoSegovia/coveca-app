import { $, esc, barra, aviso, icono, guardarAjuste } from '../ui.js';
import { appWhatsApp } from '../pdf.js';
import { temaActual } from './avanzado.js';
import * as datos from '../datos.js';
import { config, buscarImpresoras } from '../impresora.js';
import { esApp } from '../nativo.js';
import { versionLocal, revisarActualizacion, abrirActualizacion } from '../actualizacion.js';
import { esEscritorio } from '../escritorio.js';
import { abrirTour } from '../tour.js';
import { mostrarNovedades } from '../novedades.js';
import { hayPuertoSerie, puertoGuardado, elegirPuerto, olvidarPuerto } from '../termica-pc.js';

export async function vistaAjustes(v) {
  // En el celular se entra con el engranaje de cada pestaña: la flecha vuelve a la pestaña de donde vino (en PC no hay flecha).
  let volver = '#/rutas'; try { volver = sessionStorage.getItem('coveca-ajustes-volver') || volver; } catch (_) {}
  barra({ titulo: 'Ajustes', atras: esEscritorio() ? null : volver });
  const yo = datos.usuario();
  v.innerHTML = `
    <h2 class="sec-t">Usuario</h2>
    <dl class="datos">
      <div class="dato"><dt>Nombre</dt><dd>${esc(yo.nombre)}</dd></div>
      <div class="dato"><dt>Rol</dt><dd>${yo.rol === 'admin' ? 'Administrador' : 'Vendedor'}</dd></div>
      <div class="dato"><dt>Terminal</dt><dd>${esc(yo.terminal)}</dd></div>
    </dl>
    ${datos.esAdmin() ? `<h2 class="sec-t">Administración</h2>
    <div class="lista"><a class="fila" href="#/compras">
      <div class="fila-txt"><p class="fila-t">Compras a proveedores</p><p class="fila-s">Registrar facturas y guías: sube el stock y actualiza costos</p></div>
      ${icono('derecha', 'ico-chev')}</a>
      <a class="fila" href="#/proveedores">
      <div class="fila-txt"><p class="fila-t">Proveedores</p><p class="fila-s">Contactos y productos de cada proveedor</p></div>
      ${icono('derecha', 'ico-chev')}</a>
      <a class="fila" href="#/negocio">
      <div class="fila-txt"><p class="fila-t">Datos de la nota</p><p class="fila-s">Teléfono, datos para transferencia y WhatsApp para copias</p></div>
      ${icono('derecha', 'ico-chev')}</a>
      <a class="fila" href="#/fiado">
      <div class="fila-txt"><p class="fila-t">Reglas del crédito</p><p class="fila-s">Plazo general para pagar las notas a crédito</p></div>
      ${icono('derecha', 'ico-chev')}</a>
      <a class="fila" href="#/lealtad">
      <div class="fila-txt"><p class="fila-t">Programa de lealtad</p><p class="fila-s">Niveles, metas, descuentos y beneficios</p></div>
      ${icono('derecha', 'ico-chev')}</a>
      <a class="fila" href="#/revisiones">
      <div class="fila-txt"><p class="fila-t">Revisiones automáticas</p><p class="fila-s">Informes de seguridad y calidad de cada versión</p></div>
      ${icono('derecha', 'ico-chev')}</a></div>` : ''}
    ${seccionImpresora()}
    ${esApp ? `<div class="form pad"><h2 class="sec-t">WhatsApp</h2>
      <fieldset class="campo"><legend>Enviar notas y reportes por</legend>
        <label class="opcion"><input type="radio" name="wa" value="business"> WhatsApp Business</label>
        <label class="opcion"><input type="radio" name="wa" value="normal"> WhatsApp</label></fieldset>
      <p class="ayuda">Si la elegida no está instalada en este celular, se usa la otra.</p></div>` : ''}
    <h2 class="sec-t">Otras opciones</h2>
    <div class="lista"><a class="fila" href="#/pendientes">
      <div class="fila-txt"><p class="fila-t">Trabajo sin señal</p><p class="fila-s">Pedidos por subir y datos guardados en el celular</p></div>
      ${icono('derecha', 'ico-chev')}</a>
      <button type="button" class="fila fila-btn" id="ver-tour">
      <div class="fila-txt"><p class="fila-t">Cómo funciona la app</p><p class="fila-s">Recorrido de 10 pasos por la app</p></div>
      ${icono('derecha', 'ico-chev')}</button>
      <a class="fila" href="#/ajustes/avanzado">
      <div class="fila-txt"><p class="fila-t">Avanzado</p><p class="fila-s">Apariencia (modo ${temaActual() === 'oscuro' ? 'oscuro' : 'claro'})${esApp || esEscritorio() ? ', impresión y nota de prueba' : ''}</p></div>
      ${icono('derecha', 'ico-chev')}</a></div>
    <h2 class="sec-t">Versión</h2>
    <dl class="datos">
      <div class="dato"><dt>Instalada</dt><dd>${esc(versionLocal().nombre)}</dd></div>
      <div class="dato"><dt>Vigente</dt><dd id="v-vigente">Revisando…</dd></div>
    </dl>
    <div id="actualizar"></div>
    <div id="novedades"></div>
    <p class="version">COVECA${versionLocal().commit ? ' · ' + esc(versionLocal().commit) : ''}</p>
    <div class="pad"><button id="salir" class="btn peligro">Cerrar sesión</button></div>`;
  datos.versionVigente().then((vv) => {
    const local = versionLocal();
    $('#v-vigente', v).textContent = vv?.nombre ? `${vv.nombre}${vv.codigo > local.codigo && local.codigo ? ' (hay que actualizar)' : local.codigo ? ' ✓ al día' : ''}` : '—';
    if (esApp && local.codigo && vv?.codigo > local.codigo) {
      $('#actualizar', v).innerHTML = `<div class="pad"><button id="btn-actualizar" class="btn prin">Actualizar a la versión ${esc(vv.nombre)}</button></div>`;
      $('#btn-actualizar', v).addEventListener('click', () => abrirActualizacion(vv));
    }
    revisarActualizacion();
  }).catch(() => { $('#v-vigente', v).textContent = 'Sin conexión para revisar'; });

  // Novedades de la versión instalada (www/novedades.json)
  fetch('novedades.json').then((r) => r.json()).then((l) => {
    const n = l?.[0]; if (!n?.puntos?.length) return;
    $('#novedades', v).innerHTML = `<details class="elegir-caja"><summary><span>Novedades de esta versión</span></summary>
      <p class="fila-t">${esc(n.titulo || '')}</p><ul class="act-nov">${n.puntos.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      ${n.pasos?.length ? '<button type="button" id="ver-novedades" class="btn sec">Mostrarme lo nuevo</button>' : ''}</details>`;
    $('#ver-novedades', v)?.addEventListener('click', () => mostrarNovedades([n], { cinta: false }));
  }).catch(() => {});
  if (esApp) {
    const wa = appWhatsApp();
    v.querySelectorAll('input[name="wa"]').forEach((r) => { r.checked = r.value === wa;
      r.addEventListener('change', () => { guardarAjuste('coveca-whatsapp', r.value); aviso(r.value === 'business' ? 'Se enviará por WhatsApp Business' : 'Se enviará por WhatsApp'); }); });
  }
  if (esApp) activarBluetooth(v); else if (esEscritorio()) activarPc(v);
  $('#ver-tour', v)?.addEventListener('click', abrirTour);
  $('#salir', v).addEventListener('click', async () => {
    try { await datos.salir(); } catch (e) { aviso(e.message, 'error'); return; }
    document.body.classList.remove('demo');
    window.dispatchEvent(new CustomEvent('coveca:sesion', { detail: false }));
  });
}

// Cada dispositivo ve solo sus opciones: la app Android, la térmica Bluetooth; el PC, impresora normal o
// térmica por puerto serie; el navegador del celular (iPhone), ninguna (la nota se comparte como imagen).
function seccionImpresora() {
  if (esApp) return `<form id="imp" class="form pad">
      <h2 class="sec-t">Impresora</h2>
      <label class="campo"><span>Impresora térmica portátil (Bluetooth)</span>
        <select id="impresora"><option value="">Presiona Buscar</option></select></label>
      <button id="buscar" type="button" class="btn sec">Buscar impresoras vinculadas</button>
    </form>`;
  if (esEscritorio()) return `<form id="imp" class="form pad imp-pc">
      <h2 class="sec-t">Impresora de este PC</h2>
      <fieldset class="opciones"><legend class="sr">Tipo de impresora</legend>
        <label class="opcion"><input type="radio" name="tipo-imp" value="normal" ${config.pc !== 'termica' ? 'checked' : ''}>
          <span class="opcion-txt">Impresora normal<small>Notas en media carta, carta o tira; reportes en hoja</small></span></label>
        <label class="opcion"><input type="radio" name="tipo-imp" value="termica" ${config.pc === 'termica' ? 'checked' : ''}>
          <span class="opcion-txt">Impresora térmica 58 mm<small>La misma RPP02N, conectada al PC por Bluetooth o USB</small></span></label>
      </fieldset>
      <div id="termica-pc" ${config.pc === 'termica' ? '' : 'hidden'}>
        ${hayPuertoSerie ? `<p class="fila-t" id="estado-termica">Revisando…</p>
        <button id="conectar-termica" type="button" class="btn sec">Conectar impresora térmica</button>
        <button id="olvidar-termica" type="button" class="btn link izq" hidden>Desconectar</button>
        <p class="ayuda">En Windows: vincula la impresora en Configuración → Bluetooth (se crea un puerto COM). Luego toca Conectar y elige ese puerto. Los reportes siguen saliendo por la impresora normal.</p>`
        : '<p class="nota-falta">Este navegador no puede conectar impresoras térmicas. Abre la app en Google Chrome o Microsoft Edge.</p>'}
      </div>
    </form>`;
  return `<h2 class="sec-t">Impresora</h2>
    <p class="ayuda pad-x">La impresión térmica se hace desde la app Android o desde el PC. En este teléfono la nota se comparte como imagen.</p>`;
}

function activarPc(v) {
  const caja = $('#termica-pc', v);
  v.querySelectorAll('input[name="tipo-imp"]').forEach((rb) => rb.addEventListener('change', (e) => {
    config.pc = e.target.value; caja.hidden = config.pc !== 'termica';
    aviso(config.pc === 'termica' ? 'Las notas se imprimirán en la térmica' : 'Las notas se imprimirán en la impresora normal');
  }));
  if (!hayPuertoSerie) return;
  const pintar = async () => {
    const p = await puertoGuardado().catch(() => null);
    const info = p?.getInfo?.() || {};
    $('#estado-termica', v).textContent = p ? `✓ Impresora térmica conectada${info.usbProductId ? ' (USB)' : ''}` : 'Sin impresora térmica conectada';
    $('#conectar-termica', v).textContent = p ? 'Cambiar impresora térmica' : 'Conectar impresora térmica';
    $('#olvidar-termica', v).hidden = !p;
  };
  $('#conectar-termica', v).addEventListener('click', async () => {
    try { await elegirPuerto(); aviso('Impresora térmica conectada. Prueba con Ajustes → Avanzado → Imprimir nota de prueba.'); }
    catch (e) { aviso(e.message, 'error'); }
    pintar();
  });
  $('#olvidar-termica', v).addEventListener('click', async () => { await olvidarPuerto(); aviso('Impresora térmica desconectada'); pintar(); });
  pintar();
}

function activarBluetooth(v) {
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
  buscarImpresoras().then(llenar).catch(() => {});
}
