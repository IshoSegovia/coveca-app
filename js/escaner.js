// Escáner de código de barras con la cámara. Usa BarcodeDetector del navegador (Android / Chrome);
// donde no existe (iPhone, algunos PC) se puede escribir el código a mano en la misma pantalla.
// leerCodigo() devuelve una promesa con el código leído o null si se cerró.
import { icono, esc } from './ui.js';
import { vibrar } from './anima.js';

const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];
const puedeEscanear = () => 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

export function leerCodigo({ titulo = 'Escanear código' } = {}) {
  return new Promise((listo) => {
    const el = document.createElement('div');
    el.className = 'escaner'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', titulo);
    const conCamara = puedeEscanear();
    el.innerHTML = `
      <video class="escaner-video" playsinline muted ${conCamara ? '' : 'hidden'}></video>
      <div class="escaner-cab"><button type="button" class="escaner-cerrar" aria-label="Cerrar">${icono('cerrar')}</button>
        <div><p class="escaner-s">${conCamara ? 'Apunta al código del producto' : 'Escribe el código'}</p><h2 class="escaner-t">${esc(titulo)}</h2></div></div>
      ${conCamara ? '<div class="escaner-marco" aria-hidden="true"><i class="escaner-laser"></i></div>' : ''}
      <form class="escaner-pie">
        <p class="escaner-msg" role="status">${conCamara ? 'Abriendo la cámara…' : 'Este equipo no lee códigos con la cámara: escríbelo o usa un lector.'}</p>
        <div class="escaner-manual"><input class="escaner-in" inputmode="numeric" placeholder="Código de barras" aria-label="Código de barras" autocomplete="off">
          <button class="btn prin" type="submit">Usar</button></div>
      </form>`;
    document.body.appendChild(el);
    document.getElementById('vista')?.setAttribute('inert', '');
    let flujo = null, activo = true;
    const fin = (codigo) => {
      if (!activo) return; activo = false;
      flujo?.getTracks().forEach((t) => t.stop());
      el.remove(); document.getElementById('vista')?.removeAttribute('inert');
      window.covecaCerrarVisor = null;
      listo(codigo ? String(codigo).trim() : null);
    };
    window.covecaCerrarVisor = () => fin(null);   // botón atrás de Android
    el.querySelector('.escaner-cerrar').onclick = () => fin(null);
    el.querySelector('.escaner-pie').onsubmit = (e) => { e.preventDefault(); const v = el.querySelector('.escaner-in').value.trim(); if (v) fin(v); };
    if (!conCamara) { el.querySelector('.escaner-in').focus(); return; }
    (async () => {
      const msg = el.querySelector('.escaner-msg'), video = el.querySelector('video');
      try {
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
        if (!activo) { flujo.getTracks().forEach((t) => t.stop()); return; }
        video.srcObject = flujo; await video.play();
        const soportados = await BarcodeDetector.getSupportedFormats?.().catch(() => FORMATOS) || FORMATOS;
        const det = new BarcodeDetector({ formats: FORMATOS.filter((f) => soportados.includes(f)) });
        msg.textContent = 'Buscando el código…';
        const buscar = async () => {
          if (!activo) return;
          try {
            const r = await det.detect(video);
            if (r.length) { vibrar(30); return fin(r[0].rawValue); }
          } catch (_) { /* cuadro sin imagen todavía */ }
          setTimeout(buscar, 180);
        };
        buscar();
      } catch (e) {
        msg.textContent = e?.name === 'NotAllowedError'
          ? 'La app no tiene permiso para usar la cámara. Dale permiso en Ajustes del teléfono o escribe el código.'
          : 'No se pudo abrir la cámara. Escribe el código.';
        el.querySelector('.escaner-in').focus();
      }
    })();
  });
}
