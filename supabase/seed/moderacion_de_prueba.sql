-- =====================================================================
-- Dogder · probar el panel de moderación (solo para desarrollo)
--  1. Te hace moderador (tu cuenta real: la que no es de prueba).
--  2. Crea 3 reportes entre perros de prueba, uno con conversación,
--     para que veas cómo se ven y pruebes Descartar, Advertir y Suspender.
-- Necesita los perros de prueba (perros_de_prueba.sql) y la migración de moderación.
-- Pégalo en Supabase > SQL Editor > New query > Run (puedes repetirlo).
-- =====================================================================

do $$
declare
  yo uuid;
  canela uuid; mariana uuid;
  frijol uuid; lucia uuid;
  tamal  uuid; dueno_tamal uuid;
  m uuid;
begin
  select u.id into yo from auth.users u join perros g on g.dueno_id = u.id
   where u.email not like '%@prueba.dogder.app' order by g.creado desc limit 1;
  if yo is null then raise exception 'No encontré tu cuenta con perro.'; end if;
  insert into moderadores (usuario) values (yo) on conflict do nothing;

  select id, dueno_id into canela, mariana from perros where nombre = 'Canela'
     and dueno_id in (select id from auth.users where email like '%@prueba.dogder.app') limit 1;
  select id, dueno_id into frijol, lucia from perros where nombre = 'Frijol'
     and dueno_id in (select id from auth.users where email like '%@prueba.dogder.app') limit 1;
  select id, dueno_id into tamal, dueno_tamal from perros where nombre = 'Tamal'
     and dueno_id in (select id from auth.users where email like '%@prueba.dogder.app') limit 1;
  if canela is null or frijol is null or tamal is null then
    raise exception 'Faltan los perros de prueba. Ejecuta primero perros_de_prueba.sql.';
  end if;

  -- Conversación entre Canela y Frijol, con mensajes ofensivos de Frijol.
  insert into matches (perro_a, perro_b) values (least(canela, frijol), greatest(canela, frijol))
  on conflict (perro_a, perro_b) do nothing;
  select id into m from matches where perro_a = least(canela, frijol) and perro_b = greatest(canela, frijol);
  delete from mensajes where match_id = m;
  insert into mensajes (match_id, autor_id, texto, creado) values
    (m, mariana, '¡Hola! ¿Paseamos el sábado en el parque?',      now() - interval '50 minutes'),
    (m, lucia,   'Tu perra está fea, no pierdo mi tiempo',         now() - interval '45 minutes'),
    (m, mariana, 'Qué grosero, no hacía falta',                    now() - interval '44 minutes'),
    (m, lucia,   'Mándame tu número y te vendo un cachorro',       now() - interval '40 minutes');

  -- Si lo repites, empieza de cero: borra los reportes de prueba anteriores y quita sanciones.
  delete from reportes where reportador in (mariana, lucia) and reportado in (lucia, dueno_tamal);
  update perfiles set suspendida = null, motivo_suspension = null, advertencia = null where id in (lucia, dueno_tamal);

  insert into reportes (reportador, reportado, motivo, detalles, creado) values
    (mariana, lucia, 'Acoso o mensajes ofensivos', 'Me insultó y luego me quiso vender un cachorro.', now() - interval '30 minutes'),
    (mariana, lucia, 'Venta o cruza de animales',  '',                                                now() - interval '29 minutes'),
    (lucia,   dueno_tamal, 'Perfil falso o spam',  'Las fotos parecen de internet.',                  now() - interval '3 hours');

  raise notice 'Listo: ya eres moderador y hay 3 reportes de prueba.';
end $$;
