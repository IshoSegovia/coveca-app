-- Cada usuario creado en Supabase (Authentication → Users) queda registrado como vendedor.
-- El primero en existir queda como administrador activo; los siguientes quedan INACTIVOS
-- hasta que un administrador los active (así nadie entra sin autorización).
create or replace function public.registrar_vendedor() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_primero boolean;
begin
  select not exists (select 1 from public.vendedores) into v_primero;
  insert into public.vendedores (id, nombre, correo, rol, activo)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
          new.email,
          case when v_primero then 'admin' else 'vendedor' end,
          v_primero)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger vendedor_al_crear_usuario after insert on auth.users
  for each row execute function public.registrar_vendedor();

-- Usuarios que ya existían antes de esta migración.
insert into public.vendedores (id, nombre, correo, rol, activo)
select u.id, split_part(u.email, '@', 1), u.email,
       case when row_number() over (order by u.created_at) = 1 and not exists (select 1 from public.vendedores) then 'admin' else 'vendedor' end,
       row_number() over (order by u.created_at) = 1 and not exists (select 1 from public.vendedores)
from auth.users u
on conflict (id) do nothing;
