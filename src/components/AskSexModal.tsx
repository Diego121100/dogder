import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sex, sexLabel } from './Choices';
import { ErrorText } from './ui';
import { fonts, radius, useColors } from '@/theme';

/**
 * Pregunta única para perfiles creados antes de que existiera el campo
 * "macho o hembra". Aparece en Descubrir hasta que se responde.
 */
export function AskSexModal({
  dogName,
  visible,
  onAnswer,
}: {
  dogName: string;
  visible: boolean;
  onAnswer: (sex: Sex) => Promise<boolean>;
}) {
  const c = useColors();
  const [saving, setSaving] = useState<Sex | null>(null);
  const [error, setError] = useState('');

  async function pick(sex: Sex) {
    setSaving(sex);
    setError('');
    const ok = await onAnswer(sex);
    setSaving(null);
    if (!ok) setError('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.');
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: c.surface }]}>
          <Text style={[styles.title, { color: c.ink }]}>¿{dogName} es macho o hembra?</Text>
          <Text style={[styles.text, { color: c.muted }]}>
            Agregamos este dato a los perfiles. Los demás dueños lo verán en la tarjeta de {dogName}.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['Macho', 'Hembra'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => pick(s)}
                disabled={!!saving}
                accessibilityRole="button"
                style={[styles.option, { borderColor: c.line, backgroundColor: saving === s ? c.ball : c.bg }]}
              >
                <Text style={[styles.optionText, { color: c.ink }]}>{sexLabel(s)}</Text>
              </Pressable>
            ))}
          </View>
          <ErrorText>{error}</ErrorText>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,14,22,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, gap: 14 },
  title: { fontFamily: fonts.display, fontSize: 24 },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  option: { flex: 1, borderWidth: 1.5, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  optionText: { fontFamily: fonts.bodyBold, fontSize: 16 },
});
