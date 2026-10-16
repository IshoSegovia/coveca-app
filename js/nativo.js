// Puente con la app Android (Capacitor). En la web (iPhone, PC) esApp es false y los plugins son null.
const cap = window.Capacitor;
export const esApp = !!cap?.isNativePlatform?.();
const plugin = (nombre) => (esApp ? (cap.Plugins?.[nombre] || cap.registerPlugin(nombre)) : null);
export const Compartir = plugin('Compartir');   // WhatsApp, guardar archivos, abrir enlaces, barra de estado, widget
export const Impresora = plugin('BtPrinter');   // térmica Bluetooth
export const Camara = plugin('Camera');         // cámara oficial de Capacitor
