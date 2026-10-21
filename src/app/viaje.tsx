import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import Svg, { Path } from 'react-native-svg';
import { Button, Lead, Screen, Title } from '@/components/ui';
import { PlusBadge } from '@/components/PlusPrompt';
import { clearTravel, setTravel, usePlan } from '@/lib/plan';
import { fonts, radius, useColors } from '@/theme';

const CITIES = [
  { name: 'Ciudad de México', lat: 19.4326, lng: -99.1332 },
  { name: 'Guadalajara', lat: 20.6767, lng: -103.3475 },
  { name: 'Monterrey', lat: 25.6866, lng: -100.3161 },
  { name: 'Querétaro', lat: 20.5888, lng: -100.3899 },
  { name: 'Puebla', lat: 19.0414, lng: -98.2063 },
  { name: 'Mérida', lat: 20.9674, lng: -89.5926 },
  { name: 'Cancún', lat: 21.1619, lng: -86.8515 },
  { name: 'Puerto Vallarta', lat: 20.6534, lng: -105.2253 },
  { name: 'San Miguel de Allende', lat: 20.9144, lng: -100.7452 },
  { name: 'Oaxaca', lat: 17.0732, lng: -96.7266 },
];

type Place = { name: string; lat: number; lng: number };

/** Modo viaje (Dogder Plus): buscar perros como si estuvieras en otra ciudad o colonia. */
export default function Travel() {
  const c = useColors();
  const { plan } = usePlan();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<Place | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function search() {
    const q = query.trim();
    if (q.length < 3) return setError('Escribe una ciudad o colonia.');
    setError('');
    setFound(null);
    setSearching(true);
    try {
      const [hit] = await Location.geocodeAsync(q);
      if (!hit) {
        setError('No encontramos ese lugar. Prueba con el nombre de la ciudad, por ejemplo "Condesa, CDMX".');
        return;
      }
      let name = q;
      try {
        const [addr] = await Location.reverseGeocodeAsync({ latitude: hit.latitude, longitude: hit.longitude });
        const parts = [addr?.district, addr?.city ?? addr?.subregion ?? addr?.region].filter((p): p is string => !!p);
        if (parts.length) name = [...new Set(parts)].join(', ');
      } catch {
        // Si no se puede obtener el nombre, se usa lo que escribió.
      }
      setFound({ name, lat: hit.latitude, lng: hit.longitude });
    } catch {
      setError('No pudimos buscar ese lugar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSearching(false);
    }
  }

  async function go(p: Place) {
    setSaving(true);
    const ok = await setTravel(p.lat, p.lng, p.name);
    setSaving(false);
    if (!ok) return Alert.alert('No se pudo activar', 'Revisa tu conexión e inténtalo de nuevo.');
    router.back();
  }

  async function backHome() {
    setSaving(true);
    const ok = await clearTravel();
    setSaving(false);
    if (!ok) return Alert.alert('No se pudo cambiar', 'Revisa tu conexión e inténtalo de nuevo.');
    router.back();
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" hitSlop={6}
        style={[styles.back, { borderColor: c.line, backgroundColor: c.surface }]}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.ink} strokeWidth={2.5} strokeLinecap="round">
          <Path d="M15 5l-7 7 7 7" />
        </Svg>
      </Pressable>
      <PlusBadge />
      <Title>Modo viaje</Title>
      <Lead>
        ¿Te vas de vacaciones con tu perro o te mudas pronto? Busca perros en otra ciudad o colonia antes de llegar.
        Mientras esté activo, los perros de allá también te verán cerca.
      </Lead>

      {!plan && <ActivityIndicator color={c.ink} />}

      {plan && !plan.plus && (
        <View style={{ gap: 10 }}>
          <Lead>El modo viaje es parte de Dogder Plus.</Lead>
          <Button title="Conocer Dogder Plus" variant="ball" onPress={() => router.replace('/plus')} />
        </View>
      )}

      {plan?.plus && (
        <>
          <View style={[styles.current, { backgroundColor: c.surface, borderColor: plan.viaje ? c.ink : c.line }]}>
            <Text style={[styles.label, { color: c.muted }]}>Buscando perros en</Text>
            <Text style={[styles.place, { color: c.ink }]}>{plan.viaje ?? 'Tu zona (donde estás ahora)'}</Text>
            {plan.viaje && <Button title="Volver a mi zona" variant="secondary" loading={saving} onPress={backHome} />}
          </View>

          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: c.muted }]}>Buscar un lugar</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={search}
                returnKeyType="search"
                placeholder="Ciudad o colonia, ej. Condesa, CDMX"
                placeholderTextColor={c.muted}
                autoCorrect={false}
                accessibilityLabel="Ciudad o colonia"
                style={[styles.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }]}
              />
              <Pressable onPress={search} accessibilityRole="button" accessibilityLabel="Buscar"
                style={[styles.searchBtn, { backgroundColor: c.ink }]}>
                {searching ? <ActivityIndicator color={c.bg} /> : <Text style={[styles.searchText, { color: c.bg }]}>Buscar</Text>}
              </Pressable>
            </View>
            {error ? <Text style={[styles.err, { color: c.coral }]}>{error}</Text> : null}
            {found && (
              <View style={[styles.current, { backgroundColor: c.surface, borderColor: c.ball }]}>
                <Text style={[styles.place, { color: c.ink }]}>{found.name}</Text>
                <Button title={`Buscar perros en ${found.name}`} variant="ball" loading={saving} onPress={() => go(found)} />
              </View>
            )}
          </View>

          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: c.muted }]}>Ciudades populares</Text>
            <View style={styles.wrap}>
              {CITIES.map((city) => (
                <Pressable key={city.name} onPress={() => go(city)} disabled={saving} accessibilityRole="button"
                  style={[styles.chip, { borderColor: plan.viaje === city.name ? c.ink : c.line, backgroundColor: c.surface }]}>
                  <Text style={[styles.chipText, { color: c.ink }]}>{city.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  current: { borderWidth: 1.5, borderRadius: radius.md, padding: 14, gap: 8 },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  place: { fontFamily: fonts.display, fontSize: 20 },
  input: { flex: 1, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 12, fontFamily: fonts.body, fontSize: 16 },
  searchBtn: { borderRadius: radius.sm, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minWidth: 84 },
  searchText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  err: { fontFamily: fonts.bodyBold, fontSize: 13 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 14 },
});
