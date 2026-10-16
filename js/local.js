// Lo que el celular guarda para trabajar sin señal:
//  - copia: rutas, clientes, productos, configuración y compras de lealtad (se renueva con señal);
//  - cola: lo hecho sin señal (pedidos, abonos, visitas, entregas y cobros), en orden, hasta que el servidor lo recibe;
//  - números: bloque de números de nota reservados para este vendedor.
// Todo vive en localStorage (unos pocos cientos de KB para 223 productos y 90 clientes).

const K = { copia: 'coveca-copia', cola: 'coveca-cola', numeros: 'coveca-numeros', perfil: 'coveca-perfil' };

function leer(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }
function guardar(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch (_) { return false; } // sin espacio: la app sigue, solo sin copia nueva
}
const avisar = () => window.dispatchEvent(new Event('coveca:cola'));

// ---------- Perfil del vendedor (para abrir la app sin señal) ----------
export const perfil = () => leer(K.perfil);
export const guardarPerfil = (p) => guardar(K.perfil, p);

// ---------- Copia de datos ----------
export const copia = () => leer(K.copia);
export const hayCopia = () => !!copia();
export function guardarCopia(c) { guardar(K.copia, { ...c, guardada: new Date().toISOString() }); }
// Edad de la copia en minutos (Infinity si no hay)
export function edadCopia() {
  const c = copia();
  return c?.guardada ? (Date.now() - new Date(c.guardada).getTime()) / 60000 : Infinity;
}

// ---------- Cola de lo hecho sin señal ----------
// Pedido: { pedido (lo que se envía a crear_pedido), resumen: { cliente, total }, estado: 'pendiente'|'error', error }
// Abono:  { abono  (lo que se envía a registrar_abono), resumen: { cliente }, estado, error }
// Visita: { visita (lo que se envía a registrar_visita), resumen: { cliente }, estado, error }
// Entrega: { entrega (lo que se envía a marcar_entrega), resumen: { cliente: 'N notas' }, estado, error }
// Cobro:  { cobro (lo que se envía a registrar_cobro), resumen: { cliente, total }, estado, error }
export const cola = () => leer(K.cola, []);
export const colaPedidos = () => cola().filter((x) => x.pedido);
export const colaAbonos = () => cola().filter((x) => x.abono);
export const colaVisitas = () => cola().filter((x) => x.visita);
export const colaEntregas = () => cola().filter((x) => x.entrega);
export const colaCobros = () => cola().filter((x) => x.cobro);
const idDe = (x) => (x.pedido || x.abono || x.visita || x.entrega || x.cobro).id;
function agregar(item) {
  // Un mismo pedido o abono (mismo id) nunca queda dos veces en la cola: se reemplaza.
  const c = cola().filter((x) => idDe(x) !== idDe(item));
  c.push({ ...item, estado: 'pendiente', error: null, en: new Date().toISOString() });
  if (!guardar(K.cola, c)) throw new Error('El celular no tiene espacio para guardar esto. Libera espacio e intenta de nuevo.');
  avisar();
}
export const encolar = (pedido, resumen) => agregar({ pedido, resumen });
export const encolarAbono = (abono, resumen) => agregar({ abono, resumen });
export const encolarVisita = (visita, resumen) => agregar({ visita, resumen });
export const encolarEntrega = (entrega, resumen) => agregar({ entrega, resumen });
export const encolarCobro = (cobro, resumen) => agregar({ cobro, resumen });
export const enCola = (id) => cola().some((x) => idDe(x) === id);
export function quitarDeCola(id) { guardar(K.cola, cola().filter((x) => idDe(x) !== id)); avisar(); }
// Descartar un registro que el servidor rechaza ("con problema"): se borra del celular y no se sube.
// Si es un pedido, también se saca de las entregas guardadas que lo incluían.
export function descartar(id) {
  const c = cola().filter((x) => idDe(x) !== id)
    .map((x) => (x.entrega ? { ...x, entrega: { ...x.entrega, pedidos: x.entrega.pedidos.filter((p) => p !== id) } } : x))
    .filter((x) => !x.entrega || x.entrega.pedidos.length)
    .filter((x) => !x.cobro || x.cobro.pedido_id !== id);
  guardar(K.cola, c); avisar();
}
export function marcarError(id, error) {
  guardar(K.cola, cola().map((x) => (idDe(x) === id ? { ...x, estado: 'error', error } : x))); avisar();
}
export function reintentarErrores() {
  guardar(K.cola, cola().map((x) => ({ ...x, estado: 'pendiente', error: null }))); avisar();
}

// ---------- Números de nota reservados (por usuario) ----------
function numeros(usuario) {
  const n = leer(K.numeros);
  return n && n.usuario === usuario ? n.lista : [];
}
export const numerosLibres = (usuario) => numeros(usuario).length;
export function agregarNumeros(usuario, lista) {
  const todos = [...new Set([...numeros(usuario), ...lista])].sort((a, b) => a - b);
  guardar(K.numeros, { usuario, lista: todos });
}
// Toma el menor número libre; null si no quedan.
export function tomarNumero(usuario) {
  const l = numeros(usuario);
  if (!l.length) return null;
  const [n, ...resto] = l;
  guardar(K.numeros, { usuario, lista: resto });
  return n;
}
// Si el servidor rechazó el pedido por otra razón, el número vuelve al bloque.
export function devolverNumero(usuario, n) { if (n != null) agregarNumeros(usuario, [n]); }
