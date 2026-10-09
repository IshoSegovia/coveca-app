-- Fotos de productos: se guardan en Storage (carpeta pública "productos") y el enlace en productos.imagen_url.
alter table public.productos add column if not exists imagen_url text;

insert into storage.buckets (id, name, public) values ('productos', 'productos', true)
  on conflict (id) do nothing;

-- Solo administradores suben, reemplazan o borran fotos; cualquiera con el enlace puede verlas.
create policy productos_fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'productos' and public.es_admin());
create policy productos_fotos_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'productos' and public.es_admin()) with check (bucket_id = 'productos' and public.es_admin());
create policy productos_fotos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'productos' and public.es_admin());
