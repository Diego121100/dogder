-- =====================================================================
-- Dogder · distancia más amigable en Descubrir
-- Pégala completa en Supabase > SQL Editor > New query > Run.
--
-- perros_cercanos ahora también devuelve "cercania":
--   'muy_cerca'   → menos de 500 m       → "Muy cerca de ti"
--   'menos_1km'   → de 500 m a 1 km      → "A menos de 1 km"
--   'km'          → 1 km o más           → "A 2 km", "a 3 km"… (distancia_km)
-- Nunca se devuelven metros exactos ni coordenadas, para proteger a los dueños.
-- =====================================================================

drop function if exists public.perros_cercanos(int, text[], text[], int[], text[], int);

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
  cercania     text,          -- 'muy_cerca' | 'menos_1km' | 'km'
  distancia_km int,           -- kilómetros enteros (solo cuenta cuando cercania = 'km')
  fotos        text[]
)
language sql stable security definer set search_path = public as $$
  with yo as (select id, lat, lng from perfiles where id = auth.uid() and lat is not null)
  select p.id, p.nombre, p.edad, p.raza, p.tamano, p.energia, p.bio,
         d.nombre, d.colonia,
         case when k.km < 0.5 then 'muy_cerca' when k.km < 1 then 'menos_1km' else 'km' end,
         greatest(round(k.km)::int, 1),
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

revoke execute on function public.perros_cercanos(int, text[], text[], int[], text[], int) from public, anon;
grant execute on function public.perros_cercanos(int, text[], text[], int[], text[], int) to authenticated;
