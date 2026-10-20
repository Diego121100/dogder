import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Button, Lead, Screen } from '@/components/ui';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { photoUrl } from '@/lib/photos';
import { fonts, useColors } from '@/theme';

/** Fin del registro: "¡Listo, Diego!" con la foto principal del perro. */
export default function SignupDone() {
  const c = useColors();
  const [info, setInfo] = useState<{ owner: string; dog: string; zone: string; foto?: string } | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: p }, { data: d }] = await Promise.all([
        supabase.from('perfiles').select('nombre, colonia').eq('id', u.user.id).single(),
        supabase
          .from('perros')
          .select('nombre, fotos(ruta, orden)')
          .eq('dueno_id', u.user.id)
          .order('orden', { referencedTable: 'fotos' })
          .limit(1, { referencedTable: 'fotos' })
          .single(),
      ]);
      setInfo({ owner: p?.nombre ?? '', zone: p?.colonia ?? '', dog: d?.nombre ?? '', foto: d?.fotos?.[0]?.ruta });
    })();
  }, []);

  return (
    <Screen>
      <View style={{ flex: 1 }} />
      <View style={[styles.photo, { borderColor: c.ball, backgroundColor: c.surface }]}>
        {info?.foto ? <Image source={{ uri: photoUrl(info.foto) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </View>
      <Text style={[styles.title, { color: c.ink }]} accessibilityRole="header">
        ¡Listo{info?.owner ? `, ${info.owner}` : ''}!
      </Text>
      <Lead>
        {info
          ? `El perfil de ${info.dog} ya está visible para los perros de ${info.zone} y alrededores.`
          : 'Tu perfil ya está listo.'}
      </Lead>
      <View style={{ flex: 1 }} />
      <Button title="Empezar a descubrir" onPress={() => router.replace('/inicio')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: 240, height: 240, borderRadius: 120, borderWidth: 6, overflow: 'hidden', alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: 34, textAlign: 'center', letterSpacing: -0.6 },
});
