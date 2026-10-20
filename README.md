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
- Términos y Condiciones, Aviso de Privacidad y Normas de la comunidad.
- La base de datos en `supabase/migrations/`, con reglas de seguridad (RLS) para perfiles, perros, fotos, likes,
  súper hueso, matches, chat, bloqueos, reportes y eliminar cuenta, y 31 pruebas en `supabase/tests/`.

Siguen: filtros, Mi perro (editar perfil), reportar y bloquear, eliminar cuenta.

## Perros de prueba

Para tener tarjetas que deslizar mientras no hay más usuarios, ejecuta en el SQL Editor de Supabase
`supabase/seed/perros_de_prueba.sql`: crea 9 perros falsos alrededor de tu ubicación (4 ya le dieron
me gusta a tu perro). Si además ejecutas `supabase/seed/respuestas_de_prueba.sql`, los dueños de prueba
contestan solos en el chat. Para quitarlo todo, ejecuta `supabase/seed/borrar_perros_de_prueba.sql`.

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
