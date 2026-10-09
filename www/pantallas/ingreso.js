import { datos } from '../datos.js';
import { pantalla, ruta, ir, leerFormulario } from '../nucleo.js';
import { campo } from './comunes.js';

ruta('/ingreso', () => {
  pantalla({
    titulo: 'Ingresar',
    cuerpo: `<div class="ingreso">
      <img src="logo-color.png" alt="COVECA" class="ingreso-logo">
      <p class="ingreso-texto">Ingresa con el correo y la contraseña que te dio el administrador. Solo se pide una vez en este celular.</p>
      <form id="f-ingreso" class="formulario" novalidate>
        ${campo({ etiqueta: 'Correo', nombre: 'correo', tipo: 'email', modo: 'email', req: true, extra: 'autocomplete="username"' })}
        ${campo({ etiqueta: 'Contraseña', nombre: 'clave', tipo: 'password', req: true, extra: 'autocomplete="current-password"' })}
        <p class="error-form" hidden></p>
      </form></div>`,
    pie: '<button class="boton boton-principal" form="f-ingreso">Ingresar</button>',
  });
  document.getElementById('f-ingreso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = leerFormulario(e.target);
    const err = e.target.querySelector('.error-form');
    if (!f.correo || !f.clave) { err.textContent = 'Escribe tu correo y contraseña.'; err.hidden = false; return; }
    try { await datos.ingresar(f.correo, f.clave); ir('/rutas'); }
    catch (x) { err.textContent = x.message || 'Correo o contraseña incorrectos.'; err.hidden = false; }
  });
});
