-- Datos de prueba: "Ruta de prueba" con 5 clientes ficticios en Cauquenes,
-- con todos sus datos y GPS, para probar "Planificar recorrido" en terreno.
-- Todo es inventado (nombres, RUT, teléfonos, correos). Se puede borrar después
-- con supabase/pruebas/borrar_datos_prueba.sql.
-- No duplica: si un cliente ya existe en la ruta de prueba, no se vuelve a crear.

insert into public.rutas (nombre, dia_semana, orden, activa)
values ('Ruta de prueba', null, 99, true)
on conflict (nombre) do nothing;

with r as (select id from public.rutas where nombre = 'Ruta de prueba'),
datos (nombre, razon_social, rut, contacto, direccion, comuna, lat, lng, telefono, correo, orden_ruta, notas) as (
  values
  ('Almacén Prueba Uno',      'Comercial Prueba Uno SpA',  '76.111.111-6', 'Ana Prueba',    'Victoria 450',          'Cauquenes', -35.9688, -72.3205, '+56911111101', 'prueba1@example.com', 1, 'Cliente de prueba. Abre 9:00 a 20:00.'),
  ('Minimarket Prueba Dos',   'Distribuidora Prueba Dos Ltda.', '76.222.222-1', 'Bruno Prueba', 'Balmaceda 820',      'Cauquenes', -35.9612, -72.3138, '+56911111102', 'prueba2@example.com', 2, 'Cliente de prueba. Pide de preferencia los martes.'),
  ('Botillería Prueba Tres',  'Botillería Prueba Tres SpA', '76.333.333-7', 'Carla Prueba',  'Claudina Urrutia 1250', 'Cauquenes', -35.9762, -72.3318, '+56911111103', 'prueba3@example.com', 3, 'Cliente de prueba. Estacionar en la esquina.'),
  ('Almacén Prueba Cuatro',   'Diego Prueba Soto',          '15.444.444-0', 'Diego Prueba',  'Avenida Estación 300',  'Cauquenes', -35.9571, -72.3296, '+56911111104', 'prueba4@example.com', 4, 'Cliente de prueba. Paga con transferencia.'),
  ('Kiosco Prueba Cinco',     'Elena Prueba Rojas',         '16.555.555-4', 'Elena Prueba',  'Camino a Chanco km 2',  'Cauquenes', -35.9805, -72.3462, '+56911111105', 'prueba5@example.com', 5, 'Cliente de prueba. Queda a la salida de la ciudad.')
)
insert into public.clientes
  (nombre, razon_social, rut, contacto, direccion, comuna, lat, lng, telefono, correo,
   ruta_id, frecuencia_dias, orden_ruta, limite_credito, activo, notas, ubicacion_actualizada_en)
select d.nombre, d.razon_social, d.rut, d.contacto, d.direccion, d.comuna, d.lat, d.lng, d.telefono, d.correo,
       r.id, 7, d.orden_ruta, 100000, true, d.notas, now()
from datos d cross join r
where not exists (
  select 1 from public.clientes c where c.ruta_id = r.id and c.nombre = d.nombre
);
