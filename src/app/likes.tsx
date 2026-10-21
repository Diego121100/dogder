import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { Button, Lead, Screen, Title } from '@/components/ui';
import { NopeIcon, PawIcon } from '@/components/ActionBar';
import { MatchModal } from '@/components/MatchModal';
import { DogFace, SAMPLE_DOGS } from '@/components/DogFace';
import { PlusBadge } from '@/components/PlusPrompt';
import { myDogSummary, MyDog, NearbyDog, sendSwipe, SwipeKind, takePendingSwipe } from '@/lib/discover';
import { distanceLabel } from '@/lib/distance';
import { likesReceived, myPlan, Plan } from '@/lib/plan';
import { photoUrl } from '@/lib/photos';
import { fonts, radius, useColors } from '@/theme';

type MatchInfo = { id: string; nombre: string; foto?: string; superRecibido?: boolean };

/** Quién le dio me gusta a mi perro. Con Plus se ven y se puede hacer match directo; gratis, solo cuántos son. */
export default function LikesReceived() {
  const c = useColors();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [dogs, setDogs] = useState<NearbyDog[] | null>(null);
  const [mine, setMine] = useState<MyDog | null>(null);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [error, setError] = useState('');

  const swipe = useCallback(async (dog: NearbyDog, kind: SwipeKind) => {
    setDogs((d) => d?.filter((x) => x.perro_id !== dog.perro_id) ?? null);
    const r = await sendSwipe(dog.perro_id, kind);
    if (!r.ok) {
      setDogs((d) => (d ? [dog, ...d] : [dog]));
      setError(r.reason === 'super_agotado' ? 'Ya usaste tus súper huesos de hoy.' : 'No se guardó. Revisa tu conexión.');
      return;
    }
    if (r.matchId) setMatch({ id: r.matchId, nombre: dog.nombre, foto: dog.fotos[0], superRecibido: dog.te_dio_super });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([myPlan(), myDogSummary()])
        .then(async ([p, me]) => {
          if (!alive) return;
          setPlan(p);
          setMine(me);
          const list = p.plus ? await likesReceived() : [];
          if (!alive) return;
          setDogs(list);
          // Si se eligió una acción en el perfil completo, se aplica aquí.
          const pending = takePendingSwipe();
          const dog = pending && list.find((d) => d.perro_id === pending.id);
          if (pending && dog) swipe(dog, pending.kind);
        })
        .catch(() => alive && setError('No pudimos cargar. Revisa tu conexión.'));
      return () => {
        alive = false;
      };
    }, [swipe]),
  );

  const total = plan?.plus ? dogs?.length ?? 0 : plan?.likesRecibidos ?? 0;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" hitSlop={6}
        style={[styles.back, { borderColor: c.line, backgroundColor: c.surface }]}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.ink} strokeWidth={2.5} strokeLinecap="round">
          <Path d="M15 5l-7 7 7 7" />
        </Svg>
      </Pressable>
      <Title>{total === 1 ? 'Le gustas a 1 perro' : `Le gustas a ${total} perros`}</Title>
      {error ? <Text style={[styles.err, { color: c.coral }]}>{error}</Text> : null}
      {!plan && <ActivityIndicator color={c.ink} />}

      {plan && !plan.plus && (
        <>
          <Lead>
            {total
              ? 'Estos perros ya le dieron me gusta al tuyo. Con Dogder Plus ves quiénes son y haces match al instante.'
              : 'Todavía nadie le ha dado me gusta a tu perro. ¡Sigue deslizando!'}
          </Lead>
          {total > 0 && (
            <View style={styles.grid}>
              {Array.from({ length: Math.min(total, 6) }).map((_, i) => (
                <View key={i} style={[styles.tile, styles.blurred, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <View style={{ opacity: 0.25 }}>
                    <DogFace look={SAMPLE_DOGS[i % SAMPLE_DOGS.length]} size={90} />
                  </View>
                  <Text style={[styles.q, { color: c.muted }]}>?</Text>
                </View>
              ))}
            </View>
          )}
          <PlusBadge />
          <Button title="Conocer Dogder Plus" variant="ball" onPress={() => router.push('/plus')} />
        </>
      )}

      {plan?.plus && dogs?.length === 0 && (
        <Lead>No hay perros nuevos que le hayan dado me gusta al tuyo. Te avisamos aquí en cuanto haya.</Lead>
      )}

      {plan?.plus && !!dogs?.length && (
        <View style={styles.grid}>
          {dogs.map((d) => (
            <View key={d.perro_id} style={[styles.tile, { backgroundColor: c.surface, borderColor: d.te_dio_super ? c.sky : c.line }, d.te_dio_super && { borderWidth: 2.5 }]}>
              <Pressable onPress={() => router.push({ pathname: '/perro/[id]', params: { id: d.perro_id } })}
                accessibilityRole="button" accessibilityLabel={`Ver el perfil de ${d.nombre}`} style={{ width: '100%' }}>
                {d.fotos[0] ? <Image source={{ uri: photoUrl(d.fotos[0]) }} style={styles.photo} contentFit="cover" /> : <View style={styles.photo} />}
                {d.te_dio_super && (
                  <View style={[styles.superTag, { backgroundColor: c.sky }]}>
                    <Text style={styles.superText}>Súper hueso</Text>
                  </View>
                )}
                <View style={{ padding: 8, gap: 1 }}>
                  <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>{d.nombre}, {d.edad}</Text>
                  <Text style={[styles.sub, { color: c.muted }]} numberOfLines={1}>
                    {distanceLabel(d.cercania, d.distancia_km)}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.actions}>
                <Pressable onPress={() => swipe(d, 'nope')} accessibilityRole="button" accessibilityLabel={`Rechazar a ${d.nombre}`}
                  style={[styles.act, { borderColor: c.line }]}>
                  <NopeIcon color={c.coral} />
                </Pressable>
                <Pressable onPress={() => swipe(d, 'like')} accessibilityRole="button" accessibilityLabel={`Me gusta ${d.nombre}`}
                  style={[styles.act, { borderColor: c.line }]}>
                  <PawIcon color={c.grass} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      <MatchModal
        mine={mine}
        other={match}
        onClose={() => setMatch(null)}
        onMessage={() => {
          const id = match?.id;
          setMatch(null);
          if (id) router.push({ pathname: '/chat/[id]', params: { id } });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  err: { fontFamily: fonts.bodyBold, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center' },
  blurred: { aspectRatio: 0.8, justifyContent: 'center' },
  q: { position: 'absolute', fontFamily: fonts.display, fontSize: 40 },
  photo: { width: '100%', aspectRatio: 1, backgroundColor: '#ccc' },
  superTag: { position: 'absolute', top: 8, left: 8, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  superText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 11 },
  name: { fontFamily: fonts.bodyBold, fontSize: 15 },
  sub: { fontFamily: fonts.body, fontSize: 12.5 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 8, paddingBottom: 8, width: '100%' },
  act: { flex: 1, borderWidth: 1, borderRadius: radius.sm, paddingVertical: 6, alignItems: 'center' },
});
