// Revisa si hay una versión nueva de la app y, si la hay, bloquea el uso hasta actualizar.
// Sin señal no bloquea: la app debe seguir funcionando en ruta.
import { versionVigente } from './datos.js';
import { esc } from './ui.js';

const cap = window.Capacitor;
const esApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const Compartir = esApp ? ((cap.Plugins && cap.Plugins.Compartir) || cap.registerPlugin('Compartir')) : null;
const APK = 'https://github.com/IshoSegovia/coveca-app/releases/latest/download/coveca.apk';

export const versionLocal = () => window.COVECA_VERSION || { codigo: 0, nombre: 'desarrollo' };

export async function revisarActualizacion() {
  const local = versionLocal();
  if (!local.codigo) return;                 // copia de desarrollo o navegador
  let vigente;
  try { vigente = await versionVigente(); } catch (_) { return; } // sin señal: no bloquear
  if (!vigente || !vigente.codigo || vigente.codigo <= local.codigo) { quitarBloqueo(); return; }
  mostrarBloqueo(local, vigente);
}

function quitarBloqueo() { document.querySelector('.act-capa')?.remove(); }

function mostrarBloqueo(local, vigente) {
  if (document.querySelector('.act-capa')) return;
  const capa = document.createElement('div');
  capa.className = 'act-capa';
  capa.setAttribute('role', 'alertdialog');
  capa.setAttribute('aria-labelledby', 'act-t');
  capa.innerHTML = `
    <div class="act-caja">
      <img src="logo-color.png" alt="COVECA" class="act-logo">
      <h2 id="act-t">Hay una versión nueva</h2>
      <p>Para seguir usando la app, instala la versión <b>${esc(vigente.nombre)}</b>. Tienes la ${esc(local.nombre)}.</p>
      ${vigente.notas ? `<p class="act-notas">${esc(vigente.notas)}</p>` : ''}
      <button class="btn prin" id="act-bajar">Descargar e instalar</button>
      <ol class="act-pasos">
        <li>Se descarga el archivo <b>coveca.apk</b>.</li>
        <li>Ábrelo desde la notificación de descarga.</li>
        <li>Toca <b>Actualizar</b>. Tus datos se mantienen.</li>
      </ol>
    </div>`;
  document.body.appendChild(capa);
  capa.querySelector('#act-bajar').addEventListener('click', async () => {
    const url = vigente.url || APK;
    try { esApp ? await Compartir.abrirUrl({ url }) : window.open(url, '_blank'); }
    catch (_) { window.location.href = url; }
  });
}
