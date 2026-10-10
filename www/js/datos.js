// Capa de datos: Supabase cuando hay sesión; datos de ejemplo (modo demostración) si no.
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { demo } from './demo.js';
import { PROGRAMA_DEFECTO } from './lealtad.js';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'coveca-sesion' },
});

let modoDemo = false;
let yo = null; // { id, nombre, rol, terminal }

export const enDemo = () => modoDemo;
export const usuario = () => yo;
export const esAdmin = () => yo?.rol === 'admin';

function chk({ data, error }) {
  if (error) throw new Error(traducir(error.message));
  return data;
}
function traducir(m) {
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sin conexión a internet. Revisa la señal e intenta de nuevo.';
  if (/sin permiso|permission|row-level security|Unauthorized/i.test(m)) return 'Tu usuario no tiene permiso para esta acción.';
  if (/no está en Chile/i.test(m)) return m;
  if (/Payload too large|exceeded/i.test(m)) return 'La foto es demasiado pesada. Prueba con otra.';
  if (/duplicate key.*rutas_nombre/i.test(m)) return 'Ya existe una ruta con ese nombre.';
  if (/duplicate key.*productos_ref/i.test(m)) return 'Ya existe un producto con esa REF.';
  if (/duplicate key.*proveedores_nombre/i.test(m)) return 'Ya existe un proveedor con ese nombre.';
  return m;
}

// ---------------- Sesión ----------------
export async function iniciar() {
  if (localStorage.getItem('coveca-demo') === '1') { modoDemo = true; yo = demo.yo; return true; }
  const { data } = await sb.auth.getSession();
  if (!data.session) return false;
  return cargarPerfil(data.session.user.id);
}
async function cargarPerfil(id) {
  const v = chk(await sb.from('vendedores').select('id,nombre,rol,terminal,activo').eq('id', id).maybeSingle());
  if (!v || !v.activo) { await sb.auth.signOut(); throw new Error('Tu usuario no está activo. Pide a un administrador que lo active.'); }
  yo = v;
  return true;
}
export async function entrar(correo, clave) {
  const d = chk(await sb.auth.signInWithPassword({ email: correo, password: clave }));
  return cargarPerfil(d.user.id);
}
export function entrarDemo() { localStorage.setItem('coveca-demo', '1'); modoDemo = true; yo = demo.yo; }
export async function salir() {
  localStorage.removeItem('coveca-demo');
  if (!modoDemo) await sb.auth.signOut();
  modoDemo = false; yo = null;
}

// ---------------- Rutas ----------------
export async function rutas() {
  if (modoDemo) return demo.rutas();
  const rs = chk(await sb.from('rutas').select('*').order('orden').order('nombre'));
  const cs = chk(await sb.from('clientes_estado').select('id,ruta_id,atendido').eq('activo', true));
  return conConteo(rs, cs);
}
export function conConteo(rs, cs) {
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
  return chk(await sb.from('rutas').select('*').eq('id', id).single());
}
export async function guardarRuta(r) {
  if (modoDemo) return demo.guardarRuta(r);
  const { id, ...campos } = r;
  return id
    ? chk(await sb.from('rutas').update(campos).eq('id', id).select().single())
    : chk(await sb.from('rutas').insert(campos).select().single());
}

// ---------------- Clientes ----------------
const CAMPOS_LISTA = 'id,imagen_url,lat,lng,nombre,razon_social,comuna,direccion,ruta_id,ruta_nombre,frecuencia_dias,atendido,ultima_compra,telefono,activo,orden_ruta';
export async function clientes({ busqueda = '', rutaId = null } = {}) {
  if (modoDemo) return demo.clientes({ busqueda, rutaId });
  let q = sb.from('clientes_estado').select(CAMPOS_LISTA).eq('activo', true);
  if (rutaId === 'sin') q = q.is('ruta_id', null);
  else if (rutaId) q = q.eq('ruta_id', rutaId);
  if (busqueda) q = q.or(`nombre.ilike.%${busqueda}%,razon_social.ilike.%${busqueda}%,rut.ilike.%${busqueda}%,comuna.ilike.%${busqueda}%`);
  return chk(await q.order('orden_ruta').order('nombre'));
}
export async function cliente(id) {
  if (modoDemo) return demo.cliente(id);
  return chk(await sb.from('clientes_estado').select('*').eq('id', id).single());
}
export async function guardarCliente(c) {
  if (modoDemo) return demo.guardarCliente(c);
  const { id, ...campos } = c;
  return id
    ? chk(await sb.from('clientes').update(campos).eq('id', id).select().single())
    : chk(await sb.from('clientes').insert(campos).select().single());
}
export async function subirFotoCliente(clienteId, blob) {
  if (modoDemo) return demo.fotoCliente(clienteId, URL.createObjectURL(blob));
  const ruta = `${clienteId}/${Date.now()}.jpg`;
  chk(await sb.storage.from('clientes').upload(ruta, blob, { contentType: 'image/jpeg', upsert: false }));
  const url = sb.storage.from('clientes').getPublicUrl(ruta).data.publicUrl;
  chk(await sb.rpc('foto_cliente', { p_id: Number(clienteId), p_url: url }));
  return url;
}
export async function quitarFotoCliente(clienteId) {
  if (modoDemo) return demo.fotoCliente(clienteId, null);
  chk(await sb.rpc('foto_cliente', { p_id: Number(clienteId), p_url: null }));
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
  return chk(await sb.from('pedidos').select('id,numero,fecha,total,estado,forma_pago').eq('cliente_id', id).order('fecha', { ascending: false }).limit(20));
}

// ---------------- Productos / inventario ----------------
export async function categorias() {
  if (modoDemo) return demo.categorias();
  return chk(await sb.from('categorias').select('*').order('nombre'));
}
// ---------------- Proveedores ----------------
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
  const { id, ...campos } = p;
  return id
    ? chk(await sb.from('proveedores').update(campos).eq('id', id).select().single())
    : chk(await sb.from('proveedores').insert(campos).select().single());
}

export async function productos({ busqueda = '', soloActivos = true } = {}) {
  if (modoDemo) return demo.productos({ busqueda });
  let q = sb.from('productos').select('id,ref,nombre,costo,precio,stock,stock_minimo,activo,imagen_url,categoria_id,categorias(nombre),proveedor_id,proveedores(nombre)');
  if (soloActivos) q = q.eq('activo', true);
  if (busqueda) q = q.or(`nombre.ilike.%${busqueda}%,ref.ilike.%${busqueda}%`);
  return chk(await q.order('nombre')).map((p) => ({ ...p, categoria: p.categorias?.nombre || null, proveedor: p.proveedores?.nombre || null }));
}
export async function producto(id) {
  if (modoDemo) return demo.producto(id);
  return chk(await sb.from('productos').select('*').eq('id', id).single());
}
export async function guardarProducto(p) {
  if (modoDemo) return demo.guardarProducto(p);
  const { id, stock_inicial, ...campos } = p;
  campos.actualizado_en = new Date().toISOString();
  const r = id
    ? chk(await sb.from('productos').update(campos).eq('id', id).select().single())
    : chk(await sb.from('productos').insert(campos).select().single());
  if (!id && stock_inicial) await ajustarStock(r.id, stock_inicial, 'inicial');
  return r;
}
// Foto de producto: se sube a Storage (carpeta "productos") y se guarda el enlace público.
export async function subirFotoProducto(productoId, blob) {
  if (modoDemo) return demo.fotoProducto(productoId, URL.createObjectURL(blob));
  const ruta = `${productoId}/${Date.now()}.jpg`;
  chk(await sb.storage.from('productos').upload(ruta, blob, { contentType: 'image/jpeg', upsert: false }));
  const url = sb.storage.from('productos').getPublicUrl(ruta).data.publicUrl;
  chk(await sb.from('productos').update({ imagen_url: url }).eq('id', productoId));
  return url;
}
export async function quitarFotoProducto(productoId) {
  if (modoDemo) return demo.fotoProducto(productoId, null);
  chk(await sb.from('productos').update({ imagen_url: null }).eq('id', productoId));
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
    .select('id,numero,fecha,total,subtotal,descuento,forma_pago,estado,cliente_id,clientes(nombre),pedido_items(producto_id,nombre,cantidad,precio,costo,subtotal)')
    .gte('fecha', desde.toISOString()).lt('fecha', hasta.toISOString())
    .order('fecha'))
    .map((p) => ({ ...p, cliente: p.clientes?.nombre || '—', items: p.pedido_items || [] }));
}

export async function crearPedido(p) {
  if (modoDemo) return demo.crearPedido(p);
  return chk(await sb.rpc('crear_pedido', { p }));
}

export async function configuracion() {
  if (modoDemo) return demo.negocio;
  const filas = chk(await sb.from('configuracion').select('*').eq('clave', 'negocio'));
  return filas[0]?.valor || demo.negocio;
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
  const filas = chk(await q);
  return clienteId ? (filas[0] || null) : new Map(filas.map((f) => [f.cliente_id, f]));
}

// Versión vigente publicada (la escribe GitHub al compilar). Funciona sin sesión.
export async function versionVigente() {
  const { data, error } = await sb.rpc('version_app');
  if (error) throw new Error(error.message);
  return data;
}
