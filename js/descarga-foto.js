// Botón "Descargar" del visor de fotos (ticket N° 16). La foto se baja en silencio al abrir el visor: así, en iPhone,
// el toque llega con el archivo listo y el navegador no rechaza el menú Compartir. Si esa carga falla no se avisa nada
// hasta que se toque "Descargar", que la reintenta.
import { icono, esc } from './ui.js';
import { bajarFoto } from './datos.js';
import { guardarArchivo } from './pdf.js';

const SIN_FOTO = 'No se pudo descargar la foto. Revisa tu señal e intenta de nuevo.';
const SIN_GUARDAR = 'No se pudo guardar la foto. Intenta de nuevo.';

export function activarDescarga(capa, url, nombre) {
  const b = capa.querySelector('.visor-descargar'), err = capa.querySelector('.visor-error');
  const inicial = b.innerHTML;
  let foto = null;
  const bajando = bajarFoto(url).then((f) => { foto = f; }, () => {});
  const listo = () => { b.innerHTML = inicial; b.disabled = false; };

  b.addEventListener('click', async () => {
    err.hidden = true; b.disabled = true;
    if (!foto) {
      b.textContent = 'Preparando…';
      try { await bajando; foto ||= await bajarFoto(url, { exigir: true }); }
      catch (_) { err.textContent = SIN_FOTO; err.hidden = false; listo(); return; }
    }
    if (!capa.isConnected) return;   // cerró el visor mientras se preparaba: no guardar ni abrir nada encima de otra pantalla
    try {
      const donde = await guardarArchivo(foto.base64, nombre, foto.mime);
      if (donde === null) { listo(); return; }   // cerró el menú Compartir sin elegir nada
      // Fijo y desactivado hasta cerrar: en Android el celular abre el archivo encima y un aviso pasajero no se vería
      const texto = /Compartir/.test(donde) ? 'Foto compartida' : donde === 'Descargas' ? 'Descarga iniciada' : `Guardada en ${esc(donde)}`;   // en el navegador no se sabe dónde quedó
      b.innerHTML = `${icono('check')} ${texto}`;
    } catch (e) {
      if (!e?.rechazado) console.error('Guardar foto: no se pudo escribir el archivo');   // el mensaje del sistema puede traer el nombre del archivo
      err.textContent = e?.rechazado ? e.message : SIN_GUARDAR; err.hidden = false; listo();
    }
  });
}
