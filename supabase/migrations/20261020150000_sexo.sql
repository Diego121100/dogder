-- =====================================================================
-- Dogder · sexo del perro (macho o hembra)
-- Pégala completa en Supabase > SQL Editor > New query > Run.
-- =====================================================================

alter table public.perros
  add column if not exists sexo text check (sexo in ('Macho', 'Hembra'));

-- Los perros de prueba (si ya los creaste) reciben su sexo.
update public.perros p set sexo = v.sexo
  from (values ('Canela', 'Hembra'), ('Frijol', 'Macho'), ('Luna', 'Hembra'), ('Tamal', 'Macho'),
               ('Nube', 'Hembra'), ('Chilaquil', 'Macho'), ('Mochi', 'Macho'), ('Zeus', 'Macho'),
               ('Bombón', 'Hembra')) as v(nombre, sexo),
       auth.users u
 where p.nombre = v.nombre and u.id = p.dueno_id and u.email like '%@prueba.dogder.app' and p.sexo is null;

-- Descubrir ahora devuelve el sexo y se puede filtrar por él.
drop function if exists public.perros_cercanos(int, text[], text[], int[], text[], int);

create function public.perros_cercanos(
  p_max_km   int      default 10,
  p_tamanos  text[]   default array['Chico', 'Mediano', 'Grande'],
  p_edades   text[]   default null,      -- 'Cachorro' | 'Joven' | 'Adulto' | 'Senior'
  p_energias int[]    default null,      -- 1..5
  p_razas    text[]   default null,
  p_limite   int      default 20,
  p_sexos    text[]   default null       -- 'Macho' | 'Hembra'
)
returns table (
  perro_id     uuid,
  nombre       text,
  edad         smallint,
  raza         text,
  tamano       text,
  energia      smallint,
  sexo         text,
  bio          text,
  dueno_nombre text,
  colonia      text,
  cercania     text,          -- 'muy_cerca' | 'menos_1km' | 'km'
  distancia_km int,
  fotos        text[]
)
language sql stable security definer set search_path = public as $$
  with yo as (select id, lat, lng from perfiles where id = auth.uid() and lat is not null)
  select p.id, p.nombre, p.edad, p.raza, p.tamano, p.energia, p.sexo, p.bio,
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
     and (p_sexos is null or p.sexo = any (p_sexos))
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

revoke execute on function public.perros_cercanos(int, text[], text[], int[], text[], int, text[]) from public, anon;
grant execute on function public.perros_cercanos(int, text[], text[], int[], text[], int, text[]) to authenticated;
