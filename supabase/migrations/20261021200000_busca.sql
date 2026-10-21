-- =====================================================================
-- Dogder · ¿A quién busca tu perro? (como en Tinder)
-- Pégala en Supabase > SQL Editor > New query > Run.
--
-- Cada perro dice a quién quiere conocer: Hembras, Machos o Ambos.
-- Descubrir solo muestra perros que coinciden EN LOS DOS SENTIDOS:
-- un macho que busca hembras ve hembras que buscan machos (o ambos).
-- Los perfiles que ya existían quedan en "Ambos".
-- =====================================================================

alter table public.perros
  add column if not exists busca text not null default 'Ambos' check (busca in ('Macho', 'Hembra', 'Ambos'));

-- ¿Se pueden mostrar el uno al otro?
create function public.se_buscan(yo_sexo text, yo_busca text, otro_sexo text, otro_busca text)
returns boolean language sql immutable as $$
  select coalesce(yo_busca = 'Ambos' or otro_sexo = yo_busca, false)
     and coalesce(otro_busca = 'Ambos' or yo_sexo is null or otro_busca = yo_sexo, false)
$$;

drop function if exists public.perros_cercanos(int, text[], text[], int[], text[], int, text[]);

create function public.perros_cercanos(
  p_max_km   int      default 10,
  p_tamanos  text[]   default array['Chico', 'Mediano', 'Grande'],
  p_edades   text[]   default null,
  p_energias int[]    default null,
  p_razas    text[]   default null,
  p_limite   int      default 20,
  p_sexos    text[]   default null,   -- ya no se usa (ahora manda "a quién busca" de cada perro)
  p_busca    text     default null    -- para la vista previa de los filtros, antes de guardar
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
  with yo as (select p0.id, l.lat, l.lng, es_plus(p0.id) as plus,
                     m.sexo, coalesce(p_busca, m.busca) as busca
                from perfiles p0
                left join perros m on m.dueno_id = p0.id
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
     and se_buscan(yo.sexo, yo.busca, p.sexo, p.busca)
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

create or replace function public.likes_recibidos_total()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
    from likes l
    join perros p on p.id = l.de_perro
    join perfiles d on d.id = p.dueno_id
    join perros m on m.id = mi_perro()
   where l.a_perro = mi_perro() and l.tipo in ('like', 'super')
     and se_buscan(m.sexo, m.busca, p.sexo, p.busca)
     and d.suspendida is null and not hay_bloqueo(auth.uid(), d.id)
     and not exists (select 1 from likes y where y.de_perro = mi_perro() and y.a_perro = p.id)
$$;

create or replace function public.likes_recibidos()
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
    join perros m on m.id = mi_perro()
    cross join lateral (select * from ubicacion_efectiva(auth.uid())) yo
    cross join lateral (select * from ubicacion_efectiva(d.id)) dl
    cross join lateral (select coalesce(distancia_km(yo.lat, yo.lng, dl.lat, dl.lng), 0) as km) k
    cross join lateral (select coalesce(array_agg(x.ruta order by x.orden), '{}') as rutas
                          from fotos x where x.perro_id = p.id and foto_aprobada(x.ruta)) f
   where l.a_perro = mi_perro() and l.tipo in ('like', 'super')
     and se_buscan(m.sexo, m.busca, p.sexo, p.busca)
     and d.suspendida is null and not hay_bloqueo(auth.uid(), d.id)
     and not exists (select 1 from likes y where y.de_perro = mi_perro() and y.a_perro = p.id)
   order by (l.tipo = 'super') desc, l.creado desc
   limit 100;
end $$;

revoke execute on function public.perros_cercanos(int, text[], text[], int[], text[], int, text[], text) from public, anon;
grant execute on function public.perros_cercanos(int, text[], text[], int[], text[], int, text[], text),
                          public.se_buscan(text, text, text, text)
  to authenticated;
