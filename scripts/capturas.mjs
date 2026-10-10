// Saca capturas de todas las pantallas en tamaño de celular (Motorola Edge 60), en modo demostración.
// Uso: node scripts/capturas.mjs   → imágenes en capturas/
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const RAIZ = new URL('../www/', import.meta.url).pathname;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

// [ruta, archivo, acción opcional antes de la captura]
const PANTALLAS = [
  ['#/login', '00-ingreso'],
  ['#/rutas', '01-rutas'],
  ['#/rutas/1', '02-ruta-detalle'],
  ['#/rutas/sin', '03-sin-ruta'],
  ['#/rutas/1/recorrido', '03b-recorrido'],
  ['#/rutas/nueva', '04-ruta-nueva'],
  ['#/clientes', '05-clientes'],
  ['#/clientes/1', '06-cliente-perfil'],
  ['#/clientes/1/editar', '07-cliente-editar'],
  ['#/inventario', '08-inventario'],
  ['#/inventario/1', '09-producto'],
  ['#/inventario/nuevo', '10-producto-nuevo'],
  ['#/clientes/1/pedido', '11-pedido', async (p) => {
    for (const id of [12, 12, 4]) await p.click(`.fila.prod[data-id="${id}"] [data-d="1"]`);
  }],
  ['#/clientes/1/pedido', '12-pedido-revisar', async (p) => {
    for (const id of [12, 12, 4]) await p.click(`.fila.prod[data-id="${id}"] [data-d="1"]`);
    await p.click('#sig');
  }],
  ['#/reportes', '14-reportes'],
  ['#/reportes/stock-bajo', '15-stock-bajo'],
  ['#/reportes/ventas-semana', '16-ventas-semana'],
  ['#/proveedores', '17-proveedores'],
  ['#/proveedores/1', '18-proveedor'],
  ['#/proveedores/1/editar', '18b-proveedor-editar'],
  ['#/ajustes', '13-ajustes'],
];

const server = createServer(async (req, res) => {
  try {
    const ruta = join(RAIZ, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    const datos = await readFile(ruta);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(ruta)] || 'application/octet-stream' });
    res.end(datos);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/index.html`;

await mkdir('capturas', { recursive: true });
// En el entorno de Claude el Chromium ya viene instalado aquí; en otro equipo usa el de Playwright.
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, locale: 'es-CL' });
let errores = 0;
page.on('pageerror', (e) => { errores++; console.error('ERROR en la página:', e.message); });
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|net::ERR_/.test(m.text())) { errores++; console.error('consola:', m.text()); } });

await page.goto(base + '#/login');
await page.waitForTimeout(500);
await page.screenshot({ path: 'capturas/00-ingreso.png' });
await page.click('#demo');
await page.waitForTimeout(400);
for (const [ruta, nombre, accion] of PANTALLAS.slice(1)) {
  await page.goto('about:blank');
  await page.goto(base + ruta);
  await page.waitForTimeout(500);
  if (accion) { await accion(page); await page.waitForTimeout(300); }
  await page.screenshot({ path: `capturas/${nombre}.png` });
  console.log(`capturas/${nombre}.png`);
}
await browser.close();
server.close();
if (errores) { console.error(`${errores} error(es) en la página`); process.exit(1); }
