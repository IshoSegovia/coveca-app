// Catálogo (#/catalogo, decisión del 29-10-2026): los productos activos con precio, en hojas de 3, para
// mostrarlos al cliente (pensado para la tablet del vendedor en horizontal; en vertical y en el celular los 3 van
// uno debajo del otro). Portada, índice de categorías, portada por categoría con un "¿Sabía que…?", productos con su
// dato curioso (js/catalogo-datos.js) y hoja final con el teléfono de la nota. Nunca muestra costos.
// Funciona sin señal: lee los productos con conCopia y las fotos guardadas en el celular (fotos-guardadas.js).
// Se mueve deslizando, con las flechas o el teclado; "Buscar" salta al producto. Ocupa toda la pantalla (sin menú).
import { $, esc, barra, icono, clp, normal, imgFoto, plural, leerAjuste, guardarAjuste, vacio, aviso } from '../ui.js';
import * as datos from '../datos.js';
import { edadCopia } from '../local.js';
import { CATEGORIA } from '../catalogo-datos.js';
import { productosCatalogo, armarCategorias, CLAUSULA, C_PIX, PIX, unidades } from '../catalogo-base.js';
import { generarCatalogoPdf } from '../catalogo-pdf.js';
import { enviarPdfWhatsApp, guardarArchivo } from '../pdf.js';

let FECHA = '';   // fecha de los precios: hoy, o la de la copia del celular si no hay señal
const reducir = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const fechaTxt = (d = new Date()) => d.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

function dibujarPix(cv, cat, animar) {
  const g = PIX[cat] || PIX.Bazar, px = 4, est = getComputedStyle(document.documentElement);
  const color = { 1: est.getPropertyValue('--relleno').trim(), 2: est.getPropertyValue('--rojo').trim(), 3: est.getPropertyValue('--oro').trim() };
  cv.width = 8 * px; cv.height = 8 * px;
  const x = cv.getContext('2d'), celdas = [];
  g.forEach((fila, r) => [...fila].forEach((v, c) => { if (v !== '0') celdas.push([r, c, v]); }));
  const pinta = ([r, c, v]) => { x.fillStyle = color[v]; x.fillRect(c * px, r * px, px, px); };
  if (!animar || reducir()) { celdas.forEach(pinta); return; }
  celdas.sort(() => Math.random() - 0.5);
  let i = 0;
  const paso = () => { if (!cv.isConnected) return; for (let k = 0; k < 2 && i < celdas.length; k++) pinta(celdas[i++]); if (i < celdas.length) requestAnimationFrame(paso); };
  setTimeout(paso, 250);
}

// Fondo de la portada: cuadros 8 bits que se encienden y apagan sobre el azul.
function fondoPixel(cv) {
  const ctx = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr;
  const tam = 28 * dpr, cols = Math.ceil(cv.width / tam), filas = Math.ceil(cv.height / tam);
  const celdas = Array.from({ length: cols * filas }, () => ({ v: Math.random() < 0.5 ? 0 : Math.random() * 0.1, f: Math.random() * 6.28 }));
  const t0 = performance.now();
  const dibuja = (t) => {
    if (!cv.isConnected) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const s = (t - t0) / 1000;
    celdas.forEach((c, i) => {
      if (!c.v) return;
      ctx.globalAlpha = c.v * (0.5 + 0.5 * Math.sin(s * 0.9 + c.f));
      ctx.fillStyle = '#fff';   // canvas: el blanco del fondo de marca (--sobre-relleno, igual en ambos temas)
      ctx.fillRect((i % cols) * tam + 2, Math.floor(i / cols) * tam + 2, tam - 4, tam - 4);
    });
    if (!reducir() && !document.hidden) requestAnimationFrame(dibuja);
    else if (!reducir()) setTimeout(() => requestAnimationFrame(dibuja), 1000);
  };
  dibuja(t0);
}


function armarHojas(productos) {
  const cats = armarCategorias(productos);
  const hojas = [{ tipo: 'portada' }, { tipo: 'indice' }];
  cats.forEach((c, ci) => {
    c.desde = hojas.length;
    hojas.push({ tipo: 'separa', ci });
    const total = Math.ceil(c.lista.length / 3);
    for (let i = 0; i < c.lista.length; i += 3) hojas.push({ tipo: 'trio', ci, items: c.lista.slice(i, i + 3), pag: i / 3 + 1, total });
  });
  hojas.push({ tipo: 'cierre' });
  return { cats, hojas };
}

function prodHtml(p, i) {
  const u = unidades(p.nombre), hay = p.stock > 0;
  const porU = u > 1 && p.precio / u >= 10 ? `<span class="cat-pu">por unidad<strong>≈ ${clp(p.precio / u)}</strong></span>` : '';
  return `<article class="cat-prod" style="--i:${i}">
    <button type="button" class="cat-foto" data-ver="${p.id}" aria-label="Ver ${esc(p.nombre)} en grande" ${p.imagen_url ? '' : 'disabled'}>
      ${p.imagen_url ? imgFoto(p.imagen_url, 'cat-img') : `<span class="cat-sinfoto">${icono('caja')}<span>Foto pronto</span></span>`}
      <span class="cat-estado ${hay ? 'si' : 'no'}">${hay ? `${icono('check', 'ico-s')} Disponible` : 'Consultar stock'}</span>
    </button>
    <div class="cat-cuerpo">
      <p class="cat-marca">${esc(p.marca || p.categoria || '')}</p>
      <h3 class="cat-nombre">${esc(p.nombre)}</h3>
      <div class="cat-chips">${u > 1 ? `<span class="chip">${u} unidades</span>` : ''}</div>
      <div class="cat-precio"><b data-precio="${p.precio}">${clp(p.precio)}</b>${porU}</div>
      <div class="cat-dato">${p.dato ? `<i>DATO</i><span>${esc(p.dato)}</span>` : ''}</div>
    </div></article>`;
}

function construir(h, cats, total, negocio) {
  const el = document.createElement('section');
  el.className = 'cat-hoja';
  if (h.tipo === 'portada') {
    el.classList.add('cat-portada');
    const marcas = new Set(cats.flatMap((c) => c.lista.map((p) => p.marca)).filter(Boolean)).size;
    let d = 0;
    el.innerHTML = `<canvas aria-hidden="true"></canvas><div class="cat-port-in">
      <div class="cat-iso" aria-hidden="true"><div class="cat-c">${C_PIX.map((f) => [...f].map((v) => `<span class="${v === '1' ? '' : 'o'}" style="--d:${v === '1' ? d++ : 0}"></span>`).join('')).join('')}</div></div>
      <div class="cat-port-txt">
        <img class="cat-palabra" src="marca/coveca-palabra-blanco.svg" alt="COVECA">
        <span class="cat-eti">Catálogo mayorista · ${FECHA}</span>
        <h2>Su comercializadora de confianza</h2>
        <p>Golosinas, bebidas y artículos de aseo en cajas y displays, con reparto por ruta en la Región del Maule.</p>
        <div class="cat-cifras"><div><b data-cuenta="${total}">${total}</b><span>productos</span></div><div><b data-cuenta="${cats.length}">${cats.length}</b><span>categorías</span></div><div><b data-cuenta="${marcas}">${marcas}</b><span>marcas</span></div></div>
        <div class="cat-port-btns"><button type="button" class="btn cat-empezar" data-ir="1">Ver el catálogo ${icono('derecha')}</button>
        <button type="button" class="btn sec cat-compartir" data-compartir>${icono('compartir')} Compartir en PDF</button></div>
      </div></div><div class="cat-franja"></div>`;
  } else if (h.tipo === 'indice') {
    el.classList.add('cat-indice');
    el.innerHTML = `<div class="cat-ind-t"><h2>¿Qué busca hoy?</h2><button type="button" class="btn sec cat-compartir" data-compartir>${icono('compartir')} Compartir en PDF</button></div>
      <div class="cat-cats">${cats.map((c, i) => `<button type="button" class="cat-cat" style="--i:${i}" data-ir="${c.desde}"><canvas data-cat="${esc(c.tipo)}" aria-hidden="true"></canvas><span><b>${esc(c.nombre)}</b><small>${plural(c.lista.length, 'producto')}</small></span></button>`).join('')}</div>`;
  } else if (h.tipo === 'separa') {
    const c = cats[h.ci], dato = CATEGORIA[c.tipo];
    const marcas = [...new Set(c.lista.map((p) => p.marca).filter(Boolean))];
    el.classList.add('cat-separa');
    el.innerHTML = `<div class="cat-sep-txt">
      <p class="cat-sep-eti">Categoría ${h.ci + 1} de ${cats.length}</p>
      <h2>${(() => { let i = 0; return c.nombre.split(' ').map((pal) => `<span class="cat-sep-pal">${[...pal].map((l) => `<span style="--i:${i++}">${esc(l)}</span>`).join('')}</span>`).join(' '); })()}</h2>
      <p class="cat-sep-sub">${plural(c.lista.length, 'producto')}${marcas.length ? ` · ${plural(marcas.length, 'marca')}` : ''}</p>
      ${marcas.length ? `<div class="cat-sep-marcas">${marcas.slice(0, 10).map((m) => `<span class="chip">${esc(m)}</span>`).join('')}</div>` : ''}
      ${dato ? `<div class="cat-curioso"><i>¿SABÍA QUE…?</i><span>${esc(dato)}</span></div>` : ''}
      </div><canvas data-cat="${esc(c.tipo)}" data-animar="1" aria-hidden="true"></canvas>`;
  } else if (h.tipo === 'trio') {
    el.innerHTML = `<div class="cat-trio">${h.items.map(prodHtml).join('')}${h.items.length < 3 ? `<div class="cat-prod cat-vacio" style="--i:${h.items.length}">¿Busca algo que no está aquí?<br>Pregúntenos: lo conseguimos.</div>` : ''}</div>`;
  } else {
    el.classList.add('cat-cierre');
    const tel = negocio?.telefono || '';
    el.innerHTML = `<img class="cat-logo-cierre" src="marca/coveca-negativo.svg" alt="COVECA">
      <h2>Haga su pedido hoy y lo recibe en su ruta</h2>
      <p>Pedidos por WhatsApp o con su vendedor en la visita. Pagos en efectivo, transferencia o crédito para clientes frecuentes.</p>
      ${tel ? `<p class="cat-tel">${esc(tel)}</p>` : ''}
      <p class="cat-letra">Precios por caja o display en pesos chilenos al ${FECHA}. ${CLAUSULA} Disponibilidad sujeta a stock. Las fotos son referenciales.</p>`;
  }
  return el;
}

function contar(el) {
  if (reducir()) return;
  el.querySelectorAll('[data-cuenta],[data-precio]').forEach((b) => {
    const fin = +(b.dataset.cuenta || b.dataset.precio), moneda = !!b.dataset.precio;
    const t0 = performance.now() + (moneda ? 260 : 1500), dur = moneda ? 650 : 900;
    const f = (t) => {
      if (!b.isConnected) return;
      const k = Math.min(1, Math.max(0, (t - t0) / dur)), v = fin * (1 - (1 - k) ** 3);
      b.textContent = moneda ? clp(k < 1 ? Math.round(v / 10) * 10 : fin) : Math.round(v);
      if (k < 1) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
}

// Al entrar se recuerda de qué pantalla venía, para volver ahí con "Salir" o el botón atrás.
window.addEventListener('hashchange', (e) => {
  try {
    const de = new URL(e.oldURL).hash, a = new URL(e.newURL).hash;
    if (a.startsWith('#/catalogo') && !de.startsWith('#/catalogo')) sessionStorage.setItem('coveca-catalogo-volver', de || '#/rutas');
  } catch (_) { /* sin almacenamiento: vuelve a Rutas */ }
});

export async function vistaCatalogo(v) {
  barra({ titulo: 'Catálogo' });
  v.innerHTML = '<div class="cargando pad">Cargando catálogo…</div>';
  const [todos, negocio] = await Promise.all([datos.productos(), datos.configuracion().catch(() => null)]);
  const productos = productosCatalogo(todos);
  if (!v.isConnected) return;
  // Sin señal los precios vienen de la copia del celular: se muestra la fecha de esa copia, no la de hoy
  const edad = edadCopia();
  FECHA = todos.deCopia && Number.isFinite(edad) ? fechaTxt(new Date(Date.now() - edad * 60000)) : fechaTxt();
  if (!productos.length) {
    v.innerHTML = `<div class="pad">${vacio('El catálogo está vacío', 'Cuando haya productos activos con precio, aparecerán aquí.')}</div>`;
    return;
  }
  window.covecaCatalogoLimpiar?.();   // si se vuelve a dibujar, se quita la capa anterior con sus escuchas
  const { cats, hojas } = armarHojas(productos);

  // Va directo en <body> (no dentro de la vista, que puede tener transformaciones): así cubre toda la pantalla, también el menú.
  document.querySelectorAll('body > .catalogo').forEach((x) => x.remove());
  v.innerHTML = '';
  const caja = document.createElement('div');
  caja.innerHTML = `<div class="catalogo" id="catalogo" role="region" aria-label="Catálogo de productos">
    <header class="cat-barra">
      <img class="cat-logo logo-claro" src="marca/coveca-color.svg" alt="COVECA"><img class="cat-logo logo-oscuro" src="marca/coveca-negativo.svg" alt="COVECA">
      <div class="cat-donde"><b id="cat-t">Catálogo</b><span id="cat-s"></span></div>
      <button type="button" class="cat-btn" id="cat-indice" aria-label="Ver categorías">${icono('cuadricula')}<span>Categorías</span></button>
      <button type="button" class="cat-btn" id="cat-buscar" aria-label="Buscar producto">${icono('buscar')}<span>Buscar</span></button>
      <button type="button" class="cat-btn solo" id="cat-pantalla" aria-label="Pantalla completa" hidden>${icono('expandir')}</button>
      <button type="button" class="cat-btn solo" id="cat-salir" aria-label="Salir del catálogo">${icono('cerrar')}</button>
    </header>
    <main class="cat-escenario" id="cat-escenario" aria-live="polite"></main>
    <footer class="cat-pie">
      <div class="cat-avance"><div id="cat-avance"></div></div>
      <div class="cat-pie-fila">
        <button type="button" class="cat-flecha" id="cat-ant" aria-label="Hoja anterior">${icono('atras')}</button>
        <nav class="cat-tabs" id="cat-tabs" aria-label="Categorías">${cats.map((c, i) => `<button type="button" class="cat-tab" data-ci="${i}" data-ir="${c.desde}">${esc(c.nombre)}</button>`).join('')}</nav>
        <span class="cat-cont" id="cat-cont"></span>
        <button type="button" class="cat-flecha" id="cat-sig" aria-label="Hoja siguiente">${icono('derecha')}</button>
      </div>
    </footer>
  </div>`;
  const raiz = caja.firstElementChild;
  document.body.appendChild(raiz);
  const esc_ = $('#cat-escenario', raiz);
  document.body.classList.add('con-catalogo');
  let actual = -1, hojaEl = null;

  function ir(n, { atras: haciaAtras } = {}) {
    n = Math.max(0, Math.min(hojas.length - 1, n));
    if (n === actual) return;
    const atras = haciaAtras ?? n < actual;
    const h = hojas[n], nueva = construir(h, cats, productos.length, negocio);
    if (hojaEl) { const vieja = hojaEl; vieja.classList.add('sale'); vieja.classList.toggle('atras', atras); setTimeout(() => vieja.remove(), reducir() ? 0 : 330); }
    nueva.classList.add('entra'); nueva.classList.toggle('atras', atras);
    esc_.appendChild(nueva);
    hojaEl = nueva; actual = n;
    nueva.querySelectorAll('canvas[data-cat]').forEach((cv) => dibujarPix(cv, cv.dataset.cat, cv.dataset.animar));
    if (h.tipo === 'portada') fondoPixel(nueva.querySelector('canvas'));
    contar(nueva);
    const cat = h.ci != null ? cats[h.ci] : null;
    $('#cat-t', raiz).textContent = { portada: 'Catálogo COVECA', indice: 'Categorías', cierre: 'Haga su pedido' }[h.tipo] || cat.nombre;
    $('#cat-s', raiz).textContent = h.tipo === 'trio' ? `Página ${h.pag} de ${h.total} · ${plural(cat.lista.length, 'producto')}`
      : h.tipo === 'separa' ? plural(cat.lista.length, 'producto') : `${plural(productos.length, 'producto')} · precios al ${FECHA}`;
    $('#cat-cont', raiz).textContent = `${n + 1} / ${hojas.length}`;
    $('#cat-avance', raiz).style.width = `${(n / (hojas.length - 1)) * 100}%`;
    $('#cat-ant', raiz).disabled = n === 0; $('#cat-sig', raiz).disabled = n === hojas.length - 1;
    raiz.querySelectorAll('.cat-tab').forEach((t) => {
      const on = !!cat && +t.dataset.ci === h.ci;
      t.setAttribute('aria-current', on ? 'true' : 'false');
      if (on) t.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reducir() ? 'auto' : 'smooth' });
    });
    guardarAjuste('catalogo-hoja', n);
  }

  // Foto en grande
  function verFoto(id) {
    const p = productos.find((x) => x.id === id); if (!p?.imagen_url) return;
    const c = document.createElement('div');
    c.className = 'cat-visor'; c.setAttribute('role', 'dialog'); c.setAttribute('aria-modal', 'true'); c.setAttribute('aria-label', p.nombre);
    c.innerHTML = `${imgFoto(p.imagen_url, 'cat-visor-img')}<div class="cat-visor-info"><div><p class="cat-marca">${esc(p.marca || p.categoria)}</p><b>${esc(p.nombre)}</b></div><em>${clp(p.precio)}</em><button type="button" class="btn sec" id="cat-cerrar-foto">Cerrar</button></div>`;
    c.addEventListener('click', (e) => { if (e.target.closest('#cat-cerrar-foto') || e.target.classList.contains('cat-visor-img')) cerrarCapa(); });
    raiz.appendChild(c);
    $('#cat-cerrar-foto', c).focus();
  }
  // Buscar
  function abrirBuscar() {
    const c = document.createElement('div');
    c.className = 'cat-capa';
    c.innerHTML = `<div class="cat-caja" role="dialog" aria-modal="true" aria-label="Buscar producto"><div class="cat-campo">${icono('buscar')}
      <input id="cat-q" type="search" placeholder="Producto, marca o categoría" autocomplete="off" aria-label="Buscar producto">
      <button type="button" class="btn sec" id="cat-cerrar-buscar">Cerrar</button></div><div class="cat-res" id="cat-res"></div></div>`;
    raiz.appendChild(c);
    const q = $('#cat-q', c), res = $('#cat-res', c);
    const pinta = () => {
      const t = normal(q.value).split(/\s+/).filter(Boolean);
      const lista = t.length ? productos.filter((p) => { const s = normal(`${p.nombre} ${p.marca || ''} ${p.categoria}`); return t.every((w) => s.includes(w)); }).slice(0, 40) : [];
      res.innerHTML = !t.length ? `<p class="cat-nada">Escriba para buscar entre ${plural(productos.length, 'producto')}.</p>`
        : !lista.length ? `<p class="cat-nada">No encontramos “${esc(q.value)}”. Pruebe con la marca o una palabra más corta.</p>`
          : lista.map((p) => `<button type="button" class="cat-r" data-pid="${p.id}"><span class="cat-mini">${p.imagen_url ? imgFoto(p.imagen_url, 'cat-mini-img') : ''}</span><span class="cat-r-txt"><b>${esc(p.nombre)}</b><small>${esc([p.marca, p.categoria].filter(Boolean).join(' · '))}</small></span><em>${clp(p.precio)}</em></button>`).join('');
    };
    q.addEventListener('input', pinta);
    c.addEventListener('click', (e) => {
      if (e.target === c || e.target.closest('#cat-cerrar-buscar')) { cerrarCapa(); return; }
      const b = e.target.closest('[data-pid]'); if (!b) return;
      const id = +b.dataset.pid, n = hojas.findIndex((h) => h.tipo === 'trio' && h.items.some((p) => p.id === id));
      cerrarCapa(); ir(n);
      const prod = hojaEl.querySelector(`[data-ver="${id}"]`)?.closest('.cat-prod');
      prod?.classList.add('cat-resalta');
    });
    pinta(); q.focus();
  }
  // Compartir en PDF (ticket N° 18): primero se prepara con avance y después se elige enviar o guardar. Son dos pasos porque
  // el iPhone rechaza abrir el menú Compartir si pasó mucho rato desde el toque.
  async function abrirCompartir() {
    if (capa()) return;
    const c = document.createElement('div');
    c.className = 'cat-capa';
    c.innerHTML = `<div class="cat-caja cat-pdf" role="dialog" aria-modal="true" aria-label="Compartir catálogo">
      <h2>Compartir catálogo</h2>
      <p id="cat-pdf-estado" role="status">Preparando el PDF…</p>
      <div class="cat-avance cat-pdf-barra"><div id="cat-pdf-avance"></div></div>
      <div id="cat-pdf-acciones" class="cat-pdf-acciones"><button type="button" class="btn sec" id="cat-pdf-cerrar">Cancelar</button></div></div>`;
    raiz.appendChild(c);
    $('#cat-pdf-cerrar', c).focus();
    c.addEventListener('click', (e) => { if (e.target.closest('#cat-pdf-cerrar')) cerrarCapa(); });
    const estado = $('#cat-pdf-estado', c);
    let pdf;
    try {
      pdf = await generarCatalogoPdf({ cats, fecha: FECHA, telefono: negocio?.telefono, ejemplo: datos.enDemo(), parar: () => !c.isConnected,
        alAvance: (n, t) => { estado.textContent = `Preparando ${n} de ${t} productos…`; $('#cat-pdf-avance', c).style.width = `${(n / t) * 100}%`; } });
    } catch (e) {
      console.error(e);
      estado.textContent = 'No se pudo preparar el PDF. Cierra otras apps e intenta de nuevo.';
      $('#cat-pdf-cerrar', c).textContent = 'Cerrar';
      return;
    }
    if (!pdf || !c.isConnected) return;
    const peso = pdf.bytes < 1048576 ? `${Math.ceil(pdf.bytes / 1024)} KB` : `${(pdf.bytes / 1048576).toLocaleString('es-CL', { maximumFractionDigits: 1 })} MB`;
    estado.textContent = `Listo: ${plural(pdf.total, 'producto')} · ${plural(pdf.paginas, 'hoja')} · ${peso}. Precios al ${FECHA}.${pdf.sinFoto ? ` ${pdf.sinFoto === 1 ? '1 producto va' : `${pdf.sinFoto} productos van`} sin foto. Si te faltan fotos, abre la app con señal unos minutos y prepáralo de nuevo.` : ''}`;
    $('#cat-pdf-avance', c).style.width = '100%';
    $('#cat-pdf-acciones', c).innerHTML = `<button type="button" class="btn prin" id="cat-pdf-wa">${icono('whatsapp')} Enviar por WhatsApp</button>
      <button type="button" class="btn sec" id="cat-pdf-guardar">Guardar en PDF</button>
      <button type="button" class="btn sec" id="cat-pdf-cerrar">Cerrar</button>`;
    $('#cat-pdf-wa', c).focus();
    // Una acción a la vez: un doble toque en iPhone falla y en Android dejaría dos archivos
    const unaVez = (boton, accion) => {
      boton.onclick = async () => {
        const botones = [$('#cat-pdf-wa', c), $('#cat-pdf-guardar', c)];
        botones.forEach((x) => { x.disabled = true; });
        try { await accion(); } catch (e) { console.error(e); aviso(e.rechazado ? e.message : 'No se pudo compartir el PDF. Intenta de nuevo.', 'error'); }
        botones.forEach((x) => { x.disabled = false; });
      };
    };
    unaVez($('#cat-pdf-wa', c), () => enviarPdfWhatsApp(pdf.base64, 'COVECA-Catalogo.pdf', { texto: `Le comparto el catálogo de COVECA, con precios al ${FECHA}. ${CLAUSULA} Para pedir, responda este mensaje.` }));
    unaVez($('#cat-pdf-guardar', c), async () => {
      const donde = await guardarArchivo(pdf.base64, `COVECA-Catalogo-${FECHA}.pdf`, 'application/pdf');
      if (donde) aviso(/Compartir/.test(donde) ? 'Listo' : donde === 'Descargas' ? 'Descarga iniciada' : `Guardado en ${donde}`);
    });
  }
  const capa = () => raiz.querySelector('.cat-visor, .cat-capa');
  function cerrarCapa() { capa()?.remove(); }
  function salir() {
    if (capa()) { cerrarCapa(); return; }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    location.hash = sessionStorage.getItem('coveca-catalogo-volver') || '#/rutas';
  }
  // El cliente suele tener el equipo en la mano: antes de salir a la app se pregunta (en el PC sale directo).
  function pedirSalir() {
    if (capa()) { cerrarCapa(); return; }
    if (document.body.classList.contains('escritorio')) { salir(); return; }
    const c = document.createElement('div');
    c.className = 'cat-capa';
    c.innerHTML = `<div class="cat-caja cat-pdf" role="dialog" aria-modal="true" aria-label="Salir del catálogo">
      <h2>¿Salir del catálogo?</h2>
      <div class="cat-pdf-acciones"><button type="button" class="btn prin" id="cat-seguir">Seguir viendo el catálogo</button>
      <button type="button" class="btn sec" id="cat-salir-si">Salir</button></div></div>`;
    raiz.appendChild(c);
    $('#cat-seguir', c).focus();
    $('#cat-seguir', c).onclick = cerrarCapa;
    $('#cat-salir-si', c).onclick = () => { cerrarCapa(); salir(); };
  }
  // Botón atrás de Android: cierra lo que esté abierto, vuelve a la portada y, ya en la portada, pregunta antes de salir.
  function atrasCatalogo() {
    if (capa()) cerrarCapa();
    else if (actual > 0) ir(0, { atras: true });
    else pedirSalir();
  }

  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ir]'); if (b) { ir(+b.dataset.ir); return; }
    if (e.target.closest('[data-compartir]')) { abrirCompartir(); return; }
    const f = e.target.closest('[data-ver]'); if (f && !f.disabled) verFoto(+f.dataset.ver);
  });
  $('#cat-ant', raiz).onclick = () => ir(actual - 1);
  $('#cat-sig', raiz).onclick = () => ir(actual + 1);
  $('#cat-indice', raiz).onclick = () => ir(1);
  $('#cat-buscar', raiz).onclick = abrirBuscar;
  $('#cat-salir', raiz).onclick = pedirSalir;
  // Pantalla completa: solo donde el navegador la permite (en la app ya ocupa toda la pantalla)
  const pc = $('#cat-pantalla', raiz);
  pc.hidden = !document.fullscreenEnabled;
  pc.onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});

  // Deslizar con el dedo
  let x0 = null, y0 = 0, t0 = 0;
  esc_.addEventListener('touchstart', (e) => { if (e.touches.length !== 1) { x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); }, { passive: true });
  esc_.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3 && Date.now() - t0 < 800) ir(actual + (dx < 0 ? 1 : -1));
    x0 = null;
  });
  const tecla = (e) => {
    if (!raiz.isConnected) return;
    if (e.key === 'Escape') { e.preventDefault(); salir(); return; }
    if (capa() || e.target.matches?.('input')) return;
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); ir(actual + 1); }
    if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); ir(actual - 1); }
    if (e.key === 'Home') ir(0);
    if (e.key === '/') { e.preventDefault(); abrirBuscar(); }
  };
  document.addEventListener('keydown', tecla);
  // Botón atrás de Android (atras.js)
  window.covecaCatalogoSalir = atrasCatalogo;
  const limpiar = (forzar) => {
    if (forzar !== true && location.hash.split('?')[0] === '#/catalogo') return;
    raiz.remove();
    document.removeEventListener('keydown', tecla);
    window.removeEventListener('hashchange', alCambiar);
    if (window.covecaCatalogoSalir === atrasCatalogo) window.covecaCatalogoSalir = null;
    if (window.covecaCatalogoLimpiar === quitar) window.covecaCatalogoLimpiar = null;
    document.body.classList.remove('con-catalogo');
  };
  const quitar = () => limpiar(true);
  window.covecaCatalogoLimpiar = quitar;
  const alCambiar = () => setTimeout(limpiar, 0);
  window.addEventListener('hashchange', alCambiar);

  // Si se vuelve en la misma sesión, sigue en la hoja donde quedó; si no, portada.
  let inicio = 0;
  try { if (sessionStorage.getItem('coveca-catalogo-sesion')) inicio = Number(leerAjuste('catalogo-hoja', 0)) || 0; sessionStorage.setItem('coveca-catalogo-sesion', '1'); } catch (_) { /* sin almacenamiento: portada */ }
  ir(Math.min(inicio, hojas.length - 1));
}
