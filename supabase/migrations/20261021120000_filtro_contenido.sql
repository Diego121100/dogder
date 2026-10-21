-- =====================================================================
-- Dogder · Filtro de contenido
-- Pégala en Supabase > SQL Editor > New query > Run.
--
--  * Chat, nombre y descripción del perro: las groserías se tapan con ****.
--    Se hace en el servidor, así que no se puede saltar desde el teléfono.
--  * Fotos: cada foto nueva la revisa la función "revisar-fotos" (OpenAI Moderation).
--    Hasta que se aprueba, solo la ve el dueño; si no pasa, se borra.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Groserías
-- ---------------------------------------------------------------------
-- Raíces de groserías e insultos comunes en México (sin acentos y con acentos).
-- Se buscan como palabras completas para no tapar palabras normales
-- (por ejemplo "disputa" o "computadora"). "Perra" NO está: aquí es una perrita.
create function public.censurar(t text)
returns text language plpgsql immutable set search_path = public as $$
declare
  patron constant text :=
    '\m(' ||
    'pendej[a-záéíóú]*|pndj[a-z]*|ching[a-záéíóú]*|vergas?|vergazos?|put[oa]s?|putit[oa]s?|putaz[oa]s?|' ||
    'cabr[oó]n|cabronas?|cabrones|culer[oa]s?|mierd[a-záéíóú]*|pinches?|' ||
    'jotos?|maric[oó]n|maricones|maricas?|pu[ñn]etas?|ojetes?|' ||
    'idiotas?|imb[eé]cil(es)?|estup[ií]d[oa]s?|tarad[oa]s?|zorras?|retrasad[oa]s?|' ||
    'mam[oó]n|mamonas?|mamadas?|panochas?|coño|gilipollas|malparid[oa]s?|' ||
    'hdp|hijueputa|ptm|alv|nmms' ||
    ')\M';
  m text;
begin
  if t is null then return t; end if;
  for m in select (regexp_matches(t, patron, 'gi'))[1] loop
    -- Solo la palabra completa (para no tapar, por ejemplo, "disputa" al tapar otra palabra).
    t := regexp_replace(t, '\m' || m || '\M', repeat('*', char_length(m)), 'g');
  end loop;
  return t;
end $$;

create function public.censurar_mensaje()
returns trigger language plpgsql as $$
begin
  new.texto := censurar(new.texto);
  return new;
end $$;
create trigger censurar_mensaje before insert or update of texto on public.mensajes
  for each row execute function public.censurar_mensaje();

create function public.censurar_perro()
returns trigger language plpgsql as $$
begin
  new.nombre := censurar(new.nombre);
  new.bio := censurar(new.bio);
  return new;
end $$;
create trigger censurar_perro before insert or update of nombre, bio on public.perros
  for each row execute function public.censurar_perro();

-- Lo que ya estaba escrito también se limpia.
update public.mensajes set texto = censurar(texto) where texto is distinct from censurar(texto);
update public.perros set bio = censurar(bio), nombre = censurar(nombre)
 where bio is distinct from censurar(bio) or nombre is distinct from censurar(nombre);

-- ---------------------------------------------------------------------
-- Fotos
-- ---------------------------------------------------------------------
-- Resultado de la revisión de cada foto (por ruta). Solo la escribe la función
-- "revisar-fotos" con la clave secreta del servidor; la app no puede tocarla.
create table public.fotos_revision (
  ruta     text primary key,
  aprobada boolean not null,
  motivo   text,
  revisada timestamptz not null default now()
);
alter table public.fotos_revision enable row level security;   -- sin reglas: nadie desde la app

create function public.foto_aprobada(p_ruta text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select aprobada from fotos_revision where ruta = p_ruta), false)
$$;

-- Las fotos que ya existían se dan por aprobadas.
insert into public.fotos_revision (ruta, aprobada, motivo)
select ruta, true, 'Anterior al filtro' from public.fotos
on conflict (ruta) do nothing;

-- Los demás solo ven fotos aprobadas; el dueño ve todas las suyas.
drop policy "ver fotos" on public.fotos;
create policy "ver fotos" on public.fotos for select to authenticated
  using (exists (select 1 from perros p where p.id = perro_id
                 and (p.dueno_id = auth.uid()
                      or (not hay_bloqueo(auth.uid(), p.dueno_id) and foto_aprobada(ruta)))));

-- Descubrir: solo fotos aprobadas, y un perro aparece si tiene al menos 2.
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
         f.rutas,
         s.super
    from yo
    join perfiles d on d.id <> yo.id and d.lat is not null and d.suspendida is null
    join perros p on p.dueno_id = d.id
    cross join lateral (select distancia_km(yo.lat, yo.lng, d.lat, d.lng) as km) k
    cross join lateral (select coalesce(array_agg(x.ruta order by x.orden), '{}') as rutas
                          from fotos x where x.perro_id = p.id and foto_aprobada(x.ruta)) f
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
     and cardinality(f.rutas) >= 2
   order by s.super desc, k.km, p.creado desc
   limit least(greatest(p_limite, 1), 50)
$$;

revoke execute on function public.foto_aprobada(text),
                           public.perros_cercanos(int, text[], text[], int[], text[], int, text[])
  from public, anon;
grant execute on function public.foto_aprobada(text),
                          public.perros_cercanos(int, text[], text[], int[], text[], int, text[])
  to authenticated;
