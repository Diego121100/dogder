import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BreedPicker } from './BreedPicker';
import { Button } from './ui';
import { PlusBadge } from './PlusPrompt';
import { DEFAULT_FILTERS, ENERGY_NAMES, fetchNearby, Filters } from '@/lib/discover';
import { AGE_GROUPS, DISTANCES } from '@/lib/filters';
import { fonts, radius, useColors } from '@/theme';

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function Label({ children, plus }: { children: string; plus?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={[styles.label, { color: c.muted }]}>{children}</Text>
      {plus && <PlusBadge small />}
    </View>
  );
}

/** Sin Plus, los filtros avanzados no se usan. */
export const stripAdvanced = (f: Filters): Filters => ({ ...f, ages: [], energies: [], breeds: [] });

/**
 * Filtros de Descubrir: distancia, macho o hembra, tamaño, edad, energía y razas.
 * El botón de abajo dice en vivo cuántos perros coinciden.
 * Se monta solo mientras está abierto, así siempre parte de los filtros actuales.
 */
export function FilterSheet({
  initial,
  plus,
  onClose,
  onApply,
  onUpsell,
}: {
  initial: Filters;
  /** Edad, energía y razas son de Dogder Plus. */
  plus: boolean;
  onClose: () => void;
  onApply: (f: Filters) => void;
  onUpsell: () => void;
}) {
  const c = useColors();
  const [f, setF] = useState<Filters>(plus ? initial : stripAdvanced(initial));
  const [count, setCount] = useState<number | null>(null);

  // Cuenta en vivo cuántos perros coinciden (con una pequeña espera para no saturar).
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      fetchNearby(f)
        .then((d) => alive && setCount(d.length))
        .catch(() => alive && setCount(null));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [f]);

  const chip = (label: string, on: boolean, onPress: () => void, sub?: string, key?: string) => (
    <Pressable key={key ?? label} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
      style={[styles.chip, { borderColor: on ? c.ball : c.line, backgroundColor: on ? c.ball : c.surface }]}>
      <Text style={[styles.chipText, { color: on ? c.ballInk : c.ink }]}>{label}</Text>
      {sub ? <Text style={[styles.chipSub, { color: on ? c.ballInk : c.muted }]}>{sub}</Text> : null}
    </Pressable>
  );

  const label =
    count === null ? 'Aplicar filtros' : count === 0 ? 'Ningún perro coincide' : count >= 20 ? 'Ver 20+ perros' : `Ver ${count} perro${count === 1 ? '' : 's'}`;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10}>
            <Text style={[styles.headerBtn, { color: c.ink }]}>Cerrar</Text>
          </Pressable>
          <Text style={[styles.title, { color: c.ink }]}>Filtros</Text>
          <Pressable onPress={() => setF(DEFAULT_FILTERS)} accessibilityRole="button" hitSlop={10}>
            <Text style={[styles.headerBtn, { color: c.ink, textDecorationLine: 'underline' }]}>Limpiar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.group}>
            <Label>Distancia máxima</Label>
            <View style={styles.wrap}>
              {DISTANCES.map((d) => chip(d.t, f.maxKm === d.km, () => setF({ ...f, maxKm: d.km })))}
            </View>
          </View>

          <View style={styles.group}>
            <Label>Macho o hembra</Label>
            <View style={styles.wrap}>
              {chip('Todos', f.sexes.length === 0, () => setF({ ...f, sexes: [] }))}
              {chip('♂ Macho', f.sexes.length === 1 && f.sexes[0] === 'Macho', () => setF({ ...f, sexes: ['Macho'] }))}
              {chip('♀ Hembra', f.sexes.length === 1 && f.sexes[0] === 'Hembra', () => setF({ ...f, sexes: ['Hembra'] }))}
            </View>
          </View>

          <View style={styles.group}>
            <Label>Tamaño</Label>
            <View style={styles.wrap}>
              {['Chico', 'Mediano', 'Grande'].map((s) =>
                chip(s, f.sizes.includes(s), () => {
                  const next = toggle(f.sizes, s);
                  setF({ ...f, sizes: next.length ? next : [s] }); // siempre al menos uno
                }),
              )}
            </View>
          </View>

          <View style={styles.group}>
            <Label plus={!plus}>Edad</Label>
            <View style={[styles.wrap, !plus && styles.locked]}>
              {chip('Todas', f.ages.length === 0, () => (plus ? setF({ ...f, ages: [] }) : onUpsell()))}
              {AGE_GROUPS.map((a) => chip(a.k, f.ages.includes(a.k), () => (plus ? setF({ ...f, ages: toggle(f.ages, a.k) }) : onUpsell()), a.t))}
            </View>
          </View>

          <View style={styles.group}>
            <Label plus={!plus}>Energía</Label>
            <View style={[styles.wrap, !plus && styles.locked]}>
              {ENERGY_NAMES.map((n, i) =>
                chip(`${i + 1} · ${n}`, f.energies.includes(i + 1), () => (plus ? setF({ ...f, energies: toggle(f.energies, i + 1) }) : onUpsell()), undefined, n),
              )}
            </View>
          </View>

          {!plus ? (
            <View style={styles.group}>
              <Label plus>Razas</Label>
              <Pressable onPress={onUpsell} accessibilityRole="button" accessibilityLabel="Filtrar por raza: función de Dogder Plus"
                style={[styles.lockedField, styles.locked, { borderColor: c.line, backgroundColor: c.surface }]}>
                <Text style={[styles.chipText, { color: c.muted }]}>Cualquier raza</Text>
              </Pressable>
            </View>
          ) : (
          <View style={styles.group}>
            <BreedPicker
              label="Razas"
              value=""
              placeholder="Cualquier raza · busca para agregar"
              onChange={(b) => setF({ ...f, breeds: f.breeds.includes(b) ? f.breeds : [...f.breeds, b] })}
            />
            {f.breeds.length > 0 && (
              <View style={styles.wrap}>
                {f.breeds.map((b) => (
                  <Pressable key={b} onPress={() => setF({ ...f, breeds: f.breeds.filter((x) => x !== b) })}
                    accessibilityRole="button" accessibilityLabel={`Quitar ${b}`}
                    style={[styles.tag, { backgroundColor: c.ball }]}>
                    <Text style={[styles.tagText, { color: c.ballInk }]}>{b}  ×</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: c.line }]}>
          <Button title={label} disabled={count === 0} onPress={() => onApply(f)} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  headerBtn: { fontFamily: fonts.bodyBold, fontSize: 15 },
  title: { fontFamily: fonts.display, fontSize: 20 },
  body: { paddingHorizontal: 20, paddingBottom: 30, gap: 22 },
  group: { gap: 8 },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  chipSub: { fontFamily: fonts.body, fontSize: 11 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  locked: { opacity: 0.55 },
  lockedField: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 13 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6, borderTopWidth: StyleSheet.hairlineWidth },
});
