import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from './Check';
import { Button, ErrorText } from './ui';
import { blockDogOwner, REPORT_REASONS, reportUser } from '@/lib/account';
import { fonts, radius, useColors } from '@/theme';

type Step = 'menu' | 'report' | 'block';

/**
 * Reportar o bloquear a un perro (y a su dueño). Se abre desde el chat y desde el perfil completo.
 * El reporte es confidencial; al bloquear se borran el match y la conversación.
 */
export function SafetySheet({
  dogId,
  dogName,
  visible,
  onClose,
  onBlocked,
  onReported,
}: {
  dogId: string;
  dogName: string;
  visible: boolean;
  onClose: () => void;
  onBlocked: () => void;
  onReported: (alsoBlocked: boolean) => void;
}) {
  const c = useColors();
  const [step, setStep] = useState<Step>('menu');
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setStep('menu');
    setReason(null);
    setDetails('');
    setAlsoBlock(true);
    setError('');
    onClose();
  };

  async function sendReport() {
    if (!reason) return setError('Elige un motivo para enviar el reporte.');
    setBusy(true);
    const ok = await reportUser(dogId, reason, details);
    const blocked = ok && alsoBlock ? await blockDogOwner(dogId) : false;
    setBusy(false);
    if (!ok) return setError('No se pudo enviar el reporte. Revisa tu conexión e inténtalo de nuevo.');
    close();
    onReported(blocked);
  }

  async function block() {
    setBusy(true);
    const ok = await blockDogOwner(dogId);
    setBusy(false);
    if (!ok) return setError('No se pudo bloquear. Revisa tu conexión e inténtalo de nuevo.');
    close();
    onBlocked();
  }

  const option = (title: string, sub: string, onPress: () => void, danger?: boolean) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.option, { borderColor: c.line, backgroundColor: c.bg }]}>
      <Text style={[styles.optionTitle, { color: danger ? c.coral : c.ink }]}>{title}</Text>
      <Text style={[styles.optionSub, { color: c.muted }]}>{sub}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Cerrar" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: c.surface }]}>
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            {step === 'menu' && (
              <>
                <Text style={[styles.title, { color: c.ink }]}>{dogName}</Text>
                {option('Reportar', 'Avísanos si algo no está bien. Nadie sabrá que fuiste tú.', () => setStep('report'))}
                {option('Bloquear', 'Ya no se verán entre ustedes y se borra la conversación.', () => setStep('block'), true)}
                <Button title="Cancelar" variant="secondary" onPress={close} />
              </>
            )}

            {step === 'report' && (
              <>
                <Text style={[styles.title, { color: c.ink }]}>Reportar a {dogName}</Text>
                <Text style={[styles.optionSub, { color: c.muted, fontSize: 14 }]}>
                  ¿Qué está pasando? Tu reporte es confidencial: nadie sabrá que fuiste tú.
                </Text>
                <View style={{ gap: 8 }} accessibilityRole="radiogroup">
                  {REPORT_REASONS.map((r) => {
                    const on = reason === r;
                    return (
                      <Pressable key={r} onPress={() => { setReason(r); setError(''); }} accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        style={[styles.reason, { borderColor: on ? c.ink : c.line, backgroundColor: c.bg }, on && { borderWidth: 2 }]}>
                        <View style={[styles.radio, { borderColor: on ? c.ink : c.muted }]}>
                          {on && <View style={[styles.radioDot, { backgroundColor: c.ink }]} />}
                        </View>
                        <Text style={[styles.reasonText, { color: c.ink }]}>{r}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={details}
                  onChangeText={(t) => setDetails(t.slice(0, 300))}
                  placeholder="Cuéntanos qué pasó (opcional)"
                  placeholderTextColor={c.muted}
                  multiline
                  accessibilityLabel="Detalles del reporte"
                  style={[styles.details, { borderColor: c.line, backgroundColor: c.bg, color: c.ink }]}
                />
                <Check checked={alsoBlock} onChange={setAlsoBlock} label={`Bloquear también a ${dogName}`}>
                  Bloquear también a {dogName}
                </Check>
                <ErrorText>{error}</ErrorText>
                <Button title="Enviar reporte" onPress={sendReport} loading={busy} />
                <Button title="Cancelar" variant="secondary" onPress={close} />
              </>
            )}

            {step === 'block' && (
              <>
                <Text style={[styles.title, { color: c.ink }]}>¿Bloquear a {dogName}?</Text>
                {[
                  `Ya no verás a ${dogName} y tampoco te verá a ti.`,
                  'Se eliminan el match y la conversación.',
                  'No se le enviará ningún aviso.',
                ].map((t) => (
                  <View key={t} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={[styles.optionSub, { color: c.muted, fontSize: 14.5 }]}>•</Text>
                    <Text style={[styles.optionSub, { color: c.muted, fontSize: 14.5, flex: 1 }]}>{t}</Text>
                  </View>
                ))}
                <ErrorText>{error}</ErrorText>
                <Button title="Bloquear" variant="danger" onPress={block} loading={busy} />
                <Button title="Cancelar" variant="secondary" onPress={close} />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,14,22,0.55)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: 640 },
  title: { fontFamily: fonts.display, fontSize: 22 },
  option: { borderWidth: 1, borderRadius: radius.md, padding: 14, gap: 2 },
  optionTitle: { fontFamily: fonts.bodyBold, fontSize: 16 },
  optionSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: radius.sm, padding: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  reasonText: { fontFamily: fonts.bodySemi, fontSize: 14.5 },
  details: { borderWidth: 1, borderRadius: radius.sm, padding: 12, minHeight: 80, fontFamily: fonts.body, fontSize: 15, textAlignVertical: 'top' },
});
