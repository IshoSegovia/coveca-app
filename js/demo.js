// Datos de ejemplo para ver y probar la app sin conexión ni usuario (modo demostración).
// Los clientes son ficticios; los productos son una muestra del catálogo.
import { PROGRAMA_DEFECTO } from './lealtad.js';
import { normal, diaChile, visitadoHasta } from './ui.js';
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
// Respaldo de ejemplo: los productos de un proveedor tienen como respaldo al otro (solo algunos).
productos.forEach((p, i) => { p.proveedor_respaldo_id = p.proveedor_id && i % 3 === 0 ? (p.proveedor_id === 1 ? 2 : 1) : null; });
let pedidos = [];
// Compras de ejemplo (la mercadería ya está sumada en el stock de arriba).
let compras = [
  { id: 'demo-compra-1', proveedor_id: 1, tipo_documento: 'factura', documento: '4521', fecha: dias(3), estado: 'vigente', usuario_id: 'demo',
    creado_en: dias(3) + 'T15:00:00.000Z', notas: null, fotos: [],
    items: [{ producto_id: 1, cantidad: 10, costo: 8250, costo_anterior: 8100, precio_anterior: 9900, precio_nuevo: null },
      { producto_id: 2, cantidad: 20, costo: 5690, costo_anterior: 5690, precio_anterior: 6690, precio_nuevo: null }] },
];
// Pedidos a proveedores de ejemplo (uno enviado y uno ya recibido con la compra de ejemplo).
let numPedProv = 3;
const pedidosProv = [
  { id: 'demo-pp-1', numero: 1, proveedor_id: 1, fecha: dias(5), estado: 'recibido', notas: null, creado_en: dias(5) + 'T13:00:00.000Z',
    recibido_en: dias(3) + 'T15:00:00.000Z', compra_id: 'demo-compra-1', items: [{ producto_id: 2, cantidad: 20 }, { producto_id: 4, cantidad: 24 }] },
  { id: 'demo-pp-2', numero: 2, proveedor_id: 1, fecha: dias(1), estado: 'enviado', notas: 'Despacho el jueves, por favor.', creado_en: dias(1) + 'T12:00:00.000Z',
    items: [{ producto_id: 3, cantidad: 12 }, { producto_id: 5, cantidad: 6 }] },
  { id: 'demo-pp-3', numero: 3, proveedor_id: 2, fecha: dias(0), estado: 'por_enviar', notas: null, creado_en: dias(0) + 'T10:00:00.000Z',
    items: [{ producto_id: 1, cantidad: 8 }, { producto_id: 6, cantidad: 4 }] },
];
const totalCompra = (c) => c.items.reduce((s, i) => s + i.cantidad * i.costo, 0);
// Tickets de soporte de ejemplo (migración 0042). La "captura de pantalla" es un dibujo para no depender de archivos.
const capturaDemo = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640" viewBox="0 0 360 640">
  <rect width="360" height="640" fill="#F4F6FA"/><rect width="360" height="72" fill="#1E3A8A"/><text x="20" y="46" font-family="sans-serif" font-size="22" fill="#fff">Nota de venta N° 214</text>
  <rect x="20" y="100" width="320" height="140" rx="12" fill="#fff"/><text x="40" y="140" font-family="sans-serif" font-size="18" fill="#111">Imprimiendo…</text>
  <rect x="40" y="160" width="280" height="10" rx="5" fill="#DDE3EE"/><rect x="40" y="160" width="120" height="10" rx="5" fill="#EC3237"/>
  <rect x="20" y="270" width="320" height="90" rx="12" fill="#FDECEC"/><text x="40" y="310" font-family="sans-serif" font-size="17" fill="#B42318">No se pudo conectar</text>
  <text x="40" y="336" font-family="sans-serif" font-size="15" fill="#B42318">con la impresora (intento 1 de 3)</text></svg>`);
// Pantalla de ejemplo para las capturas automáticas de los tickets (dibujo simple, sin datos reales).
const pantallaDemo = (titulo, color) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="270" height="585" viewBox="0 0 270 585">
  <rect width="270" height="585" fill="#F4F6FA"/><rect width="270" height="56" fill="#fff"/><text x="16" y="36" font-family="sans-serif" font-size="17" font-weight="700" fill="#111">${titulo}</text>
  <rect x="16" y="76" width="238" height="110" rx="14" fill="${color}"/>${[210, 270, 330, 390, 450].map((y) => `<rect x="16" y="${y}" width="238" height="48" rx="10" fill="#fff"/><rect x="30" y="${y + 18}" width="120" height="12" rx="6" fill="#DDE3EE"/>`).join('')}
  <rect y="525" width="270" height="60" fill="#fff"/></svg>`);
let numTicket = 5;
const haceMin = (m) => new Date(Date.now() - m * 60e3).toISOString();
const ticketsDemo = [
  { id: 't-demo-4', numero: 5, tipo: 'error', urgencia: 'molesta', estado: 'confirmar', pantalla: 'Inicio (ruta de hoy)', frecuencia: 'a_veces', desde: 'semana',
    descripcion: 'El widget de la ruta no se actualiza después de marcar visitado a un cliente: sigue mostrando el número anterior hasta que abro la app.',
    etiqueta: 'otro', causa: 'El widget solo se actualizaba al abrir la pantalla de inicio. Ahora se actualiza también al marcar visitado y al entregar.',
    solucion: 'Si el widget queda atrasado, abre la app una vez y se pone al día.', version_arreglo: '2.0.41',
    fallas: [{ en: haceMin(60 * 26), nota: 'Sigue igual con los visitados sin pedido.', version: '2.0.38' }],
    adjuntos: [], creado_en: dias(3) + 'T19:30:00.000Z', autor: 'Jose Daniel', usuario_id: 'demo', confirmar_desde: haceMin(40), confirmar_avisos: 0,
    equipo: { version: '2.0.37 (148)', plataforma: 'App Android' } },
  { id: 't-demo-3', numero: 4, tipo: 'error', urgencia: 'bloquea', estado: 'nuevo', pantalla: 'Nota de venta', frecuencia: 'siempre', desde: 'actualizacion',
    esperaba: 'Que saliera la nota impresa, como antes.',
    descripcion: 'Después de editar la nota N° 214 la impresora no imprime. Sale "No se pudo conectar" aunque la impresora está prendida y con papel. Apagué y prendí el Bluetooth y sigue igual.',
    adjuntos: [{ ruta: capturaDemo, tipo: 'foto' },
      { ruta: pantallaDemo('Nota N° 214', '#1E3A8A'), tipo: 'captura', pantalla: '#/pedidos/demo-214', tomada: haceMin(125) },
      { ruta: pantallaDemo('Ficha del cliente', '#2E7D5B'), tipo: 'captura', pantalla: '#/clientes/12', tomada: haceMin(128) },
      { ruta: pantallaDemo('Ruta de hoy', '#1E3A8A'), tipo: 'captura', pantalla: '#/rutas', tomada: haceMin(131) }],
    creado_en: new Date(Date.now() - 2 * 36e5).toISOString(), autor: 'Jose Daniel',
    equipo: { version: '2.0.15 (126)', plataforma: 'App Android', equipo: 'Android 16 · motorola edge 60', pantalla: '412 × 915', senal: 'Con señal (4g)', cola: 0,
      celular: { modelo: 'motorola edge 60', android: '16 (API 36)', bateria: 18, cargando: false, ahorroEnergia: true, bluetooth: 'encendido', impresoraVinculada: true,
        permisos: { camara: true, ubicacion: true, bluetooth: true, notificaciones: true }, espacioLibreMb: 41230 },
      sin_senal: { cola: { total: 0, por_tipo: {}, con_problema: [] }, ultima_subida: { hace: '3 min', subidos: 1, pendientes: 0, error: null }, copia_descargada_hace: '3 min', numeros_de_nota_libres: 37 },
      reloj: 'bien (menos de 1 min de diferencia)', ultima_impresion: { hace: '121 min', ok: false, segundos: 8.2, error: 'No se pudo imprimir: revisa que la impresora esté encendida y cerca. (socket closed)' },
      contexto: { cliente: '12', nota: 'demo-214' },
      rastro: [{ t: Date.now() - 2.2 * 36e5, k: 'pantalla', x: '#/clientes/12', p: '#/clientes/12' }, { t: Date.now() - 2.15 * 36e5, k: 'toque', x: 'enlace #/pedidos/demo-214', p: '#/clientes/12' },
        { t: Date.now() - 2.1 * 36e5, k: 'toque', x: '#reimprimir "Imprimir"', p: '#/pedidos/demo-214' }],
      recorrido: ['#/rutas', '#/clientes/12', '#/pedidos/demo-214'], errores: [{ t: Date.now() - 2.1 * 36e5, o: 'consola', m: 'Error: socket closed (BtPrinter.print)', p: '#/pedidos/demo-214' }] } },
  { id: 't-demo-2', numero: 3, tipo: 'mejora', urgencia: 'espera', estado: 'revision', pantalla: 'Pedido',
    descripcion: 'Sería bueno ver el stock de cada producto al lado del precio cuando tomo el pedido, para no ofrecer lo que no hay.',
    adjuntos: [], creado_en: dias(2) + 'T21:10:00.000Z', autor: 'Jose Daniel', usuario_id: 'demo', aviso_estado: 'revision', aviso_en: haceMin(30),
    equipo: { version: '2.0.14 (125)', plataforma: 'App Android' } },
  { id: 't-demo-1', numero: 2, tipo: 'error', urgencia: 'molesta', estado: 'resuelto', pantalla: 'Clientes',
    descripcion: 'La foto del local salía estirada en la ficha del cliente.', respuesta: 'Corregido en la versión 2.0.14: las fotos ahora son cuadradas.',
    etiqueta: 'otro', causa: 'Algunas fotos del local se veían estiradas en la ficha. Ahora las fotos nuevas se guardan cuadradas y se ven bien.',
    solucion: 'Si una foto vieja se ve estirada, quítala y vuelve a tomarla: ahora se guarda cuadrada.', version_arreglo: '2.0.14',
    adjuntos: [], creado_en: dias(5) + 'T14:00:00.000Z', resuelto_en: dias(3) + 'T18:00:00.000Z', autor: 'Jose Daniel', usuario_id: 'demo',
    aviso_estado: 'resuelto', aviso_en: haceMin(20), equipo: { version: '2.0.13 (124)' } },
  { id: 't-demo-0', numero: 1, tipo: 'error', urgencia: 'bloquea', estado: 'resuelto', pantalla: 'Impresión',
    descripcion: 'La nota salió cortada al final: faltaban los datos de transferencia.',
    etiqueta: 'impresora', causa: 'Algunas notas salían cortadas al final. Ahora la nota sale completa.',
    solucion: 'Actualiza la app. Si vuelve a pasar, revisa que la impresora tenga batería y reimprime desde la nota.', version_arreglo: '2.0.17',
    adjuntos: [], creado_en: dias(8) + 'T15:00:00.000Z', resuelto_en: dias(7) + 'T20:00:00.000Z', autor: 'Jose Daniel', equipo: { version: '2.0.16 (127)' } },
];
let soporteDemo = { whatsapp: '+52 55 1234 5678' };

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

// Ciclo de visita, igual que la base (migración 0048): semanal hasta el domingo, quincenal 9 días, otras sus días.
const vigente = (fecha, frec) => visitadoHasta(diaChile(fecha), frec) >= diaChile(hoy);
const compro = (c) => pedidos.some((p) => p.cliente_id === c.id && p.estado !== 'anulado' && vigente(p.fecha, c.frecuencia_dias));
// Visitas sin pedido (de ejemplo: un cliente de la primera ruta que no ha comprado en su ciclo).
const visitas = [];
{ const c = clientes.find((x) => x.ruta_id === rutas[0]?.id && x.activo !== false && !compro(x));
  if (c) visitas.push({ id: 'v-demo', cliente_id: c.id, fecha: new Date(hoy - 3600e3).toISOString(), anulada: false }); }
// Cotizaciones de ejemplo (migración 0051): una vigente de un cliente de la segunda ruta (que cuenta como visita) y una vencida.
const diaMas = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const itemsCot = (lista) => lista.map(([pid, cantidad]) => { const p = productos.find((x) => x.id === pid); return { producto_id: pid, nombre: p.nombre, cantidad, precio: p.precio, subtotal: cantidad * p.precio }; });
const armarCot = (id, cliente_id, fecha, valida_hasta, lista, descuento = 0) => { const items = itemsCot(lista), subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  return { id, cliente_id, vendedor_id: 'demo', fecha, valida_hasta, items, subtotal, descuento, total: subtotal - descuento, pedido_id: null, convertida_en: null, eliminada_en: null }; };
const cotizaciones = [];
{ const libre = (x) => x.activo !== false && !compro(x) && !visitas.some((v) => v.cliente_id === x.id);   // sin compra ni visita en su ciclo
  const c = clientes.find((x) => x.ruta_id === rutas[1]?.id && libre(x)) || clientes.find(libre);
  if (c) {
    const f = new Date(hoy - 2 * 3600e3).toISOString();
    cotizaciones.push(armarCot('c0000000-0000-4000-8000-000000000001', c.id, f, diaMas(3), [[11, 6], [10, 4], [7, 2]], 500));
    visitas.push({ id: 'v-demo-cot', cliente_id: c.id, fecha: f, anulada: false, cotizacion_id: 'c0000000-0000-4000-8000-000000000001' });
  }
  const otro = clientes.find((x) => x.activo !== false && x.id !== c?.id);
  if (otro) cotizaciones.push(armarCot('c0000000-0000-4000-8000-000000000002', otro.id, new Date(hoy - 9 * 864e5).toISOString(), diaMas(-6), [[2, 3], [3, 3], [12, 10]]));
  // Cliente nuevo (aún no está en la app): solo nombre y teléfono (migración 0052)
  cotizaciones.push({ ...armarCot('c0000000-0000-4000-8000-000000000003', null, new Date(hoy - 5 * 3600e3).toISOString(), diaMas(2), [[4, 6], [12, 2]]),
    prospecto_nombre: 'Botillería El Nuevo', prospecto_telefono: '+56 9 8765 4321' });
}
const vio = (c) => visitas.some((v) => v.cliente_id == c.id && !v.anulada && vigente(v.fecha, c.frecuencia_dias));
const ultimaVisita = (c) => visitas.filter((v) => v.cliente_id == c.id && !v.anulada).sort((a, z) => z.fecha.localeCompare(a.fecha))[0];
const enriquecer = (c) => ({ ...c, activo: c.activo !== false, ruta_nombre: rutas.find((r) => r.id === c.ruta_id)?.nombre || null,
  atendido: compro(c) || vio(c), visita_sin_pedido: !compro(c) && vio(c), visita_cotizacion: !!ultimaVisita(c)?.cotizacion_id, ultima_compra: pedidos.filter((p) => p.cliente_id === c.id).map((p) => p.fecha.slice(0, 10)).sort().pop() || c.loyverse_ultima_compra });

// Entregas de ejemplo: las notas de antes de ayer se entregaron al día siguiente de tomarlas; las de ayer y hoy, por entregar.
// Las 4 más recientes quedan siempre por entregar (así el ejemplo no depende del día de la semana).
const porEntregarDemo = new Set(pedidos.filter((p) => !p.historial).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 4).map((p) => p.id));
for (const p of pedidos) if (!p.historial && !porEntregarDemo.has(p.id) && hoy - new Date(p.fecha) > 1.5 * 864e5) p.entregado_en = new Date(Date.parse(p.fecha) + 864e5).toISOString();
// Pagos de ejemplo: las notas ya entregadas se pagaron (efectivo/transferencia/crédito); las que faltan por entregar
// todavía no tienen forma de pago (se decide al entregar). La entregada ayer más reciente quedó sin pago registrado.
for (const p of pedidos) if (p.forma_pago !== 'credito') { p.pagado_en = p.fecha; p.pago_forma = p.forma_pago; }
for (const p of pedidos) if (!p.historial && !p.entregado_en) { p.forma_pago = 'pendiente'; p.pagado_en = null; p.pago_forma = null; p.vence_en = null; }

// Cambio de ejemplo (ticket N° 12): sobre la nota entregada más reciente, por entregar (para ver Pedidos y la Carga).
const cambiosDemo = [];
{ const n = pedidos.filter((p) => !p.historial && p.entregado_en && p.items.length).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  if (n) {
    const i0 = n.items[0], pr = productos.find((x) => x.id === i0.producto_id);
    const otro = productos.find((x) => x.id !== pr.id && x.precio === i0.precio) || pr;
    cambiosDemo.push({ id: 'cb000000-0000-4000-8000-000000000001', pedido_id: n.id, cliente_id: n.cliente_id, ruta_id: clientes.find((c) => c.id === n.cliente_id)?.ruta_id ?? null,
      numero_nota: n.numero, n: 1, motivo: otro === pr ? 'mal_estado' : 'variedad', detalle: null, vendedor_id: 'demo', fecha: new Date(hoy - 3 * 3600e3).toISOString(),
      entregado_en: null, anulado_en: null, valor: i0.precio,
      items: [{ sentido: 'devuelve', producto_id: pr.id, nombre: pr.nombre, cantidad: 1, precio: i0.precio, destino: otro === pr ? 'baja' : 'bodega', subtotal: i0.precio },
        { sentido: 'recibe', producto_id: otro.id, nombre: otro.nombre, cantidad: 1, precio: i0.precio, destino: null, subtotal: i0.precio }] });
  }
}

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
  proveedores: () => proveedores.map((p) => ({ ...p, productos: productos.filter((x) => x.proveedor_id === p.id).length,
    respaldo: productos.filter((x) => x.proveedor_respaldo_id === p.id).length })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
  proveedor: (id) => proveedores.find((p) => p.id == id),
  productosDeProveedor: (id) => productos.filter((p) => p.proveedor_id == id || p.proveedor_respaldo_id == id)
    .map((p) => ({ ...p, rol: p.proveedor_id == id ? 'principal' : 'respaldo' })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
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
  pedidosProveedor: ({ proveedorId }) => pedidosProv.filter((x) => !proveedorId || x.proveedor_id == proveedorId)
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
    .map((x) => ({ ...x, proveedor: proveedores.find((p) => p.id === x.proveedor_id)?.nombre || '—', productos: x.items.length, unidades: x.items.reduce((a, i) => a + i.cantidad, 0) })),
  pedidoProveedor(id) {
    const x = pedidosProv.find((o) => o.id === id); if (!x) throw new Error('No se encontró el pedido.');
    return { ...x, proveedor: proveedores.find((p) => p.id === x.proveedor_id), hizo: 'Demostración',
      items: x.items.map((i) => { const p = productos.find((o) => o.id === i.producto_id); return { ...i, nombre: p?.nombre || '—', ref: p?.ref || '', stock: p?.stock }; })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) };
  },
  guardarPedidoProveedor(p) {   // misma regla que guardar_pedido_proveedor (migraciones 0041 y 0046)
    if (!p.items?.length) throw new Error('Agrega al menos un producto al pedido.');
    if (p.estado && !['por_enviar', 'enviado'].includes(p.estado)) throw new Error('El pedido solo puede guardarse como Por enviar o Enviado.');
    const ya = pedidosProv.find((x) => x.id === p.id);
    if (ya) {
      if (!['por_enviar', 'enviado'].includes(ya.estado)) throw new Error(`Este pedido ya está ${ya.estado}: no se puede cambiar.`);
      Object.assign(ya, { notas: p.notas || null, items: p.items });
      if (ya.estado === 'por_enviar' && p.estado === 'enviado') Object.assign(ya, { estado: 'enviado', enviado_en: new Date().toISOString() });   // un Enviado no vuelve atrás
      return ya;
    }
    const n = { id: p.id, numero: ++numPedProv, proveedor_id: Number(p.proveedor_id), fecha: hoy.toISOString().slice(0, 10), estado: p.estado || 'enviado', notas: p.notas || null,
      creado_en: new Date().toISOString(), enviado_en: (p.estado || 'enviado') === 'enviado' ? new Date().toISOString() : null, items: p.items };
    pedidosProv.push(n); return n;
  },
  marcarPedidoProveedorEnviado(id) {
    const x = pedidosProv.find((o) => o.id === id); if (!x) throw new Error('No se encontró el pedido.');
    if (x.estado === 'enviado') return x;
    if (x.estado !== 'por_enviar') throw new Error(`Este pedido ya está ${x.estado}.`);
    Object.assign(x, { estado: 'enviado', enviado_en: new Date().toISOString() }); return x;
  },
  recibirPedidoProveedor(id, compraId) {
    const x = pedidosProv.find((o) => o.id === id);
    if (x.estado === 'recibido' && x.compra_id === compraId) return x;
    if (!['por_enviar', 'enviado'].includes(x.estado)) throw new Error(`Este pedido ya está ${x.estado}.`);
    Object.assign(x, { estado: 'recibido', recibido_en: new Date().toISOString(), compra_id: compraId }); return x;
  },
  anularPedidoProveedor(id, motivo) {
    const x = pedidosProv.find((o) => o.id === id);
    if (x.estado === 'recibido') throw new Error('Un pedido ya recibido no se anula: si hubo un error, anula la compra.');
    Object.assign(x, { estado: 'anulado', anulado_en: new Date().toISOString(), motivo_anulacion: motivo || null }); return x;
  },
  ventasDesde: (desde) => pedidos.filter((p) => p.estado !== 'anulado' && p.fecha >= desde).flatMap((p) => p.items),
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
  tickets: () => ticketsDemo.map((t) => ({ ...t })).sort((a, b) => b.creado_en.localeCompare(a.creado_en)),
  ticket(id) { const t = ticketsDemo.find((x) => x.id === id); if (!t) throw new Error('No se encontró el ticket.'); return { ...t }; },
  crearTicket(p) {   // mismas reglas que crear_ticket (migración 0042)
    const ya = ticketsDemo.find((x) => x.id === p.id); if (ya) return ya;
    if ((p.descripcion || '').trim().length < 5) throw new Error('Cuenta qué pasó en la descripción (al menos unas palabras).');
    const t = { ...p, descripcion: p.descripcion.trim(), numero: ++numTicket, estado: 'nuevo', creado_en: new Date().toISOString(), autor: 'Demostración' };
    ticketsDemo.push(t); return t;
  },
  resolverTicket(p) {   // mismas reglas que resolver_ticket (migraciones 0047 y 0053)
    const t = ticketsDemo.find((x) => x.id === p.id);
    if (!p.etiqueta) throw new Error('Elige una etiqueta para el ticket.');
    if ((p.causa || '').trim().length < 5) throw new Error('Cuenta qué pasó (al menos unas palabras), para encontrarlo si vuelve a pasar.');
    // Un error de otra persona queda "Por confirmar"; mejora, propio o forzado: Resuelto.
    const estado = t.estado === 'resuelto' || p.forzar || t.tipo === 'mejora' || !t.usuario_id || t.usuario_id === 'demo' ? 'resuelto' : 'confirmar';
    Object.assign(t, { estado, etiqueta: p.etiqueta, causa: p.causa.trim(), solucion: p.solucion?.trim() || null,
      version_arreglo: p.version?.trim() || null, resuelto_en: estado === 'resuelto' ? t.resuelto_en || new Date().toISOString() : null, aviso_estado: null,
      cierre: estado !== 'resuelto' ? null : t.cierre || (p.forzar ? 'forzado' : 'directo'),
      confirmar_desde: estado === 'confirmar' ? t.confirmar_desde || new Date().toISOString() : null });
    return t;
  },
  estadoTicket(id, estado, respuesta) {
    const t = ticketsDemo.find((x) => x.id === id);
    Object.assign(t, { cierre: estado !== 'resuelto' ? null : t.estado === 'resuelto' ? t.cierre : t.estado === 'confirmar' ? 'forzado' : 'directo',
      estado, respuesta: respuesta?.trim() || t.respuesta || null, resuelto_en: estado === 'resuelto' ? (t.resuelto_en || new Date().toISOString()) : null,
      aviso_estado: null, confirmar_desde: null, confirmar_avisos: 0, confirmar_ultimo: null });   // como el disparador de la 0049: lo cambia quien lo envió, sin aviso
    return t;
  },
  // "Por confirmar" (migración 0053): mismas reglas que tickets_por_confirmar() y ticket_confirmacion().
  ticketsPorConfirmar() {
    const hace30 = Date.now() - 30 * 60e3;
    ticketsDemo.filter((t) => t.estado === 'confirmar' && ((t.usuario_id === 'demo' && (t.confirmar_avisos || 0) >= 2 && Date.parse(t.confirmar_ultimo) < hace30)
      || Date.parse(t.confirmar_desde) < Date.now() - 7 * 864e5))
      .forEach((t) => Object.assign(t, { estado: 'resuelto', cierre: 'sin_respuesta', resuelto_en: new Date().toISOString() }));
    return ticketsDemo.filter((t) => t.estado === 'confirmar' && t.usuario_id === 'demo' && (!t.confirmar_ultimo || Date.parse(t.confirmar_ultimo) < hace30))
      .map(({ id, numero, descripcion, causa, solucion, version_arreglo, confirmar_desde, confirmar_avisos }) =>
        ({ id, numero, descripcion, causa, solucion, version_arreglo, confirmar_desde, confirmar_avisos: confirmar_avisos || 0 }));
  },
  confirmarTicket(id, respuesta, nota) {
    const t = ticketsDemo.find((x) => x.id === id && x.usuario_id === 'demo');
    if (!t) throw new Error('No se encontró el ticket o no lo enviaste tú.');
    if (respuesta === 'falla' && (nota || '').trim().length < 3) throw new Error('Cuenta qué sigue fallando (al menos unas palabras).');
    const sinResp = t.estado === 'resuelto' && t.cierre === 'sin_respuesta';
    if (sinResp && respuesta === 'funciona') { t.cierre = 'confirmado'; return { estado: t.estado, cierre: t.cierre }; }
    if (t.estado !== 'confirmar' && !(sinResp && respuesta === 'falla')) return { estado: t.estado, cierre: t.cierre };
    const ahora = new Date().toISOString(), avisos = t.confirmar_avisos || 0;
    if (respuesta === 'mostrado') Object.assign(t, { confirmar_avisos: avisos + 1, confirmar_ultimo: ahora });
    else if (respuesta === 'aplazar') t.confirmar_ultimo = ahora;
    else if (respuesta === 'funciona' || (respuesta === 'despues' && avisos >= 2)) {
      Object.assign(t, { estado: 'resuelto', cierre: respuesta === 'funciona' ? 'confirmado' : 'sin_respuesta', resuelto_en: ahora, confirmar_desde: null });
    } else if (respuesta === 'despues') t.confirmar_ultimo = ahora;
    else {
      Object.assign(t, { estado: 'revision', cierre: null, resuelto_en: null, confirmar_desde: null, confirmar_avisos: 0, confirmar_ultimo: null,
        fallas: [...(t.fallas || []), { en: ahora, nota: nota.trim().slice(0, 1000), version: t.version_arreglo }] });
    }
    return { estado: t.estado, cierre: t.cierre };
  },
  // Avisos de tickets propios (migración 0049): mismas columnas que tickets_avisos().
  avisosTickets: () => ticketsDemo.filter((t) => t.aviso_estado && t.usuario_id === 'demo').sort((a, b) => a.aviso_en.localeCompare(b.aviso_en))
    .map(({ id, numero, tipo, descripcion, aviso_estado, aviso_en, causa, solucion, version_arreglo }) => ({ id, numero, tipo, descripcion, aviso_estado, aviso_en, causa, solucion, version_arreglo })),
  avisoTicketVisto(id) { const t = ticketsDemo.find((x) => x.id === id); if (t) t.aviso_estado = null; return true; },
  soporte: () => ({ ...soporteDemo }),
  guardarSoporte(s) { soporteDemo = { ...s }; return soporteDemo; },
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
  cotizaciones: () => cotizaciones.filter((q) => !q.eliminada_en).map((q) => ({ ...q })),
  cotizacion: (id) => { const q = cotizaciones.find((x) => x.id === id); return q ? { ...q } : null; },
  guardarCotizacion(p) {
    const ya = cotizaciones.find((x) => x.id === p.id); if (ya) return ya;
    const q = armarCot(p.id, p.cliente_id ?? null, p.fecha || new Date().toISOString(), p.valida_hasta, p.items.map((i) => [i.producto_id, i.cantidad]), p.descuento || 0);
    if (p.prospecto) Object.assign(q, { prospecto_nombre: p.prospecto.nombre, prospecto_telefono: p.prospecto.telefono || null });
    q.items = q.items.map((i) => ({ ...i, precio: p.items.find((x) => x.producto_id === i.producto_id).precio, subtotal: i.cantidad * p.items.find((x) => x.producto_id === i.producto_id).precio }));
    q.subtotal = q.items.reduce((s, i) => s + i.subtotal, 0); q.total = q.subtotal - q.descuento;
    cotizaciones.push(q); if (q.cliente_id != null) visitas.push({ id: 'v-' + q.id, cliente_id: q.cliente_id, fecha: q.fecha, anulada: false, cotizacion_id: q.id });
    return q;
  },
  eliminarCotizacion(id) { const q = cotizaciones.find((x) => x.id === id); if (q) q.eliminada_en = new Date().toISOString(); },
  cotizacionAPedido(id, pedidoId) { const q = cotizaciones.find((x) => x.id === id); if (q) Object.assign(q, { pedido_id: pedidoId, convertida_en: new Date().toISOString() }); return q; },
  anularVisita(id) { const v = visitas.find((x) => x.id === id); if (v) v.anulada = true; },
  cambios: () => cambiosDemo.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i })) })),
  cambio: (id) => { const c = cambiosDemo.find((x) => x.id === id); return c ? { ...c, items: c.items.map((i) => ({ ...i })) } : null; },
  registrarCambio(c, r) {
    const ya = cambiosDemo.find((x) => x.id === c.id); if (ya) return ya;
    const n = { ...c, cliente_id: r.cliente_id, ruta_id: r.ruta_id ?? null, numero_nota: r.numero_nota, vendedor_id: 'demo', entregado_en: null, anulado_en: null,
      items: c.items.map((i) => ({ ...i, destino: i.sentido === 'devuelve' ? i.destino || 'bodega' : null, subtotal: i.cantidad * i.precio })) };
    n.valor = n.items.filter((i) => i.sentido === 'devuelve').reduce((s, i) => s + i.subtotal, 0);
    for (const i of n.items) { const pr = productos.find((x) => x.id === i.producto_id); if (!pr) continue;
      if (i.sentido === 'recibe') pr.stock -= i.cantidad; else if (i.destino !== 'baja') pr.stock += i.cantidad; }
    cambiosDemo.push(n); return n;
  },
  entregarCambio(e) { const c = cambiosDemo.find((x) => x.id === e.cambio_id); if (c && !c.anulado_en) c.entregado_en = e.entregado ? e.fecha : null; return e; },
  anularCambio(id, motivo) { const c = cambiosDemo.find((x) => x.id === id);
    if (c && !c.anulado_en) { for (const i of c.items) { const pr = productos.find((x) => x.id === i.producto_id); if (!pr) continue;
      if (i.sentido === 'recibe') pr.stock += i.cantidad; else if (i.destino !== 'baja') pr.stock -= i.cantidad; }
      Object.assign(c, { anulado_en: new Date().toISOString(), anulado_motivo: motivo }); }
    return c; },
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
      telefonoCliente: clientes.find((c) => c.id === p.cliente_id)?.telefono || '', reemplazado_por: reemplazo ? { id: reemplazo.id, numero: reemplazo.numero } : null, reemplaza: original ? { id: original.id, numero: original.numero } : null };
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
    // Cliente nuevo desde una cotización: se crea el cliente (con "Faltan datos") y la cotización queda enlazada
    if (p.cliente_nuevo) {
      const cn = p.cliente_nuevo, q = cotizaciones.find((x) => x.id === cn.cotizacion_id);
      const nuevo = this.guardarCliente({ nombre: cn.nombre, telefono: cn.telefono, ruta_id: cn.ruta_id, frecuencia_dias: 7, activo: true, datos_pendientes: true });
      if (q) Object.assign(q, { cliente_id: nuevo.id, prospecto_nombre: null, prospecto_telefono: null, pedido_id: p.id, convertida_en: new Date().toISOString() });
      p = { ...p, cliente_id: nuevo.id };
    }
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
