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
 * @param {() => Promise<void>} [trabajo.whatsapp]  envía la imagen de la nota por WhatsApp
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
    const bWhats = crear('button', 'imp-whatsapp', `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z"/></svg><span>Enviar por WhatsApp</span>`);
    if (!trabajo.whatsapp) bWhats.hidden = true;
    pie.append(titulo, msg, bWhats, botones);
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
    bWhats.addEventListener('click', async () => {
      try { await trabajo.whatsapp(); }
      catch (e) { msg.textContent = (e && e.message) || String(e); }
    });
    bListo.addEventListener('click', () => {
      if (capa.dataset.estado === 'imprimiendo') return;
      capa.remove();
      resolver('listo');
    });
    ciclo();
  });
}
