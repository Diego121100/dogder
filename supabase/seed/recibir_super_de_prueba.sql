-- =====================================================================
-- Dogder · recibir un súper hueso de prueba (solo para desarrollo)
-- Un perro de prueba que todavía no has deslizado le manda un súper hueso a tu perro.
-- Con la app abierta en Descubrir verás "¡… te mandó un súper hueso!" al instante.
-- Pégalo en Supabase > SQL Editor > New query > Run (puedes repetirlo).
-- =====================================================================

do $$
declare
  mi_perro uuid;
  de uuid;
  nombre text;
begin
  select g.id into mi_perro
    from perros g join auth.users u on u.id = g.dueno_id
   where u.email not like '%@prueba.dogder.app'
   order by g.creado desc limit 1;

  select p.id, p.nombre into de, nombre
    from perros p join auth.users u on u.id = p.dueno_id
   where u.email like '%@prueba.dogder.app'
     and not exists (select 1 from likes l where l.de_perro = mi_perro and l.a_perro = p.id)
     and not exists (select 1 from likes l where l.de_perro = p.id and l.a_perro = mi_perro and l.tipo = 'super')
   order by random() limit 1;

  if de is null then
    raise exception 'No quedan perros de prueba sin deslizar. Ejecuta reiniciar_pruebas.sql y vuelve a intentarlo.';
  end if;

  insert into likes (de_perro, a_perro, tipo) values (de, mi_perro, 'super')
  on conflict (de_perro, a_perro) do update set tipo = 'super', creado = now();

  raise notice '% le mandó un súper hueso a tu perro.', nombre;
end $$;
