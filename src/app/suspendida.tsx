import { Linking, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Lead, Logo, Screen, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useSignup } from '@/lib/signup';
import { CONTACT_EMAIL } from '@/content/contacto';
import { fonts, radius, useColors } from '@/theme';

/** Pantalla para una cuenta suspendida: no se puede usar la app, solo pedir revisión o salir. */
export default function Suspended() {
  const c = useColors();
  const { reset } = useSignup();
  const { motivo } = useLocalSearchParams<{ motivo?: string }>();

  async function logout() {
    await supabase.auth.signOut();
    reset();
    router.replace('/');
  }

  return (
    <Screen>
      <Logo />
      <Title>Tu cuenta está suspendida</Title>
      <Lead>
        Revisamos reportes sobre tu cuenta y encontramos que no cumple las Normas de la comunidad. Mientras esté
        suspendida no podrás ver perros ni enviar mensajes, y tu perro no aparecerá para nadie.
      </Lead>
      {motivo ? (
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[styles.label, { color: c.muted }]}>Motivo</Text>
          <Text style={[styles.text, { color: c.ink }]}>{motivo}</Text>
        </View>
      ) : null}
      <Lead>Si crees que es un error, escríbenos a {CONTACT_EMAIL} y lo revisamos.</Lead>
      <Button
        title="Escribir al equipo de Dogder"
        onPress={() =>
          Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Dogder: revisión de suspensión')}`).catch(() => {})
        }
      />
      <Button title="Normas de la comunidad" variant="secondary"
        onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'normas' } })} />
      <Button title="Cerrar sesión" variant="secondary" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: 14, gap: 4 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase' },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
});
