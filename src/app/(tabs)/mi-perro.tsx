import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path } from 'react-native-svg';
import { Button, Screen, Title } from '@/components/ui';
import { sexLabel } from '@/components/Choices';
import { loadMyProfile, MyProfile } from '@/lib/account';
import { ENERGY_NAMES } from '@/lib/discover';
import { photoUrl } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { useSignup } from '@/lib/signup';
import { CONTACT_EMAIL } from '@/content/contacto';
import { fonts, radius, useColors } from '@/theme';

/** Renglón de la lista de opciones (Usuarios bloqueados, Contacto, documentos…). */
function Row({ label, onPress, danger, detail }: { label: string; onPress: () => void; danger?: boolean; detail?: string }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, { borderBottomColor: c.line, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={[styles.rowText, { color: danger ? c.coral : c.ink }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
        {detail ? <Text style={[styles.rowDetail, { color: c.muted }]} numberOfLines={1}>{detail}</Text> : null}
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth={2.5} strokeLinecap="round">
          <Path d="M9 5l7 7-7 7" />
        </Svg>
      </View>
    </Pressable>
  );
}

/** Mi perro: el perfil, la cuenta, seguridad, documentos y salir. */
export default function MyDogTab() {
  const c = useColors();
  const { reset } = useSignup();
  const [me, setMe] = useState<MyProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadMyProfile().then(setMe).catch(() => {});
    }, []),
  );

  const dog = me?.dog?.draft;

  function logout() {
    Alert.alert('¿Cerrar sesión?', 'Podrás volver a entrar con tu correo y contraseña.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          reset();
          router.replace('/');
        },
      },
    ]);
  }

  async function contact() {
    const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Dogder: ayuda o reporte')}`;
    try {
      await Linking.openURL(url);
    } catch {
      await Clipboard.setStringAsync(CONTACT_EMAIL);
      Alert.alert('Correo copiado', `Escríbenos a ${CONTACT_EMAIL}. Ya lo copiamos para que lo pegues en tu app de correo.`);
    }
  }

  return (
    <Screen>
      <Title>Mi perro</Title>

      {dog && (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          {dog.photos[0] ? <Image source={{ uri: photoUrl(dog.photos[0]) }} style={styles.photo} contentFit="cover" /> : null}
          <View style={{ padding: 14, gap: 8 }}>
            <Text style={[styles.name, { color: c.ink }]}>
              {dog.name} <Text style={[styles.age, { color: c.muted }]}>{dog.age}</Text>
            </Text>
            <View style={styles.chips}>
              {[dog.sex ? sexLabel(dog.sex) : null, dog.breed, dog.size, ENERGY_NAMES[(dog.energy || 3) - 1]]
                .filter((t): t is string => !!t)
                .map((t) => (
                  <View key={t} style={[styles.chip, { borderColor: c.line, backgroundColor: c.bg }]}>
                    <Text style={[styles.chipText, { color: c.ink }]}>{t}</Text>
                  </View>
                ))}
            </View>
            <Text style={[styles.bio, { color: c.muted }]} numberOfLines={3}>{dog.bio}</Text>
            <Button title="Editar perfil y fotos" variant="secondary" onPress={() => router.push('/editar-perro')} />
          </View>
        </View>
      )}

      <View>
        <Text style={[styles.section, { color: c.muted }]}>Mi cuenta</Text>
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[styles.owner, { color: c.ink }]}>{me ? `${me.nombre} ${me.apellido}` : ' '}</Text>
          <Text style={[styles.ownerSub, { color: c.muted }]}>{me?.email}</Text>
          <Text style={[styles.ownerSub, { color: c.muted }]}>{me ? `${me.colonia} · Miembro desde ${me.desde}` : ' '}</Text>
        </View>
      </View>

      <View>
        <Text style={[styles.section, { color: c.muted }]}>Seguridad y ayuda</Text>
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line, paddingVertical: 0 }]}>
          <Row label="Usuarios bloqueados" onPress={() => router.push('/bloqueados')} />
          <Row label="Contáctanos o reporta un problema" detail={CONTACT_EMAIL} onPress={contact} />
          <Row label="Normas de la comunidad" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'normas' } })} />
          <Row label="Términos y Condiciones" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terminos' } })} />
          <Row label="Aviso de Privacidad" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacidad' } })} />
        </View>
      </View>

      <Button title="Cerrar sesión" variant="secondary" onPress={logout} />
      <Pressable onPress={() => router.push('/eliminar-cuenta')} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
        <Text style={[styles.delete, { color: c.muted }]}>Eliminar cuenta</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 4 / 3 },
  name: { fontFamily: fonts.display, fontSize: 26 },
  age: { fontFamily: fonts.displaySemi, fontSize: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  bio: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21 },
  section: { fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  box: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  owner: { fontFamily: fonts.bodyBold, fontSize: 16 },
  ownerSub: { fontFamily: fonts.body, fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { fontFamily: fonts.bodySemi, fontSize: 15, flexShrink: 0 },
  rowDetail: { fontFamily: fonts.body, fontSize: 13, flexShrink: 1 },
  delete: { fontFamily: fonts.bodyBold, fontSize: 14, textDecorationLine: 'underline' },
});
