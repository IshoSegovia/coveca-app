-- Programa de lealtad: 4 niveles según lo comprado en los últimos 90 días (monto y semanas con compra).
-- Los niveles se calculan solos a partir de los pedidos; parte desde cero (no usa el historial de Loyverse).
-- Beneficio: descuento automático por nivel (con tope para no bajar del margen mínimo) + beneficios de texto (fiado, ofertas).

-- 1) Reglas del programa (editables por un administrador desde Ajustes > Lealtad)
insert into public.configuracion (clave, valor) values ('lealtad', jsonb_build_object(
  'activo', true,
  'dias', 90,
  'margen_minimo', 0.10,
  'niveles', jsonb_build_array(
    jsonb_build_object('nombre', 'Bronce',  'monto', 0,       'semanas', 0,  'descuento', 0, 'beneficios', 'Acumula compras para subir de nivel'),
    jsonb_build_object('nombre', 'Plata',   'monto', 150000,  'semanas', 4,  'descuento', 1, 'beneficios', 'Fiado hasta 7 días'),
    jsonb_build_object('nombre', 'Oro',     'monto', 400000,  'semanas', 7,  'descuento', 2, 'beneficios', 'Fiado hasta 15 días · Ofertas antes que nadie'),
    jsonb_build_object('nombre', 'Platino', 'monto', 800000,  'semanas', 10, 'descuento', 3, 'beneficios', 'Fiado hasta 30 días · Ofertas antes que nadie')
  )))
on conflict (clave) do nothing;

-- 2) Cada nota guarda el nivel del cliente y el descuento de lealtad aplicado (aparte del descuento puntual)
alter table public.pedidos add column if not exists nivel text;
alter table public.pedidos add column if not exists descuento_lealtad integer not null default 0 check (descuento_lealtad >= 0);

-- 3) Compras de cada cliente en la ventana del programa (y lo que quedará en 30 días, para saber quién está por bajar)
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
       -- lo que seguirá contando dentro de 30 días si no vuelve a comprar
       coalesce(sum(ped.total) filter (where ped.fecha >= now() - make_interval(days => (select dias from cfg) - 30)), 0)::bigint as monto_en_30,
       count(distinct ped.semana) filter (where ped.fecha >= now() - make_interval(days => (select dias from cfg) - 30))::int as semanas_en_30,
       bool_or(ped.semana = date_trunc('week', now() at time zone 'America/Santiago')) is true as compro_esta_semana
from public.clientes c
left join ped on ped.cliente_id = c.id
group by c.id;

grant select on public.lealtad_clientes to authenticated;

-- 4) crear_pedido acepta el nivel y el descuento de lealtad.
--    El servidor pone un tope: el descuento de lealtad no puede superar el % del nivel más alto del programa.
create or replace function public.crear_pedido(p jsonb) returns public.pedidos
language plpgsql security definer set search_path = public as $$
declare
  v_pedido public.pedidos;
  v_item   jsonb;
  v_prod   public.productos;
  v_sub    integer := 0;
  v_desc   integer := greatest(coalesce((p->>'descuento')::integer, 0), 0);
  v_leal   integer := greatest(coalesce((p->>'descuento_lealtad')::integer, 0), 0);
  v_max    numeric;
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
                              descuento, descuento_lealtad, nivel, terminal, creado_sin_senal)
  values ((p->>'id')::uuid, nextval('public.nota_numero_seq'), (p->>'cliente_id')::bigint, auth.uid(),
          nullif(p->>'ruta_id', '')::bigint, coalesce((p->>'fecha')::timestamptz, now()),
          coalesce(p->>'forma_pago', 'efectivo'), v_desc, 0, nullif(p->>'nivel', ''), p->>'terminal',
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

  -- Tope del descuento de lealtad: % del nivel más alto configurado (0 si el programa está apagado)
  select case when coalesce((valor->>'activo')::boolean, false)
              then coalesce(max((n->>'descuento')::numeric), 0) else 0 end
    into v_max
    from public.configuracion, jsonb_array_elements(valor->'niveles') n
   where clave = 'lealtad' group by valor;
  v_leal := least(v_leal, floor(v_sub * coalesce(v_max, 0) / 100)::integer);

  update public.pedidos
     set subtotal = v_sub, descuento_lealtad = v_leal,
         total = greatest(v_sub - v_leal - v_desc, 0)
   where id = v_pedido.id returning * into v_pedido;
  return v_pedido;
end $$;
