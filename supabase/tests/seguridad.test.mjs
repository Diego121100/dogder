// Prueba de la migración de Dogder en un Postgres en memoria, imitando lo que Supabase trae de fábrica.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const db = new PGlite();
const migration = fs.readFileSync(process.argv[2], 'utf8');

await db.exec(`
  create role authenticated nologin; create role anon nologin;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  create publication supabase_realtime;
  grant usage on schema public, auth, storage to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  alter default privileges in schema public grant all on tables to authenticated, anon;
`);
await db.exec(migration);
console.log('✓ La migración se aplica sin errores');

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const D = '44444444-4444-4444-4444-444444444444';
const meta = (n, birth) => JSON.stringify({ nombre: n, apellido: 'Prueba', fecha_nacimiento: birth, colonia: 'Roma Norte' });

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '✓ ' : '✗ ') + msg); if (!cond) fails++; };
async function as(uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role;'); }
}
async function fails_(uid, sql) { try { await as(uid, sql); return false; } catch { return true; } }

for (const [id, n] of [[A, 'Diego'], [B, 'Mariana'], [D, 'Pablo']])
  await db.query('insert into auth.users values ($1, $2)', [id, meta(n, '1995-03-05')]);
ok((await db.query('select count(*)::int c from perfiles')).rows[0].c === 3, 'Al crear la cuenta se crea el perfil');
let menor = false;
try { await db.query('insert into auth.users values ($1, $2)', ['33333333-3333-3333-3333-333333333333', meta('Menor', '2012-01-01')]); }
catch (e) { menor = /18 años/.test(e.message); }
ok(menor, 'Un menor de 18 años no puede crear cuenta');

// Cada quien crea su perro con 2 fotos y activa su ubicación
const perros = {};
for (const [id, n] of [[A, 'Floki'], [B, 'Canela'], [D, 'Tamal']]) {
  const r = await as(id, `insert into perros (dueno_id, nombre, edad, raza, tamano, energia) values ($1, $2, 3, 'Mestizo (sin raza definida)', 'Mediano', 4) returning id`, [id, n]);
  perros[id] = r.rows[0].id;
  await as(id, `insert into fotos (perro_id, ruta, orden) values ($1, $2, 0), ($1, $3, 1)`, [perros[id], `${id}/a.jpg`, `${id}/b.jpg`]);
}
await as(A, `select actualizar_ubicacion(19.41952, -99.16171)`);
await as(B, `select actualizar_ubicacion(19.43000, -99.15000)`);
await as(D, `select actualizar_ubicacion(19.35000, -99.16000)`);
const locA = (await db.query('select lat, lng from perfiles where id = $1', [A])).rows[0];
ok(Math.abs(locA.lat - 19.42) < 1e-9 && Math.abs(locA.lng - -99.16) < 1e-9, `La ubicación se guarda redondeada (${locA.lat}, ${locA.lng})`);

ok(await fails_(A, `insert into perros (dueno_id, nombre, edad, raza, tamano, energia) values ('${B}', 'Falso', 1, 'Pug', 'Chico', 1)`), 'Nadie puede crear un perro a nombre de otra persona');
ok(await fails_(A, `update perfiles set lat = 0 where id = '${A}'`), 'La ubicación no se puede cambiar directo, solo con la función que redondea');
ok((await as(A, `select * from perfiles`)).rows.length === 1, 'Cada quien solo puede leer su propio perfil');

const cerca = await as(A, `select * from perros_cercanos(10)`);
ok(cerca.rows.length === 2, `Descubrir muestra a los otros 2 perros cercanos (${cerca.rows.map(r => r.nombre + ' a ' + r.distancia_km + ' km').join(', ')})`);
ok(!('lat' in (cerca.rows[0] ?? {})) && !('lng' in (cerca.rows[0] ?? {})), 'Descubrir no devuelve coordenadas de nadie');
ok((await as(A, `select * from perros_cercanos(3)`)).rows.every(r => r.distancia_km <= 3), 'El filtro de distancia funciona');
ok((await as(A, `select * from perros_cercanos(10, array['Chico'])`)).rows.length === 0, 'El filtro de tamaño funciona');

// Likes, súper hueso y match
ok(await fails_(A, `insert into likes values ('${perros[A]}', '${perros[B]}', 'like')`), 'No se pueden crear likes directo, solo con la función');
const s1 = (await as(A, `select dar_like($1, 'super') r`, [perros[B]])).rows[0].r;
ok(s1.ok && !s1.match_id, 'Súper hueso a Canela: todavía sin match');
const s2 = (await as(A, `select dar_like($1, 'super') r`, [perros[D]])).rows[0].r;
ok(!s2.ok && s2.motivo === 'super_agotado', 'Un segundo súper hueso en menos de 24 horas se rechaza');
ok((await as(A, `select * from perros_cercanos(10)`)).rows.every(r => r.perro_id !== perros[B]), 'Un perro ya deslizado no vuelve a salir en Descubrir');
const m = (await as(B, `select dar_like($1, 'like') r`, [perros[A]])).rows[0].r;
ok(m.ok && m.match_id, 'Canela da me gusta a Floki: ¡match!');
ok((await as(A, `select * from mis_matches()`)).rows.length === 1, 'Floki ve su match en Matches');
ok((await as(D, `select * from matches`)).rows.length === 0, 'Otra persona no puede ver ese match');

// Chat
await as(A, `insert into mensajes (match_id, autor_id, texto) values ($1, $2, 'Hola, ¿paseamos el sábado?')`, [m.match_id, A]);
ok((await as(B, `select * from mensajes`)).rows.length === 1, 'Mariana lee el mensaje de Diego');
ok((await as(D, `select * from mensajes`)).rows.length === 0, 'Otra persona no puede leer la conversación');
ok(await fails_(D, `insert into mensajes (match_id, autor_id, texto) values ('${m.match_id}', '${D}', 'intruso')`), 'Otra persona no puede escribir en la conversación');
ok(await fails_(A, `insert into mensajes (match_id, autor_id, texto) values ('${m.match_id}', '${B}', 'suplantación')`), 'Nadie puede enviar mensajes a nombre de otro');

// Reporte y bloqueo
await as(A, `insert into reportes (reportador, reportado, motivo) values ($1, $2, 'Perfil falso o spam')`, [A, D]);
ok((await as(A, `select * from reportes`)).rows.length === 0, 'Los reportes no se pueden leer desde la app');
await as(A, `insert into bloqueos (bloqueador, bloqueado) values ($1, $2)`, [A, B]);
ok((await db.query('select count(*)::int c from matches')).rows[0].c === 0, 'Al bloquear se borran el match y la conversación');
ok((await as(B, `select * from perros where id = $1`, [perros[A]])).rows.length === 0, 'La persona bloqueada ya no ve al perro de quien la bloqueó');
ok((await as(B, `select * from perros_cercanos(10)`)).rows.every(r => r.perro_id !== perros[A]), 'El bloqueo funciona en ambos sentidos en Descubrir');

// Volver (deshacer) recupera el súper hueso
await as(D, `select dar_like($1, 'super')`, [perros[A]]);
await as(D, `select deshacer_like($1)`, [perros[A]]);
ok((await db.query('select super_hueso_usado from perfiles where id = $1', [D])).rows[0].super_hueso_usado === null, 'Volver después de un súper hueso lo recupera');

// Eliminar cuenta
await as(D, `select eliminar_cuenta()`);
const quedan = (await db.query(`select (select count(*) from perfiles where id = $1)::int p, (select count(*) from perros where dueno_id = $1)::int g, (select count(*) from fotos f join perros x on x.id = f.perro_id where x.dueno_id = $1)::int f`, [D])).rows[0];
ok(quedan.p + quedan.g + quedan.f === 0, 'Eliminar cuenta borra perfil, perro y fotos');

console.log(fails ? `\n${fails} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
process.exit(fails ? 1 : 0);
