import { $ } from '../ui.js';
import * as datos from '../datos.js';

export async function vistaLogin(v) {
  document.querySelector('#barra').innerHTML = '';
  v.innerHTML = `
    <div class="login">
      <img class="login-logo logo-claro" src="marca/coveca-color.svg" alt="COVECA"><img class="login-logo logo-oscuro" src="marca/coveca-negativo.svg" alt="COVECA">
      <h1 class="login-t">Bienvenido de vuelta</h1>
      <p class="login-sub">Ingresa para tomar pedidos en ruta.</p>
      <form id="f" class="form" novalidate>
        <label class="campo"><span>Correo</span>
          <input name="correo" type="email" autocomplete="username" inputmode="email" required></label>
        <label class="campo"><span>Contraseña</span>
          <input name="clave" type="password" autocomplete="current-password" required></label>
        <p id="err" class="error" role="alert"></p>
        <button class="btn prin" type="submit">Entrar</button>
      </form>
      <button id="demo" class="btn sec" type="button">Ver con datos de ejemplo</button>
      <p class="login-pie">Su comercializadora de confianza</p>
    </div>`;
  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, b = f.querySelector('button');
    if (!f.correo.value || !f.clave.value) { $('#err', v).textContent = 'Escribe tu correo y contraseña.'; return; }
    b.disabled = true; b.textContent = 'Entrando…'; $('#err', v).textContent = '';
    try {
      await datos.entrar(f.correo.value.trim(), f.clave.value);
      window.dispatchEvent(new CustomEvent('coveca:sesion', { detail: true }));
    } catch (err) {
      $('#err', v).textContent = err.message;
      b.disabled = false; b.textContent = 'Entrar';
    }
  });
  $('#demo', v).addEventListener('click', () => {
    datos.entrarDemo();
    document.body.classList.add('demo');
    window.dispatchEvent(new CustomEvent('coveca:sesion', { detail: true }));
  });
}
