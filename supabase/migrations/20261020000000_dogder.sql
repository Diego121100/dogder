-- =====================================================================
-- Dogder · base de datos inicial
-- Pégala completa en Supabase > SQL Editor > New query > Run.
--
-- Principios:
--  * Toda tabla tiene reglas de seguridad (RLS). Sin regla, nadie lee ni escribe.
--  * La ubicación se guarda redondeada a ~550 m y nunca sale del servidor:
--    los demás solo reciben la distancia aproximada en kilómetros.
--  * Likes, súper hueso, matches, bloqueos y eliminar cuenta pasan por
--    funciones del servidor, para que nadie pueda saltarse las reglas desde el teléfono.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table public.perfiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  nombre                text not null check (char_length(nombre) between 2 and 30),
  apellido              text not null check (char_length(apellido) between 2 and 40),
  fecha_nacimiento      date not null,
  colonia               text not null check (char_length(colonia) between 2 and 60),
  lat                   double precision,          -- ya redondeada
  lng                   double precision,          -- ya redondeada
  ubicacion_actualizada timestamptz,
  super_hueso_usado     timestamptz,
  creado                timestamptz not null default now()
);

create table public.perros (
  id       uuid primary key default gen_random_uuid(),
  dueno_id uuid not null unique references public.perfiles (id) on delete cascade,
  nombre   text not null check (char_length(nombre) between 1 and 20),
  edad     smallint not null check (edad between 0 and 25),
  raza     text not null check (char_length(raza) between 2 and 50),
  tamano   text not null check (tamano in ('Chico', 'Mediano', 'Grande')),
  energia  smallint not null check (energia between 1 and 5),
  bio      text not null default '' check (char_length(bio) <= 160),
  creado   timestamptz not null default now()
);

create table public.fotos (
  id      uuid primary key default gen_random_uuid(),
  perro_id uuid not null references public.perros (id) on delete cascade,
  ruta    text not null,                         -- ruta dentro del bucket "fotos"
  orden   smallint not null check (orden between 0 and 5),   -- 0 = foto principal
  unique (perro_id, orden) deferrable initially deferred
);

create table public.likes (
  de_perro uuid not null references public.perros (id) on delete cascade,
  a_perro  uuid not null references public.perros (id) on delete cascade,
  tipo     text not null check (tipo in ('like', 'nope', 'super')),
  creado   timestamptz not null default now(),
  primary key (de_perro, a_perro),
  check (de_perro <> a_perro)
);

create table public.matches (
  id      uuid primary key default gen_random_uuid(),
  perro_a uuid not null references public.perros (id) on delete cascade,
  perro_b uuid not null references public.perros (id) on delete cascade,
  creado  timestamptz not null default now(),
  unique (perro_a, perro_b),
  check (perro_a < perro_b)                      -- un solo registro por pareja
);

create table public.mensajes (
  id       uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  autor_id uuid not null references public.perfiles (id) on delete cascade,
  texto    text not null check (char_length(btrim(texto)) between 1 and 1000),
  creado   timestamptz not null default now()
);
create index mensajes_por_match on public.mensajes (match_id, creado);

create table public.bloqueos (
  bloqueador uuid not null references public.perfiles (id) on delete cascade,
  bloqueado  uuid not null references public.perfiles (id) on delete cascade,
  creado     timestamptz not null default now(),
  primary key (bloqueador, bloqueado),
  check (bloqueador <> bloqueado)
);

create table public.reportes (
  id         uuid primary key default gen_random_uuid(),
  reportador uuid references public.perfiles (id) on delete set null,
  reportado  uuid references public.perfiles (id) on delete set null,
  motivo     text not null check (motivo in (
               'Fotos o contenido inapropiado', 'Acoso o mensajes ofensivos',
               'Venta o cruza de animales', 'Perfil falso o spam',
               'Maltrato animal', 'Otro motivo')),
  detalles   text not null default '' check (char_length(detalles) <= 300),
  estado     text not null default 'pendiente' check (estado in ('pendiente', 'revisado', 'accion_tomada')),
  creado     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Funciones de apoyo
-- ---------------------------------------------------------------------

-- Redondea a una cuadrícula de 0.005° (~550 m): nunca se guarda la ubicación exacta.
create function public.redondear_coord(v double precision)
returns double precision language sql immutable as $$
  select round(v / 0.005) * 0.005
$$;

-- Distancia en km entre dos puntos (fórmula de Haversine).
create function public.distancia_km(lat1 double precision, lng1 double precision,
                                    lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- El perro de la persona con sesión iniciada.
create function public.mi_perro()
returns uuid language sql stable security definer set search_path = public as $$
  select id from perros where dueno_id = auth.uid()
$$;

-- ¿Hay un bloqueo entre dos personas, en cualquier sentido?
create function public.hay_bloqueo(u1 uuid, u2 uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from bloqueos
                 where (bloqueador = u1 and bloqueado = u2) or (bloqueador = u2 and bloqueado = u1))
$$;

-- ¿La persona con sesión iniciada es parte de este match?
create function public.soy_parte_del_match(m uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from matches x join perros p on p.id in (x.perro_a, x.perro_b)
                 where x.id = m and p.dueno_id = auth.uid())
$$;

-- ---------------------------------------------------------------------
-- Registro: al crear la cuenta se crea su perfil con los datos del paso 1
-- ---------------------------------------------------------------------

create function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  nacimiento date := (new.raw_user_meta_data ->> 'fecha_nacimiento')::date;
begin
  -- Solo mayores de 18 años. Si no se cumple, la cuenta no se crea.
  if nacimiento is null or nacimiento > (current_date - interval '18 years') then
    raise exception 'Necesitas tener 18 años o más para usar Dogder.';
  end if;
  insert into perfiles (id, nombre, apellido, fecha_nacimiento, colonia)
  values (
    new.id,
    btrim(new.raw_user_meta_data ->> 'nombre'),
    btrim(new.raw_user_meta_data ->> 'apellido'),
    nacimiento,
    btrim(new.raw_user_meta_data ->> 'colonia')
  );
  return new;
end $$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- ---------------------------------------------------------------------
-- Ubicación
-- ---------------------------------------------------------------------

create function public.actualizar_ubicacion(p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Ubicación no válida';
  end if;
  update perfiles
     set lat = redondear_coord(p_lat), lng = redondear_coord(p_lng), ubicacion_actualizada = now()
   where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------
-- Descubrir: perros cercanos con filtros y distancia redondeada
-- ---------------------------------------------------------------------

create function public.perros_cercanos(
  p_max_km   int      default 10,
  p_tamanos  text[]   default array['Chico', 'Mediano', 'Grande'],
  p_edades   text[]   default null,      -- 'Cachorro' | 'Joven' | 'Adulto' | 'Senior'
  p_energias int[]    default null,      -- 1..5
  p_razas    text[]   default null,
  p_limite   int      default 20
)
returns table (
  perro_id     uuid,
  nombre       text,
  edad         smallint,
  raza         text,
  tamano       text,
  energia      smallint,
  bio          text,
  dueno_nombre text,
  colonia      text,
  distancia_km int,          -- 0 significa "a menos de 1 km"
  fotos        text[]
)
language sql stable security definer set search_path = public as $$
  with yo as (select id, lat, lng from perfiles where id = auth.uid() and lat is not null)
  select p.id, p.nombre, p.edad, p.raza, p.tamano, p.energia, p.bio,
         d.nombre, d.colonia,
         case when k.km < 1 then 0 else round(k.km)::int end,
         coalesce((select array_agg(f.ruta order by f.orden) from fotos f where f.perro_id = p.id), '{}')
    from yo
    join perfiles d on d.id <> yo.id and d.lat is not null
    join perros p on p.dueno_id = d.id
    cross join lateral (select distancia_km(yo.lat, yo.lng, d.lat, d.lng) as km) k
   where k.km <= least(greatest(p_max_km, 1), 50)
     and p.tamano = any (p_tamanos)
     and (p_energias is null or p.energia = any (p_energias))
     and (p_razas is null or p.raza = any (p_razas))
     and (p_edades is null or (case when p.edad <= 1 then 'Cachorro' when p.edad <= 3 then 'Joven'
                                    when p.edad <= 7 then 'Adulto' else 'Senior' end) = any (p_edades))
     and not hay_bloqueo(yo.id, d.id)
     and not exists (select 1 from likes l where l.de_perro = mi_perro() and l.a_perro = p.id)
     and (select count(*) from fotos f where f.perro_id = p.id) >= 2
   order by k.km, p.creado desc
   limit least(greatest(p_limite, 1), 50)
$$;

-- ---------------------------------------------------------------------
-- Likes, súper hueso (1 cada 24 horas) y match automático
-- ---------------------------------------------------------------------

create function public.dar_like(p_a_perro uuid, p_tipo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  yo_perro uuid := mi_perro();
  otro_dueno uuid;
  usado timestamptz;
  nuevo_match uuid;
begin
  if yo_perro is null then raise exception 'Primero crea el perfil de tu perro'; end if;
  if p_tipo not in ('like', 'nope', 'super') then raise exception 'Tipo no válido'; end if;

  select dueno_id into otro_dueno from perros where id = p_a_perro;
  if otro_dueno is null or hay_bloqueo(auth.uid(), otro_dueno) then
    raise exception 'Este perfil ya no está disponible';
  end if;

  if p_tipo = 'super' then
    select super_hueso_usado into usado from perfiles where id = auth.uid() for update;
    if usado is not null and usado > now() - interval '24 hours' then
      return jsonb_build_object('ok', false, 'motivo', 'super_agotado',
                                'disponible', usado + interval '24 hours');
    end if;
    update perfiles set super_hueso_usado = now() where id = auth.uid();
  end if;

  insert into likes (de_perro, a_perro, tipo) values (yo_perro, p_a_perro, p_tipo)
  on conflict (de_perro, a_perro) do update set tipo = excluded.tipo, creado = now();

  -- Hay match cuando los dos dueños se dieron "me gusta" o "súper hueso".
  if p_tipo in ('like', 'super') and exists (
       select 1 from likes where de_perro = p_a_perro and a_perro = yo_perro and tipo in ('like', 'super')) then
    insert into matches (perro_a, perro_b)
    values (least(yo_perro, p_a_perro), greatest(yo_perro, p_a_perro))
    on conflict (perro_a, perro_b) do nothing
    returning id into nuevo_match;
    if nuevo_match is null then
      select id into nuevo_match from matches
       where perro_a = least(yo_perro, p_a_perro) and perro_b = greatest(yo_perro, p_a_perro);
    end if;
  end if;

  return jsonb_build_object('ok', true, 'match_id', nuevo_match);
end $$;

-- Deshacer el último like (botón Volver). Si era súper hueso, se recupera.
create function public.deshacer_like(p_a_perro uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  yo_perro uuid := mi_perro();
  t text;
begin
  delete from likes where de_perro = yo_perro and a_perro = p_a_perro returning tipo into t;
  if t = 'super' then update perfiles set super_hueso_usado = null where id = auth.uid(); end if;
  -- El match se borra solo si todavía no tiene mensajes.
  delete from matches m
   where m.perro_a = least(yo_perro, p_a_perro) and m.perro_b = greatest(yo_perro, p_a_perro)
     and not exists (select 1 from mensajes x where x.match_id = m.id);
end $$;

-- Mis matches con el último mensaje, para la pestaña Matches.
create function public.mis_matches()
returns table (match_id uuid, perro_id uuid, nombre text, dueno_nombre text, colonia text,
               foto text, ultimo_texto text, ultimo_autor uuid, ultimo_creado timestamptz, creado timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, p.id, p.nombre, d.nombre, d.colonia,
         (select ruta from fotos f where f.perro_id = p.id order by orden limit 1),
         u.texto, u.autor_id, u.creado, m.creado
    from matches m
    join perros p on p.id = case when m.perro_a = mi_perro() then m.perro_b else m.perro_a end
    join perfiles d on d.id = p.dueno_id
    left join lateral (select texto, autor_id, creado from mensajes x
                        where x.match_id = m.id order by creado desc limit 1) u on true
   where mi_perro() in (m.perro_a, m.perro_b)
     and not hay_bloqueo(auth.uid(), d.id)
   order by coalesce(u.creado, m.creado) desc
$$;

-- ---------------------------------------------------------------------
-- Bloquear: borra el match y la conversación entre los dos
-- ---------------------------------------------------------------------

create function public.al_bloquear()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from matches m
   using perros a, perros b
   where a.dueno_id = new.bloqueador and b.dueno_id = new.bloqueado
     and m.perro_a = least(a.id, b.id) and m.perro_b = greatest(a.id, b.id);
  return new;
end $$;

create trigger tras_bloquear after insert on public.bloqueos
  for each row execute function public.al_bloquear();

-- ---------------------------------------------------------------------
-- Eliminar cuenta (requisito de Apple): borra todo en cascada.
-- La app borra antes los archivos de fotos con la API de Storage
-- (Supabase no permite borrarlos directamente desde SQL).
-- ---------------------------------------------------------------------

create function public.eliminar_cuenta()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------
-- Reglas de seguridad (RLS)
-- ---------------------------------------------------------------------

alter table public.perfiles enable row level security;
alter table public.perros   enable row level security;
alter table public.fotos    enable row level security;
alter table public.likes    enable row level security;
alter table public.matches  enable row level security;
alter table public.mensajes enable row level security;
alter table public.bloqueos enable row level security;
alter table public.reportes enable row level security;

-- perfiles: cada quien ve y edita solo el suyo. La ubicación se cambia solo con actualizar_ubicacion().
create policy "ver mi perfil" on public.perfiles for select to authenticated using (id = auth.uid());
create policy "editar mi perfil" on public.perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.perfiles from authenticated;
grant update (nombre, apellido, colonia) on public.perfiles to authenticated;

-- perros: los ven las personas con sesión, salvo si hay bloqueo. Solo el dueño los cambia.
create policy "ver perros" on public.perros for select to authenticated
  using (dueno_id = auth.uid() or not hay_bloqueo(auth.uid(), dueno_id));
create policy "crear mi perro" on public.perros for insert to authenticated with check (dueno_id = auth.uid());
create policy "editar mi perro" on public.perros for update to authenticated
  using (dueno_id = auth.uid()) with check (dueno_id = auth.uid());

-- fotos: mismas reglas que su perro.
create policy "ver fotos" on public.fotos for select to authenticated
  using (exists (select 1 from perros p where p.id = perro_id
                 and (p.dueno_id = auth.uid() or not hay_bloqueo(auth.uid(), p.dueno_id))));
create policy "gestionar mis fotos" on public.fotos for all to authenticated
  using (exists (select 1 from perros p where p.id = perro_id and p.dueno_id = auth.uid()))
  with check (exists (select 1 from perros p where p.id = perro_id and p.dueno_id = auth.uid()));

-- likes: cada quien ve solo los que dio. Se crean solo con dar_like().
create policy "ver mis likes" on public.likes for select to authenticated using (de_perro = mi_perro());

-- matches: los ven sus dos dueños. Se crean solo con dar_like().
create policy "ver mis matches" on public.matches for select to authenticated
  using (mi_perro() in (perro_a, perro_b));

-- mensajes: solo los dos dueños del match leen y escriben, y nunca si hay bloqueo.
create policy "leer mensajes" on public.mensajes for select to authenticated
  using (soy_parte_del_match(match_id));
create policy "escribir mensajes" on public.mensajes for insert to authenticated
  with check (autor_id = auth.uid() and soy_parte_del_match(match_id)
              and not exists (select 1 from matches m join perros a on a.id = m.perro_a join perros b on b.id = m.perro_b
                              where m.id = match_id and hay_bloqueo(a.dueno_id, b.dueno_id)));

-- bloqueos: cada quien ve, crea y quita los suyos.
create policy "ver mis bloqueos" on public.bloqueos for select to authenticated using (bloqueador = auth.uid());
create policy "bloquear" on public.bloqueos for insert to authenticated with check (bloqueador = auth.uid());
create policy "desbloquear" on public.bloqueos for delete to authenticated using (bloqueador = auth.uid());

-- reportes: cualquiera puede enviar uno; nadie los lee desde la app (solo el equipo de moderación).
create policy "enviar reporte" on public.reportes for insert to authenticated with check (reportador = auth.uid());

-- Las funciones con reglas propias solo las pueden llamar personas con sesión.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.actualizar_ubicacion(double precision, double precision),
                          public.perros_cercanos(int, text[], text[], int[], text[], int),
                          public.dar_like(uuid, text),
                          public.deshacer_like(uuid),
                          public.mis_matches(),
                          public.eliminar_cuenta(),
                          public.mi_perro(),
                          public.hay_bloqueo(uuid, uuid),
                          public.soy_parte_del_match(uuid),
                          public.redondear_coord(double precision),
                          public.distancia_km(double precision, double precision, double precision, double precision)
  to authenticated;

-- ---------------------------------------------------------------------
-- Fotos: bucket "fotos". Cada quien sube solo a su carpeta <su id>/...
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "subir mis fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cambiar mis fotos" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "borrar mis fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Chat en tiempo real
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table public.mensajes;
