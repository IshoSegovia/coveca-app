// Pantalla de impresión animada (estilo terminales Point): la impresora está arriba de la
// pantalla y la nota sube y desaparece por la ranura al mismo ritmo que sale el papel real.
//
// Sincronización: la duración se calcula con el largo real de la nota (mm) dividido por la
// velocidad de la impresora (mm/s), más el tiempo que tarda en conectarse por Bluetooth.
// La velocidad se puede calibrar (varía con batería y temperatura).

export const VELOCIDAD_DEFECTO = 24;   // mm/s medidos con la RPP02N
const ESPERA_DEFECTO = 900;     // ms entre el toque y el primer papel (conexión Bluetooth)
const INTENTOS = 3;             // fallos de la térmica antes de pasar a "entregar sin imprimir" (decisión de Francisco)

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
 * @param {boolean} [trabajo.sinImpresora]  versión web (iPhone, PC): muestra la nota sin decir que se imprimió
 * @param {{texto: string}} [trabajo.hoja]  PC con impresora normal: botón que cierra y lleva a imprimir la nota en hoja (resuelve 'hoja')
 * @param {() => Promise<string>} [trabajo.pdf]  guarda la nota en PDF (si la térmica falla); devuelve dónde quedó
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
        <p class="imp-qr-texto">El cliente escanea este código con la cámara para ver y descargar su nota en el teléfono.</p>`;
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
    const bWhats = crear('button', 'imp-whatsapp', `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z"/></svg><span>${trabajo.sinImpresora ? 'Compartir nota' : 'Enviar por WhatsApp'}</span>`);
    if (!trabajo.whatsapp) bWhats.hidden = true;
    // Copia de la nota al WhatsApp del negocio (registro fuera de la app)
    const bCopia = crear('button', 'imp-secundario imp-copia', 'Copia al negocio');
    if (!trabajo.copia) bCopia.hidden = true;
    // Si la térmica falla: guardar la nota en PDF para entregarla igual
    const bPdf = crear('button', 'imp-secundario imp-pdf', 'Guardar nota en PDF');
    if (!trabajo.pdf) bPdf.hidden = true;
    const bHoja = crear('button', 'imp-secundario imp-hoja', trabajo.hoja ? trabajo.hoja.texto : '');
    if (!trabajo.hoja) bHoja.hidden = true;
    pie.append(titulo, msg, bHoja, bWhats, bPdf, bCopia, botones);
    capa.append(impresora, escenario, pie);
    if (trabajo.msgListo) capa.dataset.omitida = '1';   // "Generar sin imprimir": también ofrece Guardar nota en PDF
    document.body.appendChild(capa);

    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let anim = null;
    let fallos = 0;

    async function ciclo() {
      capa.dataset.estado = 'imprimiendo';
      const web = !!trabajo.sinImpresora;
      titulo.textContent = web ? 'Generando nota…' : 'Imprimiendo nota…';
      msg.textContent = web ? 'Preparando la imagen de la nota.' : 'No retires el papel hasta que termine.';
      bOtra.textContent = web ? 'Ver de nuevo' : 'Reimprimir';
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
        titulo.innerHTML = web ? '<span aria-hidden="true">✓</span> Nota generada' : '<span aria-hidden="true">✓</span> Nota impresa';
        msg.textContent = trabajo.msgListo || (web ? 'Esta versión no imprime en térmica: compártela con el botón de abajo o con el código QR.'
          : 'Corta el papel y entrégala al cliente.');
      } catch (e) {
        if (anim) anim.pause();
        fallos += 1;
        const motivo = (e && e.message) || String(e);
        bOtra.textContent = 'Reintentar';
        if (fallos < INTENTOS) {
          capa.dataset.estado = 'error';
          titulo.textContent = `No se pudo imprimir (intento ${fallos} de ${INTENTOS})`;
          msg.textContent = `${motivo} Revisa que la impresora esté encendida y con papel, y reintenta. El pedido ya quedó guardado.`;
          bListo.textContent = 'Cerrar';
        } else {
          // Tras varios intentos: se entrega la nota igual (QR, WhatsApp o PDF), dejando claro que no se imprimió.
          capa.dataset.estado = 'sin-papel';
          titulo.textContent = 'No se pudo imprimir la nota';
          msg.textContent = `${motivo} El pedido quedó guardado. Entrega la nota al cliente con el código QR, por WhatsApp o en PDF.`;
          bListo.textContent = 'Listo';
        }
      }
    }

    bOtra.addEventListener('click', () => { if (capa.dataset.estado !== 'imprimiendo') ciclo(); });
    bCopia.addEventListener('click', async () => {
      try { await trabajo.copia(); bCopia.textContent = '✓ Copia enviada al negocio'; }
      catch (e) { msg.textContent = (e && e.message) || String(e); }
    });
    bPdf.addEventListener('click', async () => {
      bPdf.disabled = true;
      try { const donde = await trabajo.pdf(); bPdf.textContent = `✓ PDF guardado${donde ? ' en ' + donde : ''}`; }
      catch (e) { msg.textContent = (e && e.message) || String(e); bPdf.disabled = false; }
    });
    bWhats.addEventListener('click', async () => {
      try { await trabajo.whatsapp(); }
      catch (e) { msg.textContent = (e && e.message) || String(e); }
    });
    bHoja.addEventListener('click', () => { capa.remove(); resolver('hoja'); });
    bListo.addEventListener('click', () => {
      if (capa.dataset.estado === 'imprimiendo') return;
      capa.remove();
      resolver('listo');
    });
    ciclo();
  });
}
