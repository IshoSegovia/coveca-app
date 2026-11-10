// Regla única de lo que ve el cliente en el catálogo (ticket N° 18): la usan la pantalla y el PDF.
// paraCliente() es una lista cerrada: costo, proveedor y stock nunca llegan al archivo que se comparte.
import { asignarDatos } from './catalogo-datos.js';

// Productos sin categoría: nombre que un administrador no puede crear (la app y la 0060 limitan a 40 letras; este tiene un espacio duro).
export const SIN_CATEGORIA = 'Otros\u00a0productos';

export const ORDEN = ['Chocolates', 'Caramelos y chupetes', 'Gomitas y jaleas', 'Chicles', 'Dulces de fantasía', 'Galletas y obleas',
  'Snacks salados', 'Bebidas', 'Sopas instantáneas', 'Despensa', 'Cuidado personal', 'Aseo del hogar', 'Bazar'];

// Clave estable de las categorías originales (migración 0061) → nombre con que están PIX, CATEGORIA, TIPO y ORDEN.
// Así renombrar "Chocolates" no le quita su dibujo, su orden ni sus datos. Una categoría sin clave (creada por un
// administrador) va con el dibujo general, aunque se llame como una original renombrada. Solo una copia del celular
// anterior a la 0061 (sin el campo categoria_clave) se busca por el nombre, como antes.
const TIPO_DE_CLAVE = Object.assign(Object.create(null), {
  chocolates: 'Chocolates', caramelos: 'Caramelos y chupetes', gomitas: 'Gomitas y jaleas', chicles: 'Chicles',
  fantasia: 'Dulces de fantasía', galletas: 'Galletas y obleas', snacks: 'Snacks salados', bebidas: 'Bebidas',
  sopas: 'Sopas instantáneas', despensa: 'Despensa', cuidado: 'Cuidado personal', aseo: 'Aseo del hogar', bazar: 'Bazar',
});
export const esPruebas = (clave, nombre) => clave === 'pruebas' || (!clave && nombre === 'Pruebas');

// Solo lo que se vende: activos, con precio y fuera de la categoría de pruebas.
// `tipo` = con qué se buscan dibujo, orden y datos; `categoria` = el nombre que se muestra.
export const productosCatalogo = (todos) => todos
  .filter((p) => p.activo !== false && p.precio > 0 && !esPruebas(p.categoria_clave, p.categoria) && !/prueba/i.test(p.nombre))
  .map((p) => {
    const categoria = p.categoria || SIN_CATEGORIA;
    const tipo = p.categoria_clave === undefined ? categoria : TIPO_DE_CLAVE[p.categoria_clave] || null;
    return { ...p, categoria, tipo };
  });

export function armarCategorias(productos) {
  const nombres = [...new Set(productos.map((p) => p.categoria))];
  const tipoDe = (n) => productos.find((p) => p.categoria === n).tipo;
  const lugar = (n) => (n === SIN_CATEGORIA ? 2 : ORDEN.includes(tipoDe(n)) ? 0 : 1);
  const orden = nombres.sort((a, b) => lugar(a) - lugar(b) || (lugar(a) === 0 ? ORDEN.indexOf(tipoDe(a)) - ORDEN.indexOf(tipoDe(b)) : a.localeCompare(b, 'es')));
  const cats = orden.map((nombre) => ({ nombre, tipo: tipoDe(nombre), lista: productos.filter((p) => p.categoria === nombre) }));
  cats.forEach((c) => c.lista.sort((a, b) => (b.stock > 0) - (a.stock > 0) || (a.marca || '~').localeCompare(b.marca || '~', 'es') || a.nombre.localeCompare(b.nombre, 'es')));
  asignarDatos(cats.flatMap((c) => c.lista));
  return cats;
}

// Se aplica después de ordenar, porque el orden usa el stock.
// `tipo` no sale escrito en el archivo: solo elige el dibujo de la categoría.
export const paraCliente = ({ nombre, marca, categoria, tipo, precio, imagen_url }) => ({ nombre, marca, categoria, tipo, precio, imagen_url });

// Avisos del catálogo (decisión del 04-11-2026): siempre rige el precio vigente al confirmar el pedido.
export const CLAUSULA = 'Precios referenciales, sujetos a cambio sin previo aviso.';
export const avisosCatalogo = (fecha) => [
  `Precios referenciales por caja o display, en pesos chilenos, al ${fecha}. Están sujetos a cambio sin previo aviso.`,
  'Rige el precio vigente al momento de confirmar su pedido.',
  'Disponibilidad sujeta a stock al confirmar el pedido.',
  'Las fotos son referenciales.',
  'Este catálogo es informativo: no constituye una oferta ni reemplaza la nota de venta. Cada pedido se confirma con su nota de venta.',
  'Catálogo mayorista dirigido a comercios.',
];

// Unidades por caja o display, leídas del nombre (x24, 24und, 20x30gr). Medidas (70 x 90) y pesos (x 40gr) no cuentan.
export function unidades(nombre) {
  const n = String(nombre || '').replace(/,/g, '.')
    .replace(/\b\d{1,3}\s*x\s*\d{1,3}\s*(?:cm|mm|mts|m)\b/gi, ' ')                                        // medidas: 10 x 7 cm
    .replace(/\b\d{2,3}\s*x\s*\d{2,3}\b(?![.]\d)(?!\s*(?:g|gr|grs|ml|und|unid|unidades|un|u)\b)/gi, ' ');   // medidas: 70 x 90
  let m = n.match(/(\d+)\s*[x×]\s*\d+(?:[.]\d+)?\s*(?:g|gr|grs|ml)\b/i) || n.match(/(\d+)\s*(?:und|unid|unidades|un|u)\b/i);
  if (m) return +m[1];
  m = n.match(/(?:^|[\s\d])[x×]\s*(\d+)(?!\s*(?:g|gr|grs|kg|ml|cc|lt|l|cm|mts|m)\b)(?![\d.])/i);
  return m ? +m[1] : 0;
}

// Íconos 8 bits por categoría (grilla 8 × 8; 1 = azul, 2 = rojo, 3 = oro).
// Sin prototipo (Object.create(null)): una categoría llamada "constructor" o "toString" no encuentra funciones internas.
export const PIX = Object.assign(Object.create(null), {
  'Chocolates': ['11111111', '12121212', '11111111', '12121212', '11111111', '12121212', '11111111', '00000000'],
  'Caramelos y chupetes': ['00222000', '02232200', '02322200', '00222000', '00010000', '00010000', '00010000', '00010000'],
  'Gomitas y jaleas': ['01100110', '01111110', '11211211', '11111111', '01111110', '01111110', '11011011', '11000011'],
  'Chicles': ['00000000', '22222222', '23333332', '22222222', '00000000', '11111111', '13333331', '11111111'],
  'Dulces de fantasía': ['00030000', '00333000', '33333330', '03333300', '00333000', '03303300', '33000330', '00000000'],
  'Galletas y obleas': ['00333300', '03333330', '33133133', '33333333', '33313333', '33133313', '03333330', '00333300'],
  'Cuidado personal': ['00111000', '00121000', '00111000', '01111100', '01222100', '01222100', '01111100', '00000000'],
  'Aseo del hogar': ['00011100', '00001000', '00111100', '01111110', '01222210', '01222210', '01111110', '00000000'],
  'Snacks salados': ['01111110', '12222221', '12333321', '12333321', '12333321', '12222221', '01111110', '00000000'],
  'Bebidas': ['00011000', '00011000', '00111100', '01111110', '01222210', '01222210', '01111110', '01111110'],
  'Sopas instantáneas': ['03030300', '00303030', '11111111', '12222221', '01222210', '00111100', '00000000', '00000000'],
  'Bazar': ['00222000', '01111100', '01333100', '01333100', '01333100', '01333100', '01111100', '00000000'],
  'Despensa': ['01111110', '10000001', '11111111', '12222221', '12222221', '12222221', '11111111', '00000000'],
});

// La C pixelada del isotipo, grilla 7 × 10.
export const C_PIX = ['0111110', '1111111', '1110011', '1100000', '1100000', '1100000', '1100000', '1110011', '1111111', '0111110'];
