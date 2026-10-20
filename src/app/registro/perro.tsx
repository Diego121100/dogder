import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, DemoBanner, ErrorText, Field, Lead, Row, Screen, Steps, Title } from '@/components/ui';
import { PhotoGallery } from '@/components/PhotoGallery';
import { BreedPicker } from '@/components/BreedPicker';
import { EnergyPicker, SizePicker } from '@/components/Choices';
import { DogDraft, DogErrors, emptyDog, saveDog, validateDog } from '@/lib/dog';
import { supabaseConfigured } from '@/lib/supabase';
import { fonts, useColors } from '@/theme';

/** Registro, paso 3 de 4: el perfil del perro. */
export default function SignupDog() {
  const c = useColors();
  const [dog, setDog] = useState<DogDraft>(emptyDog);
  const [errors, setErrors] = useState<DogErrors>({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<DogDraft>) => {
    setDog((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof DogErrors];
      return next;
    });
  };

  async function submit() {
    setServerError('');
    const found = validateDog(dog);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (!supabaseConfigured) {
      router.replace({ pathname: '/inicio', params: { demo: '1' } });
      return;
    }
    setSaving(true);
    try {
      await saveDog(dog);
      router.replace('/inicio');
    } catch (e) {
      if (__DEV__) console.warn('[Guardar perro]', e);
      setServerError('No pudimos guardar el perfil. Revisa tu conexión a internet e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Steps step={3} total={4} label="Tu perro" />
      <Title>Ahora, el protagonista</Title>
      <Lead>Este es el perfil que verán los demás al deslizar. Puedes cambiarlo cuando quieras.</Lead>
      {!supabaseConfigured && <DemoBanner>Supabase no está conectado: el perfil no se guardará.</DemoBanner>}

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: c.muted }}>
          Fotos de tu perro
        </Text>
        <PhotoGallery photos={dog.photos} onChange={(photos) => set({ photos })} />
        <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: c.muted }}>
          Sube mínimo 2 y hasta 6 fotos para presumirlo. La principal es la que verán primero; toca cualquier otra para
          hacerla principal.
        </Text>
        <ErrorText>{errors.photos}</ErrorText>
      </View>

      <Row>
        <Field label="Nombre" value={dog.name} onChangeText={(name) => set({ name })} error={errors.name}
          placeholder="Ej. Rocky" maxLength={20} />
        <Field label="Edad (años)" value={dog.age} onChangeText={(v) => set({ age: v.replace(/\D/g, '').slice(0, 2) })}
          error={errors.age} placeholder="3" keyboardType="number-pad" maxLength={2} />
      </Row>
      <BreedPicker value={dog.breed} onChange={(breed) => set({ breed })} error={errors.breed} />
      <SizePicker value={dog.size} onChange={(size) => set({ size })} />
      <EnergyPicker value={dog.energy} onChange={(energy) => set({ energy })} error={errors.energy} />
      <Field label="Sobre tu perro" value={dog.bio} onChangeText={(bio) => set({ bio })} multiline maxLength={160}
        placeholder="¿Qué le encanta? ¿Cómo es con otros perros?" style={{ minHeight: 90, textAlignVertical: 'top' }}
        help={`${dog.bio.length}/160`} />

      <ErrorText>{serverError}</ErrorText>
      <Button title={saving ? 'Subiendo fotos…' : 'Crear mi perfil'} onPress={submit} loading={saving} />
    </Screen>
  );
}
