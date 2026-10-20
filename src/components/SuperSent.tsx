import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { BoneIcon } from './ActionBar';
import { fonts, useColors } from '@/theme';

/**
 * Aviso de súper hueso en el centro de la pantalla; se va solo.
 * "sent": lo mandaste tú. "received": alguien te lo mandó.
 */
export function SuperSent({
  dogName,
  onDone,
  variant = 'sent',
}: {
  dogName: string | null;
  onDone: () => void;
  variant?: 'sent' | 'received';
}) {
  const c = useColors();
  useEffect(() => {
    if (!dogName) return;
    const t = setTimeout(onDone, variant === 'sent' ? 2200 : 3200);
    return () => clearTimeout(t);
  }, [dogName, onDone, variant]);

  if (!dogName) return null;
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(220)} style={styles.wrap} pointerEvents="none"
      accessibilityLiveRegion="assertive">
      <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.card, { backgroundColor: c.surface }]}>
        <View style={[styles.circle, { backgroundColor: c.sky }]}>
          <BoneIcon color="#FFFFFF" size={44} />
        </View>
        <Text style={[styles.title, { color: c.ink }]}>
          {variant === 'sent' ? '¡Mandaste un súper hueso!' : `¡${dogName} te mandó un súper hueso!`}
        </Text>
        <Text style={[styles.text, { color: c.muted }]}>
          {variant === 'sent'
            ? `Le mandaste un súper hueso a ${dogName}. Su dueño verá que te encantó.`
            : `A ${dogName} le encantó tu perro. Te aparecerá primero en Descubrir.`}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,14,22,0.35)', zIndex: 60 },
  card: {
    width: 280,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#18233A',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  circle: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontFamily: fonts.display, fontSize: 22, textAlign: 'center' },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, textAlign: 'center' },
});
