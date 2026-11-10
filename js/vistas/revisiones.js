// Ajustes → Revisiones automáticas (solo administradores): informes de los agentes de seguridad y QA
// que GitHub Actions guarda en Supabase después de cada cambio. En GitHub solo queda el conteo;
// el detalle se lee aquí y se copia para pedir la corrección.
import { $, esc, barra, icono, vacio, aviso, plural } from '../ui.js';
import * as datos from '../datos.js';

const NOMBRE = { seguridad: 'Seguridad', qa: 'Calidad (QA)' };
const SIGLA = { seguridad: 'S', qa: 'QA' };

const cuando = (d) => new Date(d).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-');

// Estado con texto (nunca solo color): graves = crítico + alto; menores = medio + bajo.
function estado(r) {
  if (r.completa === false) return '<span class="chip stock-bajo">Incompleta</span>';
  if (r.criticos) return `<span class="chip stock-sin">${plural(r.criticos, 'crítico', 'críticos')}${r.altos ? ` · ${plural(r.altos, 'alto', 'altos')}` : ''}</span>`;
  if (r.altos) return `<span class="chip stock-sin">${plural(r.altos, 'alto', 'altos')}</span>`;
  const menores = r.medios + r.bajos;
  if (menores) return `<span class="chip stock-bajo">${plural(menores, 'menor', 'menores')}</span>`;
  return `<span class="chip ok">${icono('check', 'ico-s')} Sin hallazgos</span>`;
}

const fila = (r) => `
  <a class="fila" href="#/revisiones/${r.id}">
    <span class="avatar" aria-hidden="true">${SIGLA[r.agente] || '?'}</span>
    <div class="fila-txt"><p class="fila-t">${NOMBRE[r.agente] || esc(r.agente)}</p>
      <p class="fila-s">${cuando(r.creado_en)}${r.version ? ' · versión ' + esc(r.version) : ''}${r.alcance === 'completo' ? ' · revisión completa' : ''}</p></div>
    ${estado(r)}${icono('derecha', 'ico-chev')}</a>`;

export async function vistaRevisiones(v) {
  barra({ titulo: 'Revisiones automáticas', atras: '#/ajustes' });
  if (!datos.esAdmin()) { v.innerHTML = vacio('Solo para administradores', 'Pide a un administrador que revise estos informes.'); return; }
  const rs = await datos.revisiones();
  if (!rs.length) {
    v.innerHTML = vacio('Aún no hay revisiones', 'Después del próximo cambio en la app, los agentes de seguridad y calidad dejarán aquí su informe.');
    return;
  }
  const ultimas = ['seguridad', 'qa'].map((a) => rs.find((r) => r.agente === a)).filter(Boolean);
  const resto = rs.filter((r) => !ultimas.includes(r));
  v.innerHTML = `
    <p class="ayuda pad mt">Después de cada cambio, dos agentes revisan la app: uno busca fallas de seguridad y otro errores en ventas, cálculos y diseño. Solo informan; las correcciones se piden a soporte.</p>
    <h2 class="sec-t">Última revisión</h2>
    <div class="lista">${ultimas.map(fila).join('')}</div>
    ${resto.length ? `<h2 class="sec-t">Anteriores</h2><div class="lista">${resto.map(fila).join('')}</div>` : ''}`;
}

// Convierte el informe (Markdown simple) en HTML. Todo el texto pasa por esc(): nada del informe se ejecuta.
function informeHtml(md) {
  const enLinea = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  let html = ''; let enLista = false; let enCodigo = false;
  const cerrarLista = () => { if (enLista) { html += '</ul>'; enLista = false; } };
  for (const linea of String(md || '').split('\n')) {
    if (/^```/.test(linea)) { cerrarLista(); html += enCodigo ? '</pre>' : '<pre>'; enCodigo = !enCodigo; continue; }
    if (enCodigo) { html += esc(linea) + '\n'; continue; }
    if (/^RESUMEN:/.test(linea)) continue;                       // línea técnica para la automatización
    const h = linea.match(/^(#{1,3})\s+(.*)$/);
    if (h) { cerrarLista(); html += h[1].length === 1 ? '' : `<h${h[1].length + 1}>${enLinea(h[2])}</h${h[1].length + 1}>`; continue; }
    const li = linea.match(/^\s*[-*]\s+(.*)$/);
    if (li) { if (!enLista) { html += '<ul>'; enLista = true; } html += `<li>${enLinea(li[1])}</li>`; continue; }
    cerrarLista();
    if (linea.trim()) html += `<p>${enLinea(linea)}</p>`;
  }
  cerrarLista();
  if (enCodigo) html += '</pre>';
  return html;
}

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* se intenta a la antigua */ }
  const t = document.createElement('textarea');
  t.value = texto; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
  document.body.appendChild(t); t.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
  t.remove();
  return ok;
}

export async function vistaRevision(v, id) {
  const r = await datos.revision(id);
  if (!r) { barra({ titulo: 'Revisión', atras: '#/revisiones' }); v.innerHTML = vacio('No se encontró este informe', 'Vuelve a la lista de revisiones.'); return; }
  barra({ titulo: NOMBRE[r.agente] || 'Revisión', sub: cuando(r.creado_en), atras: '#/revisiones' });
  const total = r.criticos + r.altos + r.medios + r.bajos;
  v.innerHTML = `
    <dl class="datos mt">
      <div class="dato"><dt>Resultado</dt><dd>${estado(r)}</dd></div>
      ${total ? `<div class="dato"><dt>Detalle</dt><dd>${[[r.criticos, 'crítico', 'críticos'], [r.altos, 'alto', 'altos'], [r.medios, 'medio', 'medios'], [r.bajos, 'bajo', 'bajos']]
        .filter(([n]) => n).map(([n, a, b]) => plural(n, a, b)).join(' · ')}</dd></div>` : ''}
      ${r.version ? `<div class="dato"><dt>Versión</dt><dd>${esc(r.version)}${r.commit ? ' · ' + esc(String(r.commit).slice(0, 7)) : ''}</dd></div>` : ''}
    </dl>
    <article class="informe pad">${informeHtml(r.informe)}</article>
    <div class="pad">
      <button id="copiar" type="button" class="btn sec">${icono('copiar')} Copiar informe</button>
      <p class="ayuda mt">Para corregir, copia el informe y envíalo a soporte.</p>
    </div>`;
  $('#copiar', v).addEventListener('click', async () => {
    (await copiar(r.informe)) ? aviso('Informe copiado') : aviso('No se pudo copiar. Mantén presionado el texto para copiarlo.', 'error');
  });
}
