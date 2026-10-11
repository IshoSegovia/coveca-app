// Auditoría automática de diseño (DESIGN.md) en todas las pantallas, tema claro y oscuro, a 412 px de ancho.
// Revisa: letra mínima (14 px secundario), contraste (4,5:1; 3:1 en letra grande), zonas tocables (48 px),
// un solo botón principal, desbordes horizontales e imágenes rotas. Uso: node scripts/auditoria.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const RAIZ = new URL('../www/', import.meta.url).pathname;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const agregar = (ids) => async (p) => { for (const id of ids) await p.click(`.fila.prod[data-id="${id}"] [data-d="1"]`); };
const PANTALLAS = [
  ['#/rutas'], ['#/rutas/1'], ['#/rutas/sin'], ['#/rutas/1/recorrido'], ['#/rutas/nueva'], ['#/rutas/1/editar'],
  ['#/clientes', async (p) => p.click('[data-v="iconos"]')], ['#/clientes', async (p) => p.click('[data-v="lista"]')],
  ['#/clientes/1'], ['#/clientes/6'], ['#/clientes/8'], ['#/clientes/1/editar'], ['#/clientes/nuevo'],
  ['#/inventario', async (p) => p.click('[data-v="iconos"]')], ['#/inventario', async (p) => p.click('[data-v="lista"]')],
  ['#/inventario/1'], ['#/inventario/nuevo'],
  ['#/clientes/1/pedido', agregar([12, 12, 4])],
  ['#/clientes/1/pedido', async (p) => { await agregar([12, 12, 1, 4])(p); await p.click('#sig'); }],
  ['#/reportes'], ['#/reportes/stock-bajo'], ['#/reportes/ventas-semana'], ['#/reportes/lealtad'],
  ['#/proveedores'], ['#/proveedores/1'], ['#/proveedores/1/editar'], ['#/proveedores/nuevo'],
  ['#/ajustes'], ['#/ajustes/avanzado'], ['#/lealtad'],
];

const server = createServer(async (req, res) => {
  try {
    const ruta = join(RAIZ, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    const datos = await readFile(ruta);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(ruta)] || 'application/octet-stream' }); res.end(datos);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/index.html`;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, locale: 'es-CL' });

// Se ejecuta dentro de la página: devuelve la lista de problemas.
function revisar() {
  const prob = [];
  const visible = (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && Number(c.opacity) > 0.05; };
  const rgb = (s) => { const m = s.match(/[\d.]+/g); return m ? m.map(Number) : [0, 0, 0, 0]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = (e) => { for (let x = e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if ((c[3] ?? 1) > 0.5) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
  const nombre = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30)}"`;
  const vistos = new Set();
  // Texto: tamaño y contraste
  for (const e of document.querySelectorAll('body *')) {
    if (!visible(e) || e.closest('svg, .cinta-demo, .imp-papel, [aria-hidden="true"]')) continue;
    const propio = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const campo = /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName);
    if (!propio && !campo) continue;
    const c = getComputedStyle(e), tam = parseFloat(c.fontSize), negrita = Number(c.fontWeight) >= 600;
    if (tam < 14) prob.push(`letra ${tam}px < 14: ${nombre(e)}`);
    if (e.disabled || e.closest('[disabled], [inert]')) continue;
    const col = rgb(c.color), bg = fondo(e);
    const a = lum(col), b = lum(bg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const min = tam >= 24 || (negrita && tam >= 18.66) ? 3 : 4.5;
    if (ratio < min && !vistos.has(nombre(e))) { vistos.add(nombre(e)); prob.push(`contraste ${ratio.toFixed(2)} < ${min}: ${nombre(e)}`); }
  }
  // Zonas tocables
  for (const e of document.querySelectorAll('a[href], button, select, input:not([type=hidden]):not([type=radio]):not([type=checkbox]), textarea, label.check, label.opcion, label.btn')) {
    if (!visible(e) || e.closest('[hidden]')) continue;
    const r = e.getBoundingClientRect();
    if ((r.height < 48 || r.width < 48) && !e.closest('p')) prob.push(`toque ${Math.round(r.width)}×${Math.round(r.height)} < 48: ${nombre(e)}`);
  }
  // Un solo botón principal
  const prin = [...document.querySelectorAll('.btn.prin')].filter(visible);
  if (prin.length > 1) prob.push(`${prin.length} botones principales: ${prin.map(nombre).join(' | ')}`);
  // Desborde horizontal
  if (document.documentElement.scrollWidth > window.innerWidth + 1) prob.push(`la página se desborda: ${document.documentElement.scrollWidth}px`);
  for (const e of document.querySelectorAll('.vista *')) {
    if (!visible(e) || e.closest('.filtros, .segmento, .arranque')) continue;
    const r = e.getBoundingClientRect();
    if (r.right > window.innerWidth + 1 && getComputedStyle(e).position !== 'fixed') { prob.push(`se sale a la derecha (${Math.round(r.right)}px): ${nombre(e)}`); break; }
  }
  // Imágenes rotas
  for (const im of document.querySelectorAll('img')) if (im.complete && !im.naturalWidth && visible(im)) prob.push(`imagen rota: ${im.getAttribute('src')}`);
  return prob;
}

let total = 0;
for (const tema of ['claro', 'oscuro']) {
  await page.goto(base + '#/login');
  await page.evaluate((t) => { localStorage.clear(); if (t === 'oscuro') localStorage.setItem('coveca.tema', 'oscuro'); }, tema);
  await page.reload(); await page.waitForTimeout(400);
  console.log(`\n=== Tema ${tema} ===`);
  const login = await page.evaluate(revisar);
  if (login.length) { console.log('#/login'); login.forEach((p) => console.log('  - ' + p)); total += login.length; }
  await page.click('#demo'); await page.waitForTimeout(300);
  for (const [ruta, accion] of PANTALLAS) {
    await page.goto('about:blank'); await page.goto(base + ruta); await page.waitForTimeout(700);
    if (accion) { await accion(page); await page.waitForTimeout(500); }
    const prob = await page.evaluate(revisar);
    if (prob.length) { console.log(ruta); prob.forEach((p) => console.log('  - ' + p)); total += prob.length; }
  }
}
await browser.close(); server.close();
console.log(`\n${total} observación(es)`);
