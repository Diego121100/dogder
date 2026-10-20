import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, ErrorText, Lead, Logo, Screen, Steps, Title } from '@/components/ui';
import { LocationResult, requestAndSaveLocation } from '@/lib/location';
import { fonts, radius, useColors } from '@/theme';

const MESSAGES: Record<Exclude<LocationResult, { ok: true }>['reason'], string> = {
  denied: 'No diste permiso de ubicación. Sin ella no podemos mostrarte perros cerca de ti.',
  blocked: 'La ubicación está desactivada para Dogder. Actívala en Ajustes → Dogder → Ubicación → “Al usar la app”.',
  services_off: 'La ubicación de tu teléfono está apagada. Actívala en Ajustes → Privacidad y seguridad → Localización.',
  timeout: 'Tardó demasiado en encontrar tu ubicación. Revisa tu señal e inténtalo de nuevo.',
  server: 'No pudimos guardar tu ubicación. Revisa tu conexión a internet e inténtalo de nuevo.',
};

/**
 * Paso 4 del registro (con ?registro=1) y también la pantalla que aparece
 * cuando la ubicación está desactivada. Sin ubicación no se puede usar Dogder.
 */
export default function LocationScreen() {
  const c = useColors();
  const { registro } = useLocalSearchParams<{ registro?: string }>();
  const inSignup = registro === '1';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Exclude<LocationResult, { ok: true }>['reason'] | null>(null);

  async function allow() {
    setLoading(true);
    setError(null);
    const r = await requestAndSaveLocation();
    setLoading(false);
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    router.replace(inSignup ? '/registro/listo' : '/inicio');
  }

  const needsSettings = error === 'blocked' || error === 'services_off';

  return (
    <Screen>
      {inSignup ? <Steps step={4} total={4} label="Tu ubicación" /> : <Logo />}
      <View style={[styles.pin, { backgroundColor: c.ball }]} accessible={false}>
        <Svg width={52} height={52} viewBox="0 0 24 24">
          <Path
            fill="#18233A"
            d="M12 2a7 7 0 00-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z"
          />
        </Svg>
      </View>
      <Title>Activa tu ubicación</Title>
      <Lead>
        Dogder necesita tu ubicación para mostrarte perros cerca de ti y calcular a qué distancia están. Sin ella no es
        posible usar la app.
      </Lead>
      <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={[styles.boxTitle, { color: c.ink }]}>Tu ubicación está protegida</Text>
        {[
          'Nunca guardamos tu ubicación exacta: la redondeamos a unos 500 metros.',
          'Los demás solo ven una distancia aproximada, como “a 2 km”.',
          'Nadie puede ver tu dirección.',
        ].map((t) => (
          <View key={t} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={[styles.boxText, { color: c.muted }]}>•</Text>
            <Text style={[styles.boxText, { color: c.muted, flex: 1 }]}>{t}</Text>
          </View>
        ))}
      </View>
      <ErrorText>{error ? MESSAGES[error] : undefined}</ErrorText>
      <View style={{ flex: 1 }} />
      {needsSettings && <Button title="Abrir Ajustes" variant="ball" onPress={() => Linking.openSettings()} />}
      <Button
        title={error ? 'Intentar de nuevo' : 'Permitir ubicación'}
        onPress={allow}
        loading={loading}
        variant={needsSettings ? 'secondary' : 'primary'}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pin: { width: 116, height: 116, borderRadius: 58, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  box: { borderWidth: 1, borderRadius: radius.md, padding: 14, gap: 6 },
  boxTitle: { fontFamily: fonts.bodyBold, fontSize: 15 },
  boxText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
});
