-- =====================================================================
-- Dogder · chat: mensajes leídos y matches en tiempo real
-- Pégala completa en Supabase > SQL Editor > New query > Run.
-- =====================================================================

-- Hasta dónde leyó cada persona cada conversación (para el punto de "sin leer").
create table public.match_lecturas (
  match_id     uuid not null references public.matches (id) on delete cascade,
  usuario      uuid not null references public.perfiles (id) on delete cascade,
  leido_hasta  timestamptz not null default now(),
  primary key (match_id, usuario)
);
alter table public.match_lecturas enable row level security;
create policy "ver mis lecturas" on public.match_lecturas for select to authenticated using (usuario = auth.uid());

-- Marca una conversación como leída hasta este momento.
create function public.marcar_leido(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not soy_parte_del_match(p_match) then return; end if;
  insert into match_lecturas (match_id, usuario, leido_hasta) values (p_match, auth.uid(), now())
  on conflict (match_id, usuario) do update set leido_hasta = now();
end $$;

-- mis_matches ahora también dice cuántos mensajes sin leer hay en cada conversación.
drop function if exists public.mis_matches();

create function public.mis_matches()
returns table (match_id uuid, perro_id uuid, nombre text, dueno_nombre text, colonia text, foto text,
               ultimo_texto text, ultimo_autor uuid, ultimo_creado timestamptz, creado timestamptz, sin_leer int)
language sql stable security definer set search_path = public as $$
  select m.id, p.id, p.nombre, d.nombre, d.colonia,
         (select ruta from fotos f where f.perro_id = p.id order by orden limit 1),
         u.texto, u.autor_id, u.creado, m.creado,
         (select count(*)::int from mensajes x
           where x.match_id = m.id and x.autor_id <> auth.uid()
             and x.creado > coalesce((select leido_hasta from match_lecturas l
                                       where l.match_id = m.id and l.usuario = auth.uid()), '-infinity'))
    from matches m
    join perros p on p.id = case when m.perro_a = mi_perro() then m.perro_b else m.perro_a end
    join perfiles d on d.id = p.dueno_id
    left join lateral (select texto, autor_id, creado from mensajes x
                        where x.match_id = m.id order by creado desc limit 1) u on true
   where mi_perro() in (m.perro_a, m.perro_b)
     and not hay_bloqueo(auth.uid(), d.id)
   order by coalesce(u.creado, m.creado) desc
$$;

revoke execute on function public.mis_matches(), public.marcar_leido(uuid) from public, anon;
grant execute on function public.mis_matches(), public.marcar_leido(uuid) to authenticated;

-- Los matches nuevos también llegan al instante a la app.
alter publication supabase_realtime add table public.matches;
