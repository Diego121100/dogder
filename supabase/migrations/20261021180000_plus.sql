-- =====================================================================
-- Dogder · Dogder Plus (todavía sin cobro)
-- Pégala en Supabase > SQL Editor > New query > Run.
--
-- Gratis                               | Dogder Plus
-- 50 "me gusta" cada 24 h              | sin límite
-- 1 súper hueso cada 24 h              | 5 cada 24 h
-- Deshacer solo el último, 1 vez/día   | sin límite
-- Filtros: distancia, sexo y tamaño    | + edad, energía y razas
-- Ve cuántos le dieron me gusta        | ve quiénes son y hace match directo
-- -                                    | Modo viaje: buscar perros en otra ciudad
--
-- Quién es Plus lo dice perfiles.plus_hasta. La app no lo puede cambiar:
-- hoy se activa a mano (supabase/seed/activar_plus_de_prueba.sql) y, cuando
-- haya cobro, lo activará el aviso de pago de Apple/Google (RevenueCat).
-- =====================================================================

alter table public.perfiles
  add column if not exists plus_hasta     timestamptz,
  add column if not exists deshacer_usado timestamptz,
  add column if not exists viaje_lat      double precision,   -- modo viaje (redondeado)
  add column if not exists viaje_lng      double precision,
  add column if not exists viaje_nombre   text;

create function public.es_plus(u uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select plus_hasta > now() from perfiles where id = u), false)
$$;

-- Dónde "está" una persona: su ubicación real, o la del modo viaje si es Plus y lo activó.
create function public.ubicacion_efectiva(u uuid)
returns table (lat double precision, lng double precision)
language sql stable security definer set search_path = public as $$
  select case when p.plus_hasta > now() and p.viaje_lat is not null then p.viaje_lat else p.lat end,
         case when p.plus_hasta > now() and p.viaje_lat is not null then p.viaje_lng else p.lng end
    from perfiles p where p.id = u
$$;

-- Cuánto le queda a una persona hoy (ventanas de 24 h, igual que el súper hueso).
create function public.cupos(u uuid)
returns table (
  plus             boolean,
  likes_usados     int,
  likes_limite     int,          -- null = sin límite
  likes_vuelven    timestamptz,  -- cuándo se libera el siguiente (si se acabaron)
  supers_usados    int,
  supers_limite    int,
  super_vuelve     timestamptz,
  deshacer_vuelve  timestamptz   -- null = disponible
)
language sql stable security definer set search_path = public as $$
  with yo as (select es_plus(u) as plus, (select id from perros where dueno_id = u) as perro,
                     (select deshacer_usado from perfiles where id = u) as deshacer),
       l as (select count(*) filter (where tipo = 'like')::int as likes,
                    min(creado) filter (where tipo = 'like') as primer_like,
                    count(*) filter (where tipo = 'super')::int as supers,
                    min(creado) filter (where tipo = 'super') as primer_super
               from likes, yo where de_perro = yo.perro and creado > now() - interval '24 hours')
  select yo.plus,
         l.likes, case when yo.plus then null else 50 end,
         case when not yo.plus and l.likes >= 50 then l.primer_like + interval '24 hours' end,
         l.supers, case when yo.plus then 5 else 1 end,
         case when l.supers >= (case when yo.plus then 5 else 1 end) then l.primer_super + interval '24 hours' end,
         case when not yo.plus and yo.deshacer > now() - interval '24 hours' then yo.deshacer + interval '24 hours' end
    from yo, l
$$;



-- ---------------------------------------------------------------------
-- Me gusta / súper hueso con los límites del plan
-- ---------------------------------------------------------------------
create or replace function public.dar_like(p_a_perro uuid, p_tipo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  yo_perro uuid := mi_perro();
  otro_dueno uuid;
  c record;
  nuevo_match uuid;
begin
  if yo_perro is null then raise exception 'Primero crea el perfil de tu perro'; end if;
  if p_tipo not in ('like', 'nope', 'super') then raise exception 'Tipo no válido'; end if;

  select dueno_id into otro_dueno from perros where id = p_a_perro;
  if otro_dueno is null or hay_bloqueo(auth.uid(), otro_dueno) then
    raise exception 'Este perfil ya no está disponible';
  end if;

  perform 1 from perfiles where id = auth.uid() for update;   -- un deslizamiento a la vez
  select * into c from cupos(auth.uid());

  if p_tipo = 'like' and c.likes_limite is not null and c.likes_usados >= c.likes_limite then
    return jsonb_build_object('ok', false, 'motivo', 'likes_agotados', 'disponible', c.likes_vuelven);
  end if;
  if p_tipo = 'super' and c.supers_usados >= c.supers_limite then
    return jsonb_build_object('ok', false, 'motivo', 'super_agotado', 'disponible', c.super_vuelve);
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

-- Deshacer: gratis solo el último deslizamiento y 1 vez cada 24 h; con Plus, sin límite.
-- (Si era súper hueso o me gusta, se recupera solo, porque ya no cuenta.)
drop function if exists public.deshacer_like(uuid);
create function public.deshacer_like(p_a_perro uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  yo_perro uuid := mi_perro();
  c record;
  ultimo uuid;
begin
  select * into c from cupos(auth.uid());
  if not c.plus then
    if c.deshacer_vuelve is not null then
      return jsonb_build_object('ok', false, 'motivo', 'deshacer_agotado', 'disponible', c.deshacer_vuelve);
    end if;
    select a_perro into ultimo from likes where de_perro = yo_perro order by creado desc limit 1;
    if ultimo is distinct from p_a_perro then
      return jsonb_build_object('ok', false, 'motivo', 'solo_ultimo');
    end if;
  end if;

  delete from likes where de_perro = yo_perro and a_perro = p_a_perro;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if not c.plus then update perfiles set deshacer_usado = now() where id = auth.uid(); end if;
  -- El match se borra solo si todavía no tiene mensajes.
  delete from matches m
   where m.perro_a = least(yo_perro, p_a_perro) and m.perro_b = greatest(yo_perro, p_a_perro)
     and not exists (select 1 from mensajes x where x.match_id = m.id);
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- Quién le dio me gusta a mi perro (y todavía no he deslizado)
-- ---------------------------------------------------------------------
create function public.likes_recibidos_total()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
    from likes l
    join perros p on p.id = l.de_perro
    join perfiles d on d.id = p.dueno_id
   where l.a_perro = mi_perro() and l.tipo in ('like', 'super')
     and d.suspendida is null and not hay_bloqueo(auth.uid(), d.id)
     and not exists (select 1 from likes y where y.de_perro = mi_perro() and y.a_perro = p.id)
$$;

-- La lista completa es de Dogder Plus (a una cuenta gratis no se le manda ni la foto).
create function public.likes_recibidos()
returns table (
  perro_id uuid, nombre text, edad smallint, raza text, tamano text, energia smallint, sexo text, bio text,
  dueno_nombre text, colonia text, cercania text, distancia_km int, fotos text[], te_dio_super boolean
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not es_plus() then raise exception 'Solo para Dogder Plus'; end if;
  return query
  select p.id, p.nombre, p.edad, p.raza, p.tamano, p.energia, p.sexo, p.bio, d.nombre, d.colonia,
         case when k.km < 0.5 then 'muy_cerca' when k.km < 1 then 'menos_1km' else 'km' end,
         greatest(round(k.km)::int, 1),
         f.rutas,
         l.tipo = 'super'
    from likes l
    join perros p on p.id = l.de_perro
    join perfiles d on d.id = p.dueno_id
    cross join lateral (select * from ubicacion_efectiva(auth.uid())) yo
    cross join lateral (select * from ubicacion_efectiva(d.id)) dl
    cross join lateral (select coalesce(distancia_km(yo.lat, yo.lng, dl.lat, dl.lng), 0) as km) k
    cross join lateral (select coalesce(array_agg(x.ruta order by x.orden), '{}') as rutas
                          from fotos x where x.perro_id = p.id and foto_aprobada(x.ruta)) f
   where l.a_perro = mi_perro() and l.tipo in ('like', 'super')
     and d.suspendida is null and not hay_bloqueo(auth.uid(), d.id)
     and not exists (select 1 from likes y where y.de_perro = mi_perro() and y.a_perro = p.id)
   order by (l.tipo = 'super') desc, l.creado desc
   limit 100;
end $$;

-- ---------------------------------------------------------------------
-- Modo viaje (Plus)
-- ---------------------------------------------------------------------
create function public.activar_viaje(p_lat double precision, p_lng double precision, p_nombre text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_plus() then raise exception 'El modo viaje es de Dogder Plus'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Ubicación no válida'; end if;
  update perfiles set viaje_lat = redondear_coord(p_lat), viaje_lng = redondear_coord(p_lng),
                      viaje_nombre = left(btrim(coalesce(p_nombre, 'Otro lugar')), 60)
   where id = auth.uid();
end $$;

create function public.quitar_viaje()
returns void language sql security definer set search_path = public as $$
  update perfiles set viaje_lat = null, viaje_lng = null, viaje_nombre = null where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- Descubrir con los filtros de Plus y el modo viaje
-- ---------------------------------------------------------------------
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
  with yo as (select p0.id, l.lat, l.lng, es_plus(p0.id) as plus
                from perfiles p0
                cross join lateral (select * from ubicacion_efectiva(p0.id)) l
               where p0.id = auth.uid() and p0.lat is not null and p0.suspendida is null)
  select p.id, p.nombre, p.edad, p.raza, p.tamano, p.energia, p.sexo, p.bio,
         d.nombre, d.colonia,
         case when k.km < 0.5 then 'muy_cerca' when k.km < 1 then 'menos_1km' else 'km' end,
         greatest(round(k.km)::int, 1),
         f.rutas,
         s.super
    from yo
    join perfiles d on d.id <> yo.id and d.lat is not null and d.suspendida is null
    join perros p on p.dueno_id = d.id
    cross join lateral (select * from ubicacion_efectiva(d.id)) dl
    cross join lateral (select distancia_km(yo.lat, yo.lng, dl.lat, dl.lng) as km) k
    cross join lateral (select coalesce(array_agg(x.ruta order by x.orden), '{}') as rutas
                          from fotos x where x.perro_id = p.id and foto_aprobada(x.ruta)) f
    cross join lateral (select exists (select 1 from likes l
                                        where l.de_perro = p.id and l.a_perro = mi_perro() and l.tipo = 'super') as super) s
   where k.km <= least(greatest(p_max_km, 1), 50)
     and p.tamano = any (p_tamanos)
     and (p_sexos is null or p.sexo = any (p_sexos))
     -- Edad, energía y razas son filtros de Dogder Plus.
     and (p_energias is null or not yo.plus or p.energia = any (p_energias))
     and (p_razas is null or not yo.plus or p.raza = any (p_razas))
     and (p_edades is null or not yo.plus or (case when p.edad <= 1 then 'Cachorro' when p.edad <= 3 then 'Joven'
                                    when p.edad <= 7 then 'Adulto' else 'Senior' end) = any (p_edades))
     and not hay_bloqueo(yo.id, d.id)
     and not exists (select 1 from likes l where l.de_perro = mi_perro() and l.a_perro = p.id)
     and cardinality(f.rutas) >= 2
   order by s.super desc, k.km, p.creado desc
   limit least(greatest(p_limite, 1), 50)
$$;

-- Todo lo que la app necesita saber del plan, en una sola llamada.
create function public.mi_plan()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'plus', c.plus,
    'plus_hasta', (select plus_hasta from perfiles where id = auth.uid()),
    'likes_restantes', case when c.likes_limite is null then null else greatest(c.likes_limite - c.likes_usados, 0) end,
    'likes_vuelven', c.likes_vuelven,
    'supers_restantes', greatest(c.supers_limite - c.supers_usados, 0),
    'super_vuelve', c.super_vuelve,
    'deshacer_vuelve', c.deshacer_vuelve,
    'viaje', case when c.plus then (select viaje_nombre from perfiles where id = auth.uid() and viaje_lat is not null) end,
    'likes_recibidos', likes_recibidos_total())
  from cupos(auth.uid()) c
$$;

revoke execute on function public.es_plus(uuid), public.ubicacion_efectiva(uuid), public.cupos(uuid),
                           public.mi_plan(), public.dar_like(uuid, text), public.deshacer_like(uuid),
                           public.likes_recibidos_total(), public.likes_recibidos(),
                           public.activar_viaje(double precision, double precision, text), public.quitar_viaje(),
                           public.perros_cercanos(int, text[], text[], int[], text[], int, text[])
  from public, anon;
grant execute on function public.mi_plan(), public.dar_like(uuid, text), public.deshacer_like(uuid),
                          public.likes_recibidos_total(), public.likes_recibidos(),
                          public.activar_viaje(double precision, double precision, text), public.quitar_viaje(),
                          public.perros_cercanos(int, text[], text[], int[], text[], int, text[])
  to authenticated;
