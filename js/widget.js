// Widgets de Android (Ruta de hoy, Nuevo pedido, Pedidos y Tu semana): la app les pasa los datos al abrir
// el inicio o la pestaña Pedidos. Se guardan juntos (lo último que se supo de cada dato) y se envían al plugin,
// que redibuja todos los widgets puestos en la pantalla de inicio. En la web no hace nada.
import { Compartir } from './nativo.js';
import { leerAjuste, guardarAjuste } from './ui.js';

const VACIO = { ruta: '', hechos: 0, total: 0, proximos: '[]', porEntregar: 0, porCobrar: 0, montoEntregar: 0, montoCobrar: 0,
  semTotal: -1, semMeta: 0, semDias: '' };

export function actualizarWidget(datos) {
  if (!Compartir) return;
  let w = {};
  try { w = JSON.parse(leerAjuste('coveca-widget', '{}')); } catch (_) {}
  w = { ...VACIO, ...w, ...datos };
  guardarAjuste('coveca-widget', JSON.stringify(w));
  try { Compartir.widget?.(w)?.catch?.(() => {}); } catch (_) {}   // APK antiguo sin widget: se ignora
}
