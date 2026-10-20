import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorText } from './ui';
import { fonts, radius, useColors } from '@/theme';

export const SIZES = ['Chico', 'Mediano', 'Grande'] as const;
export type Size = (typeof SIZES)[number];

export const ENERGY = [
  { t: 'Muy tranquilo', d: 'Prefiere las siestas y los paseos cortos.' },
  { t: 'Tranquilo', d: 'Disfruta paseos calmados, sin prisa.' },
  { t: 'Moderado', d: 'Juega un buen rato y luego descansa.' },
  { t: 'Activo', d: 'Necesita correr y jugar todos los días.' },
  { t: 'Incansable', d: 'Energía sin límite. Siempre quiere más.' },
];

function Label({ children }: { children: string }) {
  const c = useColors();
  return <Text style={[styles.label, { color: c.muted }]}>{children}</Text>;
}

/** Chico / Mediano / Grande. */
export function SizePicker({ value, onChange }: { value: Size; onChange: (v: Size) => void }) {
  const c = useColors();
  return (
    <View style={{ gap: 5 }}>
      <Label>Tamaño</Label>
      <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
        {SIZES.map((s) => {
          const on = s === value;
          return (
            <Pressable
              key={s}
              onPress={() => onChange(s)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[styles.seg, { borderColor: on ? c.ball : c.line, backgroundColor: on ? c.ball : c.surface }]}
            >
              <Text style={[styles.segText, { color: on ? c.ballInk : c.ink }]}>{s}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export type Sex = 'Macho' | 'Hembra';
export const sexLabel = (s: Sex) => (s === 'Macho' ? '♂ Macho' : '♀ Hembra');

/** Macho / Hembra. */
export function SexPicker({ value, onChange, error }: { value: Sex | ''; onChange: (v: Sex) => void; error?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 5 }}>
      <Label>Sexo</Label>
      <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
        {(['Macho', 'Hembra'] as const).map((s) => {
          const on = s === value;
          return (
            <Pressable
              key={s}
              onPress={() => onChange(s)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={s}
              style={[styles.seg, { borderColor: on ? c.ball : error ? c.coral : c.line, backgroundColor: on ? c.ball : c.surface }]}
            >
              <Text style={[styles.segText, { color: on ? c.ballInk : c.ink }]}>{sexLabel(s)}</Text>
            </Pressable>
          );
        })}
      </View>
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

/** Nivel de energía del 1 al 5, con barritas que crecen, como en el prototipo. */
export function EnergyPicker({ value, onChange, error }: { value: number; onChange: (v: number) => void; error?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Label>Nivel de energía</Label>
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup">
        {ENERGY.map((e, i) => {
          const n = i + 1;
          const on = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${n} de 5: ${e.t}`}
              style={[styles.energy, { borderColor: on ? c.ball : c.line, backgroundColor: on ? c.ball : c.surface }]}
            >
              <View style={styles.bars}>
                {[1, 2, 3, 4, 5].map((k) => (
                  <View
                    key={k}
                    style={[
                      styles.bar,
                      { height: 6 + k * 4 },
                      { backgroundColor: k <= n ? (on ? c.ballInk : c.muted) : on ? 'rgba(24,35,58,0.18)' : c.line },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.energyNum, { color: on ? c.ballInk : c.ink }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.desc, { color: c.muted }]}>
        {value ? (
          <>
            <Text style={{ fontFamily: fonts.bodyBold, color: c.ink }}>{ENERGY[value - 1].t}. </Text>
            {ENERGY[value - 1].d}
          </>
        ) : (
          'Elige del 1 (muy tranquilo) al 5 (incansable).'
        )}
      </Text>
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  seg: { flex: 1, borderWidth: 1.5, borderRadius: radius.pill, paddingVertical: 10, alignItems: 'center' },
  segText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  energy: { flex: 1, borderWidth: 1.5, borderRadius: radius.sm, alignItems: 'center', paddingTop: 10, paddingBottom: 8, gap: 6 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 26 },
  bar: { width: 4, borderRadius: 2 },
  energyNum: { fontFamily: fonts.display, fontSize: 15 },
  desc: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19 },
});
