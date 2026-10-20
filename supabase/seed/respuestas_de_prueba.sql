-- =====================================================================
-- Dogder · respuestas automáticas de los perros de prueba (solo para desarrollo)
-- Cuando le escribes a un dueño de prueba, contesta solo un segundo después.
-- Así puedes probar el chat sin otra cuenta. Las cuentas reales no se ven afectadas.
-- Pégalo en Supabase > SQL Editor > New query > Run.
-- Se quita con borrar_perros_de_prueba.sql.
-- =====================================================================

create or replace function public.responder_como_prueba()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  otro uuid;
  otro_email text;
  autor_email text;
  ya int;
  respuestas text[] := array[
    '¡Hola! 🐾 Qué gusto el match, a mi perro le encantan los nuevos amigos.',
    '¿Qué tal si se conocen este fin de semana en el parque?',
    'Nosotros salimos casi siempre en la mañana, como a las 9.',
    '¡Perfecto! Llevamos pelota extra, siempre pierde una 😅',
    'Nos vemos ahí entonces. ¡Que tengas buen día!'
  ];
begin
  select email into autor_email from auth.users where id = new.autor_id;
  if autor_email like '%@prueba.dogder.app' then return new; end if;  -- no se contesta a sí mismo

  -- El otro dueño del match.
  select p.dueno_id into otro
    from matches m join perros p on p.id in (m.perro_a, m.perro_b)
   where m.id = new.match_id and p.dueno_id <> new.autor_id;
  select email into otro_email from auth.users where id = otro;
  if otro_email is null or otro_email not like '%@prueba.dogder.app' then return new; end if;

  select count(*) into ya from mensajes where match_id = new.match_id and autor_id = otro;
  insert into mensajes (match_id, autor_id, texto, creado)
  values (new.match_id, otro, respuestas[1 + (ya % array_length(respuestas, 1))], clock_timestamp() + interval '1 second');
  return new;
end $$;

drop trigger if exists respuesta_de_prueba on public.mensajes;
create trigger respuesta_de_prueba after insert on public.mensajes
  for each row execute function public.responder_como_prueba();
