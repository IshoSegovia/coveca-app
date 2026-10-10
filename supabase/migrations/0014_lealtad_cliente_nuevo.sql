-- Lealtad: "Cliente nuevo" (sin rango) para quien nunca ha comprado.
-- Todo cliente con al menos una compra, en Loyverse (historial importado) o en la app, queda como mínimo en el primer nivel (Bronce).
-- Los niveles superiores se siguen calculando solo con las compras de la app de los últimos 90 días.
create or replace view public.lealtad_clientes with (security_invoker = true) as
with cfg as (
  select coalesce((valor->>'dias')::int, 90) as dias from public.configuracion where clave = 'lealtad'
), ped as (
  select p.cliente_id, p.total, p.fecha,
         date_trunc('week', p.fecha at time zone 'America/Santiago') as semana
  from public.pedidos p, cfg
  where p.estado <> 'anulado' and p.fecha >= now() - make_interval(days => cfg.dias)
)
select c.id as cliente_id,
       coalesce(sum(ped.total), 0)::bigint as monto,
       count(distinct ped.semana)::int as semanas,
       count(ped.*)::int as compras,
       coalesce(sum(ped.total) filter (where ped.fecha >= now() - make_interval(days => (select dias from cfg) - 30)), 0)::bigint as monto_en_30,
       count(distinct ped.semana) filter (where ped.fecha >= now() - make_interval(days => (select dias from cfg) - 30))::int as semanas_en_30,
       bool_or(ped.semana = date_trunc('week', now() at time zone 'America/Santiago')) is true as compro_esta_semana,
       -- ¿Compró alguna vez? (historial de Loyverse o cualquier nota no anulada de la app)
       (coalesce(c.loyverse_compras, 0) > 0
        or exists (select 1 from public.pedidos p2 where p2.cliente_id = c.id and p2.estado <> 'anulado')) as alguna_compra
from public.clientes c
left join ped on ped.cliente_id = c.id
group by c.id;
