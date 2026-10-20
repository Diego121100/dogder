import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Button, ErrorText, Field, Row, Screen, Title } from '@/components/ui';
import { PhotoGallery } from '@/components/PhotoGallery';
import { BreedPicker } from '@/components/BreedPicker';
import { EnergyPicker, SexPicker, SizePicker } from '@/components/Choices';
import { DogDraft, DogErrors, validateDog } from '@/lib/dog';
import { loadMyProfile, saveDogEdits } from '@/lib/account';
import { fonts, useColors } from '@/theme';

/** Editar el perfil de mi perro y sus fotos. */
export default function EditDog() {
  const c = useColors();
  const [dog, setDog] = useState<DogDraft | null>(null);
  const ids = useRef<{ userId: string; dogId: string; before: string[] } | null>(null);
  const [errors, setErrors] = useState<DogErrors>({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMyProfile()
      .then((me) => {
        if (!me?.dog) return;
        ids.current = { userId: me.userId, dogId: me.dog.id, before: me.dog.draft.photos };
        setDog(me.dog.draft);
      })
      .catch(() => setServerError('No pudimos cargar el perfil. Revisa tu conexión.'));
  }, []);

  const set = (patch: Partial<DogDraft>) => {
    setDog((d) => (d ? { ...d, ...patch } : d));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof DogErrors];
      return next;
    });
  };

  async function save() {
    if (!dog || !ids.current) return;
    setServerError('');
    const found = validateDog(dog);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await saveDogEdits(ids.current.userId, ids.current.dogId, ids.current.before, dog);
      router.back();
    } catch (e) {
      if (__DEV__) console.warn('[Editar perro]', e);
      setServerError('No pudimos guardar los cambios. Revisa tu conexión a internet e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancelar y volver" hitSlop={6}
        style={[styles.back, { borderColor: c.line, backgroundColor: c.surface }]}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.ink} strokeWidth={2.5} strokeLinecap="round">
          <Path d="M15 5l-7 7 7 7" />
        </Svg>
      </Pressable>
      <Title>Editar perfil</Title>
      {!dog ? (
        serverError ? <ErrorText>{serverError}</ErrorText> : <ActivityIndicator color={c.ink} />
      ) : (
        <>
          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: c.muted }]}>Fotos de {dog.name || 'tu perro'}</Text>
            <PhotoGallery photos={dog.photos} onChange={(photos) => set({ photos })} />
            <Text style={[styles.help, { color: c.muted }]}>
              Mínimo 2 y hasta 6 fotos. Toca una para hacerla principal; la × la quita.
            </Text>
            <ErrorText>{errors.photos}</ErrorText>
          </View>
          <Row>
            <Field label="Nombre" value={dog.name} onChangeText={(name) => set({ name })} error={errors.name} maxLength={20} />
            <Field label="Edad (años)" value={dog.age} onChangeText={(v) => set({ age: v.replace(/\D/g, '').slice(0, 2) })}
              error={errors.age} keyboardType="number-pad" maxLength={2} />
          </Row>
          <SexPicker value={dog.sex} onChange={(sex) => set({ sex })} error={errors.sex} />
          <BreedPicker value={dog.breed} onChange={(breed) => set({ breed })} error={errors.breed} />
          <SizePicker value={dog.size} onChange={(size) => set({ size })} />
          <EnergyPicker value={dog.energy} onChange={(energy) => set({ energy })} error={errors.energy} />
          <Field label="Sobre tu perro" value={dog.bio} onChangeText={(bio) => set({ bio })} multiline maxLength={160}
            style={{ minHeight: 90, textAlignVertical: 'top' }} help={`${dog.bio.length}/160`} />
          <ErrorText>{serverError}</ErrorText>
          <Button title="Guardar cambios" onPress={save} loading={saving} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  help: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
});
