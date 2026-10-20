import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Button, LinkButton, Logo, Screen } from '@/components/ui';
import { DogFace, SAMPLE_DOGS } from '@/components/DogFace';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { fonts, useColors } from '@/theme';

/** Bienvenida: la manada de perros, el título y los botones para entrar. */
export default function Welcome() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const [session, setSession] = useState<'loading' | 'in' | 'out'>(supabaseConfigured ? 'loading' : 'out');

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ? 'in' : 'out'));
  }, []);

  if (session === 'loading') return null;
  if (session === 'in') return <Redirect href="/inicio" />;

  const pack = Math.min(width - 40, 360);
  // Cada perro: círculo con borde azul marino y un aro verde limón por fuera, como en el prototipo.
  const pup = (i: number, size: number, style: object) => (
    <View style={[styles.pup, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.ball }, style]}>
      <View style={[styles.pupInner, { borderRadius: (size - 6) / 2, borderColor: c.welcomeBg }]}>
        <DogFace look={SAMPLE_DOGS[i]} size={size - 16} />
      </View>
    </View>
  );

  return (
    <Screen bg={c.welcomeBg}>
      <Logo color="#FFFFFF" />
      <View style={{ width: pack, height: pack * 0.92, alignSelf: 'center' }} accessible={false}>
        {pup(1, pack * 0.36, { left: 0, top: pack * 0.02, zIndex: 2 })}
        {pup(2, pack * 0.34, { right: 0, top: 0, zIndex: 2 })}
        {pup(0, pack * 0.52, { left: pack * 0.24, top: pack * 0.14, zIndex: 3 })}
        {pup(3, pack * 0.3, { left: pack * 0.06, bottom: 0, zIndex: 4 })}
        {pup(4, pack * 0.28, { right: pack * 0.06, bottom: pack * 0.04, zIndex: 4 })}
        <View style={[styles.tag, { top: pack * 0.04, alignSelf: 'center', transform: [{ rotate: '-3deg' }] }]}>
          <Text style={styles.tagText}>Canela · a 1 km</Text>
        </View>
        <View style={[styles.tag, { right: 4, bottom: pack * 0.34, backgroundColor: c.ball, transform: [{ rotate: '4deg' }] }]}>
          <Text style={styles.tagText}>¡Es un match!</Text>
        </View>
      </View>

      <Text style={styles.title} accessibilityRole="header">
        Tu mascota también merece <Text style={{ color: c.ball }}>conocer a alguien</Text>
      </Text>
      <Text style={[styles.lead, { color: c.welcomeMuted }]}>
        Conoce perros de tu colonia, haz match con sus dueños y organicen el próximo paso.
      </Text>

      <View style={{ flex: 1 }} />
      <Button title="Crear cuenta" variant="ball" onPress={() => router.push('/registro/cuenta')} />
      <View style={styles.loginRow}>
        <Text style={[styles.lead, { color: c.welcomeMuted, fontSize: 14 }]}>¿Ya tienes cuenta?</Text>
        <LinkButton title="Inicia sesión" color="#FFFFFF" onPress={() => router.push('/login')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pup: { position: 'absolute', padding: 3 },
  pupInner: { flex: 1, overflow: 'hidden', borderWidth: 5 },
  tag: {
    position: 'absolute',
    zIndex: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: '#18233A' },
  title: { fontFamily: fonts.display, fontSize: 42, lineHeight: 42, letterSpacing: -1.2, color: '#FFFFFF' },
  lead: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
});
