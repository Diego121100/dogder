import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from './ui';
import { fonts, radius, useColors } from '@/theme';

export type PlusPromptInfo = { title: string; text: string };

/** Etiqueta "PLUS" para marcar funciones de Dogder Plus. */
export function PlusBadge({ small }: { small?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.badge, small && styles.badgeSmall, { backgroundColor: c.ink }]}>
      <Text style={[styles.badgeText, small && { fontSize: 9.5 }, { color: c.ball }]}>PLUS</Text>
    </View>
  );
}

/** Aviso cuando se llega a un límite gratis o se toca una función de Plus. */
export function PlusPrompt({ info, onClose }: { info: PlusPromptInfo | null; onClose: () => void }) {
  const c = useColors();
  return (
    <Modal visible={!!info} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: c.surface }]}>
        {info && (
          <View style={{ gap: 12 }}>
            <PlusBadge />
            <Text style={[styles.title, { color: c.ink }]}>{info.title}</Text>
            <Text style={[styles.text, { color: c.muted }]}>{info.text}</Text>
            <Button
              title="Conocer Dogder Plus"
              variant="ball"
              onPress={() => {
                onClose();
                router.push('/plus');
              }}
            />
            <Button title="Ahora no" variant="secondary" onPress={onClose} />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,14,22,0.55)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22 },
  title: { fontFamily: fonts.display, fontSize: 24 },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeSmall: { paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1 },
});
