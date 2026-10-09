// Saca capturas de las pantallas de la app en tamaño de celular (Motorola Edge 60).
// Uso: node scripts/capturas.mjs   → imágenes en capturas/
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const RAIZ = new URL('../www/', import.meta.url).pathname;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

// Pantallas a capturar: ruta dentro de www/ y nombre del archivo.
const PANTALLAS = [
  ['#/rutas', '01-rutas'], ['#/rutas/1', '02-ruta-detalle'], ['#/rutas/sin-ruta', '03-sin-ruta'], ['#/rutas/nueva', '04-ruta-nueva'],
  ['#/clientes', '05-clientes'], ['#/clientes/1', '06-cliente-perfil'], ['#/clientes/1/editar', '07-cliente-editar'],
  ['#/inventario', '08-inventario'], ['#/productos/1', '09-producto'], ['#/productos/nuevo', '10-producto-nuevo'],
  ['#/pedido/1', '11-pedido'], ['#/mas', '12-mas'], ['#/mas/impresora', '13-impresora'], ['#/ingreso', '14-ingreso'],
].map(([ruta, nombre]) => ({ ruta: 'index.html' + ruta, nombre }));

const server = createServer(async (req, res) => {
  try {
    const ruta = join(RAIZ, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    const datos = await readFile(ruta);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(ruta)] || 'application/octet-stream' });
    res.end(datos);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const puerto = server.address().port;

await mkdir('capturas', { recursive: true });
// En el entorno de Claude el Chromium ya viene instalado aquí; en otro equipo usa el de Playwright.
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, locale: 'es-CL' });
page.on('pageerror', (e) => console.error('ERROR en la página:', e.message));
await page.goto(`http://localhost:${puerto}/index.html`);
for (const p of PANTALLAS) {
  await page.evaluate((h) => { location.hash = h; }, p.ruta.split('#')[1] || '');
  await page.waitForTimeout(400);
  // En el pedido, agregar productos de ejemplo para ver el estado con carrito
  if (p.nombre === '11-pedido') {
    await page.click('.fila-producto[data-id="9"] .paso-mas'); await page.click('.fila-producto[data-id="9"] .paso-mas');
    await page.click('.fila-producto[data-id="7"] .paso-mas'); await page.waitForTimeout(200);
  }
  await page.screenshot({ path: `capturas/${p.nombre}.png` });
  console.log(`capturas/${p.nombre}.png`);
}
await browser.close();
server.close();
