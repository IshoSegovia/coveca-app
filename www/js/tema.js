// Tema claro/oscuro. Se elige solo en Ajustes > Avanzado y se guarda en este celular.
// Se carga antes que los estilos para que la app no aparezca en blanco un instante.
(function () {
  var t = null;
  try { t = localStorage.getItem('coveca.tema'); } catch (e) { /* sin almacenamiento: queda claro */ }
  if (t === 'oscuro') document.documentElement.setAttribute('data-tema', 'oscuro');
})();
