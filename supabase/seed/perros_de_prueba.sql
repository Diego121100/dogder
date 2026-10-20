-- =====================================================================
-- Dogder · perros de prueba
-- Crea 9 dueños y perros FALSOS alrededor de TU ubicación, para probar Descubrir.
-- Cuatro de ellos ya le dieron "me gusta" a tu perro: si les das "me gusta", ¡es match!
--
-- Úsalo solo mientras desarrollas. Para borrarlos, ejecuta borrar_perros_de_prueba.sql.
-- Pégalo completo en Supabase > SQL Editor > New query > Run.
-- Antes, abre la app y permite la ubicación, para que haya una ubicación tuya guardada.
-- =====================================================================

do $$
declare
  base_lat double precision;
  base_lng double precision;
  mi_perro uuid;
  r record;
  uid uuid;
  pid uuid;
begin
  -- Tu ubicación y tu perro: la cuenta real con ubicación más reciente.
  select p.lat, p.lng, g.id into base_lat, base_lng, mi_perro
    from perfiles p
    join auth.users u on u.id = p.id
    left join perros g on g.dueno_id = p.id
   where p.lat is not null and u.email not like '%@prueba.dogder.app'
   order by p.ubicacion_actualizada desc nulls last
   limit 1;

  if base_lat is null then
    raise exception 'Primero abre Dogder y permite la ubicación, para saber dónde poner los perros de prueba.';
  end if;

  for r in
    select * from (values
      -- dueño,      colonia,          perro,     edad, raza,                         tamaño,    energía, dlat,   dlng,   ¿ya te dio like?, bio, foto 1, foto 2
      ('Mariana',  'Tu colonia',     'Canela',   3, 'Golden Retriever',            'Grande',  5,  0.000,  0.000, true,  'Pelota hasta el infinito. Salimos al parque todas las mañanas.',
        'https://images.dog.ceo/breeds/retriever-golden/n02099601_2295.jpg', 'https://images.dog.ceo/breeds/retriever-golden/n02099601_304.jpg'),
      ('Lucía',    'Tu colonia',     'Frijol',   6, 'Pug (Carlino)',               'Chico',   1,  0.005,  0.000, true,  'Ronco, como y soy adorable. En ese orden.',
        'https://images.dog.ceo/breeds/pug/n02110958_15538.jpg', 'https://images.dog.ceo/breeds/pug/n02110958_6274.jpg'),
      ('Sofía',    'Colonia vecina', 'Luna',     4, 'Husky Siberiano',             'Grande',  5,  0.010,  0.005, false, 'Aúllo cuando pasa la camioneta del gas. Busco compañero para correr.',
        'https://images.dog.ceo/breeds/husky/n02110185_1532.jpg', 'https://images.dog.ceo/breeds/husky/n02110185_8748.jpg'),
      ('Diego',    'Colonia vecina', 'Tamal',    2, 'Dachshund (Salchicha)',       'Chico',   3, -0.015,  0.010, true,  'Corto de patas, largo de corazón. Experto en siestas al sol.',
        'https://images.dog.ceo/breeds/dachshund/puppy-1006024_640.jpg', 'https://images.dog.ceo/breeds/dachshund/dog-495122_640.jpg'),
      ('Valeria',  'Más al norte',   'Nube',     2, 'Caniche (Poodle) Toy',        'Chico',   3,  0.020, -0.020, false, 'Peinado impecable hasta que veo un charco.',
        'https://images.dog.ceo/breeds/poodle-toy/n02113624_213.jpg', 'https://images.dog.ceo/breeds/poodle-toy/n02113624_274.jpg'),
      ('Pablo',    'Más al sur',     'Chilaquil',1, 'Mestizo (sin raza definida)', 'Mediano', 4, -0.030,  0.000, true,  'Adoptado y feliz. Me llevo con todos los perros y casi todos los gatos.',
        'https://images.dog.ceo/breeds/labrador/n02099712_4428.jpg', 'https://images.dog.ceo/breeds/labrador/n02099712_7749.jpg'),
      ('Kenji',    'Más al este',    'Mochi',    5, 'Schnauzer Miniatura',         'Chico',   2,  0.040,  0.030, false, 'Independiente, digno y un poco dramático. Paseos tranquilos.',
        'https://images.dog.ceo/breeds/schnauzer-miniature/n02097047_5869.jpg', 'https://images.dog.ceo/breeds/schnauzer-miniature/n02097047_2605.jpg'),
      ('Andrés',   'Más al oeste',   'Zeus',     3, 'Labrador Retriever',          'Grande',  4, -0.050, -0.040, false, 'Obediente y protector. Sé sentarme, dar la pata y abrir el refri.',
        'https://images.dog.ceo/breeds/labrador/n02099712_1436.jpg', 'https://images.dog.ceo/breeds/retriever-golden/n02099601_5453.jpg'),
      ('Fernanda', 'Más lejos',      'Bombón',   7, 'Shih Tzu',                    'Chico',   2,  0.060, -0.050, false, 'Señora de la casa. Me gustan los paseos cortos y las croquetas largas.',
        'https://images.dog.ceo/breeds/shihtzu/n02086240_7404.jpg', 'https://images.dog.ceo/breeds/shihtzu/n02086240_6911.jpg')
    ) as t(dueno, colonia, perro, edad, raza, tamano, energia, dlat, dlng, te_dio_like, bio, foto1, foto2)
  loop
    uid := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            lower(r.perro) || '-' || left(uid::text, 8) || '@prueba.dogder.app', '', now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('nombre', r.dueno, 'apellido', 'Prueba', 'fecha_nacimiento', '1992-05-10', 'colonia', r.colonia),
            now(), now());

    update perfiles
       set lat = redondear_coord(base_lat + r.dlat), lng = redondear_coord(base_lng + r.dlng), ubicacion_actualizada = now()
     where id = uid;

    insert into perros (dueno_id, nombre, edad, raza, tamano, energia, bio)
    values (uid, r.perro, r.edad, r.raza, r.tamano, r.energia, r.bio)
    returning id into pid;

    insert into fotos (perro_id, ruta, orden) values (pid, r.foto1, 0), (pid, r.foto2, 1);

    if r.te_dio_like and mi_perro is not null then
      insert into likes (de_perro, a_perro, tipo) values (pid, mi_perro, 'like') on conflict do nothing;
    end if;
  end loop;

  raise notice 'Listo: 9 perros de prueba alrededor de tu ubicación.';
end $$;
