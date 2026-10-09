-- Prueba de punta a punta: vendedor, catálogo, pedido, stock, reintento, anulación, vistas, margen.
\set ON_ERROR_STOP on
insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'jose@coveca.cl'),
                              ('22222222-2222-2222-2222-222222222222', 'intruso@x.cl');
insert into public.vendedores (id, nombre, rol) values ('11111111-1111-1111-1111-111111111111', 'Jose Daniel', 'admin');
insert into public.rutas (nombre, dia_semana) values ('Retiro', 1);
insert into public.clientes (nombre, ruta_id, frecuencia_dias) values ('Minimarket Ana', 1, 7), ('Almacén Luis', 1, 14);
insert into public.productos (ref, nombre, costo, precio) values ('10058', 'Afeitadora Gillette 3 Blue x10', 8250, 9900),
                                                                ('20001', 'Alfajor Panchote', 4800, 6000);
insert into public.movimientos_stock (producto_id, cantidad, motivo) values (1, 10, 'inicial'), (2, 20, 'inicial');

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

select numero, total, estado from public.crear_pedido('{"id":"aaaaaaaa-0000-0000-0000-000000000001","cliente_id":1,"ruta_id":1,"forma_pago":"efectivo",
  "items":[{"producto_id":1,"cantidad":2},{"producto_id":2,"cantidad":3}]}');
-- reintento (mismo id) no duplica:
select numero, total from public.crear_pedido('{"id":"aaaaaaaa-0000-0000-0000-000000000001","cliente_id":1,"items":[{"producto_id":1,"cantidad":2}]}');
select numero, total from public.crear_pedido('{"id":"aaaaaaaa-0000-0000-0000-000000000002","cliente_id":2,"ruta_id":1,"descuento":1000,
  "items":[{"producto_id":2,"cantidad":1}]}');
select id, nombre, stock from public.productos order by id;
select nombre, atendido, ultima_compra from public.clientes_estado order by id;
select ruta, producto, cantidad, pedidos from public.reporte_carga order by producto;
select estado from public.anular_pedido('aaaaaaaa-0000-0000-0000-000000000002');
select id, stock from public.productos order by id;
select public.margen(8250, 9900) as margen_gillette, public.precio_con_margen(1000, 0.20) as precio_1000_al_20;

-- intruso (no es vendedor): no ve nada y no puede crear pedidos
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select count(*) as productos_visibles_intruso from public.productos;
\set ON_ERROR_STOP off
select public.crear_pedido('{"id":"aaaaaaaa-0000-0000-0000-000000000003","cliente_id":1,"items":[{"producto_id":1,"cantidad":1}]}');
