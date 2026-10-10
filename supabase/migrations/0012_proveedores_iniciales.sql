-- Proveedores de COVECA (indicados por Francisco el 9 de octubre de 2026). El resto de sus datos se completa en la app.
insert into public.proveedores (nombre) values
  ('Fruna'),
  ('La Escoba'),
  ('Punto Prat'),
  ('Distribuidora 504'),
  ('Carlos González'),
  ('Importadora Asian Food')
on conflict (nombre) do nothing;
