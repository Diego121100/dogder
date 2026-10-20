-- =====================================================================
-- Dogder · borrar los perros de prueba
-- Borra los dueños de prueba y, en cascada, sus perros, fotos, likes, matches y mensajes.
-- Tu cuenta real no se toca.
-- =====================================================================

delete from auth.users where email like '%@prueba.dogder.app';
