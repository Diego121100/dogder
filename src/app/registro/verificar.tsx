import { ComponentRef, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, DemoBanner, ErrorText, Lead, LinkButton, Screen, Steps, Title } from '@/components/ui';
import { useSignup } from '@/lib/signup';
import { supabase } from '@/lib/supabase';
import { authErrorMessage } from '@/lib/authErrors';
import { maskEmail } from '@/lib/validation';
import { fonts, radius, useColors } from '@/theme';

const LENGTH = 6;
const RESEND_SECONDS = 30;
const DEMO_CODE = '000000';

/** Registro, paso 2 de 4: el código de 6 dígitos que llega al correo. */
export default function VerifyEmail() {
  const c = useColors();
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const isDemo = demo === '1';
  const { draft } = useSignup();
  const email = draft.email.trim().toLowerCase();

  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function verify(value: string) {
    if (value.length < LENGTH) {
      setError('Escribe los 6 dígitos del código.');
      return;
    }
    setChecking(true);
    setError('');
    if (isDemo) {
      setChecking(false);
      if (value !== DEMO_CODE) {
        setError('El código no es correcto. En el modo de prueba usa 000000.');
        setCode('');
        return;
      }
      router.replace({ pathname: '/inicio', params: { demo: '1' } });
      return;
    }
    const { error: err } = await supabase.auth.verifyOtp({ email, token: value, type: 'email' });
    setChecking(false);
    if (err) {
      setError(authErrorMessage(err));
      setCode('');
      input.current?.focus();
      return;
    }
    router.replace('/inicio');
  }

  async function resend() {
    setError('');
    setWait(RESEND_SECONDS);
    if (isDemo) return;
    const { error: err } = await supabase.auth.resend({ type: 'signup', email });
    if (err) setError(authErrorMessage(err));
  }

  function onChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, LENGTH);
    setCode(digits);
    setError('');
    if (digits.length === LENGTH) verify(digits);
  }

  return (
    <Screen>
      <Steps step={2} total={4} label="Verifica tu correo" />
      <Title>Revisa tu correo</Title>
      <Lead>
        Enviamos un código de 6 dígitos a <Text style={{ fontFamily: fonts.bodyBold, color: c.ink }}>{maskEmail(email) || 'tu correo'}</Text>.
        Escríbelo aquí para confirmar que el correo es tuyo.
      </Lead>

      {isDemo && <DemoBanner>Supabase todavía no está conectado, así que no se envía ningún correo. Usa el código 000000.</DemoBanner>}

      <View>
        <Pressable style={styles.boxes} onPress={() => input.current?.focus()} accessible={false}>
          {Array.from({ length: LENGTH }, (_, i) => {
            const active = i === Math.min(code.length, LENGTH - 1);
            return (
              <View
                key={i}
                style={[
                  styles.box,
                  { backgroundColor: c.surface, borderColor: error ? c.coral : active ? c.ink : c.line },
                  active && { borderWidth: 2 },
                ]}
              >
                <Text style={[styles.digit, { color: c.ink }]}>{code[i] ?? ''}</Text>
              </View>
            );
          })}
        </Pressable>
        <TextInput
          ref={input}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={LENGTH}
          autoFocus
          accessibilityLabel="Código de verificación de 6 dígitos"
          caretHidden
          style={styles.hiddenInput}
        />
      </View>
      <ErrorText>{error}</ErrorText>

      <Button title="Verificar" onPress={() => verify(code)} loading={checking} />

      <View style={{ alignItems: 'center', gap: 6 }}>
        {wait > 0 ? (
          <Text style={[styles.help, { color: c.muted }]}>
            ¿No te llegó? Podrás pedir otro código en {wait} s. Revisa también tu carpeta de spam.
          </Text>
        ) : (
          <LinkButton title="Reenviar código" onPress={resend} />
        )}
        <Text style={[styles.help, { color: c.muted }]}>¿Escribiste mal tu correo?</Text>
        <LinkButton title="Cámbialo" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', gap: 8 },
  box: { flex: 1, aspectRatio: 0.82, borderWidth: 1.5, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: fonts.display, fontSize: 26 },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  help: { fontFamily: fonts.body, fontSize: 13.5, textAlign: 'center', lineHeight: 19 },
});
