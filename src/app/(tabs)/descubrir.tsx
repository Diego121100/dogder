import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Button, Logo } from '@/components/ui';
import { SwipeCard, SwipeCardHandle } from '@/components/SwipeCard';
import { ActionBar } from '@/components/ActionBar';
import { MatchModal } from '@/components/MatchModal';
import { AskSexModal } from '@/components/AskSexModal';
import { SuperSent } from '@/components/SuperSent';
import { Toast, useToast } from '@/components/Toast';
import { FilterSheet } from '@/components/FilterSheet';
import {
  dogName,
  fetchNearby,
  Filters,
  myDogSummary,
  MyDog,
  NearbyDog,
  onSuperReceived,
  sendSwipe,
  setMyDogSex,
  superAvailableAt,
  SwipeKind,
  takePendingSwipe,
  undoSwipe,
  waitLabel,
} from '@/lib/discover';
import { useLocationWatch } from '@/lib/location';
import { activeFilters, loadFilters, saveFilters } from '@/lib/filters';
import { fonts, useColors } from '@/theme';

type MatchInfo = { id: string; nombre: string; foto?: string; superRecibido?: boolean; superEnviado?: boolean };

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
  const [superSent, setSuperSent] = useState<string | null>(null);
  const [superReceived, setSuperReceived] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Las funciones que traen perros siempre usan los filtros vigentes (se actualiza al aplicarlos).
  const filtersRef = useRef(filters);

  useLocationWatch(true);

  // Trae los perros cercanos, el estado del súper hueso y los datos de mi perro.
  const load = useCallback(() => {
    Promise.all([fetchNearby(filtersRef.current), superAvailableAt(), myDogSummary()])
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

  // Al aplicar filtros se guardan en el teléfono y se vuelven a buscar perros.
  function applyFilters(f: Filters) {
    setFiltersOpen(false);
    setFilters(f);
    saveFilters(f);
    filtersRef.current = f;
    setHistory([]);
    reload();
  }
  const nFilters = activeFilters(filters);

  // El súper hueso vuelve a estar disponible solo, 24 horas después de usarlo.
  useEffect(() => {
    if (!superAt) return;
    const ms = superAt.getTime() - Date.now();
    const t = setTimeout(() => setSuperAt(null), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [superAt]);

  const superExhausted = () => !!superAt && superAt > new Date();

  const matchAfterSuper = useRef<MatchInfo | null>(null);
  const clearSuperSent = useCallback(() => {
    setSuperSent(null);
    if (matchAfterSuper.current) {
      setMatch(matchAfterSuper.current);
      matchAfterSuper.current = null;
    }
  }, []);
  const clearSuperReceived = useCallback(() => setSuperReceived(null), []);

  // Si alguien le manda un súper hueso a mi perro mientras la app está abierta, se avisa
  // y ese perro se pone como la siguiente tarjeta.
  const myDogId = mine?.id;
  useEffect(() => {
    if (!myDogId) return;
    return onSuperReceived(myDogId, async (fromId) => {
      const name = await dogName(fromId);
      if (name) setSuperReceived(name);
      try {
        const dogs = await fetchNearby(filtersRef.current);
        const d = dogs.find((x) => x.perro_id === fromId);
        if (!d) return;
        setQueue((q) => {
          const rest = q.filter((x) => x.perro_id !== fromId);
          return rest.length ? [rest[0], d, ...rest.slice(1)] : [d];
        });
      } catch {
        // Sin internet: aparecerá la próxima vez que se carguen perros.
      }
    });
  }, [myDogId]);

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
    const m = r.matchId
      ? { id: r.matchId, nombre: dog.nombre, foto: dog.fotos[0], superRecibido: dog.te_dio_super, superEnviado: kind === 'super' }
      : null;
    if (kind === 'super') {
      // Primero "¡Mandaste un súper hueso!"; si además hubo match, aparece después.
      matchAfterSuper.current = m;
      setSuperSent(dog.nombre);
    } else if (m) {
      setMatch(m);
    }
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
      const more = await fetchNearby(filtersRef.current);
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
        <Logo />
      </View>
      <View style={styles.toolbar}>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={nFilters ? `Filtros, ${nFilters} activos` : 'Filtros'}
          style={({ pressed }) => [styles.filterBtn, { borderColor: c.line, backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 }]}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c.ink} strokeWidth={2.4} strokeLinecap="round">
            <Path d="M4 6h16M7 12h10M10 18h4" />
          </Svg>
          <Text style={[styles.filterText, { color: c.ink }]}>Filtros</Text>
          {nFilters > 0 && (
            <View style={[styles.filterCount, { backgroundColor: c.ball }]}>
              <Text style={[styles.filterCountText, { color: c.ballInk }]}>{nFilters}</Text>
            </View>
          )}
        </Pressable>
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
              {nFilters
                ? 'Prueba con menos filtros o una distancia mayor para ver más perros.'
                : 'Vuelve más tarde: cada día se unen más dueños de tu zona.'}
            </Text>
            {nFilters > 0 && <Button title="Cambiar filtros" onPress={() => setFiltersOpen(true)} />}
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
      <SuperSent dogName={superSent} onDone={clearSuperSent} />
      <SuperSent dogName={superReceived} onDone={clearSuperReceived} variant="received" />
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
      {filtersOpen && <FilterSheet initial={filters} onClose={() => setFiltersOpen(false)} onApply={applyFilters} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingTop: 8 },
  toolbar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  filterText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  filterCount: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  filterCountText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  deck: { flex: 1, marginHorizontal: 16, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  ball: { width: 64, height: 64, borderRadius: 32 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 22, textAlign: 'center' },
  emptyText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
