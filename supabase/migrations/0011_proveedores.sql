-- Proveedores y proveedor de cada producto (para enviarles pedidos/listas en el futuro).
create table if not exists public.proveedores (
  id         bigint generated always as identity primary key,
  nombre     text not null unique,
  rut        text,
  contacto   text,
  telefono   text,          -- WhatsApp
  correo     text,
  notas      text,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

alter table public.productos
  add column if not exists proveedor_id bigint references public.proveedores(id) on delete set null;
create index if not exists productos_proveedor_idx on public.productos (proveedor_id);

alter table public.proveedores enable row level security;
create policy proveedores_leer on public.proveedores for select to authenticated using (public.es_vendedor());
create policy proveedores_admin on public.proveedores for all to authenticated using (public.es_admin()) with check (public.es_admin());
