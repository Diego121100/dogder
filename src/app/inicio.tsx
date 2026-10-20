import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, DemoBanner, Lead, Logo, Screen, Title } from '@/components/ui';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useSignup } from '@/lib/signup';

/**
 * Pantalla temporal después de verificar el correo o iniciar sesión.
 * Aquí irán el paso 3 (tu perro), el paso 4 (ubicación) y después Descubrir.
 */
export default function Home() {
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const { draft, reset } = useSignup();
  const [name, setName] = useState(draft.name);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getUser().then(({ data }) => {
      const n = data.user?.user_metadata?.nombre;
      if (typeof n === 'string') setName(n);
    });
  }, []);

  async function logout() {
    if (supabaseConfigured) await supabase.auth.signOut();
    reset();
    router.replace('/');
  }

  return (
    <Screen>
      <Logo />
      <Title>¡Hola{name ? `, ${name}` : ''}!</Title>
      <Lead>
        Tu cuenta está lista y tu correo verificado. Los siguientes pasos del registro, el perfil de tu perro y tu
        ubicación, están en construcción.
      </Lead>
      {demo === '1' && <DemoBanner>Esto fue una prueba: no se creó ninguna cuenta.</DemoBanner>}
      <Button title={demo === '1' ? 'Volver al inicio' : 'Cerrar sesión'} variant="secondary" onPress={logout} />
    </Screen>
  );
}
