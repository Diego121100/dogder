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
import { PlusPrompt, PlusPromptInfo } from '@/components/PlusPrompt';
import type { Seeking } from '@/components/Choices';
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
  setMySeeking,
  SwipeKind,
  takePendingSwipe,
  undoSwipe,
  waitLabel,
} from '@/lib/discover';
import { useLocationWatch } from '@/lib/location';
import { activeFilters, loadFilters, saveFilters } from '@/lib/filters';
import { FREE_PLAN, myPlan, Plan } from '@/lib/plan';
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
  const [plan, setPlan] = useState<Plan>(FREE_PLAN);
  const [upsell, setUpsell] = useState<PlusPromptInfo | null>(null);
  const [mine, setMine] = useState<MyDog | null>(null);
  const [superSent, setSuperSent] = useState<string | null>(null);
  const [superReceived, setSuperReceived] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Las funciones que traen perros siempre usan los filtros vigentes (se actualiza al aplicarlos).
  const filtersRef = useRef(filters);

  useLocationWatch(true);

  // Trae los perros cercanos, el plan (límites de hoy) y los datos de mi perro.
  const viajeRef = useRef<string | null | undefined>(undefined);
  const plusRef = useRef<boolean | undefined>(undefined);
  const load = useCallback(() => {
    Promise.all([fetchNearby(filtersRef.current), myPlan(), myDogSummary()])
      .then(([dogs, p, me]) => {
        setQueue(dogs);
        setPlan(p);
        viajeRef.current = p.viaje;
        plusRef.current = p.plus;
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
  async function applyFilters(f: Filters, seeking: Seeking) {
    setFiltersOpen(false);
    if (mine && seeking !== mine.busca) {
      if (await setMySeeking(mine.id, seeking)) setMine({ ...mine, busca: seeking });
      else toast.show('No se pudo guardar a quién buscas. Revisa tu conexión.');
    }
    setFilters(f);
    saveFilters(f);
    filtersRef.current = f;
    setHistory([]);
    reload();
  }
  const nFilters = activeFilters(filters, plan.plus);

  // Al volver a esta pestaña (por ejemplo, después de cambiar el modo viaje o activar Plus),
  // si cambió dónde buscar o el plan, se vuelven a buscar perros.
  useFocusEffect(
    useCallback(() => {
      if (viajeRef.current === undefined) return;
      myPlan()
        .then((p) => {
          setPlan(p);
          if (p.viaje !== viajeRef.current || p.plus !== plusRef.current) {
            setStatus('loading');
            load();
          }
        })
        .catch(() => {});
    }, [load]),
  );

  // Los súper huesos y los me gusta vuelven solos cuando pasan las 24 horas.
  const nextRefill = [plan.superVuelve, plan.likesVuelven, plan.deshacerVuelve]
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  useEffect(() => {
    if (!nextRefill) return;
    const t = setTimeout(() => myPlan().then(setPlan).catch(() => {}), Math.max(1000, nextRefill.getTime() - Date.now() + 1000));
    return () => clearTimeout(t);
  }, [nextRefill]);

  const superExhausted = () => plan.supersRestantes <= 0;
  const likesExhausted = () => plan.likesRestantes === 0;

  function superMessage(at: Date | null) {
    const wait = at ? ` Tendrás otro en ${waitLabel(at)}.` : '';
    if (plan.plus) return toast.show(`Ya usaste tus 5 súper huesos de hoy.${wait}`);
    setUpsell({
      title: 'Ya usaste tu súper hueso de hoy',
      text: `Con Dogder Plus tienes 5 súper huesos al día.${wait}`,
    });
  }
  function likesMessage(at: Date | null) {
    setUpsell({
      title: 'Se acabaron tus me gusta de hoy',
      text: `Tienes 50 me gusta cada 24 horas${at ? `; vuelves a tener en ${waitLabel(at)}` : ''}. Con Dogder Plus son ilimitados. Rechazar sigue siendo gratis.`,
    });
  }

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
        setPlan((p) => ({ ...p, supersRestantes: 0, superVuelve: r.availableAt }));
        superMessage(r.availableAt);
      } else if (r.reason === 'likes_agotados') {
        setPlan((p) => ({ ...p, likesRestantes: 0, likesVuelven: r.availableAt }));
        likesMessage(r.availableAt);
      } else {
        if (__DEV__ && r.reason === 'error') console.warn('[Deslizar]', r.message);
        toast.show('No se guardó. Revisa tu conexión e inténtalo de nuevo.');
      }
      return;
    }
    // Descuenta lo que se usó (y, si se acabó, pregunta al servidor cuándo vuelve).
    setPlan((p) => {
      const next = {
        ...p,
        supersRestantes: kind === 'super' ? Math.max(0, p.supersRestantes - 1) : p.supersRestantes,
        likesRestantes: kind === 'like' && p.likesRestantes !== null ? Math.max(0, p.likesRestantes - 1) : p.likesRestantes,
      };
      if (next.supersRestantes === 0 || next.likesRestantes === 0) myPlan().then(setPlan).catch(() => {});
      if (kind === 'like' && (next.likesRestantes === 10 || next.likesRestantes === 3)) {
        setTimeout(() => toast.show(`Te quedan ${next.likesRestantes} me gusta hoy.`), 0);
      }
      return next;
    });
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
    if ((kind === 'super' && superExhausted()) || (kind === 'like' && likesExhausted())) {
      // Sin súper huesos o sin me gusta disponibles: la tarjeta regresa a su lugar.
      top.current?.reset();
      if (kind === 'super') superMessage(plan.superVuelve);
      else likesMessage(plan.likesVuelven);
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
    if (kind === 'super' && superExhausted()) return superMessage(plan.superVuelve);
    if (kind === 'like' && likesExhausted()) return likesMessage(plan.likesVuelven);
    top.current?.swipe(kind);
  }

  function undoUpsell(at: Date | null) {
    setUpsell({
      title: 'Ya usaste tu "Volver" de hoy',
      text: `Gratis puedes regresar al último perro una vez al día${at ? ` (otra vez en ${waitLabel(at)})` : ''}. Con Dogder Plus, las veces que quieras.`,
    });
  }

  async function undo() {
    const last = history[history.length - 1];
    if (!last) {
      toast.show('No hay ningún perro anterior.');
      return;
    }
    if (!plan.plus && plan.deshacerVuelve && plan.deshacerVuelve > new Date()) return undoUpsell(plan.deshacerVuelve);
    setHistory((h) => h.slice(0, -1));
    setQueue((q) => [last.dog, ...q.filter((d) => d.perro_id !== last.dog.perro_id)]);
    const r = await undoSwipe(last.dog.perro_id);
    if (!r.ok) {
      // No se pudo: el perro vuelve a salir de la pila.
      setQueue((q) => q.filter((d) => d.perro_id !== last.dog.perro_id));
      setHistory((h) => [...h, last]);
      if (r.reason === 'deshacer_agotado') {
        setPlan((p) => ({ ...p, deshacerVuelve: r.availableAt }));
        undoUpsell(r.availableAt);
      } else if (r.reason === 'solo_ultimo') {
        setUpsell({ title: 'Solo puedes regresar al último', text: 'Con Dogder Plus puedes regresar a cualquier perro que deslizaste.' });
      } else {
        toast.show('No se pudo regresar. Revisa tu conexión.');
      }
      return;
    }
    setPlan((p) => ({
      ...p,
      deshacerVuelve: p.plus ? null : new Date(Date.now() + 24 * 3600_000),
      supersRestantes: last.kind === 'super' ? p.supersRestantes + 1 : p.supersRestantes,
      likesRestantes: last.kind === 'like' && p.likesRestantes !== null ? p.likesRestantes + 1 : p.likesRestantes,
    }));
    if (last.kind === 'super') toast.show('Recuperaste tu súper hueso.');
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
        <Pressable
          onPress={() => router.push('/viaje')}
          accessibilityRole="button"
          accessibilityLabel={plan.viaje ? `Modo viaje: ${plan.viaje}` : 'Modo viaje'}
          style={({ pressed }) => [styles.filterBtn, { flexShrink: 1, borderColor: plan.viaje ? c.ink : c.line, backgroundColor: plan.viaje ? c.ink : c.surface, opacity: pressed ? 0.7 : 1 }]}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={plan.viaje ? c.ball : c.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z" />
            <Path d="M12 12.2a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2z" />
          </Svg>
          <Text style={[styles.filterText, { color: plan.viaje ? c.bg : c.ink, flexShrink: 1 }]} numberOfLines={1}>
            {plan.viaje ?? 'Mi zona'}
          </Text>
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
        superLeft={plan.supersRestantes}
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
      {filtersOpen && (
        <FilterSheet
          initial={filters}
          seeking={mine?.busca ?? 'Ambos'}
          plus={plan.plus}
          onClose={() => setFiltersOpen(false)}
          onApply={applyFilters}
          onUpsell={() => {
            setFiltersOpen(false);
            setTimeout(() => setUpsell({ title: 'Filtros avanzados', text: 'Con Dogder Plus puedes buscar por edad, nivel de energía y raza.' }), 400);
          }}
        />
      )}
      <PlusPrompt info={upsell} onClose={() => setUpsell(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingTop: 8 },
  toolbar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
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
