import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Button, DemoBanner, Lead, Logo, Screen, Title } from '@/components/ui';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useSignup } from '@/lib/signup';
import { hasDog } from '@/lib/dog';
import { hasLocationPermission, hasSavedLocation, useLocationWatch } from '@/lib/location';
import { photoUrl } from '@/lib/photos';
import { fonts, radius, useColors } from '@/theme';

type Dog = { nombre: string; raza: string; foto?: string };

/**
 * Pantalla temporal después del registro o del inicio de sesión.
 * Si el perfil del perro no está completo, manda al paso 3.
 * Si falta la ubicación, manda a pedirla. Aquí irá Descubrir.
 */
export default function Home() {
  const c = useColors();
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const { draft, reset } = useSignup();
  const [name, setName] = useState(draft.name);
  const [state, setState] = useState<'loading' | 'needsDog' | 'needsLocation' | 'ready'>(supabaseConfigured ? 'loading' : 'ready');
  const [dog, setDog] = useState<Dog | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const n = data.user?.user_metadata?.nombre;
      if (typeof n === 'string') setName(n);
      if (!(await hasDog())) {
        setState('needsDog');
        return;
      }
      if (!(await hasLocationPermission()) || !(await hasSavedLocation())) {
        setState('needsLocation');
        return;
      }
      const { data: d } = await supabase
        .from('perros')
        .select('nombre, raza, fotos(ruta, orden)')
        .eq('dueno_id', data.user!.id)
        .order('orden', { referencedTable: 'fotos' })
        .limit(1, { referencedTable: 'fotos' })
        .single();
      if (d) setDog({ nombre: d.nombre, raza: d.raza, foto: d.fotos?.[0]?.ruta });
      setState('ready');
    })();
  }, []);

  // Mientras la app está abierta, la ubicación se actualiza sola.
  useLocationWatch(state === 'ready' && supabaseConfigured);

  if (state === 'loading') return null;
  if (state === 'needsLocation') return <Redirect href="/ubicacion" />;
  if (state === 'needsDog') return <Redirect href="/registro/perro" />;

  async function logout() {
    if (supabaseConfigured) await supabase.auth.signOut();
    reset();
    router.replace('/');
  }

  return (
    <Screen>
      <Logo />
      <Title>¡Hola{name ? `, ${name}` : ''}!</Title>
      {dog && (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          {dog.foto ? <Image source={{ uri: photoUrl(dog.foto) }} style={styles.photo} contentFit="cover" /> : null}
          <View style={{ padding: 14 }}>
            <Text style={[styles.dogName, { color: c.ink }]}>{dog.nombre}</Text>
            <Text style={{ fontFamily: fonts.body, color: c.muted }}>{dog.raza}</Text>
          </View>
        </View>
      )}
      <Lead>
        {dog
          ? `El perfil de ${dog.nombre} y tu ubicación ya están guardados. Lo siguiente es Descubrir: las tarjetas para deslizar, que están en construcción.`
          : 'Tu cuenta está lista. Descubrir está en construcción.'}
      </Lead>
      {demo === '1' && <DemoBanner>Esto fue una prueba: no se creó ninguna cuenta.</DemoBanner>}
      <Button title={demo === '1' ? 'Volver al inicio' : 'Cerrar sesión'} variant="secondary" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 4 / 3 },
  dogName: { fontFamily: fonts.display, fontSize: 24 },
});
