// Capa de datos: Supabase cuando hay sesión; datos de ejemplo (modo demostración) si no.
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { demo } from './demo.js';
import { PROGRAMA_DEFECTO } from './lealtad.js';
import * as local from './local.js';
import { normal, diaChile as diaDeChile, plural, visitadoHasta, hoyChile, sumarDias, leerAjuste, guardarAjuste } from './ui.js';
import { repartir, vencimiento, diasExtra, PLAZO_DEFECTO } from './fiado.js';
import { anotarServidor, anotarSync, limpiar } from './registro.js';

// Con señal débil una consulta puede quedar colgada: después de 20 s se da por perdida
// y la app sigue con lo guardado en el celular. Un fallo de red se informa como "AbortError"
// para que la librería no reintente 3 veces (eso dejaba cada pantalla ~7 s esperando);
// los reintentos de pedidos los hace la cola.
function fetchConLimite(url, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  opts.signal?.addEventListener('abort', () => ctl.abort());
  const t0 = performance.now(), metodo = String(opts.method || 'GET').toUpperCase(), ruta = rutaCorta(url);
  return fetch(url, { ...opts, signal: ctl.signal })
    .then((r) => { try { anotarRespuesta(metodo, ruta, r, performance.now() - t0); } catch (_) { /* el registro nunca rompe una consulta */ } return r; })
    .catch((e) => {
      anotarServidor({ metodo, ruta, estado: 0, ms: performance.now() - t0 });
      throw e?.name === 'AbortError' ? e : new DOMException(`Failed to fetch (${e?.message || 'sin red'})`, 'AbortError');
    })
    .finally(() => clearTimeout(t));
}
// Para el rastro de los tickets: nombre de la consulta sin parámetros (los filtros pueden llevar lo buscado).
function rutaCorta(url) {
  try {
    const p = new URL(url, location.href).pathname;
    return p.replace(/^\/rest\/v1\//, '').replace(/^\/storage\/v1\/object\/(sign\/)?([^/]+).*$/, 'archivos $2').replace(/^\/auth\/v1\//, 'sesión ');
  } catch (_) { return '?'; }
}
// Si el servidor rechazó, se anota su código y un mensaje corto (sin los valores que a veces trae entre paréntesis).
function anotarRespuesta(metodo, ruta, r, ms) {
  if (r.status < 400) { anotarServidor({ metodo, ruta, estado: r.status, ms }); return; }
  r.clone().json().catch(() => ({})).then((b) => anotarServidor({ metodo, ruta, estado: r.status, ms,
    codigo: b?.code || b?.error || null,
    mensaje: limpiar(String(b?.message || b?.msg || b?.error_description || '').replace(/\([^)]*\)=\([^)]*\)/g, '(…)')).slice(0, 120) || null }));
}
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'coveca-sesion' },
  global: { fetch: fetchConLimite },
});

let modoDemo = false;
let yo = null; // { id, nombre, rol, terminal }

// Utilidades: ids comparados como texto y guardar una fila nueva o editada.
const mismo = (a, b) => String(a) === String(b);
async function guardarFila(tabla, fila) {
  const { id, ...campos } = fila;
  return id
    ? chk(await sb.from(tabla).update(campos).eq('id', id).select().single())
    : chk(await sb.from(tabla).insert(campos).select().single());
}

export const enDemo = () => modoDemo;
export const usuario = () => yo;
export const esAdmin = () => yo?.rol === 'admin';

function chk({ data, error }) {
  if (error) {
    const e = new Error(traducir(error.message));
    e.sinRed = esSinRed(error);
    if (error.code) e.code = error.code;   // para los tickets: código del servidor
    throw e;
  }
  return data;
}
// ¿El error es por falta de señal (y no por una regla del negocio)?
function esSinRed(error) {
  if (navigator.onLine === false) return true;
  const m = `${error?.message || ''} ${error?.name || ''} ${error?.details || ''}`;
  return /Failed to fetch|NetworkError|Network request failed|Load failed|AbortError|aborted|ERR_INTERNET|ERR_NAME|timeout/i.test(m);
}

// ---------------- Señal ----------------
// La app avisa con el evento "coveca:red" cuando cambia entre con y sin señal.
let conRed = navigator.onLine !== false;
export const hayRed = () => conRed;
const sinSenal = () => navigator.onLine === false || !conRed;
function marcarRed(v) {
  if (conRed === v) return;
  conRed = v;
  window.dispatchEvent(new CustomEvent('coveca:red', { detail: v }));
  if (v) sincronizar();
}
window.addEventListener('online', () => revisarRed());
window.addEventListener('offline', () => marcarRed(false));

// ¿Llega el servidor? Consulta liviana y directa (no espera a renovar la sesión), máximo 8 s.
async function probarRed() {
  if (navigator.onLine === false) return false;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_KEY }, signal: ctl.signal, cache: 'no-store' });
    return r.status < 500;
  } catch (_) { return false; } finally { clearTimeout(t); }
}
async function revisarRed() {
  const hay = await probarRed();
  marcarRed(hay);
  return hay;
}
// Sin señal, se revisa cada 30 s si volvió (algunos celulares no avisan).
setInterval(() => { if (!conRed && yo && !modoDemo) revisarRed(); }, 30000);

// Con señal consulta el servidor; sin señal (o si la consulta falla por la red) responde con la copia del celular.
// Señal débil (revisión de rendimiento, 20-10-2026): si el servidor no responde en 6 s y hay copia, se muestra la copia
// en vez de esperar hasta 20 s, y durante 1 minuto las pantallas leen directo de la copia ("señal débil"). Las ventas,
// abonos y demás registros siguen yendo al servidor (o a la cola) como siempre.
const ESPERA_COPIA = 6000, DEBIL_POR = 60000;
let debilHasta = 0;
export const senalDebil = () => Date.now() < debilHasta;
function marcarDebil(v) {
  const antes = senalDebil();
  debilHasta = v ? Date.now() + DEBIL_POR : 0;
  if (antes !== v) window.dispatchEvent(new CustomEvent('coveca:red', { detail: conRed }));
  if (v) setTimeout(() => { if (!senalDebil()) window.dispatchEvent(new CustomEvent('coveca:red', { detail: conRed })); }, DEBIL_POR + 50);
}
// Registros que también funcionan sin señal (venta, abono, visita, entrega, cobro): si el servidor no responde en
// 8 s se da por "sin señal" y el registro queda en la cola del celular. Es seguro aunque el servidor sí lo haya recibido:
// cada registro lleva su id y el servidor no lo duplica al subirlo de nuevo.
const ESPERA_REGISTRO = 8000;
const enVuelo = new Set();   // ids de registros cuyo primer envío sigue en camino: la cola no los sube en paralelo
function rpcConTope(nombre, args) {
  let reloj;
  const id = args?.p?.id;
  const tope = new Promise((_, mal) => { reloj = setTimeout(() => { marcarDebil(true); mal(Object.assign(new Error('Sin respuesta del servidor'), { sinRed: true })); }, ESPERA_REGISTRO); });
  if (id) enVuelo.add(id);
  // Promise.resolve: la consulta de supabase-js se dispara cada vez que alguien le pide el resultado (.then);
  // así se envía una sola vez y todos esperan la misma respuesta.
  const llamada = Promise.resolve(sb.rpc(nombre, args));
  llamada.then(() => enVuelo.delete(id), () => enVuelo.delete(id));
  return Promise.race([llamada, tope]).finally(() => clearTimeout(reloj));
}
async function conCopia(enLinea, sinLinea) {
  const hay = local.hayCopia();
  if ((sinSenal() || senalDebil()) && hay) { if (sinSenal()) marcarRed(false); return sinLinea(local.copia()); }
  let consulta = null, reloj = null;
  try {
    consulta = enLinea();
    const r = hay ? await Promise.race([consulta, new Promise((_, mal) => { reloj = setTimeout(() => mal(Object.assign(new Error('lento'), { lento: true })), ESPERA_COPIA); })])
      : await consulta;
    marcarRed(true);
    return r;
  } catch (e) {
    if (e.lento) { consulta.catch(() => {}); marcarDebil(true); return sinLinea(local.copia()); }
    if (e.sinRed && hay) { marcarRed(false); return sinLinea(local.copia()); }
    throw e;
  } finally { clearTimeout(reloj); }
}
function traducir(m) {
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/rate limit|too many requests|over_request_rate_limit|for security purposes/i.test(m)) return 'Demasiados intentos seguidos. Por seguridad, espera unos minutos y vuelve a intentar.';
  if (/Email not confirmed/i.test(m)) return 'Este correo aún no está confirmado. Pide al administrador que revise tu usuario.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sin conexión a internet. Revisa la señal e intenta de nuevo.';
  if (/sin permiso|permission|row-level security|Unauthorized/i.test(m)) return 'Tu usuario no tiene permiso para esta acción.';
  if (/no está en Chile/i.test(m)) return m;
  if (/Payload too large|exceeded/i.test(m)) return 'La foto es demasiado pesada. Prueba con otra.';
  if (/duplicate key.*rutas_nombre/i.test(m)) return 'Ya existe una ruta con ese nombre.';
  if (/duplicate key.*productos_ref/i.test(m)) return 'Ya existe un producto con esa REF.';
  if (/duplicate key.*proveedores_nombre/i.test(m)) return 'Ya existe un proveedor con ese nombre.';
  if (/duplicate key.*categorias_nombre/i.test(m)) return 'Ya existe una categoría con ese nombre.';
  if (/duplicate key.*(rut|loyverse)/i.test(m)) return 'Ya existe un cliente con ese dato (RUT o código). Búscalo en Clientes.';
  if (/out of range|numeric field overflow/i.test(m)) return 'Hay un número demasiado grande (cantidad, precio o monto). Revisa lo que escribiste.';
  if (/JWT expired|invalid JWT|refresh token|session.*(missing|expired)/i.test(m)) return 'Tu sesión venció. Cierra la app, vuelve a abrirla con señal e intenta de nuevo.';
  if (/violates check constraint/i.test(m)) return 'Hay un dato que no es válido (por ejemplo, un número negativo). Revisa el formulario.';
  if (/invalid input syntax|malformed|value too long/i.test(m)) return 'Hay un dato con un formato que no es válido. Revisa lo que escribiste.';
  if (/duplicate key/i.test(m)) return 'Ese registro ya existe.';
  if (/^[\x00-\x7F]+$/.test(m) && !/[áéíóúñ¿¡]/i.test(m) && /\b(the|of|not|is|for|to|failed|error|invalid)\b/i.test(m))
    return `No se pudo completar la acción. Intenta de nuevo; si sigue, envía a soporte este mensaje: ${m}`;
  return m;
}

// ---------------- Sesión ----------------
export async function iniciar() {
  if (localStorage.getItem('coveca-demo') === '1') { modoDemo = true; yo = demo.yo; return true; }
  const guardado = local.perfil();
  let sesion = null;
  // Si la sesión venció y no hay internet, renovarla puede tardar ~30 s: se espera máximo 3 s.
  const lenta = Symbol('lenta');
  const r = await Promise.race([sb.auth.getSession().catch(() => null), new Promise((ok) => setTimeout(() => ok(lenta), 3000))]);
  if (r === lenta) {
    if (guardado && localStorage.getItem('coveca-sesion')) return entrarSinRed(guardado);
    sesion = (await sb.auth.getSession().catch(() => null))?.data?.session || null;
  } else sesion = r?.data?.session || null;
  if (!sesion) {
    // Sin señal la sesión no se puede renovar, pero sigue guardada en el celular: se entra con el perfil guardado.
    if (!guardado || !localStorage.getItem('coveca-sesion')) return false;
    return (await probarRed()) ? false : entrarSinRed(guardado);
  }
  // Con el perfil ya guardado en este equipo se entra de inmediato y se revisa en segundo plano (rol, activo):
  // ahorra una espera al abrir la app. Si el usuario fue desactivado, la revisión cierra la sesión.
  if (guardado?.id === sesion.user.id) {
    yo = guardado;
    cargarPerfil(sesion.user.id).catch((e) => {
      // Sin red: queda "sin señal" (así la revisión de cada 30 s sincroniza cuando vuelva).
      if (e.sinRed) { marcarRed(false); return; }
      // Usuario desactivado o sesión inválida: al ingreso, como antes.
      console.error(e);
      window.dispatchEvent(new CustomEvent('coveca:sesion', { detail: false }));
    });
    return true;
  }
  try { return await cargarPerfil(sesion.user.id); }
  catch (e) {
    if (e.sinRed && guardado?.id === sesion.user.id) return entrarSinRed(guardado);
    throw e;
  }
}
function entrarSinRed(p) {
  yo = p; marcarRed(false);
  return true;
}
async function cargarPerfil(id) {
  const v = chk(await sb.from('vendedores').select('id,nombre,rol,terminal,activo').eq('id', id).maybeSingle());
  if (!v || !v.activo) { await sb.auth.signOut(); throw new Error('Tu usuario no está activo. Pide a un administrador que lo active.'); }
  yo = v;
  local.guardarPerfil(v);
  marcarRed(true);
  // Sube lo pendiente, reserva números y renueva la copia. Si el celular ya tiene copia y números, espera a que se
  // muestre la primera pantalla; si le falta algo para vender sin señal, lo hace de inmediato.
  const listo = local.hayCopia() && local.numerosLibres(v.id) >= 20 && !local.cola().length;
  setTimeout(sincronizar, listo ? 2500 : 300);
  return true;
}
export async function entrar(correo, clave) {
  const d = chk(await sb.auth.signInWithPassword({ email: correo, password: clave }));
  return cargarPerfil(d.user.id);
}
export function entrarDemo() { localStorage.setItem('coveca-demo', '1'); modoDemo = true; yo = demo.yo; }
export async function salir() {
  localStorage.removeItem('coveca-demo');
  if (!modoDemo) {
    const n = local.cola().length;
    if (n) throw new Error(`Hay ${n} registro${n === 1 ? "" : "s"} (pedidos o abonos) sin subir. Súbelos (con señal) antes de cerrar sesión.`);
    await sb.auth.signOut();
  }
  modoDemo = false; yo = null;
  window.dispatchEvent(new Event('coveca:salir'));   // borra las capturas de pantalla guardadas para los tickets
}

// ---------------- Rutas ----------------
export async function rutas() {
  if (modoDemo) return demo.rutas();
  return conCopia(async () => {
    const [rs, cs] = await Promise.all([
      sb.from('rutas').select('*').order('orden').order('nombre').then(chk),
      sb.from('clientes_estado').select('id,ruta_id,atendido,frecuencia_dias').eq('activo', true).then(chk)]);
    return conConteo(rs, conPendientes(cs));
  }, (c) => conConteo(c.rutas, conPendientes(alDia(c.clientes.filter((x) => x.activo)))));
}
function conConteo(rs, cs) {
  const lista = rs.map((r) => {
    const suyos = cs.filter((c) => c.ruta_id === r.id);
    return { ...r, clientes: suyos.length, atendidos: suyos.filter((c) => c.atendido).length };
  });
  const sin = cs.filter((c) => !c.ruta_id);
  if (sin.length) lista.push({ id: 'sin', nombre: 'Sin ruta', clientes: sin.length, atendidos: sin.filter((c) => c.atendido).length, especial: true });
  return lista;
}
export async function ruta(id) {
  if (id === 'sin') return { id: 'sin', nombre: 'Sin ruta', especial: true };
  if (modoDemo) return demo.ruta(id);
  return conCopia(async () => chk(await sb.from('rutas').select('*').eq('id', id).single()),
    (c) => c.rutas.find((r) => mismo(r.id, id)) || null);
}
export async function guardarRuta(r) {
  if (modoDemo) return demo.guardarRuta(r);
  return guardarFila('rutas', r);
}

// ---------------- Clientes ----------------
const CAMPOS_LISTA = 'id,imagen_url,lat,lng,nombre,razon_social,rut,comuna,direccion,ruta_id,ruta_nombre,frecuencia_dias,atendido,visita_sin_pedido,visita_cotizacion,datos_pendientes,ultima_compra,telefono,activo,orden_ruta';
// inactivos: true = también los desactivados (pestaña Clientes); las rutas y pedidos solo usan activos.
export async function clientes({ busqueda = '', rutaId = null, inactivos = false } = {}) {
  if (modoDemo) return demo.clientes({ busqueda, rutaId, inactivos });
  let q = sb.from('clientes_estado').select(CAMPOS_LISTA);
  if (!inactivos) q = q.eq('activo', true);
  if (rutaId === 'sin') q = q.is('ruta_id', null);
  else if (rutaId) q = q.eq('ruta_id', rutaId);
  // La búsqueda se hace en el celular, sin importar acentos ni mayúsculas (María = Maria), con o sin señal.
  const b = normal(busqueda);
  const coincide = (x) => !b || normal([x.nombre, x.razon_social, x.rut, x.comuna].join(' ')).includes(b);
  return conCopia(async () => conPendientes(chk(await q.order('orden_ruta').order('nombre')).filter(coincide)), (c) => {
    return conPendientes(alDia(c.clientes.filter((x) => (inactivos || x.activo)
      && (rutaId === 'sin' ? !x.ruta_id : !rutaId || mismo(x.ruta_id, rutaId))
      && coincide(x))))
      .sort((a, z) => (a.orden_ruta ?? Infinity) - (z.orden_ruta ?? Infinity) || a.nombre.localeCompare(z.nombre));
  });
}
export async function cliente(id) {
  if (modoDemo) return demo.cliente(id);
  return conCopia(async () => conPendientes([chk(await sb.from('clientes_estado').select('*').eq('id', id).single())])[0],
    (c) => {
      const x = c.clientes.find((k) => mismo(k.id, id));
      if (!x) throw new Error('Este cliente no está guardado en el celular. Ábrelo cuando tengas señal.');
      return conPendientes(alDia([x]))[0];
    });
}
export async function guardarCliente(c) {
  if (modoDemo) return demo.guardarCliente(c);
  return guardarFila('clientes', c);
}
// Sube una foto ya preparada (fotos.js). El servidor solo acepta imágenes de hasta 1 MB (migración 0025).
const MAX_FOTO = 1024 * 1024;
async function subirFoto(carpeta, ruta, blob) {
  const malo = 'La foto no se pudo subir: debe ser una imagen de menos de 1 MB. Prueba con otra foto.';
  if (!blob || !/^image\//.test(blob.type || 'image/jpeg') || blob.size > MAX_FOTO) throw new Error(malo);
  const { error } = await sb.storage.from(carpeta).upload(ruta, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) { if (/size|mime|type|payload/i.test(error.message || '')) throw new Error(malo); chk({ error }); }
  return sb.storage.from(carpeta).getPublicUrl(ruta).data.publicUrl;
}
export async function subirFotoCliente(clienteId, blob) {
  if (modoDemo) return demo.fotoCliente(clienteId, URL.createObjectURL(blob));
  const ruta = `${clienteId}/${Date.now()}.jpg`;
  const url = await subirFoto('clientes', ruta, blob);
  chk(await sb.rpc('foto_cliente', { p_id: Number(clienteId), p_url: url }));
  return url;
}
export async function quitarFotoCliente(clienteId) {
  if (modoDemo) return demo.fotoCliente(clienteId, null);
  chk(await sb.rpc('foto_cliente', { p_id: Number(clienteId), p_url: null }));
}
// Elimina los datos personales de un cliente que lo pidió (migración 0026): borra sus fotos y lo anonimiza.
// Sus notas y montos se conservan como "Cliente eliminado N° id". Solo admin y con señal. No se puede deshacer.
export async function eliminarDatosCliente(clienteId) {
  if (modoDemo) return demo.anonimizarCliente(clienteId);
  if (sinSenal()) throw new Error('Eliminar los datos de un cliente necesita señal. Intenta cuando tengas internet.');
  const carpeta = String(Number(clienteId));
  const { data: fotos } = await sb.storage.from('clientes').list(carpeta, { limit: 100 });
  if (fotos?.length) chk(await sb.storage.from('clientes').remove(fotos.map((f) => `${carpeta}/${f.name}`)));
  chk(await sb.rpc('anonimizar_cliente', { p_id: Number(clienteId) }));
}
export async function guardarUbicacion(clienteId, lat, lng) {
  if (modoDemo) return demo.ubicacion(clienteId, lat, lng);
  chk(await sb.rpc('ubicacion_cliente', { p_id: Number(clienteId), p_lat: lat, p_lng: lng }));
}
export async function ordenarRuta(ids) {
  if (modoDemo) return demo.ordenar(ids);
  chk(await sb.rpc('ordenar_ruta', { p_ids: ids }));
}
export async function pedidosCliente(id) {
  if (modoDemo) return demo.pedidosCliente(id);
  const enCola = local.colaPedidos().filter((x) => mismo(x.pedido.cliente_id, id))
    .map((x) => ({ id: x.pedido.id, numero: x.pedido.numero, fecha: x.pedido.fecha, total: x.resumen.total, forma_pago: x.pedido.forma_pago, estado: 'generado', porSubir: true }))
    .reverse();
  const delServidor = await conCopia(
    async () => chk(await sb.from('pedidos').select('id,numero,fecha,total,estado,forma_pago').eq('cliente_id', id).order('fecha', { ascending: false }).limit(20)),
    (c) => (c.pedidos || []).filter((p) => mismo(p.cliente_id, id)).slice(0, 20));
  return [...enCola, ...delServidor.filter((p) => !enCola.some((q) => q.id === p.id))];
}

// Último pedido y lo que el cliente suele comprar (notas vigentes de 90 días: servidor, copia sin señal o cola).
// "Suele comprar" = productos que pidió en 2 o más notas, con la cantidad que más pide (mediana).
export async function habitosCliente(id) {
  const desde = new Date(Date.now() - 90 * 864e5).toISOString();
  const conItems = (p) => ({ ...p, items: p.items || p.pedido_items || [] });
  const peds = modoDemo ? demo.pedidosCliente(id).map(conItems)
    : await conCopia(async () => chk(await sb.from('pedidos').select('id,numero,fecha,total,estado,pedido_items(producto_id,cantidad)')
        .eq('cliente_id', id).neq('estado', 'anulado').gte('fecha', desde).order('fecha', { ascending: false }).limit(30)).map(conItems),
      (c) => (c.pedidos || []).filter((p) => mismo(p.cliente_id, id)).map(conItems));
  const cola = local.colaPedidos().filter((x) => mismo(x.pedido.cliente_id, id))
    .map((x) => ({ id: x.pedido.id, numero: x.pedido.numero, fecha: x.pedido.fecha, total: x.resumen.total, items: x.pedido.items || [] }));
  const todos = [...cola, ...peds.filter((p) => !cola.some((q) => q.id === p.id))]
    .filter((p) => p.estado !== 'anulado' && p.items.length).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  // Por producto: en cuántas notas aparece y las cantidades pedidas
  const cuenta = new Map();
  for (const p of todos) {
    for (const pid of new Set(p.items.map((i) => i.producto_id))) {
      const x = cuenta.get(pid) || { producto_id: pid, veces: 0, cants: [] };
      x.veces++;
      x.cants.push(p.items.filter((i) => i.producto_id === pid).reduce((t, i) => t + (Number(i.cantidad) || 0), 0));
      cuenta.set(pid, x);
    }
  }
  const mediana = (a) => { const s = [...a].sort((x, y) => x - y); return Math.max(1, s[Math.floor((s.length - 1) / 2)]); };
  const habituales = [...cuenta.values()].filter((x) => x.veces >= 2).sort((a, b) => b.veces - a.veces)
    .slice(0, 6).map((x) => ({ producto_id: x.producto_id, veces: x.veces, cantidad: mediana(x.cants) }));
  return { ultimo: todos[0] || null, habituales };
}

// ---------------- Categorías y proveedores ----------------
export async function categorias() {
  if (modoDemo) return demo.categorias();
  return chk(await sb.from('categorias').select('*').order('nombre'));
}
// El servidor entrega como máximo 1.000 filas por consulta: para contar bien se piden por tandas (con orden fijo).
const POR_TANDA = 1000;
export async function todasLasFilas(armar) {
  const filas = [];
  for (let desde = 0; ; desde += POR_TANDA) {
    const r = chk(await armar().range(desde, desde + POR_TANDA - 1));
    filas.push(...r);
    if (r.length < POR_TANDA) return filas;
  }
}

export async function proveedores() {
  if (modoDemo) return demo.proveedores();
  const [ps, cuentas] = await Promise.all([
    sb.from('proveedores').select('*').order('nombre').then(chk),
    todasLasFilas(() => sb.from('productos').select('proveedor_id,proveedor_respaldo_id').or('proveedor_id.not.is.null,proveedor_respaldo_id.not.is.null').order('id'))]);
  return ps.map((p) => ({ ...p, productos: cuentas.filter((c) => c.proveedor_id === p.id).length,
    respaldo: cuentas.filter((c) => c.proveedor_respaldo_id === p.id).length }));
}
export async function proveedor(id) {
  if (modoDemo) return demo.proveedor(id);
  return chk(await sb.from('proveedores').select('*').eq('id', id).single());
}
export async function productosDeProveedor(id) {
  if (modoDemo) return demo.productosDeProveedor(id);
  const r = chk(await sb.from('productos').select('id,nombre,stock,precio,activo,proveedor_id,proveedor_respaldo_id')
    .or(`proveedor_id.eq.${Number(id)},proveedor_respaldo_id.eq.${Number(id)}`).order('nombre'));
  return r.map((p) => ({ ...p, rol: p.proveedor_id === Number(id) ? 'principal' : 'respaldo' }));
}
export async function guardarProveedor(p) {
  if (modoDemo) return demo.guardarProveedor(p);
  return guardarFila('proveedores', p);
}

// ---------------- Productos / inventario ----------------
export async function productos({ busqueda = '', soloActivos = true } = {}) {
  if (modoDemo) return demo.productos({ busqueda });
  let q = sb.from('productos').select(CAMPOS_PRODUCTO);
  if (soloActivos) q = q.eq('activo', true);
  const b = normal(busqueda);   // en el celular, sin importar acentos ni mayúsculas
  const coincide = (p) => !b || normal(p.nombre + ' ' + (p.ref || '') + ' ' + (p.marca || '') + ' ' + (p.codigo_barras || '')).includes(b);
  return conCopia(async () => stockConPendientes(chk(await q.order('nombre')).map(conNombres).filter(coincide)), (c) => {
    return stockConPendientes(c.productos.filter((p) => (!soloActivos || p.activo) && coincide(p)));
  });
}
const CAMPOS_PRODUCTO = 'id,ref,codigo_barras,nombre,marca,costo,precio,stock,stock_minimo,activo,imagen_url,categoria_id,categorias(nombre),proveedor_id,proveedor_respaldo_id,proveedores!productos_proveedor_id_fkey(nombre)';
const conNombres = (p) => ({ ...p, categoria: p.categorias?.nombre || null, proveedor: p.proveedores?.nombre || null });
// Marcas ya usadas (para sugerirlas al escribir y que queden siempre igual).
export async function marcas() {
  if (modoDemo) return demo.marcas();
  const r = chk(await sb.from('productos').select('marca').not('marca', 'is', null));
  return [...new Set(r.map((x) => x.marca.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}
export async function producto(id) {
  if (modoDemo) return demo.producto(id);
  return chk(await sb.from('productos').select('*').eq('id', id).single());
}
export async function guardarProducto(p) {
  if (modoDemo) return demo.guardarProducto(p);
  const { stock_inicial, ...fila } = p;
  const r = await guardarFila('productos', { ...fila, actualizado_en: new Date().toISOString() });
  if (!p.id && stock_inicial) await ajustarStock(r.id, stock_inicial, 'inicial');
  return r;
}
// Foto de producto: se sube a Storage (carpeta "productos") y se guarda el enlace público.
export async function subirFotoProducto(productoId, blob) {
  if (modoDemo) return demo.fotoProducto(productoId, URL.createObjectURL(blob));
  const ruta = `${productoId}/${Date.now()}.jpg`;
  const url = await subirFoto('productos', ruta, blob);
  chk(await sb.from('productos').update({ imagen_url: url }).eq('id', productoId));
  return url;
}
export async function quitarFotoProducto(productoId) {
  if (modoDemo) return demo.fotoProducto(productoId, null);
  chk(await sb.from('productos').update({ imagen_url: null }).eq('id', productoId));
}

// ---------------- Compras a proveedores (solo admin, con señal) ----------------
// Último costo, costos con IVA; el precio cambia solo donde se eligió (items[].precio). Ver migración 0027.
export async function compras({ proveedorId = null } = {}) {
  if (modoDemo) return demo.compras({ proveedorId });
  let q = sb.from('compras').select('*, proveedores(nombre), compra_items(count)');
  if (proveedorId) q = q.eq('proveedor_id', proveedorId);
  return chk(await q.order('fecha', { ascending: false }).order('creado_en', { ascending: false }).limit(200))
    .map((c) => ({ ...c, proveedor: c.proveedores?.nombre || '—', productos: c.compra_items?.[0]?.count ?? 0 }));
}
export async function compra(id) {
  if (modoDemo) return demo.compra(id);
  const c = chk(await sb.from('compras').select('*, proveedores(nombre), compra_items(*, productos(nombre, ref))').eq('id', id).single());
  const ids = [c.usuario_id, c.anulada_por].filter(Boolean);
  const vs = ids.length ? chk(await sb.from('vendedores').select('id,nombre').in('id', ids)) : [];
  const nom = (u) => vs.find((x) => x.id === u)?.nombre || null;
  return { ...c, proveedor: c.proveedores?.nombre || '—', registro: nom(c.usuario_id), anulador: nom(c.anulada_por),
    items: (c.compra_items || []).map((i) => ({ ...i, nombre: i.productos?.nombre || '—', ref: i.productos?.ref || '' }))
      .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')) };
}
// Últimas compras de un producto (para la ficha del producto).
export async function comprasDeProducto(productoId) {
  if (modoDemo) return demo.comprasDeProducto(productoId);
  const r = chk(await sb.from('compra_items').select('cantidad, costo, compras!inner(id, fecha, estado, proveedores(nombre))')
    .eq('producto_id', productoId).eq('compras.estado', 'vigente').order('id', { ascending: false }).limit(5));
  return r.map((i) => ({ cantidad: i.cantidad, costo: i.costo, id: i.compras.id, fecha: i.compras.fecha, proveedor: i.compras.proveedores?.nombre || '—' }));
}
export async function registrarCompra(c) {
  if (modoDemo) return demo.registrarCompra(c);
  exigirSenal('Registrar una compra', 'la compra quede guardada');
  const r = chk(await sb.rpc('registrar_compra', { p: c }));
  programarCopia();   // la copia del celular se renueva en unos segundos
  return r;
}
// ---------------- Pedidos a proveedores (solo admin, con señal; migración 0041) ----------------
// Enviado → Recibido (enlazado a la compra) o Anulado. Lo que ve el proveedor no lleva costos.
export async function pedidosProveedor({ proveedorId = null, limite = 50 } = {}) {
  if (modoDemo) return demo.pedidosProveedor({ proveedorId });
  let q = sb.from('pedidos_proveedor').select('*, proveedores(nombre), pedido_proveedor_items(cantidad)');
  if (proveedorId) q = q.eq('proveedor_id', proveedorId);
  return chk(await q.order('creado_en', { ascending: false }).limit(limite)).map((x) => ({ ...x, proveedor: x.proveedores?.nombre || '—',
    productos: (x.pedido_proveedor_items || []).length, unidades: (x.pedido_proveedor_items || []).reduce((a, i) => a + i.cantidad, 0) }));
}
export async function pedidoProveedor(id) {
  if (modoDemo) return demo.pedidoProveedor(id);
  const x = chk(await sb.from('pedidos_proveedor').select('*, proveedores(*), pedido_proveedor_items(producto_id, cantidad, productos(nombre, ref, stock))').eq('id', id).maybeSingle());
  if (!x) throw new Error('No se encontró el pedido.');
  const vs = x.usuario_id ? chk(await sb.from('vendedores').select('id,nombre').eq('id', x.usuario_id)) : [];
  return { ...x, proveedor: x.proveedores, hizo: vs[0]?.nombre || null,
    items: (x.pedido_proveedor_items || []).map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad, nombre: i.productos?.nombre || '—', ref: i.productos?.ref || '', stock: i.productos?.stock }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) };
}
export async function guardarPedidoProveedor(p) {
  if (modoDemo) return demo.guardarPedidoProveedor(p);
  exigirSenal('Guardar un pedido al proveedor', 'el pedido quede guardado');
  return chk(await sb.rpc('guardar_pedido_proveedor', { p }));
}
// Por enviar → Enviado (migración 0046): al mandarlo por WhatsApp o marcarlo a mano. Repetirlo no falla.
export async function marcarPedidoProveedorEnviado(id) {
  if (modoDemo) return demo.marcarPedidoProveedorEnviado(id);
  exigirSenal('Marcar el pedido como enviado', 'quede registrado');
  return chk(await sb.rpc('marcar_pedido_proveedor_enviado', { p_id: id }));
}
export async function recibirPedidoProveedor(id, compraId = null) {
  if (modoDemo) return demo.recibirPedidoProveedor(id, compraId);
  exigirSenal('Marcar el pedido como recibido', 'quede registrado');
  return chk(await sb.rpc('recibir_pedido_proveedor', { p_id: id, p_compra: compraId }));
}
export async function anularPedidoProveedor(id, motivo) {
  if (modoDemo) return demo.anularPedidoProveedor(id, motivo);
  exigirSenal('Anular el pedido', 'quede anulado');
  return chk(await sb.rpc('anular_pedido_proveedor', { p_id: id, p_motivo: motivo }));
}
// Unidades vendidas por producto en los últimos "dias" (notas no anuladas), para sugerir cuánto pedir.
export async function ventasPorProducto(dias = 28) {
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  const filas = modoDemo ? demo.ventasDesde(desde)
    : chk(await sb.from('pedido_items').select('producto_id, cantidad, pedidos!inner(fecha, estado)')
      .gte('pedidos.fecha', desde).neq('pedidos.estado', 'anulado').limit(10000));
  const m = new Map();
  for (const f of filas) if (f.producto_id) m.set(f.producto_id, (m.get(f.producto_id) || 0) + Number(f.cantidad));
  return m;
}
// Fotos del documento del proveedor (carpeta "compras" de Storage, migración 0028): <id compra>/<id al azar>.jpg
export function urlFotoCompra(ruta) {
  if (modoDemo || /^(blob:|data:|https?:)/.test(ruta)) return ruta;
  return sb.storage.from('compras').getPublicUrl(ruta).data.publicUrl;
}
export async function subirFotoCompra(compraId, blob) {
  if (modoDemo) return URL.createObjectURL(blob);
  exigirSenal('Subir la foto', 'quede guardada');
  const ruta = `${compraId}/${crypto.randomUUID()}.jpg`;
  await subirFoto('compras', ruta, blob);
  return ruta;
}
export async function borrarFotoCompra(ruta) {
  if (modoDemo || /^(blob:|data:)/.test(ruta)) return;
  await sb.storage.from('compras').remove([ruta]).catch(() => {});   // si falla, queda un archivo suelto sin uso
}
export async function cambiarFotosCompra(id, fotos) {
  if (modoDemo) return demo.fotosCompra(id, fotos);
  exigirSenal('Cambiar las fotos', 'el cambio quede guardado');
  return chk(await sb.rpc('fotos_compra', { p_id: id, p_fotos: fotos }));
}
export async function anularCompra(id, motivo) {
  if (modoDemo) return demo.anularCompra(id, motivo);
  exigirSenal('Anular una compra', 'el cambio quede guardado');
  const r = chk(await sb.rpc('anular_compra', { p_id: id, p_motivo: motivo }));
  programarCopia();   // la copia del celular se renueva en unos segundos
  return r;
}

export async function ajustarStock(productoId, cantidad, motivo = 'ajuste') {
  if (modoDemo) return demo.ajustarStock(productoId, cantidad);
  return chk(await sb.from('movimientos_stock').insert({ producto_id: productoId, cantidad, motivo }));
}

// ---------------- Pedidos ----------------
// Ventas (pedidos con su detalle) entre dos fechas [desde, hasta).
export async function ventas(desde, hasta) {
  if (modoDemo) return demo.ventas(desde, hasta);
  return chk(await sb.from('pedidos')
    .select('id,numero,fecha,total,subtotal,descuento,bajo_lista,forma_pago,estado,cliente_id,ruta_id,clientes(nombre),pedido_items(producto_id,nombre,cantidad,precio,precio_lista,costo,subtotal)')
    .gte('fecha', desde.toISOString()).lt('fecha', hasta.toISOString())
    .order('fecha'))
    .map((p) => ({ ...p, cliente: p.clientes?.nombre || '—', items: p.pedido_items || [] }));
}

// Ventas vigentes desde un día (fecha de Chile), con la copia del celular y los pedidos en cola: [{ dia, total }].
// soloEquipo: sin consultar al servidor (logros: no deben competir con la venta ni cambiar el estado de la señal);
// extra: notas recién guardadas que la copia aún no tiene.
async function ventasDesde(dia, { soloEquipo = false, extra = [] } = {}) {
  const desde = new Date(Date.parse(dia + 'T00:00:00Z') - 864e5).toISOString();   // margen por zona horaria
  const base = modoDemo ? demo.ventas(new Date(desde), new Date(Date.now() + 864e5))
    : soloEquipo ? (local.copia()?.pedidos || [])
    : await conCopia(async () => chk(await sb.from('pedidos').select('id,fecha,total,estado').gte('fecha', desde)), (c) => c.pedidos || []);
  const cola = local.colaPedidos().map((x) => ({ id: x.pedido.id, fecha: x.pedido.fecha, total: x.resumen.total, estado: 'generado' }));
  const mas = [...cola, ...extra.filter((e) => e?.id && e.fecha)];
  return [...base, ...mas.filter((q, i) => !base.some((p) => p.id === q.id) && mas.findIndex((z) => z.id === q.id) === i)]
    .filter((p) => p.estado !== 'anulado' && diaDeChile(p.fecha) >= dia)
    .map((p) => ({ dia: diaDeChile(p.fecha), total: Number(p.total) || 0 }));
}

// Ventas de esta semana (lunes a domingo, días de Chile) para la tarjeta "Tu semana" del inicio: total y días con ventas.
// También el total de la semana anterior (logro "superaste la semana pasada"). Funciona sin señal.
export async function semanaVentas(opciones) {
  const hoy = diaDeChile(Date.now());
  const d = new Date(hoy + 'T12:00:00Z'), dow = (d.getUTCDay() + 6) % 7;   // 0 = lunes
  const lunes = new Date(d.getTime() - dow * 864e5).toISOString().slice(0, 10);
  const lunesAntes = new Date(d.getTime() - (dow + 7) * 864e5).toISOString().slice(0, 10);
  const ventas = await ventasDesde(lunesAntes, opciones);
  const todas = ventas.filter((p) => p.dia >= lunes && p.dia <= hoy);
  const dias = new Set(todas.map((p) => Math.round((Date.parse(p.dia) - Date.parse(lunes)) / 864e5)));
  return { total: todas.reduce((s, p) => s + p.total, 0), dias, hoy: dow, notas: todas.length, lunes,
    anterior: ventas.filter((p) => p.dia < lunes).reduce((s, p) => s + p.total, 0) };
}

// Venta de hoy y el mejor día anterior de los últimos 90 días (logro "récord del día"). Funciona sin señal.
export async function recordDia(opciones) {
  const hoy = diaDeChile(Date.now());
  const desde = new Date(Date.parse(hoy + 'T12:00:00Z') - 90 * 864e5).toISOString().slice(0, 10);
  const porDia = new Map();
  (await ventasDesde(desde, opciones)).forEach((p) => porDia.set(p.dia, (porDia.get(p.dia) || 0) + p.total));
  const antes = [...porDia].filter(([k]) => k < hoy).map(([, t]) => t);
  return { hoy, totalHoy: porDia.get(hoy) || 0, mejor: antes.length ? Math.max(...antes) : 0, diasConVenta: antes.length };
}

// Cuántas notas vigentes ha hecho este vendedor (logro de 100, 250, 500… notas). Necesita señal; sin ella, null.
export async function misNotas() {
  if (modoDemo || !yo || sinSenal() || senalDebil()) return null;
  try {
    const r = await sb.from('pedidos').select('id', { count: 'exact', head: true }).eq('vendedor_id', yo.id).neq('estado', 'anulado');
    return r.error ? null : r.count;
  } catch (_) { return null; }
}

// Crea el pedido. El número de nota sale del bloque reservado en el celular, así la nota
// impresa lleva su número definitivo aunque no haya señal. Sin señal, el pedido queda en la
// cola y se sube solo al volver la señal (el servidor no lo duplica: se identifica por su id).
// resumen = { cliente, total } para mostrarlo mientras está en cola.
export async function crearPedido(p, resumen = {}) {
  if (modoDemo) return demo.crearPedido(p);
  // Ya está en la cola (reintento del mismo pedido): no toma otro número ni lo agrega de nuevo.
  const yaEnCola = local.colaPedidos().find((x) => x.pedido.id === p.id);
  if (yaEnCola) return { id: p.id, numero: yaEnCola.pedido.numero, fecha: yaEnCola.pedido.fecha, total: yaEnCola.resumen.total, descuento_lealtad: p.descuento_lealtad, porSubir: true };
  const numero = local.tomarNumero(yo.id);
  const pedido = { ...p, numero, fecha: p.fecha || new Date().toISOString() };
  if (!sinSenal() && !senalDebil()) {
    try {
      // Pedido de un cliente nuevo (desde una cotización): el servidor crea el cliente y la nota juntos (migración 0052)
      const r = chk(await rpcConTope(pedido.cliente_nuevo ? 'crear_pedido_cliente_nuevo' : 'crear_pedido', { p: pedido }));
      marcarRed(true);
      sincronizar(true);   // renueva la copia en unos segundos: la venta se ve también si luego falla la señal
      return r;
    } catch (e) {
      if (!e.sinRed) { local.devolverNumero(yo.id, numero); throw e; }
    }
  }
  if (!senalDebil()) marcarRed(false);   // con señal débil sí hay internet: se avisa "Señal débil", no "Sin señal"
  pedido.sin_senal = true;
  local.encolar(pedido, resumen);
  return { id: pedido.id, numero, fecha: pedido.fecha, total: resumen.total, descuento_lealtad: p.descuento_lealtad, porSubir: true };
}

// Nombre de un producto desde la copia del celular (pedidos en cola guardados antes de que llevaran el nombre).
const nombreProducto = (id) => local.copia()?.productos?.find((x) => mismo(x.id, id))?.nombre || `Producto ${id}`;
// Líneas de una nota tal como se imprimió (nombre y precio de la venta).
const ITEMS_NOTA = 'pedido_items(producto_id,nombre,cantidad,precio,precio_lista,costo,subtotal)';
// Nota guardada en la copia, con el nombre y teléfono del cliente (también de la copia). Las por entregar están completas
// (notasEntrega); las demás de 90 días (entregadas: por ejemplo, para registrar un cambio en la visita, ticket N° 12) se
// arman con sus líneas (producto, cantidad y precio) y el nombre del producto de la copia.
function notaDeCopia(c, id) {
  const prod = (pid) => (c.productos || []).find((x) => mismo(x.id, pid));
  let n = (c.notasEntrega || []).find((x) => x.id === id);
  if (n) n = { ...n, items: (n.items || []).map((i) => (i.nombre ? i : { ...i, nombre: prod(i.producto_id)?.nombre || `Producto ${i.producto_id}` })) };
  else {
    const q = (c.pedidos || []).find((x) => x.id === id);
    if (!q) return null;
    const items = (q.pedido_items || []).map((i) => { const pr = prod(i.producto_id), precio = i.precio ?? pr?.precio ?? 0;
      return { producto_id: i.producto_id, nombre: pr?.nombre || `Producto ${i.producto_id}`, cantidad: i.cantidad, precio, subtotal: i.cantidad * precio }; });
    n = { ...q, items, deCopiaParcial: true };
  }
  const cli = (c.clientes || []).find((x) => mismo(x.id, n.cliente_id));
  return { ...n, clientes: { nombre: cli?.nombre || n.cliente || '—', telefono: cli?.telefono || '' } };
}

// Detalle de una nota (con sus productos, quién la anuló y qué nota la reemplaza).
export async function pedido(id) {
  if (modoDemo) return demo.pedido(id);
  const enCola = local.colaPedidos().find((x) => x.pedido.id === id);
  // Teléfono del cliente para "Avisar": de la copia, o el de la cotización si es un cliente nuevo aún sin subir.
  const telCola = (pe) => pe.cliente_nuevo?.telefono || local.copia()?.clientes?.find((c) => mismo(c.id, pe.cliente_id))?.telefono || '';
  if (enCola) return conMarca({ ...enCola.pedido, ...pagoInicial(enCola.pedido), cliente: enCola.resumen.cliente, total: enCola.resumen.total, estado: 'generado', porSubir: true,
    telefonoCliente: telCola(enCola.pedido),
    vendedor_id: yo.id, items: enCola.pedido.items.map((i) => ({ ...i, nombre: i.nombre || nombreProducto(i.producto_id), subtotal: i.cantidad * i.precio })) });
  // Sin señal (o señal débil): las notas por entregar están completas en la copia del celular (notasEntrega), para
  // poder abrirlas, entregarlas y avisar al cliente en ruta (ticket N° 11). Las demás necesitan señal.
  let deCopia = false;
  const servidor = async () => chk(await sb.from('pedidos').select(`*,clientes(nombre,telefono),${ITEMS_NOTA}`).eq('id', id).maybeSingle());
  let p = await conCopia(servidor, (c) => { deCopia = true; return notaDeCopia(c, id); });
  // Señal débil (no sin señal): una nota que no está en la copia (entregada, anulada, recién tomada) se pide igual al servidor.
  // Señal débil (no sin señal): una nota que no está completa en la copia (entregada, anulada, recién tomada) se pide al servidor.
  if ((!p || p.deCopiaParcial) && deCopia && !sinSenal()) { const q = await servidor().catch((e) => { if (p) return null; throw e; }); if (q) { p = q; deCopia = false; } }
  if (!p) throw new Error(deCopia ? 'Esta nota no está guardada en el celular. Ábrela cuando tengas señal.' : 'No se encontró esta nota.');
  const [reemplazo, original, vend] = deCopia ? [null, null, null] : await Promise.all([
    sb.from('pedidos').select('id,numero').eq('reemplaza_a', id).maybeSingle().then(chk),
    p.reemplaza_a ? sb.from('pedidos').select('id,numero').eq('id', p.reemplaza_a).maybeSingle().then(chk) : null,
    sb.from('vendedores').select('nombre').eq('id', p.vendedor_id).maybeSingle().then(chk).catch(() => null), // un vendedor solo ve su propio nombre
  ]);
  return conMarca({ ...p, cliente: p.clientes?.nombre || '—', telefonoCliente: p.clientes?.telefono || '', items: p.pedido_items || p.items || [], reemplazado_por: reemplazo, reemplaza: original, vendedor: vend?.nombre || null });
}
// Una marca de entrega guardada en el celular (sin subir) manda sobre lo que dice el servidor.
function conMarca(p) {
  let m, c;
  for (const x of local.colaEntregas()) if (x.entrega.pedidos.includes(p.id)) m = x.entrega;
  for (const x of local.colaCobros()) if (x.cobro.pedido_id === p.id) c = x.cobro;
  let r = m ? { ...p, entregado_en: m.entregado ? m.fecha : null, marcaPorSubir: true } : p;
  if (c) {   // pago definido al entregar (efectivo, transferencia o crédito) o vuelta a "pendiente"
    const cobrada = c.cobrado && c.forma !== 'credito';
    r = { ...r, forma_pago: c.cobrado ? c.forma : 'pendiente', pagado_en: cobrada ? c.fecha : null, pago_forma: cobrada ? c.forma : null,
      pago_definido_en: c.cobrado ? c.fecha : null, cobroPorSubir: true };
  }
  return r;
}
// Estado de pago de una nota guardada en el celular (sin cobros encolados): efectivo/transferencia = cobrada al tomarla.
const pagoInicial = (pedido) => (pedido.forma_pago === 'efectivo' || pedido.forma_pago === 'transferencia'
  ? { pagado_en: pedido.fecha, pago_forma: pedido.forma_pago } : { pagado_en: null, pago_forma: null });
// ¿Puede el usuario anular o editar esta nota? (sus propias notas; un administrador, todas)
export const puedeCorregir = (p) => p.estado !== 'anulado' && !p.porSubir && (esAdmin() || p.vendedor_id === yo?.id);
function exigirSenal(accion, para = 'la nota quede registrada en el servidor') {
  if (sinSenal()) throw new Error(`${accion} necesita señal, para que ${para}. Intenta cuando tengas internet.`);
}
// Una nota con un cambio guardado en el celular (sin subir) no se anula ni se edita: primero el cambio (igual que el servidor).
function sinCambioEnCola(id) {
  if (local.colaCambios().some((x) => x.cambio.pedido_id === id)) throw new Error('Esta nota tiene un cambio guardado en el celular. Anula primero el cambio y después la nota.');
}
export async function anularPedido(id, motivo) {
  if (modoDemo) return demo.anularPedido(id, motivo);
  sinCambioEnCola(id);
  exigirSenal('Anular un pedido');
  const r = chk(await sb.rpc('anular_pedido', { p_id: id, p_motivo: motivo }));
  programarCopia();   // la copia del celular se renueva en unos segundos
  return r;
}
// Editar = anular la nota original y crear una nueva que la reemplaza (otro número), en una sola operación.
export async function reemplazarPedido(id, motivo, p) {
  if (modoDemo) return demo.reemplazarPedido(id, motivo, p);
  sinCambioEnCola(id);
  exigirSenal('Editar un pedido');
  const numero = local.tomarNumero(yo.id);
  const nuevo = { ...p, numero, fecha: p.fecha || new Date().toISOString() };
  try {
    const r = chk(await sb.rpc('reemplazar_pedido', { p_id: id, p_motivo: motivo, p: nuevo }));
    sincronizar(true);
    return r;
  } catch (e) {
    // Si se cortó la señal a mitad, el número se guarda igual: al reintentar con el mismo id no se duplica.
    if (!e.sinRed) local.devolverNumero(yo.id, numero);
    else marcarRed(false);
    throw e.sinRed ? new Error('Se perdió la señal y no se pudo confirmar el cambio. Intenta de nuevo cuando tengas señal: no se duplicará.') : e;
  }
}

// ---------------- Crédito (en el código se llama "fiado") ----------------
const CAMPOS_ABONO = 'id,cliente_id,monto,forma_pago,fecha,vendedor_id,nota,anulado,anulado_motivo,anulado_en';

// Reglas del fiado (plazo general en días)
export async function reglasFiado() {
  if (modoDemo) return demo.reglasFiado();
  return conCopia(async () => chk(await sb.from('configuracion').select('valor').eq('clave', 'fiado'))[0]?.valor || { plazo_dias: PLAZO_DEFECTO },
    (c) => c.fiado || { plazo_dias: PLAZO_DEFECTO });
}
export async function guardarReglasFiado(cfg) {
  if (modoDemo) return demo.guardarReglasFiado(cfg);
  chk(await sb.from('configuracion').upsert({ clave: 'fiado', valor: cfg }));
  return cfg;
}

// Fiado de un cliente: notas a crédito (con lo pagado y lo pendiente), abonos y resumen.
// Suma lo que está guardado en el celular sin subir (notas a crédito y abonos).
export async function fiadoCliente(id) {
  if (modoDemo) return demo.fiadoCliente(id);
  const base = await conCopia(async () => {
    const [notas, abonos, res] = await Promise.all([
      sb.from('fiado_notas').select('*').eq('cliente_id', id).then(chk),
      sb.from('abonos').select(CAMPOS_ABONO).eq('cliente_id', id).order('fecha', { ascending: false }).limit(30).then(chk),
      sb.from('fiado_clientes').select('saldo_favor').eq('cliente_id', id).then(chk),
    ]);
    return { notas, abonos, saldoFavor: res[0]?.saldo_favor || 0 };
  }, (c) => ({
    notas: (c.fiadoNotas || []).filter((n) => mismo(n.cliente_id, id)),
    abonos: (c.abonos || []).filter((a) => mismo(a.cliente_id, id)),
    saldoFavor: (c.fiadoClientes || []).find((f) => mismo(f.cliente_id, id))?.saldo_favor || 0,
  }));
  return conColaFiado(id, base);
}
function conColaFiado(id, { notas, abonos, saldoFavor }) {
  const c = local.copia();
  const cli = c?.clientes?.find((x) => mismo(x.id, id));
  const plazo = cli?.plazo_credito_dias || c?.fiado?.plazo_dias || PLAZO_DEFECTO;
  const enColaNotas = local.colaPedidos().filter((x) => x.pedido.forma_pago === 'credito' && mismo(x.pedido.cliente_id, id))
    .map((x) => ({ pedido_id: x.pedido.id, numero: x.pedido.numero, fecha: x.pedido.fecha, total: x.resumen.total,
      vence_en: vencimiento(x.pedido.fecha, plazo, diasExtra(c?.lealtad, x.pedido.nivel)), porSubir: true }));
  // Notas dejadas a crédito al entregar, sin subir todavía (el plazo cuenta desde la entrega)
  const yaEsta = new Set([...notas, ...enColaNotas].map((n) => n.pedido_id));
  const creditoEnCola = local.colaCobros().filter((x) => x.cobro.cobrado && x.cobro.forma === 'credito' && mismo(x.resumen?.cliente_id, id) && !yaEsta.has(x.cobro.pedido_id))
    .map((x) => ({ pedido_id: x.cobro.pedido_id, numero: x.resumen.numero, fecha: x.cobro.fecha, total: x.resumen.total,
      vence_en: vencimiento(x.cobro.fecha, plazo, 0), porSubir: true }));
  enColaNotas.push(...creditoEnCola);
  const enColaAbonos = local.colaAbonos().filter((x) => mismo(x.abono.cliente_id, id))
    .map((x) => ({ ...x.abono, anulado: false, porSubir: true })).reverse();
  const abonado = notas.reduce((s, n) => s + (n.pagado || 0), 0) + saldoFavor + enColaAbonos.reduce((s, a) => s + a.monto, 0);
  return { ...repartir([...notas, ...enColaNotas], abonado), abonos: [...enColaAbonos, ...abonos] };
}

// Resumen de fiado de todos los clientes con deuda o abonos (Map cliente_id → resumen). Suma lo guardado sin subir.
export async function fiadoTodos() {
  if (modoDemo) return demo.fiadoTodos();
  const filas = await conCopia(async () => chk(await sb.from('fiado_clientes').select('*')), (c) => c.fiadoClientes || []);
  const m = new Map(filas.map((f) => [f.cliente_id, { ...f }]));
  const sumarNota = (clienteId, total) => {
    const f = m.get(clienteId) || { cliente_id: clienteId, deuda: 0, atrasado: 0, dias_atraso: 0, notas_pendientes: 0, saldo_favor: 0 };
    f.deuda += total || 0; f.notas_pendientes++; m.set(clienteId, f);
  };
  // Notas a crédito sin subir: tomadas a crédito (antiguas) o dejadas a crédito al entregar
  for (const x of local.colaPedidos()) if (x.pedido.forma_pago === 'credito') sumarNota(x.pedido.cliente_id, x.resumen.total);
  for (const x of local.colaCobros()) if (x.cobro.cobrado && x.cobro.forma === 'credito' && x.resumen?.cliente_id != null) sumarNota(x.resumen.cliente_id, x.resumen.total);
  for (const x of local.colaAbonos()) {
    const f = m.get(x.abono.cliente_id);
    if (f) f.deuda = Math.max(0, f.deuda - x.abono.monto);
  }
  return m;
}

// Registrar un abono. Sin señal queda guardado en el celular y se sube solo (no se duplica: se identifica por su id).
export async function registrarAbono(a, resumen = {}) {
  if (modoDemo) return demo.registrarAbono(a);
  const abono = { ...a, fecha: a.fecha || new Date().toISOString() };
  if (!sinSenal() && !senalDebil()) {
    try {
      const r = chk(await rpcConTope('registrar_abono', { p: abono }));
      sincronizar(true);
      return r;
    } catch (e) { if (!e.sinRed) throw e; }
  }
  if (!senalDebil()) marcarRed(false);
  local.encolarAbono({ ...abono, sin_senal: true }, resumen);
  return { ...abono, porSubir: true };
}
export async function anularAbono(id, motivo) {
  if (modoDemo) return demo.anularAbono(id, motivo);
  exigirSenal('Anular un abono');
  const r = chk(await sb.rpc('anular_abono', { p_id: id, p_motivo: motivo }));
  programarCopia();   // la copia del celular se renueva en unos segundos
  return r;
}

// Marcar un cliente como visitado sin pedido. Sin señal queda en el celular y se sube solo (se identifica por su id).
export async function registrarVisita(clienteId, nombre) {
  const visita = { id: crypto.randomUUID(), cliente_id: clienteId, fecha: new Date().toISOString() };
  if (modoDemo) return demo.registrarVisita(visita);
  if (!sinSenal() && !senalDebil()) {
    try {
      chk(await rpcConTope('registrar_visita', { p: visita }));
      sincronizar(true);   // renueva la copia: así "Visitado" se ve también sin señal
      return visita;
    } catch (e) { if (!e.sinRed) throw e; }
  }
  if (!senalDebil()) marcarRed(false);
  local.encolarVisita({ ...visita, sin_senal: true }, { cliente: nombre });
  return visita;
}
// Deshacer: si todavía está en el celular basta con quitarla; si ya se subió, necesita señal.
export async function anularVisita(id) {
  if (modoDemo) return demo.anularVisita(id);
  if (local.enCola(id)) { local.quitarDeCola(id); return; }
  exigirSenal('Deshacer la visita');
  chk(await sb.rpc('anular_visita', { p_id: id }));
  sincronizar(true);
}

// ---------------- Cotizaciones (migración 0051) ----------------
// Precios para el cliente sin generar nota: no usan numeración, no mueven stock ni cuentan en ventas. Se guardan con
// el id del celular (sin señal van a la cola y se suben solas) y cuentan como visita ("Visitado · cotización").
const CAMPOS_COTIZACION = 'id,cliente_id,prospecto_nombre,prospecto_telefono,vendedor_id,fecha,valida_hasta,items,subtotal,descuento,total,pedido_id,convertida_en,eliminada_en';
const DIAS_COTIZACIONES = 60;   // la lista y la copia del celular guardan las de los últimos 60 días
// Cotización guardada en el celular (sin subir), con la misma forma que la del servidor.
function cotizacionDeCola(x) {
  const q = x.cotizacion;
  const items = q.items.map((i) => ({ producto_id: i.producto_id, nombre: i.nombre || nombreProducto(i.producto_id), cantidad: i.cantidad, precio: i.precio, subtotal: i.cantidad * i.precio }));
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  return { id: q.id, cliente_id: q.cliente_id ?? null, prospecto_nombre: q.prospecto?.nombre || null, prospecto_telefono: q.prospecto?.telefono || null, vendedor_id: yo?.id, fecha: q.fecha, valida_hasta: q.valida_hasta, items, subtotal,
    descuento: q.descuento || 0, total: Math.max(subtotal - (q.descuento || 0), 0), pedido_id: null, convertida_en: null, eliminada_en: null,
    porSubir: true, cliente: x.resumen?.cliente };
}
// Una conversión en pedido guardada en el celular manda sobre lo que dice el servidor.
function conConversion(q) {
  const x = local.colaConversiones().find((y) => y.cotizacionPedido.cotizacion_id === q.id);
  if (x) return { ...q, pedido_id: x.cotizacionPedido.pedido_id, convertida_en: x.cotizacionPedido.fecha, conversionPorSubir: true };
  // Cliente nuevo: la nota en la cola lleva la cotización (el servidor las enlaza al subirla)
  const n = local.colaPedidos().find((y) => y.pedido.cliente_nuevo?.cotizacion_id === q.id);
  return n ? { ...q, pedido_id: n.pedido.id, convertida_en: n.pedido.fecha, conversionPorSubir: true } : q;
}
// Cotización a un cliente nuevo sin convertir, vencida hace más de 30 días: el servidor borra sus datos esa madrugada
// (migración 0054). El celular aplica la misma regla para no convertir sin señal una que ya no existe.
const prospectoBorrado = (q) => q.cliente_id == null && !q.pedido_id && !!q.valida_hasta && q.valida_hasta < sumarDias(hoyChile(), -30);
// Vigente = hasta el día "válida hasta" incluido (día de Chile).
export const cotizacionVigente = (q) => !!q && q.valida_hasta >= hoyChile();
// Lista (sin las eliminadas), la más nueva primero. Con clienteId, solo las de ese cliente.
export async function cotizaciones({ clienteId = null } = {}) {
  const desde = new Date(Date.now() - DIAS_COTIZACIONES * 864e5).toISOString();
  let base;
  if (modoDemo) base = demo.cotizaciones();
  else base = await conCopia(async () => {
    let q = sb.from('cotizaciones').select(CAMPOS_COTIZACION).is('eliminada_en', null).gte('fecha', desde).order('fecha', { ascending: false }).limit(300);
    if (clienteId) q = q.eq('cliente_id', clienteId);
    return chk(await q);
  }, (c) => c.cotizaciones || []);
  const cola = local.colaCotizaciones().filter((x) => !base.some((q) => q.id === x.cotizacion.id)).map(cotizacionDeCola);
  let lista = [...cola, ...base].filter((q) => !q.eliminada_en).map(conConversion).filter((q) => !prospectoBorrado(q));
  if (clienteId) return lista.filter((q) => mismo(q.cliente_id, clienteId)).sort((a, z) => z.fecha.localeCompare(a.fecha));
  const porId = new Map((await clientes({ inactivos: true }).catch(() => [])).map((c) => [String(c.id), c]));
  lista = lista.map((q) => ({ ...q, cliente: porId.get(String(q.cliente_id))?.nombre || q.prospecto_nombre || q.cliente || 'Cliente' }));
  return lista.sort((a, z) => z.fecha.localeCompare(a.fecha));
}
// Detalle: con el cliente, la nota en que se convirtió (si hay) y quién la hizo.
export async function cotizacion(id) {
  const enCola = local.colaCotizaciones().find((x) => x.cotizacion.id === id);
  let q;
  if (enCola) q = cotizacionDeCola(enCola);
  else if (modoDemo) q = demo.cotizacion(id);
  else q = await conCopia(async () => chk(await sb.from('cotizaciones').select(CAMPOS_COTIZACION).eq('id', id).maybeSingle()),
    (c) => (c.cotizaciones || []).find((x) => x.id === id) || null);
  if (!q) throw new Error('No se encontró esta cotización. Si se hizo en otro celular, ábrela cuando tengas señal.');
  q = conConversion(q);
  if (!q.eliminada_en && prospectoBorrado(q)) q = { ...q, eliminada_en: sumarDias(q.valida_hasta, 31), prospecto_nombre: 'Cliente eliminado', prospecto_telefono: null };
  const [cli, nota] = await Promise.all([
    q.cliente_id != null ? cliente(q.cliente_id).catch(() => null) : null,
    q.pedido_id ? pedido(q.pedido_id).catch(() => null) : null,
  ]);
  // Cliente nuevo (sin cliente_id): sus datos son los que se pidieron al cotizar (nombre y teléfono)
  const nuevo = q.cliente_id == null;
  return { ...q, nuevo, clienteDatos: cli || (nuevo ? { nombre: q.prospecto_nombre, telefono: q.prospecto_telefono || '' } : null),
    cliente: cli?.nombre || q.prospecto_nombre || q.cliente || 'Cliente', nota: nota ? { id: nota.id, numero: nota.numero, estado: nota.estado } : null,
    propia: q.vendedor_id === yo?.id };
}
// Guardar. Sin señal (o con señal débil) queda en el celular y se sube sola; reintentar no duplica (mismo id).
export async function guardarCotizacion(q, resumen = {}) {
  const cot = { ...q, fecha: q.fecha || new Date().toISOString() };
  if (modoDemo) return demo.guardarCotizacion(cot);
  if (local.enCola(cot.id)) return { ...cot, porSubir: true };
  if (!sinSenal() && !senalDebil()) {
    try {
      const r = chk(await rpcConTope('guardar_cotizacion', { p: cot }));
      marcarRed(true);
      sincronizar(true);   // renueva la copia: la cotización y la visita se ven también sin señal
      return r;
    } catch (e) { if (!e.sinRed) throw e; }
  }
  if (!senalDebil()) marcarRed(false);
  local.encolarCotizacion({ ...cot, sin_senal: true }, resumen);
  return { ...cot, porSubir: true };
}
// Eliminar (ocultar). Si todavía está en el celular basta con quitarla; si ya se subió, necesita señal.
export async function eliminarCotizacion(id) {
  if (modoDemo) return demo.eliminarCotizacion(id);
  if (local.enCola(id)) { local.descartar(id); return; }
  exigirSenal('Eliminar una cotización', 'el cambio quede registrado en el servidor');
  chk(await sb.rpc('eliminar_cotizacion', { p_id: id }));
  programarCopia();
}
// Anotar la nota en que se convirtió. Si la nota o la cotización siguen en el celular, va a la cola detrás de ellas.
export async function cotizacionAPedido(cotizacionId, pedidoId, resumen = {}) {
  const conv = { id: crypto.randomUUID(), cotizacion_id: cotizacionId, pedido_id: pedidoId, fecha: new Date().toISOString() };
  if (modoDemo) return demo.cotizacionAPedido(cotizacionId, pedidoId);
  const espera = local.colaPedidos().some((x) => x.pedido.id === pedidoId) || local.enCola(cotizacionId);
  if (!espera && !sinSenal() && !senalDebil()) {
    try { chk(await rpcConTope('cotizacion_a_pedido', { p_id: cotizacionId, p_pedido: pedidoId })); programarCopia(); return conv; }
    catch (e) { if (!e.sinRed) throw e; }
  }
  local.encolarConversion(conv, resumen);
  if (hayRed()) sincronizar();
  return conv;
}

// ---------------- Cambios (migración 0056, ticket N° 12) ----------------
// Nota de cambio de una nota de venta entregada: "Devuelve" y "Recibe", del mismo valor, con motivo. Se anota en la visita
// y queda por entregar (pestaña Pedidos y Carga para bodega). El stock se mueve al anotarla. No cambia la nota de venta.
// Sin señal va a la cola (id del celular) y se sube sola después de su nota y de la entrega de esa nota.
const CAMPOS_CAMBIO = 'id,pedido_id,cliente_id,ruta_id,numero_nota,n,n_en_papel,motivo,detalle,valor,vendedor_id,fecha,entregado_en,anulado_en,anulado_motivo,cambio_items(sentido,producto_id,nombre,cantidad,precio,destino,subtotal)';
export const MOTIVOS_CAMBIO = {
  variedad: 'Cambio de sabor o variedad', mal_estado: 'Producto en mal estado', error_entrega: 'Error de entrega',
  error_pedido: 'Error al tomar el pedido', otro: 'Otro motivo',
};
// "Cambio N° 602-1": N° de la nota de origen + correlativo de los cambios de esa nota.
export const numeroCambio = (c) => `${c.numero_nota ?? '?'}-${c.n ?? '?'}`;
const valorLado = (items, sentido) => items.filter((i) => i.sentido === sentido).reduce((s, i) => s + i.cantidad * i.precio, 0);
// Forma única de un cambio (servidor, copia o cola): items con sentido, nombre, cantidad, precio, destino y subtotal.
const formaCambio = (c) => { const items = (c.cambio_items || c.items || []).map((i) => ({ ...i, subtotal: i.subtotal ?? i.cantidad * i.precio }));
  const { cambio_items: _, ...resto } = c; return { ...resto, items, valor: c.valor ?? valorLado(items, 'devuelve') }; };
function cambioDeCola(x) {
  const q = x.cambio;
  return formaCambio({ id: q.id, pedido_id: q.pedido_id, cliente_id: x.resumen?.cliente_id ?? null, ruta_id: x.resumen?.ruta_id ?? null,
    numero_nota: x.resumen?.numero_nota ?? null, n: q.n, motivo: q.motivo, detalle: q.detalle || null, vendedor_id: yo?.id, fecha: q.fecha,
    entregado_en: null, anulado_en: null, items: q.items.map((i) => ({ ...i, nombre: i.nombre || nombreProducto(i.producto_id) })),
    porSubir: true, cliente: x.resumen?.cliente, conProblema: x.estado === 'error' });
}
// Una entrega de cambio guardada en el celular (sin subir) manda sobre lo que dice el servidor.
function conEntregaCambio(c) {
  let m = null;
  for (const x of local.colaEntregasCambio()) if (x.entregaCambio.cambio_id === c.id) m = x.entregaCambio;
  return m ? { ...c, entregado_en: m.entregado ? m.fecha : null, marcaPorSubir: true } : c;
}
// Cambios de los últimos 90 días (servidor o copia) más los guardados en el celular. pedidoId / clienteId filtran.
export async function cambios({ pedidoId = null, clienteId = null } = {}) {
  const desde = new Date(Date.now() - 90 * 864e5).toISOString();
  let base;
  if (modoDemo) base = demo.cambios();
  else base = await conCopia(async () => {
    let q = sb.from('cambios').select(CAMPOS_CAMBIO).gte('fecha', desde).order('fecha', { ascending: false }).limit(300);
    if (pedidoId) q = q.eq('pedido_id', pedidoId);
    if (clienteId) q = q.eq('cliente_id', clienteId);
    return chk(await q).map(formaCambio);
  }, (c) => (c.cambios || []).map(formaCambio));
  const cola = local.colaCambios().filter((x) => !base.some((q) => q.id === x.cambio.id)).map(cambioDeCola);
  return [...cola, ...base].map(conEntregaCambio)
    .filter((c) => (!pedidoId || c.pedido_id === pedidoId) && (!clienteId || mismo(c.cliente_id, clienteId)))
    .sort((a, z) => z.fecha.localeCompare(a.fecha));
}
// Detalle de un cambio, con el cliente (nombre y teléfono) y si el usuario puede anularlo.
export async function cambio(id) {
  const enCola = local.colaCambios().find((x) => x.cambio.id === id);
  let c;
  if (enCola) c = cambioDeCola(enCola);
  else if (modoDemo) c = demo.cambio(id);
  else {
    c = await conCopia(async () => chk(await sb.from('cambios').select(CAMPOS_CAMBIO).eq('id', id).maybeSingle()),
      (k) => (k.cambios || []).find((x) => x.id === id) || null);
    if (c) c = formaCambio(c);
  }
  if (!c) throw new Error('No se encontró este cambio. Si se hizo en otro celular, ábrelo cuando tengas señal.');
  c = conEntregaCambio(c);
  const cli = c.cliente_id != null ? await cliente(c.cliente_id).catch(() => null) : null;
  return { ...c, cliente: cli?.nombre || c.cliente || 'Cliente', telefonoCliente: cli?.telefono || '',
    puedeAnular: !c.anulado_en && !c.entregado_en && (esAdmin() || c.vendedor_id === yo?.id) };
}
// Registrar. c = { id, pedido_id, n, motivo, detalle, items: [{ sentido, producto_id, nombre, cantidad, precio, destino }] }
// resumen = { cliente, cliente_id, numero_nota, ruta_id } (para mostrarlo mientras está en el celular).
export async function registrarCambio(c, resumen = {}) {
  const cam = { ...c, fecha: c.fecha || new Date().toISOString() };
  if (modoDemo) return demo.registrarCambio(cam, resumen);
  if (local.colaPedidos().some((x) => x.pedido.id === cam.pedido_id)) {
    throw new Error('Esta nota todavía está guardada en el celular. Para registrar un cambio, espera a que se suba (necesita señal una vez).');
  }
  if (local.enCola(cam.id)) return { ...cam, ...resumen, porSubir: true };
  // Si la entrega de la nota todavía no se sube, el cambio espera en la cola detrás de ella.
  const espera = local.colaEntregas().some((x) => x.entrega.pedidos.includes(cam.pedido_id));
  if (!espera && !sinSenal() && !senalDebil()) {
    try {
      const r = chk(await rpcConTope('registrar_cambio', { p: cam }));
      marcarRed(true);
      sincronizar(true);   // renueva la copia: el cambio y el stock se ven también sin señal
      return { ...cam, ...resumen, n: r.n, numero_nota: r.numero_nota };
    } catch (e) { if (!e.sinRed) throw e; }
  }
  if (!senalDebil() && !espera) marcarRed(false);
  local.encolarCambio({ ...cam, sin_senal: !hayRed() }, { ...resumen, numero: `${resumen.numero_nota}-${cam.n}` });
  if (hayRed()) sincronizar();
  return { ...cam, ...resumen, porSubir: true };
}
// Entregar (o deshacer la entrega). Sin señal, o si el cambio sigue en el celular, va a la cola detrás de él.
export async function entregarCambio(id, entregado = true, resumen = {}) {
  const ent = { id: crypto.randomUUID(), cambio_id: id, entregado, fecha: new Date().toISOString() };
  if (modoDemo) return demo.entregarCambio(ent);
  const espera = local.colaCambios().some((x) => x.cambio.id === id);
  if (!espera && !sinSenal() && !senalDebil()) {
    try { chk(await rpcConTope('entregar_cambio', { p_id: id, p_entregado: entregado, p_fecha: ent.fecha })); sincronizar(true); return ent; }
    catch (e) { if (!e.sinRed) throw e; marcarRed(false); }
  }
  local.encolarEntregaCambio({ ...ent, sin_senal: !hayRed() }, resumen);
  if (hayRed()) sincronizar();
  return ent;
}
// Anular: si sigue en el celular basta con quitarlo (y su entrega); si ya se subió, necesita señal y motivo.
export async function anularCambio(id, motivo) {
  if (modoDemo) return demo.anularCambio(id, motivo);
  if (enVuelo.has(id)) throw new Error('El cambio se está subiendo. Intenta de nuevo en unos segundos.');
  if (local.colaCambios().some((x) => x.cambio.id === id)) { local.descartar(id); return; }
  exigirSenal('Anular un cambio', 'el stock vuelva como estaba');
  chk(await sb.rpc('anular_cambio', { p_id: id, p_motivo: motivo }));
  programarCopia();
}

// ---------------- Entregas (pestaña Pedidos) ----------------
// Notas vigentes por entregar (de cualquier fecha) y las entregadas desde ayer (día de Chile), con su cliente y ruta.
// Suma lo guardado en el celular: pedidos por subir (por entregar) y marcas de entrega por subir.
export async function pedidosEntrega() {
  const ayer = new Date(Date.parse(diaDeChile(Date.now() - 864e5) + 'T00:00:00Z') - 864e5).toISOString(); // margen de 1 día por zona horaria
  const enAyer = (f) => diaDeChile(f) >= diaDeChile(Date.now() - 864e5);
  // Los clientes (para nombre, ruta y GPS) se piden a la vez que los pedidos.
  const clientesP = clientes({ inactivos: true });
  clientesP.catch(() => {});
  let base;
  if (modoDemo) base = demo.pedidosEntrega();
  else base = await conCopia(async () => chk(await sb.from('pedidos')
      .select('id,numero,fecha,total,forma_pago,cliente_id,ruta_id,entregado_en,vendedor_id,pagado_en,pago_forma,pago_definido_en')
      .neq('estado', 'anulado').or(`entregado_en.is.null,entregado_en.gte.${ayer},and(pagado_en.is.null,forma_pago.neq.credito)`).order('fecha')),
    (c) => (c.pedidos || []).filter((p) => p.estado !== 'anulado' && (!p.entregado_en || p.entregado_en >= ayer || porCobrar(p))));
  const cola = local.colaPedidos().filter((x) => !base.some((p) => p.id === x.pedido.id)).map((x) => ({
    id: x.pedido.id, numero: x.pedido.numero, fecha: x.pedido.fecha, total: x.resumen.total, forma_pago: x.pedido.forma_pago,
    cliente_id: x.pedido.cliente_id, ruta_id: x.pedido.ruta_id ?? null, entregado_en: null, porSubir: true, ...pagoInicial(x.pedido) }));
  // Entregas y cobros hechos sin señal (en orden): pisan lo que dice el servidor o la copia (conMarca)
  const lista = [...base, ...cola].map((p) => conMarca(p))
    .filter((p) => !p.entregado_en || enAyer(p.entregado_en) || porCobrar(p));
  const porId = new Map((await clientesP).map((c) => [String(c.id), c]));
  return lista.map((p) => { const c = porId.get(String(p.cliente_id));
    const enCola = c ? null : local.colaPedidos().find((x) => x.pedido.id === p.id);
    const nuevo = !!enCola?.pedido.cliente_nuevo;   // cliente nuevo sin subir: se crea con límite $0
    return { ...p, cliente: c?.nombre || enCola?.resumen?.cliente || 'Cliente', ruta_id: p.ruta_id ?? c?.ruta_id ?? null, limite_credito: nuevo ? 0 : c?.limite_credito ?? null, clienteNuevo: nuevo,
      lat: c?.lat ?? null, lng: c?.lng ?? null, direccion: c?.direccion || '', comuna: c?.comuna || '', telefono: c?.telefono || '' }; });
}
// Marcar (o desmarcar) notas como entregadas. Sin señal queda en el celular y se sube solo, en orden.
export async function marcarEntrega(ids, entregado = true) {
  const entrega = { id: crypto.randomUUID(), pedidos: ids, entregado, fecha: new Date().toISOString() };
  if (modoDemo) return demo.marcarEntrega(entrega);
  // Si alguna nota todavía está en la cola, la marca va a la cola detrás de ella (se sube después del pedido).
  const enCola = ids.some((id) => local.colaPedidos().some((x) => x.pedido.id === id));
  if (!enCola && !sinSenal() && !senalDebil()) {
    try { chk(await rpcConTope('marcar_entrega', { p: entrega })); sincronizar(true); return entrega; }
    catch (e) { if (!e.sinRed) throw e; marcarRed(false); }
  }
  local.encolarEntrega({ ...entrega, sin_senal: !hayRed() }, { cliente: plural(ids.length, 'nota') });
  if (hayRed()) sincronizar();
  return entrega;
}

// Nota sin pago registrado: "pendiente" (el pago se decide al entregar) o efectivo/transferencia sin cobrar.
export const porCobrar = (p) => p.estado !== 'anulado' && (p.forma_pago === 'pendiente' || (p.forma_pago !== 'credito' && !p.pagado_en));
// Registrar el cobro de una nota (cobrado = true con forma efectivo/transferencia) o dejarla "por cobrar" (false).
// Sin señal, o si la nota aún está en la cola, va a la cola detrás de la nota.
export async function registrarCobro(pedidoId, cobrado, forma = null, resumen = {}) {
  const cobro = { id: crypto.randomUUID(), pedido_id: pedidoId, cobrado, forma: cobrado ? forma : null, fecha: new Date().toISOString() };
  if (modoDemo) return demo.registrarCobro(cobro);
  const enCola = local.colaPedidos().some((x) => x.pedido.id === pedidoId);
  if (!enCola && !sinSenal() && !senalDebil()) {
    try { chk(await rpcConTope('registrar_cobro', { p: cobro })); sincronizar(true); return cobro; }
    catch (e) { if (!e.sinRed) throw e; marcarRed(false); }
  }
  local.encolarCobro({ ...cobro, sin_senal: !hayRed() }, resumen);
  if (hayRed()) sincronizar();
  return cobro;
}

// ---------------- Cierre del día ----------------
// Notas (con forma de pago y estado) y abonos de un día de Chile (AAAA-MM-DD), más lo guardado sin subir.
// Sin señal usa la copia del celular. Devuelve { pedidos, abonos, sinRed }.
export async function cierreDia(dia) {
  const desde = new Date(Date.parse(dia + 'T00:00:00Z') - 864e5).toISOString();
  const hasta = new Date(Date.parse(dia + 'T00:00:00Z') + 2 * 864e5).toISOString();
  const delDia = (f) => diaDeChile(f) === dia;
  let base;
  if (modoDemo) base = demo.cierreDia(desde, hasta);
  else {
    base = await conCopia(async () => {
      const [pedidos, abonos] = await Promise.all([
        // Notas tomadas el día y notas cobradas el día (pueden ser de otro día: cobro al entregar)
        sb.from('pedidos').select('id,numero,fecha,total,bajo_lista,forma_pago,estado,cliente_id,pagado_en,pago_forma,pago_definido_en,clientes(nombre)')
          .or(`and(fecha.gte.${desde},fecha.lt.${hasta}),and(pagado_en.gte.${desde},pagado_en.lt.${hasta}),and(pago_definido_en.gte.${desde},pago_definido_en.lt.${hasta})`).then(chk),
        sb.from('abonos').select(CAMPOS_ABONO + ',clientes(nombre)').gte('fecha', desde).lt('fecha', hasta).then(chk),
      ]);
      return { pedidos: pedidos.map((p) => ({ ...p, cliente: p.clientes?.nombre })), abonos: abonos.map((a) => ({ ...a, cliente: a.clientes?.nombre })) };
    }, (c) => {
      const nombre = (id) => c.clientes.find((x) => mismo(x.id, id))?.nombre;
      return { sinRed: true,
        pedidos: (c.pedidos || []).map((p) => ({ ...p, cliente: nombre(p.cliente_id) })),
        abonos: (c.abonos || []).map((a) => ({ ...a, cliente: nombre(a.cliente_id) })) };
    });
  }
  const colaP = local.colaPedidos().filter((x) => !base.pedidos.some((p) => p.id === x.pedido.id)).map((x) => ({
    id: x.pedido.id, numero: x.pedido.numero, fecha: x.pedido.fecha, total: x.resumen.total, forma_pago: x.pedido.forma_pago,
    estado: 'generado', cliente_id: x.pedido.cliente_id, cliente: x.resumen.cliente, porSubir: true, ...pagoInicial(x.pedido) }));
  const colaA = local.colaAbonos().filter((x) => !base.abonos.some((a) => a.id === x.abono.id)).map((x) => ({
    ...x.abono, anulado: false, cliente: x.resumen.cliente, porSubir: true }));
  const todas = [...base.pedidos, ...colaP].map(conMarca);   // con los cobros guardados sin subir
  return {
    sinRed: !!base.sinRed,
    pedidos: todas.filter((p) => delDia(p.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    // Cobros del día: notas en efectivo o transferencia cobradas ese día (tomadas ese día u otro)
    cobrados: todas.filter((p) => p.estado !== 'anulado' && p.forma_pago !== 'credito' && p.pagado_en && delDia(p.pagado_en))
      .sort((a, b) => a.pagado_en.localeCompare(b.pagado_en)),
    // Crédito dado ese día: al entregar (pago_definido_en) o, en notas antiguas, al tomar el pedido
    creditos: todas.filter((p) => p.estado !== 'anulado' && p.forma_pago === 'credito' && delDia(p.pago_definido_en || p.fecha)),
    abonos: [...base.abonos, ...colaA].filter((a) => delDia(a.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha)),
  };
}
// ---------------- Sincronización ----------------
// Sube la cola en orden, reserva números si quedan pocos y renueva la copia del celular.
let enCurso = null;
export function sincronizar(forzarCopia = false) {
  if (modoDemo || !yo) return Promise.resolve();
  // Si ya hay una sincronización en curso y se pide renovar la copia (p. ej. tras una venta), se programa al terminar.
  if (enCurso && forzarCopia) enCurso.then(() => programarCopia(), () => {});
  if (!enCurso) enCurso = subirCola(forzarCopia).finally(() => { enCurso = null; window.dispatchEvent(new Event('coveca:cola')); });
  return enCurso;
}
async function subirCola(forzarCopia) {
  if (!(await probarRed())) { marcarRed(false); anotarSync({ subidos: 0, pendientes: local.cola().length, error: 'Sin señal' }); return; }
  let subidos = 0, ultimoError = null;
  for (const x of local.cola()) {
    if (x.estado === 'error') continue;
    // Una entrega espera a que sus notas se suban (si una quedó con problema, la entrega no se marca a medias).
    if (x.entrega && x.entrega.pedidos.some((id) => local.colaPedidos().some((y) => y.pedido.id === id))) continue;
    if (x.cobro && local.colaPedidos().some((y) => y.pedido.id === x.cobro.pedido_id)) continue;   // el cobro va después de su nota
    // El enlace cotización → nota va después de la nota y de la cotización
    if (x.cotizacionPedido && (local.colaPedidos().some((y) => y.pedido.id === x.cotizacionPedido.pedido_id) || local.colaCotizaciones().some((y) => y.cotizacion.id === x.cotizacionPedido.cotizacion_id))) continue;
    // El cambio va después de su nota y de la entrega de esa nota; la entrega de un cambio, después del cambio
    if (x.cambio && (local.colaPedidos().some((y) => y.pedido.id === x.cambio.pedido_id) || local.colaEntregas().some((y) => y.entrega.pedidos.includes(x.cambio.pedido_id)))) continue;
    if (x.entregaCambio && local.colaCambios().some((y) => y.cambio.id === x.entregaCambio.cambio_id)) continue;
    const id = local.registro(x).id;
    if (enVuelo.has(id)) continue;   // su primer envío todavía no responde: se sube en la próxima vuelta
    try {
      if (x.pedido) chk(await sb.rpc(x.pedido.cliente_nuevo ? 'crear_pedido_cliente_nuevo' : 'crear_pedido', { p: x.pedido }));
      else if (x.visita) chk(await sb.rpc('registrar_visita', { p: x.visita }));
      else if (x.entrega) chk(await sb.rpc('marcar_entrega', { p: x.entrega }));
      else if (x.cobro) chk(await sb.rpc('registrar_cobro', { p: x.cobro }));
      else if (x.cotizacion) chk(await sb.rpc('guardar_cotizacion', { p: x.cotizacion }));
      else if (x.cotizacionPedido) chk(await sb.rpc('cotizacion_a_pedido', { p_id: x.cotizacionPedido.cotizacion_id, p_pedido: x.cotizacionPedido.pedido_id }));
      else if (x.cambio) chk(await sb.rpc('registrar_cambio', { p: x.cambio }));
      else if (x.entregaCambio) chk(await sb.rpc('entregar_cambio', { p_id: x.entregaCambio.cambio_id, p_entregado: x.entregaCambio.entregado, p_fecha: x.entregaCambio.fecha }));
      else chk(await sb.rpc('registrar_abono', { p: x.abono }));
      local.quitarDeCola(id);
      subidos++;
    } catch (e) {
      const tipo = x.pedido ? 'pedido' : x.visita ? 'visita' : x.entrega ? 'entrega' : x.cobro ? 'cobro' : x.cotizacion ? 'cotización' : x.cotizacionPedido ? 'cotización convertida' : x.cambio ? 'cambio' : x.entregaCambio ? 'entrega de cambio' : 'abono';
      if (e.sinRed) { marcarRed(false); anotarSync({ subidos, pendientes: local.cola().length, error: `Se cortó la señal al subir (${tipo})` }); return; }
      // Sesión vencida: no es culpa del pedido; se reintenta tras volver a ingresar
      if (/jwt|token|sesi[oó]n/i.test(e.message)) { anotarSync({ subidos, pendientes: local.cola().length, error: `Sesión vencida (${tipo})` }); return; }
      local.marcarError(id, e.message);
      ultimoError = `${tipo} rechazado: ${e.message}`.slice(0, 200);
    }
  }
  anotarSync({ subidos, pendientes: local.cola().length, error: ultimoError });
  marcarRed(true);
  try {
    const masBajos = await hayNumerosMasBajos();   // primero, porque también limpia los números del equipo
    if (local.numerosLibres(yo.id) < 20 || masBajos) {
      local.agregarNumeros(yo.id, chk(await sb.rpc('reservar_numeros', { p_cantidad: 50 })));
    }
    // Después de una venta, abono o entrega la copia se renueva 8 s después (y una sola vez si hubo varias seguidas),
    // para no competir con la pantalla siguiente cuando la señal es justa. Si la copia es vieja (> 10 min), de inmediato.
    // Una copia de antes de la 2.0.43 no trae las notas por entregar (ticket N° 11): se renueva ya.
    // Una copia de antes de la 2.2.0 no trae los cambios ni los precios de las notas (ticket N° 12): también se renueva ya.
    if (local.edadCopia() > 10 || !local.copia()?.notasEntrega || !local.copia()?.cambios) await actualizarCopia();
    else if (subidos || forzarCopia) programarCopia();
  } catch (e) {
    if (e.sinRed) marcarRed(false);
    else console.error(e);
  }
}
// Números liberados en el servidor (migración 0055). Como máximo cada 2 h:
// 1) quita del equipo los números que el servidor ya no tiene a su nombre (así nunca se imprime uno entregado a otro);
// 2) si hay números liberados más bajos y al equipo le quedan menos de 20 antes de llegar a ellos, pide un bloque
//    para usarlos y que la numeración salga seguida.
async function hayNumerosMasBajos() {
  const ahora = Date.now();
  if (ahora - Number(leerAjuste('coveca-numeros-revisados') || 0) < 2 * 3600e3) return false;
  try {
    const [menor, mios] = await Promise.all([
      sb.rpc('numero_libre_menor').then(chk),
      sb.from('numeros_reservados').select('numero').eq('vendedor_id', yo.id).is('pedido_id', null).then(chk),
    ]);
    // Sin la lista completa (tope de filas) no se quita nada
    if (mios.length < 1000) {
      const quitados = local.quedarseCon(yo.id, new Set(mios.map((r) => Number(r.numero))));
      if (quitados) console.warn(`Números de nota quitados del equipo: ${quitados}`);
    }
    guardarAjuste('coveca-numeros-revisados', String(ahora));
    return menor != null && local.numerosMenoresQue(yo.id, Number(menor)) < 20;
  } catch { return false; }   // base sin la 0055 o falla puntual: se sigue como antes
}
export const pedidosEnCola = () => local.colaPedidos();
export const colaCompleta = () => local.cola();   // todo lo guardado sin subir
export const descartarDeCola = (id) => local.descartar(id);
export const reintentarCola = () => { local.reintentarErrores(); return sincronizar(true); };
export const edadCopia = () => local.edadCopia();
export const numerosLibres = () => (yo ? local.numerosLibres(yo.id) : 0);

let copiaProgramada = null;
function programarCopia(ms = 8000) {
  clearTimeout(copiaProgramada);
  copiaProgramada = setTimeout(() => { copiaProgramada = null; if (yo && !sinSenal()) actualizarCopia().catch(() => {}); }, ms);
}
// Descarga lo necesario para trabajar en ruta sin señal.
async function actualizarCopia() {
  const desde = new Date(Date.now() - 90 * 864e5).toISOString();
  const desdeCot = new Date(Date.now() - DIAS_COTIZACIONES * 864e5).toISOString();
  const [rutas, clientes, productos, config, pedidos, compras, fiadoNotas, fiadoClientes, abonos, cotizaciones, notasEntrega, cambios] = await Promise.all([
    sb.from('rutas').select('*').order('orden').order('nombre').then(chk),
    sb.from('clientes_estado').select('*').order('orden_ruta').order('nombre').then(chk),
    sb.from('productos').select(CAMPOS_PRODUCTO).order('nombre').then(chk),
    sb.from('configuracion').select('clave,valor').in('clave', ['negocio', 'lealtad', 'fiado']).then(chk),
    sb.from('pedidos').select('id,numero,fecha,subtotal,descuento,descuento_lealtad,nivel,total,estado,forma_pago,cliente_id,ruta_id,vendedor_id,entregado_en,pagado_en,pago_forma,pago_definido_en,vence_en,pedido_items(producto_id,cantidad,precio)').gte('fecha', desde).order('fecha', { ascending: false }).then(chk),
    sb.from('lealtad_clientes').select('*').then(chk),
    sb.from('fiado_notas').select('*').then(chk),
    sb.from('fiado_clientes').select('*').then(chk),
    sb.from('abonos').select(CAMPOS_ABONO).gte('fecha', desde).order('fecha', { ascending: false }).then(chk),
    // Si la base aún no tiene cotizaciones (migración 0051), la copia sigue sin ellas
    sb.from('cotizaciones').select(CAMPOS_COTIZACION).is('eliminada_en', null).gte('fecha', desdeCot).order('fecha', { ascending: false }).limit(300).then(chk).catch(() => []),
    // Notas por entregar completas (con sus productos): se abren, entregan y avisan sin señal. Solo estas, para que la copia no crezca.
    sb.from('pedidos').select(`*,${ITEMS_NOTA}`).is('entregado_en', null).neq('estado', 'anulado').gte('fecha', desde).order('fecha', { ascending: false }).limit(300).then(chk)
      .then((l) => l.map(({ pedido_items: items, ...n }) => ({ ...n, items: items || [] }))).catch(() => []),
    // Cambios de 90 días (ticket N° 12; si la base aún no tiene la 0056, la copia sigue sin ellos)
    sb.from('cambios').select(CAMPOS_CAMBIO).gte('fecha', desde).order('fecha', { ascending: false }).limit(300).then(chk).catch(() => []),
  ]);
  local.guardarCopia({
    rutas, clientes, productos: productos.map(conNombres), pedidos, compras, notasEntrega,
    negocio: config.find((c) => c.clave === 'negocio')?.valor || null,
    lealtad: config.find((c) => c.clave === 'lealtad')?.valor || null,
    fiado: config.find((c) => c.clave === 'fiado')?.valor || null,
    fiadoNotas, fiadoClientes, abonos, cotizaciones, cambios,
  });
}

// Copia del celular: "Visitado" se recalcula con la fecha de hoy (la copia pudo guardarse otro día). Usa las fechas
// límite que trae la vista (migración 0048); una copia anterior sin ellas queda como estaba.
function alDia(cs) {
  const hoy = hoyChile();
  return cs.map((c) => {
    if (!('visitado_hasta_compra' in c) && !('visitado_hasta_visita' in c)) return c;
    const compra = !!c.visitado_hasta_compra && c.visitado_hasta_compra >= hoy;
    const visita = !!c.visitado_hasta_visita && c.visitado_hasta_visita >= hoy;
    return { ...c, atendido: compra || visita, visita_sin_pedido: visita && !compra };
  });
}
// Un registro en cola cuenta solo dentro de su ciclo (un pedido del sábado sin subir no deja "Visitado" el lunes).
const enCiclo = (fecha, c) => c.frecuencia_dias == null || (visitadoHasta(diaDeChile(fecha || new Date()), c.frecuencia_dias) >= hoyChile());

// Los pedidos en cola ya cuentan: el cliente queda atendido y el stock se descuenta.
function conPendientes(cs) {
  // Visitas guardadas en el celular: las sin pedido y las que deja una cotización ("Visitado · cotización")
  const cola = local.colaPedidos(), visitas = [...local.colaVisitas().map((x) => ({ ...x.visita, cot: false })),
    ...local.colaCotizaciones().filter((x) => x.estado !== 'error').map((x) => ({ cliente_id: x.cotizacion.cliente_id, fecha: x.cotizacion.fecha, cot: true }))]
    .sort((a, z) => String(a.fecha).localeCompare(String(z.fecha)));
  if (!cola.length && !visitas.length) return cs;
  return cs.map((c) => {
    const suyos = cola.filter((x) => mismo(x.pedido.cliente_id, c.id));
    if (!suyos.some((x) => enCiclo(x.pedido.fecha, c))) {
      const suyas = visitas.filter((x) => mismo(x.cliente_id, c.id) && enCiclo(x.fecha, c));
      const vio = suyas.length > 0;
      if (suyos.length) {   // pedidos de un ciclo anterior aún sin subir: solo actualizan la última compra
        const ultima = suyos.map((x) => x.pedido.fecha).sort().pop().slice(0, 10);
        c = { ...c, ultima_compra: !c.ultima_compra || ultima > c.ultima_compra ? ultima : c.ultima_compra };
      }
      // La última visita del celular manda sobre la del servidor (que es anterior)
      return vio && (!c.atendido || c.visita_sin_pedido) ? { ...c, atendido: true, visita_sin_pedido: true, visita_cotizacion: suyas[suyas.length - 1].cot } : c;
    }
    const ultima = suyos.map((x) => x.pedido.fecha).sort().pop().slice(0, 10);
    return { ...c, atendido: true, visita_sin_pedido: false, ultima_compra: !c.ultima_compra || ultima > c.ultima_compra ? ultima : c.ultima_compra };
  });
}
function stockConPendientes(ps) {
  const cola = local.colaPedidos(), cams = local.colaCambios();
  if (!cola.length && !cams.length) return ps;
  const resta = new Map();
  const sumar = (id, n) => resta.set(id, (resta.get(id) || 0) + n);
  for (const x of cola) for (const i of x.pedido.items) sumar(i.producto_id, i.cantidad);
  // Cambios sin subir: lo que recibe el cliente sale de bodega; lo devuelto a bodega vuelve (lo dado de baja, no)
  for (const x of cams) for (const i of x.cambio.items) {
    if (i.sentido === 'recibe') sumar(i.producto_id, i.cantidad);
    else if (i.destino !== 'baja') sumar(i.producto_id, -i.cantidad);
  }
  return ps.map((p) => (resta.has(p.id) ? { ...p, stock: p.stock - resta.get(p.id) } : p));
}

export async function configuracion() {
  if (modoDemo) return demo.negocio;
  return conCopia(async () => {
    const filas = chk(await sb.from('configuracion').select('*').eq('clave', 'negocio'));
    return filas[0]?.valor || demo.negocio;
  }, (c) => c.negocio || demo.negocio);
}

// Guarda los datos del negocio que salen en la nota (teléfono, datos de transferencia, WhatsApp para copias). Solo admin.
export async function guardarConfiguracion(negocio) {
  if (modoDemo) { Object.assign(demo.negocio, negocio); return demo.negocio; }
  exigirSenal('Guardar los datos de la nota');
  chk(await sb.from('configuracion').upsert({ clave: 'negocio', valor: negocio }));
  programarCopia();   // la copia del celular se renueva en unos segundos
  return negocio;
}

// ---------------- Lealtad ----------------
// Reglas del programa (niveles, montos, semanas, % y beneficios). Se guardan en el celular para usarlas sin señal.
export async function programaLealtad() {
  if (modoDemo) return demo.programaLealtad();
  const guardada = () => { try { return JSON.parse(localStorage.getItem('coveca-lealtad')); } catch { return null; } };
  try {
    // Pasa por conCopia: sin señal o con señal débil responde al instante con lo guardado (la copia o la última leída).
    const cfg = await conCopia(async () => {
      const filas = chk(await sb.from('configuracion').select('valor').eq('clave', 'lealtad'));
      const v = filas[0]?.valor || { ...PROGRAMA_DEFECTO, activo: false };
      try { localStorage.setItem('coveca-lealtad', JSON.stringify(v)); } catch { /* sin espacio: se usa lo leído */ }
      return v;
    }, (c) => c.lealtad || guardada() || { ...PROGRAMA_DEFECTO, activo: false });
    return cfg;
  } catch (e) {
    const c = guardada(); if (c) return c;
    throw e;
  }
}
export async function guardarProgramaLealtad(cfg) {
  if (modoDemo) return demo.guardarProgramaLealtad(cfg);
  chk(await sb.from('configuracion').upsert({ clave: 'lealtad', valor: cfg }));
  try { localStorage.setItem('coveca-lealtad', JSON.stringify(cfg)); } catch { /* ignorar */ }
  return cfg;
}
// Compras de los últimos 90 días: de un cliente o de todos (Map cliente_id → datos).
export async function comprasLealtad(clienteId = null) {
  if (modoDemo) return demo.comprasLealtad(clienteId);
  let q = sb.from('lealtad_clientes').select('*');
  if (clienteId) q = q.eq('cliente_id', clienteId);
  const filas = await conCopia(async () => chk(await q),
    (c) => (c.compras || []).filter((f) => !clienteId || mismo(f.cliente_id, clienteId)));
  return clienteId ? (filas[0] || null) : new Map(filas.map((f) => [f.cliente_id, f]));
}

// ---------------- Revisiones automáticas (solo administradores) ----------------
export async function revisiones() {
  if (modoDemo) return demo.revisiones();
  return chk(await sb.from('revisiones').select('id,creado_en,agente,version,commit,alcance,completa,criticos,altos,medios,bajos')
    .order('creado_en', { ascending: false }).limit(40));
}
export async function revision(id) {
  if (modoDemo) return demo.revision(id);
  return chk(await sb.from('revisiones').select('*').eq('id', id).maybeSingle());
}

// ---------------- Tickets de soporte (solo administradores, migración 0042) ----------------
const nombresVendedores = async () => new Map(chk(await sb.from('vendedores').select('id,nombre')).map((x) => [x.id, x.nombre]));
export async function tickets() {
  if (modoDemo) return demo.tickets();
  const CAMPOS = 'id,numero,tipo,urgencia,descripcion,pantalla,estado,adjuntos,usuario_id,creado_en,resuelto_en,respuesta';
  const leer = (extra) => sb.from('tickets').select(CAMPOS + extra).order('creado_en', { ascending: false }).limit(200).then(chk);
  const [ts, ns] = await Promise.all([
    // Si la base aún no tiene la migración 0049 o la 0047 (columna inexistente), se leen las columnas de antes.
    leer(',etiqueta,causa,solucion,version_arreglo,aviso_estado,cierre')
      .catch((e) => (e.code === '42703' ? leer(',etiqueta,causa,solucion,version_arreglo,aviso_estado') : Promise.reject(e)))
      .catch((e) => (e.code === '42703' ? leer(',etiqueta,causa,solucion,version_arreglo') : Promise.reject(e)))
      .catch((e) => (e.code === '42703' ? leer('') : Promise.reject(e))),
    nombresVendedores()]);
  return ts.map((t) => ({ ...t, autor: ns.get(t.usuario_id) || null }));
}
export async function ticket(id) {
  if (modoDemo) return demo.ticket(id);
  const t = chk(await sb.from('tickets').select('*').eq('id', id).maybeSingle());
  if (!t) throw new Error('No se encontró el ticket. Puede que se haya borrado o que no tengas permiso.');
  const ns = t.usuario_id ? await nombresVendedores() : new Map();
  return { ...t, autor: ns.get(t.usuario_id) || null };
}
// Enlaces para ver los adjuntos (la carpeta es privada: cada enlace dura lo indicado, 1 hora por defecto).
export async function urlsAdjuntosTicket(rutas, segundos = 3600) {
  if (modoDemo || !rutas.length) return rutas;
  const { data, error } = await sb.storage.from('tickets').createSignedUrls(rutas, segundos);
  if (error) chk({ error });
  return rutas.map((r) => data.find((d) => d.path === r)?.signedUrl || null);
}
// Sube una foto o un video del ticket a <id del ticket>/<id al azar>.<ext>. Va directo (sin el tope de 20 s de las
// consultas) para que un video alcance a subir con señal lenta, y avisa el avance (0 a 1).
export async function subirAdjuntoTicket(ticketId, blob, ext, alAvanzar = () => {}) {
  if (modoDemo) { alAvanzar(1); return URL.createObjectURL(blob); }
  exigirSenal('Enviar el ticket', 'llegue a soporte');
  const ruta = `${ticketId}/${crypto.randomUUID()}.${ext}`;
  const { data } = await sb.auth.getSession();
  if (!data?.session) throw new Error('Tu sesión venció. Cierra la app, vuelve a abrirla con señal e intenta de nuevo.');
  await new Promise((ok, mal) => {
    const x = new XMLHttpRequest();
    x.open('POST', `${SUPABASE_URL}/storage/v1/object/tickets/${ruta}`);
    x.setRequestHeader('Authorization', `Bearer ${data.session.access_token}`);
    x.setRequestHeader('apikey', SUPABASE_KEY);
    x.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
    x.setRequestHeader('x-upsert', 'false');
    x.timeout = 10 * 60e3;
    x.upload.onprogress = (e) => { if (e.lengthComputable) alAvanzar(e.loaded / e.total); };
    x.onload = () => {
      if (x.status < 300) { alAvanzar(1); ok(); return; }
      const m = x.responseText || '';
      mal(new Error(x.status === 413 || /too large|exceeded|size/i.test(m) ? 'El archivo pesa demasiado (máximo 50 MB). Graba un video más corto.'
        : /mime|type/i.test(m) ? 'Ese tipo de archivo no se acepta. Usa una foto o un video del celular.'
        : x.status === 401 || x.status === 403 ? 'Tu usuario no tiene permiso para enviar tickets, o la sesión venció. Vuelve a entrar e intenta de nuevo.'
        : `No se pudo subir el archivo (código ${x.status}). Intenta de nuevo.`));
    };
    x.onerror = () => mal(new Error('Se cortó la señal mientras se subía el archivo. Intenta de nuevo cuando tengas buena señal.'));
    x.ontimeout = () => mal(new Error('La subida tardó demasiado. Intenta de nuevo con mejor señal o con un video más corto.'));
    x.send(blob);
  });
  return ruta;
}
export async function crearTicket(p) {
  if (modoDemo) return demo.crearTicket(p);
  exigirSenal('Enviar el ticket', 'llegue a soporte');
  const r = await sb.rpc('crear_ticket', { p });
  // Base sin la migración 0047: no acepta capturas. El ticket va sin ellas y las ya subidas se borran (muestran clientes).
  if (r.error && /no es foto ni video/i.test(r.error.message)) {
    const caps = p.adjuntos.filter((a) => a.tipo === 'captura').map((a) => a.ruta);
    await sb.storage.from('tickets').remove(caps).catch(() => {});
    return chk(await sb.rpc('crear_ticket', { p: { ...p, adjuntos: p.adjuntos.filter((a) => a.tipo !== 'captura') } }));
  }
  return chk(r);
}
export async function estadoTicket(id, estado, respuesta = null) {
  if (modoDemo) return demo.estadoTicket(id, estado, respuesta);
  exigirSenal('Cambiar el ticket', 'el cambio quede guardado');
  return chk(await sb.rpc('estado_ticket', { p_id: id, p_estado: estado, p_respuesta: respuesta }));
}
// Resuelve con su solución (base de conocimiento, migración 0047) o corrige la de uno ya resuelto.
export async function resolverTicket(p) {
  if (modoDemo) return demo.resolverTicket(p);
  exigirSenal('Resolver el ticket', 'la solución quede guardada');
  return chk(await sb.rpc('resolver_ticket', { p }));
}
// Avisos de tickets propios que pasaron a En revisión o Resuelto (migración 0049). Sin señal, sin la migración o
// si falla la consulta: null (se vuelve a revisar después). No es administrador: lista vacía.
export async function avisosTickets() {
  if (modoDemo) return demo.avisosTickets();
  if (!esAdmin()) return [];
  if (sinSenal()) return null;
  const { data, error } = await sb.rpc('tickets_avisos');
  return error ? null : data || [];
}
// Tickets de error propios "Por confirmar" a los que toca preguntar (migración 0053; no más de una vez cada 30 min).
// Sin señal, sin la migración o si falla: null. No es administrador: lista vacía.
export async function ticketsPorConfirmar() {
  if (modoDemo) return demo.ticketsPorConfirmar();
  if (!esAdmin()) return [];
  if (sinSenal()) return null;
  const { data, error } = await sb.rpc('tickets_por_confirmar');
  return error ? null : data || [];
}
// Respuesta de quien reportó: 'mostrado', 'funciona', 'falla' (con nota) o 'despues'. Devuelve { estado, cierre }.
export async function confirmarTicket(id, respuesta, nota = null) {
  if (modoDemo) return demo.confirmarTicket(id, respuesta, nota);
  exigirSenal('Responder el ticket', 'tu respuesta quede guardada');
  const filas = chk(await sb.rpc('ticket_confirmacion', { p_id: id, p_respuesta: respuesta, p_nota: nota }));
  return filas?.[0] || {};
}
export async function avisoTicketVisto(id) {
  if (modoDemo) return demo.avisoTicketVisto(id);
  if (sinSenal()) return false;
  const { error } = await sb.rpc('ticket_aviso_visto', { p_id: id });
  return !error;
}
// Diferencia en segundos entre el reloj del celular y el del servidor (positivo = el celular va adelantado).
// null si no se pudo medir (sin señal, modo de ejemplo).
export async function desfaseReloj() {
  if (modoDemo || sinSenal()) return null;
  const t0 = Date.now();
  const { data, error } = await sb.rpc('hora_servidor');
  if (error || !data) return null;
  const t1 = Date.now();
  return Math.round(((t0 + t1) / 2 - Date.parse(data)) / 1000);
}
// WhatsApp que recibe el aviso de cada ticket (configuracion, clave "soporte").
export async function soporte() {
  if (modoDemo) return demo.soporte();
  const filas = chk(await sb.from('configuracion').select('valor').eq('clave', 'soporte'));
  return filas[0]?.valor || {};
}
export async function guardarSoporte(valor) {
  if (modoDemo) return demo.guardarSoporte(valor);
  exigirSenal('Guardar el WhatsApp de soporte', 'el cambio quede guardado');
  chk(await sb.from('configuracion').upsert({ clave: 'soporte', valor }));
  return valor;
}
// Borra el video y las capturas de los tickets resueltos hace más de 7 días (Storage no permite borrarlos desde la
// base). Las fotos quedan. Devuelve cuántos tickets se limpiaron. Si algo falla, se reintenta otro día.
export async function limpiarVideosTickets() {
  if (modoDemo || !esAdmin() || sinSenal()) return 0;
  let nueva = true, vencidos;
  try { vencidos = chk(await sb.rpc('tickets_adjuntos_vencidos')); }
  catch (e) {   // base sin la migración 0047 todavía: solo videos, como antes
    if (e.sinRed) throw e;
    nueva = false; vencidos = chk(await sb.rpc('tickets_videos_vencidos'));
  }
  let n = 0;
  for (const { id, rutas } of vencidos) {
    const { error } = await sb.storage.from('tickets').remove(rutas);
    if (error) continue;
    chk(await sb.rpc(nueva ? 'ticket_adjuntos_borrados' : 'ticket_video_borrado', { p_id: id }));
    n++;
  }
  return n;
}

// Errores silenciosos (migración 0050): sube los errores guardados en el celular. Devuelve true si el servidor los
// recibió. Nunca lanza: un fallo aquí no debe anotar otro error (se daría vueltas) ni molestar a quien vende.
export async function registrarErrores(errores, version, plataforma) {
  if (modoDemo || !yo || sinSenal() || senalDebil() || !errores.length) return false;
  try {
    const { error } = await sb.rpc('registrar_errores', { p: { version, plataforma, errores } });
    return !error;
  } catch (_) { return false; }
}

// Versión vigente publicada (la escribe GitHub al compilar). Funciona sin sesión.
export async function versionVigente() {
  const { data, error } = await sb.rpc('version_app');
  if (error) throw new Error(error.message);
  return data;
}
