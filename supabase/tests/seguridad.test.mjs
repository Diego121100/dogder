// Prueba de la migración de Dogder en un Postgres en memoria, imitando lo que Supabase trae de fábrica.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const db = new PGlite();
const migrations = process.argv.slice(2).map((f) => fs.readFileSync(f, 'utf8'));

await db.exec(`
  create role authenticated nologin; create role anon nologin;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb, email text);
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
for (const m of migrations) await db.exec(m);
console.log(`✓ Las ${migrations.length} migraciones se aplican sin errores`);

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
// La función "revisar-fotos" aprobaría estas fotos (aquí se aprueban a mano).
const aprobarFotos = () => db.query(`insert into fotos_revision (ruta, aprobada) select ruta, true from fotos on conflict do nothing`);
await aprobarFotos();
await as(A, `select actualizar_ubicacion(19.41952, -99.16171)`);
await as(B, `select actualizar_ubicacion(19.43000, -99.15000)`);
await as(D, `select actualizar_ubicacion(19.35000, -99.16000)`);
const locA = (await db.query('select lat, lng from perfiles where id = $1', [A])).rows[0];
ok(Math.abs(locA.lat - 19.42) < 1e-9 && Math.abs(locA.lng - -99.16) < 1e-9, `La ubicación se guarda redondeada (${locA.lat}, ${locA.lng})`);

ok(await fails_(A, `insert into perros (dueno_id, nombre, edad, raza, tamano, energia) values ('${B}', 'Falso', 1, 'Pug', 'Chico', 1)`), 'Nadie puede crear un perro a nombre de otra persona');
ok(await fails_(A, `update perfiles set lat = 0 where id = '${A}'`), 'La ubicación no se puede cambiar directo, solo con la función que redondea');
ok((await as(A, `select * from perfiles`)).rows.length === 1, 'Cada quien solo puede leer su propio perfil');

const cerca = await as(A, `select * from perros_cercanos(10)`);
ok(cerca.rows.length === 2, `Descubrir muestra a los otros 2 perros cercanos (${cerca.rows.map(r => r.nombre + ': ' + r.cercania + ' ' + r.distancia_km + ' km').join(', ')})`);
ok(cerca.rows.every(r => r.cercania === 'km' && r.distancia_km >= 1), 'A más de 1 km se muestra en kilómetros enteros');
// Un vecino en la misma cuadra que Diego aparece como "Muy cerca de ti"
const E = '55555555-5555-5555-5555-555555555555';
await db.query('insert into auth.users values ($1, $2)', [E, meta('Vecina', '1990-01-01')]);
const pe = (await as(E, `insert into perros (dueno_id, nombre, edad, raza, tamano, energia) values ($1, 'Lola', 2, 'Pug (Carlino)', 'Chico', 2) returning id`, [E])).rows[0].id;
await as(E, `insert into fotos (perro_id, ruta, orden) values ($1, 'x/1.jpg', 0), ($1, 'x/2.jpg', 1)`, [pe]);
await aprobarFotos();
await as(E, `select actualizar_ubicacion(19.4201, -99.1599)`);
const lola = (await as(A, `select * from perros_cercanos(10)`)).rows.find(r => r.perro_id === pe);
ok(lola && lola.cercania === 'muy_cerca', 'Un perro a menos de 500 m aparece como "Muy cerca de ti"');
await as(E, `select actualizar_ubicacion(19.4260, -99.1600)`);
const lola2 = (await as(A, `select * from perros_cercanos(10)`)).rows.find(r => r.perro_id === pe);
ok(lola2 && lola2.cercania === 'menos_1km', 'Un perro entre 500 m y 1 km aparece como "A menos de 1 km"');
await db.query('delete from auth.users where id = $1', [E]);
ok(!('lat' in (cerca.rows[0] ?? {})) && !('lng' in (cerca.rows[0] ?? {})), 'Descubrir no devuelve coordenadas de nadie');
ok((await as(A, `select * from perros_cercanos(3)`)).rows.every(r => r.distancia_km <= 3), 'El filtro de distancia funciona');
ok((await as(A, `select * from perros_cercanos(10, array['Chico'])`)).rows.length === 0, 'El filtro de tamaño funciona');
await db.query(`update perros set sexo = 'Hembra' where id = $1`, [perros[B]]);
await db.query(`update perros set sexo = 'Macho' where id = $1`, [perros[D]]);
const hembras = (await as(A, `select * from perros_cercanos(10, p_sexos => array['Hembra'])`)).rows;
ok(hembras.length === 1 && hembras[0].sexo === 'Hembra', 'El filtro de macho o hembra funciona');
ok(await fails_(A, `update perros set sexo = 'Otro' where id = '${perros[A]}'`), 'El sexo solo puede ser Macho o Hembra');

// Likes, súper hueso y match
ok(await fails_(A, `insert into likes values ('${perros[A]}', '${perros[B]}', 'like')`), 'No se pueden crear likes directo, solo con la función');
const s1 = (await as(A, `select dar_like($1, 'super') r`, [perros[B]])).rows[0].r;
ok(s1.ok && !s1.match_id, 'Súper hueso a Canela: todavía sin match');
const s2 = (await as(A, `select dar_like($1, 'super') r`, [perros[D]])).rows[0].r;
ok(!s2.ok && s2.motivo === 'super_agotado', 'Un segundo súper hueso en menos de 24 horas se rechaza');
const recibidos = (await as(B, `select * from likes`)).rows;
ok(recibidos.length === 1 && recibidos[0].tipo === 'super', 'Mariana ve el súper hueso que recibió');
const primero = (await as(B, `select * from perros_cercanos(10)`)).rows[0];
ok(primero && primero.perro_id === perros[A] && primero.te_dio_super === true, 'Quien te mandó súper hueso sale primero y destacado en Descubrir');
ok((await as(A, `select * from perros_cercanos(10)`)).rows.every(r => r.perro_id !== perros[B]), 'Un perro ya deslizado no vuelve a salir en Descubrir');
const m = (await as(B, `select dar_like($1, 'like') r`, [perros[A]])).rows[0].r;
ok(m.ok && m.match_id, 'Canela da me gusta a Floki: ¡match!');
await as(D, `select dar_like($1, 'like')`, [perros[A]]);
ok((await as(A, `select * from likes where de_perro = $1`, [perros[D]])).rows.length === 0, 'Los me gusta normales siguen siendo secretos');
ok((await as(A, `select * from mis_matches()`)).rows.length === 1, 'Floki ve su match en Matches');
ok((await as(B, `select * from mis_matches()`)).rows[0].super_recibido === true, 'Mariana ve en Matches que Floki le mandó un súper hueso');
ok((await as(A, `select * from mis_matches()`)).rows[0].super_enviado === true, 'Diego ve en Matches que él mandó el súper hueso');
ok((await as(D, `select * from matches`)).rows.length === 0, 'Otra persona no puede ver ese match');

// Chat
await as(A, `insert into mensajes (match_id, autor_id, texto) values ($1, $2, 'Hola, ¿paseamos el sábado?')`, [m.match_id, A]);
ok((await as(B, `select * from mensajes`)).rows.length === 1, 'Mariana lee el mensaje de Diego');
ok((await as(D, `select * from mensajes`)).rows.length === 0, 'Otra persona no puede leer la conversación');
ok(await fails_(D, `insert into mensajes (match_id, autor_id, texto) values ('${m.match_id}', '${D}', 'intruso')`), 'Otra persona no puede escribir en la conversación');
ok(await fails_(A, `insert into mensajes (match_id, autor_id, texto) values ('${m.match_id}', '${B}', 'suplantación')`), 'Nadie puede enviar mensajes a nombre de otro');
ok((await as(B, `select * from mis_matches()`)).rows[0].visto === false, 'Un match nuevo aparece como no visto');
await as(B, `select marcar_matches_vistos()`);
let mb = (await as(B, `select * from mis_matches()`)).rows[0];
ok(mb.visto === true, 'Al abrir Matches, el match queda como visto');
ok(mb && mb.sin_leer === 1, 'Mariana ve 1 mensaje sin leer');
ok((await as(A, `select * from mis_matches()`)).rows[0].sin_leer === 0, 'Los mensajes propios no cuentan como sin leer');
await as(B, `select marcar_leido($1)`, [m.match_id]);
mb = (await as(B, `select * from mis_matches()`)).rows[0];
ok(mb.sin_leer === 0, 'Al abrir la conversación, se marca como leída');
await as(D, `select marcar_leido($1)`, [m.match_id]);
ok((await db.query(`select count(*)::int c from match_lecturas where usuario = $1`, [D])).rows[0].c === 0, 'Otra persona no puede marcar como leída una conversación ajena');

// Reporte y bloqueo
await as(A, `insert into reportes (reportador, reportado, motivo) values ($1, $2, 'Perfil falso o spam')`, [A, D]);
ok((await as(A, `select * from reportes`)).rows.length === 0, 'Los reportes no se pueden leer desde la app');
await as(A, `insert into bloqueos (bloqueador, bloqueado) values ($1, $2)`, [A, B]);
ok((await db.query('select count(*)::int c from matches')).rows[0].c === 0, 'Al bloquear se borran el match y la conversación');
ok((await as(B, `select * from perros where id = $1`, [perros[A]])).rows.length === 0, 'La persona bloqueada ya no ve al perro de quien la bloqueó');
ok((await as(B, `select * from perros_cercanos(10)`)).rows.every(r => r.perro_id !== perros[A]), 'El bloqueo funciona en ambos sentidos en Descubrir');
const blq = (await as(A, `select * from mis_bloqueados()`)).rows;
ok(blq.length === 1 && blq[0].perro_nombre === 'Canela', 'Diego ve a Canela en su lista de bloqueados');
ok((await as(B, `select * from mis_bloqueados()`)).rows.length === 0, 'La persona bloqueada no ve quién la bloqueó');
ok((await as(A, `select dueno_de($1) d`, [perros[D]])).rows[0].d === D, 'Se puede saber el dueño de un perro para reportarlo');
await as(A, `delete from bloqueos where bloqueado = $1`, [B]);
ok((await as(B, `select * from perros where id = $1`, [perros[A]])).rows.length === 1, 'Al desbloquear, se vuelven a ver');
await as(A, `insert into bloqueos (bloqueador, bloqueado) values ($1, $2)`, [A, B]);
await as(B, `delete from bloqueos where bloqueador = $1`, [A]);
ok((await db.query(`select count(*)::int c from bloqueos where bloqueador = $1`, [A])).rows[0].c === 1, 'Nadie puede quitar un bloqueo que no hizo');

// Volver (deshacer) recupera el súper hueso
await as(D, `select dar_like($1, 'super')`, [perros[A]]);
await as(D, `select deshacer_like($1)`, [perros[A]]);
ok((await db.query('select super_hueso_usado from perfiles where id = $1', [D])).rows[0].super_hueso_usado === null, 'Volver después de un súper hueso lo recupera');

// Panel de moderación
await as(A, `select dar_like($1, 'like')`, [perros[D]]);
const mAD = (await as(D, `select dar_like($1, 'like') r`, [perros[A]])).rows[0].r.match_id;
await as(D, `insert into mensajes (match_id, autor_id, texto) values ($1, $2, 'Mensaje grosero')`, [mAD, D]);
ok(await fails_(A, `select * from mod_reportes()`), 'Sin ser moderador no se puede abrir el panel');
ok((await as(A, `select * from moderadores`)).rows.length === 0, 'La lista de moderadores no se puede leer desde la app');
ok(await fails_(D, `update perfiles set suspendida = null, advertencia = null where id = '${D}'`), 'Nadie puede quitarse una suspensión o advertencia por su cuenta');
await db.query('insert into moderadores (usuario) values ($1)', [A]);
ok((await as(A, `select * from mi_estado()`)).rows[0].moderador === true, 'La app sabe que Diego es moderador');
ok((await as(B, `select * from mi_estado()`)).rows[0].moderador === false, 'Los demás no son moderadores');
let pend = (await as(A, `select * from mod_reportes(true)`)).rows;
const rep = pend.find(r => r.reportado === D);
ok(rep && rep.perro_nombre === 'Tamal' && rep.reportador_perro === 'Floki' && rep.total_reportes === 1, 'El moderador ve el reporte con el perro reportado y quién lo reportó');
ok(rep && rep.mensajes.length === 1 && rep.mensajes[0].de_reportado === true, 'El moderador ve la conversación entre ambos');
await as(A, `select mod_resolver($1, 'advertir', 'Evita los mensajes ofensivos.')`, [rep.id]);
let est = (await as(D, `select * from mi_estado()`)).rows[0];
ok(est.advertencia === 'Evita los mensajes ofensivos.' && !est.suspendida, 'Al advertir, la persona ve el mensaje al abrir la app');
await as(D, `select leer_advertencia()`);
ok((await as(D, `select * from mi_estado()`)).rows[0].advertencia === null, 'Al tocar "Entendido" la advertencia ya no vuelve a salir');
ok((await as(A, `select * from mod_reportes(true)`)).rows.length === 0 && (await as(A, `select * from mod_reportes(false)`)).rows[0].accion === 'advertir', 'El reporte pasa a Resueltos');
await as(B, `insert into reportes (reportador, reportado, motivo) values ($1, $2, 'Acoso o mensajes ofensivos')`, [B, D]);
await as(B, `insert into reportes (reportador, reportado, motivo) values ($1, $2, 'Otro motivo')`, [B, D]);
const r2 = (await as(A, `select * from mod_reportes(true)`)).rows;
ok(r2.length === 2 && r2[0].total_reportes === 3, 'Se ve cuántos reportes acumula la persona');
await as(A, `select mod_resolver($1, 'suspender', 'Acoso repetido')`, [r2[0].id]);
ok((await as(A, `select * from mod_reportes(true)`)).rows.length === 0, 'Al suspender se cierran todos sus reportes pendientes');
est = (await as(D, `select * from mi_estado()`)).rows[0];
ok(est.suspendida === true && est.motivo_suspension === 'Acoso repetido', 'La persona suspendida lo sabe al abrir la app');
ok((await as(B, `select * from perros_cercanos(50)`)).rows.every(r => r.perro_id !== perros[D]), 'Un perro suspendido ya no aparece en Descubrir');
ok((await as(D, `select * from perros_cercanos(50)`)).rows.length === 0, 'Una cuenta suspendida no ve perros');
ok(await fails_(D, `select dar_like('${perros[B]}', 'like')`), 'Una cuenta suspendida no puede deslizar');
ok(await fails_(D, `insert into mensajes (match_id, autor_id, texto) values ('${mAD}', '${D}', 'hola')`), 'Una cuenta suspendida no puede escribir');
ok(await fails_(B, `select mod_resolver('${r2[1].id}', 'descartar')`) && await fails_(B, `select mod_reactivar('${D}')`), 'Solo un moderador puede resolver o reactivar');
await as(A, `select mod_reactivar($1)`, [D]);
ok((await as(B, `select * from perros_cercanos(50)`)).rows.some(r => r.perro_id === perros[D]), 'Al reactivar la cuenta vuelve a aparecer');

// Filtro de contenido: groserías
const cens = (t) => db.query('select censurar($1) c', [t]).then((r) => r.rows[0].c);
ok(await cens('Eres un pendejo') === 'Eres un *******', 'Las groserías se tapan con asteriscos');
ok(await cens('PINCHE perro') === '****** perro', 'Sin importar mayúsculas');
ok(await cens('Mi perra es una disputa de computadora') === 'Mi perra es una disputa de computadora', 'Palabras normales (y "perra") no se tapan');
ok(await cens('Qué vergüenza, chingón') === 'Qué vergüenza, *******', 'Solo se tapan palabras completas');
const sent = (await as(A, `insert into mensajes (match_id, autor_id, texto) values ($1, $2, 'No seas cabrón') returning texto`, [mAD, A])).rows[0].texto;
ok(sent === 'No seas ******', 'El chat tapa groserías en el servidor (no se puede saltar desde la app)');
await as(A, `update perros set bio = 'Soy un perro culero' where id = $1`, [perros[A]]);
ok((await db.query('select bio from perros where id = $1', [perros[A]])).rows[0].bio === 'Soy un perro ******', 'También en la descripción del perro');

// Eliminar mensajes
const msgId = (await as(A, `insert into mensajes (match_id, autor_id, texto) values ($1, $2, 'Mensaje que me arrepentí') returning id`, [mAD, A])).rows[0].id;
ok(await fails_(D, `select eliminar_mensaje('${msgId}')`), 'Nadie puede eliminar un mensaje que no escribió');
ok(await fails_(A, `update mensajes set texto = 'otro' where id = '${msgId}'`) || (await db.query('select texto from mensajes where id = $1', [msgId])).rows[0].texto === 'Mensaje que me arrepentí', 'Un mensaje no se puede editar directamente');
await as(A, `select eliminar_mensaje($1)`, [msgId]);
const vistoPorD = (await as(D, `select texto, eliminado from mensajes where id = $1`, [msgId])).rows[0];
ok(vistoPorD.eliminado === true && vistoPorD.texto === 'Se eliminó este mensaje', 'Al eliminarlo, el otro ve "Se eliminó este mensaje"');
ok((await as(D, `select * from mensajes_eliminados`)).rows.length === 0, 'El texto original no se puede leer desde la app');
await as(D, `insert into reportes (reportador, reportado, motivo) values ($1, $2, 'Acoso o mensajes ofensivos')`, [D, A]);
await db.query('insert into moderadores (usuario) values ($1) on conflict do nothing', [B]);
const repA = (await as(B, `select * from mod_reportes(true)`)).rows.find(r => r.reportado === A);
ok(repA && repA.mensajes.some(m => m.eliminado && m.texto === 'Mensaje que me arrepentí'), 'Moderación sí ve el texto original de un mensaje eliminado');
await as(B, `select mod_resolver($1, 'descartar')`, [repA.id]);
await db.query('delete from moderadores where usuario = $1', [B]);

// Reportar un mensaje (y que la conversación se conserve aunque se bloquee)
const insulto = (await as(D, `insert into mensajes (match_id, autor_id, texto) values ($1, $2, 'Eres un idiota') returning id`, [mAD, D])).rows[0].id;
const propio = (await as(A, `insert into mensajes (match_id, autor_id, texto) values ($1, $2, 'Hola') returning id`, [mAD, A])).rows[0].id;
ok(await fails_(A, `insert into reportes (reportador, reportado, motivo, mensaje_id) values ('${A}', '${D}', 'Otro motivo', '${propio}')`), 'Solo se pueden reportar mensajes de la otra persona');
ok(await fails_(A, `insert into reportes (reportador, reportado, motivo, conversacion) values ('${A}', '${D}', 'Otro motivo', '[{"texto":"inventado","de_reportado":true}]')`) === false &&
   !(await db.query(`select conversacion::text c from reportes where conversacion::text like '%inventado%'`)).rows.length, 'La app no puede inventar la conversación del reporte');
await db.query(`delete from reportes where reportador = $1 and motivo = 'Otro motivo'`, [A]);
await as(A, `insert into reportes (reportador, reportado, motivo, mensaje_id) values ($1, $2, 'Acoso o mensajes ofensivos', $3)`, [A, D, insulto]);
await as(A, `insert into bloqueos (bloqueador, bloqueado) values ($1, $2)`, [A, D]);
await db.query('insert into moderadores (usuario) values ($1) on conflict do nothing', [B]);
const repMsg = (await as(B, `select * from mod_reportes(true)`)).rows.find(r => r.mensaje_id === insulto);
ok(repMsg && repMsg.mensajes.some(m => m.id === insulto && m.texto === 'Eres un ******'), 'Moderación ve el mensaje reportado aunque quien reportó bloqueó (y se borró el chat)');
await as(B, `select mod_resolver($1, 'descartar')`, [repMsg.id]);
await db.query('delete from moderadores where usuario = $1', [B]);
await as(A, `delete from bloqueos where bloqueado = $1`, [D]);

// Filtro de contenido: fotos
await as(D, `insert into fotos (perro_id, ruta, orden) values ($1, $2, 2)`, [perros[D], `${D}/nueva.jpg`]);
ok((await as(B, `select * from fotos where ruta = $1`, [`${D}/nueva.jpg`])).rows.length === 0, 'Una foto sin revisar no la ven los demás');
ok((await as(D, `select * from fotos where ruta = $1`, [`${D}/nueva.jpg`])).rows.length === 1, 'El dueño sí ve su foto mientras se revisa');
ok(!(await as(B, `select * from perros_cercanos(50)`)).rows.find(r => r.perro_id === perros[D])?.fotos.includes(`${D}/nueva.jpg`), 'Descubrir no muestra fotos sin revisar');
ok(await fails_(D, `insert into fotos_revision (ruta, aprobada) values ('${D}/nueva.jpg', true)`), 'Nadie puede aprobar sus propias fotos desde la app');
await db.query(`insert into fotos_revision (ruta, aprobada) values ($1, true)`, [`${D}/nueva.jpg`]);
ok((await as(B, `select * from fotos where ruta = $1`, [`${D}/nueva.jpg`])).rows.length === 1, 'Al aprobarla, ya la ven los demás');
await db.query(`delete from fotos_revision where ruta like $1`, [`${D}/%`]);
ok(!(await as(B, `select * from perros_cercanos(50)`)).rows.some(r => r.perro_id === perros[D]), 'Un perro sin 2 fotos aprobadas no aparece en Descubrir');
await aprobarFotos();

// Dogder Plus
// 52 perros de relleno cerca, con 2 fotos aprobadas, para probar los límites.
await db.exec(`
  insert into auth.users (id, raw_user_meta_data, email)
  select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
         jsonb_build_object('nombre', 'Relleno', 'apellido', 'Prueba', 'fecha_nacimiento', '1990-01-01', 'colonia', 'Roma'),
         'r' || i || '@x.com'
    from generate_series(1, 52) i;
  update perfiles set lat = 19.42, lng = -99.16 where nombre = 'Relleno';
  insert into perros (dueno_id, nombre, edad, raza, tamano, energia)
  select id, 'R' || row_number() over (), 2, 'Pug (Carlino)', 'Chico', 2 from perfiles where nombre = 'Relleno';
  insert into fotos (perro_id, ruta, orden)
  select p.id, p.id || '/' || o || '.jpg', o from perros p cross join generate_series(0, 1) o where p.nombre like 'R%' and p.raza = 'Pug (Carlino)';
`);
await aprobarFotos();
const relleno = (await db.query(`select id from perros where nombre like 'R%' and raza = 'Pug (Carlino)' order by nombre`)).rows.map(r => r.id);
const plan = async (u) => (await as(u, `select mi_plan() p`)).rows[0].p;
let pd = await plan(D);
ok(pd.plus === false && pd.likes_restantes <= 50 && pd.supers_restantes === 1, 'Una cuenta gratis tiene 50 me gusta y 1 súper hueso cada 24 h');
// D ya usó 49 me gusta hoy
await db.query(`delete from likes where de_perro = $1`, [perros[D]]);
await db.query(`insert into likes (de_perro, a_perro, tipo) select $1, unnest($2::uuid[]), 'like'`, [perros[D], relleno.slice(0, 49)]);
ok((await as(D, `select dar_like($1, 'like') r`, [relleno[49]])).rows[0].r.ok === true, 'El me gusta número 50 sí se puede');
const lim = (await as(D, `select dar_like($1, 'like') r`, [relleno[50]])).rows[0].r;
ok(lim.ok === false && lim.motivo === 'likes_agotados' && lim.disponible, 'El 51 ya no: se acabaron los me gusta del día');
ok((await as(D, `select dar_like($1, 'nope') r`, [relleno[50]])).rows[0].r.ok === true, 'Rechazar sigue siendo ilimitado');
ok((await plan(D)).likes_restantes === 0, 'La app ve que no le quedan me gusta');
await db.query(`update perfiles set plus_hasta = now() + interval '30 days' where id = $1`, [D]);
ok((await as(D, `select dar_like($1, 'like') r`, [relleno[51]])).rows[0].r.ok === true, 'Con Plus, me gusta sin límite');
pd = await plan(D);
ok(pd.plus === true && pd.likes_restantes === null && pd.supers_restantes === 5, 'Plus: sin límite de me gusta y 5 súper huesos');
await db.query(`delete from likes where de_perro = $1`, [perros[D]]);
for (let i = 0; i < 5; i++) await as(D, `select dar_like($1, 'super')`, [relleno[i]]);
ok((await as(D, `select dar_like($1, 'super') r`, [relleno[5]])).rows[0].r.motivo === 'super_agotado', 'El sexto súper hueso del día ya no');
ok(await fails_(A, `update perfiles set plus_hasta = now() + interval '1 year' where id = '${A}'`), 'Nadie puede darse Plus a sí mismo desde la app');

// Deshacer
await db.query(`update perfiles set plus_hasta = null, deshacer_usado = null where id = $1`, [D]);
await db.query(`delete from likes where de_perro = $1`, [perros[D]]);
await as(D, `select dar_like($1, 'like')`, [relleno[0]]);
await db.query(`update likes set creado = now() - interval '1 minute' where de_perro = $1`, [perros[D]]);
await as(D, `select dar_like($1, 'nope')`, [relleno[1]]);
ok((await as(D, `select deshacer_like($1) r`, [relleno[0]])).rows[0].r.motivo === 'solo_ultimo', 'Gratis: solo se puede deshacer el último');
ok((await as(D, `select deshacer_like($1) r`, [relleno[1]])).rows[0].r.ok === true, 'Gratis: el último sí se puede deshacer');
ok((await as(D, `select deshacer_like($1) r`, [relleno[0]])).rows[0].r.motivo === 'deshacer_agotado', 'Gratis: solo 1 deshacer cada 24 h');
await db.query(`update perfiles set plus_hasta = now() + interval '30 days' where id = $1`, [D]);
await as(D, `select dar_like($1, 'like')`, [relleno[1]]);
ok((await as(D, `select deshacer_like($1) r`, [relleno[0]])).rows[0].r.ok === true && (await as(D, `select deshacer_like($1) r`, [relleno[1]])).rows[0].r.ok === true, 'Plus: deshacer sin límite');

// Ver quién te dio like
await db.query(`delete from likes where a_perro = $1`, [perros[D]]);
await db.query(`insert into likes (de_perro, a_perro, tipo) values ($1, $3, 'like'), ($2, $3, 'super')`, [relleno[10], relleno[11], perros[D]]);
await db.query(`update perfiles set plus_hasta = null where id = $1`, [D]);
ok((await plan(D)).likes_recibidos === 2, 'Gratis: ve cuántos le dieron me gusta');
ok(await fails_(D, `select * from likes_recibidos()`), 'Gratis: no puede ver quiénes son');
await db.query(`update perfiles set plus_hasta = now() + interval '30 days' where id = $1`, [D]);
const quienes = (await as(D, `select * from likes_recibidos()`)).rows;
ok(quienes.length === 2 && quienes[0].te_dio_super === true && quienes[0].fotos.length === 2, 'Plus: ve quiénes le dieron me gusta (súper hueso primero)');
ok((await as(D, `select dar_like($1, 'like') r`, [relleno[10]])).rows[0].r.match_id, 'Plus: darle me gusta desde ahí es match directo');
ok((await plan(D)).likes_recibidos === 1, 'Al deslizarlo, deja de contar como pendiente');

// Filtros avanzados
await db.query(`update perfiles set lat = 19.42, lng = -99.16, plus_hasta = null where id = $1`, [D]);
ok((await as(D, `select * from perros_cercanos(10, p_razas => array['Golden Retriever'])`)).rows.length > 0, 'Gratis: el filtro de raza no aplica (es de Plus)');
await db.query(`update perfiles set plus_hasta = now() + interval '30 days' where id = $1`, [D]);
ok((await as(D, `select * from perros_cercanos(10, p_razas => array['Golden Retriever'])`)).rows.length === 0, 'Plus: el filtro de raza sí aplica');

// Modo viaje
await db.query(`update perfiles set plus_hasta = null where id = $1`, [D]);
ok(await fails_(D, `select activar_viaje(25.67, -100.31, 'Monterrey')`), 'Gratis: no hay modo viaje');
await db.query(`update perfiles set plus_hasta = now() + interval '30 days' where id = $1`, [D]);
await as(D, `select activar_viaje(25.67, -100.31, 'Monterrey')`);
ok((await plan(D)).viaje === 'Monterrey', 'Plus: activa el modo viaje');
ok((await as(D, `select * from perros_cercanos(50)`)).rows.length === 0, 'En modo viaje ve los perros de allá, no los de su colonia');
ok(!(await as(relleno.length && (await db.query('select dueno_id from perros where id = $1', [relleno[20]])).rows[0].dueno_id, `select * from perros_cercanos(50)`)).rows.some(r => r.perro_id === perros[D]), 'Y los de su colonia ya no lo ven cerca');
await db.query(`update perfiles set plus_hasta = now() - interval '1 day' where id = $1`, [D]);
ok((await as(D, `select * from perros_cercanos(50)`)).rows.length > 0, 'Si se le acaba Plus, vuelve a su ubicación real');
await as(D, `select quitar_viaje()`);
ok((await plan(D)).viaje === null, 'Se puede quitar el modo viaje');

// Limpieza
await db.query(`update perfiles set plus_hasta = null, deshacer_usado = null where id = $1`, [D]);
await db.query(`delete from auth.users where email like 'r%@x.com'`);

// Eliminar cuenta
await as(D, `select eliminar_cuenta()`);
const quedan = (await db.query(`select (select count(*) from perfiles where id = $1)::int p, (select count(*) from perros where dueno_id = $1)::int g, (select count(*) from fotos f join perros x on x.id = f.perro_id where x.dueno_id = $1)::int f`, [D])).rows[0];
ok(quedan.p + quedan.g + quedan.f === 0, 'Eliminar cuenta borra perfil, perro y fotos');

console.log(fails ? `\n${fails} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
process.exit(fails ? 1 : 0);
