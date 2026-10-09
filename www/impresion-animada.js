// Pantalla de impresión animada: la nota "sale" de una ranura mientras la impresora imprime
// (estilo terminales Point). La animación y la impresión real van sincronizadas.
const VELOCIDAD = 110;           // px por segundo de la vista previa
const MIN_MS = 2500, MAX_MS = 9000;

function crear(tag, clase, html) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (html != null) e.innerHTML = html;
  return e;
}

/**
 * Muestra la animación e imprime.
 * @param {HTMLCanvasElement} imagen  vista previa de la nota (dibujarNota)
 * @param {() => Promise<void>} imprimir  función que imprime de verdad
 * @returns {Promise<'listo'>} se resuelve cuando la persona presiona "Listo"
 */
export function mostrarImpresion(imagen, imprimir) {
  return new Promise((resolver) => {
    const capa = crear('div', 'imp-capa');
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-live', 'polite');
    const titulo = crear('p', 'imp-titulo', 'Imprimiendo nota…');
    const escenario = crear('div', 'imp-escenario');
    const papel = crear('div', 'imp-papel');
    const img = crear('img');
    img.src = imagen.toDataURL();
    img.alt = 'Nota de venta';
    papel.appendChild(img);
    escenario.appendChild(papel);
    const impresora = crear('div', 'imp-impresora', '<span class="imp-ranura"></span><span class="imp-luz"></span>');
    const pie = crear('div', 'imp-pie');
    const msg = crear('p', 'imp-msg');
    const botones = crear('div', 'imp-botones');
    const bListo = crear('button', 'imp-principal', 'Listo');
    const bOtra = crear('button', 'imp-secundario', 'Reimprimir');
    botones.append(bOtra, bListo);
    pie.append(msg, botones);
    capa.append(titulo, escenario, impresora, pie);
    document.body.appendChild(capa);

    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    async function ciclo() {
      capa.dataset.estado = 'imprimiendo';
      titulo.textContent = 'Imprimiendo nota…';
      msg.textContent = '';
      bListo.textContent = 'Listo';
      escenario.scrollTop = 0;
      await new Promise((r) => requestAnimationFrame(r));
      const alto = papel.getBoundingClientRect().height;
      const dur = reducido ? 1 : Math.min(MAX_MS, Math.max(MIN_MS, (alto / VELOCIDAD) * 1000));
      const anim = papel.animate(
        [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }],
        { duration: dur, easing: 'cubic-bezier(.25,.1,.25,1)', fill: 'both' }
      );
      try {
        await Promise.all([anim.finished, imprimir()]);
        capa.dataset.estado = 'listo';
        titulo.innerHTML = '<span aria-hidden="true">✓</span> Nota impresa';
        msg.textContent = 'Corta el papel y entrégala al cliente.';
      } catch (e) {
        anim.pause();
        capa.dataset.estado = 'error';
        titulo.textContent = 'No se pudo imprimir';
        msg.textContent = (e && e.message) || String(e);
        bOtra.textContent = 'Reintentar';
        bListo.textContent = 'Cerrar';
        return;
      }
      bOtra.textContent = 'Reimprimir';
    }

    bOtra.addEventListener('click', () => { if (capa.dataset.estado !== 'imprimiendo') ciclo(); });
    bListo.addEventListener('click', () => {
      if (capa.dataset.estado === 'imprimiendo') return;
      capa.remove();
      resolver('listo');
    });
    ciclo();
  });
}
