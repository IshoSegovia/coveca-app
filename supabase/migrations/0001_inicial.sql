-- =====================================================================
-- COVECA – Esquema inicial (Etapa 1)
-- Montos en CLP enteros. Margen sobre precio de venta: precio = costo / (1 - margen).
-- =====================================================================

-- ---------- Vendedores (usuarios de la app) ----------
create table public.vendedores (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  correo      text,
  rol         text not null default 'vendedor' check (rol in ('admin', 'vendedor')),
  terminal    text not null default 'Movil 1',
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- ¿El usuario conectado es un vendedor activo? ¿Es administrador?
create or replace function public.es_vendedor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vendedores where id = auth.uid() and activo);
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vendedores where id = auth.uid() and activo and rol = 'admin');
$$;

-- ---------- Catálogo ----------
create table public.categorias (
  id      bigint generated always as identity primary key,
  nombre  text not null unique
);

create table public.productos (
  id             bigint generated always as identity primary key,
  ref            text unique,                         -- REF de Loyverse / código interno
  nombre         text not null,
  categoria_id   bigint references public.categorias(id),
  costo          integer not null default 0 check (costo >= 0),
  precio         integer not null default 0 check (precio >= 0),
  codigo_barras  text,
  stock          integer not null default 0,
  stock_minimo   integer,
  activo         boolean not null default true,
  actualizado_en timestamptz not null default now()
);
create index productos_nombre_idx on public.productos (lower(nombre));

-- Margen real sobre precio de venta (0,20 = 20 %).
create or replace function public.margen(costo integer, precio integer) returns numeric
language sql immutable as $$
  select case when precio > 0 then round((precio - costo)::numeric / precio, 4) end;
$$;

-- Precio sugerido para un margen: costo / (1 - margen), redondeado a peso.
create or replace function public.precio_con_margen(costo integer, margen numeric) returns integer
language sql immutable as $$
  select case when margen < 1 then round(costo / (1 - margen))::integer end;
$$;

-- ---------- Rutas y clientes ----------
create table public.rutas (
  id          bigint generated always as identity primary key,
  nombre      text not null unique,                  -- ej. "Retiro"
  dia_semana  smallint check (dia_semana between 1 and 7),  -- 1 = lunes
  orden       smallint not null default 0,
  activa      boolean not null default true
);

create table public.clientes (
  id              bigint generated always as identity primary key,
  nombre          text not null,                     -- nombre visible (fantasía o persona)
  razon_social    text,
  rut             text,
  contacto        text,
  direccion       text,
  comuna          text,
  lat             double precision,
  lng             double precision,
  telefono        text,
  correo          text,
  ruta_id         bigint references public.rutas(id),
  frecuencia_dias smallint not null default 7 check (frecuencia_dias > 0),
  orden_ruta      smallint not null default 0,
  limite_credito  integer not null default 0,
  activo          boolean not null default true,
  loyverse_id     text unique,
  creado_en       timestamptz not null default now()
);
create index clientes_ruta_idx on public.clientes (ruta_id);

-- ---------- Pedidos / notas de venta ----------
create sequence public.nota_numero_seq start 1;

create table public.pedidos (
  id               uuid primary key,                   -- lo genera el celular (permite reintentar sin duplicar)
  numero           bigint unique,                      -- N° de nota, lo asigna el servidor
  cliente_id       bigint not null references public.clientes(id),
  vendedor_id      uuid not null references public.vendedores(id),
  ruta_id          bigint references public.rutas(id),
  fecha            timestamptz not null default now(), -- momento en que se tomó el pedido
  estado           text not null default 'generado' check (estado in ('generado', 'entregado', 'anulado')),
  forma_pago       text not null default 'efectivo' check (forma_pago in ('efectivo', 'transferencia', 'credito')),
  subtotal         integer not null default 0,
  descuento        integer not null default 0,
  total            integer not null default 0,
  imagen_url       text,                               -- imagen de la nota (para el QR)
  terminal         text,
  creado_sin_senal boolean not null default false,
  recibido_en      timestamptz not null default now()
);
create index pedidos_cliente_idx on public.pedidos (cliente_id, fecha desc);
create index pedidos_fecha_idx on public.pedidos (fecha);

create table public.pedido_items (
  id           bigint generated always as identity primary key,
  pedido_id    uuid not null references public.pedidos(id) on delete cascade,
  producto_id  bigint not null references public.productos(id),
  nombre       text not null,          -- copia del nombre al momento de la venta
  cantidad     integer not null check (cantidad > 0),
  precio       integer not null,       -- precio unitario cobrado
  costo        integer not null default 0,
  subtotal     integer not null
);
create index pedido_items_pedido_idx on public.pedido_items (pedido_id);

-- ---------- Movimientos de stock (historial de entradas y salidas) ----------
create table public.movimientos_stock (
  id           bigint generated always as identity primary key,
  producto_id  bigint not null references public.productos(id),
  cantidad     integer not null,       -- negativo = sale, positivo = entra
  motivo       text not null check (motivo in ('venta', 'anulacion', 'compra', 'ajuste', 'inicial')),
  pedido_id    uuid references public.pedidos(id),
  usuario_id   uuid default auth.uid(),
  creado_en    timestamptz not null default now()
);
create index movimientos_producto_idx on public.movimientos_stock (producto_id, creado_en);

-- Cada movimiento actualiza el stock del producto.
create or replace function public.aplicar_movimiento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.productos set stock = stock + new.cantidad, actualizado_en = now()
   where id = new.producto_id;
  return new;
end $$;
create trigger movimientos_aplicar after insert on public.movimientos_stock
  for each row execute function public.aplicar_movimiento();

-- ---------- Configuración (datos de la nota, etc.) ----------
create table public.configuracion (
  clave  text primary key,
  valor  jsonb not null
);
insert into public.configuracion (clave, valor) values
  ('negocio', jsonb_build_object(
     'nombre', 'COVECA',
     'eslogan', 'Su comercializadora de confianza',
     'telefono', '+56 9 7587 0827',
     'leyenda', 'Este documento no representa una factura, solo es una nota de venta y guía de despacho.',
     'transferencia', '[]'::jsonb));

-- =====================================================================
-- Crear pedido (una sola operación, se puede reintentar sin duplicar)
-- p: { id, cliente_id, ruta_id, fecha, forma_pago, descuento, terminal, sin_senal,
--      items: [{ producto_id, cantidad, precio }] }
-- Devuelve el pedido con su número de nota.
-- =====================================================================
create or replace function public.crear_pedido(p jsonb) returns public.pedidos
language plpgsql security definer set search_path = public as $$
declare
  v_pedido public.pedidos;
  v_item   jsonb;
  v_prod   public.productos;
  v_sub    integer := 0;
  v_desc   integer := coalesce((p->>'descuento')::integer, 0);
begin
  if not public.es_vendedor() then
    raise exception 'Usuario sin permiso para crear pedidos';
  end if;

  -- Reintento: si ya existe, se devuelve tal cual.
  select * into v_pedido from public.pedidos where id = (p->>'id')::uuid;
  if found then return v_pedido; end if;

  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then
    raise exception 'El pedido no tiene productos';
  end if;

  insert into public.pedidos (id, numero, cliente_id, vendedor_id, ruta_id, fecha, forma_pago,
                              descuento, terminal, creado_sin_senal)
  values ((p->>'id')::uuid, nextval('public.nota_numero_seq'), (p->>'cliente_id')::bigint, auth.uid(),
          nullif(p->>'ruta_id', '')::bigint, coalesce((p->>'fecha')::timestamptz, now()),
          coalesce(p->>'forma_pago', 'efectivo'), v_desc, p->>'terminal',
          coalesce((p->>'sin_senal')::boolean, false))
  returning * into v_pedido;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    select * into v_prod from public.productos where id = (v_item->>'producto_id')::bigint;
    if not found then raise exception 'Producto % no existe', v_item->>'producto_id'; end if;
    insert into public.pedido_items (pedido_id, producto_id, nombre, cantidad, precio, costo, subtotal)
    values (v_pedido.id, v_prod.id, v_prod.nombre, (v_item->>'cantidad')::integer,
            coalesce((v_item->>'precio')::integer, v_prod.precio), v_prod.costo,
            (v_item->>'cantidad')::integer * coalesce((v_item->>'precio')::integer, v_prod.precio));
    insert into public.movimientos_stock (producto_id, cantidad, motivo, pedido_id)
    values (v_prod.id, -(v_item->>'cantidad')::integer, 'venta', v_pedido.id);
  end loop;

  select coalesce(sum(subtotal), 0) into v_sub from public.pedido_items where pedido_id = v_pedido.id;
  update public.pedidos set subtotal = v_sub, total = greatest(v_sub - v_desc, 0)
   where id = v_pedido.id returning * into v_pedido;
  return v_pedido;
end $$;

-- Anular pedido: devuelve el stock.
create or replace function public.anular_pedido(p_id uuid) returns public.pedidos
language plpgsql security definer set search_path = public as $$
declare v_pedido public.pedidos;
begin
  if not public.es_vendedor() then raise exception 'Sin permiso'; end if;
  select * into v_pedido from public.pedidos where id = p_id for update;
  if not found then raise exception 'Pedido no existe'; end if;
  if v_pedido.estado = 'anulado' then return v_pedido; end if;
  insert into public.movimientos_stock (producto_id, cantidad, motivo, pedido_id)
  select producto_id, cantidad, 'anulacion', pedido_id from public.pedido_items where pedido_id = p_id;
  update public.pedidos set estado = 'anulado' where id = p_id returning * into v_pedido;
  return v_pedido;
end $$;

-- =====================================================================
-- Vistas para la app
-- =====================================================================

-- Clientes con su estado en el ciclo de visita actual.
create or replace view public.clientes_estado with (security_invoker = true) as
select c.*,
       r.nombre as ruta_nombre,
       u.ultima_compra,
       (u.ultima_compra is not null
        and u.ultima_compra >= (current_date - (c.frecuencia_dias - 1)))::boolean as atendido
from public.clientes c
left join public.rutas r on r.id = c.ruta_id
left join lateral (
  select max(p.fecha)::date as ultima_compra
  from public.pedidos p
  where p.cliente_id = c.id and p.estado <> 'anulado'
) u on true;

-- Reporte de carga para bodega: cuánto de cada producto por ruta y día.
create or replace view public.reporte_carga with (security_invoker = true) as
select p.ruta_id, r.nombre as ruta, (p.fecha at time zone 'America/Santiago')::date as dia,
       i.producto_id, pr.ref, i.nombre as producto,
       sum(i.cantidad)::integer as cantidad, count(distinct p.id)::integer as pedidos
from public.pedidos p
join public.pedido_items i on i.pedido_id = p.id
join public.productos pr on pr.id = i.producto_id
left join public.rutas r on r.id = p.ruta_id
where p.estado = 'generado'
group by p.ruta_id, r.nombre, dia, i.producto_id, pr.ref, i.nombre;

-- =====================================================================
-- Seguridad (RLS): solo vendedores activos leen; solo admin modifica catálogo.
-- Los pedidos se crean/anulan solo con las funciones de arriba.
-- =====================================================================
alter table public.vendedores        enable row level security;
alter table public.categorias        enable row level security;
alter table public.productos         enable row level security;
alter table public.rutas             enable row level security;
alter table public.clientes          enable row level security;
alter table public.pedidos           enable row level security;
alter table public.pedido_items      enable row level security;
alter table public.movimientos_stock enable row level security;
alter table public.configuracion     enable row level security;

create policy vendedores_leer on public.vendedores for select to authenticated using (id = auth.uid() or public.es_admin());
create policy vendedores_admin on public.vendedores for all to authenticated using (public.es_admin()) with check (public.es_admin());

do $$
declare t text;
begin
  foreach t in array array['categorias', 'productos', 'rutas', 'clientes', 'configuracion'] loop
    execute format('create policy %1$s_leer on public.%1$s for select to authenticated using (public.es_vendedor())', t);
    execute format('create policy %1$s_admin on public.%1$s for all to authenticated using (public.es_admin()) with check (public.es_admin())', t);
  end loop;
  foreach t in array array['pedidos', 'pedido_items', 'movimientos_stock'] loop
    execute format('create policy %1$s_leer on public.%1$s for select to authenticated using (public.es_vendedor())', t);
  end loop;
end $$;

-- Ajustes manuales de stock y compras: solo admin.
create policy movimientos_admin on public.movimientos_stock for insert to authenticated with check (public.es_admin());
-- El vendedor puede guardar el enlace a la imagen de su nota.
create policy pedidos_imagen on public.pedidos for update to authenticated
  using (public.es_vendedor()) with check (public.es_vendedor());

grant execute on function public.crear_pedido(jsonb), public.anular_pedido(uuid),
  public.es_vendedor(), public.es_admin(), public.margen(integer, integer),
  public.precio_con_margen(integer, numeric) to authenticated;
revoke execute on function public.crear_pedido(jsonb), public.anular_pedido(uuid) from anon, public;

-- =====================================================================
-- Imágenes de notas (para el QR): lectura pública por enlace, subida solo vendedores.
-- =====================================================================
insert into storage.buckets (id, name, public) values ('notas', 'notas', true)
  on conflict (id) do nothing;
create policy notas_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'notas' and public.es_vendedor());
