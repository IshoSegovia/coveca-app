// Fiado: reparte lo abonado entre las notas a crédito (primero las más antiguas) y calcula deuda y atrasos.
// Es la misma regla que las vistas fiado_notas y fiado_clientes de la base (migraciones 0018 y 0057); aquí se usa
// para sumar lo que está guardado en el celular sin subir, sin señal y en el modo demostración.
// El saldo anterior (lo que el cliente debía antes de la app, migración 0057) viene como una fila más con
// es_saldo_anterior = true y sin nota: va siempre primero en el reparto y no cuenta como "nota pendiente".

import { hoyChile, diaChile, sumarDias } from './ui.js';

export const PLAZO_DEFECTO = 15;
export const entreDias = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);

// Días extra de fiado del nivel (Programa de lealtad)
export const diasExtra = (programa, nivel) => Number(programa?.niveles?.find((n) => n.nombre === nivel)?.dias_fiado) || 0;
// Vencimiento de una nota a crédito: día de la nota + plazo del cliente (o el general) + días extra de su nivel
export const vencimiento = (fecha, plazo, extra = 0) => sumarDias(diaChile(fecha), (plazo || PLAZO_DEFECTO) + (extra || 0));

/**
 * notas: [{ id|pedido_id, numero, fecha, total, vence_en, ... }] (a crédito, no anuladas)
 * abonado: total abonado (sin anulados)
 * Devuelve { notas (con pagado, pendiente, dias_atraso), deuda, atrasado, dias_atraso, notas_pendientes, proximo_vencimiento, saldo_favor,
 *            saldo_anterior (lo que queda por pagar del saldo anterior), saldoAnterior (su fila, o null) }
 */
export function repartir(notas, abonado) {
  const hoy = hoyChile();
  let resto = Math.max(0, abonado || 0);
  const lista = notas.slice().sort((a, b) => (b.es_saldo_anterior ? 1 : 0) - (a.es_saldo_anterior ? 1 : 0)
    || a.fecha.localeCompare(b.fecha) || (a.numero || 0) - (b.numero || 0)).map((n) => {
    const pagado = Math.min(n.total, resto);
    resto -= pagado;
    const pendiente = n.total - pagado;
    const atraso = pendiente > 0 && n.vence_en && n.vence_en < hoy ? entreDias(n.vence_en, hoy) : 0;
    return { ...n, pagado, pendiente, dias_atraso: atraso };
  });
  const pend = lista.filter((n) => n.pendiente > 0);
  const saldoAnterior = lista.find((n) => n.es_saldo_anterior) || null;
  return {
    notas: lista,
    deuda: pend.reduce((s, n) => s + n.pendiente, 0),
    atrasado: pend.filter((n) => n.dias_atraso > 0).reduce((s, n) => s + n.pendiente, 0),
    dias_atraso: Math.max(0, ...lista.map((n) => n.dias_atraso)),
    notas_pendientes: pend.filter((n) => !n.es_saldo_anterior).length,
    proximo_vencimiento: pend.map((n) => n.vence_en).filter(Boolean).sort()[0] || null,
    saldo_favor: resto,
    saldo_anterior: saldoAnterior?.pendiente || 0,
    saldoAnterior,
  };
}

// ¿Supera el límite? (vacío = sin tope; $0 = sin crédito disponible: cualquier deuda lo supera)
export const sinTope = (limite) => limite == null || limite === '';
export const superaLimite = (limite, deudaConPedido) => !sinTope(limite) && deudaConPedido > limite;
// Texto del límite para mostrar
export const textoLimite = (limite, clp) => (sinTope(limite) ? 'Sin tope' : Number(limite) === 0 ? 'Sin crédito disponible' : clp(limite));
