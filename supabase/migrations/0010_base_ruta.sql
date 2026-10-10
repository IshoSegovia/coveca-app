-- Punto de partida (base) de cada ruta, para planificar el recorrido sin estar en terreno.
alter table public.rutas
  add column if not exists base_nombre text,
  add column if not exists base_lat double precision,
  add column if not exists base_lng double precision;

-- Base de la "Ruta de prueba": punto ficticio en la Ruta 128, ~11 km (≈15 min en auto) al este del primer cliente.
update public.rutas
   set base_nombre = 'Base de prueba (Ruta 128)', base_lat = -35.9515, base_lng = -72.1980
 where nombre = 'Ruta de prueba' and base_lat is null;
