// Capa de datos: Supabase cuando hay sesión; datos de ejemplo (modo demostración) si no.
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { demo } from './demo.js';
import { PROGRAMA_DEFECTO } from './lealtad.js';
import * as local from './local.js';
import { normal, diaChile as diaDeChile, plural } from './ui.js';
import { repartir, vencimiento, diasExtra, PLAZO_DEFECTO } from './fiado.js';

// Con señal débil una consulta puede quedar colgada: después de 20 s se da por perdida
// y la app sigue con lo guardado en el celular. Un fallo de red se informa como "AbortError"
// para que la librería no reintente 3 veces (eso dejaba cada pantalla ~7 s esperando);
// los reintentos de pedidos los hace la cola.
function fetchConLimite(url, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  opts.signal?.addEventListener('abort', () => ctl.abort());
  return fetch(url, { ...opts, signal: ctl.signal })
    .catch((e) => { throw e?.name === 'AbortError' ? e : new DOMException(`Failed to fetch (${e?.message || 'sin red'})`, 'AbortError'); })
    .finally(() => clearTimeout(t));
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
async function conCopia(enLinea, sinLinea) {
  if (sinSenal() && local.hayCopia()) { marcarRed(false); return sinLinea(local.copia()); }
  try {
    const r = await enLinea();
    marcarRed(true);
    return r;
  } catch (e) {
    if (e.sinRed && local.hayCopia()) { marcarRed(false); return sinLinea(local.copia()); }
    throw e;
  }
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
    return `No se pudo completar la acción. Intenta de nuevo; si sigue, envía a Francisco este mensaje: ${m}`;
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
  setTimeout(sincronizar, 500); // sube lo pendiente, reserva números y renueva la copia
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
}

// ---------------- Rutas ----------------
export async function rutas() {
  if (modoDemo) return demo.rutas();
  return conCopia(async () => {
    const rs = chk(await sb.from('rutas').select('*').order('orden').order('nombre'));
    const cs = chk(await sb.from('clientes_estado').select('id,ruta_id,atendido').eq('activo', true));
    return conConteo(rs, conPendientes(cs));
  }, (c) => conConteo(c.rutas, conPendientes(c.clientes.filter((x) => x.activo))));
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
const CAMPOS_LISTA = 'id,imagen_url,lat,lng,nombre,razon_social,rut,comuna,direccion,ruta_id,ruta_nombre,frecuencia_dias,atendido,ultima_compra,telefono,activo,orden_ruta';
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
    return conPendientes(c.clientes.filter((x) => (inactivos || x.activo)
      && (rutaId === 'sin' ? !x.ruta_id : !rutaId || mismo(x.ruta_id, rutaId))
      && coincide(x)))
      .sort((a, z) => (a.orden_ruta ?? Infinity) - (z.orden_ruta ?? Infinity) || a.nombre.localeCompare(z.nombre));
  });
}
export async function cliente(id) {
  if (modoDemo) return demo.cliente(id);
  return conCopia(async () => conPendientes([chk(await sb.from('clientes_estado').select('*').eq('id', id).single())])[0],
    (c) => {
      const x = c.clientes.find((k) => mismo(k.id, id));
      if (!x) throw new Error('Este cliente no está guardado en el celular. Ábrelo cuando tengas señal.');
      return conPendientes([x])[0];
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
export async function proveedores() {
  if (modoDemo) return demo.proveedores();
  const ps = chk(await sb.from('proveedores').select('*').order('nombre'));
  const cuentas = chk(await sb.from('productos').select('proveedor_id').not('proveedor_id', 'is', null));
  return ps.map((p) => ({ ...p, productos: cuentas.filter((c) => c.proveedor_id === p.id).length }));
}
export async function proveedor(id) {
  if (modoDemo) return demo.proveedor(id);
  return chk(await sb.from('proveedores').select('*').eq('id', id).single());
}
export async function productosDeProveedor(id) {
  if (modoDemo) return demo.productosDeProveedor(id);
  return chk(await sb.from('productos').select('id,nombre,stock,precio,activo').eq('proveedor_id', id).order('nombre'));
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
const CAMPOS_PRODUCTO = 'id,ref,codigo_barras,nombre,marca,costo,precio,stock,stock_minimo,activo,imagen_url,categoria_id,categorias(nombre),proveedor_id,proveedores(nombre)';
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
  actualizarCopia().catch(() => {});
  return r;
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
  actualizarCopia().catch(() => {});
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

// Ventas de esta semana (lunes a domingo, días de Chile) para la tarjeta "Tu semana" del inicio: total y días con ventas.
// Funciona sin señal (copia del celular + pedidos en cola).
export async function semanaVentas() {
  const hoy = diaDeChile(Date.now());
  const d = new Date(hoy + 'T12:00:00Z'), dow = (d.getUTCDay() + 6) % 7;   // 0 = lunes
  const lunes = new Date(d.getTime() - dow * 864e5).toISOString().slice(0, 10);
  const desde = new Date(Date.parse(lunes + 'T00:00:00Z') - 864e5).toISOString();   // margen por zona horaria
  const base = modoDemo ? demo.ventas(new Date(desde), new Date(Date.now() + 864e5))
    : await conCopia(async () => chk(await sb.from('pedidos').select('id,fecha,total,estado').gte('fecha', desde)), (c) => c.pedidos || []);
  const cola = local.colaPedidos().map((x) => ({ id: x.pedido.id, fecha: x.pedido.fecha, total: x.resumen.total, estado: 'generado' }));
  const todas = [...base, ...cola.filter((q) => !base.some((p) => p.id === q.id))]
    .filter((p) => p.estado !== 'anulado' && diaDeChile(p.fecha) >= lunes && diaDeChile(p.fecha) <= hoy);
  const dias = new Set(todas.map((p) => Math.round((Date.parse(diaDeChile(p.fecha)) - Date.parse(lunes)) / 864e5)));
  return { total: todas.reduce((s, p) => s + (Number(p.total) || 0), 0), dias, hoy: dow, notas: todas.length };
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
  if (!sinSenal()) {
    try {
      const r = chk(await sb.rpc('crear_pedido', { p: pedido }));
      marcarRed(true);
      sincronizar();
      return r;
    } catch (e) {
      if (!e.sinRed) { local.devolverNumero(yo.id, numero); throw e; }
    }
  }
  marcarRed(false);
  pedido.sin_senal = true;
  local.encolar(pedido, resumen);
  return { id: pedido.id, numero, fecha: pedido.fecha, total: resumen.total, descuento_lealtad: p.descuento_lealtad, porSubir: true };
}

// Nombre de un producto desde la copia del celular (pedidos en cola guardados antes de que llevaran el nombre).
const nombreProducto = (id) => local.copia()?.productos?.find((x) => mismo(x.id, id))?.nombre || `Producto ${id}`;

// Detalle de una nota (con sus productos, quién la anuló y qué nota la reemplaza).
export async function pedido(id) {
  if (modoDemo) return demo.pedido(id);
  const enCola = local.colaPedidos().find((x) => x.pedido.id === id);
  if (enCola) return conMarca({ ...enCola.pedido, ...pagoInicial(enCola.pedido), cliente: enCola.resumen.cliente, total: enCola.resumen.total, estado: 'generado', porSubir: true,
    vendedor_id: yo.id, items: enCola.pedido.items.map((i) => ({ ...i, nombre: i.nombre || nombreProducto(i.producto_id), subtotal: i.cantidad * i.precio })) });
  const p = chk(await sb.from('pedidos').select('*,clientes(nombre,telefono),pedido_items(producto_id,nombre,cantidad,precio,precio_lista,costo,subtotal)').eq('id', id).maybeSingle());
  if (!p) throw new Error('No se encontró esta nota.');
  const [reemplazo, original, vend] = await Promise.all([
    sb.from('pedidos').select('id,numero').eq('reemplaza_a', id).maybeSingle().then(chk),
    p.reemplaza_a ? sb.from('pedidos').select('id,numero').eq('id', p.reemplaza_a).maybeSingle().then(chk) : null,
    sb.from('vendedores').select('nombre').eq('id', p.vendedor_id).maybeSingle().then(chk).catch(() => null), // un vendedor solo ve su propio nombre
  ]);
  return conMarca({ ...p, cliente: p.clientes?.nombre || '—', telefonoCliente: p.clientes?.telefono || '', items: p.pedido_items || [], reemplazado_por: reemplazo, reemplaza: original, vendedor: vend?.nombre || null });
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
export async function anularPedido(id, motivo) {
  if (modoDemo) return demo.anularPedido(id, motivo);
  exigirSenal('Anular un pedido');
  const r = chk(await sb.rpc('anular_pedido', { p_id: id, p_motivo: motivo }));
  actualizarCopia().catch(() => {});
  return r;
}
// Editar = anular la nota original y crear una nueva que la reemplaza (otro número), en una sola operación.
export async function reemplazarPedido(id, motivo, p) {
  if (modoDemo) return demo.reemplazarPedido(id, motivo, p);
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
  if (!sinSenal()) {
    try {
      const r = chk(await sb.rpc('registrar_abono', { p: abono }));
      sincronizar(true);
      return r;
    } catch (e) { if (!e.sinRed) throw e; }
  }
  marcarRed(false);
  local.encolarAbono({ ...abono, sin_senal: true }, resumen);
  return { ...abono, porSubir: true };
}
export async function anularAbono(id, motivo) {
  if (modoDemo) return demo.anularAbono(id, motivo);
  exigirSenal('Anular un abono');
  const r = chk(await sb.rpc('anular_abono', { p_id: id, p_motivo: motivo }));
  actualizarCopia().catch(() => {});
  return r;
}

// Marcar un cliente como visitado sin pedido. Sin señal queda en el celular y se sube solo (se identifica por su id).
export async function registrarVisita(clienteId, nombre) {
  const visita = { id: crypto.randomUUID(), cliente_id: clienteId, fecha: new Date().toISOString() };
  if (modoDemo) return demo.registrarVisita(visita);
  if (!sinSenal()) {
    try {
      chk(await sb.rpc('registrar_visita', { p: visita }));
      sincronizar(true);   // renueva la copia: así "Visitado" se ve también sin señal
      return visita;
    } catch (e) { if (!e.sinRed) throw e; }
  }
  marcarRed(false);
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

// ---------------- Entregas (pestaña Pedidos) ----------------
// Notas vigentes por entregar (de cualquier fecha) y las entregadas desde ayer (día de Chile), con su cliente y ruta.
// Suma lo guardado en el celular: pedidos por subir (por entregar) y marcas de entrega por subir.
export async function pedidosEntrega() {
  const ayer = new Date(Date.parse(diaDeChile(Date.now() - 864e5) + 'T00:00:00Z') - 864e5).toISOString(); // margen de 1 día por zona horaria
  const enAyer = (f) => diaDeChile(f) >= diaDeChile(Date.now() - 864e5);
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
  const porId = new Map((await clientes({ inactivos: true })).map((c) => [String(c.id), c]));
  return lista.map((p) => { const c = porId.get(String(p.cliente_id));
    return { ...p, cliente: c?.nombre || 'Cliente', ruta_id: p.ruta_id ?? c?.ruta_id ?? null, limite_credito: c?.limite_credito ?? null,
      lat: c?.lat ?? null, lng: c?.lng ?? null, direccion: c?.direccion || '', comuna: c?.comuna || '' }; });
}
// Marcar (o desmarcar) notas como entregadas. Sin señal queda en el celular y se sube solo, en orden.
export async function marcarEntrega(ids, entregado = true) {
  const entrega = { id: crypto.randomUUID(), pedidos: ids, entregado, fecha: new Date().toISOString() };
  if (modoDemo) return demo.marcarEntrega(entrega);
  // Si alguna nota todavía está en la cola, la marca va a la cola detrás de ella (se sube después del pedido).
  const enCola = ids.some((id) => local.colaPedidos().some((x) => x.pedido.id === id));
  if (!enCola && !sinSenal()) {
    try { chk(await sb.rpc('marcar_entrega', { p: entrega })); sincronizar(true); return entrega; }
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
  if (!enCola && !sinSenal()) {
    try { chk(await sb.rpc('registrar_cobro', { p: cobro })); sincronizar(true); return cobro; }
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
  if (!enCurso) enCurso = subirCola(forzarCopia).finally(() => { enCurso = null; window.dispatchEvent(new Event('coveca:cola')); });
  return enCurso;
}
async function subirCola(forzarCopia) {
  if (!(await probarRed())) { marcarRed(false); return; }
  let subidos = 0;
  for (const x of local.cola()) {
    if (x.estado === 'error') continue;
    // Una entrega espera a que sus notas se suban (si una quedó con problema, la entrega no se marca a medias).
    if (x.entrega && x.entrega.pedidos.some((id) => local.colaPedidos().some((y) => y.pedido.id === id))) continue;
    if (x.cobro && local.colaPedidos().some((y) => y.pedido.id === x.cobro.pedido_id)) continue;   // el cobro va después de su nota
    const id = (x.pedido || x.abono || x.visita || x.entrega || x.cobro).id;
    try {
      if (x.pedido) chk(await sb.rpc('crear_pedido', { p: x.pedido }));
      else if (x.visita) chk(await sb.rpc('registrar_visita', { p: x.visita }));
      else if (x.entrega) chk(await sb.rpc('marcar_entrega', { p: x.entrega }));
      else if (x.cobro) chk(await sb.rpc('registrar_cobro', { p: x.cobro }));
      else chk(await sb.rpc('registrar_abono', { p: x.abono }));
      local.quitarDeCola(id);
      subidos++;
    } catch (e) {
      if (e.sinRed) { marcarRed(false); return; }
      // Sesión vencida: no es culpa del pedido; se reintenta tras volver a ingresar
      if (/jwt|token|sesi[oó]n/i.test(e.message)) return;
      local.marcarError(id, e.message);
    }
  }
  marcarRed(true);
  try {
    if (local.numerosLibres(yo.id) < 20) {
      local.agregarNumeros(yo.id, chk(await sb.rpc('reservar_numeros', { p_cantidad: 50 })));
    }
    if (subidos || forzarCopia || local.edadCopia() > 10) await actualizarCopia();
  } catch (e) {
    if (e.sinRed) marcarRed(false);
    else console.error(e);
  }
}
export const pedidosEnCola = () => local.colaPedidos();
export const colaCompleta = () => local.cola();   // pedidos y abonos
export const descartarDeCola = (id) => local.descartar(id);
export const reintentarCola = () => { local.reintentarErrores(); return sincronizar(true); };
export const edadCopia = () => local.edadCopia();
export const numerosLibres = () => (yo ? local.numerosLibres(yo.id) : 0);

// Descarga lo necesario para trabajar en ruta sin señal.
async function actualizarCopia() {
  const desde = new Date(Date.now() - 90 * 864e5).toISOString();
  const [rutas, clientes, productos, config, pedidos, compras, fiadoNotas, fiadoClientes, abonos] = await Promise.all([
    sb.from('rutas').select('*').order('orden').order('nombre').then(chk),
    sb.from('clientes_estado').select('*').order('orden_ruta').order('nombre').then(chk),
    sb.from('productos').select(CAMPOS_PRODUCTO).order('nombre').then(chk),
    sb.from('configuracion').select('clave,valor').in('clave', ['negocio', 'lealtad', 'fiado']).then(chk),
    sb.from('pedidos').select('id,numero,fecha,total,estado,forma_pago,cliente_id,ruta_id,entregado_en,pagado_en,pago_forma,pago_definido_en,vence_en,pedido_items(producto_id,cantidad)').gte('fecha', desde).order('fecha', { ascending: false }).then(chk),
    sb.from('lealtad_clientes').select('*').then(chk),
    sb.from('fiado_notas').select('*').then(chk),
    sb.from('fiado_clientes').select('*').then(chk),
    sb.from('abonos').select(CAMPOS_ABONO).gte('fecha', desde).order('fecha', { ascending: false }).then(chk),
  ]);
  local.guardarCopia({
    rutas, clientes, productos: productos.map(conNombres), pedidos, compras,
    negocio: config.find((c) => c.clave === 'negocio')?.valor || null,
    lealtad: config.find((c) => c.clave === 'lealtad')?.valor || null,
    fiado: config.find((c) => c.clave === 'fiado')?.valor || null,
    fiadoNotas, fiadoClientes, abonos,
  });
}

// Los pedidos en cola ya cuentan: el cliente queda atendido y el stock se descuenta.
function conPendientes(cs) {
  const cola = local.colaPedidos(), visitas = local.colaVisitas();
  if (!cola.length && !visitas.length) return cs;
  return cs.map((c) => {
    const suyos = cola.filter((x) => mismo(x.pedido.cliente_id, c.id));
    if (!suyos.length) {
      const vio = visitas.some((x) => mismo(x.visita.cliente_id, c.id));
      return vio && !c.atendido ? { ...c, atendido: true, visita_sin_pedido: true } : c;
    }
    const ultima = suyos.map((x) => x.pedido.fecha).sort().pop().slice(0, 10);
    return { ...c, atendido: true, visita_sin_pedido: false, ultima_compra: !c.ultima_compra || ultima > c.ultima_compra ? ultima : c.ultima_compra };
  });
}
function stockConPendientes(ps) {
  const cola = local.colaPedidos();
  if (!cola.length) return ps;
  const resta = new Map();
  for (const x of cola) for (const i of x.pedido.items) resta.set(i.producto_id, (resta.get(i.producto_id) || 0) + i.cantidad);
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
  actualizarCopia().catch(() => {});
  return negocio;
}

// ---------------- Lealtad ----------------
// Reglas del programa (niveles, montos, semanas, % y beneficios). Se guardan en el celular para usarlas sin señal.
export async function programaLealtad() {
  if (modoDemo) return demo.programaLealtad();
  try {
    const filas = chk(await sb.from('configuracion').select('valor').eq('clave', 'lealtad'));
    const cfg = filas[0]?.valor || { ...PROGRAMA_DEFECTO, activo: false };
    try { localStorage.setItem('coveca-lealtad', JSON.stringify(cfg)); } catch { /* sin espacio: se usa lo leído */ }
    return cfg;
  } catch (e) {
    try { const c = JSON.parse(localStorage.getItem('coveca-lealtad')); if (c) return c; } catch { /* nada guardado */ }
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

// Versión vigente publicada (la escribe GitHub al compilar). Funciona sin sesión.
export async function versionVigente() {
  const { data, error } = await sb.rpc('version_app');
  if (error) throw new Error(error.message);
  return data;
}
