-- =====================================================================
-- Dogder · quitar Dogder Plus de prueba (solo para desarrollo)
-- Tu cuenta vuelve a ser gratis, para probar los límites. También quita el modo viaje
-- y te devuelve el "deshacer" del día.
-- Pégalo en Supabase > SQL Editor > New query > Run.
-- =====================================================================
update public.perfiles
   set plus_hasta = null, deshacer_usado = null,
       viaje_lat = null, viaje_lng = null, viaje_nombre = null
 where id = (select u.id from auth.users u join public.perros g on g.dueno_id = u.id
              where u.email not like '%@prueba.dogder.app' order by g.creado desc limit 1);
