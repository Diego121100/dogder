-- =====================================================================
-- Dogder · Reportar un mensaje
-- Pégala en Supabase > SQL Editor > New query > Run.
--
--  * Al mantener apretado un mensaje de la otra persona, se puede reportar ese mensaje.
--  * Al reportar, se guarda una copia de la conversación dentro del reporte.
--    Así moderación la puede revisar aunque quien reporta también bloquee
--    (bloquear borra el match y el chat) o aunque el otro elimine sus mensajes.
-- =====================================================================

alter table public.reportes
  add column if not exists mensaje_id   uuid,      -- el mensaje reportado (si se reportó uno)
  add column if not exists conversacion jsonb;     -- copia de la conversación al momento del reporte

create function public.capturar_conversacion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a uuid;
  b uuid;
begin
  new.conversacion := null;    -- siempre la arma el servidor, nunca la app
  select id into a from perros where dueno_id = new.reportador;
  select id into b from perros where dueno_id = new.reportado;

  if new.mensaje_id is not null and not exists (
       select 1 from mensajes x join matches m on m.id = x.match_id
        where x.id = new.mensaje_id and x.autor_id = new.reportado
          and m.perro_a = least(a, b) and m.perro_b = greatest(a, b)) then
    raise exception 'Ese mensaje no se puede reportar';
  end if;

  if a is not null and b is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', t.id, 'texto', t.texto, 'creado', t.creado,
             'de_reportado', t.autor_id = new.reportado, 'eliminado', t.eliminado)
             order by t.creado), '[]'::jsonb)
      into new.conversacion
      from (select x.id, coalesce(e.texto_original, x.texto) as texto, x.creado, x.autor_id, x.eliminado
              from mensajes x
              join matches m on m.id = x.match_id
              left join mensajes_eliminados e on e.mensaje_id = x.id
             where m.perro_a = least(a, b) and m.perro_b = greatest(a, b)
             order by x.creado desc
             limit 50) t;
    -- Si el mensaje reportado es más viejo que los últimos 50, se agrega también.
    if new.mensaje_id is not null and not new.conversacion @> jsonb_build_array(jsonb_build_object('id', new.mensaje_id)) then
      select new.conversacion || jsonb_build_array(jsonb_build_object(
               'id', x.id, 'texto', coalesce(e.texto_original, x.texto), 'creado', x.creado,
               'de_reportado', true, 'eliminado', x.eliminado))
        into new.conversacion
        from mensajes x left join mensajes_eliminados e on e.mensaje_id = x.id
       where x.id = new.mensaje_id;
    end if;
  end if;
  return new;
end $$;

create trigger capturar_conversacion before insert on public.reportes
  for each row execute function public.capturar_conversacion();

drop function if exists public.mod_reportes(boolean);

create function public.mod_reportes(p_pendientes boolean default true)
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
  mensajes         jsonb,
  mensaje_id       uuid
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
         -- La conversación guardada al reportar (o, en reportes viejos, los últimos 30 mensajes).
         coalesce(nullif(r.conversacion, '[]'::jsonb), (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', t.id,
                    'texto', coalesce(t.original, t.texto), 'creado', t.creado,
                    'de_reportado', t.autor_id = r.reportado, 'eliminado', t.eliminado)
                    order by t.creado), '[]'::jsonb)
            from (select x.id, x.texto, x.creado, x.autor_id, x.eliminado, e.texto_original as original
                    from mensajes x join matches m on m.id = x.match_id
                    left join mensajes_eliminados e on e.mensaje_id = x.id
                   where p.id is not null and q.id is not null
                     and m.perro_a = least(p.id, q.id) and m.perro_b = greatest(p.id, q.id)
                   order by x.creado desc limit 30) t)),
         r.mensaje_id
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

revoke execute on function public.capturar_conversacion(), public.mod_reportes(boolean) from public, anon;
grant execute on function public.mod_reportes(boolean) to authenticated;
