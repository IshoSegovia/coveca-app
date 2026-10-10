// Datos de ejemplo para ver y probar la app sin conexión ni usuario (modo demostración).
// Los clientes son ficticios; los productos son una muestra del catálogo.
let rutas = [
  { id: 1, nombre: 'Cauquenes', dia_semana: 1, orden: 1, activa: true, base_nombre: 'Bodega de ejemplo', base_lat: -35.9515, base_lng: -72.198 },
  { id: 2, nombre: 'Retiro', dia_semana: 2, orden: 2, activa: true },
  { id: 3, nombre: 'San Carlos', dia_semana: 3, orden: 3, activa: true },
  { id: 4, nombre: 'Parral', dia_semana: 4, orden: 4, activa: true },
];
const hoy = new Date(); const dias = (n) => new Date(hoy - n * 864e5).toISOString().slice(0, 10);
let clientes = [
  { id: 1, lat: -35.9671, lng: -72.3225, nombre: 'Minimarket El Ejemplo', razon_social: 'Comercial Ejemplo SpA', rut: '76.123.456-0', comuna: 'Cauquenes', direccion: 'Av. Principal 123', telefono: '+56 9 1111 1111', correo: 'ejemplo@correo.cl', ruta_id: 1, frecuencia_dias: 7, limite_credito: 100000, loyverse_compras: 53, loyverse_total: 1739225, loyverse_primera_compra: '2025-08-26', loyverse_ultima_compra: dias(2), notas: 'Atiende la dueña en la mañana.' },
  { id: 2, lat: -35.9612, lng: -72.3301, nombre: 'Almacén Doña Prueba', comuna: 'Cauquenes', direccion: 'Pasaje Los Aromos 45', ruta_id: 1, frecuencia_dias: 7, loyverse_compras: 50, loyverse_total: 2522990, loyverse_ultima_compra: dias(9) },
  { id: 3, lat: -35.9738, lng: -72.3159, nombre: 'Botillería La Muestra', comuna: 'Cauquenes', ruta_id: 1, frecuencia_dias: 14, loyverse_compras: 12, loyverse_total: 340000, loyverse_ultima_compra: dias(20) },
  { id: 4, lat: -36.0472, lng: -71.7578, nombre: 'Distribuidora Demo Retiro', comuna: 'Retiro', ruta_id: 2, frecuencia_dias: 7, loyverse_compras: 49, loyverse_total: 1429110, loyverse_ultima_compra: dias(1) },
  { id: 5, nombre: 'Kiosco Central', comuna: 'Retiro', ruta_id: 2, frecuencia_dias: 7, loyverse_compras: 8, loyverse_total: 120000, loyverse_ultima_compra: dias(15) },
  { id: 6, lat: -36.4246, lng: -71.958, nombre: 'Minimarket San Carlos Demo', comuna: 'San Carlos', ruta_id: 3, frecuencia_dias: 7, loyverse_compras: 37, loyverse_total: 1152575, loyverse_ultima_compra: dias(4) },
  { id: 7, nombre: 'Almacén Parral Ejemplo', comuna: 'Parral', ruta_id: 4, frecuencia_dias: 14, loyverse_compras: 31, loyverse_total: 1230970, loyverse_ultima_compra: dias(35) },
  { id: 8, nombre: 'Cliente sin ruta de ejemplo', ruta_id: null, frecuencia_dias: 7, loyverse_compras: 3, loyverse_total: 45000, loyverse_ultima_compra: dias(60) },
];
const cats = [{ id: 1, nombre: 'Aseo' }, { id: 2, nombre: 'Chicles' }, { id: 3, nombre: 'Chocolates' }, { id: 4, nombre: 'Colombina' }, { id: 5, nombre: 'Mondelez' }];
let productos = [
  ['10058', 'Afeitadora Gillette 3 Blue x10', 1, 8250, 9900, 2], ['10034', 'BigTime Menta x20', 2, 5690, 6690, 4],
  ['10048', 'BigTime Refrescante x20', 2, 5690, 6690, 1], ['10095', 'Bon Bon Bum Colombineta x24', 4, 1550, 1950, 7],
  ['10028', 'Bon Bon Bum Surtido x24', 4, 1550, 1950, 8], ['10148', 'Bon o Bon original sobre x5', 3, 790, 990, -5],
  ['10061', 'Choco Tiffany x20 20gr', 3, 4180, 5000, 2], ['10064', 'Chocolate Trencito imp x20', 3, 3890, 5500, -5],
  ['10093', 'Alfajor Panchote', 3, 4824, 6000, 0], ['10153', 'Halls Menta x12 und', 5, 3100, 3950, 4],
  ['10042', 'Oreo Tradicional 108gr', 5, 592, 685, -15], ['10094', 'Super 8 Oblea Clásica x24', 3, 4890, 5990, 12],
  ['10137', 'Bolsa de basura mediana 70 x 90 rollo x10', 1, 665, 840, 42],
].map(([ref, nombre, categoria_id, costo, precio, stock], i) => ({ id: i + 1, ref, nombre, categoria_id, costo, precio, stock, stock_minimo: 3, activo: true }));
let pedidos = [];
let numero = 0;

const atendido = (c) => pedidos.some((p) => p.cliente_id === c.id && (hoy - new Date(p.fecha)) / 864e5 < c.frecuencia_dias);
const enriquecer = (c) => ({ ...c, activo: true, ruta_nombre: rutas.find((r) => r.id === c.ruta_id)?.nombre || null,
  atendido: atendido(c), ultima_compra: pedidos.filter((p) => p.cliente_id === c.id).map((p) => p.fecha.slice(0, 10)).sort().pop() || c.loyverse_ultima_compra });
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const demo = {
  yo: { id: 'demo', nombre: 'Demostración', rol: 'admin', terminal: 'Movil 1' },
  negocio: { nombre: 'COVECA', eslogan: 'Su comercializadora de confianza', telefono: '+56 9 7587 0827',
    leyenda: 'Este documento no representa una factura, solo es una nota de venta y guía de despacho.' },
  rutas() {
    const cs = clientes.map(enriquecer);
    const lista = rutas.map((r) => { const s = cs.filter((c) => c.ruta_id === r.id); return { ...r, clientes: s.length, atendidos: s.filter((c) => c.atendido).length }; });
    const sin = cs.filter((c) => !c.ruta_id);
    if (sin.length) lista.push({ id: 'sin', nombre: 'Sin ruta', clientes: sin.length, atendidos: 0, especial: true });
    return lista;
  },
  ruta: (id) => rutas.find((r) => r.id == id),
  guardarRuta(r) {
    if (r.id) { rutas = rutas.map((x) => (x.id == r.id ? { ...x, ...r } : x)); return rutas.find((x) => x.id == r.id); }
    const n = { ...r, id: Math.max(0, ...rutas.map((x) => x.id)) + 1 }; rutas.push(n); return n;
  },
  clientes({ busqueda, rutaId }) {
    return clientes.map(enriquecer).filter((c) => (rutaId === 'sin' ? !c.ruta_id : rutaId ? c.ruta_id == rutaId : true)
      && (!busqueda || norm(c.nombre + ' ' + (c.comuna || '')).includes(norm(busqueda)))).sort((a, b) => (a.orden_ruta || 0) - (b.orden_ruta || 0) || a.nombre.localeCompare(b.nombre));
  },
  cliente: (id) => enriquecer(clientes.find((c) => c.id == id)),
  guardarCliente(c) {
    if (c.id) { clientes = clientes.map((x) => (x.id == c.id ? { ...x, ...c } : x)); return clientes.find((x) => x.id == c.id); }
    const n = { ...c, id: Math.max(0, ...clientes.map((x) => x.id)) + 1 }; clientes.push(n); return n;
  },
  pedidosCliente: (id) => pedidos.filter((p) => p.cliente_id == id).slice().reverse(),
  categorias: () => cats,
  productos: ({ busqueda }) => productos.filter((p) => !busqueda || norm(p.nombre + ' ' + p.ref).includes(norm(busqueda)))
    .map((p) => ({ ...p, categoria: cats.find((c) => c.id === p.categoria_id)?.nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
  producto: (id) => productos.find((p) => p.id == id),
  guardarProducto(p) {
    const { stock_inicial, ...campos } = p;
    if (p.id) { productos = productos.map((x) => (x.id == p.id ? { ...x, ...campos } : x)); return productos.find((x) => x.id == p.id); }
    const n = { ...campos, stock: stock_inicial || 0, id: Math.max(0, ...productos.map((x) => x.id)) + 1 }; productos.push(n); return n;
  },
  ubicacion(id, lat, lng) { const c = clientes.find((x) => x.id == id); c.lat = lat; c.lng = lng; c.ubicacion_actualizada_en = lat == null ? null : new Date().toISOString(); },
  ordenar(ids) { ids.forEach((id, i) => { clientes.find((x) => x.id == id).orden_ruta = i + 1; }); },
  fotoCliente(id, url) { clientes.find((x) => x.id == id).imagen_url = url; return url; },
  fotoProducto(id, url) { productos.find((x) => x.id == id).imagen_url = url; return url; },
  ajustarStock(id, cant) { const p = productos.find((x) => x.id == id); p.stock += cant; },
  crearPedido(p) {
    const items = p.items.map((i) => { const pr = productos.find((x) => x.id == i.producto_id); pr.stock -= i.cantidad; return { ...i, precio: i.precio ?? pr.precio }; });
    const sub = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
    const ped = { id: p.id, numero: ++numero, cliente_id: p.cliente_id, fecha: new Date().toISOString(), total: Math.max(0, sub - (p.descuento || 0)), subtotal: sub, descuento: p.descuento || 0, estado: 'generado', forma_pago: p.forma_pago };
    pedidos.push(ped); return ped;
  },
};
