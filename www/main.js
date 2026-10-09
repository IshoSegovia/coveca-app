// Punto de entrada de la app COVECA.
import { resolver, ir, actualizarRed } from './nucleo.js';
import { datos } from './datos.js';
import './pantallas/rutas.js';
import './pantallas/clientes.js';
import './pantallas/inventario.js';
import './pantallas/pedido.js';
import './pantallas/mas.js';
import './pantallas/ingreso.js';

async function navegar() {
  const u = await datos.usuarioActual();
  if (!u && location.hash !== '#/ingreso') return ir('/ingreso');
  await resolver();
}
window.addEventListener('hashchange', navegar);
window.addEventListener('online', actualizarRed);
window.addEventListener('offline', actualizarRed);
navegar();
