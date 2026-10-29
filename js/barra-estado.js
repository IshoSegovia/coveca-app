// Barra de estado de Android (hora, batería): sobre el encabezado claro los íconos van oscuros;
// en tema oscuro, claros. Solo en la app (plugin Compartir.barraEstado); en la web no hace nada.
import { Compartir } from './nativo.js';

export function aplicarBarraEstado() {
  if (!Compartir) return;   // solo en la app
  const pintar = () => {
    const oscuro = document.documentElement.getAttribute('data-tema') === 'oscuro';
    const fondo = getComputedStyle(document.documentElement).getPropertyValue('--fondo').trim() || '#F6F7FB';
    try { Compartir.barraEstado?.({ clara: !oscuro, color: fondo })?.catch?.(() => {}); } catch (_) {}   // APK antiguo sin el método: se ignora
  };
  pintar();
  new MutationObserver(pintar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
}
