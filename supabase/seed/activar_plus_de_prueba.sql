-- =====================================================================
-- Dogder · activar Dogder Plus de prueba (solo para desarrollo)
-- Le da 30 días de Plus a tu cuenta real (la que no es de prueba), sin cobrar.
-- Para volver a la cuenta gratis, ejecuta quitar_plus_de_prueba.sql.
-- Pégalo en Supabase > SQL Editor > New query > Run.
-- =====================================================================
update public.perfiles
   set plus_hasta = now() + interval '30 days'
 where id = (select u.id from auth.users u join public.perros g on g.dueno_id = u.id
              where u.email not like '%@prueba.dogder.app' order by g.creado desc limit 1);
