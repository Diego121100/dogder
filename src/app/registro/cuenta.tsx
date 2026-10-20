import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { Button, DemoBanner, ErrorText, Field, Lead, LinkButton, Row, Screen, Steps, Title } from '@/components/ui';
import { Check } from '@/components/Check';
import { useSignup } from '@/lib/signup';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { authErrorMessage } from '@/lib/authErrors';
import { dmyToIso, formatDmyInput, SignupErrors, validateSignup } from '@/lib/validation';
import { fonts, useColors } from '@/theme';

/** Registro, paso 1 de 4: datos del dueño. */
export default function SignupAccount() {
  const c = useColors();
  const { draft, setDraft } = useSignup();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [errors, setErrors] = useState<SignupErrors>({});
  const [serverError, setServerError] = useState('');
  const [sending, setSending] = useState(false);

  const set = (patch: Partial<typeof draft>) => {
    setDraft({ ...draft, ...patch });
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof SignupErrors];
      return next;
    });
  };

  const openDoc = (doc: 'terminos' | 'privacidad' | 'normas') =>
    router.push({ pathname: '/legal/[doc]', params: { doc, from: 'registro' } });

  async function submit() {
    setServerError('');
    const found = validateSignup({ ...draft, password, password2 });
    setErrors(found);
    if (Object.keys(found).length) return;

    if (!supabaseConfigured) {
      router.push({ pathname: '/registro/verificar', params: { demo: '1' } });
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.signUp({
      email: draft.email.trim().toLowerCase(),
      password,
      options: {
        data: {
          nombre: draft.name.trim(),
          apellido: draft.lastName.trim(),
          fecha_nacimiento: dmyToIso(draft.birth),
          colonia: draft.zone.trim(),
        },
      },
    });
    setSending(false);
    if (error) {
      const msg = authErrorMessage(error);
      if (error.code === 'user_already_exists' || error.code === 'email_exists') setErrors({ email: msg });
      else setServerError(msg);
      return;
    }
    router.push('/registro/verificar');
  }

  const link = (title: string, doc: 'terminos' | 'privacidad' | 'normas') => (
    <Text style={{ fontFamily: fonts.bodyBold, textDecorationLine: 'underline' }} onPress={() => openDoc(doc)} accessibilityRole="link">
      {title}
    </Text>
  );

  return (
    <Screen>
      <Steps step={1} total={4} label="Tu cuenta" />
      <Title>Primero, cuéntanos de ti</Title>
      <Lead>Los otros dueños verán tu nombre y tu colonia. Tu correo y tu fecha de nacimiento son privados.</Lead>

      {!supabaseConfigured && (
        <DemoBanner>Supabase todavía no está conectado: puedes recorrer el registro, pero no se crea ninguna cuenta.</DemoBanner>
      )}

      <Row>
        <Field label="Nombre" value={draft.name} onChangeText={(v) => set({ name: v })} error={errors.name}
          placeholder="Ej. Mariana" autoComplete="given-name" textContentType="givenName" maxLength={30} />
        <Field label="Apellido" value={draft.lastName} onChangeText={(v) => set({ lastName: v })} error={errors.lastName}
          placeholder="Ej. López" autoComplete="family-name" textContentType="familyName" maxLength={40} />
      </Row>
      <Field label="Correo electrónico" value={draft.email} onChangeText={(v) => set({ email: v })} error={errors.email}
        placeholder="tucorreo@ejemplo.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
        autoComplete="email" textContentType="emailAddress" />
      <Field label="Contraseña" secret value={password}
        onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
        error={errors.password} help="Al menos 8 caracteres y un número." placeholder="Mínimo 8 caracteres"
        autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
      <Field label="Confirma tu contraseña" secret value={password2}
        onChangeText={(v) => { setPassword2(v); setErrors((e) => ({ ...e, password2: undefined })); }}
        error={errors.password2} placeholder="Escríbela de nuevo" autoCapitalize="none"
        autoComplete="new-password" textContentType="newPassword" />
      <Row>
        <Field label="Nacimiento" value={draft.birth} onChangeText={(v) => set({ birth: formatDmyInput(v) })}
          error={errors.birth} placeholder="DD/MM/AAAA" keyboardType="number-pad" maxLength={10}
          autoComplete="birthdate-full" />
        <Field label="Colonia" value={draft.zone} onChangeText={(v) => set({ zone: v })} error={errors.zone}
          placeholder="Ej. Roma Sur" maxLength={60} />
      </Row>

      <Check checked={draft.accepted} onChange={(v) => set({ accepted: v })}
        label="Acepto los Términos y Condiciones, el Aviso de Privacidad y las Normas de la comunidad, y declaro ser mayor de 18 años">
        He leído y acepto los {link('Términos y Condiciones', 'terminos')}, el {link('Aviso de Privacidad', 'privacidad')} y
        las {link('Normas de la comunidad', 'normas')}. Declaro ser mayor de 18 años.
      </Check>
      <ErrorText>{errors.accepted}</ErrorText>

      <ErrorText>{serverError}</ErrorText>
      <Button title="Continuar" onPress={submit} loading={sending} />
      <LinkButton title="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} color={c.ink} />
    </Screen>
  );
}
