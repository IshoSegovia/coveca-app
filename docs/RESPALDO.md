# Respaldo diario de COVECA

## Qué se respalda y cuándo
Todas las noches (≈ 03:30 hora de Chile) GitHub ejecuta **Actions → Respaldo diario** (`.github/workflows/respaldo.yml`):

| Archivo dentro del respaldo | Contenido |
|---|---|
| `base-public.sql` | Toda la base del negocio: productos, clientes, rutas, proveedores, pedidos, stock, configuración, numeración de notas, funciones y reglas de acceso. |
| `usuarios-y-carpetas.sql` | Cuentas de usuario (correo y contraseña cifrada) y las carpetas de fotos (buckets). |
| `extras.sql` | Alta automática de vendedores y permisos de las fotos (viven fuera del esquema principal). |
| `fotos/` | Copia de cada foto de productos, clientes y notas. |
| `indice-fotos.txt`, `conteos.txt`, `LEEME.txt` | Lista de fotos, cantidad de registros por tabla y versión de la base. |

Todo se comprime y se **cifra con AES-256** usando la clave `RESPALDO_CLAVE`. Sin esa clave el archivo no se puede abrir: el repositorio es público, por eso va cifrado.

Cada respaldo queda **90 días** en GitHub (Actions → Respaldo diario → una ejecución → *Artifacts*). Costo: $0 (repositorio público).
Al terminar, la ejecución muestra un resumen con la cantidad de productos, clientes, pedidos y fotos copiados.

## Lo único que hay que cuidar
1. **La clave `RESPALDO_CLAVE`**: guardarla en un lugar seguro fuera de GitHub (gestor de contraseñas o papel guardado). GitHub no deja volver a verla. Si se pierde, los respaldos ya hechos no sirven: hay que crear una clave nueva.
2. Si llega un correo de GitHub diciendo que el respaldo falló, avisar a Claude.
3. GitHub pausa las tareas programadas de un repositorio sin cambios durante 60 días. Si eso pasa, entrar a Actions → Respaldo diario → *Enable workflow*.

## Respaldo manual (por ejemplo, antes de un cambio grande)
Actions → **Respaldo diario** → *Run workflow* → *Run workflow*. En 2–3 minutos aparece el archivo.

## Cómo restaurar
Lo más simple: **pedírselo a Claude** indicando la fecha del respaldo. Pasos técnicos de referencia:

### 1. Descargar y descifrar
Descargar el artefacto desde GitHub (viene dentro de un .zip), descomprimir el .zip y luego, en una terminal (en Windows sirve *Git Bash*):

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in coveca-respaldo-AAAA-MM-DD.tar.gz.cifrado -out respaldo.tar.gz
# pide la clave RESPALDO_CLAVE
tar xzf respaldo.tar.gz
```

### 2a. Si se perdió todo el proyecto de Supabase
1. Crear un proyecto nuevo en Supabase y copiar su dirección de conexión (*Session pooler*, puerto 5432).
2. Cargar en este orden (el orden importa):
   ```bash
   psql "$NUEVA_URL" -f usuarios-y-carpetas.sql
   psql "$NUEVA_URL" -f base-public.sql      # el error "schema public already exists" es normal
   psql "$NUEVA_URL" -f extras.sql
   ```
3. Subir las fotos: en Supabase → Storage, abrir cada carpeta (`productos`, `clientes`, `notas`) y arrastrar el contenido de `fotos/<carpeta>/`.
4. Las fotos guardan la dirección del proyecto antiguo. Corregirla (reemplazar ambas direcciones):
   ```sql
   update productos set imagen_url = replace(imagen_url, 'https://ANTIGUO.supabase.co', 'https://NUEVO.supabase.co');
   update clientes  set imagen_url = replace(imagen_url, 'https://ANTIGUO.supabase.co', 'https://NUEVO.supabase.co');
   ```
5. Actualizar `www/config.js` con la URL y clave publishable nuevas, el secreto `SUPABASE_DB_URL` en GitHub, y publicar una versión nueva de la app. (La lista de migraciones aplicadas ya viene en el respaldo.)

### 2b. Si solo se borraron o dañaron algunos datos
No restaurar encima de la base en uso. Cargar el respaldo en una base aparte (PostgreSQL local o proyecto de prueba) siguiendo 2a, y copiar solo los registros necesarios a la base real.

## Prueba realizada
La restauración completa (pasos 2a.1–2a.2) se probó en una base PostgreSQL vacía que simula Supabase: productos, clientes, pedidos, stock, numeración de notas, vendedores, usuarios, reglas de acceso y el alta automática de vendedores quedaron idénticos al original.
