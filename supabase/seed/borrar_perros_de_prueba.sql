-- =====================================================================
-- Dogder · borrar los perros de prueba
-- Borra los dueños de prueba y, en cascada, sus perros, fotos, likes, matches y mensajes,
-- y quita las respuestas automáticas. Tu cuenta real no se toca.
-- =====================================================================

drop trigger if exists respuesta_de_prueba on public.mensajes;
drop function if exists public.responder_como_prueba();

delete from auth.users where email like '%@prueba.dogder.app';
