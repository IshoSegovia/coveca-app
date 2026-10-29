// Fotos de los clientes guardadas en el celular (ticket N° 15, 28-10-2026). Desde el 29-10-2026 también las de productos
// activos, para ver el Catálogo, el pedido y el Inventario sin señal (decisión de Francisco).
// El servidor de fotos responde "no guardar en caché" (private, no-cache), así que el navegador vuelve a pedir cada foto
// en cada pantalla: con poca señal algunas no llegan y, sin señal, ninguna. Antes una foto que no cargaba quedaba como
// un cuadro vacío, que se veía igual que una foto borrada.
// Ahora: (1) cada foto de cliente se baja una vez y se guarda en el celular (Cache API, una entrada por dirección: el
// nombre de cada archivo es único y nunca cambia); (2) si una <img data-foto> no carga, se usa la guardada; (3) si no
// hay guardada, se muestra "Foto guardada · sin cargar" (ícono propio, distinto de "sin foto") y se vuelve a intentar
// cuando vuelve la señal. Si el equipo no tiene Cache API, todo sigue como antes (la foto se pide al servidor).
import { icono } from './ui.js';

const CACHE = 'coveca-fotos';
const MAX_FOTOS = 800;        // tope de fotos guardadas (29-10-2026: ~50 de clientes y ~220 de productos; ~70 KB cada una)
const A_LA_VEZ = 3;           // descargas en paralelo al guardar
const TOPE_DESCARGA = 15000;  // ms por foto: una descarga colgada no frena las demás
const ESPERA_FOTO = 5000;     // ms: con señal débil una foto puede quedar cargando sin fallar; entonces se usa la guardada
const ESPERA_MARCA = 10000;   // ms más: sin guardada y aún cargando, se muestra el marcador
const hayCache = () => typeof caches !== 'undefined' && typeof caches.open === 'function';
const blobs = new Map();      // dirección → blob: (una por foto, se reutiliza; se libera al quitarla del celular)

async function guardada(url) {
  if (blobs.has(url)) return blobs.get(url);
  if (!hayCache()) return null;
  try {
    // ignoreVary: la foto se guardó con una petición que llevaba Origin (CORS); al buscarla no importa
    const r = await (await caches.open(CACHE)).match(url, { ignoreVary: true });
    if (!r) return null;
    const b = URL.createObjectURL(await r.blob());
    blobs.set(url, b);
    return b;
  } catch (_) { return null; }
}
function soltar(url) { const b = blobs.get(url); if (b) { URL.revokeObjectURL(b); blobs.delete(url); } }

// Baja y guarda las fotos que faltan, y quita del celular las que ya no se usan (foto cambiada o quitada).
// Se llama al renovar la copia sin señal. Nunca lanza.
let guardando = null;
export function guardarFotos(urls) {
  if (!hayCache() || navigator.onLine === false || guardando) return guardando || Promise.resolve();
  const lista = [...new Set((urls || []).filter((u) => /^https:\/\//.test(u || '')))].slice(0, MAX_FOTOS);
  guardando = (async () => {
    try {
      const c = await caches.open(CACHE);
      const tiene = new Set((await c.keys()).map((r) => r.url));
      for (const u of tiene) if (!lista.includes(u)) { await c.delete(u); soltar(u); }
      const faltan = lista.filter((u) => !tiene.has(u));
      let i = 0;
      const trabajador = async () => {
        while (i < faltan.length) {
          const u = faltan[i++];
          await bajar(c, u);
        }
      };
      await Promise.all(Array.from({ length: A_LA_VEZ }, trabajador));
    } catch (_) { /* almacenamiento lleno o bloqueado: las fotos se siguen pidiendo al servidor */ }
    finally { guardando = null; }
  })();
  return guardando;
}

async function bajar(c, u) {
  const corte = new AbortController(), t = setTimeout(() => corte.abort(), TOPE_DESCARGA);
  try {
    const r = await fetch(u, { mode: 'cors', cache: 'no-store', signal: corte.signal });
    // Solo respuestas completas: una "opaca" no se puede leer después
    if (r.ok && r.type !== 'opaque' && /^image\//.test(r.headers.get('content-type') || '')) await c.put(u, r);
  } catch (_) { /* sin señal, se cortó o tardó demasiado: se intenta en la próxima renovación de la copia */ }
  finally { clearTimeout(t); }
}
// Una foto recién subida: se guarda al tiro, sin esperar la próxima renovación de la copia.
export async function guardarFoto(url) {
  if (!hayCache() || !/^https:\/\//.test(url || '')) return;
  try { const c = await caches.open(CACHE); if (!(await c.match(url, { ignoreVary: true }))) await bajar(c, url); } catch (_) { /* sigue como antes */ }
}

// Cambia una foto que sigue cargando (o no cargó) por la guardada, si existe.
async function usarGuardada(img) {
  if (!img.isConnected || img.dataset.probo || (img.complete && img.naturalWidth > 0)) return false;
  const b = await guardada(img.dataset.foto);
  if (!b || !img.isConnected || (img.complete && img.naturalWidth > 0)) return false;
  img.dataset.probo = '1'; img.src = b;
  return true;
}

// Marcador "Foto guardada · sin cargar": mismo tamaño que la foto (hereda sus clases), ícono propio y texto accesible.
function marcar(img) {
  const s = document.createElement('span');
  s.className = `${img.className} foto-sin-cargar`;
  s.dataset.foto = img.dataset.foto;
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', 'Foto guardada, sin cargar');
  s.title = 'Foto guardada, sin cargar. Se verá con señal.';
  // "Sin cargar" escrito solo en la ficha (foto grande); en listas y grillas basta el ícono
  s.innerHTML = `${icono('sin-cargar')}${img.closest('.perfil-foto, .prod-foto') ? '<span class="fsc-txt">Sin cargar</span>' : ''}`;
  img.replaceWith(s);
}

// Una foto que no carga (el evento "error" de una imagen no sube: se escucha en fase de captura).
document.addEventListener('error', async (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.foto) return;
  if (img.dataset.probo) { marcar(img); return; }   // ya se probó la guardada y tampoco cargó
  if (!(await usarGuardada(img)) && img.isConnected) marcar(img);
}, true);

// Con señal débil una foto puede quedar cargando sin fallar nunca (el síntoma del ticket): sin señal se usa la guardada
// al tiro; con señal, si a los 5 s no terminó, también.
// Si a los 15 s sigue sin cargar y está a la vista (una de abajo puede estar esperando a que se llegue a ella), marcador.
const aLaVista = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; };
function vigilar(img) {
  if (navigator.onLine === false) { usarGuardada(img); return; }
  setTimeout(async () => {
    if (await usarGuardada(img)) return;
    setTimeout(() => { if (img.isConnected && !img.dataset.probo && !img.complete && aLaVista(img)) marcar(img); }, ESPERA_MARCA);
  }, ESPERA_FOTO);
}
new MutationObserver((cambios) => {
  for (const c of cambios) for (const n of c.addedNodes) {
    if (n.nodeType !== 1) continue;
    if (n.matches?.('img[data-foto]')) vigilar(n);
    n.querySelectorAll?.('img[data-foto]').forEach(vigilar);
  }
}).observe(document.documentElement, { childList: true, subtree: true });

// Se vuelven a intentar las que quedaron sin cargar al volver la señal o al volver a la app.
function reintentar() {
  if (navigator.onLine === false) return;
  document.querySelectorAll('.foto-sin-cargar[data-foto]').forEach((s) => {
    const url = s.dataset.foto, prueba = new Image();
    prueba.onload = () => {
      if (!s.isConnected) return;
      const img = document.createElement('img');
      img.className = s.className.replace(/\s*foto-sin-cargar/, '');
      img.src = url; img.dataset.foto = url; img.alt = ''; img.loading = 'lazy';
      s.replaceWith(img);
    };
    prueba.src = url;
  });
}
window.addEventListener('coveca:red', (e) => { if (e.detail) reintentar(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) reintentar(); });
setInterval(() => { if (!document.hidden && document.querySelector('.foto-sin-cargar[data-foto]')) reintentar(); }, 60000);

// Al cerrar sesión se borran del celular.
window.addEventListener('coveca:salir', () => {
  for (const u of [...blobs.keys()]) soltar(u);
  if (hayCache()) caches.delete(CACHE).catch(() => {});
});
