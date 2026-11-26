// Enlace a la copia digital de la nota (página n.html, migración 0023). Único lugar donde se escribe la dirección.
// Desde el ticket N° 13 (24-10-2026) el enlace ya no va en el mensaje de WhatsApp ni en la imagen que se envía:
// solo lo usan los QR que se escanean desde otro teléfono (pantalla final de impresión y hojas en PDF). Quien
// quiera un QR pide el enlace de forma explícita; nada lo agrega solo.
export const URL_NOTA = 'https://ishosegovia.github.io/coveca-app/n.html#';
const esUuid = (x) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x || ''));
/** Enlace de una nota guardada (id UUID generado en el celular); null si no tiene id. Funciona aunque se haya tomado sin señal. */
export const enlaceNota = (nota) => (esUuid(nota?.id) ? URL_NOTA + nota.id : null);
// Nota de prueba (Ajustes → Impresora) o de ejemplo (modo demostración): no está guardada, el QR abre una nota de ejemplo.
export const ENLACE_PRUEBA = URL_NOTA + 'prueba';
