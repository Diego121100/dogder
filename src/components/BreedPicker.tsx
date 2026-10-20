import { useMemo, useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COMUNES, normalizar, RAZAS, SIN_RAZA } from '@/content/razas';
import { ErrorText } from './ui';
import { fonts, radius, useColors } from '@/theme';

type Section = { title: string; data: string[]; custom?: boolean };

/** Campo "Raza": abre una lista con buscador. Si la raza no está, se puede usar lo que se escribió. */
export function BreedPicker({
  value,
  onChange,
  error,
  placeholder = 'Busca o elige una raza',
  label = 'Raza',
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  label?: string;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const sections = useMemo<Section[]>(() => {
    const words = normalizar(query).split(/\s+/).filter(Boolean);
    if (!words.length) {
      return [
        { title: 'Sin raza definida', data: SIN_RAZA },
        { title: 'Más comunes', data: COMUNES },
        { title: `Todas las razas (${RAZAS.length})`, data: RAZAS },
      ];
    }
    const match = (b: string) => words.every((w) => normalizar(b).includes(w));
    const starts = RAZAS.filter((b) => match(b) && normalizar(b).startsWith(words[0]));
    const rest = RAZAS.filter((b) => match(b) && !normalizar(b).startsWith(words[0]));
    const out: Section[] = [];
    const mixed = SIN_RAZA.filter(match);
    if (mixed.length) out.push({ title: 'Sin raza definida', data: mixed });
    if (starts.length + rest.length) out.push({ title: 'Razas', data: [...starts, ...rest] });
    const exact = [...SIN_RAZA, ...RAZAS].some((b) => normalizar(b) === normalizar(query));
    if (!exact && query.trim().length >= 2) {
      out.push({ title: out.length ? '¿No está en la lista?' : 'No encontramos esa raza', data: [query.trim()], custom: true });
    }
    return out;
  }, [query]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={{ gap: 5 }}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={value ? `Raza: ${value}. Toca para cambiarla` : 'Elegir raza'}
        style={[styles.field, { borderColor: error ? c.coral : c.line, backgroundColor: c.surface }]}
      >
        <Text style={[styles.fieldText, { color: value ? c.ink : c.muted }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Text style={{ color: c.muted, fontSize: 16 }}>⌄</Text>
      </Pressable>
      <ErrorText>{error}</ErrorText>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.ink }]}>Elige la raza</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" hitSlop={10}>
              <Text style={[styles.close, { color: c.ink }]}>Cerrar</Text>
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar: pastor, salchicha, mestizo…"
              placeholderTextColor={c.muted}
              autoFocus
              autoCorrect={false}
              clearButtonMode="while-editing"
              accessibilityLabel="Buscar raza"
              style={[styles.search, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }]}
            />
          </View>
          <SectionList
            sections={sections}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item, i) => item + i}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            renderSectionHeader={({ section }) => (
              <Text style={[styles.section, { color: c.muted }]}>{section.title}</Text>
            )}
            renderItem={({ item, section }) => {
              const selected = !section.custom && item === value;
              return (
                <Pressable
                  onPress={() => pick(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: selected ? c.ball : pressed ? c.surface : 'transparent' },
                  ]}
                >
                  <Text style={[styles.rowText, { color: selected ? c.ballInk : c.ink }, section.custom && styles.custom]}>
                    {section.custom ? `Usar “${item}”` : item}
                  </Text>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  field: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldText: { fontFamily: fonts.body, fontSize: 16, flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  title: { fontFamily: fonts.display, fontSize: 24 },
  close: { fontFamily: fonts.bodyBold, fontSize: 15 },
  search: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 12, fontFamily: fonts.body, fontSize: 16 },
  section: { fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  row: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10 },
  rowText: { fontFamily: fonts.body, fontSize: 16 },
  custom: { fontFamily: fonts.bodyBold },
});
