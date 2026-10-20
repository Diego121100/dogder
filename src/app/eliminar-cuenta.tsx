import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Button, ErrorText, Field, Lead, Screen, Title } from '@/components/ui';
import { deleteAccount, loadMyProfile } from '@/lib/account';
import { useSignup } from '@/lib/signup';
import { fonts, radius, useColors } from '@/theme';

/** Eliminar la cuenta (requisito de Apple). Pide la contraseña para confirmar. */
export default function DeleteAccount() {
  const c = useColors();
  const { reset } = useSignup();
  const [email, setEmail] = useState('');
  const [dogName, setDogName] = useState('tu perro');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadMyProfile().then((me) => {
      if (!me) return;
      setEmail(me.email);
      if (me.dog) setDogName(me.dog.draft.name);
    });
  }, []);

  async function confirm() {
    if (!password) {
      setError('Escribe tu contraseña para confirmar.');
      return;
    }
    setDeleting(true);
    setError('');
    const r = await deleteAccount(email, password);
    setDeleting(false);
    if (r === 'wrong_password') return setError('La contraseña no coincide. Inténtalo de nuevo.');
    if (r === 'error') return setError('No pudimos eliminar tu cuenta. Revisa tu conexión e inténtalo de nuevo.');
    reset();
    router.dismissAll?.();
    router.replace('/');
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancelar y volver" hitSlop={6}
        style={[styles.back, { borderColor: c.line, backgroundColor: c.surface }]}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.ink} strokeWidth={2.5} strokeLinecap="round">
          <Path d="M15 5l-7 7 7 7" />
        </Svg>
      </Pressable>
      <Title>¿Eliminar tu cuenta?</Title>
      <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
        {[
          `Se borran tu cuenta, el perfil de ${dogName} y todas sus fotos.`,
          'Se borran tus matches y conversaciones.',
          `Nadie podrá volver a ver a ${dogName} en Dogder.`,
        ].map((t) => (
          <View key={t} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={[styles.text, { color: c.muted }]}>•</Text>
            <Text style={[styles.text, { color: c.muted, flex: 1 }]}>{t}</Text>
          </View>
        ))}
        <Text style={[styles.text, { color: c.ink, fontFamily: fonts.bodyBold }]}>No se puede deshacer.</Text>
      </View>
      <Lead>Para confirmar, escribe tu contraseña.</Lead>
      <Field label="Contraseña" secret value={password} onChangeText={(v) => { setPassword(v); setError(''); }}
        autoCapitalize="none" autoComplete="current-password" textContentType="password" />
      <ErrorText>{error}</ErrorText>
      <View style={{ flex: 1 }} />
      <Button title="Eliminar mi cuenta" variant="danger" onPress={confirm} loading={deleting} />
      <Button title="Cancelar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  box: { borderWidth: 1, borderRadius: radius.md, padding: 14, gap: 6 },
  text: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21 },
});
