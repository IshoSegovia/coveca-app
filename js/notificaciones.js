// Notificaciones del celular (solo app Android; pedido del 10-11-2026). Las arma la app con lo que tiene guardado
// (copia y cola), sin servidor ni Firebase: funcionan sin señal y salen solo en el celular donde pasó cada cosa.
// Cada vez que cambia algo (al abrir o volver a la app, al guardar la copia, al cambiar la cola) se recalcula el plan
// y se reprograma. Un interruptor en Ajustes las apaga todas (clave `coveca-notificaciones` = 'no').
//
//  N°   Aviso                                   Para           Cuándo (hora de Chile)
//  100  Buenos días: ruta, por entregar,        todos          8:00
//       créditos de la ruta y cotizaciones que vencen mañana (avisos 1, 2, 8 y 9 juntos)
//  101  Registros o fotos sin subir             todos          2 h después del más antiguo
//  102  Registro con problema                   todos          apenas el servidor lo rechaza
//  103  Entregadas sin pago                     todos          18:00
//  104  Cierre del día                          todos          19:00, solo si vendió ese día
//  105  Stock bajo o negativo                   administrador  18:00
//  106  Pedidos a proveedor por enviar          administrador  9:00 (por enviar > 1 día; enviados sin recibir > 5 días)
import * as datos from './datos.js';
import * as local from './local.js';
import { Avisos, esApp } from './nativo.js';
import { ZONA, diaChile, hoyChile, sumarDias, clp, plural, leerAjuste, guardarAjuste, DIAS } from './ui.js';

export const CLAVE = 'coveca-notificaciones';
const CANAL = 'coveca-avisos';
const IDS = [100, 101, 102, 103, 104, 105, 106];
export const activas = () => leerAjuste(CLAVE, 'si') !== 'no';

// ---------- Fechas en hora de Chile ----------
// Minutos que Chile va detrás o delante de UTC en el instante t (con su horario de verano).
function desfase(t) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hourCycle: 'h23', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000) / 60000;
}
// Instante del día `dia` ('AAAA-MM-DD') a la hora `h` de Chile.
export function enChile(dia, h) {
  const base = Date.parse(`${dia}T${String(h).padStart(2, '0')}:00:00Z`);
  let t = base - desfase(base) * 60000;
  t = base - desfase(t) * 60000;   // una segunda vuelta corrige el día que cambia la hora
  return new Date(t);
}
// Próxima vez que el reloj de Chile marca la hora h (hoy si aún no pasa; si no, mañana). Devuelve { dia, at }.
export function proxima(h, ahora) {
  const hoy = diaChile(ahora);
  const at = enChile(hoy, h);
  return at.getTime() > ahora + 60000 ? { dia: hoy, at } : { dia: sumarDias(hoy, 1), at: enChile(sumarDias(hoy, 1), h) };
}
const diaSemana = (dia) => ((new Date(dia + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1;   // 1 = lunes … 7 = domingo

// ---------- El plan: qué avisar y cuándo ----------
// e = { yo, admin, copia, entregas, cotizaciones, cola, fotos, proveedor (null = no se pudo leer), umbral, avisados }
// Devuelve { lista: [{ id, at, titulo, texto, largo?, ir }], avisados, mantener: [ids que no se tocan] }.
export function planificar(e, ahora = Date.now()) {
  const lista = [], c = e.copia || {}, mantener = [];
  const agregar = (id, at, titulo, lineas, ir) => {
    const [texto, ...resto] = lineas;
    lista.push({ id, at: new Date(at), titulo, texto, ...(resto.length ? { largo: lineas.join('\n') } : {}), ir });
  };

  // 100 · Buenos días (8:00): ruta del día, notas por entregar, créditos de la ruta y cotizaciones por vencer.
  const m = proxima(8, ahora), D = m.dia;
  const rutasDia = (c.rutas || []).filter((r) => r.dia_semana === diaSemana(D) && r.activa !== false);
  const idsRuta = new Set(rutasDia.map((r) => r.id));
  const visitado = (k) => ('visitado_hasta_compra' in k || 'visitado_hasta_visita' in k)
    ? (!!k.visitado_hasta_compra && k.visitado_hasta_compra >= D) || (!!k.visitado_hasta_visita && k.visitado_hasta_visita >= D)
    : !!k.atendido;
  const deRuta = (c.clientes || []).filter((k) => k.activo !== false && idsRuta.has(k.ruta_id));
  const lineas = [];
  for (const r of rutasDia) {
    const n = deRuta.filter((k) => k.ruta_id === r.id && !visitado(k)).length;
    lineas.push(`${r.nombre}: ${plural(n, 'cliente')} por visitar.`);
  }
  const porEntregar = (e.entregas || []).filter((p) => !p.entregado_en && diaChile(p.fecha) < D);
  if (porEntregar.length) lineas.push(`${plural(porEntregar.length, 'nota')} por entregar (${clp(porEntregar.reduce((a, p) => a + (p.total || 0), 0))}).`);
  const idsClientesRuta = new Set(deRuta.map((k) => String(k.id)));
  const creditos = (c.fiadoNotas || []).filter((n) => (n.pendiente || 0) > 0 && n.vence_en && n.vence_en <= D && idsClientesRuta.has(String(n.cliente_id)));
  const conCredito = new Set(creditos.map((n) => String(n.cliente_id)));
  if (conCredito.size) lineas.push(`${plural(conCredito.size, 'cliente')} de la ruta con crédito vencido o que vence hoy (${clp(creditos.reduce((a, n) => a + n.pendiente, 0))}).`);
  const cotizaciones = (e.cotizaciones || []).filter((q) => !q.pedido_id && !q.eliminada_en && q.valida_hasta === sumarDias(D, 1));
  if (cotizaciones.length) lineas.push(`${plural(cotizaciones.length, 'cotización', 'cotizaciones')} vence${cotizaciones.length === 1 ? '' : 'n'} mañana sin convertir en pedido.`);
  if (lineas.length) {
    const titulo = rutasDia.length === 1 ? `Ruta de hoy: ${rutasDia[0].nombre}` : rutasDia.length ? `Rutas de hoy (${DIAS[diaSemana(D)]})` : 'Buenos días';
    // Con una sola ruta su nombre ya va en el título: la primera línea dice solo cuántos clientes.
    if (rutasDia.length === 1) lineas[0] = lineas[0].replace(`${rutasDia[0].nombre}: `, '').replace(/^./, (x) => x.toUpperCase());
    agregar(100, m.at, titulo, lineas, rutasDia.length ? '#/rutas' : porEntregar.length ? '#/pedidos' : '#/rutas');
  }

  // 101 · Registros o fotos sin subir: 2 h después del más antiguo (si ya pasaron, 2 h desde ahora).
  const pendientes = (e.cola || []).filter((x) => x.estado !== 'error');
  const nSubir = pendientes.length + (e.fotos || 0);
  if (nSubir) {
    const viejo = Math.min(...pendientes.map((x) => Date.parse(x.en) || ahora), ahora);
    let at = viejo + 2 * 3600e3;
    if (at <= ahora + 60000) at = ahora + 2 * 3600e3;
    const que = [pendientes.length ? plural(pendientes.length, 'registro') : '', e.fotos ? plural(e.fotos, 'foto') : ''].filter(Boolean).join(' y ');
    agregar(101, at, `${que} sin subir`, ['Abre la app con señal para que se suban. Mientras tanto, solo están en este celular.'], '#/pendientes');
  }

  // 102 · Registro con problema: apenas aparece uno nuevo (cada registro avisa una sola vez).
  const conProblema = (e.cola || []).filter((x) => x.estado === 'error');
  const ids = conProblema.map((x) => local.registro(x).id);
  const nuevos = ids.filter((id) => !(e.avisados || []).includes(id));
  if (nuevos.length) {
    agregar(102, ahora + 3000, `${plural(conProblema.length, 'registro')} con problema`,
      ['El servidor no lo aceptó. Toca para ver qué pasó y decidir qué hacer.'], '#/pendientes');
  } else mantener.push(102);   // ya avisado: no se repite ni se borra el que está a la vista
  const avisados = ids;   // se olvidan los que ya no tienen problema

  // 103 · Entregadas sin pago (18:00).
  const t18 = proxima(18, ahora);
  const sinPago = (e.entregas || []).filter((p) => p.entregado_en && datos.porCobrar(p));
  if (sinPago.length) agregar(103, t18.at, `${plural(sinPago.length, 'nota entregada', 'notas entregadas')} sin pago`,
    [`Por cobrar: ${clp(sinPago.reduce((a, p) => a + (p.total || 0), 0))}. Registra el pago o déjalas a crédito.`], '#/pedidos');

  // 104 · Cierre del día (19:00 de hoy, solo si este usuario vendió hoy).
  const hoy = diaChile(ahora), t19 = enChile(hoy, 19);
  if (t19.getTime() > ahora + 60000) {
    const delServidor = (c.pedidos || []).filter((p) => p.estado !== 'anulado' && p.vendedor_id === e.yo?.id && diaChile(p.fecha) === hoy);
    const enCola = (e.cola || []).filter((x) => x.pedido && diaChile(x.pedido.fecha || ahora) === hoy && !delServidor.some((p) => p.id === x.pedido.id));
    const n = delServidor.length + enCola.length;
    if (n) agregar(104, t19, 'Cierre del día', [`Hoy hiciste ${plural(n, 'nota')} por ${clp(delServidor.reduce((a, p) => a + (p.total || 0), 0) + enCola.reduce((a, x) => a + (x.resumen?.total || 0), 0))}. Revisa el efectivo a rendir.`], `#/reportes/cierre?dia=${hoy}`);
  }

  if (e.admin) {
    // 105 · Stock bajo o negativo (18:00), con el mismo criterio que el reporte Stock bajo.
    const umbral = e.umbral ?? 3;
    const prods = (c.productos || []).filter((p) => p.activo && p.categoria_clave !== 'pruebas');
    const neg = prods.filter((p) => p.stock < 0).length, sin = prods.filter((p) => p.stock === 0).length;
    const bajo = prods.filter((p) => p.stock > 0 && p.stock <= (p.stock_minimo ?? umbral)).length;
    if (neg + sin + bajo) agregar(105, t18.at, `${plural(neg + sin + bajo, 'producto')} con stock bajo`,
      [[neg ? `${neg} negativo${neg === 1 ? '' : 's'}` : '', sin ? `${sin} sin stock` : '', bajo ? `${bajo} bajo el mínimo` : ''].filter(Boolean).join(', ') + '. Toca para ver el reporte.'], '#/reportes/stock-bajo');

    // 106 · Pedidos a proveedor olvidados (9:00): por enviar hace más de 1 día o enviados sin recibir hace más de 5.
    if (e.proveedor == null) mantener.push(106);   // sin señal: queda lo programado antes
    else {
      const t9 = proxima(9, ahora), cuando = t9.at.getTime();
      const porEnviar = e.proveedor.filter((x) => x.estado === 'por_enviar' && Date.parse(x.creado_en) < cuando - 864e5).length;
      const sinRecibir = e.proveedor.filter((x) => x.estado === 'enviado' && Date.parse(x.enviado_en || x.creado_en) < cuando - 5 * 864e5).length;
      const partes = [porEnviar ? `${plural(porEnviar, 'pedido')} por enviar` : '', sinRecibir ? `${plural(sinRecibir, 'pedido')} enviado${sinRecibir === 1 ? '' : 's'} hace más de 5 días sin recibir` : ''].filter(Boolean);
      if (partes.length) agregar(106, t9.at, 'Pedidos a proveedores', [partes.join(' y ').replace(/^./, (x) => x.toUpperCase()) + '.'], '#/pedidos-proveedor');
    }
  }
  return { lista, avisados, mantener };
}

// ---------- Programar en el celular ----------
let pendiente = null, corriendo = false, otraVez = false, permisoPedido = false;
// Pide recalcular (se juntan los pedidos de los próximos 3 s en uno).
export function reprogramar(ms = 3000) {
  if (!esApp || !Avisos) return;
  clearTimeout(pendiente);
  pendiente = setTimeout(correr, ms);
}
async function correr() {
  if (corriendo) { otraVez = true; return; }
  corriendo = true;
  try { await programar(); } catch (err) { console.warn('Notificaciones:', err?.message || err); }
  corriendo = false;
  if (otraVez) { otraVez = false; reprogramar(); }
}
async function cancelar(ids) {
  if (ids.length) await Avisos.cancel({ notifications: ids.map((id) => ({ id })) });
}
async function programar() {
  const yo = datos.usuario();
  if (!yo || (datos.enDemo() && !window.covecaNotifPrueba)) return;   // en el modo de ejemplo, solo en pruebas automáticas
  if (!activas()) { await cancelar(IDS); guardarAjuste('coveca-notif-plan', ''); return; }
  if (!(await permiso())) return;
  const admin = datos.esAdmin();
  const [entregas, cotizaciones, proveedor] = await Promise.all([
    datos.pedidosEntrega().catch(() => []),
    datos.cotizaciones().catch(() => []),
    admin ? datos.pedidosProveedor({ limite: 200 }).catch(() => null) : null,
  ]);
  let avisados = [];
  try { avisados = JSON.parse(leerAjuste('coveca-notif-problemas', '[]')); } catch (_) { /* vacío */ }
  const plan = planificar({ yo, admin, copia: local.copia(), entregas, cotizaciones, proveedor, cola: datos.colaCompleta(),
    fotos: datos.fotosPorSubir(), umbral: Number(leerAjuste('reporte-umbral', 3)), avisados });
  guardarAjuste('coveca-notif-problemas', JSON.stringify(plan.avisados));
  // Solo se toca el celular si el plan cambió (cada vuelta a la app recalcula).
  const huella = JSON.stringify(plan.lista.map((n) => [n.id, n.at.getTime(), n.titulo, n.texto, n.largo]));
  if (huella === leerAjuste('coveca-notif-plan')) return;
  const quedan = new Set([...plan.lista.map((n) => n.id), ...plan.mantener]);
  await cancelar(IDS.filter((id) => !quedan.has(id)));
  if (plan.lista.length) await Avisos.schedule({ notifications: plan.lista.map((n) => ({
    id: n.id, title: n.titulo, body: n.texto, ...(n.largo ? { largeBody: n.largo } : {}), channelId: CANAL,
    schedule: { at: n.at.toISOString(), allowWhileIdle: true }, extra: { ir: n.ir },
  })) });
  guardarAjuste('coveca-notif-plan', huella);
}
// Android 13 o más nuevo pide permiso para mostrar notificaciones: se pide una vez; si lo niega, no se insiste.
async function permiso() {
  let p = await Avisos.checkPermissions();
  if (p.display === 'granted') return true;
  if (permisoPedido || leerAjuste('coveca-notif-permiso') === 'pedido') return false;
  permisoPedido = true;
  guardarAjuste('coveca-notif-permiso', 'pedido');
  p = await Avisos.requestPermissions();
  return p.display === 'granted';
}
export async function permisoActual() {
  if (!esApp || !Avisos) return null;
  try { return (await Avisos.checkPermissions()).display; } catch (_) { return null; }
}

// Interruptor de Ajustes: apaga o enciende todas. Al encender, si el permiso estaba negado, se vuelve a pedir.
export async function cambiar(si) {
  guardarAjuste(CLAVE, si ? 'si' : 'no');
  guardarAjuste('coveca-notif-plan', '');
  if (si) { permisoPedido = false; guardarAjuste('coveca-notif-permiso', ''); }
  if (!esApp || !Avisos) return;
  if (!si) { await cancelar(IDS).catch(() => {}); return; }
  await correr();
}

// Arranque (main.js): canal, toque en una notificación y cuándo recalcular.
export function iniciarNotificaciones() {
  if (!esApp || !Avisos) return;
  Avisos.createChannel?.({ id: CANAL, name: 'Avisos de COVECA', description: 'Ruta del día, pedidos por entregar o cobrar, registros sin subir y stock', importance: 3, visibility: 1 }).catch(() => {});
  // Tocar la notificación abre la pantalla que corresponde.
  Avisos.addListener('localNotificationActionPerformed', (a) => {
    const ir = a?.notification?.extra?.ir;
    if (typeof ir === 'string' && /^#\/[\w/=?&-]*$/.test(ir)) location.hash = ir;
  });
  window.addEventListener('coveca:cola', () => reprogramar());
  window.addEventListener('coveca:copia', () => reprogramar());
  window.addEventListener('coveca:sesion', (e) => { if (e.detail) reprogramar(5000); else cancelar(IDS).catch(() => {}); });
  window.addEventListener('coveca:salir', () => { cancelar(IDS).catch(() => {}); guardarAjuste('coveca-notif-plan', ''); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reprogramar(5000); });
  reprogramar(8000);   // después de abrir y sincronizar
}
