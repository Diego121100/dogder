-- =====================================================================
-- Dogder · Eliminar mensajes del chat
-- Pégala en Supabase > SQL Editor > New query > Run.
--
-- Al eliminar un mensaje, los dos ven "Se eliminó este mensaje".
-- El texto original se guarda aparte hasta 90 días, solo para que moderación
-- pueda atender un reporte (así nadie borra el acoso antes de que lo revisemos).
-- =====================================================================

alter table public.mensajes add column if not exists eliminado boolean not null default false;

create table public.mensajes_eliminados (
  mensaje_id     uuid primary key references public.mensajes (id) on delete cascade,
  texto_original text not null,
  eliminado      timestamptz not null default now()
);
alter table public.mensajes_eliminados enable row level security;   -- sin reglas: nadie desde la app

-- Solo quien escribió el mensaje lo puede eliminar.
create function public.eliminar_mensaje(p_mensaje uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  original text;
begin
  select texto into original from mensajes
   where id = p_mensaje and autor_id = auth.uid() and not eliminado
   for update;
  if not found then raise exception 'No puedes eliminar este mensaje'; end if;

  insert into mensajes_eliminados (mensaje_id, texto_original) values (p_mensaje, original)
  on conflict (mensaje_id) do nothing;
  update mensajes set texto = 'Se eliminó este mensaje', eliminado = true where id = p_mensaje;

  -- Limpieza: las copias de más de 90 días se borran.
  delete from mensajes_eliminados where eliminado < now() - interval '90 days';
end $$;

-- Nadie puede marcar un mensaje como eliminado ni cambiarlo directamente.
revoke update on public.mensajes from authenticated;

create or replace function public.mod_reportes(p_pendientes boolean default true)
returns table (
  id               uuid,
  motivo           text,
  detalles         text,
  creado           timestamptz,
  estado           text,
  accion           text,
  nota             text,
  resuelto         timestamptz,
  reportado        uuid,
  dueno            text,
  email            text,
  perro_nombre     text,
  perro_bio        text,
  fotos            text[],
  reportador_perro text,
  total_reportes   int,
  suspendida       boolean,
  mensajes         jsonb
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not es_moderador() then raise exception 'Solo para moderadores'; end if;
  return query
  select r.id, r.motivo, r.detalles, r.creado, r.estado, r.accion, r.nota, r.resuelto,
         r.reportado,
         case when d.id is null then null else d.nombre || ' ' || d.apellido end,
         u.email::text,
         p.nombre::text, p.bio::text,
         coalesce((select array_agg(f.ruta order by f.orden) from fotos f where f.perro_id = p.id), '{}'),
         q.nombre::text,
         (select count(*)::int from reportes x where x.reportado = r.reportado),
         d.suspendida is not null,
         -- Los últimos 30 mensajes entre ambos; los eliminados se ven con su texto original.
         (select coalesce(jsonb_agg(jsonb_build_object(
                    'texto', coalesce(t.original, t.texto), 'creado', t.creado,
                    'de_reportado', t.autor_id = r.reportado, 'eliminado', t.eliminado)
                    order by t.creado), '[]'::jsonb)
            from (select x.texto, x.creado, x.autor_id, x.eliminado, e.texto_original as original
                    from mensajes x join matches m on m.id = x.match_id
                    left join mensajes_eliminados e on e.mensaje_id = x.id
                   where p.id is not null and q.id is not null
                     and m.perro_a = least(p.id, q.id) and m.perro_b = greatest(p.id, q.id)
                   order by x.creado desc limit 30) t)
    from reportes r
    left join perfiles d on d.id = r.reportado
    left join auth.users u on u.id = r.reportado
    left join perros p on p.dueno_id = r.reportado
    left join perros q on q.dueno_id = r.reportador
   where (p_pendientes and r.estado = 'pendiente') or (not p_pendientes and r.estado <> 'pendiente')
   order by case when p_pendientes then r.creado end asc,      -- pendientes: el más antiguo primero
            case when not p_pendientes then r.resuelto end desc
   limit 100;
end $$;

revoke execute on function public.eliminar_mensaje(uuid) from public, anon;
grant execute on function public.eliminar_mensaje(uuid) to authenticated;
