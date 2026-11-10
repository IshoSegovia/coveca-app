// Reglas de los nombres de categoría para la app (las usan Inventario → Categorías y la ficha del producto).
// El servidor hace cumplir lo mismo (migraciones 0060 y 0061); aquí se avisa antes y con palabras claras.
import { normal } from './ui.js';

export const esPruebas = (c) => c?.clave === 'pruebas' || (!c?.clave && c?.nombre === 'Pruebas');
export const limpiarNombre = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
// Letras como las lee el servidor (siguiente_ref de la 0059 y la regla de la 0061): solo cambia á é í ó ú ü ñ y
// descarta el resto (ç, è…). Las 3 primeras son el REF de los productos nuevos: "Té" → TEX, "Lácteos" → LAC.
const TILDES = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n', Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', Ü: 'U', Ñ: 'N' };
const letras = (nombre) => String(nombre ?? '').replace(/[áéíóúüñÁÉÍÓÚÜÑ]/g, (l) => TILDES[l]).toUpperCase().replace(/[^A-Z]/g, '');
export const letrasRef = (nombre) => letras(nombre).slice(0, 3).padEnd(3, 'X');

// Revisa un nombre nuevo (id = la categoría que se renombra). Devuelve:
//   { error }      no se puede guardar (con qué hacer);
//   { igual }      ya existe una igual sin contar mayúsculas ni tildes (además trae error);
//   { confirmar }  se puede, pero conviene preguntar (el nombre es una marca);
//   {}             todo bien.
export function revisarNombre(nombre, { cats = [], marcas = [], id = null } = {}) {
  const accion = id ? 'Usar ese nombre' : 'Crear la categoría';
  const n = normal(nombre);
  if (!n) return { error: 'Escribe el nombre de la categoría.' };
  if (nombre.length > 40) return { error: 'El nombre puede tener hasta 40 letras. Acórtalo un poco.' };
  if (!letras(nombre)) return { error: 'El nombre necesita al menos una letra, por ejemplo "Lácteos".' };
  if (n === 'pruebas') return { error: '"Pruebas" está reservado para los productos de prueba. Elige otro nombre.' };
  const igual = cats.find((c) => c.id !== id && normal(c.nombre) === n);
  if (igual) return { igual, error: `Ya existe "${igual.nombre}". Elige esa categoría o escribe otro nombre.` };
  const marca = marcas.find((m) => normal(m) === n);
  if (marca) return { confirmar: `"${marca}" es una marca. Las categorías son por tipo de producto (por ejemplo, Chocolates) y la marca va en el campo Marca de cada producto. ¿${accion} igual?` };
  return {};
}
