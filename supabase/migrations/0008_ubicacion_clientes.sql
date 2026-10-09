-- Ubicación GPS de clientes (lat/lng ya existían). Cualquier vendedor activo puede fijarla
-- en terreno; se registra cuándo y quién la tomó.
alter table public.clientes
  add column if not exists ubicacion_actualizada_en timestamptz,
  add column if not exists ubicacion_por uuid references public.vendedores(id);

create or replace function public.ubicacion_cliente(p_id bigint, p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_vendedor() then raise exception 'Sin permiso'; end if;
  if p_lat is not null and (p_lat not between -56 and -17 or p_lng not between -110 and -66) then
    raise exception 'La ubicación no está en Chile. Revisa las coordenadas.';
  end if;
  update public.clientes
     set lat = p_lat, lng = p_lng,
         ubicacion_actualizada_en = case when p_lat is null then null else now() end,
         ubicacion_por = case when p_lat is null then null else auth.uid() end
   where id = p_id;
end $$;
grant execute on function public.ubicacion_cliente(bigint, double precision, double precision) to authenticated;

-- Guardar el orden de visita de una ruta (lista de ids en orden). Solo administradores.
create or replace function public.ordenar_ruta(p_ids bigint[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso'; end if;
  update public.clientes c set orden_ruta = o.pos
    from unnest(p_ids) with ordinality as o(id, pos)
   where c.id = o.id;
end $$;
grant execute on function public.ordenar_ruta(bigint[]) to authenticated;

-- La vista de estado debe incluir las nuevas columnas.
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
