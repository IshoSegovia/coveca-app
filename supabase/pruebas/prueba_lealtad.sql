-- Prueba del programa de lealtad: compras de 90 días por cliente, semanas con compra y tope del descuento.
\set ON_ERROR_STOP on
insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'jose@coveca.cl');
insert into public.rutas (nombre, dia_semana) values ('Retiro', 1);
insert into public.clientes (nombre, ruta_id, frecuencia_dias) values ('Minimarket Ana', 1, 7), ('Almacén Luis', 1, 14), ('Kiosco Nuevo', 1, 7);
insert into public.productos (ref, nombre, costo, precio) values ('1', 'Producto A', 80000, 100000), ('2', 'Producto B', 4000, 5000);
insert into public.movimientos_stock (producto_id, cantidad, motivo) values (1, 100, 'inicial'), (2, 100, 'inicial');

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

-- Ana: compras en 5 semanas distintas dentro de 90 días + una de hace 120 días (no cuenta) + una anulada (no cuenta)
select count(*) from (
  select public.crear_pedido(jsonb_build_object('id', gen_random_uuid(), 'cliente_id', 1, 'fecha', now() - make_interval(days => d),
         'items', jsonb_build_array(jsonb_build_object('producto_id', 1, 'cantidad', 1))))
  from unnest(array[1, 8, 15, 22, 70, 120]) d) x;
select (public.anular_pedido((select public.crear_pedido(jsonb_build_object('id', gen_random_uuid(), 'cliente_id', 1,
         'items', jsonb_build_array(jsonb_build_object('producto_id', 1, 'cantidad', 5))))).id)).estado as anulada;

-- Luis: una compra hace 75 días (en 30 días deja de contar)
select (public.crear_pedido(jsonb_build_object('id', gen_random_uuid(), 'cliente_id', 2, 'fecha', now() - interval '75 days',
       'items', jsonb_build_array(jsonb_build_object('producto_id', 2, 'cantidad', 10))))).numero > 0 as luis;

select c.nombre, l.monto, l.semanas, l.compras, l.monto_en_30, l.semanas_en_30, l.compro_esta_semana
  from public.lealtad_clientes l join public.clientes c on c.id = l.cliente_id order by c.id;
-- (cliente_id 1-3 son los clientes de prueba de la migración 0009)
-- Esperado: Ana 500000 / 5 semanas / 5 compras / en 30 días 400000 y 4 semanas (sale la de hace 70) / compró esta semana: depende del día (hace 1 día)
--           Luis 50000 / 1 / 1 / 0 / 0 / f ; Kiosco 0 / 0 / 0

-- Descuento de lealtad: pide 3% de $100.000 = $3.000 → se acepta (tope = 3% del nivel más alto)
select subtotal, descuento_lealtad, descuento, total, nivel from public.crear_pedido('{"id":"bbbbbbbb-0000-0000-0000-000000000001","cliente_id":3,
  "nivel":"Platino","descuento_lealtad":3000,"descuento":500,"items":[{"producto_id":1,"cantidad":1}]}');
-- Pide 10% ($10.000) → el servidor lo recorta a $3.000
select subtotal, descuento_lealtad, total from public.crear_pedido('{"id":"bbbbbbbb-0000-0000-0000-000000000002","cliente_id":3,
  "nivel":"Oro","descuento_lealtad":10000,"items":[{"producto_id":1,"cantidad":1}]}');
-- Sin descuento de lealtad (cliente Bronce) → igual que antes
select subtotal, descuento_lealtad, total, nivel from public.crear_pedido('{"id":"bbbbbbbb-0000-0000-0000-000000000003","cliente_id":3,
  "items":[{"producto_id":2,"cantidad":2}]}');
-- Reintento no duplica ni cambia montos
select subtotal, descuento_lealtad, total from public.crear_pedido('{"id":"bbbbbbbb-0000-0000-0000-000000000001","cliente_id":3,"descuento_lealtad":99999,"items":[{"producto_id":1,"cantidad":9}]}');

-- Programa apagado → no se aplica descuento de lealtad
reset role;
update public.configuracion set valor = jsonb_set(valor, '{activo}', 'false') where clave = 'lealtad';
set role authenticated;
select descuento_lealtad, total from public.crear_pedido('{"id":"bbbbbbbb-0000-0000-0000-000000000004","cliente_id":3,
  "descuento_lealtad":2000,"items":[{"producto_id":1,"cantidad":1}]}');
