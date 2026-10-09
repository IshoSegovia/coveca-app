-- Perfil de cliente más completo + historial resumido traído de Loyverse.
alter table public.clientes
  add column if not exists notas text,
  add column if not exists loyverse_primera_compra date,
  add column if not exists loyverse_ultima_compra date,
  add column if not exists loyverse_compras integer,
  add column if not exists loyverse_total integer;

alter table public.productos
  add column if not exists descripcion text;

-- La vista de estado considera también la última compra registrada en Loyverse,
-- y se recrea para incluir las columnas nuevas.
drop view if exists public.clientes_estado;
create view public.clientes_estado with (security_invoker = true) as
select c.*,
       r.nombre as ruta_nombre,
       greatest(u.ultima_compra, c.loyverse_ultima_compra) as ultima_compra,
       (u.ultima_compra is not null
        and u.ultima_compra >= (current_date - (c.frecuencia_dias - 1)))::boolean as atendido
from public.clientes c
left join public.rutas r on r.id = c.ruta_id
left join lateral (
  select max(p.fecha)::date as ultima_compra
  from public.pedidos p
  where p.cliente_id = c.id and p.estado <> 'anulado'
) u on true;
