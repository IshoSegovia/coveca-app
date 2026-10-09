-- Versión vigente de la app. La escribe GitHub Actions al publicar cada APK;
-- la app la consulta al abrir para obligar a actualizar.
insert into public.configuracion (clave, valor) values ('app_version', '{"codigo": 0}'::jsonb)
  on conflict (clave) do nothing;

-- Se puede leer sin sesión (pantalla de ingreso) y solo devuelve esa clave.
create or replace function public.version_app() returns jsonb
language sql stable security definer set search_path = public as $$
  select valor from public.configuracion where clave = 'app_version';
$$;
grant execute on function public.version_app() to anon, authenticated;
