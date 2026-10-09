// Capa de datos. Por ahora usa DATOS DE EJEMPLO en memoria (inventados) para mostrar la app.
// En el siguiente paso cada función se conecta a Supabase manteniendo los mismos nombres,
// así las pantallas no cambian.

const hoy = new Date();
const haceDias = (n) => new Date(hoy.getTime() - n * 864e5).toISOString().slice(0, 10);

let usuario = { nombre: 'Jose Daniel', correo: 'demo@coveca.cl', rol: 'admin', terminal: 'Movil 1' };

const rutas = [
  { id: 1, nombre: 'Cauquenes', dia_semana: 1, activa: true },
  { id: 2, nombre: 'Retiro', dia_semana: 2, activa: true },
  { id: 3, nombre: 'San Carlos', dia_semana: 3, activa: true },
  { id: 4, nombre: 'Parral', dia_semana: 4, activa: true },
  { id: 5, nombre: 'Pelluhue', dia_semana: 5, activa: true },
  { id: 6, nombre: 'Chanco', dia_semana: 5, activa: true },
];

const n = (id, nombre, ruta_id, extra = {}) => ({
  id, nombre, ruta_id, frecuencia_dias: 7, razon_social: null, rut: null, contacto: null, direccion: null,
  comuna: rutas.find((r) => r.id === ruta_id)?.nombre ?? null, telefono: null, correo: null, limite_credito: 0,
  notas: null, activo: true, loyverse_primera_compra: haceDias(400), loyverse_ultima_compra: haceDias(10),
  loyverse_compras: 12, loyverse_total: 480000, ...extra,
});
const clientes = [
  n(1, 'Minimarket El Roble', 1, { razon_social: 'Comercial El Roble SpA', rut: '76.123.456-0', telefono: '+56 9 1111 2222', direccion: 'Av. Principal 123', loyverse_compras: 53, loyverse_total: 1739225 }),
  n(2, 'Almacén Doña Rosa', 1, { telefono: '+56 9 3333 4444', loyverse_compras: 50, loyverse_total: 2522990 }),
  n(3, 'Botillería Las Palmas', 1, { frecuencia_dias: 14 }),
  n(4, 'Kiosco La Esquina', 2, { loyverse_compras: 71, loyverse_total: 1513630 }),
  n(5, 'Minimarket San Juan', 2, { correo: 'contacto@ejemplo.cl' }),
  n(6, 'Comercial Los Aromos', 2),
  n(7, 'Almacén Central', 3, { loyverse_compras: 37 }),
  n(8, 'Distribuidora Norte', 3, { telefono: '+56 9 5555 6666', notas: 'Recibe pedidos solo en la mañana.' }),
  n(9, 'Minimarket Doña Carmen', 3),
  n(10, 'Almacén El Sol', 4),
  n(11, 'Kiosco Playa', 5, { loyverse_ultima_compra: haceDias(200) }),
  n(12, 'Almacén Costa', 6),
  n(13, 'Distribuidora El Puerto', null, { loyverse_compras: 44, loyverse_total: 2999136 }),
  n(14, 'Minimarket Las Flores', null),
  n(15, 'Almacén Don Pepe', null, { loyverse_compras: 3, loyverse_total: 45000, loyverse_ultima_compra: haceDias(300) }),
];

const categorias = ['Aseo', 'Bebestibles', 'Chicles', 'Chocolates', 'Colombina', 'Galletas', 'Mabu', 'Mondelez'].map((nombre, i) => ({ id: i + 1, nombre }));
const p = (id, ref, nombre, cat, costo, precio, stock, extra = {}) => ({
  id, ref, nombre, categoria_id: categorias.find((c) => c.nombre === cat)?.id ?? null,
  costo, precio, stock, stock_minimo: null, codigo_barras: null, activo: true, descripcion: null, ...extra,
});
const productos = [
  p(1, '10058', 'Afeitadora Gillette 3 Blue x10', 'Aseo', 8250, 9900, 2),
  p(2, '10155', 'Afeitadora Gillette 3 x 12und', 'Aseo', 10200, 12750, 6),
  p(3, '10123', 'Alfajor Game Blanco 60gr x24', 'Chocolates', 6672, 8190, -1),
  p(4, '10093', 'Alfajor Panchote', 'Chocolates', 4824, 6000, 0, { stock_minimo: 3 }),
  p(5, '10054', 'Aloe Vera Berries x6', 'Bebestibles', 4620, 5700, 0),
  p(6, '10033', 'BigTime Aqua x20und', 'Chicles', 5690, 6690, 3),
  p(7, '10034', 'BigTime Menta x20', 'Chicles', 5690, 6690, 4, { stock_minimo: 6 }),
  p(8, '10048', 'BigTime Refrescante x20', 'Chicles', 5690, 6690, 1),
  p(9, '10095', 'Bon Bon Bum Colombineta x24', 'Colombina', 1550, 1950, 7),
  p(10, '10148', 'Bon o Bon original sobre x5', 'Chocolates', 790, 990, -5),
  p(11, '10061', 'Choco Tiffany x20 20gr', 'Chocolates', 4180, 5000, 2),
  p(12, '10153', 'Halls Menta x12 und', 'Mondelez', 3100, 3950, 4),
  p(13, '10163', 'Oreo Chocolate 108gr', 'Mondelez', 589, 685, 40),
  p(14, '10094', 'Super 8 Oblea Clásica x24', 'Chocolates', 4890, 5990, -8),
  p(15, '10064', 'Chocolate Trencito imp x20', 'Chocolates', 3890, 5500, -5),
  p(16, '10125', 'Galleta Duo Cacao 500gr', 'Galletas', 2190, 2650, 1),
  p(17, 'Cov22', 'Candy Gel Paw Patrol x12', 'Mabu', 5270, 6900, 0),
  p(18, '10137', 'Bolsa de basura mediana 70 x 90 rollo x10', 'Aseo', 665, 840, 42),
];

// Pedidos generados en esta sesión (para marcar clientes atendidos)
const pedidos = [];
let siguienteNota = 1;

const copia = (o) => JSON.parse(JSON.stringify(o));
const espera = () => new Promise((r) => setTimeout(r, 60));   // simula red
const sinTildes = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function atendido(c) {
  const desde = new Date(hoy.getTime() - (c.frecuencia_dias - 1) * 864e5).toISOString().slice(0, 10);
  return pedidos.some((pd) => pd.cliente_id === c.id && pd.estado !== 'anulado' && pd.fecha.slice(0, 10) >= desde);
}
function conEstado(c) {
  const ruta = rutas.find((r) => r.id === c.ruta_id);
  const ult = pedidos.filter((pd) => pd.cliente_id === c.id).map((pd) => pd.fecha.slice(0, 10)).sort().pop();
  return { ...copia(c), ruta_nombre: ruta?.nombre ?? null, atendido: atendido(c), ultima_compra: ult || c.loyverse_ultima_compra };
}

export const datos = {
  esDemo: true,

  // ----- Sesión -----
  async usuarioActual() { return usuario ? copia(usuario) : null; },
  async ingresar(correo) { await espera(); usuario = { ...usuario, correo }; return copia(usuario); },
  async salir() { usuario = null; },
  esAdmin() { return usuario?.rol === 'admin'; },

  // ----- Rutas -----
  async listarRutas() {
    await espera();
    return rutas.filter((r) => r.activa).map((r) => {
      const cl = clientes.filter((c) => c.ruta_id === r.id && c.activo);
      return { ...copia(r), clientes: cl.length, atendidos: cl.filter(atendido).length };
    }).sort((a, b) => (a.dia_semana || 9) - (b.dia_semana || 9) || a.nombre.localeCompare(b.nombre));
  },
  async clientesSinRuta() { await espera(); return clientes.filter((c) => !c.ruta_id && c.activo).map(conEstado); },
  async obtenerRuta(id) { await espera(); const r = rutas.find((x) => x.id === Number(id)); return r ? copia(r) : null; },
  async clientesDeRuta(id) {
    await espera();
    return clientes.filter((c) => c.ruta_id === Number(id) && c.activo).map(conEstado)
      .sort((a, b) => a.atendido - b.atendido || a.nombre.localeCompare(b.nombre));
  },
  async guardarRuta(r) {
    await espera();
    if (!r.nombre) throw new Error('La ruta necesita un nombre.');
    if (rutas.some((x) => sinTildes(x.nombre) === sinTildes(r.nombre) && x.id !== r.id)) throw new Error('Ya existe una ruta con ese nombre.');
    if (r.id) Object.assign(rutas.find((x) => x.id === r.id), r);
    else { r.id = Math.max(0, ...rutas.map((x) => x.id)) + 1; r.activa = true; rutas.push(r); }
    return copia(r);
  },
  async asignarClientesARuta(rutaId, ids) {
    await espera();
    for (const c of clientes) if (ids.includes(c.id)) c.ruta_id = Number(rutaId);
  },

  // ----- Clientes -----
  async listarClientes(texto = '') {
    await espera();
    const t = sinTildes(texto);
    return clientes.filter((c) => c.activo && (!t || sinTildes(`${c.nombre} ${c.razon_social} ${c.rut} ${c.comuna}`).includes(t)))
      .map(conEstado).sort((a, b) => a.nombre.localeCompare(b.nombre));
  },
  async obtenerCliente(id) { await espera(); const c = clientes.find((x) => x.id === Number(id)); return c ? conEstado(c) : null; },
  async pedidosDeCliente(id) { await espera(); return copia(pedidos.filter((pd) => pd.cliente_id === Number(id)).reverse()); },
  async guardarCliente(c) {
    await espera();
    if (!c.nombre) throw new Error('El cliente necesita un nombre.');
    if (c.id) Object.assign(clientes.find((x) => x.id === c.id), c);
    else { c.id = Math.max(0, ...clientes.map((x) => x.id)) + 1; clientes.push(n(c.id, c.nombre, c.ruta_id, { ...c, loyverse_compras: null, loyverse_total: null, loyverse_ultima_compra: null, loyverse_primera_compra: null })); }
    return conEstado(clientes.find((x) => x.id === c.id));
  },

  // ----- Productos e inventario -----
  async listarCategorias() { return copia(categorias); },
  async guardarCategoria(nombre) { const c = { id: categorias.length + 1, nombre }; categorias.push(c); return c; },
  async listarProductos(texto = '') {
    await espera();
    const t = sinTildes(texto);
    return productos.filter((x) => x.activo && (!t || sinTildes(`${x.nombre} ${x.ref}`).includes(t)))
      .map((x) => ({ ...copia(x), categoria: categorias.find((c) => c.id === x.categoria_id)?.nombre ?? null }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  },
  async obtenerProducto(id) { await espera(); const x = productos.find((y) => y.id === Number(id)); return x ? copia(x) : null; },
  async guardarProducto(x) {
    await espera();
    if (!x.nombre) throw new Error('El producto necesita un nombre.');
    if (x.precio == null || x.precio < 0) throw new Error('Indica un precio válido.');
    if (x.id) Object.assign(productos.find((y) => y.id === x.id), x);
    else { x.id = Math.max(0, ...productos.map((y) => y.id)) + 1; productos.push({ stock: 0, activo: true, ...x }); }
    return copia(productos.find((y) => y.id === x.id));
  },
  async ajustarStock(id, cantidad) {
    await espera();
    const x = productos.find((y) => y.id === Number(id)); x.stock += Number(cantidad); return copia(x);
  },

  // ----- Pedidos -----
  async crearPedido(pd) {
    await espera();
    const items = pd.items.map((it) => {
      const pr = productos.find((y) => y.id === it.producto_id);
      pr.stock -= it.cantidad;
      return { ...it, nombre: pr.nombre, precio: it.precio ?? pr.precio, subtotal: it.cantidad * (it.precio ?? pr.precio) };
    });
    const subtotal = items.reduce((s, it) => s + it.subtotal, 0);
    const nuevo = { ...pd, numero: siguienteNota++, fecha: new Date().toISOString(), estado: 'generado', items, subtotal,
                    total: Math.max(0, subtotal - (pd.descuento || 0)) };
    pedidos.push(nuevo);
    return copia(nuevo);
  },
};
