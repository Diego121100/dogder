import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, useColors } from '@/theme';

/** Aviso corto en la parte de abajo: "Recuperaste tu súper hueso", etc. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(m);
    timer.current = setTimeout(() => setMessage(null), 2600);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { message, show };
}

export function Toast({ message }: { message: string | null }) {
  const c = useColors();
  if (!message) return null;
  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityLiveRegion="polite">
      <View style={[styles.toast, { backgroundColor: c.ink }]}>
        <Text style={[styles.text, { color: c.bg }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, bottom: 130, alignItems: 'center', zIndex: 50 },
  toast: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  text: { fontFamily: fonts.bodyBold, fontSize: 14, textAlign: 'center' },
});
