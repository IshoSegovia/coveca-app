import { $, esc, barra, aviso, icono, guardarAjuste } from '../ui.js';
import { appWhatsApp } from '../pdf.js';
import { avisoConKm, AVISO_KM } from './pedidos.js';
import * as datos from '../datos.js';
import { resumenImpresora } from './ajustes-impresora.js';
import { esApp } from '../nativo.js';
import { vibracionActiva, sonidoActivo, activar } from '../sentir.js';
import { versionLocal, revisarActualizacion, abrirActualizacion } from '../actualizacion.js';
import { esEscritorio } from '../escritorio.js';

// Tema claro u oscuro de este equipo (js/tema.js lo aplica al abrir, antes que los estilos).
const CLAVE_TEMA = 'coveca.tema';
const temaActual = () => (document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'oscuro' : 'claro');
function aplicarTema(tema) {
  if (tema === 'oscuro') document.documentElement.setAttribute('data-tema', 'oscuro');
  else document.documentElement.removeAttribute('data-tema');
  try { localStorage.setItem(CLAVE_TEMA, tema); } catch { /* se aplica igual, solo que no se recordará */ }
}

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
    <h2 class="sec-t">Este ${esApp ? 'celular' : 'equipo'}</h2>
    <div class="lista"><a class="fila" href="#/ajustes/impresora" id="fila-impresora">
      <span class="ruta-ico" aria-hidden="true">${icono('impresora')}</span>
      <div class="fila-txt"><p class="fila-t">Impresora</p><p class="fila-s">${esc(resumenImpresora())}</p></div>
      ${icono('derecha', 'ico-chev')}</a></div>
    <div class="form pad" id="apariencia"><h2 class="sec-t">Apariencia</h2>
      <fieldset class="opciones"><legend class="sr">Tema de la app</legend>
        <label class="opcion"><input type="radio" name="tema" value="claro" ${temaActual() === 'claro' ? 'checked' : ''}>
          <span class="opcion-txt">Claro<small>Fondo blanco. Se lee mejor a pleno sol.</small></span></label>
        <label class="opcion"><input type="radio" name="tema" value="oscuro" ${temaActual() === 'oscuro' ? 'checked' : ''}>
          <span class="opcion-txt">Oscuro<small>Cansa menos la vista de noche y puede ahorrar batería.</small></span></label>
      </fieldset>
      <p class="ayuda">Se guarda solo en este equipo. La nota impresa y los PDF no cambian.</p></div>
    <div class="form pad"><h2 class="sec-t">WhatsApp</h2>
      ${esApp ? `<fieldset class="campo"><legend>Enviar notas y reportes por</legend>
        <label class="opcion"><input type="radio" name="wa" value="business"> WhatsApp Business</label>
        <label class="opcion"><input type="radio" name="wa" value="normal"> WhatsApp</label></fieldset>
      <p class="ayuda">Si la elegida no está instalada en este celular, se usa la otra.</p>` : ''}
      <label class="check"><input id="aviso-km" type="checkbox" ${avisoConKm() ? 'checked' : ''}> Decir a cuántos km estás al avisar al cliente</label>
      <p class="ayuda">En Pedidos, "Avisar" le dice al cliente que vas en camino. Con esta opción agrega la distancia aproximada.</p></div>
    <div class="form pad"><h2 class="sec-t">Vibración y sonido</h2>
      <fieldset class="campo"><legend>En este ${esApp ? 'celular' : 'equipo'}</legend>
        ${esApp ? '<label class="opcion"><input type="checkbox" id="aj-vibrar"> Vibrar al usar la app</label>' : ''}
        <label class="opcion"><input type="checkbox" id="aj-sonido"> Sonido en los logros</label></fieldset>
      <p class="ayuda">${esApp ? 'El sonido solo suena si el celular no está en silencio ni en vibración.' : 'Suena en los parlantes del equipo.'}</p></div>
    ${datos.esAdmin() ? `<h2 class="sec-t">Administración</h2>
    <div class="lista"><a class="fila" href="#/negocio">
      <div class="fila-txt"><p class="fila-t">Datos de la nota</p><p class="fila-s">Teléfono y datos para transferencia</p></div>
      ${icono('derecha', 'ico-chev')}</a>
      <a class="fila" href="#/fiado">
      <div class="fila-txt"><p class="fila-t">Reglas del crédito</p><p class="fila-s">Plazo general para pagar las notas a crédito</p></div>
      ${icono('derecha', 'ico-chev')}</a>
      <a class="fila" href="#/revisiones">
      <div class="fila-txt"><p class="fila-t">Revisiones automáticas</p><p class="fila-s">Informes de seguridad y calidad de cada versión</p></div>
      ${icono('derecha', 'ico-chev')}</a></div>
    <p class="ayuda pad-x">Tickets de soporte y Cómo funciona la app están en Soporte; Compras, en Proveedores; Programa de lealtad, en ${esEscritorio() ? 'el menú' : 'Más'}.</p>` : ''}
    <h2 class="sec-t">Otras opciones</h2>
    <div class="lista"><a class="fila" href="#/pendientes">
      <div class="fila-txt"><p class="fila-t">Trabajo sin señal</p><p class="fila-s">Pedidos por subir y datos guardados en el celular</p></div>
      ${icono('derecha', 'ico-chev')}</a></div>
    <h2 class="sec-t">Versión</h2>
    <dl class="datos">
      <div class="dato"><dt>Instalada</dt><dd>${esc(versionLocal().nombre)}${versionLocal().codigo ? ` (${versionLocal().codigo})` : ''}</dd></div>
      <div class="dato"><dt>Vigente</dt><dd id="v-vigente">Revisando…</dd></div>
    </dl>
    <div id="actualizar"></div>
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

  v.querySelectorAll('input[name="tema"]').forEach((r) => r.addEventListener('change', () => {
    aplicarTema(r.value);
    aviso(r.value === 'oscuro' ? 'Modo oscuro activado' : 'Modo claro activado');
  }));
  if (esApp) {
    const wa = appWhatsApp();
    v.querySelectorAll('input[name="wa"]').forEach((r) => { r.checked = r.value === wa;
      r.addEventListener('change', () => { guardarAjuste('coveca-whatsapp', r.value); aviso(r.value === 'business' ? 'Se enviará por WhatsApp Business' : 'Se enviará por WhatsApp'); }); });
  }
  $('#aviso-km', v).addEventListener('change', (e) => { guardarAjuste(AVISO_KM, e.target.checked ? 'si' : 'no');
    aviso(e.target.checked ? 'El aviso dirá a cuántos km estás' : 'El aviso no dirá la distancia'); });
  const vib = $('#aj-vibrar', v), son = $('#aj-sonido', v);
  if (vib) { vib.checked = vibracionActiva(); vib.addEventListener('change', () => { activar('vibracion', vib.checked); aviso(vib.checked ? 'La app vibrará' : 'La app ya no vibrará'); }); }
  son.checked = sonidoActivo();
  son.addEventListener('change', () => { activar('sonido', son.checked); aviso(son.checked ? 'Sonido activado' : 'Sonido desactivado'); });
  $('#salir', v).addEventListener('click', async () => {
    try { await datos.salir(); } catch (e) { aviso(e.message, 'error'); return; }
    document.body.classList.remove('demo');
    window.dispatchEvent(new CustomEvent('coveca:sesion', { detail: false }));
  });
}
