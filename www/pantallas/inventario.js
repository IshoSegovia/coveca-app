import { datos } from '../datos.js';
import { pantalla, ruta, esc, ICONOS, ir, aviso, leerFormulario, clp, miles, margen, precioConMargen, pct, leer, guardar } from '../nucleo.js';
import { cargando, vacio, buscador, campo, selector } from './comunes.js';

const FILTROS = [
  ['todos', 'Todos', () => true],
  ['disponible', 'Disponible', (p) => p.stock > 0],
  ['bajo', 'Stock bajo', (p) => p.stock > 0 && p.stock_minimo != null && p.stock <= p.stock_minimo],
  ['sin', 'Sin stock', (p) => p.stock === 0],
  ['negativo', 'Negativo', (p) => p.stock < 0],
];
let filtro = 'todos';
let texto = '';
const MARGEN_OBJETIVO = 0.20;

function etiquetaStock(p) {
  if (p.stock < 0) return `<span class="stock stock-negativo" title="Se vendió más de lo registrado">${miles(p.stock)} u.</span>`;
  if (p.stock === 0) return '<span class="stock stock-sin">Sin stock</span>';
  if (p.stock_minimo != null && p.stock <= p.stock_minimo) return `<span class="stock stock-bajo">${miles(p.stock)} u. · bajo</span>`;
  return `<span class="stock stock-ok">${miles(p.stock)} u.</span>`;
}

ruta('/inventario', async () => {
  pantalla({ titulo: 'Inventario', tab: 'inventario', cuerpo: cargando });
  let todos = await datos.listarProductos();
  const pintar = async () => {
    const lista = (texto ? await datos.listarProductos(texto) : todos).filter(FILTROS.find((f) => f[0] === filtro)[2]);
    document.getElementById('lista-productos').innerHTML = lista.map((p) => `
      <a class="fila" href="#/productos/${p.id}">
        <span class="fila-texto"><strong>${esc(p.nombre)}</strong>
          <small>${esc([p.categoria, p.ref ? 'REF ' + p.ref : null, clp(p.precio)].filter(Boolean).join(' · '))}</small></span>
        ${etiquetaStock(p)}
      </a>`).join('') || vacio('No hay productos con este filtro.');
    document.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.f === filtro));
  };
  pantalla({
    titulo: 'Inventario', subtitulo: `${todos.length} productos`, tab: 'inventario',
    accion: datos.esAdmin() ? { icono: 'mas_simple', etiqueta: 'Nuevo producto', href: '/productos/nuevo' } : null,
    cuerpo: `<div class="barra-busqueda">${buscador('q-productos', 'Buscar producto o REF', texto)}
        <div class="chips" role="group" aria-label="Filtrar por stock">
          ${FILTROS.map(([id, t, fn]) => `<button class="chip" data-f="${id}" aria-pressed="${id === filtro}">${t} <b>${todos.filter(fn).length}</b></button>`).join('')}
        </div></div>
      <div class="lista" id="lista-productos">${cargando}</div>`,
  });
  document.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.f; pintar(); }));
  let t;
  document.getElementById('q-productos').addEventListener('input', (e) => { texto = e.target.value; clearTimeout(t); t = setTimeout(pintar, 200); });
  pintar();
});

ruta('/productos/nuevo', () => formularioProducto(null));
ruta('/productos/:id', async ({ id }) => formularioProducto(await datos.obtenerProducto(id)));

async function formularioProducto(p) {
  const nuevo = !p;
  const admin = datos.esAdmin();
  const cats = await datos.listarCategorias();
  const solo = admin ? '' : 'disabled';
  pantalla({
    titulo: nuevo ? 'Nuevo producto' : p.nombre, subtitulo: nuevo ? '' : (p.ref ? `REF ${p.ref}` : ''), atras: '/inventario',
    cuerpo: `
      ${!nuevo ? `<div class="stock-actual">
        <div><span>Stock actual</span><strong class="num">${miles(p.stock)} u.</strong></div>
        ${p.stock < 0 ? '<p class="alerta">Stock negativo: se vendió más de lo registrado. Corrígelo con un ajuste después de contar en bodega.</p>' : ''}
        ${admin ? `<form id="f-ajuste" class="ajuste" novalidate>
          <label class="campo"><span>Ajustar stock (+ entra / − sale)</span>
          <div class="fila-ajuste"><input name="cantidad" type="number" inputmode="numeric" placeholder="Ej.: 12 o -3">
          <button class="boton boton-secundario">Aplicar</button></div></label></form>` : ''}
      </div>` : ''}
      <form id="f-producto" class="formulario" novalidate>
        <fieldset ${solo}>
        ${campo({ etiqueta: 'Nombre', nombre: 'nombre', valor: p?.nombre, req: true, ayuda: 'Incluye el formato: x12, x24, 500gr…' })}
        ${selector({ etiqueta: 'Categoría', nombre: 'categoria_id', valor: p?.categoria_id, opciones: [[null, 'Sin categoría'], ...cats.map((c) => [c.id, c.nombre])] })}
        <h2 class="seccion">Precio</h2>
        <div class="dos-columnas">
          ${campo({ etiqueta: 'Costo ($)', nombre: 'costo', valor: p?.costo ?? '', tipo: 'number', modo: 'numeric', req: true })}
          ${campo({ etiqueta: 'Precio de venta ($)', nombre: 'precio', valor: p?.precio ?? '', tipo: 'number', modo: 'numeric', req: true })}
        </div>
        <div class="calculo-margen" id="calculo-margen" aria-live="polite"></div>
        <h2 class="seccion">Otros datos</h2>
        <div class="dos-columnas">
          ${campo({ etiqueta: 'REF', nombre: 'ref', valor: p?.ref })}
          ${campo({ etiqueta: 'Alerta de stock bajo', nombre: 'stock_minimo', valor: p?.stock_minimo ?? '', tipo: 'number', modo: 'numeric', ayuda: 'Avisa al llegar a esta cantidad.' })}
        </div>
        ${campo({ etiqueta: 'Código de barras', nombre: 'codigo_barras', valor: p?.codigo_barras, modo: 'numeric' })}
        ${nuevo ? campo({ etiqueta: 'Stock inicial', nombre: 'stock', valor: '', tipo: 'number', modo: 'numeric', ayuda: 'Unidades que hay hoy en bodega.' }) : ''}
        </fieldset>
        <p class="error-form" hidden></p>
      </form>`,
    pie: admin ? `<button class="boton boton-principal" form="f-producto">${nuevo ? 'Crear producto' : 'Guardar cambios'}</button>` : '',
  });

  // Cálculo de margen en vivo (regla COVECA: margen sobre precio de venta)
  const form = document.getElementById('f-producto');
  const calc = () => {
    const costo = Number(form.costo.value) || 0, precio = Number(form.precio.value) || 0;
    const m = margen(costo, precio);
    const sugerido = precioConMargen(costo, MARGEN_OBJETIVO);
    document.getElementById('calculo-margen').innerHTML = costo || precio ? `
      <div class="monto-fila"><span>Ganancia por unidad</span><span class="num">${clp(precio - costo)}</span></div>
      <div class="monto-fila"><span>Margen</span><span class="num ${m != null && m < MARGEN_OBJETIVO ? 'texto-ambar' : ''}">${pct(m)}${m != null && m < MARGEN_OBJETIVO ? ' · bajo 20 %' : ''}</span></div>
      ${costo && sugerido !== precio ? `<div class="sugerencia"><span>Precio al 20 %: <b class="num">${clp(sugerido)}</b></span>
        ${admin ? `<button type="button" class="boton-texto" id="usar-sugerido">Usar</button>` : ''}</div>` : ''}` : '';
    document.getElementById('usar-sugerido')?.addEventListener('click', () => { form.precio.value = sugerido; calc(); });
  };
  form.costo.addEventListener('input', calc); form.precio.addEventListener('input', calc); calc();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = leerFormulario(form);
    try {
      const inicial = f.stock; delete f.stock;
      const g = await datos.guardarProducto({ ...(p ? { id: p.id } : {}), ...f, costo: f.costo || 0 });
      if (nuevo && inicial) await datos.ajustarStock(g.id, inicial);
      aviso(nuevo ? 'Producto creado' : 'Cambios guardados');
      ir('/inventario');
    } catch (err) {
      const el = form.querySelector('.error-form'); el.textContent = err.message; el.hidden = false;
    }
  });
  document.getElementById('f-ajuste')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cant = Number(e.target.cantidad.value);
    if (!cant) return;
    await datos.ajustarStock(p.id, cant);
    aviso(`Stock ajustado ${cant > 0 ? '+' : ''}${cant}`);
    formularioProducto(await datos.obtenerProducto(p.id));
  });
}
