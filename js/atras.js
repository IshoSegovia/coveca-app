// Botón "atrás" de Android: hace lo mismo que la flecha ← de la barra superior.
// MainActivity.java llama a window.covecaAtras(); si devuelve false, la app se minimiza (no se cierra).
window.covecaAtras = () => {
  // 1) Pantalla de impresión abierta: si ya terminó, se cierra; mientras imprime, no se interrumpe
  const imp = document.querySelector('.imp-capa');
  if (imp) {
    if (imp.dataset.estado !== 'imprimiendo') imp.querySelector('.imp-principal')?.click();
    return true;
  }
  // 1b) Foto abierta en grande: atrás la cierra
  if (window.covecaCerrarVisor) { window.covecaCerrarVisor(); return true; }
  // 1c) Catálogo abierto: cierra su foto o buscador, o sale a la pantalla de antes
  if (window.covecaCatalogoSalir && document.querySelector('body > .catalogo')) { window.covecaCatalogoSalir(); return true; }
  // 2) Aviso de versión nueva: atrás no lo salta (sale de la app)
  if (document.querySelector('.act-capa')) return false;
  // 3) Paso "Revisar pedido": vuelve a la lista de productos sin perder lo elegido
  const volver = document.querySelector('#vista #volver');
  if (volver) { volver.click(); return true; }
  // 4) Flecha ← de la barra superior (en la lista de productos de un pedido, pide confirmar si hay productos elegidos)
  const flecha = document.querySelector('#barra a.barra-btn[aria-label="Volver"]');
  const conf = window.covecaConfirmarSalida;
  if (flecha && conf && conf.hash === location.hash && !conf.fn()) return true;
  if (flecha) { location.hash = flecha.getAttribute('href'); return true; }
  // 5) En otra pestaña principal (Clientes, Inventario…): vuelve a Rutas
  const ruta = (location.hash || '#/rutas').split('?')[0];
  if (!/^#\/(rutas|login)?$/.test(ruta) && document.querySelector('#tabs')?.offsetParent) { location.hash = '#/rutas'; return true; }
  // 6) Inicio (Rutas) o ingreso: el teléfono minimiza la app
  return false;
};
