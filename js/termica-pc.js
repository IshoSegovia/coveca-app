// Impresora térmica conectada al PC (Bluetooth o USB) usando el puerto serie del navegador (Web Serial).
// En Windows, al vincular la RPP02N por Bluetooth se crea un "puerto COM"; Chrome o Edge pueden escribirle
// los mismos comandos ESC/POS que usa la app Android. El navegador recuerda el permiso del puerto elegido.

export const hayPuertoSerie = typeof navigator !== 'undefined' && 'serial' in navigator;
let puerto = null;

/** Puerto ya autorizado antes (el navegador lo recuerda), o null. */
export async function puertoGuardado() {
  if (!hayPuertoSerie) return null;
  if (puerto) return puerto;
  const ps = await navigator.serial.getPorts();
  puerto = ps[0] || null;
  return puerto;
}

/** Abre el selector del navegador para elegir el puerto de la impresora. */
export async function elegirPuerto() {
  if (!hayPuertoSerie) throw new Error('Este navegador no puede conectar impresoras térmicas. Usa Google Chrome o Microsoft Edge en el PC.');
  try { puerto = await navigator.serial.requestPort(); }
  catch (e) { if (e.name === 'NotFoundError') throw new Error('No elegiste ningún puerto. Vincula la impresora por Bluetooth en Windows y vuelve a intentar.'); throw e; }
  return puerto;
}

export async function olvidarPuerto() {
  const p = await puertoGuardado();
  try { await p?.forget?.(); } catch (_) {}
  puerto = null;
}

/** Envía comandos ESC/POS (base64) a la térmica. */
export async function imprimirSerie(base64) {
  const p = await puertoGuardado();
  if (!p) throw new Error('Conecta la impresora térmica en Ajustes → Impresora.');
  try { await p.open({ baudRate: 9600 }); }
  catch (e) { if (!/already open/i.test(e.message)) throw new Error('No se pudo abrir la impresora. Revisa que esté encendida y vinculada, y que ninguna otra ventana la esté usando.'); }
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const w = p.writable.getWriter();
  try {
    for (let i = 0; i < bytes.length; i += 512) {        // en bloques, como en la app Android
      await w.write(bytes.subarray(i, i + 512));
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 800));        // deja terminar el envío antes de cerrar
  } finally {
    w.releaseLock();
    try { await p.close(); } catch (_) {}
  }
}
