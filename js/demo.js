// Datos de ejemplo para ver y probar la app sin conexión ni usuario (modo demostración).
// Los clientes son ficticios; los productos son una muestra del catálogo.
import { PROGRAMA_DEFECTO } from './lealtad.js';
import { normal } from './ui.js';
import { repartir, vencimiento, diasExtra, superaLimite } from './fiado.js';
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
  { id: 8, nombre: 'Cliente sin ruta de ejemplo', ruta_id: null, frecuencia_dias: 7 },  // cliente nuevo: nunca ha comprado
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
let proveedores = [
  { id: 1, nombre: 'Distribuidora Ejemplo Sur', contacto: 'Pedro Ejemplo', telefono: '+56 9 0000 0001', correo: 'ventas@ejemplo-sur.cl', activo: true },
  { id: 2, nombre: 'Mayorista Demo', activo: true },
];
const MARCAS = { 1: 'Gillette', 2: 'BigTime', 3: 'BigTime', 4: 'Colombina', 5: 'Colombina', 6: 'Arcor', 7: 'Costa', 8: 'Costa', 9: 'Panchote', 10: 'Halls', 11: 'Oreo', 12: 'Costa' };
productos.forEach((p) => { p.marca = MARCAS[p.id] || null; });
productos.forEach((p) => { p.proveedor_id = [1, 2, 3, 4, 5].includes(p.categoria_id) ? (p.categoria_id % 2) + 1 : null; });
productos[productos.length - 1].proveedor_id = null;
let pedidos = [];
// Compras de ejemplo (la mercadería ya está sumada en el stock de arriba).
let compras = [
  { id: 'demo-compra-1', proveedor_id: 1, tipo_documento: 'factura', documento: '4521', fecha: dias(3), estado: 'vigente', usuario_id: 'demo',
    creado_en: dias(3) + 'T15:00:00.000Z', notas: null, fotos: [],
    items: [{ producto_id: 1, cantidad: 10, costo: 8250, costo_anterior: 8100, precio_anterior: 9900, precio_nuevo: null },
      { producto_id: 2, cantidad: 20, costo: 5690, costo_anterior: 5690, precio_anterior: 6690, precio_nuevo: null }] },
];
const totalCompra = (c) => c.items.reduce((s, i) => s + i.cantidad * i.costo, 0);
// Informes de ejemplo de los agentes de revisión automática.
const haceHoras = (h) => new Date(Date.now() - h * 36e5).toISOString();
const revisionesDemo = [
  { id: 3, creado_en: haceHoras(2), agente: 'qa', version: '0.1.52', commit: 'a1b2c3d', criticos: 0, altos: 1, medios: 1, bajos: 0, costo_usd: 0.03,
    informe: `# Revisión de calidad (QA)

Resumen: Ejemplo de informe. Se revisaron los cambios del pedido. Las pruebas automáticas pasaron.

## Hallazgos
### [Alto] El descuento puntual puede superar el total
- Dónde: \`www/js/vistas/pedido.js:120\`
- Cómo se provoca: agregar un producto de $5.990 y escribir un descuento de $9.000.
- Esperado / obtenido: la app debería avisar; hoy genera una nota con total $0.
- Cómo corregirlo: limitar el descuento al subtotal y mostrar un aviso.

### [Medio] Nombre largo se corta en la nota impresa
- Dónde: \`www/render.js:88\`
- Cómo se provoca: imprimir "Bolsa de basura mediana 70 x 90 rollo x10".
- Esperado / obtenido: debería seguir en la línea siguiente; se corta al final.
- Cómo corregirlo: partir el nombre en líneas de 32 columnas.

RESUMEN: criticos=0 altos=1 medios=1 bajos=0` },
  { id: 2, creado_en: haceHoras(2), agente: 'seguridad', version: '0.1.52', commit: 'a1b2c3d', criticos: 0, altos: 0, medios: 0, bajos: 0, costo_usd: 0.02,
    informe: `# Revisión de seguridad

Resumen: Ejemplo de informe. Se revisaron los cambios en la base de datos y los permisos.

Sin hallazgos en los cambios revisados.

RESUMEN: criticos=0 altos=0 medios=0 bajos=0` },
  { id: 1, creado_en: haceHoras(30), agente: 'seguridad', version: '0.1.51', commit: '9f8e7d6', criticos: 0, altos: 0, medios: 1, bajos: 1, costo_usd: 0.02,
    informe: `# Revisión de seguridad

Resumen: Ejemplo de informe con hallazgos menores.

## Hallazgos
### [Medio] Ejemplo de hallazgo medio
- Dónde: \`supabase/migrations/0001_inicial.sql:290\`
- Qué pasa: texto de ejemplo.
- Cómo se comprobaría: texto de ejemplo.
- Cómo corregirlo: texto de ejemplo.

RESUMEN: criticos=0 altos=0 medios=1 bajos=1` },
];
let numero = 0;
// Ventas de ejemplo en lo que va de la semana (para ver el reporte en modo demostración).
{
  const lunes = new Date(hoy); lunes.setHours(10, 0, 0, 0); lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  const ejemplo = [[0, 4, 'efectivo', [[12, 2], [2, 1]]], [0, 5, 'transferencia', [[4, 3]]], [1, 6, 'credito', [[9, 2], [10, 1], [13, 4]]],
    [2, 7, 'efectivo', [[12, 3], [7, 1]]], [3, 4, 'efectivo', [[2, 2], [3, 1]]]];
  for (const [d, cliente, pago, its] of ejemplo) {
    const f = new Date(lunes); f.setDate(f.getDate() + d); f.setHours(10 + d);
    if (f > hoy) continue;
    // La segunda nota de ejemplo se vendió $300 bajo el precio de lista (para ver el aviso al administrador).
    const rebaja = numero === 1 ? 300 : 0;
    const items = its.map(([pid, cant]) => { const pr = productos.find((x) => x.id === pid); const precio = pr.precio - rebaja;
      return { producto_id: pid, nombre: pr.nombre, cantidad: cant, precio, precio_lista: pr.precio, costo: pr.costo, subtotal: cant * precio }; });
    const sub = items.reduce((a, i) => a + i.subtotal, 0);
    const bajo = items.reduce((a, i) => a + Math.max(i.precio_lista - i.precio, 0) * i.cantidad, 0);
    pedidos.push({ id: 'demo-' + numero, numero: ++numero, cliente_id: cliente, fecha: f.toISOString(), subtotal: sub, descuento: 0, total: sub, bajo_lista: bajo, estado: 'generado', forma_pago: pago, items });
  }
}

// Historial de las semanas anteriores (solo para ver el programa de lealtad en modo demostración):
// Quedan: "Minimarket San Carlos Demo" Platino, "Minimarket El Ejemplo" Oro, "Distribuidora Demo Retiro" Plata
// (por bajar) y "Almacén Doña Prueba" Bronce cerca de Plata.
{
  const hist = [[1, [9, 16, 23, 30, 37, 44, 51, 58, 72], 52000], [2, [10, 24, 38], 41000], [4, [12, 40, 66, 80], 48000],
    [6, [8, 15, 22, 29, 36, 43, 50, 57, 64, 71, 78], 80000]];
  for (const [cliente, dias, monto] of hist) for (const d of dias) {
    const f = new Date(hoy - d * 864e5); f.setHours(11, 0, 0, 0);
    pedidos.push({ id: `hist-${cliente}-${d}`, numero: 0, cliente_id: cliente, fecha: f.toISOString(), subtotal: monto, descuento: 0, descuento_lealtad: 0,
      total: monto, estado: 'generado', forma_pago: 'efectivo', items: [], historial: true });
  }
}
let programa = JSON.parse(JSON.stringify(PROGRAMA_DEFECTO));

// Fiado de ejemplo: "Minimarket El Ejemplo" con una nota atrasada y un abono; "Kiosco Central" sobre su límite.
let reglasFiado = { plazo_dias: 15 };
let abonos = [];
{
  const nota = (cliente, d, total, n) => {
    const f = new Date(hoy - d * 864e5); f.setHours(12, 0, 0, 0);
    const items = [{ producto_id: 12, nombre: 'Super 8 Oblea Clásica x24', cantidad: n, precio: 5990, costo: 4890, subtotal: n * 5990 }];
    pedidos.push({ id: `fiado-${cliente}-${d}`, numero: ++numero, cliente_id: cliente, fecha: f.toISOString(), subtotal: total, descuento: 0, descuento_lealtad: 0, total,
      estado: 'generado', forma_pago: 'credito', items, vence_en: vencimiento(f.toISOString(), clientes.find((c) => c.id === cliente).plazo_credito_dias || reglasFiado.plazo_dias) });
  };
  clientes.find((c) => c.id === 1).plazo_credito_dias = 7;
  nota(1, 24, 47920, 8); nota(1, 5, 29950, 5);
  abonos.push({ id: 'abono-demo-1', cliente_id: 1, monto: 30000, forma_pago: 'efectivo', fecha: new Date(hoy - 10 * 864e5).toISOString(), vendedor_id: 'demo', anulado: false });
  // Un abono el lunes de esta semana (para ver el cierre del día)
  const lun = new Date(hoy); lun.setHours(15, 0, 0, 0); lun.setDate(lun.getDate() - ((lun.getDay() + 6) % 7));
  if (lun <= hoy) abonos.push({ id: 'abono-demo-2', cliente_id: 1, monto: 10000, forma_pago: 'transferencia', fecha: lun.toISOString(), vendedor_id: 'demo', anulado: false });
  clientes.find((c) => c.id === 5).limite_credito = 50000;
  nota(5, 3, 59900, 10);
  pedidos[pedidos.length - 1].sobre_limite = true;
}
const notasFiado = (id) => pedidos.filter((p) => p.forma_pago === 'credito' && p.estado !== 'anulado' && p.cliente_id == id && !p.historial)
  .map((p) => ({ pedido_id: p.id, numero: p.numero, fecha: p.fecha, total: p.total, vence_en: p.vence_en, sobre_limite: !!p.sobre_limite }));
const abonadoDe = (id) => abonos.filter((a) => a.cliente_id == id && !a.anulado).reduce((s, a) => s + a.monto, 0);
const semana = (f) => { const d = new Date(f); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
function comprasDe(id) {
  const desde = hoy - programa.dias * 864e5, corte = hoy - (programa.dias - 30) * 864e5;
  const ps = pedidos.filter((p) => p.cliente_id == id && p.estado !== 'anulado' && new Date(p.fecha) >= desde);
  const sem = (lista) => new Set(lista.map((p) => semana(p.fecha))).size;
  const en30 = ps.filter((p) => new Date(p.fecha) >= corte);
  const c = clientes.find((x) => x.id == id);
  return { alguna_compra: (c?.loyverse_compras || 0) > 0 || pedidos.some((p) => p.cliente_id == id && p.estado !== 'anulado'), cliente_id: Number(id), monto: ps.reduce((s, p) => s + p.total, 0), semanas: sem(ps), compras: ps.length,
    monto_en_30: en30.reduce((s, p) => s + p.total, 0), semanas_en_30: sem(en30), compro_esta_semana: ps.some((p) => semana(p.fecha) === semana(hoy)) };
}

const compro = (c) => pedidos.some((p) => p.cliente_id === c.id && p.estado !== 'anulado' && (hoy - new Date(p.fecha)) / 864e5 < c.frecuencia_dias);
// Visitas sin pedido (de ejemplo: un cliente de la primera ruta que no ha comprado en su ciclo).
const visitas = [];
{ const c = clientes.find((x) => x.ruta_id === rutas[0]?.id && x.activo !== false && !compro(x));
  if (c) visitas.push({ id: 'v-demo', cliente_id: c.id, fecha: new Date(hoy - 3600e3).toISOString(), anulada: false }); }
const vio = (c) => visitas.some((v) => v.cliente_id == c.id && !v.anulada && (hoy - new Date(v.fecha)) / 864e5 < c.frecuencia_dias);
const enriquecer = (c) => ({ ...c, activo: c.activo !== false, ruta_nombre: rutas.find((r) => r.id === c.ruta_id)?.nombre || null,
  atendido: compro(c) || vio(c), visita_sin_pedido: !compro(c) && vio(c), ultima_compra: pedidos.filter((p) => p.cliente_id === c.id).map((p) => p.fecha.slice(0, 10)).sort().pop() || c.loyverse_ultima_compra });

// Entregas de ejemplo: las notas de antes de ayer se entregaron al día siguiente de tomarlas; las de ayer y hoy, por entregar.
for (const p of pedidos) if (!p.historial && hoy - new Date(p.fecha) > 1.5 * 864e5) p.entregado_en = new Date(Date.parse(p.fecha) + 864e5).toISOString();
// Pagos de ejemplo: las notas ya entregadas se pagaron (efectivo/transferencia/crédito); las que faltan por entregar
// todavía no tienen forma de pago (se decide al entregar). La entregada ayer más reciente quedó sin pago registrado.
for (const p of pedidos) if (p.forma_pago !== 'credito') { p.pagado_en = p.fecha; p.pago_forma = p.forma_pago; }
for (const p of pedidos) if (!p.historial && !p.entregado_en) { p.forma_pago = 'pendiente'; p.pagado_en = null; p.pago_forma = null; p.vence_en = null; }

export const demo = {
  yo: { id: 'demo', nombre: 'Demostración', rol: 'admin', terminal: 'Movil 1' },
  negocio: { nombre: 'COVECA', meta_semanal: 150000, eslogan: 'Su comercializadora de confianza', telefono: '+56 9 7587 0827',
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
  clientes({ busqueda, rutaId, inactivos }) {
    return clientes.map(enriquecer).filter((c) => (inactivos || c.activo !== false) && (rutaId === 'sin' ? !c.ruta_id : rutaId ? c.ruta_id == rutaId : true)
      && (!busqueda || normal(c.nombre + ' ' + (c.comuna || '')).includes(normal(busqueda)))).sort((a, b) => (a.orden_ruta || 0) - (b.orden_ruta || 0) || a.nombre.localeCompare(b.nombre));
  },
  cliente: (id) => enriquecer(clientes.find((c) => c.id == id)),
  guardarCliente(c) {
    if (c.id) { clientes = clientes.map((x) => (x.id == c.id ? { ...x, ...c } : x)); return clientes.find((x) => x.id == c.id); }
    const n = { ...c, id: Math.max(0, ...clientes.map((x) => x.id)) + 1 }; clientes.push(n); return n;
  },
  pedidosCliente: (id) => pedidos.filter((p) => p.cliente_id == id && !p.historial).slice().reverse(),
  categorias: () => cats,
  marcas: () => [...new Set(productos.map((p) => p.marca).filter(Boolean))].sort(),
  productos: ({ busqueda }) => productos.filter((p) => !busqueda || normal(p.nombre + ' ' + p.ref + ' ' + (p.marca || '')).includes(normal(busqueda)))
    .map((p) => ({ ...p, categoria: cats.find((c) => c.id === p.categoria_id)?.nombre, proveedor: proveedores.find((x) => x.id === p.proveedor_id)?.nombre || null })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
  proveedores: () => proveedores.map((p) => ({ ...p, productos: productos.filter((x) => x.proveedor_id === p.id).length })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
  proveedor: (id) => proveedores.find((p) => p.id == id),
  productosDeProveedor: (id) => productos.filter((p) => p.proveedor_id == id),
  guardarProveedor(p) {
    if (p.id) { proveedores = proveedores.map((x) => (x.id == p.id ? { ...x, ...p } : x)); return proveedores.find((x) => x.id == p.id); }
    const n = { ...p, id: Math.max(0, ...proveedores.map((x) => x.id)) + 1 }; proveedores.push(n); return n;
  },
  producto: (id) => productos.find((p) => p.id == id),
  guardarProducto(p) {
    const { stock_inicial, ...campos } = p;
    if (p.id) { productos = productos.map((x) => (x.id == p.id ? { ...x, ...campos } : x)); return productos.find((x) => x.id == p.id); }
    const n = { ...campos, stock: stock_inicial || 0, id: Math.max(0, ...productos.map((x) => x.id)) + 1 }; productos.push(n); return n;
  },
  anonimizarCliente(id) {
    const c = clientes.find((x) => x.id == id);
    Object.assign(c, { nombre: `Cliente eliminado N° ${c.id}`, razon_social: null, rut: null, contacto: null, direccion: null, comuna: null,
      lat: null, lng: null, telefono: null, correo: null, imagen_url: null, notas: null, activo: false, anonimizado_en: new Date().toISOString() });
  },
  ubicacion(id, lat, lng) { const c = clientes.find((x) => x.id == id); c.lat = lat; c.lng = lng; c.ubicacion_actualizada_en = lat == null ? null : new Date().toISOString(); },
  ordenar(ids) { ids.forEach((id, i) => { clientes.find((x) => x.id == id).orden_ruta = i + 1; }); },
  fotoCliente(id, url) { clientes.find((x) => x.id == id).imagen_url = url; return url; },
  fotoProducto(id, url) { productos.find((x) => x.id == id).imagen_url = url; return url; },
  ajustarStock(id, cant) { const p = productos.find((x) => x.id == id); p.stock += cant; },
  compras: ({ proveedorId }) => compras.filter((c) => !proveedorId || c.proveedor_id == proveedorId)
    .map((c) => ({ ...c, total: totalCompra(c), productos: c.items.length, proveedor: proveedores.find((x) => x.id === c.proveedor_id)?.nombre || '—' }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado_en.localeCompare(a.creado_en)),
  compra(id) {
    const c = compras.find((x) => x.id === id);
    if (!c) throw new Error('La compra no existe.');
    return { ...c, total: totalCompra(c), proveedor: proveedores.find((x) => x.id === c.proveedor_id)?.nombre || '—', registro: 'Demostración',
      anulador: c.anulada_por ? 'Demostración' : null,
      items: c.items.map((i) => { const p = productos.find((x) => x.id === i.producto_id); return { ...i, nombre: p?.nombre || '—', ref: p?.ref || '' }; })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) };
  },
  comprasDeProducto: (pid) => compras.filter((c) => c.estado === 'vigente').flatMap((c) => c.items.filter((i) => i.producto_id == pid)
    .map((i) => ({ cantidad: i.cantidad, costo: i.costo, id: c.id, fecha: c.fecha, proveedor: proveedores.find((x) => x.id === c.proveedor_id)?.nombre || '—' })))
    .sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5),
  registrarCompra(c) {   // misma regla que registrar_compra (migración 0027)
    const ya = compras.find((x) => x.id === c.id); if (ya) return ya;
    if (!c.proveedor_id) throw new Error('Elige el proveedor de la compra.');
    if (!c.items?.length) throw new Error('Agrega al menos un producto a la compra.');
    const limpio = (d) => String(d || '').replace(/\s/g, '').toLowerCase();
    const otra = c.documento && compras.find((x) => x.estado === 'vigente' && x.proveedor_id == c.proveedor_id && x.tipo_documento === c.tipo_documento && limpio(x.documento) === limpio(c.documento));
    if (otra) throw new Error(`Esa ${c.tipo_documento === 'guia' ? 'guía' : c.tipo_documento} N° ${c.documento} de este proveedor ya se registró. Revisa Compras antes de repetirla.`);
    const n = { ...c, fotos: c.fotos || [], estado: 'vigente', usuario_id: 'demo', creado_en: new Date().toISOString(), items: c.items.map((i) => {
      const p = productos.find((x) => x.id == i.producto_id);
      const it = { producto_id: p.id, cantidad: i.cantidad, costo: i.costo, costo_anterior: p.costo, precio_anterior: p.precio, precio_nuevo: i.precio ?? null };
      p.stock += i.cantidad; p.costo = i.costo; if (i.precio) p.precio = i.precio;
      return it;
    }) };
    compras.push(n); return { ...n, total: totalCompra(n) };
  },
  fotosCompra(id, fotos) { const c = compras.find((x) => x.id === id); c.fotos = fotos; return c; },
  anularCompra(id, motivo) {
    const c = compras.find((x) => x.id === id);
    if (!motivo) throw new Error('Indica el motivo de la anulación.');
    if (c.estado === 'anulada') throw new Error('Esta compra ya estaba anulada.');
    c.items.forEach((i) => {
      const p = productos.find((x) => x.id === i.producto_id);
      p.stock -= i.cantidad;
      const despues = compras.some((o) => o !== c && o.estado === 'vigente' && o.creado_en > c.creado_en && o.items.some((x) => x.producto_id === i.producto_id));
      if (!despues) { if (p.costo === i.costo) p.costo = i.costo_anterior; if (i.precio_nuevo && p.precio === i.precio_nuevo) p.precio = i.precio_anterior; }
    });
    Object.assign(c, { estado: 'anulada', motivo_anulacion: motivo, anulada_en: new Date().toISOString(), anulada_por: 'demo' });
    return c;
  },
  ventas(desde, hasta) {
    return pedidos.filter((p) => !p.historial && new Date(p.fecha) >= desde && new Date(p.fecha) < hasta)
      .map((p) => ({ ...p, cliente: clientes.find((c) => c.id === p.cliente_id)?.nombre || '—', ruta_id: p.ruta_id ?? clientes.find((c) => c.id === p.cliente_id)?.ruta_id ?? null }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  },
  revisiones: () => revisionesDemo.map(({ informe, ...r }) => r),
  revision: (id) => revisionesDemo.find((r) => r.id == id) || null,
  cierreDia(desde, hasta) {
    const en = (f) => f >= desde && f < hasta;
    return {
      pedidos: pedidos.filter((p) => !p.historial && (en(p.fecha) || (p.pagado_en && en(p.pagado_en)) || (p.pago_definido_en && en(p.pago_definido_en)))).map((p) => ({ ...p, cliente: clientes.find((c) => c.id === p.cliente_id)?.nombre })),
      abonos: abonos.filter((a) => en(a.fecha)).map((a) => ({ ...a, cliente: clientes.find((c) => c.id === a.cliente_id)?.nombre })),
    };
  },
  reglasFiado: () => reglasFiado,
  guardarReglasFiado(cfg) { reglasFiado = cfg; return cfg; },
  fiadoCliente: (id) => ({ ...repartir(notasFiado(id), abonadoDe(id)), abonos: abonos.filter((a) => a.cliente_id == id).slice().reverse() }),
  fiadoTodos() {
    const m = new Map();
    for (const c of clientes) {
      const n = notasFiado(c.id);
      if (!n.length && !abonadoDe(c.id)) continue;
      const r = repartir(n, abonadoDe(c.id));
      m.set(c.id, { cliente_id: c.id, limite_credito: c.limite_credito ?? null, plazo_dias: c.plazo_credito_dias || reglasFiado.plazo_dias,
        deuda: r.deuda, atrasado: r.atrasado, dias_atraso: r.dias_atraso, notas_pendientes: r.notas_pendientes, proximo_vencimiento: r.proximo_vencimiento, saldo_favor: r.saldo_favor });
    }
    return m;
  },
  pedidosEntrega() {
    const ayer = new Date(hoy - 2 * 864e5).toISOString();
    return pedidos.filter((p) => !p.historial && p.estado !== 'anulado' && (!p.entregado_en || p.entregado_en >= ayer || (p.forma_pago !== 'credito' && !p.pagado_en)))
      .map((p) => ({ id: p.id, numero: p.numero, fecha: p.fecha, total: p.total, forma_pago: p.forma_pago, cliente_id: p.cliente_id, ruta_id: clientes.find((c) => c.id === p.cliente_id)?.ruta_id ?? null,
        entregado_en: p.entregado_en || null, pagado_en: p.pagado_en || null, pago_forma: p.pago_forma || null }));
  },
  marcarEntrega(e) { for (const p of pedidos) if (e.pedidos.includes(p.id) && p.estado !== 'anulado') p.entregado_en = e.entregado ? e.fecha : null; return e; },
  registrarCobro(c) { const p = pedidos.find((x) => x.id === c.pedido_id);
    if (p && p.estado !== 'anulado') {
      const cobrada = c.cobrado && c.forma !== 'credito';
      Object.assign(p, { forma_pago: c.cobrado ? c.forma : 'pendiente', pagado_en: cobrada ? c.fecha : null, pago_forma: cobrada ? c.forma : null, pago_definido_en: c.cobrado ? c.fecha : null });
      if (c.forma === 'credito') { const cl = clientes.find((x) => x.id == p.cliente_id); p.vence_en = vencimiento(c.fecha, cl?.plazo_credito_dias || reglasFiado.plazo_dias, diasExtra(programa, p.nivel)); }
      else p.vence_en = null;
    }
    return c; },
  registrarVisita(v) { const n = { ...v, anulada: false }; visitas.push(n); return n; },
  anularVisita(id) { const v = visitas.find((x) => x.id === id); if (v) v.anulada = true; },
  registrarAbono(a) { const n = { ...a, fecha: new Date().toISOString(), vendedor_id: 'demo', anulado: false }; abonos.push(n); return n; },
  anularAbono(id, motivo) { const a = abonos.find((x) => x.id === id); Object.assign(a, { anulado: true, anulado_motivo: motivo, anulado_en: new Date().toISOString() }); return a; },
  programaLealtad: () => programa,
  guardarProgramaLealtad(cfg) { programa = cfg; return cfg; },
  comprasLealtad: (id) => (id ? comprasDe(id) : new Map(clientes.map((c) => [c.id, comprasDe(c.id)]))),
  pedido(id) {
    const p = pedidos.find((x) => x.id === id);
    if (!p) throw new Error('No se encontró esta nota.');
    const reemplazo = pedidos.find((x) => x.reemplaza_a === id);
    const original = p.reemplaza_a ? pedidos.find((x) => x.id === p.reemplaza_a) : null;
    return { ...p, vendedor_id: p.vendedor_id || 'demo', terminal: p.terminal || 'Movil 1', cliente: clientes.find((c) => c.id === p.cliente_id)?.nombre || '—',
      reemplazado_por: reemplazo ? { id: reemplazo.id, numero: reemplazo.numero } : null, reemplaza: original ? { id: original.id, numero: original.numero } : null };
  },
  anularPedido(id, motivo) {
    const p = pedidos.find((x) => x.id === id);
    if (p.estado !== 'anulado') {
      p.items.forEach((i) => { const pr = productos.find((x) => x.id === i.producto_id); if (pr) pr.stock += i.cantidad; });
      Object.assign(p, { estado: 'anulado', anulado_motivo: motivo || null, anulado_en: new Date().toISOString() });
    }
    return p;
  },
  reemplazarPedido(id, motivo, nuevo) {
    this.anularPedido(id, motivo);
    const r = this.crearPedido(nuevo);
    r.reemplaza_a = id;
    return r;
  },
  crearPedido(p) {
    const items = p.items.map((i) => { const pr = productos.find((x) => x.id == i.producto_id); pr.stock -= i.cantidad; return { ...i, precio: i.precio ?? pr.precio }; });
    const sub = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
    const leal = Math.max(0, p.descuento_lealtad || 0);
    const ped = { id: p.id, numero: ++numero, cliente_id: p.cliente_id, fecha: new Date().toISOString(), total: Math.max(0, sub - leal - (p.descuento || 0)), subtotal: sub, descuento: p.descuento || 0, descuento_lealtad: leal, nivel: p.nivel || null, estado: 'generado', forma_pago: p.forma_pago,
      items: items.map((i) => { const pr = productos.find((x) => x.id == i.producto_id); return { producto_id: pr.id, nombre: pr.nombre, cantidad: i.cantidad, precio: i.precio, costo: pr.costo, subtotal: i.cantidad * i.precio }; }) };
    if (ped.forma_pago === 'efectivo' || ped.forma_pago === 'transferencia') { ped.pagado_en = ped.fecha; ped.pago_forma = ped.forma_pago; }   // como el servidor
    if (ped.forma_pago === 'credito') {
      const c = clientes.find((x) => x.id == p.cliente_id);
      ped.vence_en = vencimiento(ped.fecha, c?.plazo_credito_dias || reglasFiado.plazo_dias, diasExtra(programa, ped.nivel));
      ped.sobre_limite = superaLimite(c?.limite_credito, repartir(notasFiado(p.cliente_id), abonadoDe(p.cliente_id)).deuda + ped.total);
    }
    pedidos.push(ped); return ped;
  },
};
