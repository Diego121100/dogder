-- =====================================================================
-- Dogder · Matches muestra si hubo súper hueso
--  * super_recibido: el otro perro te mandó un súper hueso.
--  * super_enviado: tú le mandaste un súper hueso.
-- Pégala en Supabase > SQL Editor > New query > Run.
-- =====================================================================

drop function if exists public.mis_matches();

create function public.mis_matches()
returns table (match_id uuid, perro_id uuid, nombre text, dueno_nombre text, colonia text, foto text,
               ultimo_texto text, ultimo_autor uuid, ultimo_creado timestamptz, creado timestamptz,
               sin_leer int, visto boolean, super_recibido boolean, super_enviado boolean)
language sql stable security definer set search_path = public as $$
  select m.id, p.id, p.nombre, d.nombre, d.colonia,
         (select ruta from fotos f where f.perro_id = p.id order by orden limit 1),
         u.texto, u.autor_id, u.creado, m.creado,
         (select count(*)::int from mensajes x
           where x.match_id = m.id and x.autor_id <> auth.uid()
             and x.creado > coalesce(l.leido_hasta, '-infinity')),
         l.match_id is not null,
         exists (select 1 from likes k where k.de_perro = p.id and k.a_perro = mi_perro() and k.tipo = 'super'),
         exists (select 1 from likes k where k.de_perro = mi_perro() and k.a_perro = p.id and k.tipo = 'super')
    from matches m
    join perros p on p.id = case when m.perro_a = mi_perro() then m.perro_b else m.perro_a end
    join perfiles d on d.id = p.dueno_id
    left join match_lecturas l on l.match_id = m.id and l.usuario = auth.uid()
    left join lateral (select texto, autor_id, creado from mensajes x
                        where x.match_id = m.id order by creado desc limit 1) u on true
   where mi_perro() in (m.perro_a, m.perro_b)
     and not hay_bloqueo(auth.uid(), d.id)
   order by coalesce(u.creado, m.creado) desc
$$;

revoke execute on function public.mis_matches() from public, anon;
grant execute on function public.mis_matches() to authenticated;
