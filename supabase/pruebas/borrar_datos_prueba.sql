-- Borra la "Ruta de prueba" y sus clientes ficticios (migración 0009).
-- Uso: pegar en Supabase → SQL Editor → Run.
-- Si se hicieron pedidos de prueba: devuelve su stock (si no estaban anulados)
-- y los borra. Los números de nota usados no se reutilizan.
begin;
create temp table _pedidos_prueba on commit drop as
  select p.id, p.estado from public.pedidos p
  join public.clientes c on c.id = p.cliente_id
  join public.rutas r on r.id = c.ruta_id
  where r.nombre = 'Ruta de prueba';

insert into public.movimientos_stock (producto_id, cantidad, motivo)
  select i.producto_id, i.cantidad, 'anulacion'
  from public.pedido_items i join _pedidos_prueba p on p.id = i.pedido_id
  where p.estado <> 'anulado';

update public.movimientos_stock set pedido_id = null where pedido_id in (select id from _pedidos_prueba);
delete from public.pedidos where id in (select id from _pedidos_prueba);
delete from public.clientes where ruta_id = (select id from public.rutas where nombre = 'Ruta de prueba');
delete from public.rutas where nombre = 'Ruta de prueba';
commit;
