// Programa de lealtad COVECA: 4 niveles según lo comprado en los últimos 90 días.
// Un cliente alcanza un nivel si cumple las DOS metas: monto comprado y semanas con compra (volumen + frecuencia).
// Quien nunca ha comprado (ni en Loyverse ni en la app) es "Cliente nuevo": sin rango ni marco. Con su primera compra pasa al primer nivel.
// Toda la regla vive aquí (la base de datos solo suma compras y semanas: vista lealtad_clientes).
import { clp } from './ui.js';

export const PROGRAMA_DEFECTO = {
  activo: true, dias: 90, margen_minimo: 0.10,
  niveles: [
    { nombre: 'Bronce', monto: 0, semanas: 0, descuento: 0, beneficios: 'Acumula compras para subir de nivel' },
    { nombre: 'Plata', monto: 150000, semanas: 4, descuento: 1, beneficios: 'Fiado hasta 7 días' },
    { nombre: 'Oro', monto: 400000, semanas: 7, descuento: 2, beneficios: 'Fiado hasta 15 días · Ofertas antes que nadie' },
    { nombre: 'Platino', monto: 800000, semanas: 10, descuento: 3, beneficios: 'Fiado hasta 30 días · Ofertas antes que nadie' },
  ],
};

const SIN_COMPRAS = { monto: 0, semanas: 0, compras: 0, monto_en_30: 0, semanas_en_30: 0, compro_esta_semana: false, alguna_compra: false };
export const NUEVO = 'Cliente nuevo';

/** Índice del nivel más alto cuyas dos metas se cumplen. */
export function indiceNivel(monto, semanas, cfg) {
  let i = 0;
  cfg.niveles.forEach((n, k) => { if (monto >= n.monto && semanas >= n.semanas) i = k; });
  return i;
}

/** Estado completo de un cliente: nivel, siguiente, cuánto falta y si está por bajar. */
export function estado(stats, cfg) {
  const s = { ...SIN_COMPRAS, ...(stats || {}) };
  const nuevo = !s.alguna_compra && !s.compras;
  const i = indiceNivel(s.monto, s.semanas, cfg);
  const sig = cfg.niveles[i + 1] || null;
  const en30 = indiceNivel(s.monto_en_30, s.semanas_en_30, cfg);
  return {
    activo: !!cfg.activo, stats: s, i, nivel: cfg.niveles[i], siguiente: sig, nuevo, primero: cfg.niveles[0],
    nombre: nuevo ? NUEVO : cfg.niveles[i].nombre,
    falta: sig ? { monto: Math.max(0, sig.monto - s.monto), semanas: Math.max(0, sig.semanas - s.semanas) } : null,
    // Si no vuelve a comprar, dentro de 30 días salen de la cuenta sus compras más antiguas
    bajaA: en30 < i ? cfg.niveles[en30] : null,
    // Avance hacia el siguiente nivel (0 a 1): el menor entre monto y semanas, porque se necesitan ambos
    avance: sig ? Math.min(sig.monto ? s.monto / sig.monto : 1, sig.semanas ? s.semanas / sig.semanas : 1, 1) : 1,
  };
}

/** "Le faltan $85.000 y 2 semanas con compra para Oro" */
export function textoFalta(e) {
  if (e.nuevo) return `Con su primera compra pasa a ${e.primero.nombre}`;
  if (!e.siguiente) return `Nivel máximo: ${e.nivel.nombre}`;
  const partes = [];
  if (e.falta.monto > 0) partes.push(clp(e.falta.monto));
  if (e.falta.semanas > 0) partes.push(`${e.falta.semanas} semana${e.falta.semanas === 1 ? '' : 's'} con compra`);
  return partes.length ? `Le faltan ${partes.join(' y ')} para ${e.siguiente.nombre}` : `Listo para ${e.siguiente.nombre}`;
}

/** Compras del cliente sumando la nota que se está generando. */
export function trasCompra(stats, total) {
  const s = { ...SIN_COMPRAS, ...(stats || {}) };
  return { ...s, alguna_compra: true, monto: s.monto + total, semanas: s.semanas + (s.compro_esta_semana ? 0 : 1), compras: s.compras + 1,
    monto_en_30: s.monto_en_30 + total, semanas_en_30: s.semanas_en_30 + (s.compro_esta_semana ? 0 : 1), compro_esta_semana: true };
}

/**
 * Descuento de lealtad de una nota. Cada producto recibe el % del nivel, pero nunca queda bajo el margen mínimo:
 * precio mínimo = costo ÷ (1 − margen mínimo). Si el precio ya está bajo ese mínimo, ese producto no lleva descuento.
 * items: [{ precio, costo, cant }]. Devuelve { monto, limitado } (limitado = algún producto tuvo menos descuento).
 */
export function descuentoNota(items, pct, margenMinimo) {
  if (!pct) return { monto: 0, limitado: false };
  let monto = 0, limitado = false;
  for (const it of items) {
    const linea = it.precio * it.cant;
    const pedido = linea * pct / 100;
    const piso = it.costo > 0 ? Math.ceil(it.costo / (1 - margenMinimo)) * it.cant : 0;
    const permitido = Math.max(0, linea - piso);
    if (permitido < pedido) limitado = true;
    monto += Math.min(pedido, permitido);
  }
  return { monto: Math.floor(monto), limitado };
}

/** Bloque para la nota impresa y el QR. */
export function paraNota(e, ahorro, despues) {
  const subio = despues.i > e.i || (e.nuevo && !despues.nuevo);
  return {
    nivel: e.nuevo ? 'Nuevo' : e.nivel.nombre,
    ahorro,
    lineas: [
      e.nuevo ? `¡Bienvenido! Ya es cliente ${despues.nivel.nombre}`
        : subio ? `¡Subió a nivel ${despues.nivel.nombre}!` : `Cliente ${e.nivel.nombre}${ahorro ? ` · Ahorró ${clp(ahorro)}` : ''}`,
      subio && ahorro ? `Ahorró ${clp(ahorro)} en esta compra` : textoFalta(despues),
    ],
  };
}
