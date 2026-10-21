import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { fonts, useColors } from '@/theme';

/** Íconos de la barra de acciones, los mismos del prototipo. */
export function UndoIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 14L4 9l5-5" />
      <Path d="M4 9h10a6 6 0 010 12h-3" />
    </Svg>
  );
}
export function NopeIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round">
      <Path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}
export function BoneIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M7.5 4.5a2.5 2.5 0 00-2.4 3.2 2.5 2.5 0 00.6 4.9l6.6 6.6a2.5 2.5 0 104.9.6 2.5 2.5 0 10-.6-4.9L10 8.3a2.5 2.5 0 00-2.5-3.8z"
      />
    </Svg>
  );
}
export function PawIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx={12} cy={16} rx={5} ry={4.2} fill={color} />
      <Ellipse cx={6} cy={10.5} rx={2.1} ry={2.6} fill={color} />
      <Ellipse cx={18} cy={10.5} rx={2.1} ry={2.6} fill={color} />
      <Ellipse cx={9.2} cy={6.2} rx={2} ry={2.5} fill={color} />
      <Ellipse cx={14.8} cy={6.2} rx={2} ry={2.5} fill={color} />
    </Svg>
  );
}

type Props = {
  onUndo?: () => void;
  onNope: () => void;
  onSuper: () => void;
  onLike: () => void;
  superLeft: number; // súper huesos que quedan hoy (1 gratis, 5 con Plus)
  disabled?: boolean;
};

/** Volver · Rechazar · Súper hueso · Me gusta, con su nombre en chico debajo. */
export function ActionBar({ onUndo, onNope, onSuper, onLike, superLeft, disabled }: Props) {
  const c = useColors();
  const btn = (size: number, extra?: object) => [
    styles.btn,
    { width: size, height: size, borderRadius: size / 2, backgroundColor: c.surface, opacity: disabled ? 0.5 : 1 },
    extra,
  ];
  return (
    <View style={styles.row}>
      {onUndo && (
        <View style={styles.item}>
          <View style={styles.slot}>
            <Pressable onPress={onUndo} disabled={disabled} accessibilityRole="button" accessibilityLabel="Volver al perro anterior" style={btn(50)}>
            <UndoIcon color="#C99A1E" />
          </Pressable>
          </View>
          <Text style={[styles.label, { color: c.muted }]}>Volver</Text>
        </View>
      )}
      <View style={styles.item}>
        <View style={styles.slot}>
          <Pressable onPress={onNope} disabled={disabled} accessibilityRole="button" accessibilityLabel="Rechazar" style={btn(66)}>
          <NopeIcon color={c.coral} />
        </Pressable>
        </View>
        <Text style={[styles.label, { color: c.muted }]}>Rechazar</Text>
      </View>
      <View style={styles.item}>
        <View style={styles.slot}>
          <Pressable
          onPress={onSuper}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={superLeft ? `Súper hueso: tienes ${superLeft} disponible${superLeft === 1 ? '' : 's'}` : 'Súper hueso: ya los usaste'}
          style={btn(50, superLeft ? undefined : { shadowOpacity: 0, borderWidth: 1.5, borderColor: c.line })}
        >
          <BoneIcon color={superLeft ? c.sky : c.muted} />
          <View style={[styles.count, { backgroundColor: superLeft ? c.sky : c.muted, borderColor: c.bg }]}>
            <Text style={styles.countText}>{superLeft}</Text>
          </View>
        </Pressable>
        </View>
        <Text style={[styles.label, { color: c.muted }]}>Súper hueso</Text>
      </View>
      <View style={styles.item}>
        <View style={styles.slot}>
          <Pressable onPress={onLike} disabled={disabled} accessibilityRole="button" accessibilityLabel="Me gusta" style={btn(66)}>
          <PawIcon color={c.grass} />
        </Pressable>
        </View>
        <Text style={[styles.label, { color: c.muted }]}>Me gusta</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 8, paddingTop: 12, paddingBottom: 4 },
  item: { width: 76, alignItems: 'center', gap: 5 },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#18233A',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    marginTop: 0,
  },
  slot: { height: 66, justifyContent: 'center', alignItems: 'center' },
  label: { fontFamily: fonts.bodyBold, fontSize: 11.5, textAlign: 'center' },
  count: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 11 },
});
