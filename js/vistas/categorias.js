// Categorías de productos: crear, cambiar el nombre y borrar (solo administradores, con señal).
// Reglas del servidor en las migraciones 0060 y 0061; las de la app, en categorias-reglas.js.
// Las categorías son por tipo de producto; la empresa va en Marca. "Pruebas" no se muestra: la usa el catálogo para
// esconder los productos de prueba y no se cambia ni se borra.
import { $, esc, barra, icono, vacio, aviso, plural } from '../ui.js';
import * as datos from '../datos.js';
import { esPruebas, limpiarNombre, letrasRef, revisarNombre } from '../categorias-reglas.js';

export async function vistaCategorias(v) {
  barra({ titulo: 'Categorías', atras: '#/inventario' });
  if (!datos.esAdmin()) { v.innerHTML = vacio('Solo para administradores', 'Las categorías las maneja un administrador.'); return; }
  let cats, marcas = [];
  const cargar = async () => (await datos.categoriasConProductos()).filter((c) => !esPruebas(c));
  try { [cats, marcas] = await Promise.all([cargar(), datos.marcas().catch(() => [])]); }
  catch (err) {
    v.innerHTML = err.sinRed || /necesita señal/.test(err.message)
      ? vacio('Sin señal', 'Las categorías se crean y se cambian con señal. Vuelve a abrir esta pantalla cuando tengas internet.')
      : vacio('No se pudieron cargar las categorías', err.message);
    return;
  }
  let editando = null;   // id de la categoría que se está renombrando

  const fila = (c) => {
    const n = c.productos;
    if (editando === c.id) return `<li class="cat-adm-fila editando">
      <form class="cat-adm-renombrar" data-id="${c.id}" novalidate>
        <label class="campo"><span>Nuevo nombre</span><input name="nombre" maxlength="40" value="${esc(c.nombre)}" autocomplete="off"></label>
        <div class="dos"><button type="button" class="btn sec" data-cancelar>Cancelar</button><button type="submit" class="btn sec">Guardar</button></div>
      </form></li>`;
    return `<li class="cat-adm-fila">
      <div class="fila-txt"><p class="fila-t">${esc(c.nombre)}</p>
        <p class="fila-s">${n ? plural(n, 'producto') : 'Sin productos'} · <span class="cat-adm-ref">REF ${letrasRef(c.nombre)}</span></p></div>
      <div class="cat-adm-acc">
        <button type="button" class="btn sec" data-renombrar="${c.id}" aria-label="Cambiar el nombre de ${esc(c.nombre)}">${icono('editar', 'ico-s')} Cambiar nombre</button>
        ${n ? '' : `<button type="button" class="btn sec cat-adm-borrar" data-borrar="${c.id}" aria-label="Borrar ${esc(c.nombre)}">${icono('basura', 'ico-s')} Borrar</button>`}
      </div>
    </li>`;
  };
  const pintar = () => {
    $('#cat-adm-lista', v).innerHTML = cats.length ? `<ul class="cat-adm">${cats.map(fila).join('')}</ul>` : vacio('Sin categorías', 'Crea la primera arriba.');
    const ed = v.querySelector('.cat-adm-renombrar input');
    if (ed) { ed.focus(); ed.select(); }
  };

  v.innerHTML = `
    <form id="cat-nueva" class="form pad" novalidate>
      <label class="campo"><span>Nueva categoría</span><input id="cat-nombre" name="nombre" maxlength="40" autocomplete="off" placeholder="Ej.: Lácteos"></label>
      <p id="err" class="error" role="alert"></p>
      <button class="btn prin" type="submit">${icono('mas', 'ico-s')} Crear categoría</button>
    </form>
    <div class="pad cat-adm-ayuda"><p class="ayuda">Por tipo de producto, por ejemplo: Lácteos, Mascotas o Juguetes. La empresa va en Marca.</p></div>
    <div id="cat-adm-lista" class="pad"></div>`;
  pintar();

  // Un solo envío a la vez: un doble toque no debe terminar en "Ya existe" justo después de crearla.
  const ocupado = async (btn, fn) => { if (btn?.disabled) return; if (btn) btn.disabled = true; try { await fn(); } finally { if (btn) btn.disabled = false; } };
  const recargar = async () => { cats = await cargar(); editando = null; pintar(); };
  // Pruebas no está en la lista, pero sí cuenta para no repetir el nombre (lo revisa revisarNombre).
  const revisar = (nombre, id = null) => {
    const r = revisarNombre(nombre, { cats, marcas, id });
    if (r.error) return r.error;
    if (r.confirmar && !confirm(r.confirmar)) return '';
    return null;
  };

  $('#cat-nueva', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = limpiarNombre($('#cat-nombre', v).value), err = $('#err', v);
    err.textContent = '';
    const problema = revisar(nombre);
    if (problema !== null) { err.textContent = problema; return; }
    await ocupado(e.submitter || $('#cat-nueva .btn.prin', v), async () => {
      try {
        await datos.guardarCategoria({ nombre });
        aviso(`Categoría "${nombre}" creada`);
        $('#cat-nombre', v).value = '';
        await recargar();
      } catch (er) { err.textContent = er.message; }
    });
  });

  v.addEventListener('click', async (e) => {
    const r = e.target.closest('[data-renombrar]'), b = e.target.closest('[data-borrar]'), c = e.target.closest('[data-cancelar]');
    if (r) { editando = Number(r.dataset.renombrar); pintar(); }
    if (c) { editando = null; pintar(); }
    if (b) {
      const cat = cats.find((x) => x.id === Number(b.dataset.borrar));
      if (!cat || !confirm(`¿Borrar la categoría "${cat.nombre}"? No tiene productos.`)) return;
      await ocupado(b, async () => {
        try { await datos.borrarCategoria(cat.id); aviso(`Categoría "${cat.nombre}" borrada`); await recargar(); }
        catch (er) { aviso(er.message, 'error'); }
      });
    }
  });
  v.addEventListener('submit', async (e) => {
    const f = e.target.closest('.cat-adm-renombrar');
    if (!f) return;
    e.preventDefault();
    const id = Number(f.dataset.id), cat = cats.find((x) => x.id === id);
    const nombre = limpiarNombre(f.nombre.value);
    if (nombre === cat.nombre) { editando = null; return pintar(); }
    const problema = revisar(nombre, id);
    if (problema) return aviso(problema, 'error');
    if (problema === '') return;
    // Solo se pregunta si cambian las letras del REF: es lo único que cambia para los productos nuevos.
    const antes = letrasRef(cat.nombre), despues = letrasRef(nombre);
    if (cat.productos && antes !== despues && !confirm(`¿Cambiar "${cat.nombre}" por "${nombre}"? Los productos nuevos de esta categoría tendrán REF ${despues}… y ${cat.productos === 1 ? 'el producto que ya tiene sigue' : `los ${cat.productos} productos que ya tiene siguen`} con ${antes}…`)) return;
    await ocupado(e.submitter || f.querySelector('[type=submit]'), async () => {
      try { await datos.guardarCategoria({ id, nombre }); aviso('Nombre cambiado'); await recargar(); }
      catch (er) { aviso(er.message, 'error'); }
    });
  });
}
