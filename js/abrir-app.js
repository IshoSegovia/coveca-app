// En el navegador de un celular Android (no en la app), invita a abrir la app COVECA:
// el enlace abre la app si está instalada (coveca://abrir) y, si no, descarga el instalador (APK).
import { esApp } from './nativo.js';
import { icono } from './ui.js';

const APK = 'https://github.com/IshoSegovia/coveca-app/releases/latest/download/coveca.apk';
const CLAVE = 'coveca-abrir-app-oculto';

export function invitarApp() {
  if (esApp || !/Android/i.test(navigator.userAgent)) return;
  try { if (Date.now() < Number(localStorage.getItem(CLAVE) || 0)) return; } catch (_) {}
  const enlace = `intent://abrir#Intent;scheme=coveca;package=cl.coveca.app;S.browser_fallback_url=${encodeURIComponent(APK)};end`;
  const caja = document.createElement('div');
  caja.className = 'abrir-app';
  caja.setAttribute('role', 'region');
  caja.setAttribute('aria-label', 'Abrir la app');
  caja.innerHTML = `<div class="abrir-app-txt"><p class="fila-t">Usa la app COVECA</p>
      <p class="fila-s">En Android, la app imprime por Bluetooth y funciona sin señal. Si no la tienes, se descarga.</p></div>
    <a class="btn sec" href="${enlace}">Abrir la app</a>
    <button type="button" class="barra-btn abrir-app-x" aria-label="Seguir en el navegador">${icono('cerrar')}</button>`;
  caja.querySelector('.abrir-app-x').addEventListener('click', () => {
    try { localStorage.setItem(CLAVE, String(Date.now() + 7 * 864e5)); } catch (_) {}   // no insiste por 7 días
    caja.remove();
  });
  document.body.appendChild(caja);
}
