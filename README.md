# Dogder

App para que los dueños de perros se conozcan y organicen paseos, con el formato de Tinder y Bumble.
Hecha con **Expo (React Native)** y **Supabase**.

## Qué hay hasta ahora

- Bienvenida e inicio de sesión.
- Registro completo: 1) tu cuenta, 2) código de 6 dígitos por correo, 3) perfil del perro con 2 a 6 fotos,
  4) ubicación obligatoria (redondeada a ~500 m).
- Descubrir: tarjetas para deslizar, Volver, Rechazar, Súper hueso (1 cada 24 h) y Me gusta, pantalla de match
  y perfil completo al tocar la tarjeta.
- Matches y chat en tiempo real, con mensajes sin leer y la pestaña de Matches con su contador.
- Mi perro: editar perfil y fotos, usuarios bloqueados, contacto, documentos legales, cerrar sesión y eliminar cuenta.
- Reportar y bloquear desde el chat y desde el perfil completo.
- Filtros en Descubrir: distancia, macho/hembra, tamaño, edad, energía y razas.
- Panel de moderación (solo moderadores): reportes con la conversación, descartar, advertir, suspender y reactivar.
- Filtro de contenido: groserías tapadas con **** en el chat y en el perfil, aviso de seguridad al compartir
  teléfono o redes, y revisión automática de fotos.
- Términos y Condiciones, Aviso de Privacidad y Normas de la comunidad.
- La base de datos en `supabase/migrations/`, con reglas de seguridad (RLS) para perfiles, perros, fotos, likes,
  súper hueso, matches, chat, bloqueos, reportes y eliminar cuenta, y 31 pruebas en `supabase/tests/`.

Antes de publicar: cambiar el correo de contacto en `src/content/contacto.ts`.

## Perros de prueba

Para tener tarjetas que deslizar mientras no hay más usuarios, ejecuta en el SQL Editor de Supabase
`supabase/seed/perros_de_prueba.sql`: crea 9 perros falsos alrededor de tu ubicación (4 ya le dieron
me gusta a tu perro). Si además ejecutas `supabase/seed/respuestas_de_prueba.sql`, los dueños de prueba
contestan solos en el chat. Para volver a empezar (que los 9 te den me gusta y vuelvan a salir en
Descubrir), ejecuta `supabase/seed/reiniciar_pruebas.sql`. Para recibir un súper hueso de prueba con la app
abierta, ejecuta `supabase/seed/recibir_super_de_prueba.sql`. Para quitarlo todo, ejecuta `supabase/seed/borrar_perros_de_prueba.sql`.

## Probar la app en tu celular

1. Instala [Node.js](https://nodejs.org) (versión 20 o más reciente) en tu computadora.
2. En esta carpeta, ejecuta:
   ```
   npm install
   npx expo start
   ```
3. Instala **Expo Go** en tu celular y escanea el código QR que aparece en la terminal.

Sin Supabase conectado la app funciona en **modo de prueba**: puedes recorrer el registro y el código
de verificación es `000000`, pero no se crea ninguna cuenta.

## Conectar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (región sugerida: la más cercana a México).
2. En **SQL Editor > New query**, pega y ejecuta (**Run**) cada archivo de `supabase/migrations/`, en orden por nombre.
   Truco en Mac: `pbcopy < supabase/migrations/<archivo>.sql` lo copia completo.
3. En **Authentication > Email Templates > Confirm signup**, cambia el contenido para que el correo
   muestre el código en lugar de un enlace, por ejemplo:
   ```
   <h2>Tu código de Dogder</h2>
   <p>Usa este código para verificar tu correo: <strong>{{ .Token }}</strong></p>
   <p>Vence en 10 minutos. Si no creaste una cuenta en Dogder, ignora este mensaje.</p>
   ```
4. En **Authentication > Sign In / Providers > Email**, deja activado *Confirm email* y pon
   *Email OTP Expiration* en `600` segundos (10 minutos).
5. Para que los correos salgan desde tu dominio, en **Authentication > Emails > SMTP Settings** usa los
   datos SMTP de Resend (`smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = tu API key de Resend).
6. Copia `.env.example` como `.env` y llena los valores de **Project Settings > API**:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
   Esas dos claves son públicas. **Nunca** pongas en la app la *secret key* ni la contraseña de la base de datos.
7. Vuelve a ejecutar `npx expo start`.

## Filtro de fotos (OpenAI Moderation)

Cada foto nueva se revisa automáticamente. Mientras no se revisa, solo la ve su dueño; si no pasa, se borra.

1. Crea una cuenta en https://platform.openai.com y una clave en **API keys** (la revisión es gratis).
2. En Supabase > **Edge Functions** > **Secrets**, agrega `OPENAI_API_KEY` con esa clave.
   La clave va solo ahí: **nunca** en la app ni en GitHub.
3. En Supabase > **Edge Functions** > **Deploy a new function** > **Via Editor**: nómbrala `revisar-fotos`,
   pega el contenido de `supabase/functions/revisar-fotos/index.ts` y despliégala.
4. En los ajustes de la función, apaga **Verify JWT** (la función ya revisa la sesión por su cuenta).

## Dogder Plus

| Gratis | Dogder Plus |
|---|---|
| 50 me gusta cada 24 h (rechazar es ilimitado) | Me gusta sin límite |
| 1 súper hueso cada 24 h | 5 súper huesos cada 24 h |
| Volver: solo el último, 1 vez al día | Volver sin límite |
| Filtros: distancia, sexo y tamaño | + edad, energía y razas |
| Ve cuántos le dieron me gusta | Ve quiénes son y hace match directo |
| | Buscar en otra zona (ciudad o colonia) |

Todo se valida en el servidor (`supabase/migrations/20261021180000_plus.sql`). Quién es Plus lo dice
`perfiles.plus_hasta`; la app no lo puede cambiar. Mientras no haya cobro, para probar ejecuta
`supabase/seed/activar_plus_de_prueba.sql` (30 días) y `supabase/seed/quitar_plus_de_prueba.sql`.
Cuando la app esté en las tiendas, el cobro se conecta con RevenueCat, que actualizará `plus_hasta`.

## Moderación

Para darte acceso al panel (Mi perro > Panel de moderación), ejecuta en el SQL Editor, con tu correo:
```sql
insert into public.moderadores (usuario) select id from auth.users where email = 'tu-correo@ejemplo.com';
```
Para probarlo con reportes falsos, ejecuta `supabase/seed/moderacion_de_prueba.sql`.

## Comandos

| Comando | Para qué |
| --- | --- |
| `npx expo start` | Abrir la app en modo desarrollo |
| `npm run typecheck` | Revisar los tipos de TypeScript |
| `npm run lint` | Revisar el estilo del código |
| `npm run test:db` | Probar las reglas de seguridad de la base de datos |

## Estructura

```
src/app/          Pantallas (cada archivo es una ruta de Expo Router)
src/components/   Botones, campos, ilustraciones
src/content/      Textos legales
src/lib/          Supabase, validaciones y estado del registro
src/theme.ts      Colores y tipografías de Dogder
supabase/         Base de datos y sus pruebas
```

## Antes de publicar

- Completar los datos resaltados en verde en los documentos legales y que un abogado los revise.
- Revisar la marca “Dogder” en el IMPI.
- Ver el plan completo en el documento *Plan para lanzar Dogder*.
