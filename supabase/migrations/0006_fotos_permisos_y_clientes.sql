-- 1) Corrige la subida de fotos: Storage exige permiso de LECTURA además de escritura
--    (la app comprueba si el archivo existe). Faltaba esa regla.
create policy productos_fotos_leer on storage.objects for select to authenticated
  using (bucket_id = 'productos');
create policy notas_leer on storage.objects for select to authenticated
  using (bucket_id = 'notas');

-- 2) Foto de clientes (ej. frente del local). Cualquier vendedor activo puede agregarla en terreno.
alter table public.clientes add column if not exists imagen_url text;

insert into storage.buckets (id, name, public) values ('clientes', 'clientes', true)
  on conflict (id) do nothing;
create policy clientes_fotos_leer on storage.objects for select to authenticated
  using (bucket_id = 'clientes');
create policy clientes_fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'clientes' and public.es_vendedor());
create policy clientes_fotos_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'clientes' and public.es_vendedor()) with check (bucket_id = 'clientes' and public.es_vendedor());
create policy clientes_fotos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'clientes' and public.es_admin());

-- Los vendedores pueden guardar el enlace de la foto del cliente (solo esa columna; el resto lo edita un admin).
create or replace function public.foto_cliente(p_id bigint, p_url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_vendedor() then raise exception 'Sin permiso'; end if;
  update public.clientes set imagen_url = p_url where id = p_id;
end $$;
grant execute on function public.foto_cliente(bigint, text) to authenticated;

-- La vista de estado debe incluir la nueva columna.
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
