-- =====================================================================
-- Dogder · reiniciar la prueba con los perros de prueba (solo para desarrollo)
--  * Los 9 perros de prueba le dan "me gusta" a tu perro: cualquier "me gusta" tuyo será match.
--  * Borra lo que ya deslizaste sobre ellos, para que vuelvan a aparecer en Descubrir.
--  * Borra tus matches y chats con ellos, para empezar de cero.
--  * Te devuelve tus súper huesos y tu "deshacer" del día.
--  (Necesita la migración de Dogder Plus.)
-- Tu cuenta y tu perro no se tocan. Pégalo en Supabase > SQL Editor > New query > Run.
-- =====================================================================

do $$
declare
  mi_perro uuid;
  pruebas uuid[];
begin
  select g.id into mi_perro
    from perros g join auth.users u on u.id = g.dueno_id
   where u.email not like '%@prueba.dogder.app'
   order by g.creado desc limit 1;
  if mi_perro is null then raise exception 'No encontramos tu perro. Primero termina el registro en la app.'; end if;

  select array_agg(p.id) into pruebas
    from perros p join auth.users u on u.id = p.dueno_id
   where u.email like '%@prueba.dogder.app';
  if pruebas is null then raise exception 'No hay perros de prueba. Primero ejecuta perros_de_prueba.sql.'; end if;

  delete from matches where (perro_a = mi_perro and perro_b = any (pruebas)) or (perro_b = mi_perro and perro_a = any (pruebas));
  delete from likes where de_perro = mi_perro and a_perro = any (pruebas);
  insert into likes (de_perro, a_perro, tipo)
  select unnest(pruebas), mi_perro, 'like'
  on conflict (de_perro, a_perro) do update set tipo = 'like';

  update perfiles set super_hueso_usado = null, deshacer_usado = null
   where id = (select dueno_id from perros where id = mi_perro);

  raise notice 'Listo: los % perros de prueba ya le dieron me gusta a tu perro.', array_length(pruebas, 1);
end $$;
