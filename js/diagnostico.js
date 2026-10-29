// Datos técnicos que se adjuntan solos a cada ticket de soporte, para que soporte encuentre la causa
// sin preguntar. No incluye datos de clientes: solo números internos (id de cliente, de nota), estados y mediciones.
import * as datos from './datos.js';
import { ultimosErrores, ultimasPantallas, ultimoRastro, ultimaSync, ultimaImpresion } from './registro.js';
import { versionLocal } from './actualizacion.js';
import { esApp, Compartir } from './nativo.js';
import { esEscritorio } from './escritorio.js';
import { config } from './impresora.js';
import { estadoCapturas } from './capturas.js';

// Lo que no responde en 3 s se omite: el ticket no espera.
const conTope = (p, ms = 3000) => Promise.race([Promise.resolve(p).catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]);

// Sobre qué estaba trabajando: los últimos números internos que aparecen en las pantallas visitadas.
function contexto(recorrido) {
  const c = {};
  const reglas = [
    ['cliente', /^#\/clientes\/(\d+)/], ['nota', /^#\/pedidos\/([\w-]{8,})/], ['producto', /^#\/inventario\/(\d+)/],
    ['ruta', /^#\/rutas\/(\d+)/], ['proveedor', /^#\/proveedores\/(\d+)/], ['pedido_proveedor', /^#\/pedidos-proveedor\/([\w-]+)/],
    ['compra', /^#\/compras\/([\w-]{8,})/],
  ];
  for (const h of recorrido) for (const [k, re] of reglas) { const m = h.match(re); if (m) c[k] = m[1]; }
  return c;
}

// Lo hecho sin señal que espera subir, por tipo y estado.
function estadoCola() {
  const cola = datos.colaCompleta();
  const tipo = (x) => (x.pedido ? 'pedidos' : x.abono ? 'abonos' : x.visita ? 'visitas' : x.entrega ? 'entregas' : x.cobro ? 'cobros' : x.cotizacion ? 'cotizaciones' : x.cotizacionPedido ? 'conversiones' : x.cambio ? 'cambios' : x.entregaCambio ? 'entregas_cambio' : 'otros');
  const porTipo = {};
  for (const x of cola) porTipo[tipo(x)] = (porTipo[tipo(x)] || 0) + 1;
  return {
    total: cola.length,
    por_tipo: porTipo,
    con_problema: cola.filter((x) => x.estado === 'error').map((x) => ({ tipo: tipo(x), error: String(x.error || '').slice(0, 160), en: x.en })),
    mas_antiguo: cola.map((x) => x.en).filter(Boolean).sort()[0] || null,
  };
}

// Batería, espacio y permisos en la web (en la app Android los entrega el celular).
async function equipoWeb() {
  const r = {};
  try { const b = await navigator.getBattery?.(); if (b) { r.bateria = Math.round(b.level * 100); r.cargando = b.charging; } } catch (_) { /* no disponible */ }
  try { const e = await navigator.storage?.estimate?.(); if (e) r.espacio = `${Math.round(e.usage / 1048576)} MB usados de ${Math.round(e.quota / 1048576)} MB`; } catch (_) { /* no disponible */ }
  const permisos = {};
  for (const [k, n] of [['camara', 'camera'], ['ubicacion', 'geolocation'], ['notificaciones', 'notifications']]) {
    try { permisos[k] = (await navigator.permissions.query({ name: n })).state; } catch (_) { /* este navegador no lo informa */ }
  }
  if (Object.keys(permisos).length) r.permisos = permisos;
  return r;
}

const edad = (t) => (t ? `${Math.round((Date.now() - t) / 60000)} min` : null);

export async function datosEquipo() {
  const v = versionLocal(), yo = datos.usuario(), con = navigator.connection;
  const recorrido = ultimasPantallas().map((x) => x.h);
  const [nativo, web, reloj, capturas] = await Promise.all([
    esApp && Compartir?.infoEquipo ? conTope(Compartir.infoEquipo({ impresora: config.impresora || '' })) : null,
    esApp ? null : conTope(equipoWeb()),
    conTope(datos.desfaseReloj()),
    conTope(estadoCapturas()),
  ]);
  const sync = ultimaSync(), imp = ultimaImpresion();
  const edadCopia = datos.edadCopia();
  return {
    version: `${v.nombre}${v.codigo ? ` (${v.codigo})` : ''}`,
    commit: v.commit || null,
    plataforma: esApp ? 'App Android' : esEscritorio() ? 'Web en PC' : 'Web en celular',
    equipo: navigator.userAgent.slice(0, 300),
    celular: nativo || web || null,
    pantalla: `${innerWidth} × ${innerHeight} (×${devicePixelRatio})`,
    tema: document.documentElement.dataset.theme || 'automático',
    senal: datos.hayRed() && navigator.onLine !== false ? `Con señal${con?.effectiveType ? ` (${con.effectiveType})` : ''}${datos.senalDebil() ? ', débil' : ''}` : 'Sin señal',
    cola: datos.colaCompleta().length,
    cola_con_problema: datos.colaCompleta().filter((x) => x.estado === 'error').length,
    sin_senal: {
      cola: estadoCola(),
      ultima_subida: sync ? { hace: edad(sync.t), subidos: sync.subidos, pendientes: sync.pendientes, error: sync.error || null } : null,
      copia_descargada_hace: Number.isFinite(edadCopia) ? `${Math.round(edadCopia)} min` : 'sin copia',
      numeros_de_nota_libres: datos.numerosLibres(),
    },
    reloj: reloj == null ? 'no se pudo medir' : Math.abs(reloj) < 60 ? 'bien (menos de 1 min de diferencia)'
      : `el celular va ${reloj > 0 ? 'adelantado' : 'atrasado'} ${Math.abs(reloj) >= 3600 ? `${(Math.abs(reloj) / 3600).toFixed(1).replace('.', ',')} h` : `${Math.round(Math.abs(reloj) / 60)} min`}`,
    reloj_segundos: reloj,
    impresora: esApp ? (config.impresora ? 'Térmica elegida' : 'Sin impresora elegida') : esEscritorio() ? (config.pc === 'termica' ? 'Térmica 58 mm en el PC' : 'Impresora normal') : 'Sin impresora',
    ultima_impresion: imp ? { hace: edad(imp.t), ok: imp.ok, segundos: Math.round(imp.ms / 100) / 10, error: imp.error || null } : null,
    capturas,
    usuario: yo ? `${yo.nombre} (${yo.rol})` : null,
    hora: new Date().toISOString(),
    zona: Intl.DateTimeFormat().resolvedOptions().timeZone,
    recorrido,
    contexto: contexto(recorrido),
    rastro: ultimoRastro(),
    errores: ultimosErrores().slice(-10),
  };
}
