# Sistema de diseño COVECA

Fuente de verdad visual de la app. Toda pantalla nueva se construye con estas reglas y se revisa con `CLAUDE.md` → "Lista de chequeo de diseño".

## Para quién diseñamos
- **Vendedor en ruta:** usa el celular (Motorola Edge 60, ~412 × 915 px) de pie, a pleno sol, a veces con una mano y apurado frente al cliente. Prioridad: **leer rápido y no equivocarse**.
- **Administración en PC:** pantallas con más datos (tablas, reportes), pero con la misma identidad.
- El objetivo no es verse "llamativo": es verse **claro, confiable y profesional**, como una herramienta de trabajo seria.

## Marca
- Logo: `www/logo.png` (versión para recibo) y `assets/logo-original.jpg` (original a color).
- El logo aparece en la pantalla de inicio y en la nota impresa. No se deforma, recolorea ni se le agregan efectos.

## Colores
Usar siempre las variables CSS (`www/tokens.css`), nunca colores escritos a mano.

| Variable | Valor | Uso |
|---|---|---|
| `--azul` | `#3E4095` | Color principal de la marca: barra superior, botón principal, enlaces. Contraste 8,9:1 con blanco. |
| `--azul-oscuro` | `#2C2E73` | Botón principal presionado. |
| `--rojo` | `#EC3237` | Solo acentos de marca (logo, detalles grandes). **No usar para texto chico** (4,1:1). |
| `--rojo-texto` | `#C42127` | Errores, deudas vencidas, anulaciones (5,8:1). |
| `--verde` | `#1B5E20` | Cliente atendido, pago registrado, éxito (7,9:1). |
| `--ambar` | `#8A5300` | Advertencias: límite de crédito cerca, stock bajo (6,3:1). |
| `--texto` | `#1D1F2B` | Texto principal. |
| `--texto-suave` | `#5B6070` | Texto secundario (6,3:1). Nunca más claro que esto. |
| `--fondo` | `#F5F6FA` | Fondo de pantalla. |
| `--superficie` | `#FFFFFF` | Tarjetas, listas, formularios. |
| `--borde` | `#D9DCE5` | Divisores y bordes. |

Reglas:
- Un solo color de acción por pantalla (azul). El rojo nunca es el botón principal salvo en confirmaciones destructivas ("Anular pedido").
- El estado nunca se comunica solo con color: siempre va con ícono o texto ("✓ Atendido", "Debe $45.000").
- Sin degradados, sombras exageradas ni efectos decorativos.

## Tipografía
- Familia: la del sistema (`system-ui`, Roboto en Android). Sin fuentes descargadas: la app debe funcionar sin señal.
- Tamaños (celular):
  - Título de pantalla: 22 px, peso 700.
  - Nombre de cliente / producto en lista: 18 px, peso 600.
  - Texto normal: 16 px (mínimo absoluto).
  - Texto secundario: 14 px, solo para datos de apoyo (dirección, REF).
  - Montos importantes (total del pedido): 28 px, peso 700.
- Montos siempre alineados a la derecha y con cifras tabulares (`font-variant-numeric: tabular-nums`).

## Espaciado y tamaños
- Escala: 4, 8, 12, 16, 24, 32 px. Margen lateral de pantalla: 16 px.
- Toda zona tocable mide **al menos 48 × 48 px**. Filas de lista: mínimo 64 px de alto.
- Separación mínima de 8 px entre elementos tocables.
- Bordes redondeados: 10 px en botones y tarjetas, 999 px en etiquetas de estado.

## Componentes
- **Barra superior:** azul, título blanco, botón de volver a la izquierda. Indicador de conexión a la derecha (sin señal = ícono + "Sin conexión").
- **Botón principal:** ancho completo, 52 px de alto, azul, texto blanco 17 px peso 600. Uno por pantalla, fijo abajo cuando es la acción final ("Generar pedido").
- **Botón secundario:** borde azul de 2 px, fondo blanco, texto azul.
- **Fila de lista (cliente/producto):** nombre arriba, dato secundario abajo, estado o monto a la derecha, chevron si navega.
- **Etiqueta de estado:** fondo del color al 12 % + texto del color: "✓ Atendido" (verde), "Pendiente" (texto suave), "Debe $X" (ámbar o rojo si está vencido).
- **Selector de cantidad:** botones − y + de 48 px a los lados del número; el número también se puede escribir.
- **Buscador:** siempre visible arriba de listas largas, con 48 px de alto.
- **Mensajes:** éxito en verde, error en rojo-texto, siempre en lenguaje simple y diciendo qué hacer ("La impresora no responde. Revisa que esté encendida.").

## Formato de datos
- Montos: `$9.900` (CLP, sin decimales, punto de miles). Usar la función `clp()`.
- Fechas: `09-10-2026`; hora `16:48`.
- RUT: `12.345.678-9`.

## Lo que NO hacemos
- Degradados morados, tarjetas flotantes decorativas, íconos de relleno, animaciones largas.
- Texto gris claro sobre blanco, texto menor a 14 px, botones chicos juntos.
- Modales para todo: preferir pantallas completas en el celular.
- Pedir confirmación en acciones reversibles; sí pedirla en anular o borrar.

## Referencias
Capturas de apps que le gustan a COVECA se guardan en `assets/referencias/` con una nota de qué se toma de cada una.

## Tema oscuro
- Se activa solo en **Ajustes → Avanzado → Apariencia** y se guarda en cada celular (`localStorage` `coveca.tema`); por defecto, claro. `js/tema.js` lo aplica antes de pintar (`<html data-tema="oscuro">`).
- `tokens.css` redefine los colores bajo `:root[data-tema="oscuro"]`. Usar `--azul` para textos/bordes de acento y `--relleno` + `--sobre-relleno` para fondos de marca con texto blanco (barra, botón principal, selección). Nunca `#fff` a mano: `--sobre-relleno` o `--papel`.
- La nota impresa, el QR y los PDF no cambian de tema. El logo se muestra sobre placa `--papel`.
- Las capturas generan también `capturas/oscuro-*.png`: revisar ambas versiones.
