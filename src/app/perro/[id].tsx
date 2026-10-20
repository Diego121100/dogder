import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { BoneIcon, NopeIcon, PawIcon } from '@/components/ActionBar';
import { sexLabel } from '@/components/Choices';
import { SafetySheet } from '@/components/SafetySheet';
import { ageGroup, cachedDog, ENERGY_NAMES, setPendingSwipe, SwipeKind } from '@/lib/discover';
import { distanceLabel } from '@/lib/distance';
import { photoUrl } from '@/lib/photos';
import { fonts, useColors } from '@/theme';

const ENERGY_DESC = [
  'Prefiere las siestas y los paseos cortos.',
  'Disfruta paseos calmados, sin prisa.',
  'Juega un buen rato y luego descansa.',
  'Necesita correr y jugar todos los días.',
  'Energía sin límite. Siempre quiere más.',
];

/** Perfil completo de un perro: todas sus fotos, su descripción, energía y su humano. */
export default function DogProfile() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dog = cachedDog(id);
  const [page, setPage] = useState(0);
  const [safety, setSafety] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/descubrir'));
  const act = (kind: SwipeKind) => {
    setPendingSwipe(id, kind);
    close();
  };

  if (!dog) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: c.ink }}>Este perfil ya no está disponible</Text>
        <Pressable onPress={close}><Text style={{ fontFamily: fonts.bodyBold, color: c.ink }}>Volver</Text></Pressable>
      </SafeAreaView>
    );
  }

  const energy = Math.min(5, Math.max(1, dog.energia));
  const photoH = width * 1.15;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={{ height: photoH }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            accessibilityLabel={`Fotos de ${dog.nombre}`}
          >
            {dog.fotos.map((f, i) => (
              <Image key={f + i} source={{ uri: photoUrl(f) }} style={{ width, height: photoH }} contentFit="cover"
                accessibilityLabel={`Foto ${i + 1} de ${dog.nombre}`} />
            ))}
          </ScrollView>
          {dog.fotos.length > 1 && (
            <View style={[styles.bars, { top: insets.top + 8 }]} pointerEvents="none">
              {dog.fotos.map((_, i) => (
                <View key={i} style={[styles.bar, { backgroundColor: i === page ? '#FFFFFF' : 'rgba(255,255,255,0.4)' }]} />
              ))}
            </View>
          )}
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Cerrar perfil" hitSlop={8}
            style={[styles.close, { top: insets.top + 22 }]}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#18233A" strokeWidth={2.6} strokeLinecap="round">
              <Path d="M6 9l6 6 6-6" />
            </Svg>
          </Pressable>
          {dog.fotos.length > 1 && (
            <View style={styles.count} pointerEvents="none">
              <Text style={styles.countText}>{page + 1} / {dog.fotos.length}</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <View>
            <Text style={[styles.name, { color: c.ink }]}>
              {dog.nombre} <Text style={[styles.age, { color: c.muted }]}>{dog.edad}</Text>
            </Text>
            <Text style={[styles.sub, { color: c.muted }]}>
              {dog.colonia} · {distanceLabel(dog.cercania, dog.distancia_km)}
            </Text>
          </View>
          {dog.te_dio_super && (
            <View style={[styles.superTag, { backgroundColor: c.sky }]}>
              <BoneIcon color="#FFFFFF" size={16} />
              <Text style={styles.superTagText}>{dog.nombre} te mandó un súper hueso</Text>
            </View>
          )}
          <View style={styles.chips}>
            {[dog.sexo ? sexLabel(dog.sexo) : null, dog.raza, dog.tamano, ageGroup(dog.edad)]
              .filter((t): t is string => !!t)
              .map((t) => (
              <View key={t} style={[styles.chip, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Text style={[styles.chipText, { color: c.ink }]}>{t}</Text>
              </View>
            ))}
          </View>
          {dog.bio ? (
            <View style={styles.section}>
              <Text style={[styles.h4, { color: c.muted }]}>SOBRE {dog.nombre.toUpperCase()}</Text>
              <Text style={[styles.p, { color: c.ink }]}>{dog.bio}</Text>
            </View>
          ) : null}
          <View style={styles.section}>
            <Text style={[styles.h4, { color: c.muted }]}>ENERGÍA</Text>
            <View style={{ flexDirection: 'row', gap: 4, maxWidth: 220 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <View key={n} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: n <= energy ? c.grass : c.line }} />
              ))}
            </View>
            <Text style={[styles.p, { color: c.ink }]}>
              <Text style={{ fontFamily: fonts.bodyBold }}>{ENERGY_NAMES[energy - 1]}. </Text>
              {ENERGY_DESC[energy - 1]}
            </Text>
          </View>
          <View style={styles.section}>
            <Text style={[styles.h4, { color: c.muted }]}>SU HUMANO</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.initial, { backgroundColor: c.ink }]}>
                <Text style={{ color: c.bg, fontFamily: fonts.display, fontSize: 19 }}>{dog.dueno_nombre.charAt(0)}</Text>
              </View>
              <View>
                <Text style={[styles.p, { color: c.ink, fontFamily: fonts.bodyBold }]}>{dog.dueno_nombre}</Text>
                <Text style={[styles.p, { color: c.muted }]}>{dog.colonia}</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={() => setSafety(true)} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: c.coral, textDecorationLine: 'underline' }}>
              Reportar o bloquear a {dog.nombre}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <SafetySheet
        dogId={dog.perro_id}
        dogName={dog.nombre}
        visible={safety}
        onClose={() => setSafety(false)}
        onBlocked={() => {
          Alert.alert(`Bloqueaste a ${dog.nombre}`, 'Ya no se verán entre ustedes.');
          act('nope');
        }}
        onReported={(blocked) => {
          Alert.alert('Gracias por avisarnos', blocked
            ? `Revisaremos tu reporte. También bloqueamos a ${dog.nombre}.`
            : 'Revisaremos tu reporte lo antes posible.');
          if (blocked) act('nope');
        }}
      />
      <View style={[styles.actions, { paddingBottom: insets.bottom + 14, backgroundColor: c.bg }]}>
        <Pressable onPress={() => act('nope')} accessibilityRole="button" accessibilityLabel="Rechazar"
          style={[styles.act, styles.big, { backgroundColor: c.surface }]}>
          <NopeIcon color={c.coral} />
        </Pressable>
        <Pressable onPress={() => act('super')} accessibilityRole="button" accessibilityLabel="Súper hueso"
          style={[styles.act, styles.small, { backgroundColor: c.surface }]}>
          <BoneIcon color={c.sky} />
        </Pressable>
        <Pressable onPress={() => act('like')} accessibilityRole="button" accessibilityLabel="Me gusta"
          style={[styles.act, styles.big, { backgroundColor: c.surface }]}>
          <PawIcon color={c.grass} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { position: 'absolute', left: 10, right: 10, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  close: {
    position: 'absolute',
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { position: 'absolute', right: 14, bottom: 12, backgroundColor: 'rgba(10,14,22,0.7)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  countText: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 12 },
  body: { paddingHorizontal: 18, paddingTop: 18, gap: 18 },
  name: { fontFamily: fonts.display, fontSize: 36, lineHeight: 38, letterSpacing: -0.6 },
  age: { fontFamily: fonts.displaySemi, fontSize: 26 },
  sub: { fontFamily: fonts.bodyBold, fontSize: 14.5, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  superTag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  superTagText: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 13.5 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  section: { gap: 8 },
  h4: { fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 1 },
  p: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  initial: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actions: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 18, paddingTop: 12 },
  act: { alignItems: 'center', justifyContent: 'center', shadowColor: '#18233A', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  big: { width: 66, height: 66, borderRadius: 33 },
  small: { width: 50, height: 50, borderRadius: 25 },
});

