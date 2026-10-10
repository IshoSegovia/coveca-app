# COVECA – instrucciones para Claude

Sistema de preventa por rutas para COVECA (Chile). Contexto de negocio completo: documento `contexto-coveca.md` del proyecto en claude.ai. Francisco no es programador: explica en lenguaje claro y entrega pasos verificables.

## Estructura
- `www/` – interfaz (HTML/JS/CSS sin compilación). `tokens.css` = variables de diseño, `app.css` = estilos de la app.
  - `js/main.js` entrada y enrutador (`#/rutas`, `#/clientes/:id`, `#/inventario/:id`, `#/ajustes`…).
  - `js/datos.js` capa de datos: Supabase con sesión; `js/demo.js` datos de ejemplo ("Ver con datos de ejemplo" en el ingreso).
  - `js/vistas/` pantallas: login, rutas (+ recorrido), clientes (+ ubicación), pedido, inventario, proveedores, reportes, ajustes. `js/ui.js` utilidades (clp, margen, íconos, barra, selector lista/íconos).
  - `js/gps.js` ubicación, orden del recorrido (vecino más cercano + 2-opt) y enlaces de Google Maps por tramos (base de partida opcional por ruta).
  - `js/pdf.js` reportes PDF de marca (jsPDF + autotable en `vendor/`); en Android se guardan en Descargas/COVECA con `Compartir.guardarArchivo`.
  - `js/fotos.js` recorte/reducción de fotos antes de subir a Storage (carpetas `productos` y `clientes`).
  - `js/tema.js` + `js/vistas/avanzado.js` tema claro/oscuro (solo desde Ajustes → Avanzado; ver DESIGN.md).
  - `js/actualizacion.js` actualización obligatoria; `js/externo.js` abre enlaces fuera de la app (`<a data-externo>`).
  - `js/impresora.js` imprime una nota (animación + Bluetooth + QR + WhatsApp) usando `escpos.js`, `render.js`, `impresion-animada.js`, `nota-qr.js`.
  - `vendor/` librerías copiadas (supabase-js UMD, qrcode). Para actualizar supabase-js: `npm i @supabase/supabase-js@2` y copiar `node_modules/@supabase/supabase-js/dist/umd/supabase.js`.
- `www/render.js` – nota de venta como imagen + conversión a ESC/POS raster (impresora RPP02N, 58 mm = 384 px).
- `android/` – proyecto Capacitor. `BtPrinterPlugin.java` = impresión Bluetooth SPP. `CompartirPlugin.java` = WhatsApp con imagen, abrir enlaces y guardar archivos (PDF) en Descargas.
- `scripts/capturas.mjs` – capturas de pantalla automáticas en tamaño celular.
- `.github/workflows/android.yml` – compila el APK (firma fija con secretos `ANDROID_KEYSTORE_*`) y lo publica en Releases (`ultima`).
- `supabase/migrations/` – esquema de la base de datos. Cada archivo nuevo se aplica solo en Supabase vía `.github/workflows/base-de-datos.yml` (secreto `SUPABASE_DB_URL`). Nunca editar una migración ya aplicada: crear una nueva.
- `.github/workflows/respaldo.yml` – respaldo diario (03:30 Chile): pg_dump + fotos de Storage, cifrado con el secreto `RESPALDO_CLAVE`, artefacto 90 días. `supabase/respaldo/extras.sql` copia el disparador de auth.users y las reglas de storage.objects. Restauración: `docs/RESPALDO.md` (orden: usuarios → base → extras).
- `supabase/pruebas/` – pruebas SQL. Correr en un PostgreSQL local: `simular_supabase.sql`, luego las migraciones, luego `prueba_pedidos.sql`.
- `www/config.js` – URL y clave publishable de Supabase (públicas por diseño; la seguridad está en RLS).

## Reglas de negocio que no se rompen
- Margen sobre precio de venta: `precio = costo / (1 - margen)`. Nunca `costo * (1 + margen)`.
- Montos CLP sin decimales con punto de miles (`$9.900`), usando `clp()`.
- El documento es "nota de venta" hasta que COVECA inicie actividades en el SII.
- La app de ruta debe funcionar sin señal.

## Diseño
Toda pantalla sigue `DESIGN.md`. Antes de dar por terminada una pantalla:
1. Generar capturas: `node scripts/capturas.mjs` (modo demostración; salen en `capturas/`; agregar la pantalla nueva a `PANTALLAS`). Falla si hay errores de JavaScript.
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

## Reportes
- Stock bajo: negativo / sin stock / bajo mínimo (mínimo general editable para productos sin mínimo propio). Filtro por proveedor: con un proveedor elegido se arma la solicitud de pedido (cantidad sugerida = hasta el doble del mínimo, editable) para enviar por WhatsApp, correo o PDF sin stock ni costos.
- Ventas de la semana (lunes a domingo): filtro por proveedor según el proveedor actual de cada producto; con filtro, montos por producto sin descuentos de la nota.
- Salida: PDF de marca y WhatsApp como texto (no se imprimen en la térmica).

## Impresión
- Revisar cambios a la nota con la vista previa (imagen) antes de publicar.
- El envío Bluetooth va en bloques continuos y espera antes de cerrar el socket; cerrar antes corta la nota.

## Versiones y actualización obligatoria
- Cada compilación en GitHub = versión `0.1.<número de compilación>` (versionCode igual). Se escribe en `www/version.js` (en el repo queda `codigo: 0` = desarrollo, sin revisión).
- Se publica como release `v0.1.N` y en `ultima`; luego se registra en Supabase (`configuracion.app_version`, leída con `version_app()`).
- Al abrir o volver a la app, `js/actualizacion.js` compara versiones y bloquea con "Descargar e instalar" si hay una más nueva. Sin señal no bloquea.

## Publicar
Cada push a `main` genera el APK en `https://github.com/IshoSegovia/coveca-app/releases/latest/download/coveca.apk`. Verificar que la compilación termine bien antes de avisar a Francisco.
