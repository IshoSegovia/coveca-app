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
  { ruta: 'index.html', nombre: 'inicio' },
];

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
for (const p of PANTALLAS) {
  await page.goto(`http://localhost:${puerto}/${p.ruta}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `capturas/${p.nombre}.png`, fullPage: true });
  console.log(`capturas/${p.nombre}.png`);
}
await browser.close();
server.close();
