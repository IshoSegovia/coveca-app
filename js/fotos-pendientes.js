// Fotos de clientes tomadas sin señal (ticket N° 15, 28-10-2026).
// Antes, si la foto de fachada no se podía subir (sin señal o señal débil), la app mostraba un aviso rojo y la foto se
// perdía: no quedaba en la cola como los pedidos. Ahora queda guardada en el celular (IndexedDB: localStorage es chico
// para imágenes), se ve en la ficha y en la ruta con "Foto por subir" y se sube sola en la próxima sincronización
// (datos.subirFotosPendientes). Una por cliente: la más nueva reemplaza a la anterior.
const BASE = 'coveca-fotos-pendientes', TABLA = 'fotos';
const mapa = new Map();   // id del cliente (texto) → { blob, tomada, url }  (url = blob: para mostrarla)

function abrir() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(TABLA);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
async function operar(modo, fn) {
  const db = await abrir();
  try {
    return await new Promise((ok, mal) => {
      const t = db.transaction(TABLA, modo), r = fn(t.objectStore(TABLA));
      t.oncomplete = () => ok(r?.result);
      t.onerror = () => mal(t.error);
    });
  } finally { db.close(); }
}
const recordar = (id, v) => {
  const antes = mapa.get(id); if (antes) setTimeout(() => URL.revokeObjectURL(antes.url), 5 * 60000);
  mapa.set(id, { ...v, url: URL.createObjectURL(v.blob) });
};

// Al abrir la app se leen las que quedaron guardadas (antes de mostrar la primera pantalla, casi siempre).
export const listas = (async () => {
  if (typeof indexedDB === 'undefined') return;
  try {
    await operar('readonly', (st) => {
      const r = st.openCursor();
      r.onsuccess = () => { const c = r.result; if (c) { recordar(String(c.key), c.value); c.continue(); } };
      return r;
    });
  } catch (_) { /* sin IndexedDB: no hay fotos por subir */ }
})();

// tomada = momento de la foto; también fija el nombre del archivo (<id>/<tomada>.jpg), así un reintento no lo duplica.
// usuario = quien la tomó: solo se sube con su sesión (si otro entra en el equipo, no la sube como propia).
export async function guardarPendiente(clienteId, blob, tomada = Date.now(), usuario = null) {
  await listas;
  const id = String(clienteId), v = { blob, tomada, usuario };
  await operar('readwrite', (st) => st.put(v, id));   // si falla, quien llama avisa que la foto no se guardó
  recordar(id, v);
}
// Con "tomada", solo la quita si sigue siendo esa foto (si mientras se subía se tomó otra, la nueva se queda).
export async function quitarPendiente(clienteId, tomada = null) {
  await listas;
  const id = String(clienteId), antes = mapa.get(id);
  if (!antes || (tomada != null && antes.tomada !== tomada)) return;
  try { await operar('readwrite', (st) => st.delete(id)); } catch (_) { /* se vuelve a intentar al subirla */ }
  mapa.delete(id);
  setTimeout(() => URL.revokeObjectURL(antes.url), 5 * 60000);   // la pantalla abierta puede seguir mostrándola un rato
}
export const fotoPendiente = (clienteId) => mapa.get(String(clienteId)) || null;
export const cuantasPendientes = () => mapa.size;
export const todasPendientes = () => [...mapa.entries()].map(([id, v]) => ({ id, ...v }));
