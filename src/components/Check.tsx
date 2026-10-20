import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, useColors } from '@/theme';

/** Casilla de verificación con texto (que puede incluir enlaces). */
export function Check({
  checked,
  onChange,
  children,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  label: string;
}) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={() => onChange(!checked)}
        hitSlop={10}
        style={[styles.box, { borderColor: checked ? c.grass : c.line, backgroundColor: checked ? c.grass : c.surface }]}
      >
        {checked ? <Text style={styles.tick}>✓</Text> : null}
      </Pressable>
      <Text style={[styles.text, { color: c.ink }]} onPress={() => onChange(!checked)}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tick: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 18 },
  text: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
});
