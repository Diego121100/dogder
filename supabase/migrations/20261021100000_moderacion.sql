-- =====================================================================
-- Dogder · Panel de moderación
-- Pégala en Supabase > SQL Editor > New query > Run.
--
-- Después, para darte acceso al panel (cambia el correo por el tuyo):
--   insert into public.moderadores (usuario)
--   select id from auth.users where email = 'tu-correo@ejemplo.com';
-- =====================================================================

-- Quién puede moderar. Solo se agrega gente desde el SQL Editor, nunca desde la app.
create table public.moderadores (
  usuario uuid primary key references auth.users (id) on delete cascade,
  creado  timestamptz not null default now()
);
alter table public.moderadores enable row level security;   -- sin reglas: nadie la lee desde la app

create function public.es_moderador()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from moderadores where usuario = auth.uid())
$$;

-- Sanciones: suspensión de la cuenta y advertencia pendiente de leer.
-- (La app no puede cambiar estas columnas: solo nombre, apellido y colonia son editables.)
alter table public.perfiles
  add column if not exists suspendida        timestamptz,
  add column if not exists motivo_suspension text,
  add column if not exists advertencia       text;

-- Lo que decidió el moderador en cada reporte.
alter table public.reportes
  add column if not exists accion       text check (accion in ('descartar', 'advertir', 'suspender')),
  add column if not exists nota         text,
  add column if not exists resuelto     timestamptz,
  add column if not exists resuelto_por uuid references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------
-- Una cuenta suspendida no puede deslizar ni escribir, aunque intente
-- saltarse la app.
-- ---------------------------------------------------------------------
create function public.estoy_suspendido()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select suspendida is not null from perfiles where id = auth.uid()), false)
$$;

create function public.bloquear_suspendidos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if estoy_suspendido() then raise exception 'Tu cuenta está suspendida'; end if;
  return new;
end $$;

create trigger suspendido_no_desliza before insert or update on public.likes
  for each row execute function public.bloquear_suspendidos();
create trigger suspendido_no_escribe before insert on public.mensajes
  for each row execute function public.bloquear_suspendidos();

-- Descubrir ya no muestra perros de cuentas suspendidas.
drop function if exists public.perros_cercanos(int, text[], text[], int[], text[], int, text[]);

create function public.perros_cercanos(
  p_max_km   int      default 10,
  p_tamanos  text[]   default array['Chico', 'Mediano', 'Grande'],
  p_edades   text[]   default null,
  p_energias int[]    default null,
  p_razas    text[]   default null,
  p_limite   int      default 20,
  p_sexos    text[]   default null
)
returns table (
  perro_id      uuid,
  nombre        text,
  edad          smallint,
  raza          text,
  tamano        text,
  energia       smallint,
  sexo          text,
  bio           text,
  dueno_nombre  text,
  colonia       text,
  cercania      text,
  distancia_km  int,
  fotos         text[],
  te_dio_super  boolean
)
language sql stable security definer set search_path = public as $$
  with yo as (select id, lat, lng from perfiles where id = auth.uid() and lat is not null and suspendida is null)
  select p.id, p.nombre, p.edad, p.raza, p.tamano, p.energia, p.sexo, p.bio,
         d.nombre, d.colonia,
         case when k.km < 0.5 then 'muy_cerca' when k.km < 1 then 'menos_1km' else 'km' end,
         greatest(round(k.km)::int, 1),
         coalesce((select array_agg(f.ruta order by f.orden) from fotos f where f.perro_id = p.id), '{}'),
         s.super
    from yo
    join perfiles d on d.id <> yo.id and d.lat is not null and d.suspendida is null
    join perros p on p.dueno_id = d.id
    cross join lateral (select distancia_km(yo.lat, yo.lng, d.lat, d.lng) as km) k
    cross join lateral (select exists (select 1 from likes l
                                        where l.de_perro = p.id and l.a_perro = mi_perro() and l.tipo = 'super') as super) s
   where k.km <= least(greatest(p_max_km, 1), 50)
     and p.tamano = any (p_tamanos)
     and (p_sexos is null or p.sexo = any (p_sexos))
     and (p_energias is null or p.energia = any (p_energias))
     and (p_razas is null or p.raza = any (p_razas))
     and (p_edades is null or (case when p.edad <= 1 then 'Cachorro' when p.edad <= 3 then 'Joven'
                                    when p.edad <= 7 then 'Adulto' else 'Senior' end) = any (p_edades))
     and not hay_bloqueo(yo.id, d.id)
     and not exists (select 1 from likes l where l.de_perro = mi_perro() and l.a_perro = p.id)
     and (select count(*) from fotos f where f.perro_id = p.id) >= 2
   order by s.super desc, k.km, p.creado desc
   limit least(greatest(p_limite, 1), 50)
$$;

-- ---------------------------------------------------------------------
-- Lo que la app pregunta al abrir: ¿estoy suspendido?, ¿tengo una
-- advertencia?, ¿soy moderador?
-- ---------------------------------------------------------------------
create function public.mi_estado()
returns table (suspendida boolean, motivo_suspension text, advertencia text, moderador boolean)
language sql stable security definer set search_path = public as $$
  select p.suspendida is not null, p.motivo_suspension, p.advertencia, es_moderador()
    from perfiles p where p.id = auth.uid()
$$;

-- Al tocar "Entendido", la advertencia ya no vuelve a salir.
create function public.leer_advertencia()
returns void language sql security definer set search_path = public as $$
  update perfiles set advertencia = null where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- Panel: lista de reportes (solo moderadores)
-- ---------------------------------------------------------------------
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
         -- Los últimos 30 mensajes entre quien reportó y la persona reportada (si tuvieron match).
         (select coalesce(jsonb_agg(jsonb_build_object(
                    'texto', t.texto, 'creado', t.creado, 'de_reportado', t.autor_id = r.reportado)
                    order by t.creado), '[]'::jsonb)
            from (select x.texto, x.creado, x.autor_id
                    from mensajes x join matches m on m.id = x.match_id
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

-- ---------------------------------------------------------------------
-- Panel: resolver un reporte
--   descartar → no pasa nada
--   advertir  → la persona ve el mensaje la próxima vez que abra la app
--   suspender → ya no puede usar la app y deja de aparecer en Descubrir;
--               los demás reportes pendientes contra ella también se cierran
-- ---------------------------------------------------------------------
create function public.mod_resolver(p_reporte uuid, p_accion text, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  quien uuid;
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  if not es_moderador() then raise exception 'Solo para moderadores'; end if;
  if p_accion not in ('descartar', 'advertir', 'suspender') then raise exception 'Acción no válida'; end if;
  if char_length(coalesce(v_nota, '')) > 500 then raise exception 'El mensaje es demasiado largo'; end if;

  select reportado into quien from reportes where id = p_reporte;
  if not found then raise exception 'Ese reporte no existe'; end if;
  if quien = auth.uid() then raise exception 'No puedes resolver un reporte en tu contra'; end if;

  update reportes
     set estado = case when p_accion = 'descartar' then 'revisado' else 'accion_tomada' end,
         accion = p_accion, nota = v_nota, resuelto = now(), resuelto_por = auth.uid()
   where id = p_reporte;

  if quien is null then return; end if;   -- la cuenta ya se eliminó

  if p_accion = 'advertir' then
    update perfiles set advertencia = coalesce(v_nota,
      'Recibimos reportes sobre tu cuenta. Revisa las Normas de la comunidad: si se repite, tu cuenta puede ser suspendida.')
     where id = quien;
  elsif p_accion = 'suspender' then
    update perfiles set suspendida = now(), motivo_suspension = v_nota where id = quien;
    update reportes set estado = 'accion_tomada', accion = 'suspender', nota = 'Cerrado por suspensión',
                        resuelto = now(), resuelto_por = auth.uid()
     where reportado = quien and estado = 'pendiente';
  end if;
end $$;

-- Quitar una suspensión (por ejemplo, si fue un error).
create function public.mod_reactivar(p_usuario uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_moderador() then raise exception 'Solo para moderadores'; end if;
  update perfiles set suspendida = null, motivo_suspension = null where id = p_usuario;
end $$;

revoke execute on function public.es_moderador(), public.estoy_suspendido(), public.bloquear_suspendidos(),
                           public.perros_cercanos(int, text[], text[], int[], text[], int, text[]),
                           public.mi_estado(), public.leer_advertencia(),
                           public.mod_reportes(boolean), public.mod_resolver(uuid, text, text),
                           public.mod_reactivar(uuid)
  from public, anon;
grant execute on function public.perros_cercanos(int, text[], text[], int[], text[], int, text[]),
                          public.mi_estado(), public.leer_advertencia(),
                          public.mod_reportes(boolean), public.mod_resolver(uuid, text, text),
                          public.mod_reactivar(uuid)
  to authenticated;
