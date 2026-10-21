import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Button, Lead, Screen } from '@/components/ui';
import { PlusBadge } from '@/components/PlusPrompt';
import { PLUS_FEATURES, usePlan } from '@/lib/plan';
import { fonts, radius, useColors } from '@/theme';

/** Qué incluye Dogder Plus. El cobro (Apple / Google) se conecta cuando la app esté en las tiendas. */
export default function PlusScreen() {
  const c = useColors();
  const { plan } = usePlan();
  const until = plan?.plusHasta?.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={6}
        style={[styles.back, { borderColor: c.line, backgroundColor: c.surface }]}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.ink} strokeWidth={2.5} strokeLinecap="round">
          <Path d="M6 6l12 12M18 6L6 18" />
        </Svg>
      </Pressable>

      <View style={[styles.hero, { backgroundColor: c.ink }]}>
        <PlusBadge />
        <Text style={[styles.heroTitle, { color: c.bg }]}>Dogder Plus</Text>
        <Text style={[styles.heroText, { color: c.bg }]}>Más paseos, más amigos y ningún límite para tu perro.</Text>
      </View>

      {plan?.plus && (
        <View style={[styles.active, { backgroundColor: c.surface, borderColor: c.ball }]}>
          <Text style={[styles.featTitle, { color: c.ink }]}>¡Tienes Dogder Plus!</Text>
          {until ? <Text style={[styles.featText, { color: c.muted }]}>Activo hasta el {until}.</Text> : null}
        </View>
      )}

      <View style={{ gap: 14 }}>
        {PLUS_FEATURES.map((f) => (
          <View key={f.key} style={styles.feat}>
            <View style={[styles.check, { backgroundColor: c.ball }]}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c.ballInk} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M5 12.5l4.5 4.5L19 7.5" />
              </Svg>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.featTitle, { color: c.ink }]}>{f.title}</Text>
              <Text style={[styles.featText, { color: c.muted }]}>{f.text}</Text>
            </View>
          </View>
        ))}
      </View>

      {!plan?.plus && (
        <View style={{ gap: 8 }}>
          <Button title="Muy pronto" variant="ball" disabled onPress={() => {}} />
          <Lead>
            Podrás contratar Dogder Plus desde la app en cuanto Dogder esté en App Store y Google Play. Lo básico
            (deslizar, hacer match y chatear) siempre será gratis.
          </Lead>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: radius.lg, padding: 20, gap: 8 },
  heroTitle: { fontFamily: fonts.display, fontSize: 32 },
  heroText: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 22, opacity: 0.85 },
  active: { borderWidth: 2, borderRadius: radius.md, padding: 14, gap: 2 },
  feat: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  featTitle: { fontFamily: fonts.bodyBold, fontSize: 16 },
  featText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
});
