-- =====================================================================
-- Dogder · el súper hueso se ve del otro lado
--  * Quien recibe un súper hueso puede verlo (los "me gusta" normales siguen siendo secretos).
--  * Llega en tiempo real para mostrar "¡Canela te mandó un súper hueso!".
--  * En Descubrir, los perros que te mandaron súper hueso salen primero.
-- Pégala en Supabase > SQL Editor > New query > Run.
-- =====================================================================

create policy "ver super huesos recibidos" on public.likes for select to authenticated
  using (tipo = 'super' and a_perro = mi_perro());

alter publication supabase_realtime add table public.likes;

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
  te_dio_super  boolean       -- este perro te mandó un súper hueso
)
language sql stable security definer set search_path = public as $$
  with yo as (select id, lat, lng from perfiles where id = auth.uid() and lat is not null)
  select p.id, p.nombre, p.edad, p.raza, p.tamano, p.energia, p.sexo, p.bio,
         d.nombre, d.colonia,
         case when k.km < 0.5 then 'muy_cerca' when k.km < 1 then 'menos_1km' else 'km' end,
         greatest(round(k.km)::int, 1),
         coalesce((select array_agg(f.ruta order by f.orden) from fotos f where f.perro_id = p.id), '{}'),
         s.super
    from yo
    join perfiles d on d.id <> yo.id and d.lat is not null
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

revoke execute on function public.perros_cercanos(int, text[], text[], int[], text[], int, text[]) from public, anon;
grant execute on function public.perros_cercanos(int, text[], text[], int[], text[], int, text[]) to authenticated;
