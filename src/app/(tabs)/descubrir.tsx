import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Button, Logo } from '@/components/ui';
import { SwipeCard, SwipeCardHandle } from '@/components/SwipeCard';
import { ActionBar } from '@/components/ActionBar';
import { MatchModal } from '@/components/MatchModal';
import { AskSexModal } from '@/components/AskSexModal';
import { Toast, useToast } from '@/components/Toast';
import {
  fetchNearby,
  myDogSummary,
  MyDog,
  NearbyDog,
  sendSwipe,
  setMyDogSex,
  superAvailableAt,
  SwipeKind,
  takePendingSwipe,
  undoSwipe,
  waitLabel,
} from '@/lib/discover';
import { useLocationWatch } from '@/lib/location';
import { fonts, useColors } from '@/theme';

/** Descubrir: las tarjetas de perros cercanos para deslizar. */
export default function Discover() {
  const c = useColors();
  const toast = useToast();
  const top = useRef<SwipeCardHandle>(null);

  const [queue, setQueue] = useState<NearbyDog[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [history, setHistory] = useState<{ dog: NearbyDog; kind: SwipeKind }[]>([]);
  const [superAt, setSuperAt] = useState<Date | null>(null);
  const [mine, setMine] = useState<MyDog | null>(null);
  const [match, setMatch] = useState<{ id: string; nombre: string; foto?: string } | null>(null);

  useLocationWatch(true);

  // Trae los perros cercanos, el estado del súper hueso y los datos de mi perro.
  const load = useCallback(() => {
    Promise.all([fetchNearby(), superAvailableAt(), myDogSummary()])
      .then(([dogs, at, me]) => {
        setQueue(dogs);
        setSuperAt(at);
        setMine(me);
        setStatus('ready');
      })
      .catch((e) => {
        if (__DEV__) console.warn('[Descubrir]', e);
        setStatus('error');
      });
  }, []);

  useEffect(load, [load]);

  // Botones "Intentar de nuevo" y "Buscar de nuevo".
  const reload = () => {
    setStatus('loading');
    load();
  };

  // El súper hueso vuelve a estar disponible solo, 24 horas después de usarlo.
  useEffect(() => {
    if (!superAt) return;
    const ms = superAt.getTime() - Date.now();
    const t = setTimeout(() => setSuperAt(null), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [superAt]);

  const superExhausted = () => !!superAt && superAt > new Date();

  // Guarda la decisión en el servidor y muestra el match si lo hubo.
  async function commit(dog: NearbyDog, kind: SwipeKind) {
    const r = await sendSwipe(dog.perro_id, kind);
    if (!r.ok) {
      setQueue((q) => [dog, ...q]);
      setHistory((h) => h.filter((x) => x.dog.perro_id !== dog.perro_id));
      if (r.reason === 'super_agotado') {
        setSuperAt(r.availableAt);
        toast.show(`Ya usaste tu súper hueso. Tendrás otro en ${waitLabel(r.availableAt)}.`);
      } else {
        if (__DEV__) console.warn('[Deslizar]', r.message);
        toast.show('No se guardó. Revisa tu conexión e inténtalo de nuevo.');
      }
      return;
    }
    if (kind === 'super') setSuperAt(new Date(Date.now() + 24 * 3600_000));
    if (r.matchId) setMatch({ id: r.matchId, nombre: dog.nombre, foto: dog.fotos[0] });
  }

  // Se llama cuando la tarjeta de arriba terminó de salir de la pantalla.
  function onSwiped(kind: SwipeKind) {
    const dog = queue[0];
    if (!dog) return;
    if (kind === 'super' && superExhausted()) {
      // Deslizó hacia arriba sin súper hueso disponible: la tarjeta regresa a su lugar.
      top.current?.reset();
      toast.show(`Ya usaste tu súper hueso. Tendrás otro en ${waitLabel(superAt!)}.`);
      return;
    }
    setQueue((q) => q.slice(1));
    setHistory((h) => [...h.slice(-19), { dog, kind }]);
    commit(dog, kind);
    if (queue.length <= 3) refill(queue.slice(1).map((d) => d.perro_id));
  }

  async function refill(known: string[]) {
    try {
      const more = await fetchNearby();
      setQueue((q) => {
        const have = new Set([...q.map((d) => d.perro_id), ...known]);
        return [...q, ...more.filter((d) => !have.has(d.perro_id))];
      });
    } catch {
      // Sin internet: se vuelve a intentar en el siguiente deslizamiento.
    }
  }

  function press(kind: SwipeKind) {
    if (!queue.length) return;
    if (kind === 'super' && superExhausted()) {
      toast.show(`Ya usaste tu súper hueso. Tendrás otro en ${waitLabel(superAt!)}.`);
      return;
    }
    top.current?.swipe(kind);
  }

  async function undo() {
    const last = history[history.length - 1];
    if (!last) {
      toast.show('No hay ningún perro anterior.');
      return;
    }
    setHistory((h) => h.slice(0, -1));
    setQueue((q) => [last.dog, ...q.filter((d) => d.perro_id !== last.dog.perro_id)]);
    const ok = await undoSwipe(last.dog.perro_id);
    if (ok && last.kind === 'super') {
      setSuperAt(null);
      toast.show('Recuperaste tu súper hueso.');
    }
  }

  // Al volver del perfil completo, aplica la acción que se eligió ahí.
  useFocusEffect(
    useCallback(() => {
      const p = takePendingSwipe();
      if (p && queue[0]?.perro_id === p.id) setTimeout(() => press(p.kind), 250);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queue]),
  );

  const visible = queue.slice(0, 2).reverse(); // la de abajo primero, la de arriba al final

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <Logo />
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.deck}>
        {status === 'loading' && <ActivityIndicator color={c.ink} style={{ flex: 1 }} />}
        {status === 'error' && (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: c.ink }]}>No pudimos cargar perros</Text>
            <Text style={[styles.emptyText, { color: c.muted }]}>Revisa tu conexión a internet e inténtalo de nuevo.</Text>
            <Button title="Intentar de nuevo" onPress={reload} />
          </View>
        )}
        {status === 'ready' && queue.length === 0 && (
          <View style={styles.empty}>
            <View style={[styles.ball, { backgroundColor: c.ball }]} />
            <Text style={[styles.emptyTitle, { color: c.ink }]}>No hay más perros cerca por ahora</Text>
            <Text style={[styles.emptyText, { color: c.muted }]}>
              Vuelve más tarde: cada día se unen más dueños de tu zona.
            </Text>
            <Button title="Buscar de nuevo" variant="secondary" onPress={reload} />
          </View>
        )}
        {status === 'ready' &&
          visible.map((dog, i) => {
            const isTop = i === visible.length - 1;
            return (
              <View
                key={dog.perro_id}
                style={[StyleSheet.absoluteFill, !isTop && { transform: [{ translateY: 10 }, { scale: 0.96 }] }]}
                pointerEvents={isTop ? 'auto' : 'none'}
              >
                <SwipeCard
                  ref={isTop ? top : undefined}
                  dog={dog}
                  active={isTop}
                  onSwiped={onSwiped}
                  onOpen={() => router.push({ pathname: '/perro/[id]', params: { id: dog.perro_id } })}
                />
              </View>
            );
          })}
      </View>

      <ActionBar
        onUndo={undo}
        onNope={() => press('nope')}
        onSuper={() => press('super')}
        onLike={() => press('like')}
        superLeft={superAt ? 0 : 1}
        disabled={status !== 'ready'}
      />

      <AskSexModal
        dogName={mine?.nombre ?? 'tu perro'}
        visible={status === 'ready' && !!mine && !mine.sexo}
        onAnswer={async (sexo) => {
          if (!mine) return false;
          const ok = await setMyDogSex(mine.id, sexo);
          if (ok) setMine({ ...mine, sexo });
          return ok;
        }}
      />
      <Toast message={toast.message} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  deck: { flex: 1, marginHorizontal: 16, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  ball: { width: 64, height: 64, borderRadius: 32 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 22, textAlign: 'center' },
  emptyText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
