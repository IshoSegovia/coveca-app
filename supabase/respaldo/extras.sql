-- Genera el SQL de lo que pg_dump --schema=public no copia porque vive en otros esquemas:
-- los disparadores sobre auth.users (alta automática de vendedores) y las reglas (RLS) de storage.objects.
-- Lo usa .github/workflows/respaldo.yml; el resultado va como extras.sql dentro del respaldo.
set search_path = '';  -- así los nombres salen con su esquema (public.…)
select '-- Disparadores sobre auth.users y reglas de Storage (respaldo COVECA)';
select pg_get_triggerdef(t.oid) || ';'
from pg_trigger t join pg_proc f on f.oid = t.tgfoid
where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
  and f.pronamespace = 'public'::regnamespace;
select format('drop policy if exists %I on storage.objects; create policy %I on storage.objects as %s for %s to %s%s%s;',
              policyname, policyname, permissive, cmd, array_to_string(roles, ', '),
              coalesce(' using (' || qual || ')', ''), coalesce(' with check (' || with_check || ')', ''))
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
