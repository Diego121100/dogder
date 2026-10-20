import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, DemoBanner, ErrorText, Field, LinkButton, Logo, Screen, Title } from '@/components/ui';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { authErrorMessage } from '@/lib/authErrors';
import { isValidEmail } from '@/lib/validation';
import { fonts, useColors } from '@/theme';

/** Inicio de sesión para quien ya tiene cuenta. */
export default function Login() {
  const c = useColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    if (!isValidEmail(email)) {
      setEmailError('Revisa tu correo, parece incompleto.');
      return;
    }
    if (!password) {
      setError('Escribe tu contraseña.');
      return;
    }
    if (!supabaseConfigured) {
      setError('Supabase todavía no está conectado, así que aún no se puede iniciar sesión.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (err) {
      setError(authErrorMessage(err));
      return;
    }
    router.replace('/inicio');
  }

  return (
    <Screen>
      <Logo />
      <Title>Qué gusto verte de nuevo</Title>
      {!supabaseConfigured && <DemoBanner>Supabase todavía no está conectado: el inicio de sesión se activará al conectarlo.</DemoBanner>}
      <Field label="Correo electrónico" value={email}
        onChangeText={(v) => { setEmail(v); setEmailError(''); }} error={emailError}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" />
      <Field label="Contraseña" secret value={password}
        onChangeText={(v) => { setPassword(v); setError(''); }}
        autoCapitalize="none" autoComplete="current-password" textContentType="password" />
      <ErrorText>{error}</ErrorText>
      <Button title="Entrar" onPress={submit} loading={loading} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <Text style={{ fontFamily: fonts.body, color: c.muted, fontSize: 14 }}>¿Eres nuevo?</Text>
        <LinkButton title="Crea una cuenta" onPress={() => router.replace('/registro/cuenta')} />
      </View>
      <LinkButton title="Volver al inicio" onPress={() => router.replace('/')} />
    </Screen>
  );
}
