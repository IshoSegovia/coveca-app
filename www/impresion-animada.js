// Pantalla de impresión animada (estilo terminales Point): la impresora está arriba de la
// pantalla y la nota sube y desaparece por la ranura al mismo ritmo que sale el papel real.
//
// Sincronización: la duración se calcula con el largo real de la nota (mm) dividido por la
// velocidad de la impresora (mm/s), más el tiempo que tarda en conectarse por Bluetooth.
// La velocidad se puede calibrar (varía con batería y temperatura).

export const VELOCIDAD_DEFECTO = 24;   // mm/s medidos con la RPP02N
export const ESPERA_DEFECTO = 900;     // ms entre el toque y el primer papel (conexión Bluetooth)

function crear(tag, clase, html) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (html != null) e.innerHTML = html;
  return e;
}

/**
 * @param {HTMLCanvasElement} imagen  vista de la nota
 * @param {object} trabajo
 * @param {number} trabajo.largoMm  largo del papel que se va a imprimir
 * @param {() => Promise<void>} trabajo.imprimir  imprime de verdad
 * @param {number} [trabajo.velocidad]  mm/s
 * @param {number} [trabajo.espera]  ms antes de que empiece a salir papel
 * @param {string} [trabajo.qrSvg]  QR con la nota, se muestra al terminar
 * @returns {Promise<'listo'>}
 */
export function mostrarImpresion(imagen, trabajo) {
  const velocidad = trabajo.velocidad || VELOCIDAD_DEFECTO;
  const espera = trabajo.espera ?? ESPERA_DEFECTO;

  return new Promise((resolver) => {
    const capa = crear('div', 'imp-capa');
    capa.setAttribute('role', 'dialog');
    const impresora = crear('div', 'imp-impresora', '<span class="imp-luz"></span><span class="imp-ranura"></span>');
    const escenario = crear('div', 'imp-escenario');
    const papel = crear('div', 'imp-papel');
    const img = crear('img');
    img.src = imagen.toDataURL();
    img.alt = 'Nota de venta';
    papel.appendChild(img);
    const hecho = crear('div', 'imp-hecho');
    if (trabajo.qrSvg) {
      hecho.innerHTML = `<div class="imp-qr">${trabajo.qrSvg}</div>
        <p class="imp-qr-texto">El cliente puede escanear este código con la cámara para guardar la nota en su teléfono.</p>`;
      hecho.classList.add('con-qr');
    } else {
      hecho.innerHTML = '<span class="imp-check" aria-hidden="true">✓</span>';
    }
    escenario.append(papel, hecho);
    const pie = crear('div', 'imp-pie');
    const titulo = crear('p', 'imp-titulo');
    titulo.setAttribute('aria-live', 'polite');
    const msg = crear('p', 'imp-msg');
    const botones = crear('div', 'imp-botones');
    const bOtra = crear('button', 'imp-secundario', 'Reimprimir');
    const bListo = crear('button', 'imp-principal', 'Listo');
    botones.append(bOtra, bListo);
    pie.append(titulo, msg, botones);
    capa.append(impresora, escenario, pie);
    document.body.appendChild(capa);

    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let anim = null;

    async function ciclo() {
      capa.dataset.estado = 'imprimiendo';
      titulo.textContent = 'Imprimiendo nota…';
      msg.textContent = 'No retires el papel hasta que termine.';
      bOtra.textContent = 'Reimprimir';
      bListo.textContent = 'Listo';
      if (anim) anim.cancel();
      await new Promise((r) => requestAnimationFrame(r));
      const duracion = reducido ? 1 : (trabajo.largoMm / velocidad) * 1000;
      anim = papel.animate(
        [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }],
        { duration: duracion, delay: reducido ? 0 : espera, easing: 'linear', fill: 'both' }
      );
      try {
        await Promise.all([anim.finished, trabajo.imprimir()]);
        capa.dataset.estado = 'listo';
        titulo.innerHTML = '<span aria-hidden="true">✓</span> Nota impresa';
        msg.textContent = 'Corta el papel y entrégala al cliente.';
      } catch (e) {
        if (anim) anim.pause();
        capa.dataset.estado = 'error';
        titulo.textContent = 'No se pudo imprimir';
        msg.textContent = (e && e.message) || String(e);
        bOtra.textContent = 'Reintentar';
        bListo.textContent = 'Cerrar';
      }
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
