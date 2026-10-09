# COVECA – Sistema de preventa por rutas

App Android para la ruta y administración web para COVECA.

## Etapa actual: 0 – Prueba de impresión

App mínima que imprime una nota de venta de prueba en la impresora térmica RPP02N (58 mm, ESC/POS) por Bluetooth.

### Cómo obtener el APK
1. Cada cambio en la rama `main` genera el APK automáticamente (pestaña **Actions** → "Generar APK").
2. Al terminar, el archivo `coveca-apk` queda en la sección **Artifacts** de esa ejecución.
3. Descárgalo desde el celular, descomprímelo e instala `app-debug.apk` (Android pedirá permitir instalar apps de origen desconocido).

### Estructura
- `www/` – interfaz de la app (HTML/JS).
- `www/escpos.js` – generador de comandos de impresión ESC/POS.
- `android/` – proyecto Android (Capacitor).
- `android/app/src/main/java/cl/coveca/app/BtPrinterPlugin.java` – conexión Bluetooth con la impresora.
- `.github/workflows/android.yml` – compilación automática del APK.
