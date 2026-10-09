# COVECA – instrucciones para Claude

Sistema de preventa por rutas para COVECA (Chile). Contexto de negocio completo: documento `contexto-coveca.md` del proyecto en claude.ai. Francisco no es programador: explica en lenguaje claro y entrega pasos verificables.

## Estructura
- `www/` – interfaz (HTML/JS/CSS). `www/tokens.css` = variables de diseño.
- `www/render.js` – nota de venta como imagen + conversión a ESC/POS raster (impresora RPP02N, 58 mm = 384 px).
- `android/` – proyecto Capacitor. `BtPrinterPlugin.java` = impresión Bluetooth SPP.
- `scripts/capturas.mjs` – capturas de pantalla automáticas en tamaño celular.
- `.github/workflows/android.yml` – compila el APK y lo publica en Releases (`ultima`).

## Reglas de negocio que no se rompen
- Margen sobre precio de venta: `precio = costo / (1 - margen)`. Nunca `costo * (1 + margen)`.
- Montos CLP sin decimales con punto de miles (`$9.900`), usando `clp()`.
- El documento es "nota de venta" hasta que COVECA inicie actividades en el SII.
- La app de ruta debe funcionar sin señal.

## Diseño
Toda pantalla sigue `DESIGN.md`. Antes de dar por terminada una pantalla:
1. Generar capturas: `node scripts/capturas.mjs` (salen en `capturas/`).
2. Mirar cada captura y pasar la lista de chequeo.
3. Corregir y repetir hasta que todo cumpla. Mostrar las capturas a Francisco al cerrar la tarea.

### Lista de chequeo de diseño
- [ ] Usa solo variables de `tokens.css`; ningún color escrito a mano.
- [ ] Texto ≥ 16 px (secundario ≥ 14 px) y contraste ≥ 4,5:1.
- [ ] Zonas tocables ≥ 48 × 48 px, separadas ≥ 8 px.
- [ ] Un solo botón principal por pantalla.
- [ ] Ningún estado se comunica solo con color.
- [ ] Nada se corta ni se desborda a 412 px de ancho; textos largos (nombres de productos) se ajustan en varias líneas.
- [ ] Montos alineados a la derecha, formato `$9.900`, cifras tabulares.
- [ ] Mensajes de error dicen qué pasó y qué hacer, en español simple.
- [ ] Se ve bien sin conexión (sin fuentes ni recursos externos).
- [ ] Nada de degradados, sombras decorativas ni "tarjetas genéricas".

## Impresión
- Revisar cambios a la nota con la vista previa (imagen) antes de publicar.
- El envío Bluetooth va en bloques continuos y espera antes de cerrar el socket; cerrar antes corta la nota.

## Publicar
Cada push a `main` genera el APK en `https://github.com/IshoSegovia/coveca-app/releases/latest/download/coveca.apk`. Verificar que la compilación termine bien antes de avisar a Francisco.
