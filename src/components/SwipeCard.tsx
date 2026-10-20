import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { NearbyDog, SwipeKind } from '@/lib/discover';
import { ENERGY_NAMES } from '@/lib/discover';
import { BoneIcon } from './ActionBar';
import { distanceLabel } from '@/lib/distance';
import { photoUrl } from '@/lib/photos';
import { sexLabel } from './Choices';
import { fonts, useColors } from '@/theme';

export type SwipeCardHandle = { swipe: (kind: SwipeKind) => void; reset: () => void };

type Props = {
  dog: NearbyDog;
  active: boolean; // solo la tarjeta de arriba se puede deslizar
  onSwiped: (kind: SwipeKind) => void;
  onOpen: () => void;
};

const SWIPE_X = 110;
const SWIPE_Y = 130;

/** Tarjeta de perro que se desliza: derecha = me gusta, izquierda = rechazar, arriba = súper hueso. */
export const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard({ dog, active, onSwiped, onOpen }, ref) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const fly = (kind: SwipeKind) => {
    'worklet';
    const toX = kind === 'like' ? width * 1.5 : kind === 'nope' ? -width * 1.5 : 0;
    const toY = kind === 'super' ? -1200 : y.value + 40;
    x.value = withTiming(toX, { duration: 280 });
    y.value = withTiming(toY, { duration: 280 }, (done) => {
      if (done) scheduleOnRN(onSwiped, kind);
    });
  };

  useImperativeHandle(ref, () => ({
    swipe: (kind) => fly(kind),
    reset: () => {
      x.value = withSpring(0);
      y.value = withSpring(0);
    },
  }));

  const pan = Gesture.Pan()
    .enabled(active)
    .onChange((e) => {
      x.value = e.translationX;
      y.value = e.translationY;
    })
    .onEnd(() => {
      if (x.value > SWIPE_X) fly('like');
      else if (x.value < -SWIPE_X) fly('nope');
      else if (y.value < -SWIPE_Y && Math.abs(x.value) < 60) fly('super');
      else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    });
  const tap = Gesture.Tap()
    .enabled(active)
    .maxDistance(8)
    .onEnd((_e, ok) => {
      if (ok) scheduleOnRN(onOpen);
    });
  const gesture = Gesture.Exclusive(pan, tap);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${x.value / 18}deg` }],
  }));
  const likeStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, 100], [0, 1], Extrapolation.CLAMP) }));
  const nopeStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-100, 0], [1, 0], Extrapolation.CLAMP) }));
  const superStyle = useAnimatedStyle(() => ({
    opacity: Math.abs(x.value) < 60 ? interpolate(y.value, [-120, 0], [1, 0], Extrapolation.CLAMP) : 0,
  }));

  const energy = Math.min(5, Math.max(1, dog.energia));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.card, { backgroundColor: c.surface }, cardStyle]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${dog.nombre}, ${dog.edad} años, ${dog.raza}. ${distanceLabel(dog.cercania, dog.distancia_km)}. Toca para ver su perfil completo`}
      >
        <Image source={{ uri: photoUrl(dog.fotos[0]) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        <LinearGradient
          colors={['rgba(10,14,22,0)', 'rgba(10,14,22,0.88)']}
          style={[StyleSheet.absoluteFill, { top: '45%' }]}
          pointerEvents="none"
        />

        {dog.te_dio_super && (
          <>
            <View style={[StyleSheet.absoluteFill, styles.superBorder, { borderColor: c.sky }]} pointerEvents="none" />
            <View style={[styles.superTag, { backgroundColor: c.sky }]} pointerEvents="none">
              <BoneIcon color="#FFFFFF" size={16} />
              <Text style={styles.superTagText}>Te mandó un súper hueso</Text>
            </View>
          </>
        )}
        <Animated.Text style={[styles.stamp, styles.like, { color: c.grass, borderColor: c.grass }, likeStyle]}>ME GUSTA</Animated.Text>
        <Animated.Text style={[styles.stamp, styles.nope, { color: c.coral, borderColor: c.coral }, nopeStyle]}>PASO</Animated.Text>
        <Animated.Text style={[styles.stamp, styles.super, { color: c.sky, borderColor: c.sky }, superStyle]}>¡SÚPER!</Animated.Text>

        <View style={styles.info} pointerEvents="none">
          <Text style={styles.name}>
            {dog.nombre} <Text style={styles.age}>{dog.edad}</Text>
          </Text>
          <View style={styles.chips}>
            {[dog.sexo ? sexLabel(dog.sexo) : null, dog.raza, dog.tamano, `${dog.colonia} · ${distanceLabel(dog.cercania, dog.distancia_km)}`]
              .filter((t): t is string => !!t)
              .map((t) => (
              <View key={t} style={styles.chip}>
                <Text style={styles.chipText}>{t}</Text>
              </View>
            ))}
          </View>
          <View style={styles.energyRow}>
            <Text style={styles.energyLabel}>ENERGÍA</Text>
            {[1, 2, 3, 4, 5].map((n) => (
              <View key={n} style={[styles.energyBar, { backgroundColor: n <= energy ? c.ball : 'rgba(255,255,255,0.3)' }]} />
            ))}
            <Text style={styles.energyLabel}>{ENERGY_NAMES[energy - 1].toUpperCase()}</Text>
          </View>
          {dog.bio ? (
            <Text style={styles.bio} numberOfLines={3}>
              {dog.bio}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#18233A',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  stamp: {
    position: 'absolute',
    top: 28,
    fontFamily: fonts.display,
    fontSize: 30,
    letterSpacing: 1,
    borderWidth: 4,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.92)',
    overflow: 'hidden',
  },
  like: { left: 20, transform: [{ rotate: '-14deg' }] },
  nope: { right: 20, transform: [{ rotate: '14deg' }] },
  super: { alignSelf: 'center', top: '42%', transform: [{ rotate: '-6deg' }] },
  superBorder: { borderWidth: 4, borderRadius: 24 },
  superTag: { position: 'absolute', top: 14, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  superTagText: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 13 },
  info: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18, gap: 8 },
  name: { color: '#FFFFFF', fontFamily: fonts.display, fontSize: 32, lineHeight: 34, letterSpacing: -0.5 },
  age: { fontFamily: fonts.displaySemi, fontSize: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 12.5 },
  energyRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  energyLabel: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 0.8, marginHorizontal: 3 },
  energyBar: { width: 16, height: 6, borderRadius: 3 },
  bio: { color: '#FFFFFF', fontFamily: fonts.body, fontSize: 14.5, lineHeight: 20, opacity: 0.95 },
});
