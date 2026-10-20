-- =====================================================================
-- Dogder · Mi perro: usuarios bloqueados y eliminar cuenta
-- Pégala en Supabase > SQL Editor > New query > Run.
-- =====================================================================

-- Lista de a quién bloqueé, con el nombre y la foto de su perro
-- (las reglas de seguridad ya no me dejan ver ese perro directamente).
create function public.mis_bloqueados()
returns table (usuario uuid, perro_nombre text, foto text, creado timestamptz)
language sql stable security definer set search_path = public as $$
  select b.bloqueado, p.nombre,
         (select ruta from fotos f where f.perro_id = p.id order by orden limit 1),
         b.creado
    from bloqueos b
    left join perros p on p.dueno_id = b.bloqueado
   where b.bloqueador = auth.uid()
   order by b.creado desc
$$;

-- El dueño de un perro, para reportarlo o bloquearlo desde su tarjeta o su chat.
create function public.dueno_de(p_perro uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select dueno_id from perros where id = p_perro
$$;

revoke execute on function public.mis_bloqueados(), public.dueno_de(uuid) from public, anon;
grant execute on function public.mis_bloqueados(), public.dueno_de(uuid) to authenticated;

-- Para borrar mis fotos al eliminar la cuenta, la app necesita poder listarlas.
create policy "listar mis fotos" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
