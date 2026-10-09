-- Socios de COVECA: ambos administradores activos.
update public.vendedores set rol = 'admin', activo = true, nombre = 'Jose Daniel', terminal = 'Movil 1'
 where lower(correo) = 'coveca.cl@gmail.com';
update public.vendedores set rol = 'admin', activo = true, nombre = 'Francisco', terminal = 'Movil 2'
 where lower(correo) = 'segoviaisho@gmail.com';
-- Comprobación: si alguno no existe, la migración falla y avisa.
do $$ begin
  if (select count(*) from public.vendedores where lower(correo) in ('coveca.cl@gmail.com', 'segoviaisho@gmail.com') and rol = 'admin' and activo) <> 2 then
    raise exception 'No se encontraron los 2 usuarios socios en vendedores';
  end if;
end $$;
